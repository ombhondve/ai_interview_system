/**
 * Google Calendar Service
 * 
 * Real implementation for Google Calendar integration
 * Handles creating, updating, and deleting calendar events for interviews
 */

import { google } from 'googleapis';
import logger from '../utils/logger.js';
import GoogleCalendarConnection from '../modules/calendar/googleCalendarConnection.model.js';
import { decryptGoogleToken } from '../modules/calendar/googleCalendar.crypto.js';

class GoogleCalendarService {
  constructor() {
    this.calendarId = process.env.GOOGLE_CALENDAR_CALENDAR_ID || 'primary';
    this.clientCache = new Map();
  }

  async getCalendarContext(adminId) {
    if (!adminId) {
      const error = new Error('Google Calendar connection is required.');
      error.code = 'GOOGLE_CALENDAR_NOT_CONNECTED';
      error.status = 503;
      throw error;
    }
    const key = String(adminId);
    const cached = this.clientCache.get(key);
    if (cached) return cached;
    const connection = await GoogleCalendarConnection.findOne({ adminId: key, status: 'connected' }).select('+refreshTokenEncrypted');
    if (!connection?.refreshTokenEncrypted) {
      const error = new Error('Google Calendar is not connected by an administrator.');
      error.code = 'GOOGLE_CALENDAR_NOT_CONNECTED';
      error.status = 503;
      throw error;
    }
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const callbackUrl = process.env.GOOGLE_CALENDAR_CALLBACK_URL ||
      (process.env.BACKEND_URL ? `${process.env.BACKEND_URL.replace(/\/+$/, "")}/api/admin/google-calendar/callback` : null);
    if (!clientId || !clientSecret || !callbackUrl) {
      const error = new Error('Google Calendar OAuth is not configured.');
      error.code = 'GOOGLE_CALENDAR_NOT_CONFIGURED';
      error.status = 503;
      throw error;
    }
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, callbackUrl);
    oauth2Client.setCredentials({ refresh_token: decryptGoogleToken(connection.refreshTokenEncrypted) });
    const context = { calendar: google.calendar({ version: 'v3', auth: oauth2Client }), oauth2Client, calendarId: connection.calendarId || this.calendarId, adminId: key };
    this.clientCache.set(key, context);
    connection.lastValidatedAt = new Date();
    await connection.save();
    return context;
  }

  clearConnectionCache(adminId) {
    if (adminId) this.clientCache.delete(String(adminId));
    else this.clientCache.clear();
  }

  async initializeForRefreshToken(refreshToken, calendarId = this.calendarId, adminId = null) {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALENDAR_CALLBACK_URL ||
      (process.env.BACKEND_URL ? `${process.env.BACKEND_URL.replace(/\/+$/, "")}/api/admin/google-calendar/callback` : null);
    if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
      const error = new Error('Google Calendar is not configured.');
      error.code = 'GOOGLE_CALENDAR_NOT_CONFIGURED';
      error.status = 503;
      throw error;
    }
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    if (!adminId) return calendar;
    const context = { calendar, oauth2Client, calendarId, adminId: String(adminId) };
    this.clientCache.set(String(adminId), context);
    return calendar;
  }

  async initialize(adminId) {
    try {
      await this.getCalendarContext(adminId);
      return true;
    } catch (error) {
      if (error.code === 'GOOGLE_CALENDAR_NOT_CONNECTED' || error.code === 'GOOGLE_CALENDAR_NOT_CONFIGURED') throw error;
      logger.error('Failed to initialize connected Google Calendar', { code: error.code || error.response?.status || 'CALENDAR_AUTH_ERROR' });
      const safe = new Error('The connected Google Calendar authorization is invalid or unavailable. Reconnect it in admin settings.');
      safe.code = 'GOOGLE_CALENDAR_AUTH_FAILED';
      safe.status = 503;
      throw safe;
    }
  }

  async getCalendarEvent(eventId, adminId) {
    const context = await this.getCalendarContext(adminId);
    const response = await context.calendar.events.get({ calendarId: context.calendarId, eventId });
    return response.data;
  }

  /**
   * Create a calendar event for an interview
   */
  async createInterviewEvent(interview, slot, candidate) {
    if (!interview.adminId) {
      const error = new Error('Google Calendar is not connected by an administrator.');
      error.code = 'GOOGLE_CALENDAR_NOT_CONNECTED';
      error.status = 503;
      throw error;
    }

    try {
      const context = await this.getCalendarContext(interview.adminId);
      const event = this.buildCalendarEvent(interview, slot, candidate);

      const response = await context.calendar.events.insert({
        calendarId: context.calendarId,
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
          eventData = await this.getCalendarEvent(eventId, interview.adminId);
          meetLink = eventData.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri || eventData.hangoutLink || null;
        }
      }

      if (!meetLink) {
        const error = new Error("Google Calendar did not provide a Meet conference URL.");
        error.code = "MEET_LINK_UNAVAILABLE";
        if (eventId) await this.deleteInterviewEvent(eventId, interview._id, "Meet conference URL unavailable", interview.adminId).catch((cleanupError) => logger.warn('Calendar event cleanup failed after missing Meet URL', { code: cleanupError?.code || 'CALENDAR_CLEANUP_FAILED' }));
        throw error;
      }

      logger.info('Calendar event created for interview', { interviewId: String(interview._id), eventId });
      return {
        success: true,
        eventId,
        eventLink: eventData.htmlLink,
        hangoutLink: eventData.hangoutLink,
        meetLink,
        conferenceId: eventData.conferenceData?.conferenceId || null,
        adminId: String(interview.adminId),
        calendarId: context.calendarId,
        eventData,
      };

    } catch (error) {
      logger.error('Failed to create calendar event for interview', {
        interviewId: String(interview._id),
        code: error.code || error.response?.status || 'CALENDAR_API_ERROR',
        status: error.status || error.response?.status,
        message: error.message,
        googleApiError: error.response?.data?.error || error.errors,
      });
      throw error;
    }
  }

  /**
   * Update an existing calendar event (for rescheduling)
   */
  async updateInterviewEvent(eventId, interview, slot, candidate) {
    if (!interview.adminId) throw new Error('Google Calendar service not initialized');

    try {
      const context = await this.getCalendarContext(interview.adminId);
      const event = this.buildCalendarEvent(interview, slot, candidate);

      const response = await context.calendar.events.update({
        calendarId: context.calendarId,
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
  async deleteInterviewEvent(eventId, interviewId, reason = 'Interview cancelled', adminId) {
    const context = await this.getCalendarContext(adminId);

    try {
      await context.calendar.events.delete({
        calendarId: context.calendarId,
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
  async getEventStatus(eventId, adminId) {
    const context = await this.getCalendarContext(adminId);

    try {
      const response = await context.calendar.events.get({
        calendarId: context.calendarId,
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
        ...((interview.botEmail || process.env.GOOGLE_MEET_BOT_EMAIL) ? [{
          email: (interview.botEmail || process.env.GOOGLE_MEET_BOT_EMAIL).trim().toLowerCase(),
          displayName: 'RecruitAI Interview Bot',
          responseStatus: 'accepted',
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
          requestId: interview.conferenceRequestId || `interview_${interview._id}`,
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
  async testConnection(adminId) {
    try {
      const context = await this.getCalendarContext(adminId);
      const response = await context.calendar.events.list({
        calendarId: context.calendarId,
        maxResults: 1,
        fields: 'items(id)',
      });

      return {
        success: true,
        message: 'Google Calendar connection successful',
        calendarId: context.calendarId,
        eventsAccessible: Array.isArray(response.data?.items),
      };

    } catch (error) {
      return {
        success: false,
        message: 'Calendar connection failed. Verify the connection and required permissions.',
      };
    }
  }
}

// One backend-only singleton shared by the legacy integration and active booking flow.
export const googleCalendarService = new GoogleCalendarService();
export default googleCalendarService;