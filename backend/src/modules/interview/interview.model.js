const mongoose = require("mongoose");

const interviewSchema = new mongoose.Schema(
    {
        candidateId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Candidate",
            required: true
        },

        slotId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Slot",
            required: true
        },

        meetLink: {
            type: String
        },

        recordingUrl: {
            type: String
        },

        transcriptUrl: {
            type: String
        },

        status: {
            type: String,
            enum: [
                "scheduled",
                "completed",
                "no_show",
                "failed"
            ],
            default: "scheduled"
        },

        integrityFlags: {
            identityMismatch: {
                type: Boolean,
                default: false
            },

            faceMatchScore: {
                type: Number,
                default: 0
            },

            multiFaceDetected: {
                type: Boolean,
                default: false
            },

            tabSwitchCount: {
                type: Number,
                default: 0
            }
        },

        language: {
            type: String
        }
    },
    {
        timestamps: true
    }
);

const Interview = mongoose.model(
    "Interview",
    interviewSchema
);

module.exports = Interview;