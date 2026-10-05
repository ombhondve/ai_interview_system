/**
 * Student-facing project verification state
 *
 * Single source of truth for mapping the EXISTING backend verification fields
 * onto the states shown to the student. This does not introduce a new status
 * system: it only translates the values already stored by the verification
 * architecture (projectSubmissionStatus / aiVerificationStatus / the AI
 * result's verificationStatus).
 *
 * Student-facing states:
 *   not_submitted  -> "Not Submitted"
 *   in_progress    -> "Verification In Progress"
 *   accepted       -> "Accepted"
 *   rejected       -> "Rejected"
 *   under_review   -> "Under Review"
 *
 * NEEDS_ADMIN_REVIEW maps to "under_review" and is deliberately NEVER
 * treated as rejected.
 */

/** Submission-level statuses that mean "a verification is running". */
const IN_PROGRESS_SUBMISSION_STATUSES = new Set([
  "submitted",
  "in_progress",
  "url_validation",
  "ai_verification",
  "verification_pending",
  "verification_processing",
  "verification_completed"
]);

/** Verification statuses that mean a human still has to look at it. */
const ADMIN_REVIEW_VERIFICATION_STATUSES = new Set([
  "needs_admin_review"
]);

/** Verification statuses that mean the automated check could not finish. */
const ERROR_VERIFICATION_STATUSES = new Set(["error"]);

/**
 * Can this candidate schedule an interview?
 *
 * Derived from the PERSISTED verification state. A VERIFIED project makes the
 * student immediately eligible: there is no admin-review step blocking a
 * successfully verified student.
 */
export function isInterviewEligible(candidate) {
  const submission = candidate?.projectSubmission || {};
  const submissionStatus = candidate?.projectSubmissionStatus || "";
  const verificationStatus = String(
    submission.aiVerificationStatus || ""
  ).toLowerCase();
  const resultStatus = String(
    submission.aiVerificationResult?.verificationStatus || ""
  ).toUpperCase();

  if (submissionStatus === "rejected" || submissionStatus === "deadline_expired") {
    return false;
  }

  return (
    submissionStatus === "verified" ||
    verificationStatus === "verified" ||
    resultStatus === "VERIFIED"
  );
}

/**
 * The persisted reason a student is not eligible (for REJECTED).
 */
export function getPersistedRejectionReason(candidate) {
  return (
    candidate?.rejectionReason ||
    candidate?.projectSubmission?.aiVerificationResult?.detailedAnalysis
      ?.reviewReasons?.[0] ||
    candidate?.projectSubmission?.aiVerificationResult?.summary ||
    null
  );
}

/**
 * The persisted reason a submission was routed to admin review.
 *
 * NEEDS_ADMIN_REVIEW has several distinct causes:
 *   - the repository could not be fetched (rate limit / timeout / private)
 *   - the repository had no file content to analyse
 *   - the AI genuinely could not decide
 *
 * The student must be able to tell which one actually happened, otherwise every
 * case collapses into the same unhelpful "Under Review" message. This returns
 * the PERSISTED summary; it never invents a cause.
 */
export function getPersistedReviewReason(candidate) {
  return (
    candidate?.projectSubmission?.aiVerificationResult?.summary ||
    candidate?.projectSubmission?.aiVerificationResult?.detailedAnalysis
      ?.overallAssessment ||
    null
  );
}

/**
 * Classify WHY a submission needs admin review, for student-facing messaging.
 *
 * Derived entirely from the persisted verification result, so it can never
 * claim a cause that did not actually occur.
 *
 * @returns {"repository_fetch_failed"|"insufficient_content"|"ai_uncertainty"|null}
 */
export function getReviewCause(candidate) {
  const metadata =
    candidate?.projectSubmission?.aiVerificationResult?.verificationMetadata ||
    {};

  if (metadata.repositoryFetchFailed) return "repository_fetch_failed";
  if (metadata.insufficientContent) return "insufficient_content";

  return "ai_uncertainty";
}

/**
 * Derive the student-facing verification state from a candidate document.
 *
 * @param {object} candidate candidate (or projection) containing
 *   projectSubmissionStatus and projectSubmission
 * @returns {{
 *   state: "not_submitted"|"in_progress"|"accepted"|"rejected"|"under_review",
 *   label: string,
 *   description: string,
 *   isTerminal: boolean,
 *   interviewEligible: boolean,
 *   rejectionReason: string|null
 * }}
 */
export function deriveVerificationState(candidate) {
  const submission = candidate?.projectSubmission || {};
  const submissionStatus = candidate?.projectSubmissionStatus || "";
  const verificationStatus = (submission.aiVerificationStatus || "").toLowerCase();
  const resultStatus = (
    submission.aiVerificationResult?.verificationStatus || ""
  ).toUpperCase();

  const rejectionReason = getPersistedRejectionReason(candidate);
  const reviewReason = getPersistedReviewReason(candidate);
  const reviewCause = getReviewCause(candidate);

  // VERIFIED => immediately interview eligible. Never "Under Review".
  const interviewEligible = isInterviewEligible(candidate);

  const state = (s, label, description, isTerminal) => ({
    state: s,
    label,
    description,
    isTerminal,
    interviewEligible,
    // Only surface a reason for a genuinely rejected candidate.
    rejectionReason: s === "rejected" ? rejectionReason : null,
    // Surface the REAL persisted reason for admin review, so a rate-limited
    // fetch is never displayed identically to genuine AI uncertainty.
    reviewReason: s === "under_review" ? reviewReason : null,
    reviewCause: s === "under_review" ? reviewCause : null,
  });

  // --- No submission at all ---
  if (!submission.url) {
    return state(
      "not_submitted",
      "Not Submitted",
      "You have not submitted a project yet.",
      false
    );
  }

  // --- Final AI verdict (authoritative when present) ---
  if (resultStatus === "VERIFIED" || verificationStatus === "verified") {
    return state(
      "accepted",
      "Accepted",
      "Your project passed verification.",
      true
    );
  }

  if (resultStatus === "REJECTED" || verificationStatus === "rejected") {
    return state(
      "rejected",
      "Rejected",
      "Your project did not meet the required project requirements.",
      true
    );
  }

  // NEEDS_ADMIN_REVIEW -> "Under Review" (never "Rejected")
  if (
    resultStatus === "NEEDS_ADMIN_REVIEW" ||
    ADMIN_REVIEW_VERIFICATION_STATUSES.has(verificationStatus) ||
    submissionStatus === "needs_admin_review"
  ) {
    return state(
      "under_review",
      "Under Review",
      "Your project requires additional review.",
      true
    );
  }

  // Automated verification could not complete: a human must look at it.
  if (
    resultStatus === "ERROR" ||
    ERROR_VERIFICATION_STATUSES.has(verificationStatus) ||
    submissionStatus === "ai_verification_failed" ||
    submissionStatus === "url_invalid"
  ) {
    return state(
      "under_review",
      "Under Review",
      "Your project requires additional review.",
      true
    );
  }

  // --- Verification running ---
  if (
    verificationStatus === "pending" ||
    verificationStatus === "processing" ||
    IN_PROGRESS_SUBMISSION_STATUSES.has(submissionStatus)
  ) {
    return state(
      "in_progress",
      "Verification In Progress",
      "Your project has been submitted and is currently being verified.",
      false
    );
  }

  // Submitted but nothing else recorded yet.
  return state(
    "in_progress",
    "Verification In Progress",
    "Your project has been submitted and is currently being verified.",
    false
  );
}

/**
 * Generate a unique id for a new submission.
 * @returns {string}
 */
export function createSubmissionId() {
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Build the Mongo filter that pins a write to ONE specific submission.
 *
 * Verification runs in the background, so a verification started for
 * submission A can finish after the student has already submitted repository B.
 * Every background write therefore filters on the submissionId it was started
 * for. If the student has since resubmitted, the filter matches nothing, the
 * write is skipped, and the newer submission keeps its own state.
 *
 * Extracted as a pure helper so the guard is directly testable without a
 * database.
 *
 * @param {string} candidateId
 * @param {string} [submissionId] omitted for legacy/manual callers, which keep
 *   the previous unconditional behaviour.
 * @returns {object} a Mongo query object
 */
export function buildSubmissionGuard(candidateId, submissionId) {
  return submissionId
    ? { _id: candidateId, "projectSubmission.submissionId": submissionId }
    : { _id: candidateId };
}