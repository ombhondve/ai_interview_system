import adminReviewWorkflow, { REVIEW_STATUS, FINAL_DECISION } from "./review.workflow.service.js";
import { getCandidatesNeedingAdminReview, updateAdminReview } from "../candidate/verification.storage.service.js";
import logger from "../../utils/logger.js";

/**
 * Admin Review Controller
 * 
 * API endpoints for the NEEDS_ADMIN_REVIEW workflow
 */

/**
 * Get candidates needing admin review
 */
export const getReviewQueue = async (req, res) => {
  try {
    const { status = "pending", priority, page = 1, limit = 20 } = req.query;

    // Get candidates from database
    const result = await getCandidatesNeedingAdminReview({
      page: parseInt(page),
      limit: parseInt(limit)
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Filter by priority if specified
    let candidates = result.candidates;
    if (priority) {
      candidates = candidates.filter(candidate => 
        candidate.projectSubmission?.adminReview?.priority >= parseInt(priority)
      );
    }

    // Get queue status from workflow manager
    const queueStatus = adminReviewWorkflow.getQueueStatus();

    res.json({
      success: true,
      data: {
        candidates,
        queueStatus,
        pagination: result.pagination,
        counts: {
          total: result.pagination.total,
          pending: queueStatus.pending.length,
          inProgress: queueStatus.inProgress.length,
          completed: queueStatus.completed.length
        }
      }
    });

  } catch (error) {
    logger.error("Failed to get review queue:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Get next candidate for review
 */
export const getNextCandidate = async (req, res) => {
  try {
    const reviewerId = req.user?.id || req.headers['x-admin-id'];
    const { priorityThreshold = 3, maxAgeHours = 24 } = req.query;

    if (!reviewerId) {
      return res.status(401).json({
        success: false,
        error: "Admin authentication required"
      });
    }

    const result = await adminReviewWorkflow.getNextCandidateForReview(reviewerId, {
      priorityThreshold: parseInt(priorityThreshold),
      maxAgeHours: parseInt(maxAgeHours),
      reviewerName: req.user?.name || "Admin"
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    if (!result.candidate) {
      return res.json({
        success: true,
        message: "No candidates available for review",
        data: null
      });
    }

    res.json({
      success: true,
      data: {
        candidate: result.candidate,
        verificationData: result.verificationData,
        assignment: result.assignment
      }
    });

  } catch (error) {
    logger.error("Failed to get next candidate:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Get detailed review data for a candidate
 */
export const getReviewData = async (req, res) => {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        error: "Missing candidateId parameter"
      });
    }

    const result = await adminReviewWorkflow.getReviewData(candidateId);

    if (result.error) {
      return res.status(404).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error("Failed to get review data:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Submit review decision
 */
export const submitDecision = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const {
      decision,
      decisionReason,
      reviewerNotes,
      specificIssues = [],
      suggestedImprovements = [],
      allowResubmission = false,
      resubmissionDeadlineDays = 7
    } = req.body;

    const reviewerId = req.user?.id || req.headers['x-admin-id'];

    if (!reviewerId) {
      return res.status(401).json({
        success: false,
        error: "Admin authentication required"
      });
    }

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        error: "Missing candidateId parameter"
      });
    }

    if (!decision || !Object.values(FINAL_DECISION).includes(decision)) {
      return res.status(400).json({
        success: false,
        error: `Invalid decision. Must be one of: ${Object.values(FINAL_DECISION).join(", ")}`
      });
    }

    const result = await adminReviewWorkflow.submitReviewDecision(
      candidateId,
      {
        decision,
        decisionReason,
        reviewerNotes,
        specificIssues,
        suggestedImprovements,
        allowResubmission,
        resubmissionDeadlineDays: parseInt(resubmissionDeadlineDays)
      },
      reviewerId
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: "Review decision submitted successfully",
      data: {
        candidate: result.candidate,
        decision: result.decision
      }
    });

  } catch (error) {
    logger.error("Failed to submit review decision:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Request more information from candidate
 */
export const requestInformation = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const {
      questions = [],
      documentsNeeded = [],
      deadlineDays = 3,
      instructions
    } = req.body;

    const reviewerId = req.user?.id || req.headers['x-admin-id'];

    if (!reviewerId) {
      return res.status(401).json({
        success: false,
        error: "Admin authentication required"
      });
    }

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        error: "Missing candidateId parameter"
      });
    }

    const result = await adminReviewWorkflow.requestMoreInformation(
      candidateId,
      {
        questions,
        documentsNeeded,
        deadlineDays: parseInt(deadlineDays),
        instructions
      },
      reviewerId
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: "Information request sent to candidate",
      data: {
        candidate: result.candidate,
        request: result.request
      }
    });

  } catch (error) {
    logger.error("Failed to request information:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Submit candidate response to info request
 */
export const submitResponse = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const {
      answers = [],
      documents = [],
      notes = ""
    } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        error: "Missing candidateId parameter"
      });
    }

    // In production, this would verify the candidate is submitting for themselves
    // For now, we'll trust the candidateId in the params

    const result = await adminReviewWorkflow.submitCandidateResponse(candidateId, {
      answers,
      documents,
      notes
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: "Response submitted successfully",
      data: {
        candidate: result.candidate,
        response: result.response
      }
    });

  } catch (error) {
    logger.error("Failed to submit candidate response:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Get review statistics
 */
export const getReviewStatistics = async (req, res) => {
  try {
    const { startDate, endDate, reviewerId } = req.query;

    const result = await adminReviewWorkflow.getReviewStatistics({
      startDate,
      endDate,
      reviewerId
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      data: result.statistics
    });

  } catch (error) {
    logger.error("Failed to get review statistics:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Get queue status
 */
export const getQueueStatus = async (req, res) => {
  try {
    const queueStatus = adminReviewWorkflow.getQueueStatus();

    res.json({
      success: true,
      data: queueStatus
    });

  } catch (error) {
    logger.error("Failed to get queue status:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Initialize admin review (called by verification system)
 */
export const initializeReview = async (req, res) => {
  try {
    const { candidateId, verificationResult } = req.body;

    if (!candidateId || !verificationResult) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: candidateId, verificationResult"
      });
    }

    const result = await adminReviewWorkflow.initializeAdminReview(candidateId, verificationResult);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: "Admin review initialized",
      data: {
        candidate: result.candidate,
        reviewReasons: result.reviewReasons,
        priority: result.priority
      }
    });

  } catch (error) {
    logger.error("Failed to initialize admin review:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Health check for review workflow
 */
export const reviewHealth = async (req, res) => {
  try {
    const queueStatus = adminReviewWorkflow.getQueueStatus();
    const stats = await adminReviewWorkflow.getReviewStatistics();

    const health = {
      service: "admin-review-workflow",
      status: "operational",
      timestamp: new Date().toISOString(),
      stats: {
        queue: queueStatus,
        statistics: stats.success ? stats.statistics : null,
        memoryUsage: process.memoryUsage()
      }
    };

    res.json({
      success: true,
      data: health
    });

  } catch (error) {
    logger.error("Review workflow health check failed:", error);
    res.status(500).json({
      success: false,
      service: "admin-review-workflow",
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};