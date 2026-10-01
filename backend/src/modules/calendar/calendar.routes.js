/**
 * Calendar Routes for Students
 * 
 * Routes for students to manage Google Calendar events for their interviews
 */

import express from 'express';
import googleCalendarService from '../../services/googleCalendar.service.js';
import { requireAuth } from '../auth/auth.middleware.js';
import Interview from '../interview/interview.model.js';
import Slot from '../scheduling/slot.model.js';

const router = express.Router();

/**
 * POST /api/calendar/interview/:interviewId/create-event
 * Create Google Calendar event for an interview
 */
router.post('/interview/:interviewId/create-event', requireAuth, async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user.id;

    // Get interview details
    const interview = await Interview.findById(interviewId)
      .populate('slotId')
      .populate('candidateId');

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found',
      });
    }

    // Verify the user has access to this interview
    if (interview.candidateId._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to create calendar event for this interview',
      });
    }

    // Check if calendar event already exists
    if (interview.calendarEventId) {
      return res.status(400).json({
        success: false,
        message: 'Calendar event already exists for this interview',
        eventId: interview.calendarEventId,
      });
    }

    // Get slot details
    const slot = await Slot.findById(interview.slotId._id);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Interview slot not found',
      });
    }

    // Create calendar event
    const calendarResult = await googleCalendarService.createInterviewEvent(
      interview,
      slot,
      {
        _id: interview.candidateId._id,
        id: interview.candidateId._id,
        email: interview.candidateId.email,
        name: interview.candidateId.name,
      }
    );

    // Update interview with calendar event ID
    interview.calendarEventId = calendarResult.eventId;
    interview.calendarEventLink = calendarResult.eventLink;
    interview.meetLink = calendarResult.meetLink || calendarResult.hangoutLink;
    await interview.save();

    return res.status(201).json({
      success: true,
      message: 'Calendar event created successfully',
      data: {
        interviewId: interview._id,
        eventId: calendarResult.eventId,
        eventLink: calendarResult.eventLink,
        meetLink: calendarResult.meetLink,
        htmlLink: calendarResult.eventData?.htmlLink,
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
    });

  } catch (error) {
    console.error('Error creating calendar event:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to create calendar event',
      error: error.message,
    });
  }
});

/**
 * GET /api/calendar/interview/:interviewId/event-status
 * Get status of calendar event for an interview
 */
router.get('/interview/:interviewId/event-status', requireAuth, async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user.id;

    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found',
      });
    }

    // Verify access
    if (interview.candidateId.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this calendar event',
      });
    }

    if (!interview.calendarEventId) {
      return res.status(404).json({
        success: false,
        message: 'No calendar event created for this interview',
      });
    }

    // Get event status
    const eventStatus = await googleCalendarService.getEventStatus(interview.calendarEventId);

    return res.status(200).json({
      success: true,
      data: eventStatus,
    });

  } catch (error) {
    console.error('Error getting calendar event status:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to get calendar event status',
      error: error.message,
    });
  }
});

/**
 * PUT /api/calendar/interview/:interviewId/update-event
 * Update calendar event (for rescheduled interviews)
 */
router.put('/interview/:interviewId/update-event', requireAuth, async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { newSlotId } = req.body;
    const userId = req.user.id;

    const interview = await Interview.findById(interviewId)
      .populate('candidateId');

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found',
      });
    }

    // Verify access
    if (interview.candidateId._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update calendar event',
      });
    }

    if (!interview.calendarEventId) {
      return res.status(404).json({
        success: false,
        message: 'No calendar event to update',
      });
    }

    // Get new slot details
    const newSlot = await Slot.findById(newSlotId);
    if (!newSlot) {
      return res.status(404).json({
        success: false,
        message: 'New slot not found',
      });
    }

    // Update interview slot
    interview.slotId = newSlotId;
    await interview.save();

    // Update calendar event
    const updateResult = await googleCalendarService.updateInterviewEvent(
      interview.calendarEventId,
      interview,
      newSlot,
      {
        _id: interview.candidateId._id,
        id: interview.candidateId._id,
        email: interview.candidateId.email,
        name: interview.candidateId.name,
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Calendar event updated successfully',
      data: updateResult,
    });

  } catch (error) {
    console.error('Error updating calendar event:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to update calendar event',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/calendar/interview/:interviewId/delete-event
 * Delete calendar event (when interview is cancelled)
 */
router.delete('/interview/:interviewId/delete-event', requireAuth, async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found',
      });
    }

    // Verify access
    if (interview.candidateId.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete calendar event',
      });
    }

    if (!interview.calendarEventId) {
      return res.status(404).json({
        success: false,
        message: 'No calendar event to delete',
      });
    }

    // Delete calendar event
    const deleteResult = await googleCalendarService.deleteInterviewEvent(
      interview.calendarEventId,
      interviewId,
      reason || 'Interview cancelled by user'
    );

    // Clear calendar event ID from interview
    interview.calendarEventId = undefined;
    interview.calendarEventLink = undefined;
    await interview.save();

    return res.status(200).json({
      success: true,
      message: 'Calendar event deleted successfully',
      data: deleteResult,
    });

  } catch (error) {
    console.error('Error deleting calendar event:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to delete calendar event',
      error: error.message,
    });
  }
});

/**
 * GET /api/calendar/test-connection
 * Test Google Calendar connection (admin only)
 */
router.get('/test-connection', requireAuth, async (req, res) => {
  try {
    // Only admin can test connection
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can test calendar connection',
      });
    }

    const testResult = await googleCalendarService.testConnection();

    return res.status(200).json({
      success: true,
      data: testResult,
    });

  } catch (error) {
    console.error('Error testing calendar connection:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to test calendar connection',
      error: error.message,
    });
  }
});

/**
 * GET /api/calendar/student/events
 * Get all calendar events for student
 */
router.get('/student/events', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all interviews for the student
    const interviews = await Interview.find({ candidateId: userId })
      .populate('slotId')
      .select('_id calendarEventId calendarEventLink meetLink status interviewType slotId')
      .sort({ 'slotId.startTime': 1 });

    // Filter interviews with calendar events
    const calendarEvents = interviews
      .filter(interview => interview.calendarEventId)
      .map(interview => ({
        interviewId: interview._id,
        eventId: interview.calendarEventId,
        eventLink: interview.calendarEventLink,
        meetLink: interview.meetLink,
        status: interview.status,
        interviewType: interview.interviewType,
        startTime: interview.slotId?.startTime,
        endTime: interview.slotId?.endTime,
        timezone: interview.slotId?.timezone,
      }));

    return res.status(200).json({
      success: true,
      data: {
        totalEvents: calendarEvents.length,
        events: calendarEvents,
      },
    });

  } catch (error) {
    console.error('Error getting student calendar events:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to get calendar events',
      error: error.message,
    });
  }
});

export default router;