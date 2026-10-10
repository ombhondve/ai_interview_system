import mongoose from "mongoose";

const botAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },
    performedBy: {
      type: String,
      required: true,
      index: true,
    },
    targetWorkerId: {
      type: String,
      default: null,
      index: true,
    },
    targetJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BotJob",
      default: null,
      index: true,
    },
    targetInterviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AiInterviewSession",
      default: null,
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

botAuditLogSchema.index({ action: 1, timestamp: -1 });

const BotAuditLog = mongoose.models.BotAuditLog || mongoose.model("BotAuditLog", botAuditLogSchema);

export default BotAuditLog;
