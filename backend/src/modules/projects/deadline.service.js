/**
 * Deadline calculation service
 * 
 * Calculates project deadlines based on:
 * - Project duration (string: "14 days", "2 weeks", etc.)
 * - First download timestamp
 * - Buffer period
 */

/**
 * Parse duration string to days
 * 
 * Supported formats:
 * - "14 days"
 * - "2 weeks"
 * - "1 month"
 * - "30"
 * - "90"
 */
export function parseDurationDays(durationString) {
  if (!durationString) {
    return 14; // Default 2 weeks
  }

  const value = String(durationString).trim().toLowerCase();

  // Just a number: "30"
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  // Days
  const dayMatch = value.match(/(\d+(?:\.\d+)?)\s*days?/);
  if (dayMatch) {
    return Number(dayMatch[1]);
  }

  // Weeks
  const weekMatch = value.match(/(\d+(?:\.\d+)?)\s*weeks?/);
  if (weekMatch) {
    return Number(weekMatch[1]) * 7;
  }

  // Months
  const monthMatch = value.match(/(\d+(?:\.\d+)?)\s*months?/);
  if (monthMatch) {
    return Number(monthMatch[1]) * 30; // Approximation
  }

  // Years
  const yearMatch = value.match(/(\d+(?:\.\d+)?)\s*years?/);
  if (yearMatch) {
    return Number(yearMatch[1]) * 365;
  }

  // Default fallback
  return 14;
}

/**
 * Add days to a date
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calculate project deadlines
 * 
 * @param {Object} project - Project document with durationDays and bufferDays
 * @param {Date} downloadTime - When student first downloaded project
 * @returns {Object} Deadline information
 */
export function calculateDeadlines(project, downloadTime) {
  const durationDays = project.durationDays || parseDurationDays(project.duration);
  const bufferDays = project.bufferDays || 1;
  
  const projectStartAt = downloadTime;
  const submissionDeadline = addDays(projectStartAt, durationDays);
  const bufferDeadline = addDays(submissionDeadline, bufferDays);
  
  return {
    projectStartAt,
    submissionDeadline,
    bufferDeadline,
    durationDays,
    bufferDays
  };
}

/**
 * Check if submission is currently allowed
 * 
 * @param {Object} candidate - Candidate document with deadline fields
 * @returns {Object} Submission permission info
 */
export function canSubmit(candidate) {
  const now = new Date();
  
  // If no deadlines are set yet (project not downloaded)
  if (!candidate.submissionDeadline) {
    return { 
      allowed: false, 
      reason: "project_not_downloaded",
      message: "Project must be downloaded first."
    };
  }
  
  // Before normal deadline
  if (now < candidate.submissionDeadline) {
    return { 
      allowed: true, 
      period: "normal",
      remainingMs: candidate.submissionDeadline - now,
      deadline: candidate.submissionDeadline
    };
  }
  
  // During buffer period
  if (now < candidate.bufferDeadline) {
    return { 
      allowed: true, 
      period: "buffer",
      remainingMs: candidate.bufferDeadline - now,
      deadline: candidate.bufferDeadline
    };
  }
  
  // After buffer - deadline expired
  return { 
    allowed: false, 
    reason: "deadline_expired",
    period: "expired",
    message: "Submission deadline has expired."
  };
}

/**
 * Submission statuses that mean the project's AI verification reached the
 * VERIFIED verdict. A candidate in any other state is NOT interview eligible.
 */
const VERIFIED_SUBMISSION_STATUSES = ["verified"];

/**
 * Has the candidate's project reached a persisted VERIFIED verdict?
 *
 * This is the single authority for interview eligibility. The frontend must
 * never be trusted to decide this.
 */
export function isProjectVerified(candidate) {
  if (!candidate) return false;

  if (
    VERIFIED_SUBMISSION_STATUSES.includes(candidate.projectSubmissionStatus)
  ) {
    return true;
  }

  const submission = candidate.projectSubmission || {};

  return (
    String(submission.aiVerificationStatus || "").toLowerCase() ===
      "verified" ||
    String(
      submission.aiVerificationResult?.verificationStatus || ""
    ).toUpperCase() === "VERIFIED"
  );
}

/**
 * The persisted reason a candidate is not eligible, when one exists.
 *
 * @returns {string|null}
 */
export function getIneligibilityReason(candidate) {
  if (!candidate) return "Candidate record not found.";

  // A rejection always wins: the student should see the real, persisted reason.
  if (candidate.rejectionReason) {
    return candidate.rejectionReason;
  }

  const submission = candidate.projectSubmission || {};

  const aiReason =
    submission.aiVerificationResult?.detailedAnalysis?.reviewReasons?.[0] ||
    submission.aiVerificationResult?.summary;

  if (aiReason) {
    return aiReason;
  }

  return null;
}

/**
 * Check if candidate is eligible for interview slot booking
 *
 * Eligibility is derived from the PERSISTED verification state on the
 * candidate document:
 *   - the project must have a persisted VERIFIED verdict
 *   - no active booking may already exist
 *   - the candidate must still be active (not rejected / deadline expired)
 *
 * @param {Object} candidate - Candidate document with deadline fields
 * @returns {Object} Eligibility info
 */
export function canBookInterviewSlot(candidate) {
  if (!candidate) {
    return {
      eligible: false,
      reason: "candidate_not_found",
      message: "Candidate not found.",
    };
  }

  // Already rejected or auto-rejected by deadline.
  if (
    candidate.projectSubmissionStatus === "deadline_expired" ||
    candidate.status === "rejected" ||
    candidate.projectSubmissionStatus === "rejected"
  ) {
    return {
      eligible: false,
      reason: "project_not_verified",
      message:
        getIneligibilityReason(candidate) ||
        "Your project was not verified, so an interview cannot be scheduled.",
    };
  }

  // The project must carry a persisted VERIFIED verdict. There is no
  // admin-review fallback for a verified candidate.
  if (!isProjectVerified(candidate)) {
    return {
      eligible: false,
      reason: "project_not_verified",
      message:
        getIneligibilityReason(candidate) ||
        "Your project must be verified before you can schedule an interview.",
    };
  }

  // Check if already has a booking.
  if (candidate.bookedSlotId) {
    return {
      eligible: false,
      reason: "already_booked",
      message: "You already have an interview scheduled.",
    };
  }

  return {
    eligible: true,
    reason: null,
    message: "You are eligible to schedule your interview.",
  };
}

/**
 * Format remaining time for display
 */
export function formatRemainingTime(ms) {
  if (ms <= 0) {
    return "Time's up";
  }
  
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Format date for display
 */
export function formatDeadline(date) {
  if (!date) {
    return "Not set";
  }
  
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata'
  });
}