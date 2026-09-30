import jwt from "jsonwebtoken";

/**
 * Authentication middleware for verifying JWT tokens
 */

function getSecret() {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured.");
  return secret;
}

function getAdmin() {
  return {
    id: process.env.DEMO_ADMIN_ID || "env-admin",
    name: process.env.DEMO_ADMIN_NAME || "Admin User",
    email: (process.env.DEMO_ADMIN_EMAIL || "admin@example.com").trim().toLowerCase(),
    role: process.env.DEMO_ADMIN_ROLE || "superadmin",
    active: true,
  };
}

/**
 * Middleware to require authentication
 * Verifies JWT token from cookies
 */
export const requireAuth = (req, res, next) => {
  try {
    const token = req.cookies?.recruitai_admin;
    
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
    const token = req.cookies?.recruitai_admin;
    
    if (token) {
      const payload = jwt.verify(token, getSecret());
      
      if (payload && typeof payload === "object" && payload.adminId) {
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