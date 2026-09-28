import Candidate from "../candidate/candidate.model.js";
import VerificationSession from "./verificationSession.model.js";

import {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  getOtpExpiry,
} from "./otp.service.js";

import {
  generateSessionToken,
  hashSessionToken,
  getSessionExpiry,
} from "./token.service.js";

import { sendOtp } from "./otp.delivery.service.js";

/**
 * Maximum incorrect OTP attempts.
 */
const MAX_ATTEMPTS = 5;

/**
 * Generate, store, and send a new OTP.
 */
export async function createVerificationSession(
  candidateId,
  identifier
) {
  if (!candidateId) {
    throw new Error(
      "Candidate ID is required."
    );
  }

  if (
    !identifier ||
    typeof identifier !== "string"
  ) {
    throw new Error(
      "Email or phone number is required."
    );
  }

  const cleanIdentifier =
    identifier.trim();

  const candidate =
    await Candidate.findById(candidateId);

  if (!candidate) {
    throw new Error(
      "Candidate not found."
    );
  }

  if (candidate.status !== "approved") {
    throw new Error(
      "Candidate is not approved."
    );
  }

  /**
   * Generate a new 6-digit OTP.
   */
  const otp = generateOtp();

  /**
   * Store only the OTP hash.
   */
  const otpHash = hashOtp(otp);

  /**
   * OTP expires after 10 minutes.
   */
  const otpExpiresAt =
    getOtpExpiry(10);

  /**
   * Remove previous verification
   * sessions for this candidate.
   */
  await VerificationSession.deleteMany({
    candidateId: candidate._id,
  });

  /**
   * Create verification session.
   *
   * The authenticated session token
   * will be created only after the
   * OTP is successfully verified.
   */
  const session =
    await VerificationSession.create({
      candidateId: candidate._id,

      identifier: cleanIdentifier,

      otpHash,

      otpExpiresAt,

      attempts: 0,

      sessionToken: null,

      sessionExpiresAt: null,

      verifiedAt: null,
    });

  /**
   * Send the REAL OTP.
   *
   * Email → Nodemailer
   * Phone → Twilio
   */
  let delivery;

  try {
    delivery = await sendOtp(
      cleanIdentifier,
      otp
    );
  } catch (error) {
    /**
     * If email/SMS delivery fails,
     * remove the unusable session.
     */
    await VerificationSession.deleteOne({
      _id: session._id,
    });

    throw error;
  }

  /**
   * Never return the OTP.
   */
  return {
    session,
    channel: delivery.channel,
  };
}

/**
 * Verify the candidate OTP.
 */
export async function verifyCandidateOtp(
  identifier,
  otp
) {
  if (
    !identifier ||
    typeof identifier !== "string"
  ) {
    throw new Error(
      "Email or phone number is required."
    );
  }

  if (
    !otp ||
    typeof otp !== "string"
  ) {
    throw new Error(
      "OTP is required."
    );
  }

  const cleanIdentifier =
    identifier.trim();

  const cleanOtp = otp.trim();

  /**
   * OTP must contain exactly 6 digits.
   */
  if (!/^\d{6}$/.test(cleanOtp)) {
    throw new Error(
      "OTP must be a 6-digit number."
    );
  }

  /**
   * Find the active verification session.
   */
  const session =
    await VerificationSession.findOne({
      identifier: cleanIdentifier,
      verifiedAt: null,
    });

  if (!session) {
    throw new Error(
      "No active verification request. Please request a new OTP."
    );
  }

  /**
   * Check OTP expiry.
   */
  if (
    session.otpExpiresAt <=
    new Date()
  ) {
    throw new Error(
      "OTP has expired. Please request a new OTP."
    );
  }

  /**
   * Check maximum incorrect attempts.
   */
  if (
    session.attempts >=
    MAX_ATTEMPTS
  ) {
    throw new Error(
      "Too many incorrect attempts. Please request a new OTP."
    );
  }

  /**
   * Compare entered OTP with
   * the stored OTP hash.
   */
  const valid = verifyOtpHash(
    cleanOtp,
    session.otpHash
  );

  /**
   * Invalid OTP.
   */
  if (!valid) {
    session.attempts += 1;

    await session.save();

    if (
      session.attempts >=
      MAX_ATTEMPTS
    ) {
      throw new Error(
        "Too many incorrect attempts. Please request a new OTP."
      );
    }

    throw new Error("Invalid OTP.");
  }

  /**
   * OTP is correct.
   *
   * Mark the verification session
   * as verified.
   *
   * IMPORTANT:
   * We do NOT set otpHash to undefined.
   * The schema requires otpHash.
   *
   * verifiedAt prevents this OTP session
   * from being used again.
   */
  session.verifiedAt =
    new Date();

  /**
   * Generate the authenticated
   * candidate session now.
   */
  const sessionToken =
    generateSessionToken();

  /**
   * Store only the hash of the
   * session token in MongoDB.
   */
  const sessionTokenHash =
    hashSessionToken(sessionToken);

  /**
   * Candidate session expires
   * after 24 hours.
   */
  const sessionExpiresAt =
    getSessionExpiry(24);

  /**
   * Store only the hashed session
   * token in MongoDB.
   */
  session.sessionToken =
    sessionTokenHash;

  session.sessionExpiresAt =
    sessionExpiresAt;

  await session.save();

  /**
   * Find the candidate.
   */
  const candidate =
    await Candidate.findById(
      session.candidateId
    );

  if (!candidate) {
    throw new Error(
      "Candidate not found."
    );
  }

  /**
   * Return the RAW session token.
   *
   * The controller places this into
   * an HttpOnly cookie.
   *
   * MongoDB contains only the hash.
   */
  return {
    candidate,
    sessionToken,
    sessionExpiresAt,
  };
}