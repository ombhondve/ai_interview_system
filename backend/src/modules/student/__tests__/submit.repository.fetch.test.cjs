"use strict";

/**
 * Student project submission — repository fetch failure tests
 *
 * Covers the required failure flow:
 *
 *   Submit URL -> Submit -> Repository Fetch Fails
 *     -> NON-SUCCESS HTTP response (422, code: "repository_fetch_failed")
 *     -> NO submission persisted (student stays "not submitted")
 *     -> NO verification started
 *     -> safe, user-friendly message only (no internals leaked)
 *     -> student can correct the URL and submit again
 *
 * And preserves the existing success flow + existing error types:
 *
 *   Submit URL -> Submit -> Fetch OK -> submission persisted -> 200
 *   deadline / invalid-URL / missing-URL errors keep their 400 responses.
 *
 * HOW TO RUN:
 *   cd backend
 *   npx jest --testPathPatterns=submit.repository.fetch
 */

// --- Module mocks (must execute BEFORE requiring the modules under test) ---

jest.mock("../../projects/repository.service.js", () => ({
  __esModule: true,
  validateRepositoryUrl: jest.fn(),
  fetchRepositoryContent: jest.fn(),
  preflightRepositoryFetch: jest.fn(),
}));

jest.mock("../../projects/verificationProgress.service.js", () => ({
  __esModule: true,
  startVerificationProgress: jest.fn(async () => undefined),
}));

jest.mock("../../projects/verification.tracker.service.js", () => ({
  __esModule: true,
  verificationTracker: {
    startVerification: jest.fn(async () => ({
      success: true,
      trackingId: "track_test",
      verificationPromise: Promise.resolve(),
    })),
  },
}));

jest.mock("../../candidate/candidate.model.js", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock("../../candidate/CandidatePortalToken.js", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("../../verification/verificationSession.model.js", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("../../verification/token.service.js", () => ({
  __esModule: true,
  hashSessionToken: jest.fn(),
}));

jest.mock("../../../utils/vercelBackground.js", () => ({
  __esModule: true,
  keepInvocationAlive: jest.fn(),
}));

const fs = require("fs");
const path = require("path");

const Candidate = require("../../candidate/candidate.model.js").default;
const {
  preflightRepositoryFetch,
} = require("../../projects/repository.service.js");
const {
  startVerificationProgress,
} = require("../../projects/verificationProgress.service.js");
const { keepInvocationAlive } = require("../../../utils/vercelBackground.js");
const { submitProjectController } = require("../student.controller.js");

const STUDENT_SERVICE_FILE = path.resolve(__dirname, "../student.service.js");
const STUDENT_CONTROLLER_FILE = path.resolve(
  __dirname,
  "../student.controller.js"
);

// --- Helpers -----------------------------------------------------------------

const REPO_URL = "https://github.com/some-user/some-repo";

const FETCH_FAILED_MESSAGE =
  "Unable to fetch the repository. Please check the URL and submit again.";

function makeCandidate(overrides = {}) {
  return {
    _id: "cand_1",
    name: "Test Student",
    assignedProjectId: "proj_1",
    projectStartAt: new Date(),
    bufferDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
    projectSubmissionStatus: "not_started",
    projectSubmission: null,
    ...overrides,
  };
}

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

function makeReq(url = REPO_URL, candidate = { _id: "cand_1" }) {
  return { candidate, body: { url } };
}

async function flushAsync() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

// --- Tests -------------------------------------------------------------------

describe("Student submit-project — repository fetch failure flow", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    console.warn = jest.fn();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  test("repository cannot be fetched -> 422 + repository_fetch_failed + safe message + NOTHING persisted", async () => {
    preflightRepositoryFetch.mockResolvedValue({
      fetchable: false,
      errorType: "not_accessible",
      // Internal detail — must NEVER reach the response body.
      reason: "getaddrinfo ENOTFOUND api.github.com",
    });
    Candidate.findById.mockResolvedValue(makeCandidate());

    const res = makeRes();
    await submitProjectController(makeReq(), res);

    // Non-success response with the machine-readable code the frontend uses.
    expect(res.statusCode).toBe(422);
    expect(res.body).toMatchObject({
      success: false,
      code: "repository_fetch_failed",
      message: FETCH_FAILED_MESSAGE,
    });

    // No internal details leaked (no reasons, stacks, hosts, paths).
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(
      /ENOTFOUND|api\.github\.com|at\s+\w+\.|\/src\/|stack/i
    );

    // The submission was never persisted and verification never started:
    // the student stays in the "not submitted" state and can retry.
    expect(Candidate.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(startVerificationProgress).not.toHaveBeenCalled();
    expect(keepInvocationAlive).not.toHaveBeenCalled();
  });

  test("empty/unusable repository content -> 422 + empty-repository friendly message", async () => {
    preflightRepositoryFetch.mockResolvedValue({
      fetchable: false,
      errorType: "empty_repository",
      reason: "Repository contains no files",
    });
    Candidate.findById.mockResolvedValue(makeCandidate());

    const res = makeRes();
    await submitProjectController(makeReq(), res);

    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("repository_fetch_failed");
    expect(res.body.message).toBe(
      "The repository appears to be empty. Please add your project files and submit again."
    );
    expect(Candidate.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(keepInvocationAlive).not.toHaveBeenCalled();
  });

  test("repository fetch timeout -> 422 + timeout friendly message", async () => {
    preflightRepositoryFetch.mockResolvedValue({
      fetchable: false,
      errorType: "timeout",
      reason: "Repository pre-flight timeout (30000ms)",
    });
    Candidate.findById.mockResolvedValue(makeCandidate());

    const res = makeRes();
    await submitProjectController(makeReq(), res);

    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("repository_fetch_failed");
    expect(res.body.message).toBe(
      "The repository took too long to respond. Please try again."
    );
    expect(Candidate.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("unexpected preflight throw fails SAFE (no internal message leaked)", async () => {
    preflightRepositoryFetch.mockRejectedValue(
      new Error("connect ECONNREFUSED 10.0.0.5:27017 (internal)")
    );
    Candidate.findById.mockResolvedValue(makeCandidate());

    const res = makeRes();
    await submitProjectController(makeReq(), res);

    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("repository_fetch_failed");
    expect(res.body.message).toBe(FETCH_FAILED_MESSAGE);
    expect(JSON.stringify(res.body)).not.toMatch(
      /ECONNREFUSED|10\.0\.0\.5|27017|internal/i
    );
    expect(Candidate.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("existing non-fetch error types are NOT treated as fetch failures (deadline -> 400)", async () => {
    // Deadline expired: checked BEFORE the preflight, so the preflight is
    // skipped and the existing 400 mapping is preserved.
    Candidate.findById.mockResolvedValue(
      makeCandidate({ bufferDeadline: new Date(Date.now() - 1000) })
    );

    const res = makeRes();
    await submitProjectController(makeReq(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      message: "Submission deadline has expired.",
    });
    expect(preflightRepositoryFetch).not.toHaveBeenCalled();
    expect(res.body.code).toBeUndefined();
  });

  test("existing invalid-URL error is NOT a fetch failure (400, preflight never runs)", async () => {
    Candidate.findById.mockResolvedValue(makeCandidate());

    const res = makeRes();
    await submitProjectController(makeReq("not-a-url"), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: "Please enter a valid URL." });
    expect(preflightRepositoryFetch).not.toHaveBeenCalled();
  });

  test("existing missing-URL validation is preserved (400)", async () => {
    const res = makeRes();
    const req = { candidate: { _id: "cand_1" }, body: {} };
    await submitProjectController(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: "Project URL is required." });
    expect(preflightRepositoryFetch).not.toHaveBeenCalled();
  });

  test("SUCCESS flow unchanged: fetch OK -> submission persisted -> verification started -> 200", async () => {
    preflightRepositoryFetch.mockResolvedValue({ fetchable: true });
    Candidate.findById.mockResolvedValue(makeCandidate());

    const updatedCandidate = {
      _id: "cand_1",
      name: "Test Student",
      projectSubmissionStatus: "verification_processing",
      projectSubmission: {
        url: REPO_URL,
        submittedAt: new Date().toISOString(),
        submissionId: "sub_test_1",
        status: "submitted",
      },
    };
    Candidate.findByIdAndUpdate.mockReturnValue({
      populate: jest.fn().mockResolvedValue(updatedCandidate),
    });

    const res = makeRes();
    await submitProjectController(makeReq(), res);
    await flushAsync();

    expect(res.statusCode).toBe(200);
    expect(res.body.submission.status).toBe("submitted");
    expect(res.body.submission.url).toBe(REPO_URL);

    // Existing pipeline still runs after a successful fetch.
    expect(Candidate.findByIdAndUpdate).toHaveBeenCalled();
    expect(startVerificationProgress).toHaveBeenCalled();
    expect(keepInvocationAlive).toHaveBeenCalled();
  });
});

describe("Regression guards (source-order trace)", () => {
  test("service runs the repository preflight BEFORE persisting the submission", () => {
    const source = fs.readFileSync(STUDENT_SERVICE_FILE, "utf8");

    const preflightIndex = source.indexOf("await preflightRepositoryFetch(");
    const persistIndex = source.indexOf('"projectSubmission.url": url');

    expect(preflightIndex).toBeGreaterThan(-1);
    expect(persistIndex).toBeGreaterThan(-1);
    // The preflight must run first so a failed fetch writes NOTHING.
    expect(preflightIndex).toBeLessThan(persistIndex);
  });

  test("controller maps REPOSITORY_FETCH_FAILED to a dedicated non-success response", () => {
    const source = fs.readFileSync(STUDENT_CONTROLLER_FILE, "utf8");

    expect(source).toContain('error?.code === "REPOSITORY_FETCH_FAILED"');
    expect(source).toContain("res.status(422)");
    expect(source).toContain('code: "repository_fetch_failed"');
  });

  test("fetch-failure message returned to students is the approved safe string", () => {
    const source = fs.readFileSync(STUDENT_SERVICE_FILE, "utf8");

    expect(source).toContain(FETCH_FAILED_MESSAGE);
  });
});

