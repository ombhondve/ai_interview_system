import express from "express";
import {
  getReviewQueue,
  getNextCandidate,
  getReviewData,
  submitDecision,
  requestInformation,
  submitResponse,
  getReviewStatistics,
  getQueueStatus,
  initializeReview,
  reviewHealth
} from "./review.controller.js";

const router = express.Router();

/**
 * Middleware for admin authentication
 */
const requireAdmin = (req, res, next) => {
  // In production, this would check JWT token or session
  const adminId = req.headers['x-admin-id'] || req.user?.id;
  
  if (!adminId) {
    return res.status(401).json({
      success: false,
      error: "Admin authentication required"
    });
  }
  
  req.adminId = adminId;
  next();
};

/**
 * Middleware for candidate authentication (simplified)
 */
const requireCandidate = (req, res, next) => {
  // In production, this would verify the candidate is accessing their own data
  // For now, we'll use a simple token or session check
  const candidateId = req.headers['x-candidate-id'] || req.user?.candidateId;
  
  if (!candidateId) {
    return res.status(401).json({
      success: false,
      error: "Candidate authentication required"
    });
  }
  
  req.candidateId = candidateId;
  next();
};

/**
 * Public endpoints
 */

// Health check
router.get("/health", reviewHealth);

/**
 * Candidate endpoints
 */

// Submit response to information request (candidate only)
router.post("/candidate/:candidateId/response", requireCandidate, submitResponse);

/**
 * Admin endpoints (require admin authentication)
 */

// Get review queue
router.get("/admin/queue", requireAdmin, getReviewQueue);

// Get next candidate for review
router.get("/admin/next", requireAdmin, getNextCandidate);

// Get detailed review data for a candidate
router.get("/admin/candidate/:candidateId", requireAdmin, getReviewData);

// Submit review decision
router.post("/admin/candidate/:candidateId/decision", requireAdmin, submitDecision);

// Request more information from candidate
router.post("/admin/candidate/:candidateId/request-info", requireAdmin, requestInformation);

// Get review statistics
router.get("/admin/statistics", requireAdmin, getReviewStatistics);

// Get queue status
router.get("/admin/queue-status", requireAdmin, getQueueStatus);

/**
 * System endpoints (called by verification system, may require internal auth)
 */

// Initialize admin review (called when AI returns NEEDS_ADMIN_REVIEW)
router.post("/system/initialize", initializeReview);

export default router;