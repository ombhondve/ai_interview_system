/**
 * GitHub repository URL normalisation tests
 *
 * Regression coverage for the clone-URL bug: a submitted URL such as
 *   https://github.com/ombhondve/EduReg2.git
 * was previously passed through verbatim, producing the API endpoint
 *   https://api.github.com/repos/ombhondve/EduReg2.git
 * which GitHub answers with 404 even though the repository exists.
 *
 * parseGitHubRepoUrl() is the single source of truth for owner/repo
 * extraction used by every GitHub API call in repository.service.js.
 *
 * HOW TO RUN:
 *   cd backend
 *   npx jest --testPathPattern=github.url
 */

const path = require("path");

const REPOSITORY_SERVICE_FILE = path.resolve(__dirname, "../repository.service.js");

describe("parseGitHubRepoUrl (GitHub URL normalisation)", () => {
  let parseGitHubRepoUrl;

  beforeAll(() => {
    // repository.service.js is ESM; babel-jest transpiles it for this
    // CommonJS test context (same approach as github.client.test.cjs).
    const repo = require(REPOSITORY_SERVICE_FILE);
    parseGitHubRepoUrl = repo.parseGitHubRepoUrl;
  });

  // --- The exact reported regression -------------------------------------
  test("strips the trailing .git clone suffix", () => {
    const parsed = parseGitHubRepoUrl("https://github.com/ombhondve/EduReg2.git");

    expect(parsed).toEqual({ owner: "ombhondve", repo: "EduReg2" });
  });

  test("the .git URL produces the correct GitHub API endpoint", () => {
    const { owner, repo } = parseGitHubRepoUrl("https://github.com/ombhondve/EduReg2.git");

    expect(`https://api.github.com/repos/${owner}/${repo}`).toBe(
      "https://api.github.com/repos/ombhondve/EduReg2"
    );
    // The repo segment must be free of the clone suffix, otherwise the request
    // URL ends in "/EduReg2.git" and GitHub answers 404.
    expect(repo).toBe("EduReg2");
    expect(repo.endsWith(".git")).toBe(false);
    expect(`${owner}/${repo}`).toBe("ombhondve/EduReg2");
  });

  // --- Accepted without .git (existing behaviour preserved) -------------
  test("accepts a plain repository URL unchanged", () => {
    expect(parseGitHubRepoUrl("https://github.com/ombhondve/EduReg2")).toEqual({
      owner: "ombhondve",
      repo: "EduReg2"
    });
  });

  // --- Trailing slash / .git/ variants ---------------------------------
  test.each([
    ["trailing slash", "https://github.com/ombhondve/EduReg2/"],
    [".git with trailing slash", "https://github.com/ombhondve/EduReg2.git/"],
    ["multiple trailing slashes", "https://github.com/ombhondve/EduReg2///"],
  ])("normalises %s", (_label, url) => {
    expect(parseGitHubRepoUrl(url)).toEqual({ owner: "ombhondve", repo: "EduReg2" });
  });

  // --- Extra robustness -------------------------------------------------
  test("ignores query strings and hash fragments", () => {
    expect(parseGitHubRepoUrl("https://github.com/ombhondve/EduReg2.git?tab=readme-ov-file")).toEqual({
      owner: "ombhondve",
      repo: "EduReg2"
    });
    expect(parseGitHubRepoUrl("https://github.com/ombhondve/EduReg2#readme")).toEqual({
      owner: "ombhondve",
      repo: "EduReg2"
    });
  });

  test("only strips .git at the end, never mid-name", () => {
    expect(parseGitHubRepoUrl("https://github.com/owner/my.git.repo")).toEqual({
      owner: "owner",
      repo: "my.git.repo"
    });
  });

  test("preserves repository names that contain dots", () => {
    expect(parseGitHubRepoUrl("https://github.com/owner/project.js")).toEqual({
      owner: "owner",
      repo: "project.js"
    });
  });

  test("preserves case of owner and repo", () => {
    expect(parseGitHubRepoUrl("https://github.com/OmBhondve/EduReg2.GIT")).toEqual({
      owner: "OmBhondve",
      repo: "EduReg2"
    });
  });

  test("ignores extra path segments after the repo", () => {
    expect(parseGitHubRepoUrl("https://github.com/owner/repo/tree/main/src")).toEqual({
      owner: "owner",
      repo: "repo"
    });
  });

  // --- Invalid input returns null ---------------------------------------
  test.each([
    ["missing repo segment", "https://github.com/owner"],
    ["host only", "https://github.com"],
    ["not a URL", "not-a-url"],
    ["empty string", ""],
  ])("returns null for %s", (_label, url) => {
    expect(parseGitHubRepoUrl(url)).toBeNull();
  });
});