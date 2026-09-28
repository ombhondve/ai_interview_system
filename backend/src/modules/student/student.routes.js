import express from "express";

import {
  verifyCandidatePortalTokenController,
  getCurrentStudentController,
} from "./student.controller.js";

const router = express.Router();

/**
 * ============================================
 * CANDIDATE INVITATION
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
 * CURRENT STUDENT
 * ============================================
 *
 * GET /api/student/me
 *
 * Used after the candidate successfully
 * verifies the OTP.
 *
 * The candidate_session cookie is checked
 * by the controller.
 */

router.get(
  "/me",
  getCurrentStudentController
);

/**
 * ============================================
 * EXPORT ROUTER
 * ============================================
 */

export default router;