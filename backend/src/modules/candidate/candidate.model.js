import mongoose from "mongoose";


const candidateSchema = new mongoose.Schema(
    {
        // =====================================================
        // BASIC CANDIDATE INFORMATION
        // =====================================================

        name: {
            type: String,
            required: true,
            trim: true
        },

        phone: {
            type: String,
            required: true,
            trim: true,
            unique: true,
            index: true
        },

        email: {
            type: String,
            lowercase: true,
            trim: true,
            index: true
        },

        location: {
            type: String,
            trim: true
        },

        role: {
            type: String,
            trim: true
        },


        // =====================================================
        // APPLICATION STATUS
        // =====================================================

        status: {
            type: String,
            enum: [
                "received",
                "under_review",
                "approved",
                "rejected",
                "Project Assigned",
                "Project Complited",
                "scheduled",
                "completed",
                "decided"
            ],
            default: "received"
        },

        jdMatchScore: {
            type: Number,
            default: 0
        },

        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin"
        },

        batchId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Batch"
        },


        // =====================================================
        // VERIFICATION
        // =====================================================

        verificationStatus: {
            type: String,
            enum: [
                "verified",
                "mismatch",
                "pending"
            ],
            default: "pending"
        },

        registrationPhotoUrl: {
            type: String,
            trim: true
        },


        // =====================================================
        // RESUME FILE
        // =====================================================

        resumeFileName: {
            type: String,
            trim: true
        },

        resumeUrl: {
            type: String,
            trim: true
        },


        // =====================================================
        // RESUME AI DATA
        // =====================================================
        //
        // AI resume structures can change.
        //
        // Mixed allows fields such as:
        //
        // education: "Diploma in Computer Technology"
        //
        // OR:
        //
        // education: [
        //     {
        //         degree: "...",
        //         institution: "..."
        //     }
        // ]
        //
        // OR other structured AI output.
        //
        // MongoDB therefore does not impose a fixed structure
        // on the AI-generated resume data.
        // =====================================================

        resumeData: {

            raw: {
                type: mongoose.Schema.Types.Mixed,
                default: {}
            },

            candidate: {
                type: mongoose.Schema.Types.Mixed,
                default: {}
            },

            analyzedAt: {
                type: Date,
                default: Date.now
            }
        },


        // =====================================================
        // REJECTION
        // =====================================================

        rejectionReason: {
            type: String,
            trim: true
        },


        // =====================================================
        // ACTIVITY / TIMELINE
        // =====================================================

        activity: [
            {
                id: {
                    type: String,
                    required: true
                },

                label: {
                    type: String,
                    required: true
                },

                description: {
                    type: String
                },

                timestamp: {
                    type: Date,
                    default: Date.now
                },

                state: {
                    type: String,
                    enum: [
                        "current",
                        "complete"
                    ],
                    default: "complete"
                }
            }
        ],


        // =====================================================
        // PROJECT / SUBMISSION
        // =====================================================

        assignedProjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DemoProject"
        },

        submissionUrl: {
            type: String,
            trim: true
        },

        interviewUrl: {
            type: String,
            trim: true
        },


        // =====================================================
        // INTERVIEW
        // =====================================================

        interviewStatus: {
            type: String,
            enum: [
                "pending",
                "scheduled",
                "completed"
            ],
            default: "pending"
        },

        interviewDate: {
            type: Date
        }
    },

    // =========================================================
    // AUTOMATIC DATES
    // =========================================================

    {
        timestamps: true
    }
);


// =============================================================
// CREATE MODEL
// =============================================================

const Candidate = mongoose.model(
    "Candidate",
    candidateSchema
);


export default Candidate;