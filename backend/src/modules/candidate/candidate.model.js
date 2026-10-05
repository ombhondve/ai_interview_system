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
                "Project Completed",
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
            ref: "Project"
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
        },


        // =====================================================
        // PROJECT DEADLINE & SUBMISSION (NEW FIELDS)
        // =====================================================

        // Project assignment timestamps
        projectAssignedAt: {
            type: Date
        },

        projectDownloadedAt: {
            type: Date
        },

        // Deadline management
        projectStartAt: {
            type: Date,
            comment: "First successful project download time"
        },

        submissionDeadline: {
            type: Date,
            comment: "Calculated from projectStartAt + project duration"
        },

        bufferDeadline: {
            type: Date,
            comment: "submissionDeadline + buffer period (default 1 day)"
        },

        // Submission tracking
        projectSubmissionStatus: {
            type: String,
            enum: [
                "not_started",
                "downloaded",
                "in_progress",
                "submitted",
                "url_validation",
                "ai_verification",
                "verified",
                "url_invalid",
                "ai_verification_failed",
                "needs_admin_review",
                "deadline_expired",
                "rejected",
                "verification_pending",
                "verification_processing",
                "verification_completed"
            ],
            default: "not_started"
        },

        // Enhanced submission tracking (embedded document)
        projectSubmission: {
            url: {
                type: String,
                trim: true
            },

            submittedAt: {
                type: Date
            },

            /**
             * Identifies THIS specific submission.
             *
             * Verification runs asynchronously in the background, so a
             * verification started for submission A can finish after the
             * student has already submitted repository B. Every verification
             * result carries the submissionId it was started for and is only
             * persisted while the candidate is still on that same submission.
             * This is what stops a stale result from overwriting a new one.
             */
            submissionId: {
                type: String,
                trim: true
            },

            validationStatus: {
                type: String,
                enum: ["pending", "valid", "invalid"],
                default: "pending"
            },

            validationError: {
                type: String,
                trim: true
            },

            validatedAt: {
                type: Date
            },

            // AI verification
            aiVerificationStatus: {
                type: String,
                enum: ["pending", "verified", "rejected", "needs_admin_review", "error", "processing"],
                default: "pending"
            },

            aiVerificationResult: {
                verificationStatus: {
                    type: String,
                    enum: ["VERIFIED", "NEEDS_ADMIN_REVIEW", "REJECTED", "ERROR", "PENDING"],
                    default: "PENDING"
                },
                confidence: {
                    type: Number,
                    min: 0,
                    max: 1,
                    default: 0
                },
                summary: {
                    type: String,
                    trim: true
                },
                detailedAnalysis: {
                    type: mongoose.Schema.Types.Mixed,
                    default: {}
                },
                recommendations: {
                    type: mongoose.Schema.Types.Mixed,
                    default: {}
                },
                verificationMetadata: {
                    type: mongoose.Schema.Types.Mixed,
                    default: {}
                },
                rawData: {
                    type: mongoose.Schema.Types.Mixed,
                    default: null
                },
                processedForStorage: {
                    type: mongoose.Schema.Types.Mixed,
                    default: {}
                }
            },

            verificationProgress: {
                stage: { type: String, trim: true },
                label: { type: String, trim: true },
                status: { type: String, enum: ["active", "completed", "failed"] },
                completed: { type: Boolean, default: false },
                failed: { type: Boolean, default: false },
                message: { type: String, trim: true },
                updatedAt: { type: Date }
            },

            aiVerificationStartedAt: {
                type: Date
            },

            aiVerificationCompletedAt: {
                type: Date
            },

            aiVerificationDurationMs: {
                type: Number,
                default: 0
            },

            verificationRetryCount: {
                type: Number,
                default: 0
            },

            /**
             * CURRENT verification stage pointer.
             *
             * The student UI used to infer progress by polling status, which
             * skipped stages because verification completes faster than the poll
             * interval. The real stage progression is persisted here (and in
             * verificationProgressHistory below) so the UI can replay what
             * actually happened instead of guessing.
             *
             * Always belongs to projectSubmission.submissionId.
             */
            verificationProgress: {
                stage: {
                    type: String,
                    trim: true
                },
                label: {
                    type: String,
                    trim: true
                },
                status: {
                    type: String,
                    enum: ["active", "completed", "failed"],
                    default: "active"
                },
                message: {
                    type: String,
                    trim: true
                },
                failed: {
                    type: Boolean,
                    default: false
                },
                startedAt: {
                    type: Date
                },
                completedAt: {
                    type: Date
                },
                updatedAt: {
                    type: Date
                }
            },

            /**
             * Append-only record of every stage that ACTUALLY occurred for the
             * current submission. A new submission resets this.
             */
            verificationProgressHistory: [
                {
                    stage: {
                        type: String,
                        trim: true
                    },
                    label: {
                        type: String,
                        trim: true
                    },
                    status: {
                        type: String,
                        enum: ["active", "completed", "failed"],
                        default: "completed"
                    },
                    message: {
                        type: String,
                        trim: true
                    },
                    failed: {
                        type: Boolean,
                        default: false
                    },
                    startedAt: {
                        type: Date
                    },
                    completedAt: {
                        type: Date
                    }
                }
            ],

            // Verification statistics for reporting
            verificationStats: {
                filesAnalyzed: {
                    type: Number,
                    default: 0
                },
                requirementsTotal: {
                    type: Number,
                    default: 0
                },
                requirementsMet: {
                    type: Number,
                    default: 0
                },
                requirementsPartial: {
                    type: Number,
                    default: 0
                },
                requirementsMissing: {
                    type: Number,
                    default: 0
                },
                requirementsCompletionRate: {
                    type: Number,
                    min: 0,
                    max: 1,
                    default: 0
                },
                codeQualityScore: {
                    type: Number,
                    min: 0,
                    max: 1,
                    default: 0
                },
                organizationScore: {
                    type: Number,
                    min: 0,
                    max: 1,
                    default: 0
                },
                documentationScore: {
                    type: Number,
                    min: 0,
                    max: 1,
                    default: 0
                }
            },

            // Resubmission history
            history: [
                {
                    url: {
                        type: String,
                        trim: true
                    },
                    submittedAt: {
                        type: Date
                    },
                    status: {
                        type: String
                    },
                    reason: {
                        type: String,
                        trim: true
                    }
                }
            ],

            // Admin review for NEEDS_ADMIN_REVIEW cases
            adminReview: {
                status: {
                    type: String,
                    enum: ["pending", "in_review", "approved", "rejected", "needs_more_info"],
                    default: "pending"
                },
                reviewedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Admin"
                },
                reviewedAt: {
                    type: Date
                },
                reviewerNotes: {
                    type: String,
                    trim: true
                },
                finalDecision: {
                    type: String,
                    enum: ["approved", "rejected", "needs_resubmission"]
                },
                decisionReason: {
                    type: String,
                    trim: true
                }
            }
        },

        // Interview slot booking
        bookedSlotId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Slot"
        },

        interviewBookedAt: {
            type: Date
        },

        interviewEmailSent: {
            type: Boolean,
            default: false
        },

        interviewEmailError: {
            type: String,
            trim: true
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