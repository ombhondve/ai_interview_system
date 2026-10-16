#!/usr/bin/env node

/**
 * Frontend Environment Configuration Validator
 *
 * Verifies frontend environment configuration and ensures that NO private secrets
 * are inadvertently exposed via NEXT_PUBLIC_* variables.
 *
 * Usage:
 *   npm run validate-env
 *   node scripts/validate-env.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");

// Attempt to load .env, .env.local, or .env.production if present
function loadEnvFile(fileName) {
  const filePath = path.join(frontendRoot, fileName);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");
loadEnvFile(".env.production");

console.log("=================================================");
console.log("   RecruitAI Frontend Environment Audit");
console.log("=================================================");
console.log(`Node.js:  ${process.version}`);
console.log("-------------------------------------------------");

const publicBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
const backendUrl = process.env.BACKEND_URL;
const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;
const jwtSecret = process.env.JWT_SECRET;

console.log("Public Variables (Client Bundle Accessible):");
console.log(`  NEXT_PUBLIC_BACKEND_URL:       ${publicBackendUrl ? `✓ CONFIGURED (${publicBackendUrl})` : "- NOT SET (defaults to fallback)"}`);
console.log(`  NEXT_PUBLIC_API_URL:           ${publicApiUrl ? `✓ CONFIGURED (${publicApiUrl})` : "- NOT SET (optional)"}`);

console.log("\nServer-Only Variables:");
console.log(`  BACKEND_URL (rewrite fallback): ${backendUrl ? "✓ CONFIGURED" : "- NOT SET (optional)"}`);
console.log(`  JWT_SECRET (server auth only):   ${jwtSecret ? "✓ CONFIGURED" : "- NOT SET (optional)"}`);

console.log("\n-------------------------------------------------");
console.log("Running security and leak prevention checks...");

const errors = [];
const warnings = [];

// 1. Check for illegal secret exposure via NEXT_PUBLIC_*
const forbiddenKeywords = [
  "SECRET", "PASSWORD", "KEY", "PRIVATE", "TOKEN", "MONGO", "DATABASE", "DB_URI"
];

for (const [key, val] of Object.entries(process.env)) {
  if (key.startsWith("NEXT_PUBLIC_")) {
    const suffix = key.replace("NEXT_PUBLIC_", "");
    // Allowed public items
    if (["BACKEND_URL", "API_URL", "APP_URL"].includes(suffix)) continue;
    for (const kw of forbiddenKeywords) {
      if (suffix.toUpperCase().includes(kw)) {
        errors.push(`CRITICAL SECURITY LEAK: '${key}' appears to contain private credentials exposed to browser bundles!`);
      }
    }
  }
}

// 2. Validate URL format
if (publicBackendUrl) {
  try {
    new URL(publicBackendUrl);
  } catch {
    errors.push("NEXT_PUBLIC_BACKEND_URL is not a valid URL (must include http:// or https://).");
  }
}

if (backendUrl) {
  try {
    new URL(backendUrl);
  } catch {
    errors.push("BACKEND_URL is not a valid URL (must include http:// or https://).");
  }
}

// 3. Check for JWT_SECRET leakage
if (process.env.NEXT_PUBLIC_JWT_SECRET) {
  errors.push("CRITICAL: NEXT_PUBLIC_JWT_SECRET detected! JWT_SECRET must NEVER be prefixed with NEXT_PUBLIC_.");
}

console.log("-------------------------------------------------");
if (errors.length > 0) {
  console.error("❌ Frontend validation FAILED with security errors:");
  errors.forEach((err) => console.error(`   - ${err}`));
  process.exit(1);
} else if (warnings.length > 0) {
  console.log("⚠️  Frontend validation PASSED with warnings:");
  warnings.forEach((warn) => console.log(`   - ${warn}`));
  process.exit(0);
} else {
  console.log("✅ All Frontend environment checks PASSED cleanly!");
  process.exit(0);
}
