import { googleCalendarService } from "../../services/googleCalendar.service.js";
import logger from "../../utils/logger.js";

const calendarService = googleCalendarService;

function safeMessage(error) {
  const code = error?.code || error?.response?.status;
  if (code === 401 || code === 403) return "Google Calendar is not authorized. Please contact the recruitment team.";
  if (code === 429) return "Google Calendar is temporarily rate limited. Please try again shortly.";
  return "Unable to create the interview meeting. Please try booking again.";
}

export async function createInterviewMeeting({ session, booking, candidate, adminId }) {
  try {
    const initialized = await calendarService.initialize(adminId);
    if (!initialized) {
      const error = new Error("Google Calendar is not configured.");
      error.status = 503;
      error.code = "CALENDAR_NOT_CONFIGURED";
      throw error;
    }
    const result = await calendarService.createInterviewEvent(
      {
        _id: session._id,
        adminId,
        candidateId: candidate._id,
        bookingId: booking._id,
        interviewType: "ai",
      },
      {
        startAt: booking.startAt,
        endAt: booking.endAt,
        timezone: booking.timezone,
        location: "Google Meet",
        durationMinutes: booking.durationMinutes,
      },
      candidate,
    );

    if (!result?.eventId || !result?.meetLink) {
      if (result?.eventId) {
        await calendarService.deleteInterviewEvent(result.eventId, session._id, "Meet conference URL missing", adminId).catch((cleanupError) => logger.warn("Calendar event cleanup failed after missing Meet URL", { code: cleanupError?.code || "CALENDAR_CLEANUP_FAILED" }));
      }
      const error = new Error("Google Calendar did not return a Meet link.");
      error.status = 502;
      error.code = "MEET_LINK_UNAVAILABLE";
      throw error;
    }

    return result;
  } catch (error) {
    logger.error("Interview meeting creation failed", { interviewId: String(session._id), code: error?.code || "CALENDAR_ERROR" });
    error.status = error.status || 502;
    error.code = error.code || "CALENDAR_CREATION_FAILED";
    error.safeMessage = safeMessage(error);
    throw error;
  }
}

export async function deleteInterviewMeeting(eventId, interviewId, adminId) {
  if (!eventId) return;
  const initialized = await calendarService.initialize(adminId);
  if (!initialized) throw new Error("Google Calendar connection is unavailable during event cleanup.");
  await calendarService.deleteInterviewEvent(eventId, interviewId, "Booking compensation", adminId);
}
