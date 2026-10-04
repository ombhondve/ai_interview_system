/**
 * Vercel background-execution helper.
 *
 * A Vercel Function invocation is terminated once the HTTP response has been
 * sent. Any promise still pending at that moment is abandoned, which is why
 * fire-and-forget work started during a request silently dies.
 *
 * `waitUntil()` tells the platform to keep the runtime alive until the given
 * promise settles. Project verification (GitHub fetch -> AI analysis -> DB
 * write) takes far longer than the submission request, so it is registered
 * here instead of being awaited.
 *
 * Outside Vercel (local `npm start`, Jest) there is no request context. The
 * Node process is long-lived there, so the helper becomes a no-op and the
 * pending promise simply continues on its own.
 */

import { waitUntil as vercelWaitUntil } from "@vercel/functions";

/**
 * Register a promise with the platform so the current invocation stays alive
 * until it settles.
 *
 * @param {Promise<unknown>} promise Work that must not be abandoned.
 * @returns {boolean} true when the platform accepted it, false otherwise.
 */
export function keepInvocationAlive(promise) {
  if (!promise || typeof promise.then !== "function") return false;
  if (typeof vercelWaitUntil !== "function") return false;

  try {
    vercelWaitUntil(promise);
    return true;
  } catch {
    // No Vercel request context (local dev / unit tests).
    return false;
  }
}