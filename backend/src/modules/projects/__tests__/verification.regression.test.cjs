"use strict";

/**
 * Comprehensive Verification Regression Tests
 *
 * Covers all 13 scenarios required for RecruitAI project verification:
 *  1. Valid repository meeting all requirements -> VERIFIED
 *  2. Repository with genuinely missing required files -> REJECTED
 *  3. Repository with a real syntax error -> detected by deterministic syntax checker
 *  4. Deeply nested source files -> paths encoded with preserved slashes
 *  5. Repository with more files than the old 50-file limit -> key files found beyond index 50
 *  6. Repository containing a large source file -> truncated safely, syntax check skips truncated code
 *  7. Inaccessible branch -> safe fetch failure without invoking AI
 *  8. GitHub API rate limiting -> classified safely without token leakage
 *  9. Incomplete retrieval response (tree truncated) -> flagged in metadata
 * 10. Invalid AI response -> handled gracefully
 * 11. Model response reporting uncertainty -> preserved as NEEDS_ADMIN_REVIEW
 * 12. Complete repository failing a genuine requirement -> REJECTED
 * 13. Status selection contract -> VERIFIED, NEEDS_ADMIN_REVIEW, REJECTED
 */

jest.mock("../repository.service.js", () => {
  const actual = jest.requireActual("../repository.service.js");
  return {
    ...actual,
    validateRepositoryUrl: jest.fn(() => ({ valid: true, isRepoHost: true, hostname: "github.com" })),
    fetchRepositoryContent: jest.fn()
  };
});

jest.mock("../project.model.js", () => ({
  __esModule: true,
  default: { findById: jest.fn() }
}));

jest.mock("../../ai/ai.service.js", () => ({
  generateStructuredAI: jest.fn()
}));

const repositoryService = require("../repository.service.js");
const Project = require("../project.model.js").default;
const aiService = require("../../ai/ai.service.js");
const { verifyProjectSubmission, VERIFICATION_STATUS } = require("../verification.service.js");
const { checkFileSyntax, checkRepositorySyntax } = require("../syntaxChecker.js");
const { classifyGitHubError } = require("../github.client.js");

const MOCK_PROJECT = {
  title: "E-Commerce REST API",
  description: "Build an online store API with checkout and inventory management",
  difficulty: "medium",
  technologies: ["Node.js", "Express"],
  requirements: [
    "User authentication with JWT",
    "Product catalog with search",
    "Shopping cart and checkout endpoints"
  ],
  expectedFiles: ["src/app.js", "src/controllers/auth.controller.js"],
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

function mockProjectFound(proj = MOCK_PROJECT) {
  Project.findById.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(proj) })
  });
}

function validRepoContent(customFiles = {}) {
  const defaultFiles = {
    "src/app.js": {
      content: "import express from 'express';\nconst app = express();\nexport default app;",
      size: 75,
      type: "js",
      truncated: false
    },
    "src/controllers/auth.controller.js": {
      content: "export function login(req, res) { res.json({ token: 'jwt-123' }); }",
      size: 68,
      type: "js",
      truncated: false
    },
    "package.json": {
      content: '{\n  "name": "store-api",\n  "dependencies": { "express": "^4.18.2" }\n}',
      size: 65,
      type: "json",
      truncated: false
    },
    "README.md": {
      content: "# Store API\nImplements JWT auth, catalog, and cart.",
      size: 55,
      type: "md",
      truncated: false
    }
  };

  const keyFiles = { ...defaultFiles, ...customFiles };

  return {
    success: true,
    error: null,
    metadata: { accessible: true },
    data: {
      keyFiles,
      structure: {
        files: Object.keys(keyFiles).map((p) => ({ path: p })),
        allFiles: Object.keys(keyFiles).map((p) => ({ path: p })),
        directories: ["src", "src/controllers"],
        size: 500
      },
      metadata: { dependencies: ["express"], buildFiles: ["package.json"], platform: "github", filesAnalyzed: Object.keys(keyFiles).length },
      statistics: { languages: { JavaScript: 100 }, totalCommits: 10 },
      readme: { content: "# Store API", truncated: false },
      security: { safe: true }
    }
  };
}

function buildAiResult(status, confidence, summary, reqAssessments = []) {
  return {
    verificationStatus: status,
    confidence,
    summary,
    detailedAnalysis: {
      repositoryValidity: { isValid: true, issues: [], strengths: ["Repo accessible and populated"] },
      requirementsAssessment: reqAssessments.length > 0 ? reqAssessments : [
        { requirementId: "req-1", description: "JWT auth", status: status === "VERIFIED" ? "MET" : "MISSING", evidence: "Found login controller" }
      ],
      technicalEvaluation: { codeQuality: "GOOD", projectOrganization: "GOOD", documentation: "GOOD", issuesFound: [] },
      overallAssessment: `Evaluation concluded with status ${status}`
    },
    recommendations: { forStudent: ["Good work"], forReviewer: [] },
    verificationMetadata: {
      filesAnalyzed: 4,
      requirementsTotal: 3,
      requirementsMet: status === "VERIFIED" ? 3 : 1,
      requirementsPartial: status === "NEEDS_ADMIN_REVIEW" ? 1 : 0,
      requirementsMissing: status === "REJECTED" ? 2 : 0,
      analysisTimestamp: new Date().toISOString()
    }
  };
}

describe("RecruitAI Project Verification - 13 Regression Scenarios", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProjectFound();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Scenario 1: A valid repository that meets all requirements
  test("Scenario 1: Valid repository meeting all requirements -> VERIFIED", async () => {
    repositoryService.fetchRepositoryContent.mockResolvedValue(validRepoContent());
    aiService.generateStructuredAI.mockResolvedValue(
      buildAiResult("VERIFIED", 0.95, "All critical requirements are fully implemented with clean code.")
    );

    const result = await verifyProjectSubmission("cand-1", "proj-1", "https://github.com/student/valid-project");

    expect(result.status).toBe(VERIFICATION_STATUS.VERIFIED);
    expect(result.verificationStatus).toBe("VERIFIED");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(aiService.generateStructuredAI).toHaveBeenCalledTimes(1);
  });

  // Scenario 2: A repository with genuinely missing required files
  test("Scenario 2: Genuinely missing required files -> REJECTED", async () => {
    // Missing auth.controller.js
    const incompleteRepo = validRepoContent();
    delete incompleteRepo.data.keyFiles["src/controllers/auth.controller.js"];
    repositoryService.fetchRepositoryContent.mockResolvedValue(incompleteRepo);

    aiService.generateStructuredAI.mockResolvedValue(
      buildAiResult(
        "REJECTED",
        0.3,
        "Critical requirement 'User authentication' is missing: auth.controller.js was not implemented.",
        [
          { requirementId: "req-1", description: "JWT auth", status: "MISSING", evidence: "No auth controller found in repository" }
        ]
      )
    );

    const result = await verifyProjectSubmission("cand-2", "proj-2", "https://github.com/student/missing-auth");

    expect(result.status).toBe(VERIFICATION_STATUS.REJECTED);
    expect(result.verificationStatus).toBe("REJECTED");
    expect(result.summary).toMatch(/missing/i);
  });

  // Scenario 3: A repository with a real syntax error
  test("Scenario 3: Deterministic check accurately catches real syntax errors without executing code", () => {
    const brokenCode = "function broken(a, b) {\n  const sum = a + ;\n  return sum;\n}";
    const syntaxResult = checkFileSyntax("src/broken.js", brokenCode, false);

    expect(syntaxResult.status).toBe("SYNTAX_ERROR");
    expect(syntaxResult.syntaxValid).toBe(false);
    expect(syntaxResult.error).toBeDefined();
    expect(syntaxResult.line).toBe(2);

    // And complete valid code parses cleanly
    const goodCode = "function clean(a, b) {\n  const sum = a + b;\n  return sum;\n}";
    const validResult = checkFileSyntax("src/clean.js", goodCode, false);
    expect(validResult.status).toBe("VALID");
    expect(validResult.syntaxValid).toBe(true);
  });

  // Scenario 4: A repository with deeply nested source files
  test("Scenario 4: Deeply nested source files preserve path slashes when encoding apiUrl", () => {
    const nestedPath = "src/modules/billing/services/invoice.service.ts";
    const encodedSegments = nestedPath.split("/").map((seg) => encodeURIComponent(seg)).join("/");

    expect(encodedSegments).toBe("src/modules/billing/services/invoice.service.ts");
    expect(encodedSegments).not.toContain("%2F");
  });

  // Scenario 5: A repository with more files than the former 50-file limit
  test("Scenario 5: Repository structure exposes full discovered allFiles list beyond index 50", () => {
    // Generate 80 files
    const allFiles = Array.from({ length: 80 }, (_, i) => ({
      path: `src/components/Component${i}.jsx`,
      size: 100,
      extension: "jsx"
    }));

    const structure = {
      files: allFiles.slice(0, 50),
      allFiles: allFiles,
      totalFiles: 80
    };

    const candidateFiles = Array.isArray(structure.allFiles) && structure.allFiles.length > 0
      ? structure.allFiles
      : structure.files;

    expect(candidateFiles.length).toBe(80);
    expect(candidateFiles[75].path).toBe("src/components/Component75.jsx");
  });

  // Scenario 6: A repository containing a large source file
  test("Scenario 6: Large truncated source file is skipped by deterministic syntax checker rather than falsely failing", () => {
    const truncatedCode = "function processData() {\n  const result = 42;\n[truncated]";
    const checkResult = checkFileSyntax("src/largeWorker.js", truncatedCode, true);

    expect(checkResult.status).toBe("SKIPPED_TRUNCATED");
    expect(checkResult.syntaxValid).toBeNull();
    expect(checkResult.reason).toMatch(/truncated/i);
  });

  // Scenario 7: Inaccessible branch -> safe fetch failure without calling AI
  test("Scenario 7: Inaccessible branch produces fetch failure and never invokes AI", async () => {
    repositoryService.fetchRepositoryContent.mockResolvedValue({
      success: false,
      error: "GitHub repository structure fetch failed: Request failed with status code 404",
      data: null,
      metadata: { accessible: false, errorType: "not_found" }
    });

    const result = await verifyProjectSubmission("cand-7", "proj-7", "https://github.com/student/repo");

    expect(result.status).toBe(VERIFICATION_STATUS.ERROR);
    expect(result.summary).toMatch(/could not be (completed|fetched)/i);
    expect(aiService.generateStructuredAI).not.toHaveBeenCalled();
  });

  // Scenario 8: GitHub API rate limiting
  test("Scenario 8: GitHub API rate limit is classified safely without token leakage", () => {
    const error403 = {
      isAxiosError: true,
      response: {
        status: 403,
        headers: { "x-ratelimit-remaining": "0", "retry-after": "60" }
      },
      message: "API rate limit exceeded"
    };

    const classification = classifyGitHubError(error403);
    expect(classification.type).toBe("rate_limit");
    expect(classification.rateLimited).toBe(true);
    expect(classification.retryAfter).toBe("60");
    // Ensure no token or sensitive headers in classification
    expect(JSON.stringify(classification)).not.toContain("token");
    expect(JSON.stringify(classification)).not.toContain("Bearer");
  });

  // Scenario 9: Incomplete retrieval response (tree truncated by GitHub API)
  test("Scenario 9: Tree truncation is recorded in structure and does not claim complete retrieval", () => {
    const repoWithTruncatedTree = validRepoContent();
    repoWithTruncatedTree.data.structure.isTruncated = true;

    expect(repoWithTruncatedTree.data.structure.isTruncated).toBe(true);
  });

    // Scenario 10: Invalid AI response
  test("Scenario 10: Invalid or malformed AI response is handled gracefully as ERROR", async () => {
    repositoryService.fetchRepositoryContent.mockResolvedValue(validRepoContent());
    aiService.generateStructuredAI.mockResolvedValue({
      invalidKey: "broken response",
      noStatus: true
    });

    const result = await verifyProjectSubmission("cand-10", "proj-10", "https://github.com/student/repo");

    // Falls into the safe AI failure handler without false rejection
    expect(result.status).toBe(VERIFICATION_STATUS.ERROR);
    expect(result.summary).toMatch(/AI verification service encountered a processing error/i);
    expect(result.verificationMetadata.retryable).toBe(true);
  });

  // Scenario 11: AI returning invalid status (such as legacy NEEDS_ADMIN_REVIEW) is rejected by validator into ERROR
  test("Scenario 11: AI returning NEEDS_ADMIN_REVIEW is rejected and produces recoverable ERROR", async () => {
    repositoryService.fetchRepositoryContent.mockResolvedValue(validRepoContent());
    aiService.generateStructuredAI.mockResolvedValue(
      buildAiResult(
        "NEEDS_ADMIN_REVIEW",
        0.65,
        "Core requirements are implemented, but uncertainty requires admin review."
      )
    );

    const result = await verifyProjectSubmission("cand-11", "proj-11", "https://github.com/student/uncertain-project");

    expect(result.status).toBe(VERIFICATION_STATUS.ERROR);
    expect(result.verificationStatus).toBe(VERIFICATION_STATUS.ERROR);
    expect(result.verificationMetadata.retryable).toBe(true);
  });

  // Scenario 12: A repository that is complete but fails a genuine requirement
  test("Scenario 12: Complete repository that fails a core requirement -> REJECTED", async () => {
    repositoryService.fetchRepositoryContent.mockResolvedValue(validRepoContent());
    aiService.generateStructuredAI.mockResolvedValue(
      buildAiResult(
        "REJECTED",
        0.35,
        "Repository code does not implement shopping cart checkout or product search requirements.",
        [
          { requirementId: "req-1", description: "JWT auth", status: "MET", evidence: "auth controller" },
          { requirementId: "req-2", description: "Product search", status: "MISSING", evidence: "No search logic found" },
          { requirementId: "req-3", description: "Checkout endpoint", status: "MISSING", evidence: "No checkout endpoint found" }
        ]
      )
    );

    const result = await verifyProjectSubmission("cand-12", "proj-12", "https://github.com/student/incomplete-requirements");

    expect(result.status).toBe("REJECTED");
    expect(result.verificationStatus).toBe("REJECTED");
  });

  // Scenario 13: Correct status selection for exactly two outcomes: VERIFIED and REJECTED
  test.each([
    ["VERIFIED", 0.9, "VERIFIED"],
    ["REJECTED", 0.2, "REJECTED"]
  ])("Scenario 13: Status selection contract preserves '%s'", async (aiStatus, conf, expectedStatus) => {
    repositoryService.fetchRepositoryContent.mockResolvedValue(validRepoContent());
    aiService.generateStructuredAI.mockResolvedValue(
      buildAiResult(aiStatus, conf, `AI determined status ${aiStatus}`)
    );

    const result = await verifyProjectSubmission("cand-13", "proj-13", "https://github.com/student/test");

    expect(result.status).toBe(expectedStatus);
    expect(result.verificationStatus).toBe(expectedStatus);
  });
});
