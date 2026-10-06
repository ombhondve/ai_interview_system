import express from "express";

// This legacy booking API uses candidate IDs in the URL instead of the secure
// candidate session. Keep reads/old preparation handlers out of candidate use;
// all new bookings are made through /api/student/interview/*.
const retiredLegacyRoute = (_req, res) => res.status(410).json({
  success: false,
  message: "This legacy interview endpoint is retired. Use the current student interview scheduling flow.",
});

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
router.post("/:candidateId/book/:slotId", retiredLegacyRoute);

// ====================================================
// INTERVIEW PREPARATION WORKFLOW
// ====================================================

/**
 * POST /api/interviews/:interviewId/candidate/:candidateId/preparation/start
 * 
 * Start interview preparation workflow
 */
router.post("/:interviewId/candidate/:candidateId/preparation/start", retiredLegacyRoute);

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
router.put("/:interviewId/candidate/:candidateId/preparation", retiredLegacyRoute);

/**
 * POST /api/interviews/:interviewId/candidate/:candidateId/preparation/confirm
 * 
 * Confirm interview readiness
 */
router.post("/:interviewId/candidate/:candidateId/preparation/confirm", retiredLegacyRoute);

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
router.post("/:interviewId/candidate/:candidateId/reschedule", retiredLegacyRoute);

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
router.post("/:interviewId/candidate/:candidateId/cancel", retiredLegacyRoute);

// ====================================================
// INTERVIEW STATUS AND HISTORY
// ====================================================

/**
 * GET /api/interviews/:interviewId/candidate/:candidateId/status
 * 
 * Get interview status and next steps
 */
router.get("/:interviewId/candidate/:candidateId/status", retiredLegacyRoute);

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
router.get("/candidate/:candidateId/history", retiredLegacyRoute);

/**
 * GET /api/interviews/candidate/:candidateId/statistics
 * 
 * Get interview statistics for candidate
 */
router.get("/candidate/:candidateId/statistics", retiredLegacyRoute);

// ====================================================
// PUBLIC ENDPOINTS (for status pages, etc.)
// ====================================================

/**
 * GET /api/interviews/:interviewId/status/public
 * 
 * Get public interview status (no auth required)
 * Limited information only
 */
router.get("/:interviewId/status/public", retiredLegacyRoute);

export default router;
