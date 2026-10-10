import mongoose from "mongoose";

const executionHistorySchema = new mongoose.Schema(
  {
    workerId: { type: String, required: true },
    attempt: { type: Number, required: true },
    claimedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    status: { type: String, enum: ["CLAIMED", "RUNNING", "COMPLETED", "FAILED"], required: true },
    exitCode: { type: Number, default: null },
    error: { type: String, default: null },
  },
  { _id: false }
);

const botJobSchema = new mongoose.Schema(
  {
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AiInterviewSession",
      required: true,
      unique: true,
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InterviewBooking",
      required: true,
      index: true,
    },
    meetLink: {
      type: String,
      required: true,
      trim: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["QUEUED", "CLAIMED", "RUNNING", "COMPLETED", "FAILED"],
      default: "QUEUED",
      index: true,
    },
    assignedWorkerId: {
      type: String,
      default: null,
      index: true,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    leaseExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastHeartbeatAt: {
      type: Date,
      default: null,
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    retryAfter: {
      type: Date,
      default: null,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    needsAdminReview: {
      type: Boolean,
      default: false,
      index: true,
    },
    executionHistory: {
      type: [executionHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

botJobSchema.index({ status: 1, scheduledAt: 1 });
botJobSchema.index({ status: 1, retryAfter: 1, scheduledAt: 1 });
botJobSchema.index({ status: 1, leaseExpiresAt: 1 });
botJobSchema.index({ interviewId: 1, status: 1 });
botJobSchema.index({ assignedWorkerId: 1, status: 1 });

const BotJob = mongoose.models.BotJob || mongoose.model("BotJob", botJobSchema);

export default BotJob;
