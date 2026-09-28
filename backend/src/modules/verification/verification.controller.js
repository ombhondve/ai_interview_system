import {
  createVerificationSession,
  verifyCandidateOtp,
} from "./verification.service.js";

/**
 * POST /api/verification/send
 *
 * Generates an OTP, stores its hash,
 * and sends the OTP through email or SMS.
 */
export async function sendOtpController(req, res) {
  try {
    const { candidateId, identifier } = req.body;
    console.log("Send OTP request:", {
      candidateId,
      identifier,
    });
    if (!candidateId) {
      return res.status(400).json({
        message: "Candidate ID is required.",
      });
    }

    if (!identifier || typeof identifier !== "string") {
      return res.status(400).json({
        message:
          "Email or phone number is required.",
      });
    }

    const result = await createVerificationSession(
      candidateId,
      identifier.trim()
    );

    return res.status(200).json({
      message: "OTP sent successfully.",
      channel: result.channel,
    });
  } catch (error) {
    console.error("Send OTP error:", error);

    return res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to send OTP.",
    });
  }
}

/**
 * POST /api/verification/verify
 *
 * Verifies the OTP and creates the
 * candidate's authenticated session.
 */
export async function verifyOtpController(req, res) {
  try {
    const { identifier, otp } = req.body;

    if (!identifier || typeof identifier !== "string") {
      return res.status(400).json({
        message:
          "Email or phone number is required.",
      });
    }

    if (!otp || typeof otp !== "string") {
      return res.status(400).json({
        message: "OTP is required.",
      });
    }

    const cleanIdentifier = identifier.trim();
    const cleanOtp = otp.trim();

    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({
        message: "OTP must be a 6-digit number.",
      });
    }

    const result = await verifyCandidateOtp(
      cleanIdentifier,
      cleanOtp
    );

    /**
     * The raw session token is stored only
     * in the browser's HttpOnly cookie.
     *
     * Only the hashed version is stored
     * in MongoDB.
     */
    res.cookie(
      "candidate_session",
      result.sessionToken,
      {
        httpOnly: true,

        secure:
          process.env.NODE_ENV === "production",

        sameSite: "lax",

        maxAge:
          24 * 60 * 60 * 1000,

        path: "/",
      }
    );

    return res.status(200).json({
      message:
        "OTP verified successfully.",

      candidate: {
        id: result.candidate._id,
        name: result.candidate.name,
        email: result.candidate.email,
        phone: result.candidate.phone,
        role: result.candidate.role,
        status: result.candidate.status,
      },
    });
  } catch (error) {
    console.error("Verify OTP error:", error);

    return res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to verify OTP.",
    });
  }
}