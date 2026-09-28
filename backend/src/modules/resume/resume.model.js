const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema(
    {
        candidateId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Candidate",
            required: true
        },

        fileUrl: {
            type: String,
            required: true
        },

        extractionStatus: {
            type: String,
            enum: [
                "pending",
                "success",
                "low_confidence",
                "failed"
            ],
            default: "pending"
        },

        parsedData: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },

        ocrConfidence: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

const Resume = mongoose.model("Resume", resumeSchema);

module.exports = Resume;