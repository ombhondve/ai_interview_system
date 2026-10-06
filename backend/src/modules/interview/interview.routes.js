import express from "express";
import { requireVerifiedSession } from "../../middleware/requireVerifiedSession.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import * as sessionService from "./interview.session.service.js";
import * as answerService from "./interview.session.answers.service.js";
import AiInterview from "./interview.model.js";
import { isValidObjectId, validateAnswerInput, validateDecisionInput } from "./interview.validation.js";
import { buildInterviewContext, publicSessionContext } from "./interview.context.service.js";
import logger from "../../utils/logger.js";
import { isProjectVerified } from "../projects/deadline.service.js";

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

router.get("/admin/reports", requireAuth, requireRole("superadmin", "recruiter", "admin"), async (_req, res) => {
  try {
    const interviews = await AiInterview.find({ status: { $in: ["COMPLETED", "ANALYSIS_PENDING", "ANALYZED"] } }).sort({ scheduledAt: -1 }).limit(200).populate("candidateId", "name email role").populate("projectId", "title");
    return res.json({ success: true, interviews });
  } catch (error) { return handleError(res, error); }
});

router.get("/mine", requireVerifiedSession, async (req, res) => {
  try {
    const doc = await AiInterview.findOne({ candidateId: req.candidate._id, status: { $nin: ["CANCELLED", "FAILED"] } }).sort({ scheduledAt: -1 });
    if (!doc) return res.json({ success: true, interview: null });
    if (!isProjectVerified(req.candidate)) return res.status(403).json({ success: false, message: "The assigned project must be verified before interview access." });
    const context = await buildInterviewContext({ candidateId: doc.candidateId, projectId: doc.projectId, bookingId: doc.bookingId });
    return res.json({ success: true, interview: doc, context: publicSessionContext(context) });
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
export default router;
