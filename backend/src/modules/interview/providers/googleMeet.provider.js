import GoogleCalendarService from "../../../services/googleCalendar.service.js";
import { MeetingProvider } from "./meeting.provider.js";

/** Official Calendar-backed scheduling. Does not impersonate a Meet media agent. */
export class GoogleMeetProvider extends MeetingProvider {
  constructor(calendarService = new GoogleCalendarService()) { super(); this.calendarService = calendarService; }
  async createMeeting({ interview, booking, candidate }) {
    if (!this.calendarService.initialized) await this.calendarService.initialize();
    const result = await this.calendarService.createInterviewEvent(interview, {
      startTime: booking.startAt, endTime: booking.endAt, timezone: booking.timezone, location: "Online",
    }, candidate);
    return { ...result, liveAgentSupported: false };
  }
  async getMeeting(eventId) { return this.calendarService.getEventStatus(eventId); }
  async startAgent() { return { started: false, supported: false, reason: "The configured official Google APIs do not provide live Meet media participation." }; }
  async stopAgent() { return { stopped: false, supported: false }; }
  async getTranscript() { return { available: false, reason: "No official live transcript source is configured." }; }
}
export default GoogleMeetProvider;
