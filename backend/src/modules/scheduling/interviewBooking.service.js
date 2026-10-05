import InterviewBooking, {
  ACTIVE_BOOKING_STATUSES,
} from "./interviewBooking.model.js";
import Candidate from "../candidate/candidate.model.js";
import { canBookInterviewSlot } from "../projects/deadline.service.js";
import {
  generateInterviewTimesForDate,
  validateStartInstant,
  formatTimeInZone,
  formatDateInZone,
} from "./interviewConfig.service.js";

/**
 * Business error carrying an HTTP status and a stable machine-readable code.
 */
export class BookingError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "BookingError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Look up the candidate's active interview booking.
 */
export async function getActiveBookingForCandidate(candidateId) {
  return InterviewBooking.findOne({
    candidateId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
  })
    .sort({ startAt: 1 })
    .lean();
}

/**
 * Availability for a single local date.
 *
 * @param {object} config InterviewConfig document
 * @param {string} candidateId The requesting candidate. Accepted so the
 *   signature matches the call site and so a future "your own booking" marker
 *   can be added without changing callers. It is deliberately NOT used to
 *   enrich the response.
 * @param {string} dateStr "YYYY-MM-DD" in the config timezone
 *
 * PRIVACY: the student-facing projection NEVER includes who booked a time.
 * The status is only "available" or "already_taken".
 */
export async function getAvailabilityForDate(config, candidateId, dateStr) {
  void candidateId;

  const generated = generateInterviewTimesForDate(config, dateStr);

  const empty = {
    date: dateStr,
    timezone: config.timezone,
    interviewDurationMinutes: config.interviewDurationMinutes,
    slots: [],
  };

  if (generated.length === 0) {
    return empty;
  }

  const first = generated[0].startAt;
  const last = generated[generated.length - 1].endAt;

  const booked = await InterviewBooking.find({
    status: { $in: ACTIVE_BOOKING_STATUSES },
    startAt: { $gte: first, $lt: last },
  })
    .select({ startAt: 1 })
    .lean();

  const takenSet = new Set(
    booked.map((booking) => booking.startAt.getTime())
  );

  const now = Date.now();

  return {
    date: dateStr,
    timezone: config.timezone,
    interviewDurationMinutes: config.interviewDurationMinutes,
    slots: generated.map(({ startAt, endAt }) => {
      const taken = takenSet.has(startAt.getTime());
      const inPast = startAt.getTime() <= now;

      let status = "available";

      if (taken) {
        status = "already_taken";
      } else if (inPast) {
        status = "past";
      }

      return {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        time: formatTimeInZone(startAt, config.timezone),
        endTime: formatTimeInZone(endAt, config.timezone),
        // Only two selectable states. No booker identity, ever.
        status,
      };
    }),
  };
}

/**
 * Serialize a booking for the owning student.
 */
export function toStudentBooking(booking, config) {
  return {
    id: booking._id.toString(),
    startAt: booking.startAt,
    endAt: booking.endAt,
    date: formatDateInZone(booking.startAt, config.timezone),
    time: formatTimeInZone(booking.startAt, config.timezone),
    endTime: formatTimeInZone(booking.endAt, config.timezone),
    timezone: booking.timezone,
    durationMinutes: booking.durationMinutes,
    status: booking.status,
    mode: booking.mode,
    location: config.location,
    meetLink: booking.meetLink || null,
    bookedAt: booking.bookedAt,
  };
}

/**
 * The candidate's own active booking.
 */
export async function getStudentBooking(candidateId, config) {
  const booking = await getActiveBookingForCandidate(candidateId);

  return booking ? toStudentBooking(booking, config) : null;
}

/**
 * BOOK AN INTERVIEW.
 *
 * Every cheap check runs BEFORE the single atomic insert, because the insert
 * is the only moment at which exclusivity is guaranteed. Any violation of the
 * unique indexes surfaces as a duplicate-key error, which is translated into a
 * controlled 409 rather than a 500.
 *
 * @param {object} params
 * @param {object} params.config InterviewConfig document
 * @param {object} params.candidate Authenticated candidate document
 * @param {Date} params.startAt Normalized booking instant
 * @returns {Promise<object>} serialized booking
 */
export async function bookInterview({ config, candidate, startAt }) {
  // 1. Persisted eligibility. The backend is the authority; the frontend is
  //    never trusted.
  const eligibility = canBookInterviewSlot(candidate);

  if (!eligibility.eligible) {
    const alreadyBooked = eligibility.reason === "already_booked";

    throw new BookingError(
      alreadyBooked ? 409 : 403,
      alreadyBooked ? "INTERVIEW_ALREADY_BOOKED" : "INTERVIEW_NOT_ELIGIBLE",
      eligibility.message
    );
  }

  // 2. Defence in depth: an active booking blocks a new one even if the legacy
  //    candidate.bookedSlotId flag was never set.
  const existing = await getActiveBookingForCandidate(candidate._id);

  if (existing) {
    throw new BookingError(
      409,
      "INTERVIEW_ALREADY_BOOKED",
      "You already have an active interview scheduled."
    );
  }

  // 3. The time must be one the system actually generates, and in the future.
  const validation = validateStartInstant(config, startAt);

  if (!validation.valid) {
    throw new BookingError(400, validation.code, validation.message);
  }

  // 4. ATOMIC INSERT. The partial unique indexes
  //    (uniq_active_booking_startAt / uniq_active_booking_candidate) are the
  //    real guarantee against double booking under concurrency.
  try {
    const created = await InterviewBooking.create({
      candidateId: candidate._id,
      projectId: candidate.assignedProjectId || undefined,
      startAt,
      endAt: validation.endAt,
      timezone: config.timezone,
      durationMinutes: config.interviewDurationMinutes,
      status: "scheduled",
      mode: config.mode,
      bookedAt: new Date(),
    });

    // 5. Mirror onto the candidate document so the existing portal code and
    //    admin candidate views keep working.
    await Candidate.findByIdAndUpdate(candidate._id, {
      $set: {
        interviewStatus: "scheduled",
        interviewDate: startAt,
        interviewBookedAt: new Date(),
      },
    });

    return toStudentBooking(created.toObject(), config);
  } catch (error) {
    if (error?.code === 11000) {
      // Work out which uniqueness guarantee was violated.
      const mine = await getActiveBookingForCandidate(candidate._id);

      if (mine) {
        throw new BookingError(
          409,
          "INTERVIEW_ALREADY_BOOKED",
          "You already have an active interview scheduled."
        );
      }

      throw new BookingError(
        409,
        "INTERVIEW_TIME_ALREADY_BOOKED",
        "This interview time was just booked by another student."
      );
    }

    throw error;
  }
}
/**
 * =====================================================
 * ADMIN SCHEDULE (READ-ONLY)
 * =====================================================
 */

/**
 * The full generated schedule for a date, plus booking details for admin.
 *
 * This is the ONLY schedule read path. There is deliberately no create /
 * update / delete / assign counterpart for admins anywhere in the codebase.
 */
export async function getAdminSchedule(config, dateStr) {
  const generated = generateInterviewTimesForDate(config, dateStr);

  const shell = {
    date: dateStr,
    timezone: config.timezone,
    interviewDurationMinutes: config.interviewDurationMinutes,
    mode: config.mode,
    location: config.location,
    readOnly: true,
  };

  if (generated.length === 0) {
    return { ...shell, entries: [] };
  }

  const first = generated[0].startAt;
  const last = generated[generated.length - 1].endAt;

  const bookings = await InterviewBooking.find({
    status: { $in: ACTIVE_BOOKING_STATUSES },
    startAt: { $gte: first, $lt: last },
  })
    .populate("candidateId", "name email phone role")
    .populate("projectId", "title")
    .lean();

  const byStart = new Map(
    bookings.map((booking) => [booking.startAt.getTime(), booking])
  );

  return {
    ...shell,
    entries: generated.map(({ startAt, endAt }) => {
      const booking = byStart.get(startAt.getTime());

      const base = {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        time: formatTimeInZone(startAt, config.timezone),
        endTime: formatTimeInZone(endAt, config.timezone),
      };

      if (!booking) {
        return { ...base, status: "available", booking: null };
      }

      const candidate = booking.candidateId || {};

      return {
        ...base,
        status: "booked",
        booking: {
          id: booking._id.toString(),
          status: booking.status,
          bookedAt: booking.bookedAt,
          candidate: {
            id: candidate._id ? candidate._id.toString() : null,
            name: candidate.name || null,
            email: candidate.email || null,
            phone: candidate.phone || null,
            role: candidate.role || null,
          },
          project: booking.projectId?.title || null,
          meetLink: booking.meetLink || null,
        },
      };
    }),
  };
}