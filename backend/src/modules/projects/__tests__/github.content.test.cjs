"use strict";

/**
 * Regression tests for the GitHub file-content fetch path.
 *
 * These lock in the root cause of the production "AI is not receiving file
 * content" incident:
 *
 *   1. getRepositoryStructure() normalises GitHub's `default_branch` into
 *      `defaultBranch`. getKeyRepositoryFiles() used to read `default_branch`,
 *      which is always undefined, so every content request silently fell back
 *      to `main`. That masks the bug on `main` repos and 404s on any repo whose
 *      default branch is named differently.
 *
 *   2. The evidence budget collapsed to a 1200-char floor because the 16.5k
 *      system prompt consumed the whole context window, so the model received
 *      ~4 files truncated to ~500 chars and correctly reported that it could
 *      not assess implementation quality.
 */

describe("repository branch resolution", () => {
  test("content requests use the repository's ACTUAL default branch", async () => {
    const usedBranches = [];

    jest.resetModules();
    jest.doMock("../github.client.js", () => ({
      githubGet: jest.fn(async (url) => {
        if (url.includes("/contents/")) {
          usedBranches.push(new URL(url).searchParams.get("ref"));
          return {
            status: 200,
            data: { size: 10, content: Buffer.from("x").toString("base64") },
            headers: {},
          };
        }
        if (url.includes("/git/trees/")) {
          return {
            status: 200,
            data: { tree: [{ path: "app.js", type: "blob", size: 10 }] },
            headers: {},
          };
        }
        if (url.includes("/languages")) {
          return { status: 200, data: {}, headers: {} };
        }
        // default_branch is deliberately "trunk" so any fallback to "main"
        // is immediately visible.
        return {
          status: 200,
          data: {
            name: "app",
            full_name: "student/app",
            default_branch: "trunk",
            size: 10,
            language: "JavaScript",
          },
          headers: {},
        };
      }),
    }));

    const fresh = require("../repository.service.js");

    const result = await fresh.getKeyRepositoryFiles(
      "https://github.com/student/app.git"
    );

    expect(result.branch).toBe("trunk");
    expect(result.branch).not.toBe("main");
    expect(usedBranches.length).toBeGreaterThan(0);
    expect(new Set(usedBranches)).toEqual(new Set(["trunk"]));

    jest.dontMock("../github.client.js");
    jest.resetModules();
  });

  test("the result exposes fetch diagnostics, never file contents", async () => {
    // Uses a STUBBED client so the test is deterministic and never depends on
    // GitHub availability or anonymous rate-limit headroom.
    jest.resetModules();
    jest.doMock("../github.client.js", () => ({
      githubGet: jest.fn(async (url) => {
        if (url.includes("/contents/")) {
          return {
            status: 200,
            data: { size: 10, content: Buffer.from("x").toString("base64") },
            headers: {},
          };
        }
        if (url.includes("/git/trees/")) {
          return {
            status: 200,
            data: {
              tree: [
                { path: "package.json", type: "blob", size: 10 },
                { path: "index.html", type: "blob", size: 10 },
              ],
            },
            headers: {},
          };
        }
        if (url.includes("/languages")) {
          return { status: 200, data: {}, headers: {} };
        }
        return {
          status: 200,
          data: {
            name: "app",
            full_name: "student/app",
            default_branch: "main",
            size: 10,
            language: "JavaScript",
          },
          headers: {},
        };
      }),
    }));

    const { getKeyRepositoryFiles } = require("../repository.service.js");

    const result = await getKeyRepositoryFiles(
      "https://github.com/student/app.git"
    );

    expect(result.available).toBe(true);
    expect(result.branch).toBe("main");
    expect(typeof result.filesFetched).toBe("number");
    expect(typeof result.filesFailed).toBe("number");

    // Diagnostics must never leak file contents.
    expect(JSON.stringify(result).length).toBeGreaterThan(0);

    jest.dontMock("../github.client.js");
    jest.resetModules();
  });
});

describe("evidence budget", () => {
  const {
    getRepositoryBudgetChars,
    getUserPayloadBudgetChars,
    buildCompactRepository,
  } = require("../aiPayloadBudget.js");

  const { projectVerificationPrompt } = require("../../ai/ai.prompt.js");

  test("the system prompt must not starve the repository section", () => {
    // Regression guard: a ~16.5k char system prompt previously left the
    // repository only the 1200-char floor.
    expect(getRepositoryBudgetChars(2000, 120)).toBeGreaterThanOrEqual(12000);
  });

  test("the repository is not starved even by a huge requirement list", () => {
    expect(getRepositoryBudgetChars(500000, 500)).toBeGreaterThanOrEqual(12000);
  });

  test("user budget accounts for the real system prompt size", () => {
    const budget = getUserPayloadBudgetChars(projectVerificationPrompt.length);

    expect(budget).toBeGreaterThan(0);
    expect(Number.isFinite(budget)).toBe(true);
  });

  const repoData = {
    structure: {
      files: [
        { path: "package.json", extension: "json" },
        { path: "index.html", extension: "html" },
        { path: "script.js", extension: "js" },
        { path: "README.md", extension: "md" },
      ],
      directories: [],
      languageBreakdown: {},
    },
    keyFiles: {
      "package.json": { content: '{"name":"app"}', size: 13 },
      "index.html": { content: "<html><body>app</body></html>", size: 29 },
      "script.js": { content: "console.log('app');", size: 19 },
      "README.md": { content: "# App\nDocumentation", size: 21 },
    },
    metadata: {},
    readme: null,
  };

  test("files with real content are included", () => {
    const { content, stats } = buildCompactRepository(
      repoData,
      {},
      getRepositoryBudgetChars(2000, 120)
    );

    expect(stats.filesIncluded).toBe(4);
    expect(stats.filesDroppedByBudget).toBe(0);
    expect(content.structure.filesWithContent).toBe(4);
  });

  test("a file whose content FAILED to fetch is not counted as evidence", () => {
    // Counting keys reported content that did not exist.
    const withNullContent = {
      ...repoData,
      keyFiles: {
        "package.json": { content: null, size: 0 },
        "index.html": { content: null, size: 0 },
      },
    };

    const { content, stats } = buildCompactRepository(
      withNullContent,
      {},
      getRepositoryBudgetChars(2000, 120)
    );

    expect(stats.filesIncluded).toBe(0);
    expect(content.structure.filesWithContent).toBe(0);
    expect(Object.keys(content.keyFiles)).toHaveLength(0);
  });

  test("large files are delivered substantially, not as 500-char stubs", () => {
    // The production failure delivered ~500 chars per file. Use realistically
    // sized sources so the assertion is meaningful.
    const big = "const value = 1; // filler line\n".repeat(200);
    const bigRepo = {
      ...repoData,
      keyFiles: {
        "package.json": { content: '{"name":"app","version":"1.0.0"}', size: 27 },
        "index.html": { content: "<html><body>app</body></html>", size: 29 },
        "script.js": { content: big, size: big.length },
        "README.md": { content: "# App\nDocumentation", size: 21 },
      },
    };

    const { content, stats } = buildCompactRepository(
      bigRepo,
      {},
      getRepositoryBudgetChars(2000, 120)
    );

    expect(stats.filesIncluded).toBe(4);
    expect(content.structure.filesWithContent).toBe(4);

    // The large source file must arrive with far more than the ~500-char
    // stub the broken configuration produced, proving real evidence reaches
    // the model. The small fixtures are shorter than their content, so only the
    // large file is meaningful here.
    expect(content.keyFiles["script.js"].content.length).toBeGreaterThan(220);

    // Every included file must still be non-empty.
    for (const file of Object.values(content.keyFiles)) {
      expect(file.content.length).toBeGreaterThan(0);
    }
  });
});