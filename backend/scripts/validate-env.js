#!/usr/bin/env node

/**
 * Backend Environment Validation Script
 *
 * Verifies that all required and active environment variables are properly configured
 * without ever exposing secret values or making external paid network calls.
 *
 * Usage:
 *   npm run validate-env
 *   node scripts/validate-env.js
 */
import "dotenv/config";
import { validateEnvironment } from "../src/config/env.js";

function maskStatus(val) {
  return val ? "✓ CONFIGURED" : "- NOT SET";
}

console.log("=================================================");
console.log("    RecruitAI Backend Environment Audit");
console.log("=================================================");
console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
console.log(`Node.js:     ${process.version}`);
console.log("-------------------------------------------------");

const inventory = [
  { group: "1. Core & Server", vars: [
    { name: "PORT", status: maskStatus(process.env.PORT || "5000 (default)") },
    { name: "NODE_ENV", status: maskStatus(process.env.NODE_ENV) },
    { name: "FRONTEND_URL", status: maskStatus(process.env.FRONTEND_URL) },
    { name: "BACKEND_URL", status: maskStatus(process.env.BACKEND_URL) },
  ]},
  { group: "2. Database & Media Storage", vars: [
    { name: "STORAGE_MONGODB_URI", status: maskStatus(process.env.STORAGE_MONGODB_URI || process.env.MONGODB_URI) },
    { name: "CLOUDINARY_CLOUD_NAME", status: maskStatus(process.env.CLOUDINARY_CLOUD_NAME) },
    { name: "CLOUDINARY_API_KEY", status: maskStatus(process.env.CLOUDINARY_API_KEY) },
    { name: "CLOUDINARY_API_SECRET", status: maskStatus(process.env.CLOUDINARY_API_SECRET) },
  ]},
  { group: "3. Authentication & Security", vars: [
    { name: "JWT_SECRET", status: maskStatus(process.env.JWT_SECRET) },
    { name: "ADMIN_JWT_SECRET", status: maskStatus(process.env.ADMIN_JWT_SECRET) },
    { name: "GOOGLE_TOKEN_ENCRYPTION_KEY", status: maskStatus(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY) },
  ]},
  { group: "4. AI & Repository Verification", vars: [
    { name: "GROQ_API_KEY", status: maskStatus(process.env.GROQ_API_KEY) },
    { name: "GROQ_MODEL", status: maskStatus(process.env.GROQ_MODEL || "llama3-70b-8192 (default)") },
    { name: "GITHUB_TOKEN", status: maskStatus(process.env.GITHUB_TOKEN) },
  ]},
  { group: "5. Google OAuth & Calendar Integration", vars: [
    { name: "GOOGLE_CLIENT_ID", status: maskStatus(process.env.GOOGLE_CLIENT_ID) },
    { name: "GOOGLE_CLIENT_SECRET", status: maskStatus(process.env.GOOGLE_CLIENT_SECRET) },
    { name: "GOOGLE_CALLBACK_URL", status: maskStatus(process.env.GOOGLE_CALLBACK_URL) },
    { name: "GOOGLE_CALENDAR_CLIENT_ID", status: maskStatus(process.env.GOOGLE_CALENDAR_CLIENT_ID) },
    { name: "GOOGLE_CALENDAR_CLIENT_SECRET", status: maskStatus(process.env.GOOGLE_CALENDAR_CLIENT_SECRET) },
    { name: "GOOGLE_CALENDAR_CALLBACK_URL", status: maskStatus(process.env.GOOGLE_CALENDAR_CALLBACK_URL) },
    { name: "GOOGLE_CALENDAR_CALENDAR_ID", status: maskStatus(process.env.GOOGLE_CALENDAR_CALENDAR_ID || "primary (default)") },
    { name: "GOOGLE_MEET_BOT_EMAIL", status: maskStatus(process.env.GOOGLE_MEET_BOT_EMAIL) },
  ]},
  { group: "6. Meeting Bot Worker Control", vars: [
    { name: "BOT_CONTROL_API_SECRET", status: maskStatus(process.env.BOT_CONTROL_API_SECRET || process.env.RECRUITAI_INTERNAL_API_SECRET || process.env.MEETING_BOT_API_SECRET) },
    { name: "BOT_WORKER_POLL_SECONDS", status: maskStatus(process.env.BOT_WORKER_POLL_SECONDS || "10 (default)") },
    { name: "BOT_WORKER_HEARTBEAT_SECONDS", status: maskStatus(process.env.BOT_WORKER_HEARTBEAT_SECONDS || "20 (default)") },
    { name: "BOT_JOB_LEASE_MS", status: maskStatus(process.env.BOT_JOB_LEASE_MS || "120000 (default)") },
  ]},
  { group: "7. Speech-to-Text (Deepgram)", vars: [
    { name: "DEEPGRAM_API_KEY", status: maskStatus(process.env.DEEPGRAM_API_KEY) },
    { name: "DEEPGRAM_MODEL", status: maskStatus(process.env.DEEPGRAM_MODEL || "nova-2 (default)") },
  ]},
  { group: "8. Optional Email Notifications (SMTP)", vars: [
    { name: "SMTP_HOST", status: maskStatus(process.env.SMTP_HOST) },
    { name: "SMTP_USER", status: maskStatus(process.env.SMTP_USER) },
  ]},
];

for (const section of inventory) {
  console.log(`\n${section.group}:`);
  for (const v of section.vars) {
    console.log(`  ${v.name.padEnd(32)} ${v.status}`);
  }
}

console.log("\n-------------------------------------------------");
console.log("Running schema and sanity checks...");
const result = validateEnvironment();

console.log("-------------------------------------------------");
if (result.errors.length > 0) {
  console.error("❌ Environment validation FAILED with errors:");
  result.errors.forEach((err) => console.error(`   - ${err}`));
  process.exit(1);
} else if (result.warnings.length > 0) {
  console.log("⚠️  Environment validation PASSED with warnings:");
  result.warnings.forEach((warn) => console.log(`   - ${warn}`));
  process.exit(0);
} else {
  console.log("✅ All environment checks PASSED successfully!");
  process.exit(0);
}
