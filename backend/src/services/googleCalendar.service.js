/**
 * Google Calendar Service
 * 
 * Real implementation for Google Calendar integration
 * Handles creating, updating, and deleting calendar events for interviews
 */

import { google } from 'googleapis';
import logger from '../utils/logger.js';

class GoogleCalendarService {
  constructor() {
    this.calendar = null;
    this.initialized = false;
    this.calendarId = process.env.GOOGLE_CALENDAR_CALENDAR_ID || 'primary';
  }

  async getCalendarEvent(eventId) {
    if (!this.initialized || !this.calendar) {
      throw new Error('Google Calendar service not initialized');
    }
    const response = await this.calendar.events.get({ calendarId: this.calendarId, eventId });
    return response.data;
  }

  /**
   * Initialize Google Calendar API with OAuth2 credentials
   */
  async initialize() {
    try {
      const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
      const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

      if (!clientId || !clientSecret || !refreshToken) {
        logger.warn('Google Calendar credentials not configured. Calendar integration will be disabled.');
        this.initialized = false;
        return false;
      }

      // Create OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'https://ai-interview-system-eewl.vercel.app/api/calendar/callback' // Optional callback URL
      );

      // Set credentials with refresh token
      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      // Create calendar client
      this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      this.initialized = true;

      logger.info('✅ Google Calendar service initialized successfully');
      return true;

    } catch (error) {
      logger.error('❌ Failed to initialize Google Calendar service:', error.message);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Create a calendar event for an interview
   */
  async createInterviewEvent(interview, slot, candidate) {
    if (!this.initialized || !this.calendar) {
      throw new Error('Google Calendar service not initialized');
    }

    try {
      const event = this.buildCalendarEvent(interview, slot, candidate);

      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        resource: event,
        sendUpdates: 'all',
        conferenceDataVersion: 1,
      });

      let eventData = response.data;
      const eventId = eventData.id;
      let meetLink = eventData.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri || eventData.hangoutLink || null;
      const conferenceStatus = eventData.conferenceData?.createRequest?.status;
      if (!meetLink && eventId && conferenceStatus === "pending") {
        for (let attempt = 0; attempt < 4 && !meetLink; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
          eventData = await this.getCalendarEvent(eventId);
          meetLink = eventData.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri || eventData.hangoutLink || null;
        }
      }

      if (!meetLink) {
        const error = new Error("Google Calendar did not provide a Meet conference URL.");
        error.code = "MEET_LINK_UNAVAILABLE";
        if (eventId) await this.deleteInterviewEvent(eventId, interview._id, "Meet conference URL unavailable").catch(() => {});
        throw error;
      }

      logger.info(`Calendar event created for interview ${interview._id}`);
      return {
        success: true,
        eventId,
        eventLink: eventData.htmlLink,
        hangoutLink: eventData.hangoutLink,
        meetLink,
        eventData,
      };

    } catch (error) {
      logger.error(`Failed to create calendar event for interview ${interview._id}:`, error.code || error.message);
      throw error;
    }
  }

  /**
   * Update an existing calendar event (for rescheduling)
   */
  async updateInterviewEvent(eventId, interview, slot, candidate) {
    if (!this.initialized || !this.calendar) {
      throw new Error('Google Calendar service not initialized');
    }

    try {
      const event = this.buildCalendarEvent(interview, slot, candidate);

      const response = await this.calendar.events.update({
        calendarId: this.calendarId,
        eventId: eventId,
        resource: event,
        sendUpdates: 'all',
        conferenceDataVersion: 1,
      });

      logger.info(`✅ Calendar event updated for interview ${interview._id}`);
      
      return {
        success: true,
        eventId: response.data.id,
        updated: true,
        eventLink: response.data.htmlLink,
        eventData: response.data
      };

    } catch (error) {
      logger.error(`❌ Failed to update calendar event ${eventId}:`, error.message);
      throw new Error(`Failed to update calendar event: ${error.message}`);
    }
  }

  /**
   * Delete a calendar event (when interview is cancelled)
   */
  async deleteInterviewEvent(eventId, interviewId, reason = 'Interview cancelled') {
    if (!this.initialized || !this.calendar) {
      throw new Error('Google Calendar service not initialized');
    }

    try {
      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId: eventId,
        sendUpdates: 'all',
      });

      logger.info(`✅ Calendar event deleted for interview ${interviewId}`);
      
      return {
        success: true,
        eventId,
        deleted: true,
        reason
      };

    } catch (error) {
      // If event not found, consider it already deleted
      if (error.code === 404) {
        logger.warn(`Calendar event ${eventId} not found, assuming already deleted`);
        return {
          success: true,
          eventId,
          deleted: true,
          message: 'Event not found, assumed deleted'
        };
      }

      logger.error(`❌ Failed to delete calendar event ${eventId}:`, error.message);
      throw new Error(`Failed to delete calendar event: ${error.message}`);
    }
  }

  /**
   * Get event status
   */
  async getEventStatus(eventId) {
    if (!this.initialized || !this.calendar) {
      throw new Error('Google Calendar service not initialized');
    }

    try {
      const response = await this.calendar.events.get({
        calendarId: this.calendarId,
        eventId: eventId,
      });

      return {
        success: true,
        exists: true,
        eventId: response.data.id,
        status: response.data.status,
        summary: response.data.summary,
        start: response.data.start,
        end: response.data.end,
        attendees: response.data.attendees,
        htmlLink: response.data.htmlLink,
        hangoutLink: response.data.hangoutLink,
        lastUpdated: response.data.updated,
      };

    } catch (error) {
      if (error.code === 404) {
        return {
          success: true,
          exists: false,
          eventId,
          status: 'not_found'
        };
      }

      logger.error(`❌ Failed to get event status for ${eventId}:`, error.message);
      throw new Error(`Failed to get event status: ${error.message}`);
    }
  }

  /**
   * Build calendar event object
   */
  buildCalendarEvent(interview, slot, candidate) {
    const startTime = new Date(slot.startTime || slot.startAt);
    const endTime = new Date(slot.endTime || slot.endAt);

    const event = {
      summary: `AI Interview - ${candidate.name || candidate.email}`,
      location: slot.location || 'Online',
      description: this.buildEventDescription(interview, slot, candidate),
      start: {
        dateTime: startTime.toISOString(),
        timeZone: slot.timezone || 'UTC',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: slot.timezone || 'UTC',
      },
      attendees: [
        ...(candidate.email ? [{
          email: candidate.email,
          displayName: candidate.name || candidate.email,
          responseStatus: 'needsAction',
        }] : []),
        // Add interviewer email if available
        ...(interview.interviewerEmail ? [{
          email: interview.interviewerEmail,
          displayName: 'AI Interview System',
          organizer: true,
          responseStatus: 'accepted',
        }] : []),
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 60 },      // 1 hour before
          { method: 'popup', minutes: 15 },      // 15 minutes before
        ],
      },
      conferenceData: {
        createRequest: {
          requestId: `interview_${interview._id}_${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      extendedProperties: {
        private: {
          interviewId: interview._id.toString(),
          candidateId: candidate._id?.toString() || candidate.id,
          slotId: slot._id?.toString() || slot.id,
          interviewType: interview.interviewType || 'ai',
          system: 'ai_interview_system',
        },
      },
      transparency: 'opaque', // Shows as "Busy"
      visibility: 'private',
      status: 'confirmed',
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: false,
    };

    return event;
  }

  /**
   * Build event description
   */
  buildEventDescription(interview, slot, candidate) {
    const startAt = slot.startTime || slot.startAt;
    const duration = slot.duration || slot.durationMinutes || interview.aiConfig?.duration || 30;
    return `
AI Interview Scheduled

Candidate: ${candidate.name || candidate.email}
Interview Type: ${interview.interviewType?.toUpperCase() || 'AI Interview'}
Duration: ${duration} minutes
Date: ${new Date(startAt).toLocaleDateString()}
Time: ${new Date(startAt).toLocaleTimeString()}
Timezone: ${slot.timezone || 'UTC'}

Preparation Required:
1. Complete your profile information
2. Upload required documents
3. Take preparation test

Join Instructions:
The Google Meet link will be available in this calendar event.

Important Notes:
- Please join 5-10 minutes early
- Have your ID ready for verification
- Ensure stable internet connection
- Find a quiet environment

For support, contact: support@ai-interview-system.com

---
This event was created by AI Interview System
    `.trim();
  }

  /**
   * Quick test to verify calendar connection
   */
  async testConnection() {
    if (!this.initialized || !this.calendar) {
      return { success: false, message: 'Calendar service not initialized' };
    }

    try {
      // Try to get calendar settings
      const response = await this.calendar.calendars.get({
        calendarId: this.calendarId,
      });

      return {
        success: true,
        message: 'Google Calendar connection successful',
        calendarId: response.data.id,
        calendarSummary: response.data.summary,
        timeZone: response.data.timeZone,
        accessRole: response.data.accessRole,
      };

    } catch (error) {
      return {
        success: false,
        message: `Calendar connection failed: ${error.message}`,
        error: error.message,
      };
    }
  }
}

// One backend-only singleton shared by the legacy integration and active booking flow.
export const googleCalendarService = new GoogleCalendarService();
export default googleCalendarService;