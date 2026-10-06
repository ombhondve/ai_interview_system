import express from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import {
  createCalendarAuthorization,
  consumeCalendarAuthorizationState,
  exchangeCalendarCode,
  getAdminCalendarConnection,
  persistCalendarConnection,
  disconnectCalendar,
} from "./googleCalendar.connection.service.js";
import { googleCalendarService } from "../../services/googleCalendar.service.js";
import { decryptGoogleToken } from "./googleCalendar.crypto.js";
import logger from "../../utils/logger.js";

const router = express.Router();
const adminOnly = [requireAuth, requireRole("superadmin", "recruiter", "admin")];

function frontendSettingsUrl() {
  const configured = process.env.FRONTEND_URL || "http://localhost:3000";
  const target = new URL("/admin/settings?section=calendar", configured);
  const allowed = new Set([new URL(configured).origin, "http://localhost:3000", "http://127.0.0.1:3000"]);
  if (!allowed.has(target.origin)) throw new Error("Frontend callback URL is not allowed.");
  if (process.env.NODE_ENV === "production" && target.protocol !== "https:") throw new Error("Production frontend URL must use HTTPS.");
  return target;
}

router.get("/connect", ...adminOnly, async (req, res) => {
  try {
    const { url } = await createCalendarAuthorization(req.user.id);
    return res.json({ success: true, authorizationUrl: url });
  } catch (error) {
    return res.status(error.status || 503).json({ success: false, code: error.code || "GOOGLE_CALENDAR_OAUTH_UNAVAILABLE", message: error.status ? error.message : "Google Calendar authorization could not be started." });
  }
});

// Google redirects here without RecruitAI's admin JWT cookie. The random state
// is single-use, expires, and is persisted with its authenticated admin owner.
router.get("/callback", async (req, res) => {
  let redirect;
  try {
    redirect = frontendSettingsUrl();
  } catch {
    return res.status(500).json({ success: false, code: "FRONTEND_URL_INVALID", message: "Calendar settings redirect is not configured safely." });
  }

  const state = typeof req.query.state === "string" ? req.query.state : "";
  let grantOwner;
  try {
    grantOwner = await consumeCalendarAuthorizationState(state);
  } catch {
    redirect.searchParams.set("calendar", "error");
    redirect.searchParams.set("reason", "state_unavailable");
    return res.redirect(303, redirect.toString());
  }
  if (!grantOwner) {
    redirect.searchParams.set("calendar", "error");
    redirect.searchParams.set("reason", "invalid_state");
    return res.redirect(303, redirect.toString());
  }
  if (req.query.error) {
    redirect.searchParams.set("calendar", "error");
    redirect.searchParams.set("reason", "authorization_denied");
    return res.redirect(303, redirect.toString());
  }
  if (typeof req.query.code !== "string" || !req.query.code) {
    redirect.searchParams.set("calendar", "error");
    redirect.searchParams.set("reason", "missing_code");
    return res.redirect(303, redirect.toString());
  }

  try {
    const grant = await exchangeCalendarCode(req.query.code, grantOwner.adminId);
    const refreshToken = decryptGoogleToken(grant.encryptedRefreshToken);
    const calendarId = process.env.GOOGLE_CALENDAR_CALENDAR_ID || "primary";
    const client = await googleCalendarService.initializeForRefreshToken(refreshToken, calendarId);

    // Verify Calendar access: try events.list first, fall back to calendars.get if needed
    try {
      const validation = await client.events.list({ calendarId, maxResults: 1 });
      if (!validation || typeof validation.data !== "object") {
        throw new Error("Calendar validation returned an invalid response.");
      }
    } catch (eventsErr) {
      logger.warn("Initial events list check warned, verifying primary calendar access", {
        message: eventsErr?.message,
      });
      await client.calendars.get({ calendarId });
    }

    await persistCalendarConnection({ adminId: grantOwner.adminId, ...grant });
    googleCalendarService.clearConnectionCache(grantOwner.adminId);
    redirect.searchParams.set("calendar", "connected");
    logger.info("Google Calendar connected", { adminId: grantOwner.adminId, email: grant.email });
  } catch (error) {
    googleCalendarService.clearConnectionCache(grantOwner.adminId);
    logger.error("Google Calendar OAuth callback failed", {
      adminId: grantOwner?.adminId,
      message: error?.message,
      code: error?.code,
      status: error?.status || error?.response?.status,
    });
    redirect.searchParams.set("calendar", "error");
    redirect.searchParams.set("reason", "connection_failed");
  }
  return res.redirect(303, redirect.toString());
});

router.get("/status", ...adminOnly, async (req, res) => {
  try {
    const connection = await getAdminCalendarConnection(req.user.id);
    if (!connection) return res.json({ success: true, connected: false });
    return res.json({ success: true, connected: true, googleAccountEmail: connection.googleAccountEmail, calendarId: connection.calendarId, connectedAt: connection.connectedAt, lastValidatedAt: connection.lastValidatedAt });
  } catch {
    return res.status(500).json({ success: false, message: "Unable to load Google Calendar status." });
  }
});

router.post("/disconnect", ...adminOnly, async (req, res) => {
  try {
    const result = await disconnectCalendar(req.user.id);
    googleCalendarService.clearConnectionCache(req.user.id);
    return res.json({ success: true, disconnected: result.disconnected, revocationPending: result.revokeFailed });
  } catch (error) {
    logger.error("Google Calendar disconnect failed", { adminId: req.user.id, code: error?.code || "DISCONNECT_FAILED" });
    return res.status(error?.status || 500).json({ success: false, message: "Unable to disconnect Google Calendar. Please retry." });
  }
});

export default router;
