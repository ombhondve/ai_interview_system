/**
 * AI Interview Session Service (InterviewEngine core loop part 1)
 * Server-side state machine + session bootstrap + start.
 */
import AiInterview from "./aiInterview.model.js";
import { loadInterviewContext } from "./interview.context.service.js";
import InterviewBooking from "../scheduling/interviewBooking.model.js";
import { generateNextQuestion } from "./interview.question.service.js";
import { analyzeAndPersist } from "./interview.analysis.persistence.js";
import logger from "../../utils/logger.js";

export const SESSION_TRANSITIONS = {
  SCHEDULED: ["READY", "CANCELLED"],
  READY: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED", "FAILED"],
  COMPLETED: ["ANALYSIS_PENDING"],
  ANALYSIS_PENDING: ["ANALYZED", "FAILED"],
  ANALYZED: [],
  CANCELLED: [],
  FAILED: [],
};

export function canTransition(from, to) {
  return (SESSION_TRANSITIONS[from] || []).includes(to);
}

export async function ensureSessionForBooking(args) {
  const { candidateId, projectId, bookingId, scheduledAt, meetLink } = args || {};
  if (!candidateId || !bookingId || !scheduledAt) {
    const error = new Error("A valid candidate, booking, and scheduled time are required."); error.status = 400; throw error;
  }
  let doc = null;
  if (bookingId) doc = await AiInterview.findOne({ bookingId });
  if (!doc) {
    doc = await AiInterview.findOne({
      candidateId,
      status: { $in: ["SCHEDULED", "READY", "IN_PROGRESS"] },
    });
  }
  if (doc) {
    if (meetLink && !doc.meetLink) { doc.meetLink = meetLink; await doc.save(); }
    if (doc.status === "SCHEDULED") { doc.status = "READY"; await doc.save(); }
    logger.info(`Interview session ensured ${doc._id}`);
    return doc;
  }
  const booking = await InterviewBooking.findById(bookingId);
  if (!booking || String(booking.candidateId) !== String(candidateId)) {
    const error = new Error("Scheduled booking not found."); error.status = 404; throw error;
  }
  doc = await AiInterview.create({
    candidateId, projectId: projectId || booking.projectId || null, bookingId, scheduledAt,
    meetLink: meetLink || booking.meetLink || null, status: "READY",
    questions: [], transcript: [],
  });
  logger.info(`Interview created ${doc._id}`);
  return doc;
}

export async function startInterview(interviewId, candidateId) {
  const doc = await AiInterview.findById(interviewId);
  if (!doc) { const e = new Error("Interview not found"); e.status = 404; throw e; }
  if (String(doc.candidateId) !== String(candidateId)) {
    const e = new Error("Forbidden"); e.status = 403; throw e;
  }
  if (doc.status === "IN_PROGRESS") return doc;
  if (!["READY", "SCHEDULED"].includes(doc.status)) {
    const e = new Error("Interview cannot be started"); e.status = 400; throw e;
  }
  const booking = await InterviewBooking.findById(doc.bookingId);
  if (!booking || booking.status !== "scheduled") { const e = new Error("Interview booking is no longer active."); e.status = 409; throw e; }
  const now = Date.now();
  const startMs = new Date(booking.startAt).getTime();
  const endMs = new Date(booking.endAt).getTime();
  const earlyWindowMs = 15 * 60 * 1000;
  if (now < startMs - earlyWindowMs || now > endMs) {
    const e = new Error("Interview is outside its allowed start window."); e.status = 403; throw e;
  }
  doc.status = "IN_PROGRESS";
  doc.startedAt = doc.startedAt || new Date();
  if (!doc.questions || doc.questions.length === 0) {
    const ctx = await loadInterviewContext(doc.candidateId, doc.projectId, doc.bookingId);
    const q = await generateNextQuestion({
      context: ctx, askedQuestions: [], transcript: [], answersSoFar: [],
    });
    doc.questions.push({ ...q, questionId: "0", askedAt: new Date() });
    doc.transcript.push({
      speaker: "AI", text: q.question, timestamp: new Date(),
      questionId: "0", category: q.category, section: doc.phase,
    });
    doc.currentQuestionIndex = 0;
  }
  await doc.save();
  logger.info(`Interview started ${doc._id}`);
  return doc;
}
