import express from "express";
import {
  startVerification,
  getVerificationStatus,
  getActiveVerifications,
  getVerificationStatistics,
  getCandidatesNeedingReview,
  processAdminReview,
  cancelVerification,
  resetVerification,
  manualVerification,
  verificationHealth,
  handleWebSocketConnection
} from "./verification.controller.js";

import { setupVerificationEventHandlers } from "./verification.events.service.js";

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
 * Public endpoints
 */

// Health check
router.get("/health", verificationHealth);

// Get verification status (public for candidates to check their own status)
router.get("/status/:candidateId", getVerificationStatus);

/**
 * Candidate endpoints (require candidate authentication)
 */

// Start verification (requires candidate auth)
router.post("/start", startVerification);

// Cancel verification (requires candidate auth)
router.post("/cancel/:candidateId", cancelVerification);

/**
 * Admin endpoints (require admin authentication)
 */

// Get active verifications
router.get("/admin/active", requireAdmin, getActiveVerifications);

// Get verification statistics
router.get("/admin/statistics", requireAdmin, getVerificationStatistics);

// Get candidates needing admin review
router.get("/admin/needs-review", requireAdmin, getCandidatesNeedingReview);

// Process admin review
router.post("/admin/review/:candidateId", requireAdmin, processAdminReview);

// Manual verification (admin override)
router.post("/admin/manual-verify", requireAdmin, manualVerification);

// Reset verification (admin only)
router.post("/admin/reset/:candidateId", requireAdmin, resetVerification);

// Get all verification data for a candidate
router.get("/admin/candidate/:candidateId", requireAdmin, getVerificationStatus);

/**
 * WebSocket setup (called from main app)
 */
router.setupWebSocket = (io) => {
  io.on('connection', (socket) => {
    handleWebSocketConnection(socket);
  });
};

/**
 * Setup event handlers (called from main app)
 */
router.setupEventHandlers = (options = {}) => {
  return setupVerificationEventHandlers(options);
};

export default router;