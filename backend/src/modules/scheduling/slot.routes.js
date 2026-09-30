import express from "express";
import { requireVerifiedSession } from "../../middleware/requireVerifiedSession.js";
import {
  getAvailableSlotsController,
  bookSlotController,
  getBookedSlotController
} from "./slot.controller.js";

const router = express.Router();

/**
 * ============================================
 * STUDENT SLOT ROUTES
 * ============================================
 * 
 * These routes require verified student session
 */

/**
 * GET AVAILABLE SLOTS
 * 
 * GET /api/student/slots
 * 
 * Returns available interview slots for the candidate
 * Filters by candidate role and availability
 */
router.get(
  "/student/slots",
  requireVerifiedSession,
  getAvailableSlotsController
);

/**
 * BOOK SLOT
 * 
 * POST /api/student/book-slot
 * 
 * Books an interview slot for the candidate
 * Atomic operation to prevent double-booking
 */
router.post(
  "/student/book-slot",
  requireVerifiedSession,
  bookSlotController
);

/**
 * GET BOOKED SLOT
 * 
 * GET /api/student/booked-slot
 * 
 * Returns the candidate's booked interview slot
 */
router.get(
  "/student/booked-slot",
  requireVerifiedSession,
  getBookedSlotController
);

export default router;