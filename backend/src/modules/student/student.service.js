import crypto from "crypto";

import Candidate from "../candidate/candidate.model.js";
import CandidatePortalToken from "../candidate/CandidatePortalToken.js";

import VerificationSession from "../verification/verificationSession.model.js";

import {
  hashSessionToken,
} from "../verification/token.service.js";

import { keepInvocationAlive } from "../../utils/vercelBackground.js";
import { createSubmissionId, deriveVerificationState } from "../projects/verificationState.js";
import { startVerificationProgress } from "../projects/verificationProgress.service.js";
import { preflightRepositoryFetch } from "../projects/repository.service.js";

/**
 * Student-safe messages for repository fetch failures during submission.
 *
 * ONLY these pre-approved strings are ever returned to the client. Internal
 * fetch details (network/API errors, stack traces) are logged server-side
 * and never attached to the error that reaches the controller response.
 */
const REPOSITORY_FETCH_MESSAGES = {
  default:
    "Unable to fetch the repository. Please check the URL and submit again.",
  timeout:
    "The repository took too long to respond. Please try again.",
  empty_repository:
    "The repository appears to be empty. Please add your project files and submit again."
};

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
      .populate('assignedProjectId', 'title description difficulty technologies requirements pdfUrl detailedPdfUrl briefUrl duration durationDays bufferDays')
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
      console.log("DEBUG - Student project PDF fields:", {
        projectId: project._id,
        title: project.title,
        hasPdfUrl: !!project.pdfUrl,
        hasDetailedPdfUrl: !!project.detailedPdfUrl,
        hasBriefUrl: !!project.briefUrl,
        pdfUrl: project.pdfUrl ? (typeof project.pdfUrl === 'string' ? project.pdfUrl.substring(0, 50) + '...' : 'non-string') : null,
        detailedPdfUrl: project.detailedPdfUrl ? (typeof project.detailedPdfUrl === 'string' ? project.detailedPdfUrl.substring(0, 50) + '...' : 'non-string') : null,
        briefUrl: project.briefUrl ? (typeof project.briefUrl === 'string' ? project.briefUrl.substring(0, 50) + '...' : 'non-string') : null,
        candidateId: candidate._id,
        candidateName: candidate.name
      });
      
      // Determine the primary PDF URL to return
      // Try pdfUrl first, then detailedPdfUrl, then briefUrl
      const primaryPdfUrl = project.pdfUrl || project.detailedPdfUrl || project.briefUrl;
      
      processedProject = {
        id: project._id,
        title: project.title,
        description: project.description,
        difficulty: project.difficulty,
        technologies: project.technologies,
        requirements: project.requirements,
        pdfUrl: ensureAccessibleUrl(primaryPdfUrl),
        detailedPdfUrl: ensureAccessibleUrl(project.detailedPdfUrl),
        briefUrl: ensureAccessibleUrl(project.briefUrl),
        duration: project.duration
      };
      
      console.log("DEBUG - Processed student project PDF URLs:", {
        returnedPdfUrl: processedProject.pdfUrl ? processedProject.pdfUrl.substring(0, 50) + '...' : null,
        returnedDetailedPdfUrl: processedProject.detailedPdfUrl ? processedProject.detailedPdfUrl.substring(0, 50) + '...' : null,
        hasReturnedPdfUrl: !!processedProject.pdfUrl,
        primaryPdfUrlSource: project.pdfUrl ? 'pdfUrl' : project.detailedPdfUrl ? 'detailedPdfUrl' : project.briefUrl ? 'briefUrl' : 'none'
      });
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
        projectSubmission: candidate.projectSubmission,
        // Student-facing verification state (single source of truth).
        verification: deriveVerificationState(candidate)
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
    
    // Check PDF availability - check all three possible PDF fields
    const hasPdfUrl = project.pdfUrl || project.detailedPdfUrl || project.briefUrl;
    if (!hasPdfUrl) {
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
      pdfUrl: ensureAccessibleUrl(project.pdfUrl || project.detailedPdfUrl || project.briefUrl)
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

    // ---------------------------------------------------------------
    // Repository fetch pre-flight — BEFORE any database write.
    //
    // The submission must never enter the verification pipeline unless the
    // submitted repository can actually be fetched. Because this runs before
    // the submission is persisted, a failed fetch leaves the student in the
    // "not submitted" state, so the controller can return a fetch-specific
    // non-success response and the student stays on the Submit URL page to
    // correct the URL and retry.
    //
    // Existing validation errors (deadline, no project, invalid URL, ...)
    // are checked ABOVE and still take precedence — they are NOT reported
    // as repository-fetch failures.
    // ---------------------------------------------------------------
    let repositoryPreflight;
    try {
      repositoryPreflight = await preflightRepositoryFetch(url);
    } catch (fetchError) {
      // Defensive: preflightRepositoryFetch is not supposed to throw, but an
      // unexpected throw must still fail safe as a fetch failure (never as a
      // success, and never by leaking internals to the client).
      repositoryPreflight = {
        fetchable: false,
        errorType: "unexpected",
        reason: fetchError?.message
      };
    }

    if (!repositoryPreflight?.fetchable) {
      // Internal detail stays in server logs only.
      console.error("Repository fetch pre-flight failed:", {
        candidateId,
        url,
        errorType: repositoryPreflight?.errorType,
        reason: repositoryPreflight?.reason
      });

      const fetchError = new Error(
        REPOSITORY_FETCH_MESSAGES[repositoryPreflight?.errorType] ||
          REPOSITORY_FETCH_MESSAGES.default
      );
      fetchError.code = "REPOSITORY_FETCH_FAILED";
      throw fetchError;
    }

    // Identify this specific submission so an older background verification
    // can never overwrite the result of this newer one.
    const submissionId = createSubmissionId();

    const submissionData = {
      "projectSubmission.url": url,
      "projectSubmission.submittedAt": now,
      "projectSubmission.submissionId": submissionId,
      "projectSubmission.validationStatus": "pending",
      "projectSubmission.aiVerificationStatus": "processing",
      "projectSubmission.aiVerificationStartedAt": now,
      "projectSubmission.aiVerificationCompletedAt": null,
      "projectSubmission.verificationProgress": {
        stage: "validating",
        label: "Validating repository",
        status: "active",
        completed: false,
        failed: false,
        message: "Checking the submitted project URL...",
        updatedAt: now
      },
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

    // Build update operation - handle history based on whether it exists
    let updateOperation = {
      $set: {
        ...submissionData,
        projectSubmissionStatus: "verification_processing"
      },

      // Explicitly remove the previous verification's result and stored
      // evidence so a previous REJECTED / ACCEPTED result cannot linger on the
      // page while the new submission is still being verified.
      // Unset (rather than null) so schema defaults are not re-applied.
      $unset: {
        "projectSubmission.aiVerificationResult": "",
        "projectSubmission.verificationEvidence": "",
        "projectSubmission.aiVerificationDurationMs": ""
      }
    };
    
    if (candidate.projectSubmission?.history) {
      // For resubmission: add to existing history with $push
      updateOperation.$push = { "projectSubmission.history": historyEntry };
    } else {
      // For initial submission: set history array with $set
      updateOperation.$set["projectSubmission.history"] = [historyEntry];
    }
    
    // Update candidate
    const updatedCandidate = await Candidate.findByIdAndUpdate(
      candidateId,
      updateOperation,
      { new: true }
    ).populate('assignedProjectId', 'title');

    // Reset the persisted verification progress history for this NEW submission
    // so the student never sees the previous submission's stages replayed.
    // Guarded by submissionId, exactly like every later progress write.
    await startVerificationProgress(candidateId, submissionId);
    
    // Start verification process asynchronously with correct project ID
    // candidate.assignedProjectId is already the ObjectId or string, not an object with _id
    //
    // Verification (GitHub fetch + AI analysis + storage) takes far longer than
    // this request, and the response is returned immediately below. On Vercel
    // the invocation would normally be terminated as soon as the response is
    // sent, so the promise is registered with waitUntil() to keep the runtime
    // alive. The student never waits for verification to finish.
    const verificationTask = startVerificationProcess(
      candidateId,
      candidate.assignedProjectId,
      url,
      submissionId
    )
      .then((verificationResult) => verificationResult?.verificationPromise)
      .catch((error) => {
        console.error(`Failed to start verification for candidate ${candidateId}:`, error);

        // Update candidate with error status
        return Candidate.findByIdAndUpdate(candidateId, {
          $set: {
            "projectSubmissionStatus": "ai_verification_failed",
            "projectSubmission.aiVerificationStatus": "error",
            "projectSubmission.aiVerificationResult.error": error.message
          }
        }).catch((dbError) => {
          console.error(`Failed to update candidate error status:`, dbError);
        });
      });

    // Keep the serverless invocation alive until verification completes.
    // No-op outside Vercel (e.g. local `npm start`).
    keepInvocationAlive(verificationTask);
    
    return {
      candidate: updatedCandidate,
      submission: updatedCandidate.projectSubmission
    };
  } catch (error) {
    console.error("Error creating project submission:", {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      candidateId,
      url
    });
    throw error;
  }
}

/**
 * Start verification process for submitted project
 */
async function startVerificationProcess(candidateId, projectId, repositoryUrl, submissionId) {
  try {
    console.log(`Starting verification process for candidate ${candidateId}`);
    
    // Import verification tracker
    const verificationTracker = (await import("../projects/verification.tracker.service.js")).verificationTracker;
    
    // Start verification using tracker
    const verificationResult = await verificationTracker.startVerification(
      candidateId,
      projectId,
      repositoryUrl,
      submissionId
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