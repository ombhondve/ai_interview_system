import mongoose from "mongoose";
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
      "Invitation token received:",
      Boolean(token)
    );

    /**
     * Validate token input.
     */
    if (
      !token ||
      typeof token !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invitation token is required.",
      });
    }

    // Database connection is handled by middleware in app.js
    // No need to connect here - just check if mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      console.error("Database not connected when processing student invite");
      return res.status(500).json({
        success: false,
        message: "Database not ready. Please try again.",
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
        success: false,
        message:
          "Invitation link is invalid or expired.",
      });
    }

    /**
     * NOTE: Portal token is NOT marked as used here.
     * It will be marked as used after successful OTP verification
     * in the /api/verification/verify endpoint.
     * This allows the candidate to retry OTP if needed.
     */

    /**
     * Return only the candidate information
     * required by the frontend.
     */
    return res.status(200).json({
      success: true,
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
      success: false,
      message:
        "Unable to verify invitation.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
     * GET CANDIDATE FROM MIDDLEWARE
     * ==========================================
     *
     * The requireVerifiedSession middleware
     * already validated the session and
     * attached the candidate to req.candidate.
     */

    const candidate = req.candidate;

    /**
     * No authenticated candidate.
     */
    if (!candidate) {
      return res.status(401).json({
        message: "Student session expired.",
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
        jdMatchScore: candidate.jdMatchScore,

        interview: candidate.interview || null,
      },
    });
  } catch (error) {
    console.error(
      "Error getting current student:",
      error
    );

    return res.status(500).json({
      message: "Unable to verify student session.",
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
    console.error("Error getting assigned project:", {
      message: error?.message,
      name: error?.name,
      stack: error?.stack
    });
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
    
    // Clear cookie with environment-aware settings
    const sameSiteValue = process.env.NODE_ENV === "production" ? "none" : "lax";
    res.setHeader('Set-Cookie', `candidate_session=; HttpOnly; Secure; SameSite=${sameSiteValue}; Max-Age=0; Path=/`);
    
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