import enhancedBookingService from "./enhancedBooking.service.js";
import logger from "../../utils/logger.js";

/**
 * Enhanced Booking Controller
 * 
 * Provides REST API endpoints for interview booking workflow
 */
class EnhancedBookingController {
  /**
   * Book an interview slot
   */
  async bookInterview(req, res) {
    try {
      const { candidateId, slotId } = req.params;
      const bookingData = req.body;
      
      const result = await enhancedBookingService.bookInterview(
        candidateId, 
        slotId, 
        bookingData
      );
      
      if (result.success) {
        logger.info(`Booking successful for candidate ${candidateId}`);
        
        return res.status(201).json({
          success: true,
          data: {
            interview: result.interview,
            nextStep: result.nextStep,
            message: result.message
          },
          metadata: {
            bookingSessionId: result.interview.bookingMetadata?.bookingSessionId,
            bookedAt: new Date()
          }
        });
      } else {
        logger.warn(`Booking failed for candidate ${candidateId}: ${result.error}`);
        
        return res.status(400).json({
          success: false,
          error: result.error,
          stepFailed: result.stepFailed,
          suggestedAction: this.getSuggestedAction(result.stepFailed)
        });
      }
    } catch (error) {
      logger.error("Booking controller error:", error);
      
      return res.status(500).json({
        success: false,
        error: "Failed to process booking request",
        details: error.message
      });
    }
  }
  
  /**
   * Start interview preparation workflow
   */
  async startPreparation(req, res) {
    try {
      const { interviewId, candidateId } = req.params;
      
      const result = await enhancedBookingService.startPreparation(
        interviewId, 
        candidateId
      );
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: {
            interview: result.interview,
            requirements: result.requirements,
            nextSteps: result.nextSteps
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logger.error("Start preparation controller error:", error);
      
      return res.status(500).json({
        success: false,
        error: "Failed to start preparation workflow",
        details: error.message
      });
    }
  }
  
  /**
   * Update preparation status
   */
  async updatePreparation(req, res) {
    try {
      const { interviewId, candidateId } = req.params;
      const preparationData = req.body;
      
      const result = await enhancedBookingService.updatePreparation(
        interviewId, 
        candidateId, 
        preparationData
      );
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: {
            interview: result.interview,
            preparationComplete: result.preparationComplete,
            nextAction: result.nextAction,
            completionPercentage: result.completionPercentage
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logger.error("Update preparation controller error:", error);
      
      return res.status(500).json({
        success: false,
        error: "Failed to update preparation",
        details: error.message
      });
    }
  }
  
  /**
   * Confirm interview readiness
   */
  async confirmReadiness(req, res) {
    try {
      const { interviewId, candidateId } = req.params;
      
      const result = await enhancedBookingService.confirmReadiness(
        interviewId, 
        candidateId
      );
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: {
            interview: result.interview,
            nextAction: result.nextAction,
            joinWindow: result.joinWindow
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logger.error("Confirm readiness controller error:", error);
      
      return res.status(500).json({
        success: false,
        error: "Failed to confirm readiness",
        details: error.message
      });
    }
  }
  
  /**
   * Reschedule an interview
   */
  async rescheduleInterview(req, res) {
    try {
      const { interviewId, candidateId } = req.params;
      const { newSlotId, reason } = req.body;
      
      if (!newSlotId) {
        return res.status(400).json({
          success: false,
          error: "newSlotId is required"
        });
      }
      
      const result = await enhancedBookingService.rescheduleInterview(
        interviewId, 
        candidateId, 
        newSlotId,
        reason
      );
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: {
            interview: result.interview,
            previousSlot: result.previousSlot,
            newSlot: result.newSlot,
            message: result.message
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logger.error("Reschedule interview controller error:", error);
      
      return res.status(500).json({
        success: false,
        error: "Failed to reschedule interview",
        details: error.message
      });
    }
  }
  
  /**
   * Cancel an interview
   */
  async cancelInterview(req, res) {
    try {
      const { interviewId, candidateId } = req.params;
      const { reason } = req.body;
      
      const result = await enhancedBookingService.cancelInterview(
        interviewId, 
        candidateId, 
        reason
      );
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: {
            interview: result.interview,
            slotFreed: result.slotFreed,
            message: result.message
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logger.error("Cancel interview controller error:", error);
      
      return res.status(500).json({
        success: false,
        error: "Failed to cancel interview",
        details: error.message
      });
    }
  }
  
  /**
   * Get interview status and next steps
   */
  async getInterviewStatus(req, res) {
    try {
      const { interviewId, candidateId } = req.params;
      
      const result = await enhancedBookingService.getInterviewStatus(
        interviewId, 
        candidateId
      );
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logger.error("Get interview status controller error:", error);
      
      return res.status(500).json({
        success: false,
        error: "Failed to get interview status",
        details: error.message
      });
    }
  }
  
  /**
   * Get candidate interview history
   */
  async getCandidateInterviewHistory(req, res) {
    try {
      const { candidateId } = req.params;
      const filters = req.query;
      
      const result = await enhancedBookingService.getCandidateInterviewHistory(
        candidateId, 
        filters
      );
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logger.error("Get interview history controller error:", error);
      
      return res.status(500).json({
        success: false,
        error: "Failed to get interview history",
        details: error.message
      });
    }
  }
  
  /**
   * Get interview statistics for candidate
   */
  async getInterviewStatistics(req, res) {
    try {
      const { candidateId } = req.params;
      
      const result = await enhancedBookingService.getInterviewStatistics(candidateId);
      
      return res.status(200).json({
        success: true,
        data: result
      });
      
    } catch (error) {
      logger.error("Get interview statistics controller error:", error);
      
      return res.status(500).json({
        success: false,
        error: "Failed to get interview statistics",
        details: error.message
      });
    }
  }
  
  /**
   * Helper methods
   */
  getSuggestedAction(stepFailed) {
    const actions = {
      eligibility_check: "Check candidate requirements and try again",
      conflict_detection: "Select a different time slot",
      slot_reservation: "Slot was taken, please select another",
      unknown: "Please try again later"
    };
    
    return actions[stepFailed] || actions.unknown;
  }
}

// Create controller instance
const enhancedBookingController = new EnhancedBookingController();

export default enhancedBookingController;
export { EnhancedBookingController };
