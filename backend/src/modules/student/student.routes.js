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
 * Gets verification status with PERSISTED AI VERIFICATION RESULT
 */

router.get(
  "/verification-status",
  requireVerifiedSession,
  async (req, res) => {
    try {
      const candidate = req.candidate;
      
      // Import verification storage service to get PERSISTED result
      const { getVerificationResult } = await import("../candidate/verification.storage.service.js");
      const { verificationTracker } = await import("../projects/verification.tracker.service.js");
      
      const verificationData = await getVerificationResult(candidate._id);
      
      if (!verificationData.success) {
        return res.status(500).json({
          success: false,
          error: verificationData.error || "Failed to load verification data"
        });
      }
      
      // Format response with PERSISTED AI verification result.
      //
      // Eligibility is derived from the FULL persisted candidate document, so a
      // VERIFIED student is never shown "Under Review".
      const { deriveVerificationState } = await import("../projects/verificationState.js");

      const verification = deriveVerificationState({
        status: candidate.status,
        rejectionReason: candidate.rejectionReason,
        assignedProjectId: candidate.assignedProjectId,
        bookedSlotId: candidate.bookedSlotId,
        interviewStatus: candidate.interviewStatus,
        interviewDate: candidate.interviewDate,
        projectSubmissionStatus:
          verificationData.submissionStatus ||
          candidate.projectSubmissionStatus,
        projectSubmission: {
          url:
            candidate.projectSubmission?.url ||
            verificationData.verificationResult?.verificationMetadata?.repositoryUrl,
          aiVerificationStatus:
            candidate.projectSubmission?.aiVerificationStatus ||
            verificationData.status,
          aiVerificationResult:
            candidate.projectSubmission?.aiVerificationResult ||
            verificationData.verificationResult
        }
      });

      const liveStatus = await verificationTracker.getVerificationStatus(candidate._id);

      const response = {
        success: true,
        data: {
          // Current status
          status: verificationData.verificationResult?.verificationStatus || verificationData.status || "unknown",
          submissionStatus: verificationData.submissionStatus || "unknown",

          // Student-facing state (label/description/terminal flag)
          verification,
          progress:
            liveStatus.progress ||
            liveStatus.activeInfo?.progress ||
            verificationData.progress ||
            null,

          // Persisted AI verification result (what student should see)
          verificationResult: verificationData.verificationResult ? {
            verificationStatus: verificationData.verificationResult.verificationStatus,
            confidence: verificationData.verificationResult.confidence,
            summary: verificationData.verificationResult.summary,
            
            // Detailed analysis (limited for student view)
            detailedAnalysis: {
              overallAssessment: verificationData.verificationResult.detailedAnalysis?.overallAssessment || "",
              technicalEvaluation: verificationData.verificationResult.detailedAnalysis?.technicalEvaluation || {}
            },
            
            // Requirements assessment (what requirements were met/missing)
            requirementsAssessment: verificationData.verificationResult.detailedAnalysis?.requirementsAssessment?.map(req => ({
              requirementId: req.requirementId,
              description: req.description,
              status: req.status,
              evidence: req.evidence ? req.evidence.substring(0, 200) + (req.evidence.length > 200 ? "..." : "") : "",
              notes: req.notes || ""
            })) || [],
            
            // Recommendations for student
            recommendations: verificationData.verificationResult.recommendations?.forStudent || [],
            
            // Stats
            stats: verificationData.stats || {},
            
            // Admin review status if applicable
            adminReview: verificationData.adminReview
          } : null,
          
          // Metadata
          stats: verificationData.stats,
          adminReview: verificationData.adminReview,
          
          // Verification metadata
          verificationMetadata: verificationData.verificationResult?.verificationMetadata || {}
        }
      };
      
      res.json(response);
      
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