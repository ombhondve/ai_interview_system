import mongoose from "mongoose";

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
            type: String,
            trim: true
        },

        recordingUrl: {
            type: String,
            trim: true
        },

        transcriptUrl: {
            type: String,
            trim: true
        },

        status: {
            type: String,
            enum: [
                "scheduled",
                "confirmed",
                "in_progress",
                "completed",
                "cancelled",
                "rescheduled",
                "no_show",
                "failed",
                "pending_preparation",
                "ready"
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
                default: 0,
                min: 0,
                max: 1
            },

            multiFaceDetected: {
                type: Boolean,
                default: false
            },

            tabSwitchCount: {
                type: Number,
                default: 0,
                min: 0
            },

            audioAnomalies: {
                type: Number,
                default: 0,
                min: 0
            },

            environmentCheck: {
                type: String,
                enum: ["passed", "failed", "pending"],
                default: "pending"
            }
        },

        language: {
            type: String,
            default: "en"
        },

        // ---------------------------------------------------
        // ENHANCED BOOKING WORKFLOW FIELDS
        // ---------------------------------------------------

        bookingMetadata: {
            bookedAt: {
                type: Date,
                default: Date.now
            },
            bookingSource: {
                type: String,
                enum: ["portal", "admin", "api", "import"],
                default: "portal"
            },
            ipAddress: {
                type: String,
                trim: true
            },
            userAgent: {
                type: String,
                trim: true
            },
            bookingSessionId: {
                type: String,
                trim: true
            }
        },

        preparationStatus: {
            documentsSubmitted: {
                type: [String],
                default: []
            },
            profileComplete: {
                type: Boolean,
                default: false
            },
            testCompleted: {
                type: Boolean,
                default: false
            },
            readinessScore: {
                type: Number,
                default: 0,
                min: 0,
                max: 100
            },
            lastPreparationCheck: {
                type: Date
            },
            preparationNotes: {
                type: String,
                trim: true
            }
        },

        executionData: {
            joinTime: {
                type: Date
            },
            leaveTime: {
                type: Date
            },
            duration: {
                type: Number,
                default: 0,
                min: 0,
                comment: "Duration in minutes"
            },
            connectionQuality: {
                type: String,
                enum: ["excellent", "good", "fair", "poor", "disconnected"],
                default: "good"
            },
            deviceInfo: {
                browser: String,
                os: String,
                device: String,
                screenResolution: String
            },
            networkType: {
                type: String,
                enum: ["wifi", "cellular", "ethernet", "unknown"],
                default: "unknown"
            }
        },

        rescheduleHistory: [{
            fromSlot: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Slot"
            },
            toSlot: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Slot"
            },
            reason: {
                type: String,
                trim: true
            },
            requestedBy: {
                type: String,
                enum: ["candidate", "admin", "system", "interviewer"]
            },
            timestamp: {
                type: Date,
                default: Date.now
            },
            notes: {
                type: String,
                trim: true
            }
        }],

        cancellationData: {
            cancelledAt: {
                type: Date
            },
            cancelledBy: {
                type: String,
                enum: ["candidate", "admin", "system", "interviewer"]
            },
            reason: {
                type: String,
                trim: true
            },
            refundStatus: {
                type: String,
                enum: ["not_applicable", "pending", "processed", "denied"],
                default: "not_applicable"
            },
            notes: {
                type: String,
                trim: true
            }
        },

        feedback: {
            candidateRating: {
                type: Number,
                min: 1,
                max: 5
            },
            candidateComments: {
                type: String,
                trim: true
            },
            interviewerRating: {
                type: Number,
                min: 1,
                max: 5
            },
            interviewerComments: {
                type: String,
                trim: true
            },
            technicalScore: {
                type: Number,
                min: 0,
                max: 100
            },
            communicationScore: {
                type: Number,
                min: 0,
                max: 100
            },
            problemSolvingScore: {
                type: Number,
                min: 0,
                max: 100
            },
            overallScore: {
                type: Number,
                min: 0,
                max: 100
            },
            strengths: {
                type: [String],
                default: []
            },
            areasForImprovement: {
                type: [String],
                default: []
            },
            recommendation: {
                type: String,
                enum: ["strong_hire", "hire", "hold", "no_hire", "strong_no_hire"],
                default: "hold"
            },
            submittedAt: {
                type: Date
            },
            submittedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Admin"
            }
        },

        // Interview configuration
        interviewType: {
            type: String,
            enum: ["ai", "human", "hybrid", "technical", "hr", "cultural"],
            default: "ai"
        },

        interviewerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin"
        },

        aiConfig: {
            model: {
                type: String,
                default: "default"
            },
            difficulty: {
                type: String,
                enum: ["beginner", "intermediate", "advanced", "expert"],
                default: "intermediate"
            },
            topics: {
                type: [String],
                default: []
            },
            duration: {
                type: Number,
                default: 30,
                min: 15,
                max: 120
            }
        },

        // Metadata
        metadata: {
            externalId: {
                type: String,
                trim: true
            },
            calendarEventId: {
                type: String,
                trim: true
            },
            source: {
                type: String,
                enum: ["portal", "api", "import", "migration"],
                default: "portal"
            },
            tags: {
                type: [String],
                default: []
            },
            notes: {
                type: String,
                trim: true
            }
        },

        // Timeline tracking
        timeline: [{
            event: {
                type: String,
                required: true
            },
            timestamp: {
                type: Date,
                default: Date.now
            },
            data: {
                type: mongoose.Schema.Types.Mixed
            },
            initiatedBy: {
                type: String,
                enum: ["system", "candidate", "admin", "interviewer"]
            }
        }],

        // Notifications sent
        notifications: [{
            type: {
                type: String,
                required: true
            },
            channel: {
                type: String,
                enum: ["email", "whatsapp", "sms", "push", "in_app"]
            },
            sentAt: {
                type: Date,
                default: Date.now
            },
            status: {
                type: String,
                enum: ["sent", "delivered", "failed", "opened"]
            },
            messageId: {
                type: String
            }
        }]
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Virtual field for interview duration
interviewSchema.virtual("calculatedDuration").get(function() {
    if (this.executionData.joinTime && this.executionData.leaveTime) {
        return (this.executionData.leaveTime - this.executionData.joinTime) / (1000 * 60); // minutes
    }
    return 0;
});

// Virtual field for preparation status
interviewSchema.virtual("preparationComplete").get(function() {
    const slot = this.populated('slotId') || this.slotId;
    if (!slot || !slot.requirements) return false;
    
    const { requiredDocuments, completedProfile } = slot.requirements;
    const docsSubmitted = this.preparationStatus.documentsSubmitted || [];
    
    let docsComplete = true;
    if (requiredDocuments && requiredDocuments.length > 0) {
        docsComplete = requiredDocuments.every(doc => docsSubmitted.includes(doc));
    }
    
    const profileComplete = !completedProfile || this.preparationStatus.profileComplete;
    
    return docsComplete && profileComplete && this.preparationStatus.testCompleted;
});

// Virtual field for next action
interviewSchema.virtual("nextAction").get(function() {
    switch (this.status) {
        case "scheduled":
            return this.preparationComplete ? "confirm_readiness" : "complete_preparation";
        case "confirmed":
            return "join_interview";
        case "in_progress":
            return "complete_interview";
        case "completed":
            return "submit_feedback";
        case "cancelled":
            return "book_new_slot";
        case "rescheduled":
            return "prepare_for_new_slot";
        default:
            return "wait";
    }
});

// Indexes for performance
interviewSchema.index({ candidateId: 1, status: 1 });
interviewSchema.index({ slotId: 1 });
interviewSchema.index({ status: 1, "executionData.joinTime": 1 });
interviewSchema.index({ "bookingMetadata.bookedAt": 1 });
interviewSchema.index({ "timeline.timestamp": 1 });
interviewSchema.index({ "metadata.tags": 1 });

// Pre-save middleware to update timeline
interviewSchema.pre("save", function(next) {
    if (this.isModified('status')) {
        if (!this.timeline) {
            this.timeline = [];
        }
        this.timeline.push({
            event: `status_changed_to_${this.status}`,
            initiatedBy: "system",
            data: { previousStatus: this._original?.status || "new" }
        });
    }
    
    // Update execution duration if join/leave times changed
    if (this.isModified('executionData.joinTime') || this.isModified('executionData.leaveTime')) {
        if (this.executionData.joinTime && this.executionData.leaveTime) {
            this.executionData.duration = this.calculatedDuration;
        }
    }
    
    next();
});

// Method to add timeline event
interviewSchema.methods.addTimelineEvent = function(event, initiatedBy = "system", data = {}) {
    if (!this.timeline) {
        this.timeline = [];
    }
    
    this.timeline.push({
        event,
        initiatedBy,
        data,
        timestamp: new Date()
    });
    
    return this;
};

// Method to check if interview can be rescheduled
interviewSchema.methods.canReschedule = function() {
    if (this.status === "cancelled") return false;
    
    const slot = this.populated('slotId') || this.slotId;
    if (!slot || !slot.constraints) return true;
    
    const now = new Date();
    const hoursUntilStart = (slot.startTime - now) / (1000 * 60 * 60);
    
    return hoursUntilStart > slot.constraints.cancellationDeadlineHours;
};

// Method to check if interview can be cancelled
interviewSchema.methods.canCancel = function() {
    if (this.status === "cancelled") return false;
    
    const slot = this.populated('slotId') || this.slotId;
    if (!slot || !slot.constraints) return true;
    
    const now = new Date();
    const hoursUntilStart = (slot.startTime - now) / (1000 * 60 * 60);
    
    return slot.constraints.allowCancellation && 
           hoursUntilStart > slot.constraints.cancellationDeadlineHours;
};

const Interview = mongoose.model(
    "Interview",
    interviewSchema
);

export default Interview;