import { googleCalendarService } from "../../services/googleCalendar.service.js";
import logger from "../../utils/logger.js";

const calendarService = googleCalendarService;

export function safeMessage(error) {
  if (error?.safeMessage) return error.safeMessage;
  const status = error?.status || error?.response?.status;
  const code = error?.code || error?.response?.data?.error;

  if (code === "invalid_grant" || code === "GOOGLE_CALENDAR_AUTH_FAILED" || status === 401) {
    return "The recruitment team's Google Calendar authorization has expired or is invalid. Please contact the recruitment team to reconnect the calendar.";
  }
  if (code === "GOOGLE_CALENDAR_NOT_CONNECTED") {
    return "Interview scheduling is temporarily unavailable because the interview calendar has not been connected. Please contact the recruitment team.";
  }
  if (code === "GOOGLE_CALENDAR_NOT_CONFIGURED" || code === "CALENDAR_NOT_CONFIGURED") {
    return "Interview scheduling is temporarily unavailable. Google Calendar has not been configured.";
  }
  if (code === "GOOGLE_CALENDAR_CONNECTION_AMBIGUOUS") {
    return "Multiple company calendars are connected. Exactly one company Google Calendar must be configured.";
  }
  if (status === 403 || code === "GOOGLE_CALENDAR_FORBIDDEN") {
    return "Google Calendar does not have sufficient permissions to create meetings. Please contact support.";
  }
  if (status === 429 || code === "GOOGLE_CALENDAR_RATE_LIMITED") {
    return "Google Calendar is temporarily rate limited. Please try again shortly.";
  }
  if (code === "MEET_LINK_UNAVAILABLE") {
    return "Google Meet link could not be generated for this interview slot. Please try booking again.";
  }
  if (status === 503 || code === "GOOGLE_CALENDAR_UNAVAILABLE") {
    return "Google Calendar service is temporarily unavailable. Please try again in a few moments.";
  }
  return "Unable to create the interview meeting. Please try booking again.";
}

export async function createInterviewMeeting({ session, booking, candidate, adminId }) {
  try {
    const initialized = await calendarService.initialize(adminId);
    if (!initialized) {
      const error = new Error("Google Calendar is not configured.");
      error.status = 503;
      error.code = "CALENDAR_NOT_CONFIGURED";
      error.safeMessage = safeMessage(error);
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
      error.safeMessage = safeMessage(error);
      throw error;
    }

    return result;
  } catch (error) {
    const status = error?.status || error?.response?.status || 502;
    const code = error?.code || (status === 429 ? "GOOGLE_CALENDAR_RATE_LIMITED" : "CALENDAR_CREATION_FAILED");
    const safeMsg = safeMessage({ ...error, status, code });

    logger.error("Interview meeting creation failed", {
      interviewId: String(session._id),
      code,
      status,
      message: error?.message,
      googleError: error?.response?.data?.error?.message || error?.response?.data?.error || error?.errors?.[0]?.message,
    });
    error.status = status;
    error.code = code;
    error.safeMessage = safeMsg;
    throw error;
  }
}

export async function deleteInterviewMeeting(eventId, interviewId, adminId) {
  if (!eventId) return;
  const initialized = await calendarService.initialize(adminId);
  if (!initialized) throw new Error("Google Calendar connection is unavailable during event cleanup.");
  await calendarService.deleteInterviewEvent(eventId, interviewId, "Booking compensation", adminId);
}
