/**
 * Suppress legacy Node.js DEP0169 deprecation warning.
 *
 * In Node.js 22+, `url.parse()` emits DEP0169.
 * Internal Express 4 dependencies (such as `parseurl` and `express-session`)
 * rely on `url.parse()`.
 *
 * When running in serverless environments like Vercel, Node.js writes deprecation
 * warnings directly to `process.stderr`. Vercel automatically flags all stderr
 * streams as `[error]`, displaying a red error badge even though the HTTP request
 * succeeded (HTTP 200).
 *
 * This utility intercepts `DEP0169` warnings and prevents them from polluting
 * stderr with false error badges, while preserving all other process warnings.
 */

export function setupWarningSuppression() {
  if (globalThis.__warningSuppressionConfigured) {
    return;
  }
  globalThis.__warningSuppressionConfigured = true;

  const defaultListeners = process.listeners("warning");
  process.removeAllListeners("warning");

  process.on("warning", (warning, ...args) => {
    if (
      warning &&
      warning.name === "DeprecationWarning" &&
      (warning.code === "DEP0169" ||
        (typeof warning.message === "string" && warning.message.includes("url.parse")))
    ) {
      // Suppress DEP0169 to prevent Vercel [error] badge on stderr
      return;
    }

    if (defaultListeners.length > 0) {
      for (const listener of defaultListeners) {
        try {
          listener.call(process, warning, ...args);
        } catch (_) {
          // Fallback if custom listener throws
        }
      }
    } else {
      console.warn(
        `[${warning.name || "Warning"}] ${warning.code ? `[${warning.code}] ` : ""}${warning.message}`
      );
    }
  });
}

// Auto-execute when imported
setupWarningSuppression();

export default setupWarningSuppression;
