import express from "express";
import { requireVerifiedSession } from "../../middleware/requireVerifiedSession.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import * as sessionService from "./interview.session.service.js";
import * as answerService from "./interview.session.answers.service.js";
import AiInterview from "./interview.model.js";
import { isValidObjectId, validateAnswerInput, validateDecisionInput } from "./interview.validation.js";
import { buildInterviewContext, publicSessionContext } from "./interview.context.service.js";
import logger from "../../utils/logger.js";
import { analyzeAndPersist } from "./interview.analysis.persistence.js";
import { isProjectVerified } from "../projects/deadline.service.js";
import { requireInternalServiceSession } from "./interview.voice.auth.js";

const router = express.Router();
const answerAttempts = new Map();
function answerLimiter(req, res, next) {
  const key = `${req.candidate?._id || "unknown"}:${req.params.interviewId}`;
  const now = Date.now(); const current = answerAttempts.get(key);
  if (!current || now - current.startedAt >= 60_000) { answerAttempts.set(key, { startedAt: now, count: 1 }); return next(); }
  if (current.count >= 12) return res.status(429).json({ success: false, message: "Too many interview answers. Please wait a moment and try again." });
  current.count += 1; return next();
}
function handleError(res, error) {
  const status = error.status || 500;
  if (status >= 500) logger.error("Interview request failed", error.message);
  return res.status(status).json({ success: false, message: status >= 500 ? "Interview request could not be completed. Your answer was saved; retry to continue." : error.message, answerPersisted: Boolean(error.answerPersisted) });
}
function validInterviewId(req, res, next) {
  if (!isValidObjectId(req.params.interviewId)) return res.status(400).json({ success: false, message: "Invalid interview ID." });
  next();
}

import { syncInterviewLifecycles, recordCandidatePresence } from "./interview.lifecycle.service.js";

router.get("/admin/reports", requireAuth, requireRole("superadmin", "recruiter", "admin"), async (_req, res) => {
  try {
    const interviews = await AiInterview.find({
      status: { $in: ["COMPLETED", "ANALYSIS_PENDING", "COMPLETING", "ANALYZED", "FAILED", "CANDIDATE_NO_SHOW", "WAITING_FOR_CANDIDATE", "IN_PROGRESS", "SCHEDULED"] }
    })
      .sort({ scheduledAt: -1 })
      .limit(200)
      .populate("candidateId", "name email role skills")
      .populate("projectId", "title role technologies");
    return res.json({ success: true, interviews });
  } catch (error) { return handleError(res, error); }
});

router.all("/cron/sync", async (_req, res) => {
  try {
    const result = await syncInterviewLifecycles();
    return res.json({ success: true, ...result });
  } catch (error) { return handleError(res, error); }
});

router.get("/mine", requireVerifiedSession, async (req, res) => {
  try {
    await syncInterviewLifecycles();
    const doc = await AiInterview.findOne({ candidateId: req.candidate._id, status: { $nin: ["CANCELLED"] } }).sort({ scheduledAt: -1 });
    if (!doc) return res.json({ success: true, interview: null });
    if (!isProjectVerified(req.candidate)) return res.status(403).json({ success: false, message: "The assigned project must be verified before interview access." });
    const context = await buildInterviewContext({ candidateId: doc.candidateId, projectId: doc.projectId, bookingId: doc.bookingId });
    return res.json({ success: true, interview: doc, context: publicSessionContext(context) });
  } catch (error) { return handleError(res, error); }
});

router.post("/:interviewId/retry-analysis", requireAuth, requireRole("superadmin", "recruiter", "admin"), validInterviewId, async (req, res) => {
  try {
    const interview = await AiInterview.findById(req.params.interviewId);
    if (!interview) return res.status(404).json({ success: false, message: "Interview not found." });
    if (!interview.endedAt || !["FAILED", "ANALYSIS_PENDING", "COMPLETED", "COMPLETING"].includes(interview.status)) {
      return res.status(409).json({ success: false, message: "Only ended interviews can be re-analyzed." });
    }
    const updated = await analyzeAndPersist(interview._id);
    return res.json({ success: true, interview: updated });
  } catch (error) { return handleError(res, error); }
});

router.get("/:interviewId/report", requireAuth, requireRole("superadmin", "recruiter", "admin"), validInterviewId, async (req, res) => {
  try {
    const interview = await AiInterview.findById(req.params.interviewId).populate("candidateId", "name email role resumeData skills projectSubmission").populate("projectId", "title role technologies requirements");
    if (!interview) return res.status(404).json({ success: false, message: "Interview not found." });
    return res.json({ success: true, interview });
  } catch (error) { return handleError(res, error); }
});

router.post("/:interviewId/admin-decision", requireAuth, requireRole("superadmin", "recruiter", "admin"), validInterviewId, async (req, res) => {
  const input = validateDecisionInput(req.body);
  if (!input.ok) return res.status(400).json({ success: false, message: input.message });
  try {
    const interview = await answerService.saveAdminDecision(req.params.interviewId, { ...input, decidedBy: req.user.id });
    return res.json({ success: true, interview });
  } catch (error) { return handleError(res, error); }
});

router.get("/:interviewId", requireVerifiedSession, validInterviewId, async (req, res) => {
  try {
    const doc = await AiInterview.findById(req.params.interviewId);
    if (!doc) return res.status(404).json({ success: false, message: "Interview not found." });
    if (String(doc.candidateId) !== String(req.candidate._id)) return res.status(403).json({ success: false, message: "You cannot access this interview." });
    if (!isProjectVerified(req.candidate)) return res.status(403).json({ success: false, message: "The assigned project must be verified before interview access." });
    return res.json({ success: true, interview: doc });
  } catch (error) { return handleError(res, error); }
});
router.post("/:interviewId/presence", requireVerifiedSession, validInterviewId, async (req, res) => {
  try {
    const result = await recordCandidatePresence(req.params.interviewId, req.candidate._id);
    return res.json({ success: true, ...result });
  } catch (error) { return handleError(res, error); }
});

router.post("/:interviewId/start", requireVerifiedSession, validInterviewId, async (req, res) => {
  try { return res.json({ success: true, interview: await sessionService.startInterview(req.params.interviewId, req.candidate._id) }); }
  catch (error) { return handleError(res, error); }
});
router.post("/:interviewId/answer", requireVerifiedSession, validInterviewId, answerLimiter, async (req, res) => {
  const input = validateAnswerInput(req.body);
  if (!input.ok) return res.status(400).json({ success: false, message: input.message });
  try {
    const result = await answerService.submitAnswer(req.params.interviewId, req.candidate._id, input.text, input.requestId);
    return res.json({ success: true, interview: result.interview, nextQuestion: result.nextQuestion, duplicate: result.duplicate, closing: result.closing });
  } catch (error) { return handleError(res, error); }
});
router.post("/:interviewId/end", requireVerifiedSession, validInterviewId, async (req, res) => {
  try { return res.json({ success: true, interview: await answerService.endInterview(req.params.interviewId, req.candidate._id) }); }
  catch (error) { return handleError(res, error); }
});
router.get("/:interviewId/transcript", requireVerifiedSession, validInterviewId, async (req, res) => {
  try {
    const doc = await AiInterview.findById(req.params.interviewId).select("candidateId transcript status");
    if (!doc) return res.status(404).json({ success: false, message: "Interview not found." });
    if (String(doc.candidateId) !== String(req.candidate._id)) return res.status(403).json({ success: false, message: "You cannot access this transcript." });
    if (!isProjectVerified(req.candidate)) return res.status(403).json({ success: false, message: "The assigned project must be verified before transcript access." });
    return res.json({ success: true, transcript: doc.transcript, status: doc.status });
  } catch (error) { return handleError(res, error); }
});

router.post("/internal/:interviewId/answer", validInterviewId, async (req, res) => {
  try {
    const candidateId = req.body?.candidateId || null;
    const interview = await requireInternalServiceSession(req, req.params.interviewId, candidateId);

    const transcript = typeof req.body?.transcript === "string" ? req.body.transcript : (typeof req.body?.text === "string" ? req.body.text : "");
    const input = validateAnswerInput({ text: transcript, requestId: req.body?.requestId });
    if (!input.ok) {
      return res.status(400).json({ success: false, message: input.message });
    }

    const effectiveCandidateId = interview.candidateId;
    const cameraOn = typeof req.body?.cameraOn === "boolean" ? req.body.cameraOn : null;
    const result = await answerService.submitAnswer(
      interview._id,
      effectiveCandidateId,
      input.text,
      input.requestId,
      { cameraOn }
    );

    return res.json({
      success: true,
      accepted: true,
      duplicate: Boolean(result.duplicate),
      nextQuestion: result.nextQuestion?.question || result.nextQuestion || null,
      acknowledgment: result.acknowledgment || null,
      action: result.action || "NEXT_TOPIC",
      interviewStatus: result.interview?.status || interview.status,
      phase: result.interview?.phase || interview.phase,
      currentQuestionIndex: result.interview?.currentQuestionIndex ?? interview.currentQuestionIndex,
      closing: Boolean(result.closing),
    });
  } catch (error) {
    logger.error("[AI_INTERVIEW_ANSWER_ERROR]", {
      interviewId: req.params.interviewId,
      candidateId: req.body?.candidateId,
      transcript: req.body?.transcript || req.body?.text,
      requestId: req.body?.requestId,
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    });
    return handleError(res, error);
  }
});

router.get("/internal/:interviewId/session", validInterviewId, async (req, res) => {
  try {
    const candidateId = req.query?.candidateId || null;
    const interview = await requireInternalServiceSession(req, req.params.interviewId, candidateId, { allowPreflight: true });

    // Validate readiness window
    const now = Date.now();
    const scheduledTime = new Date(interview.scheduledAt).getTime();
    // Allow bot to join up to 15 minutes before scheduled start through end of slot
    const earlyWindowMs = 15 * 60 * 1000;
    const durationMs = (interview.durationMinutes || 30) * 60 * 1000;
    const isDue = now >= (scheduledTime - earlyWindowMs) && now <= (scheduledTime + durationMs);

    let readinessStatus = "READY_TO_JOIN";
    if (["IN_PROGRESS"].includes(interview.status)) {
      readinessStatus = "IN_PROGRESS";
    } else if (now < (scheduledTime - earlyWindowMs)) {
      readinessStatus = "NOT_DUE";
    }

    const currentQ = interview.questions?.[interview.currentQuestionIndex] || interview.questions?.[0] || null;
    return res.json({
      success: true,
      interviewId: String(interview._id),
      candidateId: String(interview.candidateId),
      status: interview.status,
      phase: interview.phase,
      readinessStatus,
      isDue,
      scheduledAt: interview.scheduledAt,
      meetLink: interview.meetLink || null,
      currentQuestionIndex: interview.currentQuestionIndex,
      totalQuestions: interview.questions.length,
      currentQuestion: currentQ?.question || null,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/internal/:interviewId/candidate-joined", validInterviewId, async (req, res) => {
  try {
    const candidateId = req.body?.candidateId || null;
    // Authenticate internal bot service request
    const interview = await requireInternalServiceSession(req, req.params.interviewId, candidateId, { allowPreflight: true });

    logger.info("[INTERVIEW] Bot signaled candidate joined in Google Meet", { interviewId: String(interview._id) });
    // Advance lifecycle to IN_PROGRESS and bootstrap first question if needed
    const result = await recordCandidatePresence(interview._id, interview.candidateId);
    const updated = result.interview || interview;
    const firstQ = updated.questions?.[updated.currentQuestionIndex] || updated.questions?.[0] || null;

    return res.json({
      success: true,
      interviewId: String(updated._id),
      status: updated.status,
      phase: updated.phase,
      currentQuestionIndex: updated.currentQuestionIndex,
      firstQuestion: firstQ?.question || null,
      started: Boolean(result.started),
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/internal/:interviewId/complete", validInterviewId, async (req, res) => {
  try {
    const candidateId = req.body?.candidateId || null;
    const interview = await requireInternalServiceSession(req, req.params.interviewId, candidateId);

    logger.info("[INTERVIEW] Bot signaled interview complete", { interviewId: String(interview._id) });
    const waitForAnalysis = Boolean(req.body?.waitForAnalysis);
    const updated = await answerService.endInterview(interview._id, null, { waitForAnalysis });

    return res.json({
      success: true,
      interviewId: String(updated._id),
      status: updated.status,
      endedAt: updated.endedAt,
      analysis: updated.analysis || null,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/internal/:interviewId/recording", validInterviewId, async (req, res) => {
  try {
    const candidateId = req.body?.candidateId || null;
    const interview = await requireInternalServiceSession(req, req.params.interviewId, candidateId);
    const { filePath, duration, action } = req.body || {};

    const { uploadInterviewRecording, startRecordingSession } = await import("./interviewRecording.service.js");

    if (action === "START") {
      const doc = await startRecordingSession(interview._id);
      return res.json({ success: true, recordingStatus: doc.recordingStatus, startedAt: doc.recordingStartedAt });
    }

    if (!filePath) {
      return res.status(400).json({ success: false, message: "filePath is required for recording upload." });
    }

    const uploadResult = await uploadInterviewRecording(interview._id, filePath, { duration });
    return res.json({
      success: uploadResult.success,
      recordingUrl: uploadResult.recordingUrl || null,
      recordingPublicId: uploadResult.recordingPublicId || null,
      error: uploadResult.error || null,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;


