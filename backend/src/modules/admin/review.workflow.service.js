import Candidate from "../candidate/candidate.model.js";
import { getCandidatesNeedingAdminReview, updateAdminReview } from "../candidate/verification.storage.service.js";
import logger from "../../utils/logger.js";

/**
 * Admin Review Workflow Service
 * 
 * Handles the complete NEEDS_ADMIN_REVIEW workflow from AI uncertainty to final decision
 */

const REVIEW_STATUS = {
  PENDING: "pending",
  IN_REVIEW: "in_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  NEEDS_MORE_INFO: "needs_more_info"
};

const FINAL_DECISION = {
  APPROVED: "approved",
  REJECTED: "rejected",
  NEEDS_RESUBMISSION: "needs_resubmission"
};

/**
 * Main workflow manager
 */
class AdminReviewWorkflow {
  constructor() {
    this.reviewQueues = {
      pending: new Set(), // candidateIds pending review
      inProgress: new Map(), // candidateId -> reviewer info
      completed: new Map() // candidateId -> completion data
    };
  }

  /**
   * Initialize candidate for admin review
   */
  async initializeAdminReview(candidateId, verificationResult) {
    try {
      logger.info(`Initializing admin review for candidate ${candidateId}`);
      
      const candidate = await Candidate.findById(candidateId);
      if (!candidate) {
        throw new Error(`Candidate ${candidateId} not found`);
      }

      // Extract review reasons from verification result
      const reviewReasons = this.extractReviewReasons(verificationResult);
      
      // Calculate priority based on verification confidence and issues
      const priority = this.calculateReviewPriority(verificationResult, reviewReasons);
      
      // Initialize admin review section
      const updateData = {
        "projectSubmission.adminReview": {
          status: REVIEW_STATUS.PENDING,
          initializedAt: new Date(),
          reviewReasons,
          priority,
          reviewerNotes: "",
          reviewedBy: null,
          reviewedAt: null,
          finalDecision: null,
          decisionReason: null
        }
      };

      const updatedCandidate = await Candidate.findByIdAndUpdate(
        candidateId,
        { $set: updateData },
        { new: true }
      );

      // Add to pending queue
      this.reviewQueues.pending.add(candidateId);

      logger.info(`Admin review initialized for candidate ${candidateId}, priority: ${priority}`);

      return {
        success: true,
        candidate: updatedCandidate,
        reviewReasons,
        priority
      };

    } catch (error) {
      logger.error(`Failed to initialize admin review for candidate ${candidateId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract reasons why admin review is needed
   */
  extractReviewReasons(verificationResult) {
    const reasons = [];
    const { verificationStatus, confidence, detailedAnalysis } = verificationResult;

    if (verificationStatus === "NEEDS_ADMIN_REVIEW") {
      reasons.push("AI uncertainty - requires human judgment");
    }

    if (confidence && confidence < 0.7) {
      reasons.push(`Low confidence score: ${Math.round(confidence * 100)}%`);
    }

    if (detailedAnalysis?.technicalEvaluation) {
      const { codeQuality, projectOrganization, documentation } = detailedAnalysis.technicalEvaluation;
      
      if (codeQuality === "FAIR" || codeQuality === "POOR") {
        reasons.push(`Code quality issues: ${codeQuality}`);
      }
      
      if (projectOrganization === "FAIR" || projectOrganization === "POOR") {
        reasons.push(`Project organization issues: ${projectOrganization}`);
      }
      
      if (documentation === "FAIR" || documentation === "POOR") {
        reasons.push(`Documentation issues: ${documentation}`);
      }
    }

    if (detailedAnalysis?.requirementsAssessment) {
      const partialReqs = detailedAnalysis.requirementsAssessment.filter(req => req.status === "PARTIAL");
      if (partialReqs.length > 0) {
        reasons.push(`Partial requirements: ${partialReqs.length} requirements partially met`);
      }
    }

    if (detailedAnalysis?.repositoryValidity?.issues?.length > 0) {
      reasons.push(`Repository issues: ${detailedAnalysis.repositoryValidity.issues.length} issues found`);
    }

    return reasons;
  }

  /**
   * Calculate review priority (1-5, 5 being highest)
   */
  calculateReviewPriority(verificationResult, reviewReasons) {
    let priority = 3; // Default medium priority
    
    const { confidence } = verificationResult;

    // Confidence-based priority
    if (confidence < 0.4) priority = 5; // Very uncertain
    else if (confidence < 0.6) priority = 4; // Uncertain
    else if (confidence < 0.8) priority = 3; // Somewhat uncertain

    // Additional factors
    const reasons = reviewReasons.length;
    if (reasons > 3) priority = Math.max(priority, 4);
    if (reasons > 5) priority = 5;

    // Time-based escalation (would be calculated based on how long in queue)
    return priority;
  }

  /**
   * Assign candidate to reviewer
   */
  async assignToReviewer(candidateId, reviewerId, reviewerName) {
    try {
      logger.info(`Assigning candidate ${candidateId} to reviewer ${reviewerName}`);

      // Update database
      const updateData = {
        "projectSubmission.adminReview.status": REVIEW_STATUS.IN_REVIEW,
        "projectSubmission.adminReview.reviewedBy": reviewerId,
        "projectSubmission.adminReview.assignedAt": new Date(),
        "projectSubmission.adminReview.reviewerName": reviewerName
      };

      const updatedCandidate = await Candidate.findByIdAndUpdate(
        candidateId,
        { $set: updateData },
        { new: true }
      );

      // Move from pending to inProgress queue
      this.reviewQueues.pending.delete(candidateId);
      this.reviewQueues.inProgress.set(candidateId, {
        reviewerId,
        reviewerName,
        assignedAt: new Date(),
        candidateId
      });

      logger.info(`Candidate ${candidateId} assigned to reviewer ${reviewerName}`);

      return {
        success: true,
        candidate: updatedCandidate,
        assignment: {
          reviewerId,
          reviewerName,
          assignedAt: new Date()
        }
      };

    } catch (error) {
      logger.error(`Failed to assign candidate ${candidateId} to reviewer:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get next candidate for review
   */
  async getNextCandidateForReview(reviewerId, options = {}) {
    try {
      const { priorityThreshold = 3, maxAgeHours = 24 } = options;

      // Get candidates from database with priority filtering
      const query = {
        "projectSubmissionStatus": "needs_admin_review",
        "projectSubmission.adminReview.status": REVIEW_STATUS.PENDING,
        "projectSubmission.adminReview.priority": { $gte: priorityThreshold }
      };

      // Add time-based filtering if needed
      if (maxAgeHours) {
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);
        query["projectSubmission.adminReview.initializedAt"] = { $lte: cutoffDate };
      }

      const candidate = await Candidate.findOne(query)
        .select("name email phone role projectSubmission assignedProjectId")
        .populate("assignedProjectId", "title description difficulty requirements")
        .sort({
          "projectSubmission.adminReview.priority": -1,
          "projectSubmission.adminReview.initializedAt": 1
        })
        .lean();

      if (!candidate) {
        logger.debug(`No candidates found for review with priority >= ${priorityThreshold}`);
        return {
          success: true,
          candidate: null,
          message: "No candidates available for review"
        };
      }

      // Assign to reviewer
      const assignmentResult = await this.assignToReviewer(
        candidate._id,
        reviewerId,
        options.reviewerName || "Admin"
      );

      if (!assignmentResult.success) {
        return assignmentResult;
      }

      // Get full verification data for review
      const verificationData = await this.getReviewData(candidate._id);

      return {
        success: true,
        candidate: assignmentResult.candidate,
        verificationData,
        assignment: assignmentResult.assignment
      };

    } catch (error) {
      logger.error("Failed to get next candidate for review:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get comprehensive review data
   */
  async getReviewData(candidateId) {
    try {
      const candidate = await Candidate.findById(candidateId)
        .select("projectSubmission")
        .populate("assignedProjectId")
        .lean();

      if (!candidate) {
        throw new Error(`Candidate ${candidateId} not found`);
      }

      const { projectSubmission, assignedProjectId } = candidate;
      const verificationResult = projectSubmission?.aiVerificationResult;

      return {
        candidateId,
        project: assignedProjectId,
        verificationResult,
        submissionDetails: {
          url: projectSubmission?.url,
          submittedAt: projectSubmission?.submittedAt,
          validationStatus: projectSubmission?.validationStatus
        },
        adminReview: projectSubmission?.adminReview,
        verificationStats: projectSubmission?.verificationStats
      };

    } catch (error) {
      logger.error(`Failed to get review data for candidate ${candidateId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Submit review decision
   */
  async submitReviewDecision(candidateId, decisionData, reviewerId) {
    try {
      const {
        decision,
        decisionReason,
        reviewerNotes,
        specificIssues = [],
        suggestedImprovements = [],
        allowResubmission = false,
        resubmissionDeadlineDays = 7
      } = decisionData;

      logger.info(`Submitting review decision for candidate ${candidateId}: ${decision}`);

      // Validate decision
      if (!Object.values(FINAL_DECISION).includes(decision)) {
        throw new Error(`Invalid decision: ${decision}`);
      }

      // Prepare update data
      const updateData = {
        "projectSubmission.adminReview.status": REVIEW_STATUS.APPROVED,
        "projectSubmission.adminReview.reviewerNotes": reviewerNotes || "",
        "projectSubmission.adminReview.finalDecision": decision,
        "projectSubmission.adminReview.decisionReason": decisionReason || "",
        "projectSubmission.adminReview.decisionDetails": {
          specificIssues,
          suggestedImprovements,
          allowResubmission,
          resubmissionDeadlineDays
        },
        "projectSubmission.adminReview.reviewedAt": new Date(),
        "projectSubmission.adminReview.completedAt": new Date()
      };

      // Update candidate status based on decision
      let newSubmissionStatus;
      let newVerificationStatus;

      switch (decision) {
        case FINAL_DECISION.APPROVED:
          newSubmissionStatus = "verified";
          newVerificationStatus = "verified";
          updateData["projectSubmission.adminReview.status"] = REVIEW_STATUS.APPROVED;
          break;

        case FINAL_DECISION.REJECTED:
          newSubmissionStatus = "rejected";
          newVerificationStatus = "rejected";
          updateData["projectSubmission.adminReview.status"] = REVIEW_STATUS.REJECTED;
          break;

        case FINAL_DECISION.NEEDS_RESUBMISSION:
          newSubmissionStatus = "submitted"; // Reset to allow resubmission
          newVerificationStatus = "pending";
          updateData["projectSubmission.adminReview.status"] = REVIEW_STATUS.NEEDS_MORE_INFO;
          
          // Set resubmission deadline if provided
          if (allowResubmission && resubmissionDeadlineDays) {
            const deadline = new Date();
            deadline.setDate(deadline.getDate() + resubmissionDeadlineDays);
            updateData["projectSubmission.adminReview.resubmissionDeadline"] = deadline;
          }
          break;
      }

      updateData["projectSubmissionStatus"] = newSubmissionStatus;
      updateData["projectSubmission.aiVerificationStatus"] = newVerificationStatus;

      // Update candidate
      const updatedCandidate = await Candidate.findByIdAndUpdate(
        candidateId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate("assignedProjectId");

      if (!updatedCandidate) {
        throw new Error(`Candidate ${candidateId} not found`);
      }

      // Update queues
      this.reviewQueues.inProgress.delete(candidateId);
      this.reviewQueues.completed.set(candidateId, {
        decision,
        reviewerId,
        reviewedAt: new Date(),
        candidateId
      });

      // Add to activity log
      await Candidate.findByIdAndUpdate(candidateId, {
        $push: {
          activity: {
            id: `admin_review_${Date.now()}`,
            label: "Admin Review Decision",
            description: `Admin review completed with decision: ${decision}`,
            timestamp: new Date(),
            state: "complete",
            metadata: {
              decision,
              decisionReason,
              reviewerId
            }
          }
        }
      });

      logger.info(`Review decision submitted for candidate ${candidateId}: ${decision}`);

      return {
        success: true,
        candidate: updatedCandidate,
        decision: {
          type: decision,
          reason: decisionReason,
          newStatus: newSubmissionStatus,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error(`Failed to submit review decision for candidate ${candidateId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Request more information from candidate
   */
  async requestMoreInformation(candidateId, requestData, reviewerId) {
    try {
      const {
        questions = [],
        documentsNeeded = [],
        deadlineDays = 3,
        instructions
      } = requestData;

      logger.info(`Requesting more information for candidate ${candidateId}`);

      const deadline = new Date();
      deadline.setDate(deadline.getDate() + deadlineDays);

      const updateData = {
        "projectSubmission.adminReview.status": REVIEW_STATUS.NEEDS_MORE_INFO,
        "projectSubmission.adminReview.infoRequest": {
          requestedAt: new Date(),
          requestedBy: reviewerId,
          questions,
          documentsNeeded,
          instructions: instructions || "Please provide additional information for review",
          deadline,
          responses: []
        },
        "projectSubmission.adminReview.lastAction": "info_requested",
        "projectSubmission.adminReview.lastActionAt": new Date()
      };

      const updatedCandidate = await Candidate.findByIdAndUpdate(
        candidateId,
        { $set: updateData },
        { new: true }
      );

      // Add notification to candidate
      await this.addCandidateNotification(candidateId, {
        type: "info_request",
        message: "Admin has requested additional information for your project review",
        deadline,
        questions,
        instructions
      });

      logger.info(`Information requested for candidate ${candidateId}, deadline: ${deadline}`);

      return {
        success: true,
        candidate: updatedCandidate,
        request: {
          deadline,
          questions,
          documentsNeeded,
          requestedAt: new Date()
        }
      };

    } catch (error) {
      logger.error(`Failed to request more information for candidate ${candidateId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Submit candidate response to info request
   */
  async submitCandidateResponse(candidateId, responseData) {
    try {
      const {
        answers = [],
        documents = [],
        notes = ""
      } = responseData;

      logger.info(`Processing candidate response for ${candidateId}`);

      const candidate = await Candidate.findById(candidateId);
      if (!candidate) {
        throw new Error(`Candidate ${candidateId} not found`);
      }

      const infoRequest = candidate.projectSubmission?.adminReview?.infoRequest;
      if (!infoRequest) {
        throw new Error("No information request found for this candidate");
      }

      // Check if deadline has passed
      if (infoRequest.deadline && new Date() > new Date(infoRequest.deadline)) {
        logger.warn(`Candidate ${candidateId} submitted response after deadline`);
      }

      const response = {
        submittedAt: new Date(),
        answers,
        documents,
        notes,
        isComplete: answers.length >= (infoRequest.questions?.length || 0)
      };

      // Update candidate with response
      const updateData = {
        "projectSubmission.adminReview.infoRequest.responses": [
          ...(infoRequest.responses || []),
          response
        ],
        "projectSubmission.adminReview.lastAction": "response_received",
        "projectSubmission.adminReview.lastActionAt": new Date(),
        "projectSubmission.adminReview.status": REVIEW_STATUS.PENDING // Back to pending for review
      };

      const updatedCandidate = await Candidate.findByIdAndUpdate(
        candidateId,
        { $set: updateData },
        { new: true }
      );

      // Add back to pending queue
      this.reviewQueues.pending.add(candidateId);

      // Notify admin
      await this.addAdminNotification(candidateId, {
        type: "candidate_response",
        message: `Candidate ${candidate.name} has submitted response to information request`,
        candidateId,
        responseId: response.submittedAt.getTime()
      });

      logger.info(`Candidate response processed for ${candidateId}`);

      return {
        success: true,
        candidate: updatedCandidate,
        response: {
          submittedAt: response.submittedAt,
          isComplete: response.isComplete,
          questionCount: infoRequest.questions?.length || 0,
          answerCount: answers.length
        }
      };

    } catch (error) {
      logger.error(`Failed to process candidate response for ${candidateId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get review statistics
   */
  async getReviewStatistics(options = {}) {
    try {
      const {
        startDate,
        endDate,
        reviewerId
      } = options;

      const match = {};

      if (startDate || endDate) {
        match["projectSubmission.adminReview.initializedAt"] = {};
        if (startDate) {
          match["projectSubmission.adminReview.initializedAt"].$gte = new Date(startDate);
        }
        if (endDate) {
          match["projectSubmission.adminReview.initializedAt"].$lte = new Date(endDate);
        }
      }

      if (reviewerId) {
        match["projectSubmission.adminReview.reviewedBy"] = reviewerId;
      }

      // Aggregate statistics
      const stats = await Candidate.aggregate([
        { $match: { ...match, "projectSubmission.adminReview": { $exists: true } } },
        {
          $group: {
            _id: "$projectSubmission.adminReview.status",
            count: { $sum: 1 },
            avgPriority: { $avg: "$projectSubmission.adminReview.priority" },
            avgReviewTimeHours: {
              $avg: {
                $divide: [
                  { $subtract: [
                    "$projectSubmission.adminReview.completedAt",
                    "$projectSubmission.adminReview.initializedAt"
                  ] },
                  1000 * 60 * 60 // Convert ms to hours
                ]
              }
            }
          }
        },
        {
          $project: {
            status: "$_id",
            count: 1,
            avgPriority: { $round: ["$avgPriority", 1] },
            avgReviewTimeHours: { $round: ["$avgReviewTimeHours", 1] }
          }
        }
      ]);

      // Get decision breakdown
      const decisionStats = await Candidate.aggregate([
        { $match: { ...match, "projectSubmission.adminReview.finalDecision": { $exists: true } } },
        {
          $group: {
            _id: "$projectSubmission.adminReview.finalDecision",
            count: { $sum: 1 }
          }
        }
      ]);

      // Get queue counts
      const pendingCount = await Candidate.countDocuments({
        ...match,
        "projectSubmission.adminReview.status": REVIEW_STATUS.PENDING
      });

      const inReviewCount = await Candidate.countDocuments({
        ...match,
        "projectSubmission.adminReview.status": REVIEW_STATUS.IN_REVIEW
      });

      const completedCount = await Candidate.countDocuments({
        ...match,
        "projectSubmission.adminReview.status": { $in: [REVIEW_STATUS.APPROVED, REVIEW_STATUS.REJECTED] }
      });

      return {
        success: true,
        statistics: {
          queue: {
            pending: pendingCount,
            inReview: inReviewCount,
            completed: completedCount,
            total: pendingCount + inReviewCount + completedCount
          },
          statusBreakdown: stats,
          decisionBreakdown: decisionStats,
          memoryQueues: {
            pending: this.reviewQueues.pending.size,
            inProgress: this.reviewQueues.inProgress.size,
            completed: this.reviewQueues.completed.size
          },
          generatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error("Failed to get review statistics:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper: Add candidate notification
   */
  async addCandidateNotification(candidateId, notification) {
    try {
      await Candidate.findByIdAndUpdate(candidateId, {
        $push: {
          activity: {
            id: `notification_${Date.now()}`,
            label: "Notification",
            description: notification.message,
            timestamp: new Date(),
            state: "current",
            metadata: notification
          }
        }
      });
    } catch (error) {
      logger.error(`Failed to add candidate notification for ${candidateId}:`, error);
    }
  }

  /**
   * Helper: Add admin notification
   */
  async addAdminNotification(candidateId, notification) {
    // In a real system, this would notify admins via email, dashboard, etc.
    logger.info(`Admin notification: ${notification.message}`);
    // Could integrate with a notification service here
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      pending: Array.from(this.reviewQueues.pending),
      inProgress: Array.from(this.reviewQueues.inProgress.entries()).map(([id, data]) => ({
        candidateId: id,
        ...data
      })),
      completed: Array.from(this.reviewQueues.completed.entries()).map(([id, data]) => ({
        candidateId: id,
        ...data
      }))
    };
  }
}

// Create singleton instance
const adminReviewWorkflow = new AdminReviewWorkflow();

export default adminReviewWorkflow;
export { REVIEW_STATUS, FINAL_DECISION };