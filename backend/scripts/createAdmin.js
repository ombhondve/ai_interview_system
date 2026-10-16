#!/usr/bin/env node

/**
 * RecruitAI — Controlled Admin Account Provisioning Script
 *
 * Securely creates or updates an administrator account directly in MongoDB.
 * Password is encrypted with bcrypt (12 rounds) before storage.
 *
 * Usage:
 *   node scripts/createAdmin.js <email> <password> [name] [role]
 *
 * Examples:
 *   node scripts/createAdmin.js admin@example.com MySecurePassword123! "Lead Admin" superadmin
 *   node scripts/createAdmin.js recruiter@example.com RecruiterPass456! "John Recruiter" recruiter
 */

import "dotenv/config";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import connectDatabase from "../src/config/database.js";
import Admin from "../src/modules/admin/admin.model.js";

async function main() {
  const args = process.argv.slice(2);
  const email = (args[0] || process.env.DEMO_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = args[1] || process.env.DEMO_ADMIN_PASSWORD;
  const name = args[2] || process.env.DEMO_ADMIN_NAME || "System Administrator";
  const role = args[3] || process.env.DEMO_ADMIN_ROLE || "superadmin";

  if (!email || !password) {
    console.error("Usage: node scripts/createAdmin.js <email> <password> [name] [role]");
    console.error("   or: set DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD in environment.");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Error: Admin password must be at least 8 characters long.");
    process.exit(1);
  }

  if (!["superadmin", "recruiter", "admin"].includes(role)) {
    console.error("Error: Role must be one of: 'superadmin', 'recruiter', 'admin'.");
    process.exit(1);
  }

  console.log("Connecting to database...");
  await connectDatabase();

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await Admin.findOne({ email });

  if (existing) {
    existing.name = name;
    existing.passwordHash = passwordHash;
    existing.role = role;
    existing.status = "active";
    await existing.save();
    console.log(`✓ Existing administrator '${email}' updated successfully (Role: ${role}).`);
  } else {
    await Admin.create({
      name,
      email,
      passwordHash,
      role,
      status: "active",
    });
    console.log(`✓ Administrator '${email}' created successfully (Role: ${role}).`);
  }

  await mongoose.disconnect();
  console.log("Disconnected from database.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to provision administrator:", err.message);
  process.exit(1);
});
