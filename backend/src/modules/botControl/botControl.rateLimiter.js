/**
 * In-memory sliding window rate limiter for bot control endpoints.
 * Automatically cleans up expired windows to prevent memory leaks.
 */

class RateLimiter {
  constructor(windowMs, maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.hits = new Map();

    if (process.env.NODE_ENV !== "test") {
      this.timer = setInterval(() => {
        const now = Date.now();
        for (const [key, record] of this.hits.entries()) {
          if (now - record.resetTime > this.windowMs) {
            this.hits.delete(key);
          }
        }
      }, 60000);
      if (this.timer && typeof this.timer.unref === "function") {
        this.timer.unref();
      }
    }
  }

  isAllowed(key) {
    const now = Date.now();
    const record = this.hits.get(key);

    if (!record || now > record.resetTime) {
      this.hits.set(key, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    if (record.count >= this.maxRequests) {
      return false;
    }

    record.count += 1;
    return true;
  }
}

// 1. Worker registration rate limiter: max 20 registrations per minute per IP
export const registrationLimiter = new RateLimiter(60 * 1000, 20);

// 2. Worker claim rate limiter: max 120 claims per minute per worker
export const claimLimiter = new RateLimiter(60 * 1000, 120);

// 3. Admin sensitive actions (retry / worker pause) rate limiter: max 40 per minute
export const adminActionLimiter = new RateLimiter(60 * 1000, 40);

export function createRateLimitMiddleware(limiter, keyGenerator, message = "Too many requests. Please try again later.") {
  return (req, res, next) => {
    const key = keyGenerator(req);
    if (!limiter.isAllowed(key)) {
      return res.status(429).json({
        success: false,
        message,
      });
    }
    next();
  };
}

export const limitRegistration = createRateLimitMiddleware(
  registrationLimiter,
  (req) => req.ip || req.headers["x-forwarded-for"] || "global",
  "Too many worker registration attempts. Please wait a minute."
);

export const limitClaim = createRateLimitMiddleware(
  claimLimiter,
  (req) => req.workerId || req.query?.workerId || req.body?.workerId || req.ip || "global",
  "Too many claim requests. Please respect the configured polling interval."
);

export const limitAdminActions = createRateLimitMiddleware(
  adminActionLimiter,
  (req) => req.user?.id || req.ip || "global",
  "Too many administrative actions in a short period. Please slow down."
);

export default {
  registrationLimiter,
  claimLimiter,
  adminActionLimiter,
  limitRegistration,
  limitClaim,
  limitAdminActions,
};
