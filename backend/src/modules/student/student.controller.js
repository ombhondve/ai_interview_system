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
     * NEW: Mark portal token as used after successful verification
     * This enforces one-time use of portal links
     */
    try {
      const { markPortalTokenAsUsed } = await import("./student.service.js");
      await markPortalTokenAsUsed(token);
    } catch (markTokenError) {
      // Log error but don't fail the request
      console.error("Error marking portal token as used:", markTokenError);
      // Token will remain usable, but this is okay for now
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


/**
 * ============================================
 * GET ASSIGNED PROJECT DETAILS
 * ============================================
 * 
 * GET /api/student/project
 * 
 * Returns assigned project with deadline information
 */

export async function getAssignedProjectController(req, res) {
  try {
    const candidate = req.candidate;
    
    if (!candidate) {
      return res.status(401).json({
        message: "Authentication required."
      });
    }
    
    // Import service functions
    const { getCandidateWithProject } = await import("./student.service.js");
    const { canSubmit, formatDeadline, formatRemainingTime } = await import("../projects/deadline.service.js");
    
    const result = await getCandidateWithProject(candidate._id);
    
    if (!result) {
      return res.status(404).json({
        message: "Candidate not found."
      });
    }
    
    // Check if candidate has project assigned
    if (!result.project) {
      return res.status(404).json({
        message: "No project assigned."
      });
    }
    
    // Check submission eligibility
    const submissionCheck = canSubmit(candidate);
    
    // Format response
    const response = {
      candidate: result.candidate,
      project: {
        ...result.project,
        deadline: result.deadline.submissionDeadline ? formatDeadline(result.deadline.submissionDeadline) : null,
        bufferDeadline: result.deadline.bufferDeadline ? formatDeadline(result.deadline.bufferDeadline) : null,
        remainingTime: result.deadline.remainingMs ? formatRemainingTime(result.deadline.remainingMs) : null,
        isExpired: result.deadline.isExpired || false
      },
      submission: {
        allowed: submissionCheck.allowed,
        period: submissionCheck.period,
        reason: submissionCheck.reason,
        message: submissionCheck.message
      }
    };
    
    return res.status(200).json(response);
  } catch (error) {
    console.error("Error getting assigned project:", error);
    return res.status(500).json({
      message: "Unable to load project details."
    });
  }
}

/**
 * ============================================
 * RECORD PROJECT DOWNLOAD
 * ============================================
 * 
 * POST /api/student/project/download
 * 
 * Records project download and starts deadline timer
 */

export async function recordProjectDownloadController(req, res) {
  try {
    const candidate = req.candidate;
    
    if (!candidate) {
      return res.status(401).json({
        message: "Authentication required."
      });
    }
    
    // Import service functions
    const { recordProjectDownload } = await import("./student.service.js");
    const { formatDeadline } = await import("../projects/deadline.service.js");
    
    const updatedCandidate = await recordProjectDownload(candidate._id);
    
    // Format response
    const response = {
      candidate: {
        id: updatedCandidate._id,
        name: updatedCandidate.name
      },
      project: {
        downloadedAt: updatedCandidate.projectDownloadedAt
      },
      deadline: {
        projectStartAt: formatDeadline(updatedCandidate.projectStartAt),
        submissionDeadline: formatDeadline(updatedCandidate.submissionDeadline),
        bufferDeadline: formatDeadline(updatedCandidate.bufferDeadline)
      },
      message: "Project download recorded successfully."
    };
    
    return res.status(200).json(response);
  } catch (error) {
    console.error("Error recording project download:", error);
    
    // Handle specific errors
    if (error.message === "Candidate not found") {
      return res.status(404).json({
        message: "Candidate not found."
      });
    }
    
    if (error.message === "No project assigned to candidate") {
      return res.status(404).json({
        message: "No project assigned."
      });
    }
    
    return res.status(500).json({
      message: "Unable to record project download."
    });
  }
}

/**
 * ============================================
 * SUBMIT PROJECT
 * ============================================
 * 
 * POST /api/student/submit-project
 * 
 * Submits project repository URL
 */

export async function submitProjectController(req, res) {
  try {
    const candidate = req.candidate;
    const { url } = req.body;
    
    if (!candidate) {
      return res.status(401).json({
        message: "Authentication required."
      });
    }
    
    // Validate request body
    if (!url || typeof url !== "string") {
      return res.status(400).json({
        message: "Project URL is required."
      });
    }
    
    // Import service functions
    const { createProjectSubmission } = await import("./student.service.js");
    
    const result = await createProjectSubmission(candidate._id, url);
    
    // Format response
    const response = {
      submission: {
        url: result.submission.url,
        submittedAt: result.submission.submittedAt,
        status: "submitted",
        message: "Project submitted successfully. It will now be validated."
      },
      candidate: {
        id: result.candidate._id,
        name: result.candidate.name,
        projectSubmissionStatus: result.candidate.projectSubmissionStatus
      }
    };
    
    return res.status(200).json(response);
  } catch (error) {
    console.error("Error submitting project:", error);
    
    // Handle specific errors
    const errorMessages = {
      "Candidate not found": "Candidate not found.",
      "No project assigned to candidate": "No project assigned.",
      "Project must be downloaded first": "You must download the project first.",
      "Submission deadline has expired": "Submission deadline has expired.",
      "Invalid URL format": "Please enter a valid URL.",
      "URL must use HTTP or HTTPS protocol": "URL must use HTTP or HTTPS protocol."
    };
    
    const message = errorMessages[error.message] || "Unable to submit project.";
    
    return res.status(400).json({
      message
    });
  }
}

/**
 * ============================================
 * LOGOUT
 * ============================================
 * 
 * POST /api/student/logout
 * 
 * Logs out current student session
 */

export async function logoutController(req, res) {
  try {
    const sessionToken = extractSessionToken(req);
    
    if (sessionToken) {
      // Import verification session model
      const VerificationSession = (await import("../verification/verificationSession.model.js")).default;
      
      // Hash token
      const { hashSessionToken } = await import("../verification/token.service.js");
      const tokenHash = hashSessionToken(sessionToken);
      
      // Revoke session
      await VerificationSession.findOneAndUpdate(
        { sessionToken: tokenHash },
        { revokedAt: new Date() }
      );
    }
    
    // Clear cookie
    res.setHeader('Set-Cookie', [
      'candidate_session=',
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      'Max-Age=0',
      'Path=/'
    ].join('; '));
    
    return res.status(200).json({ 
      message: "Logged out successfully" 
    });
  } catch (error) {
    console.error("Error logging out:", error);
    return res.status(500).json({ 
      message: "Logout failed" 
    });
  }
}

/**
 * Helper: Extract session token from request
 */
function extractSessionToken(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = {};
  
  cookieHeader.split(';').forEach(cookie => {
    const trimmedCookie = cookie.trim();
    
    if (!trimmedCookie) {
      return;
    }
    
    const [name, ...valueParts] = trimmedCookie.split('=');
    
    if (!name) {
      return;
    }
    
    cookies[name] = valueParts.join('=');
  });
  
  return cookies.candidate_session || null;
}