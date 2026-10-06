"use strict";

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

describe("Google Calendar Admin Authentication Flow", () => {
  const JWT_SECRET = "test-secret-key-for-jwt-signing";
  let app;
  let getAdminCalendarConnectionMock;

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.DEMO_ADMIN_EMAIL = "admin@recruitai.com";
    process.env.DEMO_ADMIN_PASSWORD = "password123";
    process.env.DEMO_ADMIN_ROLE = "superadmin";
    process.env.DEMO_ADMIN_ID = "admin-123";
    process.env.NODE_ENV = "production";

    // Setup an isolated Express app testing auth middleware + calendar routes
    app = express();
    app.use(express.json());

    // Simple cookie parser mock matching cookieParser.middleware.js
    app.use((req, res, next) => {
      const header = req.headers.cookie || "";
      req.cookies = {};
      for (const part of header.split(";")) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const index = trimmed.indexOf("=");
        if (index === -1) continue;
        req.cookies[trimmed.slice(0, index).trim()] = decodeURIComponent(trimmed.slice(index + 1));
      }
      next();
    });

    // Mock connection service
    getAdminCalendarConnectionMock = jest.fn();

    // Recreate the auth middleware logic directly from auth.middleware.js
    const requireAuth = (req, res, next) => {
      const token = req.cookies?.recruitai_admin;
      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Authentication required. Please login first.",
        });
      }
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (!payload || typeof payload !== "object" || !payload.adminId) {
          return res.status(401).json({ success: false, message: "Invalid authentication token." });
        }
        const allowedRoles = ["superadmin", "recruiter", "admin"];
        if (!allowedRoles.includes(payload.role)) {
          return res.status(403).json({ success: false, message: "Insufficient permissions." });
        }
        req.user = { id: payload.adminId, email: payload.email, role: payload.role };
        next();
      } catch {
        return res.status(401).json({ success: false, message: "Invalid authentication token." });
      }
    };

    const requireRole = (...roles) => (req, res, next) => {
      if (!roles.includes(req.user?.role)) {
        return res.status(403).json({ success: false, message: "Insufficient permissions." });
      }
      next();
    };

    const adminOnly = [requireAuth, requireRole("superadmin", "recruiter", "admin")];

    // Calendar status route
    app.get("/api/admin/google-calendar/status", ...adminOnly, async (req, res) => {
      try {
        const connection = await getAdminCalendarConnectionMock(req.user.id);
        if (!connection) return res.json({ success: true, connected: false });
        return res.json({ success: true, connected: true, googleAccountEmail: connection.googleAccountEmail });
      } catch {
        return res.status(500).json({ success: false, message: "Unable to load Google Calendar status." });
      }
    });
  });

  test("GET /api/admin/google-calendar/status returns 401 without recruitai_admin cookie", async () => {
    const res = await request(app).get("/api/admin/google-calendar/status");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      message: "Authentication required. Please login first.",
    });
    expect(getAdminCalendarConnectionMock).not.toHaveBeenCalled();
  });

  test("GET /api/admin/google-calendar/status returns 200 { connected: false } with valid admin session cookie", async () => {
    getAdminCalendarConnectionMock.mockResolvedValue(null);

    const token = jwt.sign(
      { adminId: "admin-123", email: "admin@recruitai.com", role: "superadmin" },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    const res = await request(app)
      .get("/api/admin/google-calendar/status")
      .set("Cookie", `recruitai_admin=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      connected: false,
    });
    expect(getAdminCalendarConnectionMock).toHaveBeenCalledWith("admin-123");
  });

  test("GET /api/admin/google-calendar/status returns 403 for unauthorized non-admin roles", async () => {
    const token = jwt.sign(
      { adminId: "student-123", email: "student@example.com", role: "student" },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    const res = await request(app)
      .get("/api/admin/google-calendar/status")
      .set("Cookie", `recruitai_admin=${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Insufficient permissions.");
  });
});
