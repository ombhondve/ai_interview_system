/**
 * Calendar Integration Service
 * 
 * Wrapper service for calendar integrations (Google Calendar, Outlook, etc.)
 * Provides a unified interface for calendar operations
 */

import logger from "../../utils/logger.js";
import GoogleCalendarService from "../../services/googleCalendar.service.js";

class CalendarIntegrationService {
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
    this.provider = config.provider || 'google';
    this.services = {};
    
    if (this.enabled) {
      this.initializeServices();
    }
  }

  /**
   * Initialize calendar services based on provider
   */
  initializeServices() {
    try {
      switch (this.provider) {
        case 'google':
          this.services.google = new GoogleCalendarService();
          this.services.google.initialize();
          logger.info(`✅ Calendar Integration Service initialized with ${this.provider} provider`);
          break;
        default:
          logger.warn(`⚠️  Calendar provider '${this.provider}' not implemented. Calendar integration will be disabled.`);
          this.enabled = false;
      }
    } catch (error) {
      logger.error('❌ Failed to initialize calendar integration service:', error.message);
      this.enabled = false;
    }
  }

  /**
   * Create a calendar event for an interview
   */
  async createInterviewEvent(interview, slot, candidate) {
    if (!this.enabled) {
      logger.warn('Calendar integration disabled, skipping event creation');
      return {
        success: false,
        message: 'Calendar integration disabled'
      };
    }

    try {
      const service = this.services[this.provider];
      if (!service) {
        throw new Error(`Calendar service for provider '${this.provider}' not available`);
      }

      return await service.createInterviewEvent(interview, slot, candidate);
    } catch (error) {
      logger.error(`❌ Failed to create calendar event for interview ${interview._id}:`, error.message);
      
      // Don't fail the booking if calendar creation fails
      return {
        success: false,
        message: `Calendar event creation failed: ${error.message}`,
        interviewId: interview._id
      };
    }
  }

  /**
   * Update an existing calendar event (for rescheduling)
   */
  async updateInterviewEvent(interviewId, eventId, interview, slot, candidate) {
    if (!this.enabled) {
      logger.warn('Calendar integration disabled, skipping event update');
      return {
        success: false,
        message: 'Calendar integration disabled'
      };
    }

    try {
      const service = this.services[this.provider];
      if (!service) {
        throw new Error(`Calendar service for provider '${this.provider}' not available`);
      }

      return await service.updateInterviewEvent(eventId, interview, slot, candidate);
    } catch (error) {
      logger.error(`❌ Failed to update calendar event ${eventId} for interview ${interviewId}:`, error.message);
      
      // Don't fail the rescheduling if calendar update fails
      return {
        success: false,
        message: `Calendar event update failed: ${error.message}`,
        eventId,
        interviewId
      };
    }
  }

  /**
   * Delete a calendar event (for cancellation)
   */
  async deleteInterviewEvent(eventId, interviewId) {
    if (!this.enabled) {
      logger.warn('Calendar integration disabled, skipping event deletion');
      return {
        success: false,
        message: 'Calendar integration disabled'
      };
    }

    try {
      const service = this.services[this.provider];
      if (!service) {
        throw new Error(`Calendar service for provider '${this.provider}' not available`);
      }

      return await service.deleteInterviewEvent(eventId);
    } catch (error) {
      logger.error(`❌ Failed to delete calendar event ${eventId} for interview ${interviewId}:`, error.message);
      
      // Don't fail the cancellation if calendar deletion fails
      return {
        success: false,
        message: `Calendar event deletion failed: ${error.message}`,
        eventId,
        interviewId
      };
    }
  }

  /**
   * Send calendar invite to candidate email
   */
  async sendCalendarInvite(eventId, candidateEmail, interviewDetails) {
    if (!this.enabled) {
      logger.warn('Calendar integration disabled, skipping invite sending');
      return {
        success: false,
        message: 'Calendar integration disabled'
      };
    }

    try {
      const service = this.services[this.provider];
      if (!service) {
        throw new Error(`Calendar service for provider '${this.provider}' not available`);
      }

      // This would typically use the calendar API to send invites
      // For now, we'll log and return success
      logger.info(`📧 Would send calendar invite for event ${eventId} to ${candidateEmail}`);
      
      return {
        success: true,
        message: 'Calendar invite would be sent',
        eventId,
        candidateEmail
      };
    } catch (error) {
      logger.error(`❌ Failed to send calendar invite for event ${eventId}:`, error.message);
      
      return {
        success: false,
        message: `Calendar invite failed: ${error.message}`,
        eventId,
        candidateEmail
      };
    }
  }

  /**
   * Check if calendar integration is available
   */
  isAvailable() {
    return this.enabled && this.services[this.provider]?.initialized === true;
  }

  /**
   * Get calendar service status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      provider: this.provider,
      available: this.isAvailable(),
      services: Object.keys(this.services)
    };
  }
}

// Export the class
export { CalendarIntegrationService };

// Default export (for backward compatibility)
export default new CalendarIntegrationService({ enabled: false });
