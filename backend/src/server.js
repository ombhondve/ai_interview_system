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
  try {
    const defaultAdminEmail = "admin@gmail.com";
    const defaultAdminPassword = "admin@123";
    
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: defaultAdminEmail });
    
    if (existingAdmin) {
      console.log(`✅ Default admin account already exists: ${defaultAdminEmail}`);
      return;
    }
    
    // Hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(defaultAdminPassword, saltRounds);
    
    // Create default admin
    const defaultAdmin = new Admin({
      name: "System Administrator",
      email: defaultAdminEmail,
      passwordHash: passwordHash,
      role: "superadmin"
    });
    
    await defaultAdmin.save();
    console.log(`✅ Default admin account created successfully`);
    console.log(`   Email: ${defaultAdminEmail}`);
    console.log(`   Password: ${defaultAdminPassword}`);
    console.log(`   Role: superadmin`);
    
  } catch (error) {
    console.error("❌ Failed to create default admin account:", error.message);
    console.log("⚠️  You may need to create admin account manually");
  }
}

async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    console.log("✅ MongoDB connected successfully");

    logGitHubConfiguration();

    // Initialize default admin account
    await initializeDefaultAdmin();
    
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
}

startServer();