import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    // Legacy actor field (can be admin ID or 'system')
    actor: {
      type: mongoose.Schema.Types.Mixed,
      ref: "Admin",
      required: true,
      default: "system",
    },

    actorId: {
      type: String,
      default: null,
      index: true,
    },

    actorName: {
      type: String,
      trim: true,
      default: "Administrator",
    },

    actorEmail: {
      type: String,
      trim: true,
      default: "",
    },

    actorRole: {
      type: String,
      trim: true,
      default: "admin",
    },

    action: {
      type: String,
      required: true,
      index: true,
    },

    targetType: {
      type: String,
      trim: true,
      default: "System",
      index: true,
    },

    targetId: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
      default: null,
      index: true,
    },

    targetName: {
      type: String,
      trim: true,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    outcome: {
      type: String,
      enum: ["SUCCESS", "FAILURE", "ATTEMPT"],
      default: "SUCCESS",
      index: true,
    },

    correlationId: {
      type: String,
      default: null,
    },

    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    beforeState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    afterState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    ipAddress: {
      type: String,
      default: null,
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Performance indexes for search, filtering, and audit inspection
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ targetType: 1, timestamp: -1 });
auditLogSchema.index({ outcome: 1, timestamp: -1 });
auditLogSchema.index({ actorId: 1, timestamp: -1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;