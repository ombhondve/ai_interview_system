import verificationTracker from "./verification.tracker.service.js";
import { verifyProjectSubmission } from "./verification.service.js";
import { storeVerificationResult, getVerificationResult } from "../candidate/verification.storage.service.js";
import logger from "../../utils/logger.js";

/**
 * Verification Controller
 * 
 * API endpoints for verification status tracking and management
 */

/**
 * Start verification for a candidate
 */
export const startVerification = async (req, res) => {
  try {
    const { candidateId, projectId, repositoryUrl } = req.body;

    if (!candidateId || !projectId || !repositoryUrl) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: candidateId, projectId, repositoryUrl"
      });
    }

    logger.info(`Starting verification for candidate ${candidateId}, project ${projectId}`);

    const result = await verificationTracker.startVerification(candidateId, projectId, repositoryUrl);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(202).json({
      success: true,
      message: "Verification started successfully",
      data: {
        candidateId,
        projectId,
        trackingId: result.trackingId,
        startedAt: result.startedAt,
        statusUrl: `/api/verification/status/${candidateId}`
      }
    });

  } catch (error) {
    logger.error("Failed to start verification:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Get verification status for a candidate
 */
export const getVerificationStatus = async (req, res) => {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        error: "Missing candidateId parameter"
      });
    }

    const status = await verificationTracker.getVerificationStatus(candidateId);

    if (status.status === "ERROR" && status.message) {
      return res.status(404).json({
        success: false,
        error: status.message
      });
    }

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error("Failed to get verification status:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Get active verifications
 */
export const getActiveVerifications = async (req, res) => {
  try {
    const active = verificationTracker.getActiveVerifications();

    res.json({
      success: true,
      data: {
        activeVerifications: active,
        totalActive: active.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error("Failed to get active verifications:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Get verification statistics
 */
export const getVerificationStatistics = async (req, res) => {
  try {
    const { startDate, endDate, projectId, status } = req.query;

    const stats = await verificationTracker.getStatistics({
      startDate,
      endDate,
      projectId,
      verificationStatus: status
    });

    if (!stats.success) {
      return res.status(400).json(stats);
    }

    res.json({
      success: true,
      data: stats.report,
      generatedAt: stats.generatedAt
    });

  } catch (error) {
    logger.error("Failed to get verification statistics:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Get candidates needing admin review
 */
export const getCandidatesNeedingReview = async (req, res) => {
  try {
    const { page = 1, limit = 20, sortBy = "projectSubmission.submittedAt", sortOrder = "desc" } = req.query;

    const result = await verificationTracker.getAdminReviewCandidates({
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      data: result.candidates,
      pagination: result.pagination
    });

  } catch (error) {
    logger.error("Failed to get candidates needing admin review:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Process admin review decision
 */
export const processAdminReview = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { status, reviewerNotes, finalDecision, decisionReason } = req.body;
    const adminId = req.user?.id || req.headers['x-admin-id'];

    if (!adminId) {
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

    const result = await verificationTracker.processAdminReview(candidateId, {
      status,
      reviewerNotes,
      finalDecision,
      decisionReason
    }, adminId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: "Admin review processed successfully",
      data: {
        candidate: result.candidate,
        newStatus: result.newStatus
      }
    });

  } catch (error) {
    logger.error("Failed to process admin review:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Cancel verification
 */
export const cancelVerification = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { reason } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        error: "Missing candidateId parameter"
      });
    }

    const result = await verificationTracker.cancelVerification(candidateId, reason);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: "Verification cancelled successfully",
      data: result
    });

  } catch (error) {
    logger.error("Failed to cancel verification:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Reset verification for retry
 */
export const resetVerification = async (req, res) => {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        error: "Missing candidateId parameter"
      });
    }

    const result = await verificationTracker.resetVerification(candidateId);

    res.json({
      success: true,
      message: result.message,
      data: result
    });

  } catch (error) {
    logger.error("Failed to reset verification:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Manual verification endpoint (for testing/admin use)
 */
export const manualVerification = async (req, res) => {
  try {
    const { candidateId, projectId, repositoryUrl } = req.body;

    if (!candidateId || !projectId || !repositoryUrl) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: candidateId, projectId, repositoryUrl"
      });
    }

    logger.info(`Manual verification requested for candidate ${candidateId}`);

    // Execute verification directly
    const verificationResult = await verifyProjectSubmission(candidateId, projectId, repositoryUrl);

    // Store result
    const storageResult = await storeVerificationResult(candidateId, verificationResult);

    if (!storageResult.success) {
      return res.status(400).json(storageResult);
    }

    res.json({
      success: true,
      message: "Manual verification completed",
      data: {
        verificationResult,
        storageResult,
        candidateId,
        projectId,
        completedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error("Failed to perform manual verification:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Health check endpoint
 */
export const verificationHealth = async (req, res) => {
  try {
    const active = verificationTracker.getActiveVerifications();
    const status = {
      service: "verification-tracker",
      status: "operational",
      timestamp: new Date().toISOString(),
      stats: {
        activeVerifications: active.length,
        statusListeners: verificationTracker.statusListeners.size,
        memoryUsage: process.memoryUsage()
      }
    };

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error("Verification health check failed:", error);
    res.status(500).json({
      success: false,
      service: "verification-tracker",
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * WebSocket connection handler
 */
export const handleWebSocketConnection = (socket) => {
  socket.on('subscribe-verification', (candidateId) => {
    // Register for verification events
    const eventHandler = (event) => {
      if (event.candidateId === candidateId) {
        socket.emit('verification-update', event);
      }
    };

    verificationTracker.addStatusListener(eventHandler);

    // Send current status
    verificationTracker.getVerificationStatus(candidateId).then(status => {
      socket.emit('verification-status', status);
    });

    // Clean up on disconnect
    socket.on('disconnect', () => {
      verificationTracker.removeStatusListener(eventHandler);
    });

    logger.debug(`WebSocket client subscribed to verification events for candidate ${candidateId}`);
  });
};