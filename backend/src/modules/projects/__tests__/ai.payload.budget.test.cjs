"use strict";

/**
 * AI verification payload budget tests
 *
 * Regression coverage for the HTTP 413 failure:
 *   "Request too large for model <model>. TPM Limit: 8000.
 *    Requested: 57447 tokens."
 *
 * Proves that NO repository size can produce an AI request larger than the
 * configured budget, that junk is excluded, that high-value evidence is
 * prioritised, and that truncation is clearly marked.
 *
 * HOW TO RUN:
 *   cd backend
 *   npx jest --testPathPatterns=ai.payload.budget
 */

const path = require("path");

const BUDGET_FILE = path.resolve(__dirname, "../aiPayloadBudget.js");
const PROMPT_FILE = path.resolve(__dirname, "../../ai/ai.prompt.js");

// The real provider limit that caused the outage.
const GROQ_TPM_LIMIT_TOKENS = 8000;

describe("AI verification payload budget", () => {
  let budget;
  let systemPromptChars;

  beforeAll(() => {
    budget = require(BUDGET_FILE);
    const prompt = require(PROMPT_FILE);
    systemPromptChars = (prompt.projectVerificationPrompt || "").length;
  });

  const big = (n) =>
    Array.from(
      { length: n },
      (_, i) => `  ${i}: realistic source line number ${i} with some content`
    ).join("\n");

  /**
   * Mirrors the real flow in verification.service.js:
   * requirements are measured first, the remainder becomes the repo budget.
   */
  const buildUserPayload = (repo, reqs) => {
    const userBudget = budget.getUserPayloadBudgetChars(systemPromptChars);
    const wrapper = JSON.stringify(
      { PROJECT_REQUIREMENTS: {}, REPOSITORY_CONTENT: {}, METADATA: {} },
      null,
      2
    ).length;
    const reqChars = JSON.stringify(reqs, null, 2).length;
    const repoBudget = Math.max(1200, userBudget - reqChars - wrapper - 200);
    const compact = budget.buildCompactRepository(repo, reqs, repoBudget);
    return {
      compact,
      userBudget,
      serialised: budget.enforcePayloadBudget(
        {
          PROJECT_REQUIREMENTS: reqs,
          REPOSITORY_CONTENT: compact.content,
          METADATA: {}
        },
        userBudget
      ).content
    };
  };

  const makeRepo = (keyFiles, files) => ({
    structure: {
      files: (files || Object.keys(keyFiles)).map((p) => ({
        path: p,
        extension: "js"
      })),
      directories: [],
      languageBreakdown: { JavaScript: "100%" }
    },
    keyFiles,
    metadata: {
      platform: "github",
      filesAnalyzed: Object.keys(keyFiles).length,
      dependencies: ["express"],
      buildFiles: []
    },
    readme: null,
    security: {}
  });

  const REQS = {
    title: "Todo Service",
    description: "A todo API",
    expectedFiles: ["package.json", "README.md"],
    requirements: Array.from({ length: 30 }, (_, i) => ({
      id: `r${i}`,
      description: `Requirement ${i} with a reasonably long description of what is needed`
    }))
  };

  // --- Budget configuration ---------------------------------------------
  test("default budget stays within the requested 5000-6500 token target", () => {
    const tokens = budget.getMaxInputTokens();
    expect(tokens).toBeGreaterThanOrEqual(5000);
    expect(tokens).toBeLessThanOrEqual(6500);
    expect(tokens).toBeLessThan(GROQ_TPM_LIMIT_TOKENS);
  });

  test("user payload budget reserves room for the system prompt", () => {
    expect(systemPromptChars).toBeGreaterThan(0);
    const userBudget = budget.getUserPayloadBudgetChars(systemPromptChars);
    expect(systemPromptChars + userBudget).toBeLessThanOrEqual(
      budget.getMaxInputChars()
    );
  });

  // --- The core regression ----------------------------------------------
  test("a huge repository can NEVER exceed the budget", () => {
    const keyFiles = {};
    for (let i = 0; i < 60; i++) {
      keyFiles[`src/service${i}.js`] = { content: big(600), size: 40000 };
    }
    const { serialised, userBudget } = buildUserPayload(makeRepo(keyFiles), REQS);

    expect(serialised.length).toBeLessThanOrEqual(userBudget);
  });

  test("a repository far beyond the limit stays under the provider TPM limit", () => {
    const keyFiles = {};
    for (let i = 0; i < 40; i++) {
      keyFiles[`src/module${i}/file${i}.js`] = { content: big(3000), size: 200000 };
    }
    keyFiles["README.md"] = { content: big(2000), size: 120000 };

    const { serialised } = buildUserPayload(makeRepo(keyFiles), REQS);
    const totalTokens =
      budget.estimateTokens(systemPromptChars + "") + budget.estimateTokens(serialised);

    expect(totalTokens).toBeLessThan(GROQ_TPM_LIMIT_TOKENS);
    expect(totalTokens).toBeLessThanOrEqual(6500);
  });

  test("enforcePayloadBudget strips repository evidence down to the cap", () => {
    const huge = {
      PROJECT_REQUIREMENTS: REQS,
      REPOSITORY_CONTENT: makeRepo(
        Object.fromEntries(
          Array.from({ length: 30 }, (_, i) => [
            `src/x${i}.js`,
            { content: big(2000) }
          ])
        )
      )
    };
    const out = budget.enforcePayloadBudget(huge, 6000);
    expect(out.content.length).toBeLessThanOrEqual(6000);
    expect(() => JSON.parse(out.content)).not.toThrow();
    // All file CONTENT is dropped before requirements are touched.
    expect(out.content.length).toBeLessThan(JSON.stringify(huge, null, 2).length);
  });

  test("requirements are never trimmed - only repository evidence is", () => {
    const requirements = REQS;
    const repo = makeRepo({ "server.js": { content: big(4000) } });
    const out = budget.enforcePayloadBudget(
      { PROJECT_REQUIREMENTS: requirements, REPOSITORY_CONTENT: repo, METADATA: {} },
      6000
    );
    expect(JSON.parse(out.content).PROJECT_REQUIREMENTS).toEqual(requirements);
  });

  // --- Exclusion rules --------------------------------------------------
  test("excludes vendored, build, binary and lock files", () => {
    const keyFiles = {
      "node_modules/left-pad/index.js": { content: big(100) },
      "dist/bundle.js": { content: big(100) },
      "build/output.js": { content: big(100) },
      ".git/config": { content: big(100) },
      "coverage/lcov.info": { content: big(100) },
      "package-lock.json": { content: big(100) },
      "yarn.lock": { content: big(100) },
      "assets/logo.png": { content: "x".repeat(5000) },
      "assets/app.min.js": { content: big(100) },
      "assets/vendor.js.map": { content: big(100) },
      "README.md": { content: "# My Project" },
      "server.js": { content: big(50) }
    };

    const { compact } = buildUserPayload(makeRepo(keyFiles), REQS);
    const included = Object.keys(compact.content.keyFiles);

    expect(included).toContain("README.md");
    expect(included).toContain("server.js");
    [
      "node_modules/left-pad/index.js",
      "dist/bundle.js",
      "build/output.js",
      ".git/config",
      "package-lock.json",
      "yarn.lock",
      "assets/logo.png",
      "assets/app.min.js",
      "assets/vendor.js.map"
    ].forEach((excluded) => expect(included).not.toContain(excluded));
  });

  test("isExcludedPath flags junk and preserves real source paths", () => {
    expect(budget.isExcludedPath("node_modules/react/index.js")).toBe(true);
    expect(budget.isExcludedPath("src/services/user.service.js")).toBe(false);
    expect(budget.isExcludedPath("backend/models/User.js")).toBe(false);
    expect(budget.isExcludedPath("package.json")).toBe(false);
  });

  test("binary-looking content is never sent", () => {
    const keyFiles = {
      "data/blob.js": { content: "\u0001\u0002\u0003".repeat(500) },
      "server.js": { content: big(30) }
    };
    const { compact } = buildUserPayload(makeRepo(keyFiles), REQS);
    expect(Object.keys(compact.content.keyFiles)).not.toContain("data/blob.js");
  });
// --- Prioritisation ---------------------------------------------------
  test("prioritises README, manifests and entry points over ordinary files", () => {
    const keyFiles = {
      "README.md": { content: "# Project" },
      "package.json": { content: "{}" },
      "server.js": { content: big(20) },
      "src/util/helper.js": { content: big(20) }
    };
    const { compact } = buildUserPayload(makeRepo(keyFiles), REQS);

    expect(Object.keys(compact.content.keyFiles)).toEqual(
      expect.arrayContaining(["README.md", "package.json", "server.js"])
    );
    expect(budget.scoreFile("README.md")).toBeGreaterThan(
      budget.scoreFile("src/util/helper.js")
    );
    expect(budget.scoreFile("package.json")).toBeGreaterThan(
      budget.scoreFile("src/util/helper.js")
    );
    expect(budget.scoreFile("server.js")).toBeGreaterThan(
      budget.scoreFile("src/util/helper.js")
    );
  });

  test("files explicitly required by the project outrank generic source", () => {
    expect(budget.scoreFile("package.json", ["package.json"])).toBeGreaterThan(
      budget.scoreFile("src/whatever.js", [])
    );
  });

  // --- Truncation -------------------------------------------------------
  test("truncates large files and marks them with [truncated]", () => {
    const keyFiles = {
      "server.js": { content: big(5000) },
      "README.md": { content: big(3000) }
    };
    const { compact } = buildUserPayload(makeRepo(keyFiles), REQS);

    expect(compact.content.readme.truncated).toBe(true);
    expect(compact.content.readme.content).toContain("[truncated]");
  });

  test("truncateText never exceeds maxChars and marks when cutting", () => {
    const res = budget.truncateText("x".repeat(5000), 500);
    expect(res.content.length).toBeLessThanOrEqual(500);
    expect(res.content).toContain("[truncated]");
    expect(res.truncated).toBe(true);

    const keep = budget.truncateText("short", 500);
    expect(keep.content).toBe("short");
    expect(keep.truncated).toBe(false);
  });

  // --- Edge cases -------------------------------------------------------
  test("empty and malformed repositories do not throw", () => {
    expect(() => budget.buildCompactRepository({}, REQS, 2000)).not.toThrow();
    expect(() => budget.buildCompactRepository(null, REQS, 2000)).not.toThrow();
    expect(() =>
      budget.buildCompactRepository({ keyFiles: null, structure: null }, REQS, 2000)
    ).not.toThrow();
  });

  test("payload remains valid JSON for the model to parse", () => {
    const keyFiles = { "server.js": { content: big(500) } };
    const { serialised } = buildUserPayload(makeRepo(keyFiles), REQS);
    const parsed = JSON.parse(serialised);

    expect(parsed).toHaveProperty("PROJECT_REQUIREMENTS");
    expect(parsed).toHaveProperty("REPOSITORY_CONTENT");
    expect(typeof parsed.REPOSITORY_CONTENT.keyFiles).toBe("object");
  });
});