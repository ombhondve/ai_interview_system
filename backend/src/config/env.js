/**
 * Environment configuration validator for RecruitAI Backend
 *
 * Validates critical environment settings at boot and provides clear, actionable
 * guidance without exposing secret values or crashing unit tests.
 */
import logger from "../utils/logger.js";

export function validateEnvironment() {
  const isTest = process.env.NODE_ENV === "test";
  const warnings = [];
  const errors = [];

  // 1. Database URI
  if (!process.env.STORAGE_MONGODB_URI && !process.env.MONGODB_URI) {
    if (!isTest) {
      errors.push("STORAGE_MONGODB_URI is required to connect to the MongoDB database.");
    }
  }

  // 2. Authentication Secret
  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === "production") {
      errors.push("JWT_SECRET is required in production for secure token signing and sessions.");
    } else if (!isTest) {
      warnings.push("JWT_SECRET is not configured; using a default development secret.");
    }
  }

  // 3. AI Provider
  if (!process.env.GROQ_API_KEY && !isTest) {
    warnings.push("GROQ_API_KEY is not configured; AI features (project generation, question generation, and verification) will be unavailable.");
  }

  // 4. Meeting Bot Internal Secret
  if (!process.env.BOT_CONTROL_API_SECRET && !isTest) {
    warnings.push("BOT_CONTROL_API_SECRET is not set; distributed bot workers cannot claim or report interview jobs.");
  }

  // Report findings
  if (warnings.length > 0) {
    warnings.forEach((warning) => logger.warn(`[CONFIG WARNING] ${warning}`));
  }

  if (errors.length > 0) {
    errors.forEach((error) => logger.error(`[CONFIG ERROR] ${error}`));
    if (process.env.NODE_ENV === "production") {
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
