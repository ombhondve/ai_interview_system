const mongoose = require("mongoose");

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
            enum: ["open", "booked", "cancelled"],
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
        }
    },
    {
        timestamps: true
    }
);

const Slot = mongoose.model("Slot", slotSchema);

module.exports = Slot;