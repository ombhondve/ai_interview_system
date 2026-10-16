import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import Admin from "../admin/admin.model.js";
import { createAuditLog } from "../auditLog/auditLog.service.js";

const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
  maxAge: 8 * 60 * 60 * 1000,
};

function getCredentials() {
  const email = process.env.DEMO_ADMIN_EMAIL;
  const password = process.env.DEMO_ADMIN_PASSWORD;
  if (!email || !password) {
    return null;
  }
  return { email: email.trim().toLowerCase(), password };
}

function getSecret() {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured.");
  return secret;
}

function getAdmin() {
  const credentials = getCredentials();
  return {
    id: process.env.DEMO_ADMIN_ID || "env-admin",
    name: process.env.DEMO_ADMIN_NAME || "System Administrator",
    email: credentials?.email || "admin@recruitai.com",
    role: process.env.DEMO_ADMIN_ROLE || "superadmin",
    avatar: process.env.DEMO_ADMIN_AVATAR || null,
    phone: process.env.DEMO_ADMIN_PHONE || "",
    status: "active",
    active: true,
  };
}

export async function login(req, res) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    // 1. Check if user exists in MongoDB Admin collection
    let dbAdmin = null;
    try {
      dbAdmin = await Admin.findOne({ email });
    } catch (err) {
      console.warn("DB Admin lookup warning:", err.message);
    }

    if (dbAdmin) {
      if (dbAdmin.status === "inactive") {
        return res.status(403).json({
          message: "Your account has been deactivated. Please contact an administrator.",
        });
      }

      const isMatch = await bcrypt.compare(password, dbAdmin.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid email or password." });
      }

      // Update lastLogin timestamp
      dbAdmin.lastLogin = new Date();
      await dbAdmin.save().catch(() => {});

      const userPayload = {
        id: String(dbAdmin._id),
        name: dbAdmin.name,
        email: dbAdmin.email,
        role: dbAdmin.role,
        status: dbAdmin.status,
        lastLogin: dbAdmin.lastLogin,
        active: dbAdmin.status === "active",
      };

      const token = jwt.sign(
        { adminId: String(dbAdmin._id), email: dbAdmin.email, role: dbAdmin.role },
        getSecret(),
        { expiresIn: "8h" }
      );

      res.cookie("recruitai_admin", token, cookieOptions);

      createAuditLog({
        actor: String(dbAdmin._id),
        actorId: String(dbAdmin._id),
        actorName: dbAdmin.name,
        actorEmail: dbAdmin.email,
        actorRole: dbAdmin.role,
        action: "ADMIN_LOGIN",
        targetType: "Admin",
        targetId: String(dbAdmin._id),
        targetName: dbAdmin.name,
        description: `Administrator ${dbAdmin.name} logged in successfully`,
        outcome: "SUCCESS",
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
      }).catch(() => {});

      return res.status(200).json({ user: userPayload, token });
    }

    // 2. Fall back to demo environment credentials in non-production only
    if (!isProduction) {
      const credentials = getCredentials();
      if (credentials && email === credentials.email && password === credentials.password) {
        const admin = getAdmin();
        const token = jwt.sign(
          { adminId: admin.id, email: admin.email, role: admin.role },
          getSecret(),
          { expiresIn: "8h" }
        );

      res.cookie("recruitai_admin", token, cookieOptions);

      createAuditLog({
        actor: admin.id,
        actorId: admin.id,
        actorName: admin.name,
        actorEmail: admin.email,
        actorRole: admin.role,
        action: "ADMIN_LOGIN",
        targetType: "Admin",
        targetId: admin.id,
        targetName: admin.name,
        description: `Administrator ${admin.name} logged in successfully`,
        outcome: "SUCCESS",
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
      }).catch(() => {});

      return res.status(200).json({ user: admin, token });
    }
  }

    createAuditLog({
      actor: email || "unknown",
      actorName: email || "Anonymous",
      actorEmail: email || "",
      actorRole: "none",
      action: "ADMIN_LOGIN_FAILED",
      targetType: "Authentication",
      description: `Failed login attempt for ${email || "unknown"}`,
      outcome: "FAILURE",
      ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
    }).catch(() => {});

    return res.status(401).json({ message: "Invalid email or password." });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({ message: "Unable to login." });
  }
}

export async function me(req, res) {
  try {
    const authHeader = req.headers?.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const token = bearerToken || req.cookies?.recruitai_admin;

    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const payload = jwt.verify(token, getSecret());
    if (!payload || typeof payload !== "object" || !payload.adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (mongoose.Types.ObjectId.isValid(payload.adminId)) {
      const dbAdmin = await Admin.findById(payload.adminId).select("-passwordHash").lean();
      if (dbAdmin) {
        if (dbAdmin.status === "inactive") {
          return res.status(403).json({ message: "Account has been deactivated." });
        }
        return res.status(200).json({
          user: {
            id: String(dbAdmin._id),
            name: dbAdmin.name,
            email: dbAdmin.email,
            role: dbAdmin.role,
            avatar: dbAdmin.avatar || null,
            phone: dbAdmin.phone || "",
            status: dbAdmin.status,
            lastLogin: dbAdmin.lastLogin,
            active: dbAdmin.status === "active",
          },
        });
      }
    }

    return res.status(200).json({ user: getAdmin() });
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

export async function getProfile(req, res) {
  try {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });

    if (mongoose.Types.ObjectId.isValid(adminId)) {
      const dbAdmin = await Admin.findById(adminId).select("-passwordHash").lean();
      if (dbAdmin) {
        return res.status(200).json({
          success: true,
          user: {
            id: String(dbAdmin._id),
            name: dbAdmin.name,
            email: dbAdmin.email,
            role: dbAdmin.role,
            avatar: dbAdmin.avatar || null,
            phone: dbAdmin.phone || "",
            status: dbAdmin.status,
            lastLogin: dbAdmin.lastLogin,
            active: dbAdmin.status === "active",
          },
        });
      }
    }

    return res.status(200).json({
      success: true,
      user: getAdmin(),
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({ success: false, message: "Failed to load profile." });
  }
}

export async function updateProfile(req, res) {
  try {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const avatar = req.body?.avatar !== undefined ? (req.body.avatar ? String(req.body.avatar).trim() : null) : undefined;
    const phone = req.body?.phone !== undefined ? String(req.body.phone).trim() : undefined;

    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required." });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "A valid email address is required." });
    }

    if (avatar && avatar.length > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: "Avatar image is too large (max 5MB)." });
    }

    if (mongoose.Types.ObjectId.isValid(adminId)) {
      const existing = await Admin.findOne({
        email,
        _id: { $ne: adminId },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "This email address is already in use by another administrator.",
        });
      }

      const updateData = { name, email };
      if (avatar !== undefined) updateData.avatar = avatar;
      if (phone !== undefined) updateData.phone = phone;

      const updated = await Admin.findByIdAndUpdate(
        adminId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select("-passwordHash").lean();

      createAuditLog({
        actor: String(updated._id),
        actorId: String(updated._id),
        actorName: updated.name,
        actorEmail: updated.email,
        actorRole: updated.role,
        action: "ADMIN_PROFILE_UPDATE",
        targetType: "Admin",
        targetId: String(updated._id),
        targetName: updated.name,
        description: `Administrator ${updated.name} updated profile`,
        outcome: "SUCCESS",
        details: { updatedFields: Object.keys(updateData) },
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        message: "Profile updated successfully.",
        user: {
          id: String(updated._id),
          name: updated.name,
          email: updated.email,
          role: updated.role,
          avatar: updated.avatar || null,
          phone: updated.phone || "",
          status: updated.status,
          lastLogin: updated.lastLogin,
          active: updated.status === "active",
        },
      });
    }

    // Demo admin update
    const currentAdmin = getAdmin();
    currentAdmin.name = name;
    currentAdmin.email = email;
    if (avatar !== undefined) currentAdmin.avatar = avatar;
    if (phone !== undefined) currentAdmin.phone = phone;
    process.env.DEMO_ADMIN_NAME = name;
    process.env.DEMO_ADMIN_EMAIL = email;
    if (avatar !== undefined) process.env.DEMO_ADMIN_AVATAR = avatar || "";
    if (phone !== undefined) process.env.DEMO_ADMIN_PHONE = phone || "";

    createAuditLog({
      actor: currentAdmin.id,
      actorId: currentAdmin.id,
      actorName: currentAdmin.name,
      actorEmail: currentAdmin.email,
      actorRole: currentAdmin.role,
      action: "ADMIN_PROFILE_UPDATE",
      targetType: "Admin",
      targetId: currentAdmin.id,
      targetName: currentAdmin.name,
      description: `Administrator ${currentAdmin.name} updated profile`,
      outcome: "SUCCESS",
      ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: currentAdmin,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ success: false, message: "Failed to update profile." });
  }
}

export async function logout(req, res) {
  try {
    const authHeader = req.headers?.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const token = bearerToken || req.cookies?.recruitai_admin;
    if (token) {
      const payload = jwt.verify(token, getSecret());
      createAuditLog({
        actor: payload.adminId || "admin",
        actorId: payload.adminId,
        actorEmail: payload.email,
        actorRole: payload.role,
        action: "ADMIN_LOGOUT",
        targetType: "Admin",
        targetId: payload.adminId,
        description: `Administrator ${payload.email || "user"} logged out`,
        outcome: "SUCCESS",
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
      }).catch(() => {});
    }
  } catch (_) {}

  res.clearCookie("recruitai_admin", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });
  return res.status(200).json({ message: "Logged out successfully" });
}

/**
 * Google OAuth callback handler
 */
export async function googleAuthCallback(req, res) {
  try {
    const user = req.user; // User object from passport
    
    if (!user) {
      return res.status(401).json({ message: "Google authentication failed" });
    }

    // Create JWT token for the user
    const token = jwt.sign(
      {
        userId: user.googleId || user.id,
        email: user.email,
        name: user.name,
        provider: "google",
      },
      getSecret(),
      { expiresIn: "8h" }
    );

    // Set cookie (adjust cookie name as needed)
    const userCookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/",
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    };

    res.cookie("recruitai_user", token, userCookieOptions);

    // Redirect to frontend or return JSON
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    
    // For API clients, return JSON
    if (req.headers["content-type"] === "application/json" || 
        req.headers["accept"]?.includes("application/json")) {
      return res.status(200).json({
        success: true,
        user: {
          id: user.googleId || user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
        },
        token,
      });
    }

    // For web clients, redirect to frontend dashboard
    return res.redirect(`${frontendUrl}/admin`);

  } catch (error) {
    console.error("Google auth callback error:", error);
    
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    return res.redirect(`${frontendUrl}/login?error=auth_failed`);
  }
}
