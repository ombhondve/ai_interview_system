import mongoose from "mongoose";

const slotSchema = new mongoose.Schema(
    {
        startTime: {
            type: Date,
            required: true
        },

        endTime: {
            type: Date,
            required: true
        },

        status: {
            type: String,
            enum: ["open", "booked", "cancelled", "completed", "hidden"],
            default: "open"
        },

        bookedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Candidate"
        },

        timezone: {
            type: String,
            required: true,
            default: "Asia/Kolkata"
        },

        // ---------------------------------------------------
        // SLOT MANAGEMENT (EXISTING FIELDS)
        // ---------------------------------------------------

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            comment: "Admin who created the slot"
        },

        capacity: {
            type: Number,
            default: 1,
            comment: "Maximum number of candidates per slot",
            min: 1,
            max: 100
        },

        bookedCount: {
            type: Number,
            default: 0,
            comment: "Number of candidates who booked this slot",
            min: 0
        },

        applicableRoles: {
            type: [String],
            default: [],
            comment: "Empty array = all roles can book"
        },

        notes: {
            type: String,
            trim: true
        },

        location: {
            type: String,
            default: "Online",
            trim: true
        },

        meetLink: {
            type: String,
            trim: true,
            comment: "Google Meet link (if pre-generated)"
        },

        // ---------------------------------------------------
        // ENHANCED SLOT MANAGEMENT (NEW FIELDS)
        // ---------------------------------------------------

        slotType: {
            type: String,
            enum: ["single", "recurring", "batch"],
            default: "single",
            comment: "Type of slot: single occurrence, recurring series, or batch interview"
        },

        recurrencePattern: {
            frequency: {
                type: String,
                enum: ["daily", "weekly", "monthly"],
                default: "weekly"
            },
            interval: {
                type: Number,
                default: 1,
                min: 1,
                max: 52,
                comment: "Repeat every X days/weeks/months"
            },
            daysOfWeek: {
                type: [Number],
                default: [],
                validate: {
                    validator: function(days) {
                        return days.every(day => day >= 0 && day <= 6);
                    },
                    message: "Days must be 0-6 (Sunday-Saturday)"
                }
            },
            endDate: {
                type: Date,
                comment: "Recurrence end date"
            },
            occurrences: {
                type: Number,
                min: 1,
                max: 365,
                comment: "Maximum number of occurrences"
            },
            parentSlotId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Slot",
                comment: "Parent slot for recurring series"
            },
            isRecurringInstance: {
                type: Boolean,
                default: false,
                comment: "True if this slot is part of a recurring series"
            }
        },

        bufferTime: {
            before: {
                type: Number,
                default: 5,
                min: 0,
                max: 120,
                comment: "Buffer time in minutes before slot starts"
            },
            after: {
                type: Number,
                default: 5,
                min: 0,
                max: 120,
                comment: "Buffer time in minutes after slot ends"
            }
        },

        preparationTime: {
            type: Number,
            default: 0,
            min: 0,
            max: 120,
            comment: "Minutes allocated for candidate preparation before interview"
        },

        bookingWindow: {
            maxHoursBefore: {
                type: Number,
                default: 336, // 2 weeks
                min: 1,
                max: 744, // 31 days
                comment: "Maximum hours before slot that booking is allowed"
            },
            minHoursBefore: {
                type: Number,
                default: 1,
                min: 0,
                max: 168, // 1 week
                comment: "Minimum hours before slot that booking is allowed"
            }
        },

        autoCancellation: {
            enabled: {
                type: Boolean,
                default: false
            },
            minutesBefore: {
                type: Number,
                default: 60,
                min: 0,
                max: 1440 // 24 hours
            },
            reason: {
                type: String,
                default: "Auto-cancelled due to no-show preparation"
            }
        },

        tags: {
            type: [String],
            default: [],
            comment: "Tags for filtering and categorization (e.g., 'technical', 'hr', 'final-round')"
        },

        requirements: {
            verifiedProject: {
                type: Boolean,
                default: true,
                comment: "Requires verified project submission"
            },
            completedProfile: {
                type: Boolean,
                default: true,
                comment: "Requires complete candidate profile"
            },
            requiredDocuments: {
                type: [String],
                default: [],
                comment: "List of required document types (e.g., 'id_proof', 'resume', 'portfolio')"
            },
            minVerificationScore: {
                type: Number,
                default: 0.7,
                min: 0,
                max: 1,
                comment: "Minimum verification confidence score required"
            }
        },

        metadata: {
            source: {
                type: String,
                enum: ["manual", "import", "api", "template"],
                default: "manual"
            },
            templateId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "SlotTemplate"
            },
            externalId: {
                type: String,
                comment: "ID from external calendar system"
            },
            syncStatus: {
                type: String,
                enum: ["synced", "pending", "failed"],
                default: "pending"
            }
        },

        // For batch interviews
        batchInfo: {
            name: {
                type: String,
                trim: true
            },
            description: {
                type: String,
                trim: true
            },
            interviewerIds: {
                type: [mongoose.Schema.Types.ObjectId],
                ref: "Admin",
                default: []
            },
            groupSize: {
                type: Number,
                default: 1,
                min: 1,
                max: 50
            }
        },

        // Availability constraints
        constraints: {
            maxConcurrentBookings: {
                type: Number,
                default: 1,
                min: 1,
                max: 100
            },
            allowReschedule: {
                type: Boolean,
                default: true
            },
            allowCancellation: {
                type: Boolean,
                default: true
            },
            cancellationDeadlineHours: {
                type: Number,
                default: 24,
                min: 0,
                max: 168
            }
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Virtual field for available seats
slotSchema.virtual("availableSeats").get(function() {
    return Math.max(0, this.capacity - this.bookedCount);
});

// Virtual field for isAvailable
slotSchema.virtual("isAvailable").get(function() {
    const now = new Date();
    return (
        this.status === "open" &&
        this.bookedCount < this.capacity &&
        this.startTime > now
    );
});

// Virtual field for booking window status
slotSchema.virtual("bookingWindowStatus").get(function() {
    const now = new Date();
    const hoursUntilStart = (this.startTime - now) / (1000 * 60 * 60);
    
    if (hoursUntilStart > this.bookingWindow.maxHoursBefore) {
        return "too_early";
    } else if (hoursUntilStart < this.bookingWindow.minHoursBefore) {
        return "too_late";
    } else {
        return "within_window";
    }
});

// Indexes for performance
slotSchema.index({ startTime: 1, status: 1 });
slotSchema.index({ status: 1, bookedCount: 1 });
slotSchema.index({ "recurrencePattern.parentSlotId": 1 });
slotSchema.index({ tags: 1 });
slotSchema.index({ "metadata.externalId": 1 });
slotSchema.index({ startTime: 1, endTime: 1 });

// Pre-save middleware to validate slot times
slotSchema.pre("save", function(next) {
    // Ensure endTime is after startTime
    if (this.endTime <= this.startTime) {
        return next(new Error("endTime must be after startTime"));
    }
    
    // Validate buffer times don't overlap
    const slotDuration = (this.endTime - this.startTime) / (1000 * 60); // minutes
    if (this.bufferTime.before + this.bufferTime.after >= slotDuration) {
        return next(new Error("Buffer times cannot exceed slot duration"));
    }
    
    next();
});

const Slot = mongoose.model("Slot", slotSchema);

export default Slot;