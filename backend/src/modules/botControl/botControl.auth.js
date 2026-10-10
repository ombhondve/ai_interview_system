import crypto from "crypto";
import jwt from "jsonwebtoken";
import BotWorker from "./botWorker.model.js";

/**
 * Constant-time comparison for secrets and tokens.
 * Prevents timing attacks.
 */
export function safeSecretCompare(provided, expected) {
  if (!provided || !expected || typeof provided !== "string" || typeof expected !== "string") {
    return false;
  }
  const bufA = Buffer.from(provided);
  const bufB = Buffer.from(expected);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function hashWorkerToken(token) {
  return crypto.createHash("sha256").update(String(token).trim()).digest("hex");
}

export function generateWorkerToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function getMasterBotSecret() {
  const secret = (process.env.BOT_CONTROL_API_SECRET || process.env.RECRUITAI_INTERNAL_API_SECRET || "").trim();
  return secret;
}

/**
 * Middleware for worker registration.
 * Requires the master BOT_CONTROL_API_SECRET.
 */
export function requireWorkerRegistrationAuth(req, res, next) {
  const masterSecret = getMasterBotSecret();
  if (!masterSecret) {
    return res.status(500).json({
      success: false,
      message: "Central bot control secret is not configured on the server.",
    });
  }

  const authHeader = req.headers.authorization || "";
  const secretHeader = req.headers["x-bot-control-secret"] || req.headers["x-api-secret"] || "";

  let provided = "";
  if (secretHeader) {
    provided = String(secretHeader).trim();
  } else if (authHeader.startsWith("Bearer ")) {
    provided = authHeader.replace(/^Bearer\s+/i, "").trim();
  }

  if (!provided || !safeSecretCompare(provided, masterSecret)) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or missing bot control secret.",
    });
  }

  next();
}

/**
 * Middleware for authenticated worker operations (heartbeat, claim, job complete/fail).
 * Supports scoped per-worker tokens or master secret.
 */
export async function requireWorkerAuth(req, res, next) {
  try {
    const masterSecret = getMasterBotSecret();
    const authHeader = req.headers.authorization || "";
    const secretHeader = req.headers["x-bot-control-secret"] || "";
    const tokenHeader = req.headers["x-worker-token"] || "";
    const workerId =
      req.headers["x-worker-id"] ||
      req.body?.workerId ||
      req.query?.workerId ||
      null;

    let bearerToken = "";
    if (authHeader.startsWith("Bearer ")) {
      bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    }

    const providedToken = tokenHeader || bearerToken;
    const providedSecret = secretHeader || (!tokenHeader && bearerToken === masterSecret ? bearerToken : "");

    // 1. If master secret is provided and matches, allow with master access
    if (masterSecret && providedSecret && safeSecretCompare(providedSecret, masterSecret)) {
      if (workerId) {
        const worker = await BotWorker.findOne({ workerId });
        if (worker && !worker.enabled) {
          return res.status(403).json({
            success: false,
            message: "Worker is currently disabled by an administrator.",
          });
        }
        req.worker = worker || null;
        req.workerId = workerId;
      }
      return next();
    }

    // 2. Per-worker token validation
    if (!providedToken) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Worker credentials required.",
      });
    }

    if (!workerId) {
      return res.status(400).json({
        success: false,
        message: "workerId must be provided in X-Worker-Id header, query, or body.",
      });
    }

    const worker = await BotWorker.findOne({ workerId });
    if (!worker) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Worker not registered.",
      });
    }

    if (!worker.tokenHash) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Worker has no active session. Please re-register.",
      });
    }

    const hashedProvided = hashWorkerToken(providedToken);
    if (!safeSecretCompare(hashedProvided, worker.tokenHash)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid worker token.",
      });
    }

    if (!worker.enabled) {
      return res.status(403).json({
        success: false,
        message: "Worker is currently disabled by an administrator.",
      });
    }

    req.worker = worker;
    req.workerId = worker.workerId;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal error during worker authentication.",
    });
  }
}

/**
 * Middleware for administrator endpoints.
 * Verifies JWT token from cookies (recruitai_admin) or Authorization: Bearer <jwt>.
 */
export function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    let token = req.cookies?.recruitai_admin;

    if (!token && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace(/^Bearer\s+/i, "").trim();
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please login first.",
      });
    }

    const secret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      return res.status(500).json({
        success: false,
        message: "JWT_SECRET is not configured on the server.",
      });
    }

    const payload = jwt.verify(token, secret);
    if (!payload || typeof payload !== "object" || !payload.adminId) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    const allowedRoles = ["superadmin", "recruiter", "admin"];
    if (!allowedRoles.includes(payload.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions.",
      });
    }

    req.user = {
      id: payload.adminId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token.",
    });
  }
}

export default {
  safeSecretCompare,
  hashWorkerToken,
  generateWorkerToken,
  getMasterBotSecret,
  requireWorkerRegistrationAuth,
  requireWorkerAuth,
  requireAdminAuth,
};
