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
     * Check if token has already been used.
     * 
     * NEW: Enforce one-time use
     */
    if (portalToken.usedAt) {
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


/**
 * Helper function to ensure URLs are accessible
 */
function ensureAccessibleUrl(url) {
  if (!url) return null;
  
  // If it's already an absolute URL, return as-is
  if (url.startsWith('https://') || url.startsWith('http://')) {
    return url;
  }
  
  // If it's a relative path starting with /uploads/
  // Convert it to an absolute backend URL
  if (url.startsWith('/uploads/')) {
    const backendUrl = process.env.BACKEND_URL || 'https://ai-interview-system-eewl.vercel.app';
    return `${backendUrl}${url}`;
  }
  
  // Return as-is for other cases
  return url;
}

/**
 * ============================================
 * GET CANDIDATE WITH ASSIGNED PROJECT DETAILS
 * ============================================
 * 
 * Returns candidate along with assigned project
 * and deadline information
 * 
 * Used by:
 * GET /api/student/project
 */

export async function getCandidateWithProject(candidateId) {
  try {
    const candidate = await Candidate.findById(candidateId)
      .populate('assignedProjectId', 'title description difficulty technologies requirements pdfUrl detailedPdfUrl duration durationDays bufferDays')
      .lean();
    
    if (!candidate) {
      return null;
    }
    
    // Enrich with deadline information
    const project = candidate.assignedProjectId;
    let deadlineInfo = {};
    
    if (project && candidate.projectStartAt) {
      // Calculate remaining time if deadline is set
      const now = new Date();
      if (candidate.submissionDeadline) {
        const remainingMs = candidate.submissionDeadline - now;
        deadlineInfo = {
          projectStartAt: candidate.projectStartAt,
          submissionDeadline: candidate.submissionDeadline,
          bufferDeadline: candidate.bufferDeadline,
          remainingMs: remainingMs > 0 ? remainingMs : 0,
          isExpired: candidate.projectSubmissionStatus === 'deadline_expired'
        };
      }
    }
    
    // Convert PDF URLs if project exists
    let processedProject = null;
    if (project) {
      processedProject = {
        id: project._id,
        title: project.title,
        description: project.description,
        difficulty: project.difficulty,
        technologies: project.technologies,
        requirements: project.requirements,
        pdfUrl: ensureAccessibleUrl(project.pdfUrl),
        detailedPdfUrl: ensureAccessibleUrl(project.detailedPdfUrl),
        duration: project.duration
      };
    }
    
    return {
      candidate: {
        id: candidate._id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        role: candidate.role,
        status: candidate.status,
        projectSubmissionStatus: candidate.projectSubmissionStatus,
        projectSubmission: candidate.projectSubmission
      },
      project: processedProject,
      deadline: deadlineInfo
    };
  } catch (error) {
    console.error("Error getting candidate with project:", error);
    throw error;
  }
}

/**
 * ============================================
 * RECORD PROJECT DOWNLOAD
 * ============================================
 * 
 * Records project download timestamp and
 * starts deadline timer if not already started
 * 
 * Used by:
 * POST /api/student/project/download
 */

export async function recordProjectDownload(candidateId) {
  try {
    const candidate = await Candidate.findById(candidateId);
    
    if (!candidate) {
      throw new Error("Candidate not found");
    }
    
    // Check if candidate has assigned project
    if (!candidate.assignedProjectId) {
      throw new Error("No project assigned to candidate");
    }
    
    // Get the project to check PDF availability
    const Project = (await import("../projects/project.model.js")).default;
    const project = await Project.findById(candidate.assignedProjectId);
    
    if (!project) {
      throw new Error("Assigned project not found");
    }
    
    // Check PDF availability
    if (!project.pdfUrl && !project.detailedPdfUrl) {
      throw new Error("Project PDF is not available");
    }
    
    const now = new Date();
    const updates = {
      projectDownloadedAt: now
    };
    
    // If this is the first download, start the deadline timer
    if (!candidate.projectStartAt) {
      // Import deadline service
      const { calculateDeadlines } = await import("../projects/deadline.service.js");
      
      const deadlineInfo = calculateDeadlines(project, now);
      
      Object.assign(updates, {
        projectStartAt: deadlineInfo.projectStartAt,
        submissionDeadline: deadlineInfo.submissionDeadline,
        bufferDeadline: deadlineInfo.bufferDeadline,
        projectSubmissionStatus: "downloaded"
      });
    } else {
      // Update status if needed
      if (candidate.projectSubmissionStatus === "not_started") {
        updates.projectSubmissionStatus = "downloaded";
      }
    }
    
    // Update candidate
    const updatedCandidate = await Candidate.findByIdAndUpdate(
      candidateId,
      updates,
      { new: true }
    );
    
    return {
      candidate: updatedCandidate,
      project: project,
      pdfUrl: ensureAccessibleUrl(project.pdfUrl || project.detailedPdfUrl)
    };
  } catch (error) {
    console.error("Error recording project download:", error);
    throw error;
  }
}

/**
 * ============================================
 * CREATE PROJECT SUBMISSION
 * ============================================
 * 
 * Creates or updates project submission and
 * triggers AI verification process
 * 
 * Used by:
 * POST /api/student/submit-project
 */

export async function createProjectSubmission(candidateId, url) {
  try {
    const candidate = await Candidate.findById(candidateId);
    
    if (!candidate) {
      throw new Error("Candidate not found");
    }
    
    // Check if candidate has assigned project
    if (!candidate.assignedProjectId) {
      throw new Error("No project assigned to candidate");
    }
    
    // Check if project was downloaded (deadlines started)
    if (!candidate.projectStartAt) {
      throw new Error("Project must be downloaded first");
    }
    
    // Check if deadline has expired
    const now = new Date();
    if (candidate.bufferDeadline && now > candidate.bufferDeadline) {
      throw new Error("Submission deadline has expired");
    }
    
    // Validate URL format
    let urlObj;
    try {
      urlObj = new URL(url);
    } catch {
      throw new Error("Invalid URL format");
    }
    
    // Check if URL is http or https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error("URL must use HTTP or HTTPS protocol");
    }
    
    // Import verification tracker
    const verificationTracker = (await import("../projects/verification.tracker.service.js")).verificationTracker;
    
    const submissionData = {
      "projectSubmission.url": url,
      "projectSubmission.submittedAt": now,
      "projectSubmission.validationStatus": "pending",
      "projectSubmission.aiVerificationStatus": "pending",
      "projectSubmission.aiVerificationStartedAt": null,
      "projectSubmission.aiVerificationCompletedAt": null,
      "projectSubmission.aiVerificationResult": null,
      "projectSubmission.verificationStats": null,
      "projectSubmission.adminReview": null
    };
    
    // Add to history if this is a resubmission
    const historyEntry = {
      url,
      submittedAt: now,
      status: "submitted",
      reason: candidate.projectSubmission?.url ? "Resubmission" : "Initial submission"
    };
    
    const historyUpdate = candidate.projectSubmission?.history 
      ? { $push: { "projectSubmission.history": historyEntry } }
      : { $set: { "projectSubmission.history": [historyEntry] } };
    
    // Update candidate
    const updatedCandidate = await Candidate.findByIdAndUpdate(
      candidateId,
      {
        $set: submissionData,
        ...historyUpdate,
        projectSubmissionStatus: "submitted"
      },
      { new: true }
    ).populate('assignedProjectId', 'title');
    
    // Start verification process asynchronously
    startVerificationProcess(candidateId, candidate.assignedProjectId._id, url).catch(error => {
      console.error(`Failed to start verification for candidate ${candidateId}:`, error);
      
      // Update candidate with error status
      Candidate.findByIdAndUpdate(candidateId, {
        $set: {
          "projectSubmissionStatus": "ai_verification_failed",
          "projectSubmission.aiVerificationStatus": "error",
          "projectSubmission.aiVerificationResult.error": error.message
        }
      }).catch(dbError => {
        console.error(`Failed to update candidate error status:`, dbError);
      });
    });
    
    return {
      candidate: updatedCandidate,
      submission: updatedCandidate.projectSubmission
    };
  } catch (error) {
    console.error("Error creating project submission:", error);
    throw error;
  }
}

/**
 * Start verification process for submitted project
 */
async function startVerificationProcess(candidateId, projectId, repositoryUrl) {
  try {
    console.log(`Starting verification process for candidate ${candidateId}`);
    
    // Import verification tracker
    const verificationTracker = (await import("../projects/verification.tracker.service.js")).verificationTracker;
    
    // Start verification using tracker
    const verificationResult = await verificationTracker.startVerification(
      candidateId,
      projectId,
      repositoryUrl
    );
    
    if (!verificationResult.success) {
      throw new Error(`Failed to start verification: ${verificationResult.message}`);
    }
    
    console.log(`Verification started for candidate ${candidateId}, tracking ID: ${verificationResult.trackingId}`);
    
    return verificationResult;
    
  } catch (error) {
    console.error(`Error in startVerificationProcess for candidate ${candidateId}:`, error);
    throw error;
  }
}


/**
 * ============================================
 * MARK PORTAL TOKEN AS USED
 * ============================================
 * 
 * Marks a portal token as used after successful
 * portal access. This enforces one-time use.
 * 
 * Should be called after candidate successfully
 * accesses the portal for the first time.
 */

export async function markPortalTokenAsUsed(rawToken) {
  try {
    if (!rawToken) {
      throw new Error("Token is required");
    }

    // Hash the token
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    // Mark token as used
    const updatedToken = await CandidatePortalToken.findOneAndUpdate(
      {
        tokenHash,
        usedAt: null, // Only update if not already used
        revokedAt: null, // Only update if not revoked
        expiresAt: { $gt: new Date() } // Only update if not expired
      },
      {
        usedAt: new Date()
      },
      { new: true }
    );

    if (!updatedToken) {
      throw new Error("Token not found, already used, or invalid");
    }

    return updatedToken;
  } catch (error) {
    console.error("Error marking portal token as used:", error);
    throw error;
  }
}

/**
 * ============================================
 * UPDATE CANDIDATE PROJECT ASSIGNMENT TIMESTAMP
 * ============================================
 * 
 * Updates candidate with project assignment timestamp
 * when project is assigned by admin.
 * 
 * Should be called from admin candidate approval flow.
 */

export async function updateCandidateProjectAssignment(candidateId, projectId) {
  try {
    const updatedCandidate = await Candidate.findByIdAndUpdate(
      candidateId,
      {
        assignedProjectId: projectId,
        projectAssignedAt: new Date(),
        projectSubmissionStatus: "not_started"
        // DO NOT change status: keep as "approved"
      },
      { new: true }
    );

    if (!updatedCandidate) {
      throw new Error("Candidate not found");
    }

    return updatedCandidate;
  } catch (error) {
    console.error("Error updating candidate project assignment:", error);
    throw error;
  }
}