/** Interview answer loop, append-only transcript, completion, and admin decision. */
import AiInterview from "./interview.model.js";
import { loadInterviewContext } from "./interview.context.service.js";
import { generateNextQuestion } from "./interview.question.service.js";
import { analyzeAndPersist } from "./interview.analysis.persistence.js";
import logger from "../../utils/logger.js";
import { isProjectVerified } from "../projects/deadline.service.js";
import Candidate from "../candidate/candidate.model.js";

function assessAnswer(text) {
  const answer = String(text || "").trim();
  const words = answer.split(/\s+/).filter(Boolean);
  const hasImplementationDetail = /\b(I (used|built|implemented|chose|designed|handled)|because|for example|specifically|the reason)\b/i.test(answer);
  if (words.length < 8) return { quality: "WEAK", reason: "The response is very brief; ask for a clearer explanation." };
  if (words.length < 24 || !hasImplementationDetail) return { quality: "INCOMPLETE", reason: "The response needs more implementation detail or rationale." };
  return { quality: "POTENTIALLY_DETAILED", reason: "Probe a concrete detail or continue to an uncovered topic." };
}

export async function submitAnswer(interviewId, candidateId, text, requestId = null) {
  const clean = String(text || "").trim().slice(0, 8000);
  if (!clean) { const e = new Error("Answer text required"); e.status = 400; throw e; }
  const doc = await AiInterview.findById(interviewId);
  if (!doc) { const e = new Error("Interview not found"); e.status = 404; throw e; }
  if (String(doc.candidateId) !== String(candidateId)) { const e = new Error("Forbidden"); e.status = 403; throw e; }
  if (doc.status !== "IN_PROGRESS") { const e = new Error("Interview is not in progress"); e.status = 400; throw e; }
  const candidate = await Candidate.findById(candidateId);
  if (!isProjectVerified(candidate)) { const e = new Error("The assigned project must remain verified to continue."); e.status = 403; throw e; }
  const questionId = String(doc.currentQuestionIndex ?? Math.max(0, doc.questions.length - 1));
  const duplicate = requestId && doc.transcript.find((entry) => entry.requestId === requestId);
  if (duplicate) return { interview: doc, duplicate: true, nextQuestion: doc.questions[doc.currentQuestionIndex] };
  const lastTurn = doc.transcript[doc.transcript.length - 1];
  let answer;
  if (lastTurn?.speaker === "CANDIDATE" && lastTurn.questionId === questionId) {
    if (lastTurn.answerProcessed) { const e = new Error("An answer for the current question has already been submitted."); e.status = 409; throw e; }
    answer = lastTurn;
    if (requestId && !answer.requestId) answer.requestId = requestId;
  } else {
    answer = { sequence: doc.transcript.length, speaker: "CANDIDATE", text: clean, timestamp: new Date(), questionId, requestId: requestId || null, section: doc.phase, answerProcessed: false };
    doc.transcript.push(answer);
    await doc.save();
    logger.info(`Answer received ${doc._id} q=${questionId}`);
  }
  try {
    const context = await loadInterviewContext(doc.candidateId, doc.projectId, doc.bookingId);
    let phase = doc.phase;
    if (phase === "QUESTIONING" && doc.questions.length >= 6) phase = "PROJECT_WALKTHROUGH";
    else if (phase === "PROJECT_WALKTHROUGH" && doc.questions.filter((q) => q.category === "PROJECT_WALKTHROUGH").length >= 2) phase = "CLOSING";
    const candidateAnswers = doc.transcript.filter((turn) => turn.speaker === "CANDIDATE");
    const answerAssessment = assessAnswer(answer.text);
    answer.answerQuality = answerAssessment.quality;
    answer.answerProcessed = true;
    await doc.save();
    const coveredTopics = [...new Set(doc.questions.map((q) => q.category))];
    const next = await generateNextQuestion({
      context,
      askedQuestions: doc.questions,
      transcript: doc.transcript.map(({ speaker, text: turnText }) => ({ speaker, text: turnText })),
      answersSoFar: candidateAnswers.map((turn) => turn.text),
      coveredTopics,
      answerAssessment,
      phase,
    });
    if (next.category === "CLOSING") phase = "CLOSING";
    doc.phase = phase;
    const nextQuestionId = String(doc.questions.length);
    doc.questions.push({ ...next, questionId: nextQuestionId, askedAt: new Date() });
    doc.currentQuestionIndex = doc.questions.length - 1;
    doc.transcript.push({ sequence: doc.transcript.length, speaker: "AI", text: next.question, timestamp: new Date(), questionId: nextQuestionId, category: next.category, section: phase });
    await doc.save();
    logger.info(`Question generated ${doc._id} category=${next.category}`);
    return { interview: doc, duplicate: false, nextQuestion: next, closing: next.category === "CLOSING" };
  } catch (error) {
    await doc.save();
    logger.warn(`Question generation failed after answer persistence ${doc._id}: ${error.message}`);
    error.answerPersisted = true;
    error.status = 503;
    throw error;
  }
}

export async function endInterview(interviewId, candidateId) {
  const doc = await AiInterview.findById(interviewId);
  if (!doc) { const e = new Error("Interview not found"); e.status = 404; throw e; }
  if (String(doc.candidateId) !== String(candidateId)) { const e = new Error("Forbidden"); e.status = 403; throw e; }
  if (["COMPLETING", "COMPLETED", "ANALYSIS_PENDING", "ANALYZED"].includes(doc.status)) return doc;
  if (doc.status !== "IN_PROGRESS") { const e = new Error("Interview is not in progress"); e.status = 400; throw e; }
  doc.status = "COMPLETING";
  doc.endedAt = new Date();
  doc.analysisError = null;
  doc.transcript.forEach((entry, index) => { if (entry.sequence == null) entry.sequence = index; });
  await doc.save();
  logger.info(`Interview completed ${doc._id}`);
  analyzeAndPersist(doc._id).catch((err) => logger.error(`AI analysis failed ${doc._id}:`, err.message));
  return doc;
}

export async function saveAdminDecision(interviewId, input) {
  const { status, notes, decidedBy } = input || {};
  const doc = await AiInterview.findById(interviewId);
  if (!doc) { const e = new Error("Interview not found"); e.status = 404; throw e; }
  if (!["selected", "rejected", "another_interview"].includes(status)) { const e = new Error("Invalid decision"); e.status = 400; throw e; }
  doc.adminDecision = { status, notes: String(notes || "").slice(0, 2000), decidedBy, decidedAt: new Date() };
  await doc.save();
  return doc;
}

export default { submitAnswer, endInterview, saveAdminDecision };
