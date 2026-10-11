import crypto from "crypto";

/**
 * Generate a cryptographically secure 6-digit OTP.
 */
export function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash OTP before storing it in MongoDB.
 */
export function hashOtp(otp) {
  return crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");
}

/**
 * Compare an entered OTP with the stored hash.
 */
export function verifyOtpHash(otp, storedHash) {
  if (!otp || !storedHash) {
    return false;
  }

  const enteredHash = hashOtp(otp);

  const enteredBuffer = Buffer.from(
    enteredHash,
    "hex"
  );

  const storedBuffer = Buffer.from(
    storedHash,
    "hex"
  );

  if (
    enteredBuffer.length !==
    storedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    enteredBuffer,
    storedBuffer
  );
}

/**
 * Generate OTP expiry time.
 *
 * Default: 60 seconds.
 * Accepts seconds (default: 60).
 */
export function getOtpExpiry(seconds = 60) {
  return new Date(
    Date.now() + seconds * 1000
  );
}