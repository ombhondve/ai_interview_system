import mongoose from "mongoose";
import { INTERVIEW_CATEGORIES, INTERVIEW_STATUSES } from "./interview.prompt.js";

/**
 * AiInterviewSession
 *
 * WHY A NEW MODEL (not reusing legacy `Interview`):
 * - legacy `Interview` REQUIRES `slotId` (old slot system) and uses
 *   lowercase statuses. The live system books via `InterviewBooking`
 *   (startAt/endAt, no slotId). Forcing AI sessions into the legacy
 *   shape would break validation for every real booking.
 * - This model LINKS to the live booking (`bookingId`) and reuses the
 *   existing Candidate / Project / Booking / verification data.
 */

const questionSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    category: { type: String, enum: INTERVIEW_CATEGORIES, required: true },
    question: { type: String, required: true, trim: true },
    difficulty: { type: String, enum: ["EASY", "MEDIUM", "HARD"], default: "MEDIUM" },
    reason: { type: String, trim: true, default: "" },
    source: { type: String, enum: ["ai", "fallback"], default: "ai" },
    followUpExpected: { type: Boolean, default: false },
    askedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const transcriptEntrySchema = new mongoose.Schema(
  {
    speaker: { type: String, enum: ["AI", "CANDIDATE", "SYSTEM"], required: true },
    text: { type: String, required: true, trim: true, maxlength: 8000 },
    timestamp: { type: Date, default: Date.now },
    questionId: { type: String, default: null },
    requestId: { type: String, trim: true, default: null },
    // Project-walkthrough turns are flagged so the report can score them.
    section: {
      type: String,
      enum: ["QUESTIONING", "PROJECT_WALKTHROUGH", "CLOSING", "SYSTEM"],
      default: "QUESTIONING",
    },
    category: { type: String, enum: INTERVIEW_CATEGORIES, default: null },
  },
  { _id: false }
);

const scoreBlockSchema = new mongoose.Schema(
  {
    score: { type: Number, min: 0, max: 100, required: true },
    summary: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const analysisSchema = new mongoose.Schema(
  {
    technicalKnowledge: { type: scoreBlockSchema, required: true },
    projectUnderstanding: { type: scoreBlockSchema, required: true },
    problemSolving: { type: scoreBlockSchema, required: true },
    communication: { type: scoreBlockSchema, required: true },
    projectWalkthrough: { type: scoreBlockSchema, required: true },
    strengths: { type: [String], default: [] },
    areasForImprovement: { type: [String], default: [] },
    overallScore: { type: Number, min: 0, max: 100, required: true },
    // AI NEVER outputs HIRE/REJECT. Only advisory recommendation.
    recommendation: { type: String, enum: ["STRONG", "ADMIN_REVIEW", "WEAK"], required: true },
    summary: { type: String, trim: true, default: "" },
    analyzedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const aiInterviewSchema = new mongoose.Schema(
  {
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true, index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "InterviewBooking", required: true, unique: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },

    scheduledAt: { type: Date, required: true },
    meetLink: { type: String, trim: true, default: null },
    calendarEventId: { type: String, trim: true, default: null },

    status: { type: String, enum: INTERVIEW_STATUSES, default: "SCHEDULED", index: true },
    // Finer-grained conversational phase; backend-owned, never from client.
    phase: {
      type: String,
      enum: ["QUESTIONING", "PROJECT_WALKTHROUGH", "CLOSING"],
      default: "QUESTIONING",
    },

    currentQuestionIndex: { type: Number, default: 0, min: 0 },
    questions: { type: [questionSchema], default: [] },
    // Append-only. Never overwritten, never reordered.
    transcript: { type: [transcriptEntrySchema], default: [] },

    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },

    analysis: { type: analysisSchema, default: null },

    adminDecision: {
      status: { type: String, enum: ["pending", "selected", "rejected", "another_interview", "needs_another_interview"], default: "pending" },
      notes: { type: String, trim: true, default: "" },
      decidedBy: { type: String, trim: true, default: null },
      decidedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);


aiInterviewSchema.index({ candidateId: 1, status: 1 });
aiInterviewSchema.index({ status: 1, scheduledAt: 1 });

aiInterviewSchema.index({ candidateId: 1, bookingId: 1 }, { unique: true });

const AiInterviewSession =
  mongoose.models.AiInterviewSession || mongoose.model("AiInterviewSession", aiInterviewSchema);

export default AiInterviewSession;
