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
import { requireVerifiedSession } from "../../middleware/requireVerifiedSession.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";


const router = express.Router();

/**
 * Middleware for admin authentication
 */
const requireAdmin = [requireAuth, requireRole("superadmin", "recruiter", "admin")];

/**
 * Public endpoints
 */

// Health check
router.get("/health", verificationHealth);

// Get verification status (public for candidates to check their own status)
router.get("/status/:candidateId", requireVerifiedSession, (req, res, next) => {
  if (String(req.candidate._id) !== String(req.params.candidateId)) {
    return res.status(403).json({ success: false, message: "You cannot access this candidate's verification." });
  }
  next();
}, getVerificationStatus);

/**
 * Candidate endpoints (require candidate authentication)
 */

// Start verification (requires candidate auth)
router.post("/start", requireVerifiedSession, (req, res, next) => {
  req.body.candidateId = req.candidate._id.toString();
  req.body.projectId = req.candidate.assignedProjectId?.toString();
  req.body.repositoryUrl = req.candidate.projectSubmission?.url;
  if (!req.body.projectId || !req.body.repositoryUrl) return res.status(400).json({ success: false, message: "No current project submission is available." });
  next();
}, startVerification);

// Cancel verification (requires candidate auth)
router.post("/cancel/:candidateId", requireVerifiedSession, (req, res, next) => {
  if (String(req.candidate._id) !== String(req.params.candidateId)) {
    return res.status(403).json({ success: false, message: "You cannot cancel another candidate's verification." });
  }
  next();
}, cancelVerification);

/**
 * Admin endpoints (require admin authentication)
 */

// Get active verifications
router.get("/admin/active", ...requireAdmin, getActiveVerifications);

// Get verification statistics
router.get("/admin/statistics", ...requireAdmin, getVerificationStatistics);

// Get candidates needing admin review
router.get("/admin/needs-review", ...requireAdmin, getCandidatesNeedingReview);

// Process admin review
router.post("/admin/review/:candidateId", ...requireAdmin, processAdminReview);

// Manual verification (admin override)
router.post("/admin/manual-verify", ...requireAdmin, manualVerification);

// Reset verification (admin only)
router.post("/admin/reset/:candidateId", ...requireAdmin, resetVerification);

// Get all verification data for a candidate
router.get("/admin/candidate/:candidateId", ...requireAdmin, getVerificationStatus);

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