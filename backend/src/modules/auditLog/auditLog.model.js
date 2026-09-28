const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
    {
        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            required: true
        },

        action: {
            type: String,
            required: true
        },

        targetId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        beforeState: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },

        afterState: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },

        timestamp: {
            type: Date,
            default: Date.now
        }
    }
);

const AuditLog = mongoose.model(
    "AuditLog",
    auditLogSchema
);

module.exports = AuditLog;