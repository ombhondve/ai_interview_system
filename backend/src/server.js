import "./config/suppressWarnings.js";
import "dotenv/config";
import bcrypt from "bcrypt";

import app from "./app.js";
import connectDatabase from "./config/database.js";
import Admin from "./modules/admin/admin.model.js";
import {
  isGitHubTokenConfigured,
  getGitHubTimeoutMs,
} from "./modules/projects/github.client.js";

const PORT = process.env.PORT || 5000;

/**
 * Log the GitHub configuration state (never the token itself).
 *
 * WHY THIS EXISTS
 * ---------------
 * Without a GITHUB_TOKEN, GitHub allows only 60 anonymous requests per hour
 * PER IP ADDRESS. A single repository verification issues ~7 structural API
 * calls plus up to 20 file-content calls - roughly 27 requests. On a shared
 * serverless IP that limit is exhausted within a couple of verifications, and
 * every later fetch fails with HTTP 403 (rate limited).
 *
 * When that happens the verifier correctly refuses to guess and routes the
 * submission to NEEDS_ADMIN_REVIEW. So a missing token does NOT produce a wrong
 * REJECTED - it produces a large, silent flood of "Under Review" results that
 * look like AI uncertainty but are really infrastructure exhaustion.
 *
 * Making this visible at boot is the difference between diagnosing that in
 * minutes and in days.
 */
function logGitHubConfiguration() {
  const configured = isGitHubTokenConfigured();

  console.log(
    `   GitHub API token: ${configured ? "configured" : "NOT CONFIGURED"}`
  );
  console.log(`   GitHub API timeout: ${getGitHubTimeoutMs()}ms`);

  if (!configured) {
    console.warn(
      "⚠️  GITHUB_TOKEN is not set. GitHub will rate-limit anonymous access to" +
        " 60 requests/hour per IP, and each verification uses ~27 requests." +
        " Set GITHUB_TOKEN (a fine-grained read-only public-repo token) to avoid" +
        " spurious NEEDS_ADMIN_REVIEW results caused by rate limiting."
    );
  }
}

async function initializeDefaultAdmin() {
  const email = process.env.DEMO_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.DEMO_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("Admin seed skipped: DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD must be configured.");
    return;
  }

  const existingAdmin = await Admin.findOne({ email });
  if (existingAdmin) return;

  const passwordHash = await bcrypt.hash(password, 12);
  await Admin.create({
    name: process.env.DEMO_ADMIN_NAME || "System Administrator",
    email,
    passwordHash,
    role: process.env.DEMO_ADMIN_ROLE === "recruiter" ? "recruiter" : "superadmin",
  });
  console.log("Configured admin account created.");
}

async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    console.log("✅ MongoDB connected successfully");

    logGitHubConfiguration();

    // Start background interview lifecycle scheduler
    const { syncInterviewLifecycles } = await import("./modules/interview/interview.lifecycle.service.js");
    setInterval(async () => {
      try {
        await syncInterviewLifecycles();
      } catch (err) {
        console.error("Interview lifecycle sync error:", err.message);
      }
    }, 60 * 1000);
    console.log("✅ Interview lifecycle scheduler initialized (every 60s)");
    
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
}

startServer();