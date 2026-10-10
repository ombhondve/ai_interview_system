import mongoose from "mongoose";

const botWorkerSchema = new mongoose.Schema(
  {
    workerId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    tokenHash: {
      type: String,
      default: null,
    },
    hostname: {
      type: String,
      trim: true,
      default: "",
    },
    platform: {
      type: String,
      trim: true,
      default: "",
    },
    version: {
      type: String,
      trim: true,
      default: "1.0.0",
    },
    status: {
      type: String,
      enum: ["IDLE", "BUSY", "PAUSED", "OFFLINE"],
      default: "IDLE",
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastHeartbeatAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    currentJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BotJob",
      default: null,
    },
    currentInterviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AiInterviewSession",
      default: null,
    },
    lastError: {
      message: { type: String, default: null },
      code: { type: String, default: null },
      timestamp: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

botWorkerSchema.index({ enabled: 1, status: 1 });
botWorkerSchema.index({ lastHeartbeatAt: -1 });

const BotWorker = mongoose.models.BotWorker || mongoose.model("BotWorker", botWorkerSchema);

export default BotWorker;
