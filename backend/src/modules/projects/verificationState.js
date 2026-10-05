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
 *
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
 * Derive the student-facing verification state from a candidate document.
 *
 * @param {object} candidate candidate (or projection) containing
 *   projectSubmissionStatus and projectSubmission
 * @returns {{
 *   state: "not_submitted"|"in_progress"|"accepted"|"rejected",
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

  // Any non-terminal verification response is still shown as progress.
  // The final decision is always VERIFIED or REJECTED.
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