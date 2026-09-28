const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
    {
        interviewId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Interview",
            required: true
        },

        rubricScores: {
            communication: {
                type: Number,
                default: 0
            },

            technicalDepth: {
                type: Number,
                default: 0
            },

            projectOwnership: {
                type: Number,
                default: 0
            },

            problemSolving: {
                type: Number,
                default: 0
            }
        },

        aiSummary: {
            type: String
        },

        overallScore: {
            type: Number,
            default: 0
        },

        finalDecision: {
            type: String,
            enum: ["selected", "rejected", "pending"],
            default: "pending"
        },

        decidedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin"
        }
    },
    {
        timestamps: true
    }
);

const Report = mongoose.model("Report", reportSchema);

module.exports = Report;