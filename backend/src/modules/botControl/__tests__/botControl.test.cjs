"use strict";

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const {
  safeSecretCompare,
  hashWorkerToken,
  generateWorkerToken,
  requireWorkerRegistrationAuth,
  requireWorkerAuth,
  requireAdminAuth,
} = require("../botControl.auth.js");
const {
  validateMeetUrl,
  validateWorkerId,
  isValidObjectId,
  sanitizeError,
} = require("../botControl.validation.js");
const botControlService = require("../botControl.service.js");
const BotWorker = require("../botWorker.model.js").default;
const BotJob = require("../botJob.model.js").default;
const AiInterview = require("../../interview/interview.model.js").default;

describe("BotControl Remote Worker Management System Tests", () => {
  const MASTER_SECRET = "test-high-entropy-master-secret-123456";
  const JWT_SECRET = "test-admin-jwt-secret-key-minimum-32-chars";

  beforeEach(() => {
    process.env.BOT_CONTROL_API_SECRET = MASTER_SECRET;
    process.env.JWT_SECRET = JWT_SECRET;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Missing or invalid worker credentials are rejected
  // ---------------------------------------------------------------------------
  describe("1. Worker Credential Authentication", () => {
    test("rejects registration when secret header is missing", () => {
      const req = { headers: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      requireWorkerRegistrationAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test("rejects registration when secret is invalid", () => {
      const req = { headers: { "x-bot-control-secret": "wrong-secret" } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      requireWorkerRegistrationAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test("fails closed with 500 when server secret is not configured", () => {
      delete process.env.BOT_CONTROL_API_SECRET;
      delete process.env.RECRUITAI_INTERNAL_API_SECRET;

      const req = { headers: { "x-bot-control-secret": "some-secret" } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      requireWorkerRegistrationAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(next).not.toHaveBeenCalled();
    });

    test("allows registration when valid secret is provided", () => {
      const req = { headers: { "x-bot-control-secret": MASTER_SECRET } };
      const res = {};
      const next = jest.fn();

      requireWorkerRegistrationAuth(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Unregistered worker cannot claim a job
  // ---------------------------------------------------------------------------
  describe("2. Unregistered Worker Rejection", () => {
    test("unregistered worker throws 404 when attempting to claim a job", async () => {
      jest.spyOn(BotWorker, "findOne").mockResolvedValue(null);

      await expect(botControlService.claimNextJob("unknown-worker-999")).rejects.toMatchObject({
        status: 404,
        message: expect.stringMatching(/Worker not found/i),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Registered worker can claim an eligible job
  // ---------------------------------------------------------------------------
  describe("3. Eligible Job Claiming", () => {
    test("registered worker successfully claims an eligible scheduled job", async () => {
      const mockWorker = {
        workerId: "worker-win-01",
        enabled: true,
        status: "IDLE",
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(BotWorker, "findOne").mockResolvedValue(mockWorker);
      jest.spyOn(botControlService, "recoverExpiredLeases").mockResolvedValue(0);
      jest.spyOn(botControlService, "syncEligibleInterviewJobs").mockResolvedValue(true);

      const mockJob = {
        _id: "507f1f77bcf86cd799439011",
        interviewId: "507f1f77bcf86cd799439012",
        candidateId: "507f1f77bcf86cd799439013",
        meetLink: "https://meet.google.com/abc-defg-hij",
        scheduledAt: new Date(),
        status: "CLAIMED",
        attemptCount: 1,
        executionHistory: [],
        leaseExpiresAt: new Date(Date.now() + 120000),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(BotJob, "findOneAndUpdate").mockResolvedValue(mockJob);

      const result = await botControlService.claimNextJob("worker-win-01");
      expect(result.success).toBe(true);
      expect(result.job).toBeDefined();
      expect(result.job.jobId).toBe("507f1f77bcf86cd799439011");
      expect(result.job.meetUrl).toBe("https://meet.google.com/abc-defg-hij");
      expect(mockWorker.status).toBe("BUSY");
      expect(mockWorker.save).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Two workers cannot claim the same interview concurrently
  // ---------------------------------------------------------------------------
  describe("4. Concurrency Protection", () => {
    test("atomic findOneAndUpdate guarantees only one worker claims the job", async () => {
      const mockWorker1 = { workerId: "worker-1", enabled: true, status: "IDLE", save: jest.fn().mockResolvedValue(true) };
      const mockWorker2 = { workerId: "worker-2", enabled: true, status: "IDLE", save: jest.fn().mockResolvedValue(true) };

      jest.spyOn(BotWorker, "findOne").mockImplementation(async ({ workerId }) => {
        return workerId === "worker-1" ? mockWorker1 : mockWorker2;
      });
      jest.spyOn(botControlService, "recoverExpiredLeases").mockResolvedValue(0);
      jest.spyOn(botControlService, "syncEligibleInterviewJobs").mockResolvedValue(true);

      const mockJob = {
        _id: "job-101",
        interviewId: "int-101",
        candidateId: "cand-101",
        meetLink: "https://meet.google.com/abc-defg-hij",
        scheduledAt: new Date(),
        status: "CLAIMED",
        attemptCount: 1,
        executionHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };

      // First call succeeds, second call returns null (job already claimed by worker 1)
      let claimCall = 0;
      jest.spyOn(BotJob, "findOneAndUpdate").mockImplementation(async () => {
        claimCall += 1;
        if (claimCall === 1) return mockJob;
        return null;
      });

      const res1 = await botControlService.claimNextJob("worker-1");
      const res2 = await botControlService.claimNextJob("worker-2");

      expect(res1.job).toBeDefined();
      expect(res1.job.jobId).toBe("job-101");
      expect(res2.job).toBeNull();
      expect(res2.message).toMatch(/No eligible interview jobs/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. An administrator-disabled worker cannot claim new jobs
  // ---------------------------------------------------------------------------
  describe("5. Administrator-Disabled Worker Protection", () => {
    test("disabled worker is blocked from claiming jobs with 403", async () => {
      const pausedWorker = {
        workerId: "worker-disabled-01",
        enabled: false,
        status: "PAUSED",
      };
      jest.spyOn(BotWorker, "findOne").mockResolvedValue(pausedWorker);

      await expect(botControlService.claimNextJob("worker-disabled-01")).rejects.toMatchObject({
        status: 403,
        message: expect.stringMatching(/disabled by administrator/i),
      });
    });

    test("re-registration preserves disabled state and does not re-enable automatically", async () => {
      const existingDisabledWorker = {
        workerId: "worker-disabled-01",
        enabled: false,
        status: "PAUSED",
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(BotWorker, "findOne").mockResolvedValue(existingDisabledWorker);

      const regResult = await botControlService.registerWorker({
        workerId: "worker-disabled-01",
        hostname: "test-host",
      });

      expect(regResult.enabled).toBe(false);
      expect(existingDisabledWorker.enabled).toBe(false);
      expect(existingDisabledWorker.status).toBe("PAUSED");
    });
  });

  // ---------------------------------------------------------------------------
  // 6. A worker cannot renew another worker's lease
  // ---------------------------------------------------------------------------
  describe("6. Job Ownership & Lease Renewal", () => {
    test("worker cannot renew a lease belonging to another worker", async () => {
      // Atomic findOneAndUpdate returns null because assignedWorkerId !== workerId
      jest.spyOn(BotJob, "findOneAndUpdate").mockResolvedValue(null);
      jest.spyOn(BotJob, "findById").mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        assignedWorkerId: "worker-owner-1",
        status: "RUNNING",
      });

      await expect(
        botControlService.renewJobLease("507f1f77bcf86cd799439011", "worker-impostor-2")
      ).rejects.toMatchObject({
        status: 403,
        message: expect.stringMatching(/Worker no longer owns this job/i),
      });
    });

    test("worker cannot complete a job owned by another worker", async () => {
      jest.spyOn(BotJob, "findById").mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        assignedWorkerId: "worker-owner-1",
        status: "RUNNING",
      });

      await expect(
        botControlService.completeJob("507f1f77bcf86cd799439011", "worker-impostor-2")
      ).rejects.toMatchObject({
        status: 403,
        message: expect.stringMatching(/Worker does not own this job/i),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Expired lease can be recovered safely
  // ---------------------------------------------------------------------------
  describe("7. Expired Lease Recovery", () => {
    test("re-queues job when lease expires and attempts < maxAttempts", async () => {
      const expiredJob = {
        _id: "job-expired-1",
        status: "RUNNING",
        assignedWorkerId: "worker-abandoned",
        attemptCount: 1,
        maxAttempts: 3,
        leaseExpiresAt: new Date(Date.now() - 5000),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(BotJob, "find").mockResolvedValue([expiredJob]);
      jest.spyOn(BotWorker, "updateOne").mockResolvedValue({ modifiedCount: 1 });

      const recoveredCount = await botControlService.recoverExpiredLeases();
      expect(recoveredCount).toBe(1);
      expect(expiredJob.status).toBe("QUEUED");
      expect(expiredJob.assignedWorkerId).toBeNull();
      expect(expiredJob.save).toHaveBeenCalled();
    });

    test("marks job FAILED with needsAdminReview when max attempts exceeded", async () => {
      const expiredJob = {
        _id: "job-expired-2",
        status: "RUNNING",
        assignedWorkerId: "worker-crashed",
        attemptCount: 3,
        maxAttempts: 3,
        leaseExpiresAt: new Date(Date.now() - 5000),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(BotJob, "find").mockResolvedValue([expiredJob]);
      jest.spyOn(BotWorker, "updateOne").mockResolvedValue({ modifiedCount: 1 });

      const recoveredCount = await botControlService.recoverExpiredLeases();
      expect(recoveredCount).toBe(1);
      expect(expiredJob.status).toBe("FAILED");
      expect(expiredJob.needsAdminReview).toBe(true);
      expect(expiredJob.save).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Completed interview cannot be claimed again
  // ---------------------------------------------------------------------------
  describe("8. Terminal Sessions Excluded from Queue", () => {
    test("completed interviews are excluded during job sync", async () => {
      jest.spyOn(AiInterview, "find").mockResolvedValue([]);
      await botControlService.syncEligibleInterviewJobs();

      // Only SCHEDULED, READY, WAITING_FOR_CANDIDATE are queried
      expect(AiInterview.find).toHaveBeenCalledWith(
        expect.objectContaining({
          status: { $in: ["SCHEDULED", "READY", "WAITING_FOR_CANDIDATE"] },
        })
      );
    });

    test("admin cannot retry a completed interview", async () => {
      jest.spyOn(BotJob, "findById").mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        interviewId: "507f1f77bcf86cd799439012",
        status: "FAILED",
      });
      jest.spyOn(AiInterview, "findById").mockResolvedValue({
        _id: "507f1f77bcf86cd799439012",
        status: "COMPLETED",
      });

      await expect(
        botControlService.adminRetryJob("507f1f77bcf86cd799439011", "admin-1")
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringMatching(/already completed/i),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Cancelled interviews cannot be claimed
  // ---------------------------------------------------------------------------
  describe("9. Cancelled Interviews Excluded", () => {
    test("admin cannot retry a cancelled interview", async () => {
      jest.spyOn(BotJob, "findById").mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        interviewId: "507f1f77bcf86cd799439012",
        status: "FAILED",
      });
      jest.spyOn(AiInterview, "findById").mockResolvedValue({
        _id: "507f1f77bcf86cd799439012",
        status: "CANCELLED",
      });

      await expect(
        botControlService.adminRetryJob("507f1f77bcf86cd799439011", "admin-1")
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringMatching(/cancelled/i),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 10. Invalid meeting URLs are rejected
  // ---------------------------------------------------------------------------
  describe("10. Google Meet URL Validation", () => {
    test("accepts valid Google Meet URL format", () => {
      expect(validateMeetUrl("https://meet.google.com/abc-defg-hij")).toBe(true);
      expect(validateMeetUrl("https://meet.google.com/xyz-uvwx-rst?authuser=0")).toBe(true);
    });

    test("rejects malformed or malicious URLs", () => {
      expect(validateMeetUrl("http://meet.google.com/abc-defg-hij")).toBe(false); // HTTP not HTTPS
      expect(validateMeetUrl("https://malicious.com/abc-defg-hij")).toBe(false);
      expect(validateMeetUrl("https://meet.google.com/badformat")).toBe(false);
      expect(validateMeetUrl("javascript:alert(1)")).toBe(false);
      expect(validateMeetUrl("https://meet.google.com/abc-defg-hij; rm -rf /")).toBe(false);
      expect(validateMeetUrl("")).toBe(false);
      expect(validateMeetUrl(null)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 11. Failed jobs respect the maximum retry count
  // ---------------------------------------------------------------------------
  describe("11. Maximum Retry Count Bounds", () => {
    test("marks job FAILED when attempt count reaches maxAttempts", async () => {
      const mockJob = {
        _id: "507f1f77bcf86cd799439011",
        assignedWorkerId: "worker-1",
        status: "RUNNING",
        attemptCount: 3,
        maxAttempts: 3,
        executionHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(BotJob, "findById").mockResolvedValue(mockJob);
      jest.spyOn(AiInterview, "findById").mockResolvedValue({
        _id: "int-1",
        candidateJoinedAt: null,
        transcript: [],
      });
      jest.spyOn(BotWorker, "updateOne").mockResolvedValue({ modifiedCount: 1 });

      const res = await botControlService.failJob("507f1f77bcf86cd799439011", "worker-1", {
        error: "Chromium crashed",
      });

      expect(res.status).toBe("FAILED");
      expect(res.needsAdminReview).toBe(true);
      expect(mockJob.save).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 12. Repeated completion requests do not corrupt state (Idempotency)
  // ---------------------------------------------------------------------------
  describe("12. Idempotent Job Completion", () => {
    test("repeated completion request on COMPLETED job returns idempotently without re-processing", async () => {
      const mockCompletedJob = {
        _id: "507f1f77bcf86cd799439011",
        assignedWorkerId: "worker-1",
        status: "COMPLETED",
        completedAt: new Date(),
        save: jest.fn(),
      };
      jest.spyOn(BotJob, "findById").mockResolvedValue(mockCompletedJob);

      const res = await botControlService.completeJob("507f1f77bcf86cd799439011", "worker-1", {
        exitCode: 0,
      });

      expect(res.status).toBe("COMPLETED");
      expect(res.alreadyCompleted).toBe(true);
      expect(mockCompletedJob.save).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 13. Unauthorized users cannot access administrative endpoints
  // ---------------------------------------------------------------------------
  describe("13. Administrative Access Control", () => {
    test("rejects admin request with no auth token", () => {
      const req = { cookies: {}, headers: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireAdminAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test("rejects candidate session or non-admin role", () => {
      const candidateToken = jwt.sign(
        { candidateId: "cand-123", role: "candidate" },
        JWT_SECRET
      );
      const req = { cookies: { recruitai_admin: candidateToken }, headers: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireAdminAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401); // missing adminId in payload
      expect(next).not.toHaveBeenCalled();
    });

    test("accepts authorized admin token", () => {
      const adminToken = jwt.sign(
        { adminId: "admin-123", email: "admin@recruitai.com", role: "superadmin" },
        JWT_SECRET
      );
      const req = { cookies: { recruitai_admin: adminToken }, headers: {} };
      const res = {};
      const next = jest.fn();

      requireAdminAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toMatchObject({ id: "admin-123", role: "superadmin" });
    });
  });

  // ---------------------------------------------------------------------------
  // 16. Exit code zero alone does NOT complete an interview without Mongo status check
  // ---------------------------------------------------------------------------
  describe("16. MongoDB Authoritative State Verification On Exit", () => {
    test("does not mark completed when exit code is 0 but interview is still IN_PROGRESS", async () => {
      const mockJob = {
        _id: "507f1f77bcf86cd799439011",
        interviewId: "507f1f77bcf86cd799439012",
        assignedWorkerId: "worker-1",
        status: "RUNNING",
        attemptCount: 1,
        maxAttempts: 3,
        executionHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(BotJob, "findById").mockResolvedValue(mockJob);

      // Interview in MongoDB is still IN_PROGRESS with recorded candidate speech
      jest.spyOn(AiInterview, "findById").mockResolvedValue({
        _id: "507f1f77bcf86cd799439012",
        status: "IN_PROGRESS",
        candidateJoinedAt: new Date(),
        transcript: [
          { speaker: "AI", text: "Question 1" },
          { speaker: "CANDIDATE", text: "Answer 1" },
        ],
      });
      jest.spyOn(BotWorker, "updateOne").mockResolvedValue({ modifiedCount: 1 });

      const res = await botControlService.completeJob("507f1f77bcf86cd799439011", "worker-1", {
        exitCode: 0,
      });

      // Must be marked FAILED requiring administrative review, NOT completed!
      expect(res.status).toBe("FAILED");
      expect(res.needsAdminReview).toBe(true);
      expect(res.failureReason).toContain("before interview completion was confirmed in database");
    });

    test("successfully marks completed when MongoDB status is COMPLETED or ANALYZED", async () => {
      const mockJob = {
        _id: "507f1f77bcf86cd799439011",
        interviewId: "507f1f77bcf86cd799439012",
        assignedWorkerId: "worker-1",
        status: "RUNNING",
        attemptCount: 1,
        maxAttempts: 3,
        executionHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(BotJob, "findById").mockResolvedValue(mockJob);

      jest.spyOn(AiInterview, "findById").mockResolvedValue({
        _id: "507f1f77bcf86cd799439012",
        status: "COMPLETED",
      });
      jest.spyOn(BotWorker, "updateOne").mockResolvedValue({ modifiedCount: 1 });

      const res = await botControlService.completeJob("507f1f77bcf86cd799439011", "worker-1", {
        exitCode: 0,
      });

      expect(res.status).toBe("COMPLETED");
      expect(res.needsAdminReview).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Constant Time Comparison and Error Sanitization
  // ---------------------------------------------------------------------------
  describe("Security Helpers", () => {
    test("safeSecretCompare evaluates constant-time comparisons accurately", () => {
      expect(safeSecretCompare("secret123", "secret123")).toBe(true);
      expect(safeSecretCompare("secret123", "secret999")).toBe(false);
      expect(safeSecretCompare("secret123", "short")).toBe(false);
      expect(safeSecretCompare("", "secret")).toBe(false);
      expect(safeSecretCompare(null, "secret")).toBe(false);
    });

    test("sanitizeError strips sensitive credentials and connection strings", () => {
      const sensitive = "Error with Bearer eyJhbGciOiJIUzI1Ni... and password=secret123 at mongodb+srv://user:pass@cluster.mongodb.net";
      const sanitized = sanitizeError(sensitive);
      expect(sanitized).not.toContain("eyJhbGciOiJIUzI1Ni");
      expect(sanitized).not.toContain("password=secret123");
      expect(sanitized).not.toContain("user:pass@cluster");
      expect(sanitized).toContain("[REDACTED]");
    });
  });
});
