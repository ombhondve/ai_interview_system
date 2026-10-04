/**
 * Shared GitHub API client/helper
 *
 * Provides a single, auditable way to call the GitHub REST API for
 * repository verification:
 *
 *   - Configurable timeout (default 30000 ms) via GITHUB_API_TIMEOUT_MS
 *   - GitHub API headers (Accept + User-Agent)
 *   - Optional authentication via GITHUB_TOKEN (never logged / never returned)
 *   - Bounded retry with exponential backoff for timeout / network / 5xx
 *     (and 429 / rate-limited 403) errors
 *   - No retry for permanent 4xx errors (e.g. 404 Not Found)
 *   - Log-safe error classification that never exposes the token
 *
 * SAFETY: read-only metadata/content access. This helper never executes
 * repository code and never treats repository content as instructions.
 */

import axios from "axios";
import logger from "../../utils/logger.js";

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RETRIES = 2; // additional attempts after the first
const DEFAULT_RETRY_DELAY_MS = 1000; // base delay for exponential backoff
const MAX_RETRY_DELAY_MS = 8000;

const NETWORK_ERROR_CODES = new Set([
  "ENOTFOUND",
  "ECONNRESET",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ERR_NETWORK",
  "ERR_SOCKET_TIMEOUT",
  "EHOSTUNREACH",
  "ENETUNREACH"
]);

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Per-request timeout (ms). Defaults to 30000, override with GITHUB_API_TIMEOUT_MS.
 */
export function getGitHubTimeoutMs() {
  return parsePositiveInt(process.env.GITHUB_API_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
}

/**
 * Number of retries after the first attempt. Defaults to 2.
 */
export function getGitHubMaxRetries() {
  return parsePositiveInt(process.env.GITHUB_API_MAX_RETRIES, DEFAULT_MAX_RETRIES);
}

/**
 * Base delay (ms) for exponential backoff. Defaults to 1000.
 */
export function getGitHubRetryDelayMs() {
  return parsePositiveInt(process.env.GITHUB_API_RETRY_DELAY_MS, DEFAULT_RETRY_DELAY_MS);
}

/**
 * Whether a GitHub token is configured. Never returns the token itself.
 */
export function isGitHubTokenConfigured() {
  return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim());
}

/**
 * Build GitHub API request headers. Authorization is added ONLY when a token
 * is configured. The token value is never logged or exposed to callers.
 */
export function buildGitHubHeaders(extraHeaders = {}) {
  const headers = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "RecruitAI-Backend",
    ...extraHeaders
  };

  const token = process.env.GITHUB_TOKEN;
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  return headers;
}

/**
 * Detect a GitHub rate-limit response (403 with remaining=0 / Retry-After, or 429).
 */
function isRateLimitResponse(response) {
  if (!response) return false;

  const status = response.status;
  const headers = response.headers || {};
  const remaining = headers["x-ratelimit-remaining"];
  const retryAfter = headers["retry-after"];

  if (status === 429) return true;
  if (status === 403 && (remaining === "0" || retryAfter != null)) return true;

  return false;
}

/**
 * Classify an axios error into a stable, log-safe descriptor.
 *
 * IMPORTANT: the returned object deliberately excludes error.config/headers
 * so the Authorization token can never leak into logs or responses.
 */
export function classifyGitHubError(error) {
  const response = error?.response ?? null;
  const status = response?.status ?? null;
  const code = error?.code ?? null;
  const message = error?.message || "Unknown GitHub API error";

  const isAxiosError = error?.isAxiosError === true;
  const isTimeout =
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    /timeout/i.test(message);
  const isNetwork =
    NETWORK_ERROR_CODES.has(code) ||
    (isAxiosError && !response && !isTimeout) ||
    /network/i.test(message);

  let type = "unknown";
  if (isTimeout) {
    type = "timeout";
  } else if (isNetwork) {
    type = "network_error";
  } else if (status === 404) {
    type = "not_found";
  } else if (status === 401) {
    type = "unauthorized";
  } else if (isRateLimitResponse(response)) {
    type = "rate_limit";
  } else if (status != null && status >= 500) {
    type = "server_error";
  } else if (status != null && status >= 400) {
    type = "client_error";
  }

  return {
    type,
    status,
    code,
    rateLimited: type === "rate_limit",
    retryAfter: response?.headers?.["retry-after"] ?? null,
    rateLimitRemaining: response?.headers?.["x-ratelimit-remaining"] ?? null,
    message
  };
}

/**
 * Whether an error is worth retrying:
 *   - timeout / network errors  -> yes
 *   - rate limited (429 / 403)  -> yes
 *   - 5xx server errors         -> yes
 *   - permanent 4xx (404, 401)  -> no
 */
export function isRetryableGitHubError(error) {
  const { type, status } = classifyGitHubError(error);

  if (type === "timeout" || type === "network_error") return true;
  if (type === "rate_limit") return true;
  if (status != null && status >= 500 && status <= 599) return true;

  return false;
}

/**
 * Compute the backoff delay before the next attempt.
 */
function backoffDelayMs(attempt, baseDelayMs, response) {
  const retryAfter = response?.headers?.["retry-after"];
  if (retryAfter != null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
    }
  }

  const exponential = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(exponential + jitter, MAX_RETRY_DELAY_MS);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Perform a GET request against the GitHub API with shared configuration,
 * optional authentication and bounded retries.
 *
 * @param {string} url - absolute GitHub API URL
 * @param {object} [options]
 * @param {object} [options.headers]    extra headers merged over the defaults
 * @param {number} [options.timeout]    per-request timeout (ms)
 * @param {number} [options.maxRetries] retries after the first attempt
 * @param {object} [options.params]     query params
 * @param {object} [options.axiosImpl]  injectable axios-like impl (tests)
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export async function githubGet(url, options = {}) {
  const {
    headers: extraHeaders = {},
    timeout = getGitHubTimeoutMs(),
    maxRetries = getGitHubMaxRetries(),
    params,
    axiosImpl
  } = options;

  const client = axiosImpl || axios;
  const totalAttempts = Math.max(1, maxRetries + 1);
  const baseDelayMs = getGitHubRetryDelayMs();

  let lastError = null;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    try {
      return await client.get(url, {
        timeout,
        headers: buildGitHubHeaders(extraHeaders),
        ...(params ? { params } : {})
      });
    } catch (error) {
      lastError = error;
      const info = classifyGitHubError(error);
      const retryable = isRetryableGitHubError(error);

      logger.warn(
        `GitHub API request failed [attempt ${attempt}/${totalAttempts}] ` +
          `type=${info.type} status=${info.status ?? "n/a"} ` +
          `code=${info.code ?? "n/a"} url=${url}`
      );

      if (!retryable || attempt === totalAttempts) {
        throw error;
      }

      await delay(backoffDelayMs(attempt, baseDelayMs, error?.response));
    }
  }

  // Unreachable, but keeps the function total.
  throw lastError;
}
