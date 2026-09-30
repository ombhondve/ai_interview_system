import express from "express";

import {
  verifyCandidatePortalTokenController,
  getCurrentStudentController,
  getAssignedProjectController,
  recordProjectDownloadController,
  submitProjectController,
  logoutController,
} from "./student.controller.js";

import { requireVerifiedSession } from "../../middleware/requireVerifiedSession.js";

const router = express.Router();

/**
 * ============================================
 * CANDIDATE INVITATION (PUBLIC)
 * ============================================
 *
 * GET /api/student/invite?token=...
 *
 * Used when a candidate opens the invitation
 * link for the first time.
 */

router.get(
  "/invite",
  verifyCandidatePortalTokenController
);

/**
 * ============================================
 * AUTHENTICATED STUDENT ROUTES
 * ============================================
 *
 * All routes below require verified session
 */

/**
 * CURRENT STUDENT
 *
 * GET /api/student/me
 *
 * Used after the candidate successfully
 * verifies the OTP.
 */

router.get(
  "/me",
  requireVerifiedSession,
  getCurrentStudentController
);

/**
 * ASSIGNED PROJECT
 *
 * GET /api/student/project
 *
 * Returns assigned project with deadline information
 */

router.get(
  "/project",
  requireVerifiedSession,
  getAssignedProjectController
);

/**
 * PROJECT DOWNLOAD
 *
 * POST /api/student/project/download
 *
 * Records project download and starts deadline timer
 */

router.post(
  "/project/download",
  requireVerifiedSession,
  recordProjectDownloadController
);

/**
 * PROJECT SUBMISSION
 *
 * POST /api/student/submit-project
 *
 * Submits project repository URL
 */

router.post(
  "/submit-project",
  requireVerifiedSession,
  submitProjectController
);

/**
 * VERIFICATION STATUS
 *
 * GET /api/student/verification-status
 *
 * Gets verification status for submitted project
 */

router.get(
  "/verification-status",
  requireVerifiedSession,
  async (req, res) => {
    try {
      const candidate = req.candidate;
      
      // Import verification tracker
      const verificationTracker = (await import("../projects/verification.tracker.service.js")).verificationTracker;
      
      const status = await verificationTracker.getVerificationStatus(candidate._id);
      
      res.json({
        success: true,
        data: status
      });
      
    } catch (error) {
      console.error("Error getting verification status:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error.message
      });
    }
  }
);

/**
 * LOGOUT
 *
 * POST /api/student/logout
 *
 * Logs out current student session
 */

router.post(
  "/logout",
  requireVerifiedSession,
  logoutController
);

/**
 * ============================================
 * EXPORT ROUTER
 * ============================================
 */

export default router;