/**
 * Candidate Access Middleware
 * This middleware ensures the authenticated user has access to the candidate resource
 */

import Candidate from "./candidate.model.js";

/**
 * Middleware to require candidate access
 * Checks if the authenticated user can access the candidate resource
 */
export const requireCandidateAccess = async (req, res, next) => {
  try {
    const candidateId = req.params.candidateId;
    const userId = req.user?.id;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: "Candidate ID is required",
      });
    }

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    // Check if the candidate exists
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    // Check if the user has access to this candidate
    // This logic depends on your application's authorization model
    // For now, we'll implement a simple check
    
    // Option 1: User owns the candidate (candidate.userId matches)
    if (candidate.userId && candidate.userId.toString() === userId) {
      req.candidate = candidate;
      return next();
    }

    // Option 2: User is an admin
    if (req.user?.role === "admin") {
      req.candidate = candidate;
      return next();
    }

    // Option 3: Candidate has a valid session or invitation token
    // This would require checking session tokens or invitation systems

    return res.status(403).json({
      success: false,
      message: "You do not have permission to access this candidate",
    });
  } catch (error) {
    console.error("Candidate access middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Middleware to check if candidate exists
 * Populates req.candidate if found
 */
export const candidateExists = async (req, res, next) => {
  try {
    const candidateId = req.params.candidateId;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: "Candidate ID is required",
      });
    }

    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    req.candidate = candidate;
    next();
  } catch (error) {
    console.error("Candidate exists middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Middleware to validate candidate data
 */
export const validateCandidateData = (req, res, next) => {
  const { name, email, phone } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: "Name and email are required",
    });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format",
    });
  }

  next();
};

export default {
  requireCandidateAccess,
  candidateExists,
  validateCandidateData,
};