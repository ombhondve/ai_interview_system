/**
 * Data Cleanup Service
 *
 * Implements safe, idempotent data-retention and cleanup operations for disposable records:
 * 1. Abandoned (unverified) OTP sessions older than the grace period.
 * 2. Expired Candidate Portal Tokens older than the retention period.
 * 3. Completed or failed BotJobs older than the retention period.
 *
 * SAFETY INVARIANTS:
 * - NEVER deletes verified sessions (sessionToken != null).
 * - NEVER deletes active portal tokens (expiresAt > now).
 * - NEVER deletes active bot jobs (status in QUEUED, CLAIMED, RUNNING).
 * - NEVER deletes candidates, interviews, transcripts, reports, or audit logs.
 */

import VerificationSession from "../modules/verification/verificationSession.model.js";
import CandidatePortalToken from "../modules/candidate/CandidatePortalToken.js";
import BotJob from "../modules/botControl/botJob.model.js";
import logger from "../utils/logger.js";

/**
 * Clean up abandoned (unverified) OTP verification sessions.
 * Only sessions where sessionToken is null and otpExpiresAt is older than maxAgeHours are removed.
 * Verified candidate sessions are NEVER touched by this function.
 *
 * @param {Object} options
 * @param {number} [options.maxAgeHours=1] - Hours after otpExpiresAt before deleting
 * @returns {Promise<{ deletedCount: number }>}
 */
export async function cleanupAbandonedVerificationSessions({ maxAgeHours = 1 } = {}) {
  try {
    const cutoffDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    const query = {
      sessionToken: null,
      otpExpiresAt: { $lt: cutoffDate },
    };

    const result = await VerificationSession.deleteMany(query);
    const count = result.deletedCount || 0;
    if (count > 0) {
      logger.info(`[CLEANUP] Deleted ${count} abandoned unverified OTP session(s) older than ${maxAgeHours}h.`);
    }
    return { deletedCount: count };
  } catch (err) {
    logger.error(`[CLEANUP] Failed to cleanup abandoned verification sessions: ${err.message}`);
    return { deletedCount: 0, error: err.message };
  }
}

/**
 * Clean up expired Candidate Portal Tokens that exceed the post-expiry retention window.
 * Active tokens (expiresAt > now) are NEVER matched or deleted.
 *
 * @param {Object} options
 * @param {number} [options.retentionDays=30] - Days past expiresAt before deletion
 * @returns {Promise<{ deletedCount: number }>}
 */
export async function cleanupExpiredCandidatePortalTokens({ retentionDays = 30 } = {}) {
  try {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const query = {
      expiresAt: { $lt: cutoffDate },
    };

    const result = await CandidatePortalToken.deleteMany(query);
    const count = result.deletedCount || 0;
    if (count > 0) {
      logger.info(`[CLEANUP] Deleted ${count} expired candidate portal token(s) older than ${retentionDays}d.`);
    }
    return { deletedCount: count };
  } catch (err) {
    logger.error(`[CLEANUP] Failed to cleanup expired portal tokens: ${err.message}`);
    return { deletedCount: 0, error: err.message };
  }
}

/**
 * Clean up terminal (COMPLETED or FAILED) BotJobs older than the retention period.
 * Active jobs (QUEUED, CLAIMED, RUNNING) are STRICTLY excluded and will never be deleted.
 *
 * @param {Object} options
 * @param {number} [options.retentionDays=30] - Days past terminal completion/failure
 * @returns {Promise<{ deletedCount: number }>}
 */
export async function cleanupOldBotJobs({ retentionDays = 30 } = {}) {
  try {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const query = {
      status: { $in: ["COMPLETED", "FAILED"] },
      $or: [
        { completedAt: { $lt: cutoffDate } },
        { failedAt: { $lt: cutoffDate } },
        { updatedAt: { $lt: cutoffDate } },
      ],
    };

    const result = await BotJob.deleteMany(query);
    const count = result.deletedCount || 0;
    if (count > 0) {
      logger.info(`[CLEANUP] Deleted ${count} terminal bot job(s) older than ${retentionDays}d.`);
    }
    return { deletedCount: count };
  } catch (err) {
    logger.error(`[CLEANUP] Failed to cleanup old bot jobs: ${err.message}`);
    return { deletedCount: 0, error: err.message };
  }
}

/**
 * Run all safe backend data cleanups.
 * Safe to be executed periodically (e.g. daily interval or administrative trigger).
 *
 * @param {Object} [options]
 * @returns {Promise<{ unverifiedSessionsDeleted: number, expiredTokensDeleted: number, oldBotJobsDeleted: number }>}
 */
export async function runAllBackendCleanups(options = {}) {
  logger.info("[CLEANUP] Starting safe backend data cleanup cycle...");

  const [otpRes, tokenRes, jobRes] = await Promise.all([
    cleanupAbandonedVerificationSessions(options),
    cleanupExpiredCandidatePortalTokens(options),
    cleanupOldBotJobs(options),
  ]);

  const summary = {
    unverifiedSessionsDeleted: otpRes.deletedCount || 0,
    expiredTokensDeleted: tokenRes.deletedCount || 0,
    oldBotJobsDeleted: jobRes.deletedCount || 0,
    completedAt: new Date().toISOString(),
  };

  logger.info(`[CLEANUP] Backend data cleanup completed: ${JSON.stringify(summary)}`);
  return summary;
}

export default {
  cleanupAbandonedVerificationSessions,
  cleanupExpiredCandidatePortalTokens,
  cleanupOldBotJobs,
  runAllBackendCleanups,
};
