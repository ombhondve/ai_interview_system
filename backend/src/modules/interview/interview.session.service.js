/** Server-owned interview lifecycle and start/question bootstrap. */
import AiInterview from "./interview.model.js";
import InterviewBooking from "../scheduling/interviewBooking.model.js";
import { loadInterviewContext } from "./interview.context.service.js";
import { generateNextQuestion } from "./interview.question.service.js";
import { isProjectVerified } from "../projects/deadline.service.js";
import Candidate from "../candidate/candidate.model.js";
import logger from "../../utils/logger.js";

export const SESSION_TRANSITIONS = {
  SCHEDULED: ["READY", "WAITING_FOR_CANDIDATE", "CANCELLED"],
  READY: ["WAITING_FOR_CANDIDATE", "IN_PROGRESS", "CANCELLED"],
  WAITING_FOR_CANDIDATE: ["IN_PROGRESS", "CANDIDATE_NO_SHOW", "CANCELLED", "FAILED"],
  IN_PROGRESS: ["COMPLETING", "CANCELLED", "FAILED"],
  COMPLETING: ["ANALYSIS_PENDING", "FAILED"],
  COMPLETED: ["ANALYSIS_PENDING"],
  CANDIDATE_NO_SHOW: [],
  ANALYSIS_PENDING: ["ANALYZED", "FAILED"],
  ANALYZED: [],
  CANCELLED: [],
  FAILED: ["ANALYSIS_PENDING"],
};
export const canTransition = (from, to) => (SESSION_TRANSITIONS[from] || []).includes(to);

export async function ensureSessionForBooking({ candidateId, projectId, bookingId, scheduledAt, meetLink, calendarEventId } = {}) {
  if (!candidateId || !bookingId || !scheduledAt) { const e = new Error("A valid candidate, booking, and scheduled time are required."); e.status = 400; throw e; }
  const existing = await AiInterview.findOne({ bookingId }); if (existing) return existing;
  const booking = await InterviewBooking.findById(bookingId);
  if (!booking || String(booking.candidateId) !== String(candidateId)) { const e = new Error("Scheduled booking not found."); e.status = 404; throw e; }
  try {
    const doc = await AiInterview.create({
      candidateId,
      projectId: projectId || booking.projectId || null,
      bookingId,
      scheduledAt,
      durationMinutes: booking.durationMinutes || 30,
      meetLink: meetLink || booking.meetLink || null,
      calendarEventId: calendarEventId || booking.calendarEventId || null,
      status: "SCHEDULED",
      questions: [],
      transcript: [],
    });
    logger.info(`Interview created ${doc._id}`); return doc;
  } catch (error) { if (error.code === 11000) return AiInterview.findOne({ bookingId }); throw error; }
}

export async function startInterview(interviewId, candidateId) {
  const doc = await AiInterview.findById(interviewId);
  if (!doc) { const e = new Error("Interview not found"); e.status = 404; throw e; }
  if (String(doc.candidateId) !== String(candidateId)) { const e = new Error("Forbidden"); e.status = 403; throw e; }
  if (doc.status === "IN_PROGRESS") return doc;
  if (!["READY", "SCHEDULED", "WAITING_FOR_CANDIDATE"].includes(doc.status)) { const e = new Error("Interview cannot be started"); e.status = 400; throw e; }
  const candidate = await Candidate.findById(candidateId);
  if (!isProjectVerified(candidate)) { const e = new Error("The assigned project must be verified before starting the interview."); e.status = 403; throw e; }
  const booking = await InterviewBooking.findById(doc.bookingId);
  if (!booking || booking.status !== "scheduled") { const e = new Error("Interview booking is no longer active."); e.status = 409; throw e; }
  const now = Date.now(), start = new Date(booking.startAt).getTime(), end = new Date(booking.endAt).getTime();
  if (now < start - 15 * 60_000 || now > end) { const e = new Error("Interview is outside its allowed start window."); e.status = 403; throw e; }
  const ctx = await loadInterviewContext(doc.candidateId, doc.projectId, doc.bookingId);
  if (doc.questions.length === 0) {
    const question = {
      category: "INTRODUCTION",
      question: "Hello, welcome to your interview. Can you hear me clearly?",
      difficulty: "EASY",
      reason: "Initial greeting and audio check.",
      source: "fallback",
      followUpExpected: true,
    };
    doc.phase = "OPENING";
    doc.questions.push({ ...question, questionId: "0", askedAt: new Date() });
    doc.transcript.push({ speaker: "AI", text: question.question, timestamp: new Date(), questionId: "0", category: question.category, section: "OPENING" });
  }
  if (doc.status !== "IN_PROGRESS") {
    doc.status = "IN_PROGRESS";
    doc.startedAt = doc.startedAt || new Date();
    doc.candidateJoinedAt = doc.candidateJoinedAt || new Date();
  }
  doc.transcript.forEach((entry, index) => { if (entry.sequence == null) entry.sequence = index; });
  await doc.save();
  logger.info(`Interview started ${doc._id}`); logger.info(`Question generated ${doc._id}`); return doc;
}
export default { ensureSessionForBooking, startInterview, canTransition };
