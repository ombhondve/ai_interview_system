import crypto from "crypto";
import AiInterview from "./interview.model.js";

export async function requireVerifiedVoiceSession(interviewId, candidateId) {
  const doc = await AiInterview.findById(interviewId);
  if (!doc) { const error = new Error("Interview not found."); error.status = 404; throw error; }
  if (String(doc.candidateId) !== String(candidateId)) { const error = new Error("Forbidden."); error.status = 403; throw error; }
  if (doc.status !== "IN_PROGRESS") { const error = new Error("Interview is not in progress."); error.status = 409; throw error; }
  return doc;
}

export async function requireInternalServiceSession(req, interviewId, candidateId = null, options = {}) {
  const secretHeader =
    req.headers["x-internal-secret"] ||
    req.headers["x-api-secret"] ||
    req.headers["x-bot-control-secret"] ||
    "";
  const authHeader = req.headers.authorization || "";
  let providedSecret = "";
  if (secretHeader) {
    providedSecret = String(secretHeader).trim();
  } else if (authHeader.startsWith("Bearer ")) {
    providedSecret = authHeader.replace(/^Bearer\s+/i, "").trim();
  }

  const candidateSecrets = [
    process.env.RECRUITAI_INTERNAL_API_SECRET,
    process.env.BOT_CONTROL_API_SECRET,
    process.env.MEETING_BOT_API_SECRET,
  ]
    .map((s) => (s || "").trim())
    .filter(Boolean);

  if (candidateSecrets.length === 0) {
    const error = new Error("Internal service secret is not configured on the server.");
    error.status = 500;
    throw error;
  }

  const providedBuffer = Buffer.from(providedSecret);
  let isAuthenticated = false;

  if (providedBuffer.length > 0) {
    for (const expectedSecret of candidateSecrets) {
      const expectedBuffer = Buffer.from(expectedSecret);
      if (
        providedBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(providedBuffer, expectedBuffer)
      ) {
        isAuthenticated = true;
        break;
      }
    }
  }

  if (!isAuthenticated) {
    const error = new Error("Unauthorized: Invalid internal service secret.");
    error.status = 401;
    throw error;
  }

  const doc = await AiInterview.findById(interviewId);
  if (!doc) {
    const error = new Error("Interview not found.");
    error.status = 404;
    throw error;
  }

  if (candidateId && String(doc.candidateId) !== String(candidateId)) {
    const error = new Error("Candidate does not match interview session.");
    error.status = 403;
    throw error;
  }

  // Pre-flight check allowed for bot inspection before joining Google Meet
  if (options.allowPreflight) {
    if (["CANCELLED", "COMPLETED", "CANDIDATE_NO_SHOW", "FAILED", "ANALYZED"].includes(doc.status)) {
      const error = new Error(`Interview is already concluded or cancelled (status: ${doc.status}).`);
      error.status = 409;
      throw error;
    }
    return doc;
  }

  if (doc.status !== "IN_PROGRESS") {
    const error = new Error("Interview is not in progress.");
    error.status = 409;
    throw error;
  }

  return doc;
}

