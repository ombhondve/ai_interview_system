/**
 * Face match service
 *
 * This service will be used later if you want
 * to verify the candidate's face using the
 * camera/webcam.
 */

/**
 * Compare candidate selfie with reference image.
 *
 * This is intentionally not implemented yet.
 */
export async function verifyFaceMatch({
  candidateId,
  image,
}) {
  if (!candidateId) {
    throw new Error(
      "Candidate ID is required."
    );
  }

  if (!image) {
    throw new Error(
      "Face image is required."
    );
  }

  /*
   * TODO:
   *
   * 1. Receive candidate image.
   * 2. Get candidate reference photo.
   * 3. Send both to a face verification provider.
   * 4. Get similarity/match result.
   * 5. Store verification result.
   */

  return {
    verified: false,
    message:
      "Face verification is not implemented yet.",
  };
}