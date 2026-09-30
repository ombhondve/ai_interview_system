import express from "express";
import enhancedBookingController from "./enhancedBooking.controller.js";
import { requireAuth } from "../auth/auth.middleware.js";
import { requireCandidateAccess } from "../candidate/candidate.middleware.js";

const router = express.Router();

// ====================================================
// INTERVIEW BOOKING WORKFLOW
// ====================================================

/**
 * POST /api/interviews/:candidateId/book/:slotId
 * 
 * Book an interview slot for a candidate
 * 
 * Body:
 * {
 *   "source": "portal",
 *   "interviewType": "ai",
 *   "aiConfig": {
 *     "difficulty": "intermediate",
 *     "duration": 30
 *   }
 * }
 */
router.post(
  "/:candidateId/book/:slotId",
  requireAuth,
  requireCandidateAccess,
  enhancedBookingController.bookInterview.bind(enhancedBookingController)
);

// ====================================================
// INTERVIEW PREPARATION WORKFLOW
// ====================================================

/**
 * POST /api/interviews/:interviewId/candidate/:candidateId/preparation/start
 * 
 * Start interview preparation workflow
 */
router.post(
  "/:interviewId/candidate/:candidateId/preparation/start",
  requireAuth,
  requireCandidateAccess,
  enhancedBookingController.startPreparation.bind(enhancedBookingController)
);

/**
 * PUT /api/interviews/:interviewId/candidate/:candidateId/preparation
 * 
 * Update preparation status
 * 
 * Body:
 * {
 *   "documentsSubmitted": ["resume.pdf", "id.jpg"],
 *   "profileComplete": true,
 *   "testCompleted": true,
 *   "readinessScore": 85,
 *   "notes": "Ready for interview"
 * }
 */
router.put(
  "/:interviewId/candidate/:candidateId/preparation",
  requireAuth,
  requireCandidateAccess,
  enhancedBookingController.updatePreparation.bind(enhancedBookingController)
);

/**
 * POST /api/interviews/:interviewId/candidate/:candidateId/preparation/confirm
 * 
 * Confirm interview readiness
 */
router.post(
  "/:interviewId/candidate/:candidateId/preparation/confirm",
  requireAuth,
  requireCandidateAccess,
  enhancedBookingController.confirmReadiness.bind(enhancedBookingController)
);

// ====================================================
// INTERVIEW MANAGEMENT
// ====================================================

/**
 * POST /api/interviews/:interviewId/candidate/:candidateId/reschedule
 * 
 * Reschedule an interview to a new slot
 * 
 * Body:
 * {
 *   "newSlotId": "new_slot_id",
 *   "reason": "Schedule conflict"
 * }
 */
router.post(
  "/:interviewId/candidate/:candidateId/reschedule",
  requireAuth,
  requireCandidateAccess,
  enhancedBookingController.rescheduleInterview.bind(enhancedBookingController)
);

/**
 * POST /api/interviews/:interviewId/candidate/:candidateId/cancel
 * 
 * Cancel an interview
 * 
 * Body:
 * {
 *   "reason": "Unexpected emergency"
 * }
 */
router.post(
  "/:interviewId/candidate/:candidateId/cancel",
  requireAuth,
  requireCandidateAccess,
  enhancedBookingController.cancelInterview.bind(enhancedBookingController)
);

// ====================================================
// INTERVIEW STATUS AND HISTORY
// ====================================================

/**
 * GET /api/interviews/:interviewId/candidate/:candidateId/status
 * 
 * Get interview status and next steps
 */
router.get(
  "/:interviewId/candidate/:candidateId/status",
  requireAuth,
  requireCandidateAccess,
  enhancedBookingController.getInterviewStatus.bind(enhancedBookingController)
);

/**
 * GET /api/interviews/candidate/:candidateId/history
 * 
 * Get candidate's interview history
 * 
 * Query Parameters:
 * - status: filter by status (scheduled, confirmed, completed, cancelled)
 * - limit: pagination limit (default: 20)
 * - offset: pagination offset (default: 0)
 * - sortBy: sort field (default: -bookingMetadata.bookedAt)
 */
router.get(
  "/candidate/:candidateId/history",
  requireAuth,
  requireCandidateAccess,
  enhancedBookingController.getCandidateInterviewHistory.bind(enhancedBookingController)
);

/**
 * GET /api/interviews/candidate/:candidateId/statistics
 * 
 * Get interview statistics for candidate
 */
router.get(
  "/candidate/:candidateId/statistics",
  requireAuth,
  requireCandidateAccess,
  enhancedBookingController.getInterviewStatistics.bind(enhancedBookingController)
);

// ====================================================
// PUBLIC ENDPOINTS (for status pages, etc.)
// ====================================================

/**
 * GET /api/interviews/:interviewId/status/public
 * 
 * Get public interview status (no auth required)
 * Limited information only
 */
router.get(
  "/:interviewId/status/public",
  enhancedBookingController.getInterviewStatus.bind(enhancedBookingController)
);

export default router;
