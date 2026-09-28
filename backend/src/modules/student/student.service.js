import crypto from "crypto";

import Candidate from "../candidate/candidate.model.js";
import CandidatePortalToken from "../candidate/CandidatePortalToken.js";

import VerificationSession from "../verification/verificationSession.model.js";

import {
  hashSessionToken,
} from "../verification/token.service.js";

/**
 * ============================================
 * GET CANDIDATE BY INVITATION TOKEN
 * ============================================
 *
 * Used when the candidate first opens the
 * invitation link.
 *
 * Example:
 * GET /api/student/invite?token=xxxxx
 */

export async function getCandidateByPortalToken(
  rawToken
) {
  try {
    if (!rawToken) {
      return null;
    }

    /**
     * Hash the invitation token.
     *
     * The database stores the hash instead
     * of the original token.
     */
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    /**
     * Find the invitation token.
     */
    const portalToken =
      await CandidatePortalToken.findOne({
        tokenHash,
      });

    /**
     * Token does not exist.
     */
    if (!portalToken) {
      return null;
    }

    /**
     * Token has expired.
     */
    if (
      portalToken.expiresAt <=
      new Date()
    ) {
      return null;
    }

    /**
     * Token was revoked.
     */
    if (portalToken.revokedAt) {
      return null;
    }

    /**
     * Find the candidate connected
     * to this invitation token.
     */
    const candidate =
      await Candidate.findById(
        portalToken.candidateId
      );

    /**
     * Candidate does not exist.
     */
    if (!candidate) {
      return null;
    }

    /**
     * Only approved candidates can
     * access the candidate portal.
     */
    if (
      candidate.status !== "approved"
    ) {
      return null;
    }

    return candidate;
  } catch (error) {
    console.error(
      "Error validating candidate portal token:",
      error
    );

    throw error;
  }
}

/**
 * ============================================
 * GET CURRENT STUDENT BY SESSION TOKEN
 * ============================================
 *
 * Used AFTER successful OTP verification.
 *
 * Flow:
 *
 * candidate_session cookie
 *        ↓
 * hash session token
 *        ↓
 * find VerificationSession
 *        ↓
 * check verifiedAt
 *        ↓
 * check sessionExpiresAt
 *        ↓
 * find Candidate
 *        ↓
 * check candidate status
 *        ↓
 * return Candidate
 *
 * Used by:
 *
 * GET /api/student/me
 */

export async function getCandidateBySessionToken(
  rawSessionToken
) {
  try {
    /**
     * No session token provided.
     */
    if (!rawSessionToken) {
      return null;
    }

    /**
     * Hash the raw session token.
     *
     * The database stores the HASH,
     * not the original session token.
     */
    const sessionTokenHash =
      hashSessionToken(
        rawSessionToken
      );

    /**
     * Find a valid verified session.
     *
     * sessionToken:
     *     Must match the hashed cookie token.
     *
     * verifiedAt:
     *     Must exist because OTP must have
     *     already been successfully verified.
     *
     * sessionExpiresAt:
     *     Must be greater than the current time.
     */
    const session =
      await VerificationSession.findOne({
        sessionToken:
          sessionTokenHash,

        verifiedAt: {
          $ne: null,
        },

        sessionExpiresAt: {
          $gt: new Date(),
        },
      });

    /**
     * Session does not exist,
     * has not been verified,
     * or has expired.
     */
    if (!session) {
      return null;
    }

    /**
     * Find the candidate connected
     * to this verification session.
     */
    const candidate =
      await Candidate.findById(
        session.candidateId
      );

    /**
     * Candidate no longer exists.
     */
    if (!candidate) {
      return null;
    }

    /**
     * Candidate must still be approved.
     */
    if (
      candidate.status !== "approved"
    ) {
      return null;
    }

    /**
     * Everything is valid.
     */
    return candidate;
  } catch (error) {
    console.error(
      "Error validating candidate session:",
      error
    );

    throw error;
  }
}