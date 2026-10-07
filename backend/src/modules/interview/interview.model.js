import mongoose from "mongoose";
import { INTERVIEW_CATEGORIES, INTERVIEW_STATUSES } from "./interview.prompt.js";

const questionSchema = new mongoose.Schema({
  questionId: { type: String, required: true }, category: { type: String, enum: INTERVIEW_CATEGORIES, required: true },
  question: { type: String, required: true, trim: true }, difficulty: { type: String, enum: ["EASY", "MEDIUM", "HARD"], default: "MEDIUM" },
  reason: { type: String, trim: true, default: "" }, source: { type: String, enum: ["ai", "fallback"], default: "ai" },
  followUpExpected: { type: Boolean, default: false }, askedAt: { type: Date, default: Date.now },
}, { _id: false });
const transcriptSchema = new mongoose.Schema({
  sequence: { type: Number, min: 0, default: 0 }, speaker: { type: String, enum: ["AI", "CANDIDATE", "SYSTEM"], required: true }, text: { type: String, required: true, trim: true, maxlength: 8000 },
  timestamp: { type: Date, default: Date.now }, questionId: { type: String, default: null }, requestId: { type: String, trim: true, default: null },
  answerProcessed: { type: Boolean, default: false }, answerQuality: { type: String, enum: ["WEAK", "INCOMPLETE", "POTENTIALLY_DETAILED"], default: null }, category: { type: String, enum: INTERVIEW_CATEGORIES, default: null },
  section: { type: String, enum: ["QUESTIONING", "PROJECT_WALKTHROUGH", "CLOSING", "SYSTEM"], default: "QUESTIONING" },
}, { _id: false });
const scoreBlock = new mongoose.Schema({ score: { type: Number, min: 0, max: 100, required: true }, summary: { type: String, trim: true, default: "" } }, { _id: false });
const analysisSchema = new mongoose.Schema({
  technicalKnowledge: { type: scoreBlock, required: true }, projectUnderstanding: { type: scoreBlock, required: true }, problemSolving: { type: scoreBlock, required: true },
  communication: { type: scoreBlock, required: true }, projectWalkthrough: { type: scoreBlock, required: true }, strengths: { type: [String], default: [] },
  areasForImprovement: { type: [String], default: [] }, evidence: { type: [String], default: [] }, overallScore: { type: Number, min: 0, max: 100, required: true },
  recommendation: { type: String, enum: ["STRONG", "ADMIN_REVIEW", "WEAK"], required: true }, summary: { type: String, trim: true, default: "" }, analyzedAt: { type: Date, default: Date.now }, source: { type: String, enum: ["ai", "fallback"], default: "ai" },
}, { _id: false });

const aiInterviewSchema = new mongoose.Schema({
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true, index: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "InterviewBooking", required: true, unique: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
  scheduledAt: { type: Date, required: true }, meetLink: { type: String, trim: true, default: null }, calendarEventId: { type: String, trim: true, default: null }, calendarAdminId: { type: String, trim: true, default: null }, conferenceId: { type: String, trim: true, default: null },
  status: { type: String, enum: INTERVIEW_STATUSES, default: "SCHEDULED", index: true },
  aiSessionId: { type: String, trim: true, default: null },
  candidateJoinedAt: { type: Date, default: null },
  durationMinutes: { type: Number, default: 30 },
  noShowAt: { type: Date, default: null },
  noShowReason: { type: String, trim: true, default: null },
  analysisError: { type: String, trim: true, default: null },
  analysisAttempts: { type: Number, min: 0, default: 0 },
  analysisUpdatedAt: { type: Date, default: null },
  phase: { type: String, enum: ["QUESTIONING", "PROJECT_WALKTHROUGH", "CLOSING"], default: "QUESTIONING" },
  currentQuestionIndex: { type: Number, default: 0, min: 0 }, questions: { type: [questionSchema], default: [] }, transcript: { type: [transcriptSchema], default: [] },
  startedAt: { type: Date, default: null }, endedAt: { type: Date, default: null }, analysis: { type: analysisSchema, default: null },
  adminDecision: { status: { type: String, enum: ["pending", "selected", "rejected", "another_interview"], default: "pending" }, notes: { type: String, trim: true, default: "" }, decidedBy: { type: String, trim: true, default: null }, decidedAt: { type: Date, default: null } },
}, { timestamps: true });
aiInterviewSchema.index({ "transcript.requestId": 1 }, { sparse: true });
aiInterviewSchema.index({ candidateId: 1, status: 1 });
aiInterviewSchema.index({ status: 1, scheduledAt: 1 });
const AiInterviewSession = mongoose.models.AiInterviewSession || mongoose.model("AiInterviewSession", aiInterviewSchema);
export default AiInterviewSession;
