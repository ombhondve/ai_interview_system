import mongoose from "mongoose";

/**
 * =====================================================
 * INTERVIEW BOOKING
 * =====================================================
 *
 * This model stores ACTUAL STUDENT BOOKINGS only. There is no "slot" row
 * that an admin has to pre-create: possible interview times are generated
 * from the InterviewConfig, and this collection records who took which one.
 *
 * `startAt` is the canonical, normalized booking instant (UTC Date).
 * Uniqueness is enforced at the database level so two students can never
 * hold the same interview time, even under simultaneous requests.
 */

export const ACTIVE_BOOKING_STATUSES = ["scheduled"];

const interviewBookingSchema = new mongoose.Schema(
  {
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
      index: true,
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      comment: "Project the interview is about (from candidate.assignedProjectId).",
    },

    // Canonical booking time. All comparisons happen on this value.
    startAt: {
      type: Date,
      required: true,
    },

    endAt: {
      type: Date,
      required: true,
    },

    timezone: {
      type: String,
      required: true,
      default: "Asia/Kolkata",
    },

    durationMinutes: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "scheduled",
        "completed",
        "cancelled",
        "no_show",
      ],
      default: "scheduled",
      index: true,
    },

    mode: {
      type: String,
      enum: ["online", "onsite", "phone"],
      default: "online",
    },

    meetLink: {
      type: String,
      trim: true,
    },

    calendarEventId: {
      type: String,
      trim: true,
    },

    conferenceId: {
      type: String,
      trim: true,
    },

    calendarAdminId: {
      type: String,
      trim: true,
    },

    bookedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// ---------------------------------------------------------------------------
// DOUBLE-BOOKING PROTECTION (DATABASE LEVEL)
// ---------------------------------------------------------------------------

/**
 * Two students can NEVER hold the same interview start time while both
 * bookings are active. Partial unique index => exactly the guarantee needed:
 * a cancelled/completed booking releases the time for re-booking.
 */
interviewBookingSchema.index(
  { startAt: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ACTIVE_BOOKING_STATUSES } },
    name: "uniq_active_booking_startAt",
  }
);

/**
 * A student can never hold more than one ACTIVE interview.
 */
interviewBookingSchema.index(
  { candidateId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ACTIVE_BOOKING_STATUSES } },
    name: "uniq_active_booking_candidate",
  }
);

// Convenience lookups.
interviewBookingSchema.index({ candidateId: 1, status: 1 });
interviewBookingSchema.index({ startAt: 1, status: 1 });

const InterviewBooking = mongoose.model(
  "InterviewBooking",
  interviewBookingSchema
);

export default InterviewBooking;