import express from "express";
import {
  createSlot,
  getAvailableSlots,
  checkEligibility,
  detectConflicts,
  createSlotTemplate,
  generateSlotsFromTemplate,
  getSlotTemplates,
  updateSlotTemplate,
  deleteSlotTemplate,
  getSlotStatistics,
  slotHealthCheck
} from "./enhancedSlot.controller.js";

const router = express.Router();

/**
 * Middleware for admin authentication
 */
const requireAdmin = (req, res, next) => {
  const adminId = req.user?.id || req.headers['x-admin-id'];
  
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
 * Middleware for candidate authentication
 */
const requireCandidate = (req, res, next) => {
  const candidateId = req.candidate?._id || req.headers['x-candidate-id'];
  
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
router.get("/health", slotHealthCheck);

// Get available slots (public, but role-based filtering)
router.get("/available", getAvailableSlots);

// Check eligibility (candidate-specific)
router.get("/:slotId/eligibility", checkEligibility);

/**
 * Candidate endpoints
 */

// Detect conflicts before booking
router.post("/:slotId/conflicts", requireCandidate, detectConflicts);

/**
 * Admin endpoints (require admin authentication)
 */

// Slot management
router.post("/", requireAdmin, createSlot);

// Slot template management
router.post("/templates", requireAdmin, createSlotTemplate);
router.get("/templates", requireAdmin, getSlotTemplates);
router.put("/templates/:templateId", requireAdmin, updateSlotTemplate);
router.delete("/templates/:templateId", requireAdmin, deleteSlotTemplate);
router.post("/templates/generate", requireAdmin, generateSlotsFromTemplate);

// Statistics
router.get("/statistics", requireAdmin, getSlotStatistics);

export default router;