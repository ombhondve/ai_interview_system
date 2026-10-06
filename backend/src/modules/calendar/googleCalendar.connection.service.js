import { createHash, randomBytes } from "node:crypto";
import { google } from "googleapis";
import GoogleCalendarConnection from "./googleCalendarConnection.model.js";
import GoogleCalendarOAuthState from "./googleCalendarOAuthState.model.js";
import { decryptGoogleToken, encryptGoogleToken } from "./googleCalendar.crypto.js";

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const STATE_TTL_MS = 10 * 60 * 1000;

function oauthConfig() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_CALLBACK_URL;
  if (!clientId || !clientSecret || !redirectUri) {
    const error = new Error("Google Calendar OAuth is not configured.");
    error.code = "GOOGLE_CALENDAR_NOT_CONFIGURED";
    error.status = 503;
    throw error;
  }
  return { clientId, clientSecret, redirectUri };
}

export function createCalendarOAuthClient() {
  const config = oauthConfig();
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}


export async function createCalendarAuthorization(adminId) {
  oauthConfig();
  if (!adminId) {
    const error = new Error("A signed-in administrator is required."); error.status = 401; error.code = "ADMIN_SESSION_REQUIRED"; throw error;
  }
  const state = randomBytes(32).toString("base64url");
  const stateHash = createHash("sha256").update(state).digest("hex");
  const expiresAt = new Date(Date.now() + STATE_TTL_MS);
  await GoogleCalendarOAuthState.create({ stateHash, adminId: String(adminId), expiresAt });
  const client = createCalendarOAuthClient();
  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: [GOOGLE_CALENDAR_SCOPE, "openid", "email"],
    state,
    prompt: "consent",
    include_granted_scopes: true,
  });
  return { url, expiresInSeconds: STATE_TTL_MS / 1000 };
}

export async function consumeCalendarAuthorizationState(state) {
  if (typeof state !== "string" || !state) return null;
  const stateHash = createHash("sha256").update(state).digest("hex");
  const record = await GoogleCalendarOAuthState.findOneAndUpdate(
    { stateHash, consumedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { consumedAt: new Date() } },
    { new: true },
  ).lean();
  return record ? { adminId: record.adminId } : null;
}

export async function exchangeCalendarCode(code) {
  if (typeof code !== "string" || !code.trim()) {
    const error = new Error("Google authorization code is required."); error.status = 400; error.code = "GOOGLE_AUTH_CODE_MISSING"; throw error;
  }
  const client = createCalendarOAuthClient();
  const { tokens } = await client.getToken(code.trim());
  if (!tokens?.refresh_token) {
    const error = new Error("Google did not issue a refresh token. Reconnect and grant Calendar access."); error.status = 502; error.code = "GOOGLE_REFRESH_TOKEN_MISSING"; throw error;
  }
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const userInfo = await oauth2.userinfo.get();
  const email = String(userInfo.data?.email || "").trim().toLowerCase();
  if (!email || userInfo.data?.verified_email === false) {
    const error = new Error("Google did not provide a verified account email."); error.status = 502; error.code = "GOOGLE_ACCOUNT_UNVERIFIED"; throw error;
  }
  return {
    email,
    encryptedRefreshToken: encryptGoogleToken(tokens.refresh_token),
    scope: tokens.scope || GOOGLE_CALENDAR_SCOPE,
  };
}

export async function persistCalendarConnection({ adminId, email, encryptedRefreshToken, scope }) {
  const calendarId = process.env.GOOGLE_CALENDAR_CALENDAR_ID || "primary";
  const existing = await GoogleCalendarConnection.findOne({ adminId }).select("+refreshTokenEncrypted");
  const connection = await GoogleCalendarConnection.findOneAndUpdate(
    { adminId },
    {
      $set: {
        googleAccountEmail: email,
        refreshTokenEncrypted: encryptedRefreshToken,
        calendarId: existing?.calendarId || calendarId,
        scope,
        status: "connected",
        connectedAt: new Date(),
        lastValidatedAt: new Date(),
        tokenVersion: (existing?.tokenVersion || 0) + 1,
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return connection;
}

export async function getActiveCalendarConnectionAdminId() {
  const connections = await GoogleCalendarConnection.find({ status: "connected" }).select("adminId").limit(2).lean();
  if (connections.length !== 1 || !connections[0]?.adminId) {
    const error = new Error(connections.length ? "Exactly one company Google Calendar must be configured." : "Google Calendar is not connected by an administrator.");
    error.status = 503;
    error.code = connections.length ? "GOOGLE_CALENDAR_CONNECTION_AMBIGUOUS" : "GOOGLE_CALENDAR_NOT_CONNECTED";
    throw error;
  }
  return connections[0].adminId;
}

export async function getAdminCalendarConnection(adminId) {
  return GoogleCalendarConnection.findOne({ adminId, status: "connected" }).select("-refreshTokenEncrypted").lean();
}

export async function disconnectCalendar(adminId) {
  const connection = await GoogleCalendarConnection.findOne({ adminId, status: "connected" }).select("+refreshTokenEncrypted");
  if (!connection) return { disconnected: false };
  let revokeFailed = false;
  try {
    const client = createCalendarOAuthClient();
    // Revocation is best effort; local credential deletion is authoritative.
    await client.revokeToken(decryptGoogleToken(connection.refreshTokenEncrypted));
  } catch {
    revokeFailed = true;
  }
  try {
    await GoogleCalendarConnection.updateOne(
      { _id: connection._id },
      { $set: { status: "disconnected", tokenVersion: (connection.tokenVersion || 0) + 1 }, $unset: { refreshTokenEncrypted: 1 } },
      { runValidators: false },
    );
  } catch (error) {
    const safe = new Error("The local Google Calendar credential could not be removed.");
    safe.code = "GOOGLE_CALENDAR_DISCONNECT_FAILED";
    safe.status = 500;
    throw safe;
  }
  return { disconnected: true, revokeFailed };
}

export function clearCalendarOAuthStateForTests() {
  return GoogleCalendarOAuthState.deleteMany({});
}
