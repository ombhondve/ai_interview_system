import Interview from "./interview.model.js";
import Slot from "../scheduling/slot.model.js";
import Candidate from "../candidate/candidate.model.js";
import enhancedSlotService from "../scheduling/enhancedSlot.service.js";
import calendarIntegrationService from "./calendar.integration.service.js";
import interviewNotificationService from "./notification.service.js";
import logger from "../../utils/logger.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Enhanced Booking Service
 * 
 * Provides comprehensive interview booking workflow with:
 * - Multi-step booking process
 * - Advanced validation and conflict detection
 * - Preparation workflow tracking
 * - Rescheduling and cancellation
 * - Interview lifecycle management
 */

class EnhancedBookingService {
  constructor() {
    this.bookingSteps = [
      "eligibility_check",
      "slot_selection",
      "conflict_detection",
      "booking_confirmation",
      "preparation_start",
      "interview_ready"
    ];
  }

  /**
   * Complete booking workflow
   */
  async bookInterview(candidateId, slotId, bookingData = {}) {
    const session = await Interview.startSession();
    
    try {
      session.startTransaction();
      
      logger.info(`Starting booking workflow for candidate ${candidateId}, slot ${slotId}`);
      
      // Step 1: Check eligibility
      const eligibility = await enhancedSlotService.checkCandidateEligibility(slotId, candidateId);
      
      if (!eligibility.eligible) {
        throw new Error(`Candidate not eligible: ${eligibility.failedChecks.join(", ")}`);
      }
      
      // Step 2: Detect conflicts
      const conflicts = await enhancedSlotService.detectConflicts(slotId, candidateId);
      
      if (conflicts.hasConflicts) {
        throw new Error(`Booking conflicts detected: ${conflicts.conflicts.map(c => c.type).join(", ")}`);
      }
      
      // Step 3: Get slot and candidate
      const slot = await Slot.findById(slotId).session(session);
      const candidate = await Candidate.findById(candidateId).session(session);
      
      if (!slot || !candidate) {
        throw new Error("Slot or candidate not found");
      }
      
      // Step 4: Reserve slot (atomic update)
      const updatedSlot = await Slot.findOneAndUpdate(
        {
          _id: slotId,
          status: "open",
          bookedCount: { $lt: slot.capacity }
        },
        {
          $inc: { bookedCount: 1 },
          $set: { 
            status: slot.capacity === 1 ? "booked" : "open",
            bookedBy: slot.capacity === 1 ? candidateId : null
          }
        },
        { 
          new: true,
          session 
        }
      );
      
      if (!updatedSlot) {
        throw new Error("Slot not available or already booked");
      }
      
      // Step 5: Create interview record
      const interview = new Interview({
        candidateId,
        slotId,
        status: "scheduled",
        bookingMetadata: {
          bookedAt: new Date(),
          bookingSource: bookingData.source || "portal",
          ipAddress: bookingData.ipAddress,
          userAgent: bookingData.userAgent,
          bookingSessionId: uuidv4()
        },
        preparationStatus: {
          profileComplete: candidate.profileComplete || false,
          readinessScore: 0
        },
        interviewType: bookingData.interviewType || "ai",
        aiConfig: bookingData.aiConfig || {
          difficulty: "intermediate",
          duration: 30
        },
        metadata: {
          source: "portal",
          tags: ["new_booking"]
        },
        timeline: [{
          event: "booking_initiated",
          initiatedBy: "candidate",
          data: { slotId, candidateId }
        }]
      });
      
      await interview.save({ session });
      
      // Step 6: Update candidate
      candidate.bookedSlotId = slotId;
      candidate.interviewStatus = "scheduled";
      candidate.interviewBookedAt = new Date();
      candidate.projectSubmissionStatus = "verified"; // Mark as ready for interview
      
      await candidate.save({ session });
      
      // Step 7: Add booking confirmation to timeline
      interview.addTimelineEvent("booking_confirmed", "system", {
        slotDetails: {
          startTime: slot.startTime,
          endTime: slot.endTime,
          timezone: slot.timezone
        }
      });
      
      await interview.save({ session });
      
      // Commit transaction
      await session.commitTransaction();
      
      logger.info(`Booking completed successfully for candidate ${candidateId}, interview ${interview._id}`);
      
      // Step 8: Create calendar event (outside transaction for async processing)
      try {
        const calendarResult = await calendarIntegrationService.createInterviewEvent(
          interview, 
          slot, 
          candidate
        );
        
        if (calendarResult.success && calendarResult.eventId) {
          // Update interview with calendar event ID
          await Interview.findByIdAndUpdate(interview._id, {
            $set: {
              'calendarEventId': calendarResult.eventId,
              'metadata.calendarIntegration': {
                integrated: true,
                eventId: calendarResult.eventId,
                integratedAt: new Date()
              }
            }
          });
          
          // Send calendar invite to candidate
          if (candidate.email) {
            await calendarIntegrationService.sendCalendarInvite(
              calendarResult.eventId,
              candidate.email,
              candidate.name
            );
          }
          
          logger.info(`Calendar event created for interview ${interview._id}: ${calendarResult.eventId}`);
        } else {
          logger.warn(`Calendar event creation failed or skipped for interview ${interview._id}`);
        }
      } catch (calendarError) {
        // Don't fail the booking if calendar integration fails
        logger.error(`Calendar integration error for interview ${interview._id}:`, calendarError);
      }
      
      // Populate references for response
      const populatedInterview = await Interview.findById(interview._id)
        .populate("slotId", "startTime endTime timezone location meetLink")
        .populate("candidateId", "name email phone role")
        .lean();
      
      // Send booking confirmation notification
      try {
        await interviewNotificationService.sendBookingConfirmation(
          populatedInterview,
          slot,
          candidate
        );
        logger.info(`Booking confirmation notification sent for interview ${populatedInterview._id}`);
      } catch (notificationError) {
        // Don't fail booking if notification fails
        logger.error(`Booking notification error for interview ${populatedInterview._id}:`, notificationError);
      }
      
      return {
        success: true,
        interview: populatedInterview,
        bookingSteps: this.bookingSteps,
        nextStep: "preparation_start",
        message: "Interview booked successfully. Please complete preparation steps."
      };
      
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Booking failed for candidate ${candidateId}:`, error);
      
      return {
        success: false,
        error: error.message,
        stepFailed: this.determineFailedStep(error.message)
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Start preparation workflow
   */
  async startPreparation(interviewId, candidateId) {
    try {
      const interview = await Interview.findOne({
        _id: interviewId,
        candidateId,
        status: "scheduled"
      });
      
      if (!interview) {
        throw new Error("Interview not found or not in scheduled status");
      }
      
      // Update status to indicate preparation started
      interview.status = "pending_preparation";
      interview.addTimelineEvent("preparation_started", "candidate");
      
      await interview.save();
      
      // Get preparation requirements from slot
      const slot = await Slot.findById(interview.slotId);
      const requirements = slot?.requirements || {};
      
      logger.info(`Preparation started for interview ${interviewId}`);
      
      // Get candidate for notification
      const candidate = await Candidate.findById(candidateId);
      
      // Send preparation started notification
      try {
        await interviewNotificationService.sendPreparationStarted(
          interview,
          candidate,
          requirements
        );
        logger.info(`Preparation started notification sent for interview ${interviewId}`);
      } catch (notificationError) {
        logger.error(`Preparation notification error for interview ${interviewId}:`, notificationError);
      }
      
      return {
        success: true,
        interview,
        requirements: {
          documents: requirements.requiredDocuments || [],
          profileComplete: requirements.completedProfile || false,
          testRequired: true // Default to true for now
        },
        nextSteps: this.getPreparationSteps(requirements)
      };
      
    } catch (error) {
      logger.error(`Failed to start preparation for interview ${interviewId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update preparation status
   */
  async updatePreparation(interviewId, candidateId, preparationData) {
    try {
      const interview = await Interview.findOne({
        _id: interviewId,
        candidateId,
        status: { $in: ["scheduled", "pending_preparation"] }
      });
      
      if (!interview) {
        throw new Error("Interview not found or not in preparation phase");
      }
      
      // Update preparation status
      if (preparationData.documentsSubmitted) {
        interview.preparationStatus.documentsSubmitted = preparationData.documentsSubmitted;
      }
      
      if (preparationData.profileComplete !== undefined) {
        interview.preparationStatus.profileComplete = preparationData.profileComplete;
      }
      
      if (preparationData.testCompleted !== undefined) {
        interview.preparationStatus.testCompleted = preparationData.testCompleted;
      }
      
      if (preparationData.readinessScore !== undefined) {
        interview.preparationStatus.readinessScore = preparationData.readinessScore;
      }
      
      interview.preparationStatus.lastPreparationCheck = new Date();
      
      if (preparationData.notes) {
        interview.preparationStatus.preparationNotes = preparationData.notes;
      }
      
      // Check if preparation is complete
      const isComplete = interview.preparationComplete;
      
      if (isComplete) {
        interview.status = "ready";
        interview.addTimelineEvent("preparation_completed", "candidate", {
          readinessScore: interview.preparationStatus.readinessScore
        });
      } else {
        interview.addTimelineEvent("preparation_updated", "candidate", {
          documentsCount: interview.preparationStatus.documentsSubmitted?.length || 0,
          testCompleted: interview.preparationStatus.testCompleted,
          readinessScore: interview.preparationStatus.readinessScore
        });
      }
      
      await interview.save();
      
      logger.info(`Preparation updated for interview ${interviewId}, complete: ${isComplete}`);
      
      // Send notification if preparation is complete
      if (isComplete) {
        try {
          const candidate = await Candidate.findById(candidateId);
          const readinessScore = interview.preparationStatus?.readinessScore || 0;
          
          await interviewNotificationService.sendPreparationComplete(
            interview,
            candidate,
            readinessScore
          );
          logger.info(`Preparation complete notification sent for interview ${interviewId}`);
        } catch (notificationError) {
          logger.error(`Preparation complete notification error for interview ${interviewId}:`, notificationError);
        }
      }
      
      return {
        success: true,
        interview,
        preparationComplete: isComplete,
        nextAction: isComplete ? "confirm_readiness" : "continue_preparation",
        completionPercentage: this.calculateCompletionPercentage(interview)
      };
      
    } catch (error) {
      logger.error(`Failed to update preparation for interview ${interviewId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Confirm interview readiness
   */
  async confirmReadiness(interviewId, candidateId) {
    try {
      const interview = await Interview.findOne({
        _id: interviewId,
        candidateId,
        status: "ready"
      });
      
      if (!interview) {
        throw new Error("Interview not found or not ready for confirmation");
      }
      
      // Check if interview is within confirmation window
      const slot = await Slot.findById(interview.slotId);
      const now = new Date();
      const hoursUntilStart = (slot.startTime - now) / (1000 * 60 * 60);
      
      if (hoursUntilStart < 1) {
        throw new Error("Cannot confirm readiness less than 1 hour before interview");
      }
      
      // Update status to confirmed
      interview.status = "confirmed";
      interview.addTimelineEvent("readiness_confirmed", "candidate", {
        confirmedAt: new Date(),
        hoursUntilStart: Math.round(hoursUntilStart * 10) / 10
      });
      
      await interview.save();
      
      logger.info(`Readiness confirmed for interview ${interviewId}`);
      
      // Send readiness confirmed notification
      try {
        const candidate = await Candidate.findById(candidateId);
        const joinWindow = {
          opens: new Date(slot.startTime.getTime() - (slot.bufferTime?.before || 5) * 60 * 1000),
          closes: new Date(slot.startTime.getTime() + (slot.bufferTime?.after || 5) * 60 * 1000)
        };
        
        await interviewNotificationService.sendReadinessConfirmed(
          interview,
          candidate,
          joinWindow
        );
        logger.info(`Readiness confirmed notification sent for interview ${interviewId}`);
      } catch (notificationError) {
        logger.error(`Readiness notification error for interview ${interviewId}:`, notificationError);
      }
      
      return {
        success: true,
        interview,
        nextAction: "join_interview",
        joinWindow: {
          opens: new Date(slot.startTime.getTime() - (slot.bufferTime?.before || 5) * 60 * 1000),
          closes: new Date(slot.startTime.getTime() + (slot.bufferTime?.after || 5) * 60 * 1000)
        }
      };
      
    } catch (error) {
      logger.error(`Failed to confirm readiness for interview ${interviewId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Reschedule interview
   */
  async rescheduleInterview(interviewId, candidateId, newSlotId, reason) {
    const session = await Interview.startSession();
    
    try {
      session.startTransaction();
      
      // Get current interview
      const interview = await Interview.findOne({
        _id: interviewId,
        candidateId,
        status: { $in: ["scheduled", "pending_preparation", "ready"] }
      }).session(session);
      
      if (!interview) {
        throw new Error("Interview not found or cannot be rescheduled");
      }
      
      // Check if rescheduling is allowed
      if (!interview.canReschedule()) {
        throw new Error("Rescheduling not allowed for this interview");
      }
      
      // Get current and new slots
      const currentSlot = await Slot.findById(interview.slotId).session(session);
      const newSlot = await Slot.findById(newSlotId).session(session);
      
      if (!currentSlot || !newSlot) {
        throw new Error("One or both slots not found");
      }
      
      // Check eligibility for new slot
      const eligibility = await enhancedSlotService.checkCandidateEligibility(newSlotId, candidateId);
      if (!eligibility.eligible) {
        throw new Error(`Not eligible for new slot: ${eligibility.failedChecks.join(", ")}`);
      }
      
      // Check conflicts for new slot
      const conflicts = await enhancedSlotService.detectConflicts(newSlotId, candidateId);
      if (conflicts.hasConflicts) {
        throw new Error(`Conflicts with new slot: ${conflicts.conflicts.map(c => c.type).join(", ")}`);
      }
      
      // Free up current slot
      const freedSlot = await Slot.findOneAndUpdate(
        { _id: currentSlot._id },
        {
          $inc: { bookedCount: -1 },
          $set: { 
            status: "open",
            bookedBy: null
          }
        },
        { new: true, session }
      );
      
      if (!freedSlot) {
        throw new Error("Failed to free current slot");
      }
      
      // Reserve new slot
      const reservedSlot = await Slot.findOneAndUpdate(
        {
          _id: newSlotId,
          status: "open",
          bookedCount: { $lt: newSlot.capacity }
        },
        {
          $inc: { bookedCount: 1 },
          $set: { 
            status: newSlot.capacity === 1 ? "booked" : "open",
            bookedBy: newSlot.capacity === 1 ? candidateId : null
          }
        },
        { new: true, session }
      );
      
      if (!reservedSlot) {
        throw new Error("New slot not available");
      }
      
      // Update interview
      interview.slotId = newSlotId;
      interview.status = "rescheduled";
      
      // Add to reschedule history
      if (!interview.rescheduleHistory) {
        interview.rescheduleHistory = [];
      }
      
      interview.rescheduleHistory.push({
        fromSlot: currentSlot._id,
        toSlot: newSlotId,
        reason: reason || "Candidate requested",
        requestedBy: "candidate",
        timestamp: new Date()
      });
      
      interview.addTimelineEvent("interview_rescheduled", "candidate", {
        fromSlot: currentSlot._id,
        toSlot: newSlotId,
        reason
      });
      
      await interview.save({ session });
      
      // Update candidate
      const candidate = await Candidate.findById(candidateId).session(session);
      if (candidate) {
        candidate.bookedSlotId = newSlotId;
        await candidate.save({ session });
      }
      
      await session.commitTransaction();
      
      logger.info(`Interview ${interviewId} rescheduled from ${currentSlot._id} to ${newSlotId}`);
      
      // Update calendar event with new time
      try {
        const calendarEventId = interview.calendarEventId || interview.metadata?.calendarIntegration?.eventId;
        const candidate = await Candidate.findById(candidateId);
        
        if (calendarEventId && candidate) {
          const calendarResult = await calendarIntegrationService.updateInterviewEvent(
            interviewId,
            calendarEventId,
            reservedSlot,
            candidate
          );
          
          if (calendarResult.success) {
            logger.info(`Calendar event updated for rescheduled interview ${interviewId}`);
            
            // Send updated invite
            if (candidate.email) {
              await calendarIntegrationService.sendCalendarInvite(
                calendarEventId,
                candidate.email,
                candidate.name
              );
            }
          } else {
            logger.warn(`Calendar event update failed for rescheduled interview ${interviewId}`);
          }
        }
      } catch (calendarError) {
        // Don't fail rescheduling if calendar integration fails
        logger.error(`Calendar integration error for rescheduled interview ${interviewId}:`, calendarError);
      }
      
      // Send rescheduling notification
      try {
        const candidate = await Candidate.findById(candidateId);
        if (candidate) {
          await interviewNotificationService.sendReschedulingNotification(
            interview,
            candidate,
            currentSlot,
            reservedSlot,
            reason
          );
          logger.info(`Rescheduling notification sent for interview ${interviewId}`);
        }
      } catch (notificationError) {
        logger.error(`Rescheduling notification error for interview ${interviewId}:`, notificationError);
      }
      
      return {
        success: true,
        interview,
        previousSlot: currentSlot,
        newSlot: reservedSlot,
        message: "Interview rescheduled successfully"
      };
      
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Failed to reschedule interview ${interviewId}:`, error);
      
      return {
        success: false,
        error: error.message
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Cancel interview
   */
  async cancelInterview(interviewId, candidateId, reason) {
    const session = await Interview.startSession();
    
    try {
      session.startTransaction();
      
      // Get interview
      const interview = await Interview.findOne({
        _id: interviewId,
        candidateId,
        status: { $in: ["scheduled", "pending_preparation", "ready", "confirmed"] }
      }).session(session);
      
      if (!interview) {
        throw new Error("Interview not found or cannot be cancelled");
      }
      
      // Check if cancellation is allowed
      if (!interview.canCancel()) {
        throw new Error("Cancellation not allowed for this interview");
      }
      
      // Get slot
      const slot = await Slot.findById(interview.slotId).session(session);
      
      if (!slot) {
        throw new Error("Associated slot not found");
      }
      
      // Free up slot
      const updatedSlot = await Slot.findOneAndUpdate(
        { _id: slot._id },
        {
          $inc: { bookedCount: -1 },
          $set: { 
            status: "open",
            bookedBy: null
          }
        },
        { new: true, session }
      );
      
      if (!updatedSlot) {
        throw new Error("Failed to free slot");
      }
      
      // Update interview
      interview.status = "cancelled";
      interview.cancellationData = {
        cancelledAt: new Date(),
        cancelledBy: "candidate",
        reason: reason || "Candidate requested",
        refundStatus: "not_applicable"
      };
      
      interview.addTimelineEvent("interview_cancelled", "candidate", { reason });
      
      await interview.save({ session });
      
      // Update candidate
      const candidate = await Candidate.findById(candidateId).session(session);
      if (candidate) {
        candidate.bookedSlotId = null;
        candidate.interviewStatus = "cancelled";
        await candidate.save({ session });
      }
      
      await session.commitTransaction();
      
      logger.info(`Interview ${interviewId} cancelled`);
      
      // Delete calendar event
      try {
        const calendarEventId = interview.calendarEventId || interview.metadata?.calendarIntegration?.eventId;
        
        if (calendarEventId) {
          const calendarResult = await calendarIntegrationService.deleteInterviewEvent(
            calendarEventId,
            interviewId,
            reason || "Interview cancelled"
          );
          
          if (calendarResult.success) {
            logger.info(`Calendar event deleted for cancelled interview ${interviewId}`);
          } else {
            logger.warn(`Calendar event deletion failed for cancelled interview ${interviewId}`);
          }
        }
      } catch (calendarError) {
        // Don't fail cancellation if calendar integration fails
        logger.error(`Calendar integration error for cancelled interview ${interviewId}:`, calendarError);
      }
      
      // Send cancellation notification
      try {
        const candidate = await Candidate.findById(candidateId);
        if (candidate) {
          await interviewNotificationService.sendCancellationNotification(
            interview,
            candidate,
            reason
          );
          logger.info(`Cancellation notification sent for interview ${interviewId}`);
        }
      } catch (notificationError) {
        logger.error(`Cancellation notification error for interview ${interviewId}:`, notificationError);
      }
      
      return {
        success: true,
        interview,
        slotFreed: updatedSlot,
        message: "Interview cancelled successfully"
      };
      
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Failed to cancel interview ${interviewId}:`, error);
      
      return {
        success: false,
        error: error.message
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Get interview status and next steps
   */
  async getInterviewStatus(interviewId, candidateId) {
    try {
      const interview = await Interview.findOne({
        _id: interviewId,
        candidateId
      })
      .populate("slotId", "startTime endTime timezone location meetLink bufferTime")
      .populate("candidateId", "name email phone role")
      .lean();
      
      if (!interview) {
        throw new Error("Interview not found");
      }
      
      const slot = interview.slotId;
      const now = new Date();
      
      // Calculate time until interview
      const timeUntilStart = slot.startTime - now;
      const hoursUntilStart = timeUntilStart / (1000 * 60 * 60);
      
      // Determine interview phase
      const phase = this.determineInterviewPhase(interview, hoursUntilStart);
      
      // Get next actions
      const nextActions = this.getNextActions(interview, phase);
      
      // Get preparation progress
      const preparationProgress = this.calculateCompletionPercentage(interview);
      
      return {
        success: true,
        interview,
        phase,
        timeline: {
          currentTime: now,
          interviewStart: slot.startTime,
          interviewEnd: slot.endTime,
          timeUntilStart: Math.max(0, timeUntilStart),
          hoursUntilStart: Math.max(0, hoursUntilStart),
          formattedTimeUntil: this.formatTimeUntil(slot.startTime)
        },
        preparation: {
          progress: preparationProgress,
          complete: interview.preparationComplete,
          requirements: this.getRemainingRequirements(interview)
        },
        nextActions,
        joinInstructions: this.getJoinInstructions(interview, slot)
      };
      
    } catch (error) {
      logger.error(`Failed to get interview status for ${interviewId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get candidate's interview history
   */
  async getCandidateInterviewHistory(candidateId, filters = {}) {
    try {
      const { status, limit = 20, offset = 0, sortBy = "-bookingMetadata.bookedAt" } = filters;
      
      const query = { candidateId };
      
      if (status) {
        query.status = status;
      }
      
      const interviews = await Interview.find(query)
        .populate("slotId", "startTime endTime timezone location")
        .sort(sortBy)
        .skip(offset)
        .limit(limit)
        .lean();
      
      const total = await Interview.countDocuments(query);
      
      // Enrich with status summaries
      const enrichedInterviews = interviews.map(interview => ({
        ...interview,
        summary: this.getInterviewSummary(interview),
        canReschedule: this.canRescheduleInterview(interview),
        canCancel: this.canCancelInterview(interview)
      }));
      
      return {
        success: true,
        interviews: enrichedInterviews,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + interviews.length < total
        },
        statistics: await this.getInterviewStatistics(candidateId)
      };
      
    } catch (error) {
      logger.error(`Failed to get interview history for candidate ${candidateId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper methods
   */
  
  determineFailedStep(errorMessage) {
    if (errorMessage.includes("not eligible")) return "eligibility_check";
    if (errorMessage.includes("conflicts")) return "conflict_detection";
    if (errorMessage.includes("not available")) return "slot_reservation";
    return "unknown";
  }
  
  getPreparationSteps(requirements) {
    const steps = [];
    
    if (requirements.requiredDocuments && requirements.requiredDocuments.length > 0) {
      steps.push({
        id: "upload_documents",
        title: "Upload Required Documents",
        description: `Upload ${requirements.requiredDocuments.join(", ")}`,
        required: true
      });
    }
    
    if (requirements.completedProfile) {
      steps.push({
        id: "complete_profile",
        title: "Complete Your Profile",
        description: "Ensure all profile information is up to date",
        required: true
      });
    }
    
    steps.push({
      id: "take_preparation_test",
      title: "Take Preparation Test",
      description: "Complete a short test to assess readiness",
      required: true
    });
    
    steps.push({
      id: "review_materials",
      title: "Review Interview Materials",
      description: "Go through interview guidelines and tips",
      required: false
    });
    
    return steps;
  }
  
  calculateCompletionPercentage(interview) {
    const slot = interview.populated('slotId') || interview.slotId;
    if (!slot || !slot.requirements) return 0;
    
    const { requiredDocuments, completedProfile } = slot.requirements;
    const docsSubmitted = interview.preparationStatus?.documentsSubmitted || [];
    
    let progress = 0;
    let totalSteps = 3; // documents, profile, test
    
    // Documents progress
    if (requiredDocuments && requiredDocuments.length > 0) {
      const docsComplete = requiredDocuments.every(doc => docsSubmitted.includes(doc));
      progress += docsComplete ? 33 : (docsSubmitted.length / requiredDocuments.length) * 33;
    } else {
      totalSteps--;
    }
    
    // Profile progress
    if (completedProfile) {
      progress += interview.preparationStatus?.profileComplete ? 33 : 0;
    } else {
      totalSteps--;
    }
    
    // Test progress
    progress += interview.preparationStatus?.testCompleted ? 33 : 0;
    
    // Adjust for variable total steps
    if (totalSteps < 3) {
      progress = progress * (3 / totalSteps);
    }
    
    return Math.min(100, Math.round(progress));
  }
  
  determineInterviewPhase(interview, hoursUntilStart) {
    if (interview.status === "cancelled") return "cancelled";
    if (interview.status === "completed") return "completed";
    if (interview.status === "no_show") return "no_show";
    
    if (hoursUntilStart <= 0) {
      if (interview.status === "in_progress") return "in_progress";
      if (interview.status === "confirmed") return "starting_soon";
      return "missed";
    }
    
    if (hoursUntilStart <= 1) return "starting_soon";
    if (hoursUntilStart <= 24) return "upcoming";
    
    return "scheduled";
  }
  
  getNextActions(interview, phase) {
    const actions = [];
    
    switch (phase) {
      case "scheduled":
      case "upcoming":
        if (!interview.preparationComplete) {
          actions.push({ id: "complete_preparation", label: "Complete Preparation", priority: "high" });
        } else if (interview.status === "scheduled") {
          actions.push({ id: "confirm_readiness", label: "Confirm Readiness", priority: "medium" });
        }
        if (interview.canReschedule()) {
          actions.push({ id: "reschedule", label: "Reschedule Interview", priority: "low" });
        }
        if (interview.canCancel()) {
          actions.push({ id: "cancel", label: "Cancel Interview", priority: "low" });
        }
        break;
        
      case "starting_soon":
        actions.push({ id: "join_interview", label: "Join Interview", priority: "high" });
        break;
        
      case "completed":
        if (!interview.feedback?.candidateRating) {
          actions.push({ id: "submit_feedback", label: "Submit Feedback", priority: "medium" });
        }
        break;
        
      case "cancelled":
        actions.push({ id: "book_new", label: "Book New Interview", priority: "high" });
        break;
    }
    
    return actions;
  }
  
  getRemainingRequirements(interview) {
    const slot = interview.populated('slotId') || interview.slotId;
    if (!slot || !slot.requirements) return [];
    
    const { requiredDocuments, completedProfile } = slot.requirements;
    const docsSubmitted = interview.preparationStatus?.documentsSubmitted || [];
    
    const remaining = [];
    
    if (requiredDocuments && requiredDocuments.length > 0) {
      const missingDocs = requiredDocuments.filter(doc => !docsSubmitted.includes(doc));
      if (missingDocs.length > 0) {
        remaining.push(`Upload documents: ${missingDocs.join(", ")}`);
      }
    }
    
    if (completedProfile && !interview.preparationStatus?.profileComplete) {
      remaining.push("Complete profile information");
    }
    
    if (!interview.preparationStatus?.testCompleted) {
      remaining.push("Complete preparation test");
    }
    
    return remaining;
  }
  
  getJoinInstructions(interview, slot) {
    return {
      link: slot.meetLink || "Will be provided before interview",
      joinWindow: {
        opens: new Date(slot.startTime.getTime() - (slot.bufferTime?.before || 5) * 60 * 1000),
        closes: new Date(slot.startTime.getTime() + (slot.bufferTime?.after || 5) * 60 * 1000)
      },
      preparationTime: slot.preparationTime || 0,
      requirements: [
        "Stable internet connection",
        "Webcam and microphone",
        "Quiet environment",
        "Government ID for verification"
      ]
    };
  }
  
  formatTimeUntil(date) {
    const now = new Date();
    const diff = date - now;
    
    if (diff <= 0) return "Now";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
  
  getInterviewSummary(interview) {
    const statusLabels = {
      scheduled: "Scheduled",
      confirmed: "Confirmed",
      in_progress: "In Progress",
      completed: "Completed",
      cancelled: "Cancelled",
      rescheduled: "Rescheduled",
      no_show: "No Show",
      failed: "Failed"
    };
    
    return {
      status: statusLabels[interview.status] || interview.status,
      date: interview.slotId?.startTime ? new Date(interview.slotId.startTime).toLocaleDateString() : "N/A",
      time: interview.slotId?.startTime ? new Date(interview.slotId.startTime).toLocaleTimeString() : "N/A",
      type: interview.interviewType?.toUpperCase() || "AI",
      score: interview.feedback?.overallScore || "Pending"
    };
  }
  
  canRescheduleInterview(interview) {
    if (["cancelled", "completed", "no_show", "failed"].includes(interview.status)) {
      return false;
    }
    
    const slot = interview.populated('slotId') || interview.slotId;
    if (!slot || !slot.startTime) return false;
    
    const now = new Date();
    const hoursUntilStart = (slot.startTime - now) / (1000 * 60 * 60);
    
    return hoursUntilStart > 24; // Can reschedule up to 24 hours before
  }
  
  canCancelInterview(interview) {
    if (["cancelled", "completed", "no_show", "failed"].includes(interview.status)) {
      return false;
    }
    
    const slot = interview.populated('slotId') || interview.slotId;
    if (!slot || !slot.startTime) return false;
    
    const now = new Date();
    const hoursUntilStart = (slot.startTime - now) / (1000 * 60 * 60);
    
    return hoursUntilStart > 24; // Can cancel up to 24 hours before
  }
  
  async getInterviewStatistics(candidateId) {
    const stats = await Interview.aggregate([
      { $match: { candidateId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          avgScore: { $avg: "$feedback.overallScore" }
        }
      }
    ]);
    
    const total = stats.reduce((sum, stat) => sum + stat.count, 0);
    const completed = stats.find(stat => stat._id === "completed")?.count || 0;
    const avgScore = stats.find(stat => stat._id === "completed")?.avgScore || 0;
    
    return {
      totalInterviews: total,
      completed: completed,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      averageScore: Math.round(avgScore * 10) / 10,
      statusBreakdown: stats
    };
  }
}

// Create singleton instance
const enhancedBookingService = new EnhancedBookingService();

export default enhancedBookingService;
export { EnhancedBookingService };