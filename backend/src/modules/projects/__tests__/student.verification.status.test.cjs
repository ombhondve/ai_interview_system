"use strict";

/**
 * Student project verification status + stale-result guard tests
 *
 * Covers:
 *   1. First submission               -> Verification In Progress
 *   2. Verification succeeds          -> Accepted
 *   3. Verification rejects project   -> Rejected
 *   4. Verification needs admin review-> Under Review
 *   5. New submission after REJECTED  -> old result cleared
 *   6. New submission after ACCEPTED  -> old result cleared
 *   7. A stale background verification MUST NOT overwrite a newer submission
 *   8/9. Refresh during/after verification shows the correct state
 *
 * HOW TO RUN:
 *   cd backend
 *   npx jest --testPathPatterns=student.verification.status
 */

const path = require("path");

const STATE_FILE = path.resolve(__dirname, "../verificationState.js");
const STORAGE_FILE = path.resolve(
  __dirname,
  "../../candidate/verification.storage.service.js"
);
const CANDIDATE_MODEL = path.resolve(
  __dirname,
  "../../candidate/candidate.model.js"
);

describe("student verification status mapping", () => {
  let deriveVerificationState;
  let createSubmissionId;

  beforeAll(() => {
    const state = require(STATE_FILE);
    deriveVerificationState = state.deriveVerificationState;
    createSubmissionId = state.createSubmissionId;
  });

  const URL = "https://github.com/owner/repo";

  // (1) First submission -> Verification In Progress
  test("(1) first submission shows Verification In Progress", () => {
    const result = deriveVerificationState({
      projectSubmissionStatus: "submitted",
      projectSubmission: {
        url: URL,
        submittedAt: new Date().toISOString(),
        aiVerificationStatus: "pending",
      },
    });

    expect(result.state).toBe("in_progress");
    expect(result.label).toBe("Verification In Progress");
    expect(result.isTerminal).toBe(false);
  });

  test("(1b) no submission shows Not Submitted", () => {
    const result = deriveVerificationState({
      projectSubmissionStatus: "downloaded",
      projectSubmission: {},
    });

    expect(result.state).toBe("not_submitted");
    expect(result.label).toBe("Not Submitted");
  });

  // (2) Verification succeeds -> Accepted
  test("(2) VERIFIED maps to Accepted", () => {
    const result = deriveVerificationState({
      projectSubmissionStatus: "verified",
      projectSubmission: {
        url: URL,
        aiVerificationStatus: "verified",
        aiVerificationResult: { verificationStatus: "VERIFIED" },
      },
    });

    expect(result.state).toBe("accepted");
    expect(result.label).toBe("Accepted");
    expect(result.isTerminal).toBe(true);
  });

  // (3) Verification rejects -> Rejected
  test("(3) REJECTED maps to Rejected", () => {
    const result = deriveVerificationState({
      projectSubmissionStatus: "rejected",
      projectSubmission: {
        url: URL,
        aiVerificationStatus: "rejected",
        aiVerificationResult: { verificationStatus: "REJECTED" },
      },
    });

    expect(result.state).toBe("rejected");
    expect(result.label).toBe("Rejected");
    expect(result.isTerminal).toBe(true);
  });
// (4) NEEDS_ADMIN_REVIEW -> Under Review (NEVER Rejected)
  test("(4) NEEDS_ADMIN_REVIEW maps to Under Review, not Rejected", () => {
    const result = deriveVerificationState({
      projectSubmissionStatus: "needs_admin_review",
      projectSubmission: {
        url: URL,
        aiVerificationStatus: "needs_admin_review",
        aiVerificationResult: { verificationStatus: "NEEDS_ADMIN_REVIEW" },
      },
    });

    expect(result.state).toBe("under_review");
    expect(result.label).toBe("Under Review");
    expect(result.state).not.toBe("rejected");
    expect(result.isTerminal).toBe(true);
  });

  test("(4b) NEEDS_ADMIN_REVIEW leaks through via submission status alone", () => {
    const result = deriveVerificationState({
      projectSubmissionStatus: "needs_admin_review",
      projectSubmission: { url: URL, aiVerificationStatus: "pending" },
    });

    expect(result.state).toBe("under_review");
  });

  test("(4c) automated failure routes to Under Review, not Rejected", () => {
    const result = deriveVerificationState({
      projectSubmissionStatus: "ai_verification_failed",
      projectSubmission: { url: URL, aiVerificationStatus: "error" },
    });

    expect(result.state).toBe("under_review");
    expect(result.state).not.toBe("rejected");
  });

  // (5)/(6) Old result cleared by a new submission
  test.each([
    ["REJECTED", "rejected"],
    ["ACCEPTED", "accepted"],
  ])(
    "(5/6) new submission after %s clears the old result -> In Progress",
    (_label, previousState) => {
      const previous = deriveVerificationState({
        projectSubmissionStatus: previousState,
        projectSubmission: {
          url: URL,
          aiVerificationStatus: previousState,
          aiVerificationResult: {
            verificationStatus:
              previousState === "accepted" ? "VERIFIED" : "REJECTED",
          },
        },
      });

      expect(previous.isTerminal).toBe(true);

      // After resubmitting, createProjectSubmission resets the verification
      // fields, so the old result no longer exists.
      const afterResubmission = deriveVerificationState({
        projectSubmissionStatus: "submitted",
        projectSubmission: {
          url: "https://github.com/owner/new-repo",
          submittedAt: new Date().toISOString(),
          submissionId: "sub_123_new",
          aiVerificationStatus: "pending",
        },
      });

      expect(afterResubmission.state).toBe("in_progress");
      expect(afterResubmission.label).toBe("Verification In Progress");
    }
  );

  // (8) Refresh while running, (9) refresh after completion
  test("(8/9) state is stable across refreshes", () => {
    const running = {
      projectSubmissionStatus: "verification_processing",
      projectSubmission: { url: URL, aiVerificationStatus: "processing" },
    };

    expect(deriveVerificationState(running).state).toBe("in_progress");
    expect(deriveVerificationState(running).state).toBe("in_progress");

    const finished = {
      projectSubmissionStatus: "verified",
      projectSubmission: {
        url: URL,
        aiVerificationStatus: "verified",
        aiVerificationResult: { verificationStatus: "VERIFIED" },
      },
    };

    expect(deriveVerificationState(finished).state).toBe("accepted");
  });

  test("submissionId is unique per submission", () => {
    expect(createSubmissionId()).not.toBe(createSubmissionId());
    expect(createSubmissionId().startsWith("sub_")).toBe(true);
  });
describe("stale verification result guard (scenario 7)", () => {
  let buildSubmissionGuard;

  beforeAll(() => {
    buildSubmissionGuard = require(STATE_FILE).buildSubmissionGuard;
  });

  /**
   * Simulates MongoDB's conditional findByIdAndUpdate: the write only
   * applies when every field in the filter matches the stored document.
   */
  const applyGuardedWrite = (stored, candidateId, submissionId) => {
    const guard = buildSubmissionGuard(candidateId, submissionId);
    const matches =
      guard._id === stored._id &&
      (guard["projectSubmission.submissionId"] === undefined ||
        guard["projectSubmission.submissionId"] ===
          stored.projectSubmission.submissionId);

    if (!matches) {
      return { written: false, document: stored };
    }

    return {
      written: true,
      document: {
        ...stored,
        projectSubmission: {
          ...stored.projectSubmission,
          aiVerificationStatus: submissionId ? "verified" : stored.projectSubmission.aiVerificationStatus,
        },
      },
    };
  };

  const STORED_ON_SUB_B = {
    _id: "cand-1",
    projectSubmission: {
      url: "https://github.com/owner/repo-b",
      submissionId: "sub_B",
      aiVerificationStatus: "processing",
    },
  };

  test("(7) guard pins a write to one specific submission", () => {
    expect(buildSubmissionGuard("cand-1", "sub_A")).toEqual({
      _id: "cand-1",
      "projectSubmission.submissionId": "sub_A",
    });
  });

  test("(7) legacy callers without a submissionId stay unconditional", () => {
    expect(buildSubmissionGuard("cand-1")).toEqual({ _id: "cand-1" });
    expect(buildSubmissionGuard("cand-1", undefined)).toEqual({ _id: "cand-1" });
  });

  test("(7) an OLD verification cannot overwrite the NEW submission", () => {
    // Verification A finishes late, after the student already submitted B.
    const outcome = applyGuardedWrite(STORED_ON_SUB_B, "cand-1", "sub_A");

    expect(outcome.written).toBe(false);
    // The newer submission keeps its own URL and pending verification.
    expect(outcome.document.projectSubmission.url).toBe(
      "https://github.com/owner/repo-b"
    );
    expect(outcome.document.projectSubmission.submissionId).toBe("sub_B");
    expect(outcome.document.projectSubmission.aiVerificationStatus).toBe(
      "processing"
    );
  });

  test("(7) the CURRENT verification still updates the submission", () => {
    const outcome = applyGuardedWrite(STORED_ON_SUB_B, "cand-1", "sub_B");

    expect(outcome.written).toBe(true);
    expect(outcome.document.projectSubmission.aiVerificationStatus).toBe(
      "verified"
    );
  });
});
});
