import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Admin from "../admin/admin.model.js";

/**
 * Authentication middleware for verifying JWT tokens
 */

function getSecret() {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured.");
  return secret;
}

/**
 * Middleware to require authentication
 * Verifies JWT token from Authorization header or cookies
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers?.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const token = bearerToken || req.cookies?.recruitai_admin;
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required. Please login first." 
      });
    }

    const payload = jwt.verify(token, getSecret());
    
    if (!payload || typeof payload !== "object" || !payload.adminId) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid authentication token." 
      });
    }

    // Add user info to request object
    const allowedRoles = ["superadmin", "recruiter", "admin"];
    if (!allowedRoles.includes(payload.role)) {
      return res.status(403).json({ success: false, message: "Insufficient permissions." });
    }

    // If this is a persisted DB admin, check if account is active
    if (mongoose.Types.ObjectId.isValid(payload.adminId)) {
      try {
        const adminDoc = await Admin.findById(payload.adminId).select("status role").lean();
        if (adminDoc && adminDoc.status === "inactive") {
          return res.status(403).json({
            success: false,
            message: "Your account has been deactivated. Please contact an administrator.",
          });
        }
      } catch (dbErr) {
        // Continue if DB check fails transiently
      }
    }

    req.user = {
      id: payload.adminId,
      email: payload.email,
      role: payload.role
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ 
        success: false, 
        message: "Session expired. Please login again." 
      });
    }
    
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid authentication token." 
      });
    }

    console.error("Auth middleware error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error during authentication." 
    });
  }
};

/**
 * Middleware to require specific roles
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required." 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Insufficient permissions. Required roles: ${allowedRoles.join(", ")}` 
      });
    }

    next();
  };
};

/**
 * Optional authentication middleware
 * Adds user info if authenticated, but doesn't block if not
 */
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers?.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const token = bearerToken || req.cookies?.recruitai_admin;
    
    if (token) {
      const payload = jwt.verify(token, getSecret());
      
      const allowedRoles = ["superadmin", "recruiter", "admin"];
      if (payload && typeof payload === "object" && payload.adminId && allowedRoles.includes(payload.role)) {
        req.user = {
          id: payload.adminId,
          email: payload.email,
          role: payload.role
        };
      }
    }
  } catch (error) {
    // Silently ignore auth errors for optional middleware
    // Token might be expired or invalid, but that's OK for optional auth
  }

  next();
};

/**
 * Get current user from request
 */
export const getCurrentUser = (req) => {
  return req.user || null;
};

export default {
  requireAuth,
  requireRole,
  optionalAuth,
  getCurrentUser,
};