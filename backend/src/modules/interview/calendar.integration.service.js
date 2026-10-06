/**
 * Legacy Calendar adapter retained for old booking callers.
 * The active Google Calendar integration is invoked only by verified
 * InterviewBooking creation. Legacy callers must not create or alter events.
 */
class CalendarIntegrationService {
  constructor() {
    this.enabled = false;
    this.provider = "google";
    this.services = {};
  }

  async createInterviewEvent() {
    return { success: false, code: "LEGACY_CALENDAR_FLOW_DISABLED", message: "Calendar event creation is available only through active interview booking." };
  }

  async updateInterviewEvent() {
    return { success: false, code: "LEGACY_CALENDAR_FLOW_DISABLED", message: "Calendar event management is available only through active interview booking." };
  }

  async deleteInterviewEvent() {
    return { success: false, code: "LEGACY_CALENDAR_FLOW_DISABLED", message: "Calendar event management is available only through active interview booking." };
  }

  async sendCalendarInvite() {
    return { success: false, code: "LEGACY_CALENDAR_FLOW_DISABLED", message: "Calendar invitations are managed by active interview booking." };
  }

  async testConnection() {
    return { success: false, code: "LEGACY_CALENDAR_FLOW_DISABLED", message: "Use the authenticated Google Calendar status endpoint." };
  }

  isAvailable() {
    return false;
  }

  getStatus() {
    return { enabled: false, provider: this.provider, available: false, services: [] };
  }
}

export { CalendarIntegrationService };
export default new CalendarIntegrationService();
