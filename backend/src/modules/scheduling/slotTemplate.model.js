import mongoose from "mongoose";

const slotTemplateSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        description: {
            type: String,
            trim: true,
            maxlength: 500
        },

        // Time configuration
        duration: {
            type: Number,
            required: true,
            min: 15,
            max: 480, // 8 hours
            comment: "Slot duration in minutes"
        },

        bufferTime: {
            before: {
                type: Number,
                default: 5,
                min: 0,
                max: 120
            },
            after: {
                type: Number,
                default: 5,
                min: 0,
                max: 120
            }
        },

        preparationTime: {
            type: Number,
            default: 0,
            min: 0,
            max: 120
        },

        // Availability configuration
        applicableRoles: {
            type: [String],
            default: []
        },

        capacity: {
            type: Number,
            default: 1,
            min: 1,
            max: 100
        },

        location: {
            type: String,
            default: "Online",
            trim: true
        },

        // Recurrence configuration
        recurrence: {
            enabled: {
                type: Boolean,
                default: false
            },
            pattern: {
                type: String,
                enum: ["daily", "weekly", "monthly", "custom"],
                default: "weekly"
            },
            interval: {
                type: Number,
                default: 1,
                min: 1,
                max: 52
            },
            daysOfWeek: {
                type: [Number],
                default: []
            },
            endDate: {
                type: Date
            },
            occurrences: {
                type: Number,
                min: 1,
                max: 365
            }
        },

        // Time range for slot generation
        timeRange: {
            startHour: {
                type: Number,
                default: 9,
                min: 0,
                max: 23,
                comment: "Hour (0-23) when slots can start"
            },
            endHour: {
                type: Number,
                default: 18,
                min: 0,
                max: 23,
                comment: "Hour (0-23) when slots can end"
            },
            excludeHours: {
                type: [Number],
                default: []
            }
        },

        // Booking constraints
        bookingWindow: {
            maxDaysBefore: {
                type: Number,
                default: 14,
                min: 1,
                max: 365
            },
            minHoursBefore: {
                type: Number,
                default: 1,
                min: 0,
                max: 168
            }
        },

        // Requirements
        requirements: {
            verifiedProject: {
                type: Boolean,
                default: true
            },
            completedProfile: {
                type: Boolean,
                default: true
            },
            requiredDocuments: {
                type: [String],
                default: []
            }
        },

        // Metadata
        tags: {
            type: [String],
            default: []
        },

        meetLinkTemplate: {
            type: String,
            trim: true,
            comment: "Template for Google Meet links (e.g., 'https://meet.google.com/{id}')"
        },

        notesTemplate: {
            type: String,
            trim: true,
            maxlength: 1000
        },

        // Status and ownership
        status: {
            type: String,
            enum: ["active", "inactive", "archived"],
            default: "active"
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            required: true
        },

        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            comment: "For multi-tenant setups"
        },

        // Usage statistics
        usageStats: {
            timesUsed: {
                type: Number,
                default: 0
            },
            lastUsed: {
                type: Date
            },
            totalSlotsGenerated: {
                type: Number,
                default: 0
            }
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Indexes
slotTemplateSchema.index({ name: 1 });
slotTemplateSchema.index({ status: 1 });
slotTemplateSchema.index({ createdBy: 1 });
slotTemplateSchema.index({ tags: 1 });
slotTemplateSchema.index({ "recurrence.enabled": 1 });

// Virtual field for formatted time range
slotTemplateSchema.virtual("formattedTimeRange").get(function() {
    const formatHour = (hour) => {
        if (hour === 0) return "12 AM";
        if (hour === 12) return "12 PM";
        if (hour < 12) return `${hour} AM`;
        return `${hour - 12} PM`;
    };
    
    return `${formatHour(this.timeRange.startHour)} - ${formatHour(this.timeRange.endHour)}`;
});

// Virtual field for recurrence description
slotTemplateSchema.virtual("recurrenceDescription").get(function() {
    if (!this.recurrence.enabled) return "One-time";
    
    const { pattern, interval, daysOfWeek } = this.recurrence;
    
    switch (pattern) {
        case "daily":
            return interval === 1 ? "Daily" : `Every ${interval} days`;
        case "weekly":
            if (daysOfWeek.length === 0) {
                return interval === 1 ? "Weekly" : `Every ${interval} weeks`;
            }
            const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            const days = daysOfWeek.map(day => dayNames[day]).join(", ");
            return `Weekly on ${days}`;
        case "monthly":
            return interval === 1 ? "Monthly" : `Every ${interval} months`;
        default:
            return "Custom recurrence";
    }
});

// Pre-save validation
slotTemplateSchema.pre("save", function(next) {
    // Validate time range
    if (this.timeRange.startHour >= this.timeRange.endHour) {
        return next(new Error("startHour must be before endHour"));
    }
    
    // Validate duration
    const maxDuration = (this.timeRange.endHour - this.timeRange.startHour) * 60;
    if (this.duration > maxDuration) {
        return next(new Error(`Duration cannot exceed ${maxDuration} minutes for given time range`));
    }
    
    // Validate recurrence days
    if (this.recurrence.enabled && this.recurrence.pattern === "weekly") {
        const invalidDays = this.recurrence.daysOfWeek.filter(day => day < 0 || day > 6);
        if (invalidDays.length > 0) {
            return next(new Error("daysOfWeek must be between 0 (Sunday) and 6 (Saturday)"));
        }
    }
    
    next();
});

// Method to generate slots from template
slotTemplateSchema.methods.generateSlots = function(startDate, endDate, timezone = "Asia/Kolkata") {
    const slots = [];
    const currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    // Reset to start of day
    currentDate.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    while (currentDate <= end) {
        // Check if day is applicable based on recurrence
        if (this.isDateApplicable(currentDate)) {
            // Generate slots for each time slot within time range
            const daySlots = this.generateDaySlots(currentDate, timezone);
            slots.push(...daySlots);
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return slots;
};

// Helper method to check if date is applicable
slotTemplateSchema.methods.isDateApplicable = function(date) {
    if (!this.recurrence.enabled) {
        return true; // One-time templates apply to all dates
    }
    
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    
    switch (this.recurrence.pattern) {
        case "daily":
            // Check interval
            const daysSinceStart = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
            return daysSinceStart % this.recurrence.interval === 0;
            
        case "weekly":
            // Check if day of week is in allowed days
            if (this.recurrence.daysOfWeek.length === 0) {
                // All days allowed, check interval
                const weeksSinceStart = Math.floor(daysSinceStart / 7);
                return weeksSinceStart % this.recurrence.interval === 0;
            }
            return this.recurrence.daysOfWeek.includes(dayOfWeek);
            
        case "monthly":
            // Check if day of month matches interval
            const dayOfMonth = date.getDate();
            return dayOfMonth % this.recurrence.interval === 0;
            
        default:
            return true;
    }
};

// Helper method to generate slots for a specific day
slotTemplateSchema.methods.generateDaySlots = function(date, timezone) {
    const slots = [];
    const startHour = this.timeRange.startHour;
    const endHour = this.timeRange.endHour;
    
    for (let hour = startHour; hour < endHour; hour++) {
        // Skip excluded hours
        if (this.timeRange.excludeHours.includes(hour)) {
            continue;
        }
        
        // Calculate slot start and end times
        const slotStart = new Date(date);
        slotStart.setHours(hour, 0, 0, 0);
        
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + this.duration);
        
        // Check if slot fits within time range
        if (slotEnd.getHours() > endHour || 
            (slotEnd.getHours() === endHour && slotEnd.getMinutes() > 0)) {
            continue; // Slot would extend past end hour
        }
        
        // Create slot object
        const slot = {
            startTime: slotStart,
            endTime: slotEnd,
            duration: this.duration,
            bufferTime: this.bufferTime,
            preparationTime: this.preparationTime,
            applicableRoles: this.applicableRoles,
            capacity: this.capacity,
            location: this.location,
            tags: this.tags,
            requirements: this.requirements,
            bookingWindow: {
                maxHoursBefore: this.bookingWindow.maxDaysBefore * 24,
                minHoursBefore: this.bookingWindow.minHoursBefore
            },
            timezone: timezone,
            metadata: {
                source: "template",
                templateId: this._id
            }
        };
        
        slots.push(slot);
    }
    
    return slots;
};

const SlotTemplate = mongoose.model("SlotTemplate", slotTemplateSchema);

export default SlotTemplate;