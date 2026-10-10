import mongoose from "mongoose";

export const GOOGLE_MEET_REGEX = /^https:\/\/meet\.google\.com\/[a-zA-Z0-9]{3}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{3}(\?.*)?$/;
export const WORKER_ID_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;

/**
 * Validates Google Meet URL strictly.
 * Prevents arbitrary URL redirection or script/command injection.
 */
export function validateMeetUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" || parsed.hostname !== "meet.google.com") {
      return false;
    }
    return GOOGLE_MEET_REGEX.test(trimmed);
  } catch {
    return false;
  }
}

/**
 * Validates worker identifier.
 */
export function validateWorkerId(workerId) {
  if (!workerId || typeof workerId !== "string") return false;
  return WORKER_ID_REGEX.test(workerId.trim());
}

/**
 * Validates MongoDB ObjectId.
 */
export function isValidObjectId(id) {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(String(id));
}

/**
 * Sanitizes error messages to prevent exposing secrets, bearer tokens, or sensitive stacks.
 */
export function sanitizeError(err) {
  if (!err) return "Unknown error";
  let text = typeof err === "string" ? err : err.message || String(err);

  // Redact secrets, keys, and tokens
  text = text.replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[REDACTED]");
  text = text.replace(/(api[-_]?key[:=]\s*)[^\s&]+/gi, "$1[REDACTED]");
  text = text.replace(/(secret[:=]\s*)[^\s&]+/gi, "$1[REDACTED]");
  text = text.replace(/(password[:=]\s*)[^\s&]+/gi, "$1[REDACTED]");
  text = text.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, "mongodb://[REDACTED]");

  return text.slice(0, 500);
}

export default {
  validateMeetUrl,
  validateWorkerId,
  isValidObjectId,
  sanitizeError,
};
