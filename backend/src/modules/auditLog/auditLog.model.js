import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
    {
        actor: {
            type: mongoose.Schema.Types.Mixed,
            ref: "Admin",
            required: true
        },

        action: {
            type: String,
            required: true,
            index: true
        },

        targetId: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },

        details: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },

        beforeState: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },

        afterState: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },

        ipAddress: {
            type: String,
            default: null
        },

        timestamp: {
            type: Date,
            default: Date.now,
            index: true
        }
    },
    {
        timestamps: true
    }
);

auditLogSchema.index({ action: 1, timestamp: -1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;