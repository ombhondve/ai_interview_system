import GoogleCalendarService from "../../../services/googleCalendar.service.js";
import { MeetingProvider } from "./meeting.provider.js";

/**
 * Google Calendar/Meet scheduling adapter. Google Calendar can provision a
 * meeting URL, but the currently configured APIs do not join/stream live media
 * as an AI participant. Audio-agent methods intentionally remain unsupported.
 */
export class GoogleMeetProvider extends MeetingProvider {
  constructor(calendarService = new GoogleCalendarService()) {
    super();
    this.calendarService = calendarService;
  }

  async createMeeting({ interview, booking, candidate }) {
    if (!this.calendarService.initialized) await this.calendarService.initialize();
    const result = await this.calendarService.createInterviewEvent(
      interview,
      { startTime: booking.startAt, endTime: booking.endAt, timezone: booking.timezone, location: "Online" },
      candidate
    );
    return { ...result, liveAgentSupported: false };
  }

  async getMeeting(eventId) {
    return this.calendarService.getEventStatus(eventId);
  }

  async startAgent() {
    return { started: false, supported: false, reason: "Google Meet live media participation is not available through the configured official APIs." };
  }

  async stopAgent() {
    return { stopped: false, supported: false };
  }

  async getTranscript() {
    return { available: false, reason: "No official live transcript source is configured." };
  }
}

export default GoogleMeetProvider;
