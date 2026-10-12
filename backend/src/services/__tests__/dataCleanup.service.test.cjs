/**
 * Automated Tests for RecruitAI Safe Data Retention & Cleanup Policies
 *
 * Verifies:
 * 1. Abandoned unverified OTP sessions cleanup (verified sessions strictly preserved).
 * 2. Expired candidate portal tokens cleanup (active tokens strictly preserved).
 * 3. Terminal bot jobs cleanup (active bot jobs strictly preserved).
 * 4. Idempotency of repeated cleanup runs.
 * 5. Project deletion guard against deleting projects with active candidate assignments.
 */

const {
  cleanupAbandonedVerificationSessions,
  cleanupExpiredCandidatePortalTokens,
  cleanupOldBotJobs,
  runAllBackendCleanups,
} = require("../dataCleanup.service.js");

const VerificationSession = require("../../modules/verification/verificationSession.model.js").default || require("../../modules/verification/verificationSession.model.js");
const CandidatePortalToken = require("../../modules/candidate/CandidatePortalToken.js").default || require("../../modules/candidate/CandidatePortalToken.js");
const BotJob = require("../../modules/botControl/botJob.model.js").default || require("../../modules/botControl/botJob.model.js");

describe("RecruitAI Safe Data Retention & Cleanup Policies", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("1. Abandoned OTP Verification Sessions Cleanup", () => {
    test("deletes only unverified sessions older than cutoff; preserves verified sessions", async () => {
      let capturedQuery = null;
      jest.spyOn(VerificationSession, "deleteMany").mockImplementation(async (query) => {
        capturedQuery = query;
        return { deletedCount: 3 };
      });

      const res = await cleanupAbandonedVerificationSessions({ maxAgeHours: 1 });
      expect(res.deletedCount).toBe(3);

      // Verify the query strictly filters sessionToken: null and otpExpiresAt < cutoff
      expect(capturedQuery).toBeDefined();
      expect(capturedQuery.sessionToken).toBeNull();
      expect(capturedQuery.otpExpiresAt).toHaveProperty("$lt");
      expect(capturedQuery.otpExpiresAt.$lt).toBeInstanceOf(Date);
    });

    test("handles database errors gracefully without throwing", async () => {
      jest.spyOn(VerificationSession, "deleteMany").mockRejectedValue(new Error("Mongo connection timeout"));

      const res = await cleanupAbandonedVerificationSessions();
      expect(res.deletedCount).toBe(0);
      expect(res.error).toMatch(/Mongo connection timeout/);
    });
  });

  describe("2. Expired Candidate Portal Tokens Cleanup", () => {
    test("deletes only tokens whose expiresAt is past the retention cutoff", async () => {
      let capturedQuery = null;
      jest.spyOn(CandidatePortalToken, "deleteMany").mockImplementation(async (query) => {
        capturedQuery = query;
        return { deletedCount: 5 };
      });

      const res = await cleanupExpiredCandidatePortalTokens({ retentionDays: 30 });
      expect(res.deletedCount).toBe(5);

      expect(capturedQuery).toBeDefined();
      expect(capturedQuery.expiresAt).toHaveProperty("$lt");
      expect(capturedQuery.expiresAt.$lt).toBeInstanceOf(Date);
    });

    test("idempotent: subsequent runs report 0 deleted count without error", async () => {
      jest.spyOn(CandidatePortalToken, "deleteMany").mockResolvedValue({ deletedCount: 0 });

      const res = await cleanupExpiredCandidatePortalTokens({ retentionDays: 30 });
      expect(res.deletedCount).toBe(0);
    });
  });

  describe("3. Old Terminal BotJobs Cleanup", () => {
    test("deletes only COMPLETED or FAILED bot jobs; active jobs (QUEUED, CLAIMED, RUNNING) are never matched", async () => {
      let capturedQuery = null;
      jest.spyOn(BotJob, "deleteMany").mockImplementation(async (query) => {
        capturedQuery = query;
        return { deletedCount: 12 };
      });

      const res = await cleanupOldBotJobs({ retentionDays: 30 });
      expect(res.deletedCount).toBe(12);

      expect(capturedQuery).toBeDefined();
      expect(capturedQuery.status).toEqual({ $in: ["COMPLETED", "FAILED"] });
      expect(capturedQuery.$or).toBeDefined();
    });

    test("handles database errors gracefully", async () => {
      jest.spyOn(BotJob, "deleteMany").mockRejectedValue(new Error("Database write lock error"));

      const res = await cleanupOldBotJobs();
      expect(res.deletedCount).toBe(0);
      expect(res.error).toMatch(/Database write lock error/);
    });
  });

  describe("4. Aggregated Cleanup Runner (runAllBackendCleanups)", () => {
    test("executes all cleanups and returns aggregate summary", async () => {
      jest.spyOn(VerificationSession, "deleteMany").mockResolvedValue({ deletedCount: 2 });
      jest.spyOn(CandidatePortalToken, "deleteMany").mockResolvedValue({ deletedCount: 4 });
      jest.spyOn(BotJob, "deleteMany").mockResolvedValue({ deletedCount: 7 });

      const summary = await runAllBackendCleanups();
      expect(summary.unverifiedSessionsDeleted).toBe(2);
      expect(summary.expiredTokensDeleted).toBe(4);
      expect(summary.oldBotJobsDeleted).toBe(7);
      expect(summary.completedAt).toBeDefined();
    });
  });

  describe("5. Safe Project Deletion Guard", () => {
    test("prevents deletion and returns 409 Conflict if candidates are actively assigned to the project", async () => {
      const Project = require("../../modules/projects/project.model.js").default || require("../../modules/projects/project.model.js");
      const Candidate = require("../../modules/candidate/candidate.model.js").default || require("../../modules/candidate/candidate.model.js");
      const { deleteProject } = require("../../modules/projects/project.controller.js");

      const validId = "507f1f77bcf86cd799439011";
      jest.spyOn(Project, "findById").mockResolvedValue({ _id: validId, title: "Test Project" });
      jest.spyOn(Candidate, "countDocuments").mockResolvedValue(3);

      const req = { params: { id: validId } };
      const res = {
        statusCode: null,
        jsonData: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.jsonData = data;
          return this;
        },
      };

      await deleteProject(req, res);

      expect(res.statusCode).toBe(409);
      expect(res.jsonData.success).toBe(false);
      expect(res.jsonData.code).toBe("PROJECT_HAS_ASSIGNED_CANDIDATES");
      expect(res.jsonData.message).toMatch(/3 candidate\(s\) are currently assigned/);
    });
  });
});

