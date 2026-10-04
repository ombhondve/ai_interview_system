"use strict";

/**
 * Verification error-classification tests
 *
 * Exercises verifyProjectSubmission() end-to-end with the repository fetch
 * layer and the AI layer mocked, asserting the DECISION rules:
 *
 *   (f) repository fetch failure (timeout / 5xx / network / 404 / rate limit)
 *       -> NEEDS_ADMIN_REVIEW  (NEVER REJECTED)
 *   (g) repository fetched successfully + AI evidence shows missing
 *       requirements -> REJECTED
 *   (h) repository fetched successfully + AI evidence meets requirements
 *       -> VERIFIED
 *
 * Also asserts the AI stage is NOT invoked when the fetch failed (req #9).
 *
 * HOW TO RUN:
 *   cd backend
 *   npx jest --testPathPattern=verification.classification
 */

// --- Module mocks (must be declared before importing the module under test) --
jest.mock("../repository.service.js", () => ({
  validateRepositoryUrl: jest.fn(() => ({ valid: true, isRepoHost: true, hostname: "github.com" })),
  fetchRepositoryContent: jest.fn()
}));

jest.mock("../project.model.js", () => ({
  __esModule: true,
  default: { findById: jest.fn() }
}));

jest.mock("../../ai/ai.service.js", () => ({
  generateStructuredAI: jest.fn()
}));

jest.mock("../../ai/ai.prompt.js", () => ({
  projectVerificationPrompt: "PROJECT_VERIFICATION_PROMPT"
}));

const repositoryService = require("../repository.service.js");
const Project = require("../project.model.js").default;
const aiService = require("../../ai/ai.service.js");
const { verifyProjectSubmission, VERIFICATION_STATUS } = require("../verification.service.js");

// --- Fixtures ---------------------------------------------------------------

const VALID_PROJECT = {
  title: "Test Project",
  description: "Build a REST API",
  difficulty: "medium",
  technologies: ["node"],
  requirements: ["Build a REST API"],
  functionalRequirements: [],
  nonFunctionalRequirements: [],
  modules: [],
  implementationPlan: [],
  evaluationCriteria: [],
  deliverables: [],
  suggestedFolderStructure: "",
  apiEndpoints: [],
  databaseDesign: "",
  testingPlan: []
};

function mockProjectFound(project = VALID_PROJECT) {
  Project.findById.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(project) })
  });
}

function successRepoContent() {
  return {
    success: true,
    error: null,
    metadata: { accessible: true },
    data: {
      keyFiles: {
        "index.js": { content: "console.log('hello world');", size: 26, type: "js" },
        "README.md": { content: "# Project", size: 9, type: "md" }
      },
      structure: { files: [{ path: "index.js" }], directories: [], size: 120 },
      metadata: { dependencies: ["express"], buildFiles: [], platform: "github", filesAnalyzed: 2, totalSize: 120 },
      statistics: { languages: { JavaScript: 2000 }, totalCommits: 12, lastCommit: "2025-01-01" },
      readme: { content: "# Project", truncated: false },
      security: { codeExecution: false, fileDownload: false, onlyMetadata: false }
    }
  };
}

function failedRepoContent(errorType = "timeout") {
  return {
    success: false,
    error: "GitHub repository structure fetch failed: timeout of 10000ms exceeded",
    data: null,
    metadata: { accessible: false, errorType, error: "timeout of 10000ms exceeded" }
  };
}

function aiResult(status, confidence) {
  return {
    verificationStatus: status,
    confidence,
    summary: `AI decision: ${status}`,
    detailedAnalysis: {
      repositoryValidity: { isValid: true, issues: [], strengths: ["repo accessible"] },
      requirementsAssessment: [
        { requirementId: "core-req-1", status: status === "VERIFIED" ? "met" : "missing" }
      ],
      technicalEvaluation: { codeQuality: "GOOD", projectOrganization: "GOOD", documentation: "GOOD", issuesFound: [] },
      overallAssessment: `AI overall assessment for ${status}`
    },
    recommendations: { forStudent: ["Keep going"], forReviewer: [] },
    verificationMetadata: {
      filesAnalyzed: 2,
      requirementsTotal: 1,
      requirementsMet: status === "VERIFIED" ? 1 : 0,
      requirementsPartial: 0,
      requirementsMissing: status === "VERIFIED" ? 0 : 1
    }
  };
}

function silenceLogger() {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "info").mockImplementation(() => {});
  jest.spyOn(console, "debug").mockImplementation(() => {});
}

// --- Tests ------------------------------------------------------------------

describe("verification classification — fetch failures must NOT be REJECTED", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repositoryService.validateRepositoryUrl.mockReturnValue({ valid: true, isRepoHost: true, hostname: "github.com" });
    mockProjectFound();
    silenceLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each([
    ["timeout"],
    ["network_error"],
    ["server_error"],
    ["rate_limit"],
    ["not_found"],
    ["repository_fetch_failure"]
  ])("(f) fetch failure '%s' -> NEEDS_ADMIN_REVIEW (not REJECTED)", async (errorType) => {
    repositoryService.fetchRepositoryContent.mockResolvedValue(failedRepoContent(errorType));

    const result = await verifyProjectSubmission("cand-1", "proj-1", "https://github.com/owner/repo");

    expect(result.status).toBe(VERIFICATION_STATUS.NEEDS_ADMIN_REVIEW);
    expect(result.verificationStatus).toBe(VERIFICATION_STATUS.NEEDS_ADMIN_REVIEW);
    expect(result.status).not.toBe(VERIFICATION_STATUS.REJECTED);
    expect(result.summary).toMatch(/could not be fetched/i);

    // The AI stage must never be called after a failed fetch.
    expect(aiService.generateStructuredAI).not.toHaveBeenCalled();
  });

  test("(f) successfully fetched but EMPTY repository -> NEEDS_ADMIN_REVIEW (AI not called)", async () => {
    const content = successRepoContent();
    content.data.keyFiles = {}; // structure present, no analyzable file content
    repositoryService.fetchRepositoryContent.mockResolvedValue(content);

    const result = await verifyProjectSubmission("cand-2", "proj-2", "https://github.com/owner/empty");

    expect(result.status).toBe(VERIFICATION_STATUS.NEEDS_ADMIN_REVIEW);
    expect(result.status).not.toBe(VERIFICATION_STATUS.REJECTED);
    expect(aiService.generateStructuredAI).not.toHaveBeenCalled();
  });

  test("(f) invalid repository URL -> NEEDS_ADMIN_REVIEW (AI not called)", async () => {
    repositoryService.validateRepositoryUrl.mockReturnValueOnce({ valid: false, error: "Invalid URL format" });

    const result = await verifyProjectSubmission("cand-3", "proj-3", "not-a-url");

    expect(result.status).toBe(VERIFICATION_STATUS.NEEDS_ADMIN_REVIEW);
    expect(result.status).not.toBe(VERIFICATION_STATUS.REJECTED);
    expect(aiService.generateStructuredAI).not.toHaveBeenCalled();
    // repository fetch must not even be attempted for an invalid URL
    expect(repositoryService.fetchRepositoryContent).not.toHaveBeenCalled();
  });

  test("(f) project not found -> NEEDS_ADMIN_REVIEW (not REJECTED)", async () => {
    Project.findById.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(null) }) });

    const result = await verifyProjectSubmission("cand-4", "proj-4", "https://github.com/owner/repo");

    expect(result.status).toBe(VERIFICATION_STATUS.NEEDS_ADMIN_REVIEW);
    expect(result.status).not.toBe(VERIFICATION_STATUS.REJECTED);
    expect(aiService.generateStructuredAI).not.toHaveBeenCalled();
  });
});

describe("verification classification — successful fetch keeps AI decisions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repositoryService.validateRepositoryUrl.mockReturnValue({ valid: true, isRepoHost: true, hostname: "github.com" });
    mockProjectFound();
    repositoryService.fetchRepositoryContent.mockResolvedValue(successRepoContent());
    silenceLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("(g) fetched successfully + AI evidence shows MISSING requirements -> REJECTED", async () => {
    aiService.generateStructuredAI.mockResolvedValue(aiResult("REJECTED", 0.2));

    const result = await verifyProjectSubmission("cand-5", "proj-5", "https://github.com/owner/repo");

    expect(aiService.generateStructuredAI).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("REJECTED");
    expect(result.verificationStatus).toBe("REJECTED");
  });

  test("(h) fetched successfully + AI evidence MEETS requirements -> VERIFIED", async () => {
    aiService.generateStructuredAI.mockResolvedValue(aiResult("VERIFIED", 0.9));

    const result = await verifyProjectSubmission("cand-6", "proj-6", "https://github.com/owner/repo");

    expect(aiService.generateStructuredAI).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("VERIFIED");
    expect(result.verificationStatus).toBe("VERIFIED");
  });

  test("fetched successfully + AI uncertainty -> NEEDS_ADMIN_REVIEW preserved", async () => {
    aiService.generateStructuredAI.mockResolvedValue(aiResult("NEEDS_ADMIN_REVIEW", 0.6));

    const result = await verifyProjectSubmission("cand-7", "proj-7", "https://github.com/owner/repo");

    expect(result.status).toBe("NEEDS_ADMIN_REVIEW");
    expect(result.verificationStatus).toBe("NEEDS_ADMIN_REVIEW");
  });

  test("fetched successfully but AI call throws -> NEEDS_ADMIN_REVIEW (not REJECTED)", async () => {
    aiService.generateStructuredAI.mockRejectedValue(new Error("Groq unavailable"));

    const result = await verifyProjectSubmission("cand-8", "proj-8", "https://github.com/owner/repo");

    expect(result.status).toBe(VERIFICATION_STATUS.NEEDS_ADMIN_REVIEW);
    expect(result.status).not.toBe(VERIFICATION_STATUS.REJECTED);
  });

  test("AI output exposes both `status` and `verificationStatus` (storage contract)", async () => {
    aiService.generateStructuredAI.mockResolvedValue(aiResult("VERIFIED", 0.9));

    const result = await verifyProjectSubmission("cand-9", "proj-9", "https://github.com/owner/repo");

    expect(result.status).toBeDefined();
    expect(result.verificationStatus).toBeDefined();
    expect(result.status).toBe(result.verificationStatus);
  });
});
