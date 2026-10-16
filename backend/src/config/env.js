/**
 * Environment configuration validator for RecruitAI Backend
 *
 * Validates critical environment settings at boot and provides clear, actionable
 * guidance without exposing secret values or crashing unit tests.
 * Only validates active, supported application integrations.
 */
import "dotenv/config";
import logger from "../utils/logger.js";

export function validateEnvironment() {
  const isTest = process.env.NODE_ENV === "test";
  const isProduction = process.env.NODE_ENV === "production";
  const warnings = [];
  const errors = [];

  // 1. Port & Runtime
  if (process.env.PORT) {
    const port = Number(process.env.PORT);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      errors.push("PORT must be a valid integer between 1 and 65535.");
    }
  }

  // 2. Database URI (STORAGE_MONGODB_URI or MONGODB_URI)
  const mongoUri = process.env.STORAGE_MONGODB_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    if (!isTest) {
      errors.push("STORAGE_MONGODB_URI (or MONGODB_URI) is required to connect to the MongoDB database.");
    }
  } else if (!mongoUri.startsWith("mongodb://") && !mongoUri.startsWith("mongodb+srv://")) {
    errors.push("STORAGE_MONGODB_URI must start with 'mongodb://' or 'mongodb+srv://'.");
  }

  // 3. Frontend URL & CORS
  if (process.env.FRONTEND_URL) {
    try {
      new URL(process.env.FRONTEND_URL);
    } catch {
      warnings.push("FRONTEND_URL should be a valid absolute URL (e.g., 'http://localhost:3000' or 'https://your-domain.vercel.app').");
    }
  }

  // 4. Authentication Secret
  if (!process.env.JWT_SECRET) {
    if (isProduction) {
      errors.push("JWT_SECRET is required in production for secure token signing and sessions.");
    } else if (!isTest) {
      warnings.push("JWT_SECRET is not configured; using a default development secret.");
    }
  } else if (isProduction && process.env.JWT_SECRET.length < 32) {
    warnings.push("JWT_SECRET is shorter than 32 characters; consider generating a high-entropy 256-bit secret.");
  }

  // 5. AI Provider (Groq)
  if (!process.env.GROQ_API_KEY && !isTest) {
    warnings.push("GROQ_API_KEY is not configured; AI features (project generation, question generation, and verification) will be unavailable.");
  }

  // 6. Meeting Bot Shared Secret
  if (!process.env.BOT_CONTROL_API_SECRET && !process.env.RECRUITAI_INTERNAL_API_SECRET && !process.env.MEETING_BOT_API_SECRET && !isTest) {
    warnings.push("BOT_CONTROL_API_SECRET is not set; distributed bot workers cannot claim or report interview jobs.");
  }

  // 7. Google Token Encryption Key (for OAuth refresh token storage in MongoDB)
  if (process.env.GOOGLE_TOKEN_ENCRYPTION_KEY) {
    try {
      const key = Buffer.from(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY, "base64");
      if (key.length !== 32) {
        errors.push("GOOGLE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key (generate with 'openssl rand -base64 32').");
      }
    } catch {
      errors.push("GOOGLE_TOKEN_ENCRYPTION_KEY is not valid base64.");
    }
  }

  // 8. Google Calendar OAuth Pair Check
  if (process.env.GOOGLE_CALENDAR_CLIENT_ID && !process.env.GOOGLE_CALENDAR_CLIENT_SECRET) {
    warnings.push("GOOGLE_CALENDAR_CLIENT_ID is set but GOOGLE_CALENDAR_CLIENT_SECRET is missing.");
  } else if (!process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET) {
    warnings.push("GOOGLE_CALENDAR_CLIENT_SECRET is set but GOOGLE_CALENDAR_CLIENT_ID is missing.");
  }

  // 9. Google Sign-In OAuth Pair Check
  if (process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_SECRET) {
    warnings.push("GOOGLE_CLIENT_ID is set but GOOGLE_CLIENT_SECRET is missing.");
  } else if (!process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    warnings.push("GOOGLE_CLIENT_SECRET is set but GOOGLE_CLIENT_ID is missing.");
  }

  // 10. GitHub Token Check (Optional, avoids rate limiting)
  if (!process.env.GITHUB_TOKEN && !isTest) {
    warnings.push("GITHUB_TOKEN is not configured; GitHub API calls will be subject to anonymous rate limit (60 requests/hour per IP).");
  }

  // Report findings safely (never exposing secret values)
  if (warnings.length > 0) {
    warnings.forEach((warning) => logger.warn(`[CONFIG WARNING] ${warning}`));
  }

  if (errors.length > 0) {
    errors.forEach((error) => logger.error(`[CONFIG ERROR] ${error}`));
    if (isProduction) {
      throw new Error(`Startup halted due to missing critical environment configuration: ${errors.join("; ")}`);
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors
  };
}

export default validateEnvironment;
