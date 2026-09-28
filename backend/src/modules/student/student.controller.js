import {
  getCandidateByPortalToken,
  getCandidateBySessionToken,
} from "./student.service.js";

/**
 * ============================================
 * VERIFY CANDIDATE INVITATION TOKEN
 * ============================================
 *
 * GET /api/student/invite?token=...
 *
 * This endpoint is used when the candidate
 * first opens the invitation link.
 */

export async function verifyCandidatePortalTokenController(
  req,
  res
) {
  try {
    const { token } = req.query;

    console.log(
      "Received invitation token:",
      token
    );

    /**
     * Validate token input.
     */
    if (
      !token ||
      typeof token !== "string"
    ) {
      return res.status(400).json({
        message:
          "Invitation token is required.",
      });
    }

    /**
     * Find candidate using the invitation
     * token.
     */
    const candidate =
      await getCandidateByPortalToken(
        token
      );

    /**
     * Token is invalid, expired,
     * revoked, or candidate does not exist.
     */
    if (!candidate) {
      return res.status(401).json({
        message:
          "Invitation link is invalid or expired.",
      });
    }

    /**
     * Return only the candidate information
     * required by the frontend.
     */
    return res.status(200).json({
      candidate: {
        id: candidate._id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        role: candidate.role,
        status: candidate.status,
      },
    });
  } catch (error) {
    console.error(
      "Error verifying candidate portal token:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to verify invitation.",
    });
  }
}

/**
 * ============================================
 * GET CURRENT STUDENT
 * ============================================
 *
 * GET /api/student/me
 *
 * This endpoint is called AFTER successful
 * OTP verification.
 *
 * Flow:
 *
 * Browser
 *    ↓
 * candidate_session cookie
 *    ↓
 * Next.js /api/student/me
 *    ↓
 * Backend /api/student/me
 *    ↓
 * Validate session
 *    ↓
 * Find candidate
 *    ↓
 * Return candidate
 */

export async function getCurrentStudentController(
  req,
  res
) {
  try {
    /**
     * ==========================================
     * READ candidate_session COOKIE
     * ==========================================
     *
     * We read the cookie manually.
     *
     * This means cookie-parser is NOT required.
     */

    const cookieHeader =
      req.headers.cookie || "";

    const cookies = {};

    /**
     * Convert:
     *
     * candidate_session=abc123; other=value
     *
     * into:
     *
     * {
     *   candidate_session: "abc123",
     *   other: "value"
     * }
     */
    cookieHeader
      .split(";")
      .forEach((cookie) => {
        const trimmedCookie =
          cookie.trim();

        if (!trimmedCookie) {
          return;
        }

        const [
          name,
          ...valueParts
        ] =
          trimmedCookie.split("=");

        if (!name) {
          return;
        }

        cookies[name] =
          valueParts.join("=");
      });

    /**
     * Get the candidate session token.
     */
    const sessionToken =
      cookies.candidate_session;

    /**
     * No session cookie.
     */
    if (!sessionToken) {
      return res.status(401).json({
        message:
          "Student session expired.",
      });
    }

    console.log(
      "Candidate session received."
    );

    /**
     * ==========================================
     * VALIDATE SESSION
     * ==========================================
     *
     * The service will:
     *
     * 1. Hash the session token.
     * 2. Find the VerificationSession.
     * 3. Check OTP verification.
     * 4. Check session expiry.
     * 5. Find the candidate.
     * 6. Check candidate status.
     */

    const candidate =
      await getCandidateBySessionToken(
        sessionToken
      );

    /**
     * Session is invalid or expired.
     */
    if (!candidate) {
      return res.status(401).json({
        message:
          "Student session expired or invalid.",
      });
    }

    /**
     * ==========================================
     * RETURN CURRENT STUDENT
     * ==========================================
     */

    return res.status(200).json({
      candidate: {
        id: candidate._id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        role: candidate.role,
        status: candidate.status,

        /**
         * These fields are returned if they
         * exist on the Candidate model.
         */
        jdMatchScore:
          candidate.jdMatchScore,

        interview:
          candidate.interview || null,
      },
    });
  } catch (error) {
    console.error(
      "Error getting current student:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to verify student session.",
    });
  }
}