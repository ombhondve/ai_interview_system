import crypto from "crypto";

/**
 * Generate a cryptographically secure
 * random session token.
 */
export function generateSessionToken() {
  return crypto
    .randomBytes(32)
    .toString("hex");
}

/**
 * Hash session token before storing it
 * in MongoDB.
 */
export function hashSessionToken(token) {
  if (!token) {
    throw new Error(
      "Session token is required."
    );
  }

  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

/**
 * Generate session expiry time.
 *
 * Default: 24 hours.
 */
export function getSessionExpiry(hours = 24) {
  return new Date(
    Date.now() +
      hours * 60 * 60 * 1000
  );
}