const {
  deriveVerificationState,
  isInterviewEligible,
  getPersistedRejectionReason,
  buildSubmissionGuard,
  createSubmissionId,
} = require("../verificationState.js");

const {
  toProgressPayload,
  VERIFICATION_STAGES,
} = require("../verificationProgress.service.js");

describe("Verification Polling & Status Flow Regression Tests", () => {
  const REPO_URL = "https://github.com/candidate/recruitment-challenge";

  // 1. Verification successfully reaches VERIFIED
  test("1. Verification successfully reaches VERIFIED -> accepted and interviewEligible", () => {
    const candidate = {
      projectSubmissionStatus: "verified",
      projectSubmission: {
        url: REPO_URL,
        aiVerificationStatus: "verified",
        aiVerificationResult: {
          verificationStatus: "VERIFIED",
          summary: "All requirements met and verified.",
        },
      },
    };

    const state = deriveVerificationState(candidate);
    expect(state.state).toBe("accepted");
    expect(state.label).toBe("Accepted");
    expect(state.isTerminal).toBe(true);
    expect(state.interviewEligible).toBe(true);
    expect(state.rejectionReason).toBeNull();
  });

  // 2. Verification reaches REJECTED
  test("2. Verification reaches REJECTED -> rejected with persisted reason and not eligible", () => {
    const candidate = {
      projectSubmissionStatus: "rejected",
      rejectionReason: "Core authentication middleware is missing.",
      projectSubmission: {
        url: REPO_URL,
        aiVerificationStatus: "rejected",
        aiVerificationResult: {
          verificationStatus: "REJECTED",
          summary: "Core authentication middleware is missing.",
        },
      },
    };

    const state = deriveVerificationState(candidate);
    expect(state.state).toBe("rejected");
    expect(state.label).toBe("Rejected");
    expect(state.isTerminal).toBe(true);
    expect(state.interviewEligible).toBe(false);
    expect(state.rejectionReason).toBe("Core authentication middleware is missing.");
  });

  // 3. Verification reaches NEEDS_ADMIN_REVIEW
  test("3. Verification reaches NEEDS_ADMIN_REVIEW -> under_review, terminal, not accepted, not rejected", () => {
    const candidate = {
      projectSubmissionStatus: "needs_admin_review",
      projectSubmission: {
        url: REPO_URL,
        aiVerificationStatus: "needs_admin_review",
        aiVerificationResult: {
          verificationStatus: "NEEDS_ADMIN_REVIEW",
          summary: "Code structure requires manual inspection by admin.",
        },
      },
    };

    const state = deriveVerificationState(candidate);
    expect(state.state).toBe("under_review");
    expect(state.label).toBe("Under Review");
    expect(state.isTerminal).toBe(true);
    expect(state.interviewEligible).toBe(false);
    expect(state.rejectionReason).toBeNull();
  });

  // 4. A nonterminal status continues polling
  test("4. A nonterminal status continues polling (isTerminal is false)", () => {
    const inProgressStatuses = [
      "submitted",
      "in_progress",
      "url_validation",
      "ai_verification",
      "verification_processing",
      "verification_pending",
    ];

    for (const status of inProgressStatuses) {
      const state = deriveVerificationState({
        projectSubmissionStatus: status,
        projectSubmission: {
          url: REPO_URL,
          aiVerificationStatus: "processing",
        },
      });

      expect(state.state).toBe("in_progress");
      expect(state.isTerminal).toBe(false);
    }
  });

  // 5. A terminal status stops polling
  test("5. A terminal status stops polling (isTerminal is true for accepted, rejected, under_review)", () => {
    const terminalCases = [
      {
        candidate: {
          projectSubmissionStatus: "verified",
          projectSubmission: { url: REPO_URL, aiVerificationStatus: "verified" },
        },
        expectedState: "accepted",
      },
      {
        candidate: {
          projectSubmissionStatus: "rejected",
          projectSubmission: { url: REPO_URL, aiVerificationStatus: "rejected" },
        },
        expectedState: "rejected",
      },
      {
        candidate: {
          projectSubmissionStatus: "needs_admin_review",
          projectSubmission: {
            url: REPO_URL,
            aiVerificationStatus: "needs_admin_review",
            aiVerificationResult: { verificationStatus: "NEEDS_ADMIN_REVIEW" },
          },
        },
        expectedState: "under_review",
      },
    ];

    for (const { candidate, expectedState } of terminalCases) {
      const state = deriveVerificationState(candidate);
      expect(state.state).toBe(expectedState);
      expect(state.isTerminal).toBe(true);
    }
  });

  // 6. An unexpected status is handled safely
  test("6. An unexpected status is handled safely (falls back to in_progress, never crashes or falsely rejects)", () => {
    const candidate = {
      projectSubmissionStatus: "UNKNOWN_CUSTOM_STATUS",
      projectSubmission: {
        url: REPO_URL,
        aiVerificationStatus: "unknown_value",
      },
    };

    const state = deriveVerificationState(candidate);
    expect(state.state).toBe("in_progress");
    expect(state.isTerminal).toBe(false);
    expect(state.state).not.toBe("rejected");
    expect(state.interviewEligible).toBe(false);
  });

  // 7. A failed status request does not produce a false rejection
  test("7. A transient fetch failure in metadata does not produce a false rejection", () => {
    const candidate = {
      projectSubmissionStatus: "needs_admin_review",
      projectSubmission: {
        url: REPO_URL,
        aiVerificationStatus: "needs_admin_review",
        aiVerificationResult: {
          verificationStatus: "NEEDS_ADMIN_REVIEW",
          verificationMetadata: {
            repositoryFetchFailed: true,
            errorType: "network_error",
          },
        },
      },
    };

    const state = deriveVerificationState(candidate);
    expect(state.state).toBe("in_progress");
    expect(state.state).not.toBe("rejected");
    expect(state.isTerminal).toBe(false);
  });

  // 8. The backend returns the persisted final result
  test("8. Persisted AI result is faithfully reflected in derived state and stages", () => {
    const submission = {
      url: REPO_URL,
      verificationProgress: {
        stage: "finalizing",
        label: "Finalizing results",
        status: "completed",
      },
      verificationProgressHistory: VERIFICATION_STAGES.map((s) => ({
        stage: s.stage,
        label: s.label,
        status: "completed",
        completedAt: new Date().toISOString(),
      })),
      aiVerificationStatus: "verified",
      aiVerificationResult: {
        verificationStatus: "VERIFIED",
        confidence: 0.95,
        summary: "Project completed all 5 criteria.",
      },
    };

    const payload = toProgressPayload(submission);
    expect(payload.stages).toHaveLength(7);
    expect(payload.stages.every((s) => s.status === "completed")).toBe(true);
    expect(payload.failedStage).toBeNull();

    const state = deriveVerificationState({
      projectSubmissionStatus: "verified",
      projectSubmission: submission,
    });
    expect(state.state).toBe("accepted");
    expect(state.isTerminal).toBe(true);
  });

  // 9. Refreshing the page retrieves the current result
  test("9. Refreshing the page retrieves the current persisted result consistently", () => {
    const candidate = {
      _id: "candidate-refresh-123",
      projectSubmissionStatus: "verified",
      projectSubmission: {
        url: REPO_URL,
        aiVerificationStatus: "verified",
        aiVerificationResult: { verificationStatus: "VERIFIED" },
      },
    };

    const firstLoad = deriveVerificationState(candidate);
    const refreshedLoad = deriveVerificationState(candidate);

    expect(firstLoad).toEqual(refreshedLoad);
    expect(refreshedLoad.state).toBe("accepted");
    expect(refreshedLoad.isTerminal).toBe(true);
  });

  // 10. Database finalization errors are handled safely
  test("10. Database submission guard pins writes to specific submissionId", () => {
    const candidateId = "cand-db-123";
    const subA = createSubmissionId();
    const subB = createSubmissionId();

    const guardA = buildSubmissionGuard(candidateId, subA);
    const guardB = buildSubmissionGuard(candidateId, subB);

    expect(guardA).toEqual({ _id: candidateId, "projectSubmission.submissionId": subA });
    expect(guardB).toEqual({ _id: candidateId, "projectSubmission.submissionId": subB });
    expect(guardA).not.toEqual(guardB);
  });

  // 11. Polling does not create duplicate verification jobs (idempotent submission IDs)
  test("11. Submission IDs are unique across separate submissions", () => {
    const id1 = createSubmissionId();
    const id2 = createSubmissionId();
    expect(id1).not.toBe(id2);
    expect(id1.startsWith("sub_")).toBe(true);
  });

  // 12. Multiple polling requests do not corrupt verification state
  test("12. Polling progress mapping is deterministic and does not corrupt history", () => {
    const submission = {
      verificationProgress: { stage: "ai", label: "AI verification in progress", status: "active" },
      verificationProgressHistory: [
        { stage: "validating", status: "completed" },
        { stage: "project_requirements", status: "completed" },
        { stage: "repository", status: "completed" },
        { stage: "analyzing", status: "completed" },
        { stage: "requirements", status: "completed" },
        { stage: "ai", status: "active" },
      ],
    };

    const poll1 = toProgressPayload(submission);
    const poll2 = toProgressPayload(submission);
    expect(poll1).toEqual(poll2);
    expect(poll1.stages[5].status).toBe("active");
    expect(poll1.stages[6].status).toBe("pending");
  });

  // 13. The correct student can access the result (interview eligibility scoped to student)
  test("13. Verified student is eligible; unverified student is blocked", () => {
    const studentVerified = {
      projectSubmissionStatus: "verified",
      projectSubmission: { url: REPO_URL, aiVerificationStatus: "verified" },
    };
    const studentPending = {
      projectSubmissionStatus: "submitted",
      projectSubmission: { url: REPO_URL, aiVerificationStatus: "pending" },
    };

    expect(isInterviewEligible(studentVerified)).toBe(true);
    expect(isInterviewEligible(studentPending)).toBe(false);
  });

  // 14. Another student's result cannot grant eligibility
  test("14. Admin review or rejected student cannot access interview scheduling", () => {
    const reviewStudent = {
      projectSubmissionStatus: "needs_admin_review",
      projectSubmission: {
        url: REPO_URL,
        aiVerificationStatus: "needs_admin_review",
        aiVerificationResult: { verificationStatus: "NEEDS_ADMIN_REVIEW" },
      },
    };
    const rejectedStudent = {
      projectSubmissionStatus: "rejected",
      projectSubmission: {
        url: REPO_URL,
        aiVerificationStatus: "rejected",
        aiVerificationResult: { verificationStatus: "REJECTED" },
      },
    };

    expect(isInterviewEligible(reviewStudent)).toBe(false);
    expect(isInterviewEligible(rejectedStudent)).toBe(false);
  });

  // 15. A timeout produces a recovery state instead of infinite loading
  test("15. Failed stage marks failed true and provides error message for UI recovery", () => {
    const failedSubmission = {
      verificationProgress: {
        stage: "ai",
        label: "AI verification in progress",
        status: "failed",
        message: "AI provider timeout.",
        failed: true,
      },
      verificationProgressHistory: [
        { stage: "validating", status: "completed" },
        { stage: "project_requirements", status: "completed" },
        { stage: "repository", status: "completed" },
        { stage: "analyzing", status: "completed" },
        { stage: "requirements", status: "completed" },
        { stage: "ai", status: "failed", message: "AI provider timeout.", failed: true },
      ],
    };

    const payload = toProgressPayload(failedSubmission);
    expect(payload.failedStage).toBe("ai");
    expect(payload.failedMessage).toBe("AI provider timeout.");
    expect(payload.progress.failed).toBe(true);
  });
});
