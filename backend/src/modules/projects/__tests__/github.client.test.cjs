"use strict";

/**
 * GitHub client helper tests
 *
 * Covers the shared GitHub API helper (github.client.js):
 *   (a) successful GitHub fetch
 *   (b) GitHub timeout  -> retried, then throws
 *   (c) GitHub 500      -> retried, then throws
 *   (d) GitHub 404      -> NOT retried (permanent 4xx)
 *   (e) GitHub rate limit (403 rate-limited / 429) -> retried
 *
 * Plus header/auth behaviour and log-safety (token never leaks).
 *
 * HOW TO RUN:
 *   cd backend
 *   npx jest --testPathPattern=github.client
 */

const path = require("path");

const CLIENT_FILE = path.resolve(__dirname, "../github.client.js");
const ORIGINAL_ENV = { ...process.env };

// Build an axios-like error without a real network stack.
function axiosError({ status, code, headers, message } = {}) {
  const err = new Error(message || (status ? `Request failed with status code ${status}` : "request failed"));
  err.isAxiosError = true;
  if (code) err.code = code;
  if (status != null) {
    err.response = { status, headers: headers || {}, data: {} };
  }
  return err;
}

const URL = "https://api.github.com/repos/owner/repo";

describe("github.client helper", () => {
  let gh;

  beforeAll(() => {
    gh = require(CLIENT_FILE);
  });

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    // keep retries fast + deterministic for tests
    process.env.GITHUB_API_RETRY_DELAY_MS = "1";
    process.env.GITHUB_API_TIMEOUT_MS = "30000";
    delete process.env.GITHUB_TOKEN;

    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  // (a) ------------------------------------------------------------------
  test("(a) successful fetch returns the response with GitHub headers and default timeout", async () => {
    const get = jest.fn().mockResolvedValue({ status: 200, data: { full_name: "owner/repo" }, headers: {} });

    const res = await gh.githubGet(URL, { axiosImpl: { get } });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ full_name: "owner/repo" });
    expect(get).toHaveBeenCalledTimes(1);

    const config = get.mock.calls[0][1];
    expect(config.timeout).toBe(30000);
    expect(config.headers.Accept).toBe("application/vnd.github.v3+json");
    expect(config.headers["User-Agent"]).toBe("RecruitAI-Backend");
    expect(config.headers.Authorization).toBeUndefined();
  });

  test("adds Authorization header only when GITHUB_TOKEN is configured", async () => {
    const get = jest.fn().mockResolvedValue({ status: 200, data: {}, headers: {} });

    await gh.githubGet(URL, { axiosImpl: { get } });
    expect(get.mock.calls[0][1].headers.Authorization).toBeUndefined();

    process.env.GITHUB_TOKEN = "ghp_secret_token_value";
    await gh.githubGet(URL, { axiosImpl: { get } });
    expect(get.mock.calls[1][1].headers.Authorization).toBe("Bearer ghp_secret_token_value");

    // the raw token must never appear in logs
    const logged = console.warn.mock.calls.map((c) => c.join(" ")).join(" ");
    expect(logged).not.toContain("ghp_secret_token_value");
  });

  test("timeout is configurable via GITHUB_API_TIMEOUT_MS", async () => {
    process.env.GITHUB_API_TIMEOUT_MS = "45000";
    const get = jest.fn().mockResolvedValue({ status: 200, data: {}, headers: {} });

    await gh.githubGet(URL, { axiosImpl: { get } });
    expect(get.mock.calls[0][1].timeout).toBe(45000);
  });

  // (b) ------------------------------------------------------------------
  test("(b) retries on timeout (ECONNABORTED) then throws after maxRetries", async () => {
    const get = jest.fn().mockRejectedValue(axiosError({ code: "ECONNABORTED", message: "timeout of 10000ms exceeded" }));

    await expect(
      gh.githubGet(URL, { axiosImpl: { get }, maxRetries: 2 })
    ).rejects.toMatchObject({ code: "ECONNABORTED" });

    expect(get).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  test("retries on network error and recovers when a later attempt succeeds", async () => {
    const get = jest
      .fn()
      .mockRejectedValueOnce(axiosError({ code: "ECONNRESET" }))
      .mockResolvedValueOnce({ status: 200, data: { ok: true }, headers: {} });

    const res = await gh.githubGet(URL, { axiosImpl: { get }, maxRetries: 2 });

    expect(res.status).toBe(200);
    expect(get).toHaveBeenCalledTimes(2);
  });

  // (c) ------------------------------------------------------------------
  test("(c) retries on 5xx (500) then throws", async () => {
    const get = jest.fn().mockRejectedValue(axiosError({ status: 500 }));

    await expect(
      gh.githubGet(URL, { axiosImpl: { get }, maxRetries: 2 })
    ).rejects.toBeDefined();

    expect(get).toHaveBeenCalledTimes(3);
  });

  // (d) ------------------------------------------------------------------
  test("(d) does NOT retry a 404 (permanent 4xx)", async () => {
    const get = jest.fn().mockRejectedValue(axiosError({ status: 404 }));

    await expect(
      gh.githubGet(URL, { axiosImpl: { get }, maxRetries: 2 })
    ).rejects.toBeDefined();

    expect(get).toHaveBeenCalledTimes(1);
  });

  test("does NOT retry a 401 (permanent 4xx)", async () => {
    const get = jest.fn().mockRejectedValue(axiosError({ status: 401 }));

    await expect(
      gh.githubGet(URL, { axiosImpl: { get }, maxRetries: 2 })
    ).rejects.toBeDefined();

    expect(get).toHaveBeenCalledTimes(1);
  });

  // (e) ------------------------------------------------------------------
  test("(e) retries on rate-limited 403 (x-ratelimit-remaining=0)", async () => {
    const get = jest.fn().mockRejectedValue(
      axiosError({ status: 403, headers: { "x-ratelimit-remaining": "0" } })
    );

    await expect(
      gh.githubGet(URL, { axiosImpl: { get }, maxRetries: 2 })
    ).rejects.toBeDefined();

    expect(get).toHaveBeenCalledTimes(3);
  });

  test("(e) retries on 429 Too Many Requests", async () => {
    const get = jest.fn().mockRejectedValue(axiosError({ status: 429 }));

    await expect(
      gh.githubGet(URL, { axiosImpl: { get }, maxRetries: 2 })
    ).rejects.toBeDefined();

    expect(get).toHaveBeenCalledTimes(3);
  });
});

describe("github.client error classification", () => {
  let gh;

  beforeAll(() => {
    gh = require(CLIENT_FILE);
  });

  test("classifyGitHubError maps each failure type", () => {
    expect(gh.classifyGitHubError(axiosError({ code: "ECONNABORTED", message: "timeout of 10000ms exceeded" })).type).toBe("timeout");
    expect(gh.classifyGitHubError(axiosError({ code: "ECONNRESET" })).type).toBe("network_error");
    expect(gh.classifyGitHubError(axiosError({ status: 500 })).type).toBe("server_error");
    expect(gh.classifyGitHubError(axiosError({ status: 404 })).type).toBe("not_found");
    expect(gh.classifyGitHubError(axiosError({ status: 401 })).type).toBe("unauthorized");
    expect(gh.classifyGitHubError(axiosError({ status: 403, headers: { "x-ratelimit-remaining": "0" } })).type).toBe("rate_limit");
    expect(gh.classifyGitHubError(axiosError({ status: 429 })).type).toBe("rate_limit");
  });

  test("isRetryableGitHubError: retries transient, not permanent 4xx", () => {
    expect(gh.isRetryableGitHubError(axiosError({ code: "ECONNABORTED" }))).toBe(true);
    expect(gh.isRetryableGitHubError(axiosError({ status: 500 }))).toBe(true);
    expect(gh.isRetryableGitHubError(axiosError({ status: 429 }))).toBe(true);
    expect(gh.isRetryableGitHubError(axiosError({ status: 403, headers: { "x-ratelimit-remaining": "0" } }))).toBe(true);
    expect(gh.isRetryableGitHubError(axiosError({ status: 404 }))).toBe(false);
    expect(gh.isRetryableGitHubError(axiosError({ status: 401 }))).toBe(false);
  });

  test("classifyGitHubError never exposes request headers/config (no token leak)", () => {
    const err = axiosError({ status: 403 });
    err.config = { headers: { Authorization: "Bearer super-secret" } };

    const info = gh.classifyGitHubError(err);
    const serialized = JSON.stringify(info);

    expect(serialized).not.toContain("Authorization");
    expect(serialized).not.toContain("super-secret");
    expect(info).not.toHaveProperty("config");
    expect(info).not.toHaveProperty("headers");
  });
});
