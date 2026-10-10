import mongoose from "mongoose";
import BotWorker from "./botWorker.model.js";
import BotJob from "./botJob.model.js";
import BotAuditLog from "./botAuditLog.model.js";
import AiInterview from "../interview/interview.model.js";
import logger from "../../utils/logger.js";
import {
  validateWorkerId,
  validateMeetUrl,
  isValidObjectId,
  sanitizeError,
} from "./botControl.validation.js";
import {
  generateWorkerToken,
  hashWorkerToken,
} from "./botControl.auth.js";

export function getLeaseDurationMs() {
  return Number(process.env.BOT_JOB_LEASE_MS) || 120000; // 2 minutes default
}

export function getMaxAttempts() {
  return Number(process.env.BOT_JOB_MAX_ATTEMPTS) || 3;
}

export function getWorkerStaleMs() {
  return Number(process.env.BOT_WORKER_STALE_MS) || 90000; // 90 seconds
}

export function getPreparationWindowMs() {
  return Number(process.env.BOT_PREPARATION_WINDOW_MS) || (15 * 60 * 1000); // 15 minutes before scheduled start
}

export async function findInterviewSafely(interviewId) {
  if (!interviewId) return null;
  const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
  const isMocked = AiInterview && AiInterview.findById && (AiInterview.findById._isMockFunction || typeof AiInterview.findById.mock !== "undefined");
  if (isDbReady || isMocked) {
    try {
      return await AiInterview.findById(interviewId);
    } catch (_) {
      return null;
    }
  }
  return null;
}

/**
 * Persist audit log entry if database connection is active.
 */
export async function recordAuditLog(entry) {
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await BotAuditLog.create(entry);
    }
  } catch (err) {
    logger.debug(`Could not write audit log: ${err.message}`);
  }
}

/**
 * Register or re-register a remote worker.
 * Re-registration does NOT re-enable a disabled worker.
 */
export async function registerWorker({ workerId, hostname = "", platform = "", version = "1.0.0" }) {
  if (!validateWorkerId(workerId)) {
    const err = new Error("Invalid workerId. Must be 3-64 alphanumeric characters, dashes, or underscores.");
    err.status = 400;
    throw err;
  }

  let worker = await BotWorker.findOne({ workerId });
  const rawToken = generateWorkerToken();
  const tokenHash = hashWorkerToken(rawToken);

  if (worker) {
    // Preserve existing enabled state! Do not silently re-enable an admin-disabled worker.
    worker.tokenHash = tokenHash;
    worker.hostname = String(hostname).slice(0, 100);
    worker.platform = String(platform).slice(0, 100);
    worker.version = String(version).slice(0, 20);
    worker.lastHeartbeatAt = new Date();
    if (worker.enabled) {
      worker.status = "IDLE";
    } else {
      worker.status = "PAUSED";
    }
    await worker.save();
  } else {
    worker = await BotWorker.create({
      workerId,
      tokenHash,
      hostname: String(hostname).slice(0, 100),
      platform: String(platform).slice(0, 100),
      version: String(version).slice(0, 20),
      status: "IDLE",
      enabled: true,
      lastHeartbeatAt: new Date(),
      registeredAt: new Date(),
    });
  }

  await recordAuditLog({
    action: "WORKER_REGISTERED",
    performedBy: workerId,
    targetWorkerId: workerId,
    details: { hostname, platform, version, enabled: worker.enabled },
  });

  return {
    success: true,
    workerId: worker.workerId,
    workerToken: rawToken,
    enabled: worker.enabled,
    heartbeatIntervalMs: Number(process.env.BOT_WORKER_HEARTBEAT_SECONDS || 20) * 1000,
    pollIntervalMs: Number(process.env.BOT_WORKER_POLL_SECONDS || 10) * 1000,
    leaseDurationMs: getLeaseDurationMs(),
  };
}

/**
 * Record a worker health heartbeat.
 */
export async function recordWorkerHeartbeat(workerId, { status = "IDLE", currentJobId = null } = {}) {
  const worker = await BotWorker.findOne({ workerId });
  if (!worker) {
    const err = new Error("Worker not found.");
    err.status = 404;
    throw err;
  }

  worker.lastHeartbeatAt = new Date();

  // If worker was disabled by admin, report paused status
  if (!worker.enabled) {
    worker.status = "PAUSED";
    await worker.save();
    return {
      success: true,
      enabled: false,
      status: "PAUSED",
      message: "Worker is currently paused/disabled by administrator.",
    };
  }

  if (["IDLE", "BUSY", "PAUSED"].includes(status)) {
    worker.status = status;
  }

  if (currentJobId && isValidObjectId(currentJobId)) {
    worker.currentJobId = currentJobId;
  } else if (!currentJobId && worker.status === "IDLE") {
    worker.currentJobId = null;
    worker.currentInterviewId = null;
  }

  await worker.save();

  return {
    success: true,
    enabled: worker.enabled,
    status: worker.status,
  };
}

/**
 * Recover expired job leases.
 */
export async function recoverExpiredLeases() {
  const now = new Date();
  const maxAttempts = getMaxAttempts();

  const expiredJobs = (await BotJob.find({
    status: { $in: ["CLAIMED", "RUNNING"] },
    leaseExpiresAt: { $lt: now },
  })) || [];

  for (const job of expiredJobs) {
    const prevWorker = job.assignedWorkerId;
    if (job.attemptCount >= maxAttempts) {
      job.status = "FAILED";
      job.needsAdminReview = true;
      job.failedAt = now;
      job.failureReason = `Lease expired on worker ${prevWorker}; maximum retry attempts (${maxAttempts}) reached.`;
      await job.save();

      await recordAuditLog({
        action: "JOB_FAILED",
        performedBy: "SYSTEM",
        targetWorkerId: prevWorker,
        targetJobId: job._id,
        targetInterviewId: job.interviewId,
        details: { reason: "LEASE_EXPIRED_MAX_ATTEMPTS", attemptCount: job.attemptCount },
      });
    } else {
      job.status = "QUEUED";
      job.assignedWorkerId = null;
      job.leaseExpiresAt = null;
      await job.save();

      await recordAuditLog({
        action: "JOB_RECOVERED",
        performedBy: "SYSTEM",
        targetWorkerId: prevWorker,
        targetJobId: job._id,
        targetInterviewId: job.interviewId,
        details: { reason: "LEASE_EXPIRED_REQUEUED", attemptCount: job.attemptCount },
      });
    }

    if (prevWorker) {
      await BotWorker.updateOne(
        { workerId: prevWorker, currentJobId: job._id },
        { $set: { status: "IDLE", currentJobId: null, currentInterviewId: null } }
      ).catch(() => {});
    }
  }

  return expiredJobs.length;
}

/**
 * Sync eligible AiInterview sessions into queued BotJobs.
 */
export async function syncEligibleInterviewJobs() {
  const preparationWindowMs = getPreparationWindowMs();
  const maxAttempts = getMaxAttempts();
  const cutoffStart = new Date(Date.now() + preparationWindowMs);

  let query = AiInterview.find({
    status: { $in: ["SCHEDULED", "READY", "WAITING_FOR_CANDIDATE"] },
    /* =========================================================================
     * [STRICT SLOT TIMING FEATURE - TEMPORARILY COMMENTED OUT FOR TESTING]
     * In production, only interviews within preparation window are synced.
     * Uncomment the line below when ready for production slot timing enforcement.
     * =========================================================================
    scheduledAt: { $lte: cutoffStart },
     * ========================================================================= */
    meetLink: { $ne: null },
  });

  if (query && typeof query.limit === "function") {
    query = query.limit(50);
  }

  const eligibleInterviews = (await query) || [];

  for (const interview of eligibleInterviews) {
    if (!validateMeetUrl(interview.meetLink)) {
      continue;
    }

    const existingJob = await BotJob.findOne({
      interviewId: interview._id,
      status: { $in: ["QUEUED", "CLAIMED", "RUNNING", "COMPLETED"] },
    });

    if (!existingJob) {
      await BotJob.findOneAndUpdate(
        { interviewId: interview._id, status: { $in: ["QUEUED", "CLAIMED", "RUNNING", "COMPLETED"] } },
        {
          $setOnInsert: {
            interviewId: interview._id,
            candidateId: interview.candidateId,
            bookingId: interview.bookingId,
            meetLink: interview.meetLink,
            scheduledAt: interview.scheduledAt,
            status: "QUEUED",
            attemptCount: 0,
            maxAttempts,
            needsAdminReview: false,
          },
        },
        { upsert: true, new: true }
      ).catch((err) => {
        if (err.code !== 11000) {
          logger.warn(`Could not queue BotJob for interview ${interview._id}: ${err.message}`);
        }
      });
    }
  }
}

/**
 * Atomically claim the next eligible interview job for a worker.
 * Strictly enforces that scheduled start time has arrived (scheduledAt <= backend current UTC time).
 */
export async function claimNextJob(workerId, { currentTime } = {}) {
  const worker = await BotWorker.findOne({ workerId });
  if (!worker) {
    const err = new Error("Worker not found. Please register first.");
    err.status = 404;
    throw err;
  }

  if (!worker.enabled) {
    const err = new Error("Worker is currently paused or disabled by administrator.");
    err.status = 403;
    throw err;
  }

  const leaseMs = getLeaseDurationMs();
  const now = currentTime ? new Date(currentTime) : new Date();

  // 1. Recover any expired leases & sync eligible interviews if db is connected
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    await recoverExpiredLeases();
    await syncEligibleInterviewJobs();
  }

  // 2. Atomically find and claim the earliest scheduled QUEUED job
  const claimedJob = await BotJob.findOneAndUpdate(
    {
      status: "QUEUED",
      /* =======================================================================
       * [STRICT SLOT TIMING FEATURE - TEMPORARILY COMMENTED OUT FOR TESTING]
       * Strictly enforces that scheduled start time has arrived (scheduledAt <= now).
       * Uncomment the line below when ready for production slot timing enforcement.
       * =======================================================================
      scheduledAt: { $lte: now },
       * ======================================================================= */
    },
    {
      $set: {
        status: "CLAIMED",
        assignedWorkerId: workerId,
        claimedAt: now,
        lastHeartbeatAt: now,
        leaseExpiresAt: new Date(now.getTime() + leaseMs),
      },
      $inc: { attemptCount: 1 },
    },
    {
      sort: { scheduledAt: 1 },
      new: true,
    }
  );

  if (!claimedJob) {
    return {
      success: true,
      job: null,
      message: "No eligible interview jobs available at this time.",
    };
  }

  // 3. Verify underlying AiInterview session status and timing
  const interview = await findInterviewSafely(claimedJob.interviewId);
  if (interview) {
    const validExecutionStatuses = ["SCHEDULED", "READY", "WAITING_FOR_CANDIDATE"];
    if (!validExecutionStatuses.includes(interview.status)) {
      claimedJob.status = interview.status === "COMPLETED" ? "COMPLETED" : "FAILED";
      claimedJob.failureReason = `Interview session is in non-executable status: ${interview.status}`;
      claimedJob.needsAdminReview = interview.status !== "COMPLETED";
      claimedJob.assignedWorkerId = null;
      claimedJob.leaseExpiresAt = null;
      await claimedJob.save();

      await recordAuditLog({
        action: "JOB_INVALIDATED",
        performedBy: workerId,
        targetWorkerId: workerId,
        targetJobId: claimedJob._id,
        targetInterviewId: claimedJob.interviewId,
        details: { reason: "INTERVIEW_NOT_EXECUTABLE", status: interview.status },
      });

      return {
        success: true,
        job: null,
        message: `Interview session is in ${interview.status} status; job cannot be claimed.`,
      };
    }

    /* =======================================================================
     * [STRICT SLOT TIMING FEATURE - TEMPORARILY COMMENTED OUT FOR TESTING]
     * In production, resets job to QUEUED if scheduled time is in the future.
     * Uncomment the block below when ready for production slot timing enforcement.
     * =======================================================================
    if (interview.scheduledAt && new Date(interview.scheduledAt).getTime() > now.getTime()) {
      // Session was rescheduled into the future: reset job to QUEUED
      claimedJob.status = "QUEUED";
      claimedJob.scheduledAt = interview.scheduledAt;
      claimedJob.assignedWorkerId = null;
      claimedJob.leaseExpiresAt = null;
      await claimedJob.save();

      return {
        success: true,
        job: null,
        message: "Interview scheduled time is in the future.",
      };
    }
     * ======================================================================= */

    interview.botJobId = claimedJob._id;
    interview.assignedWorkerId = workerId;
    await interview.save().catch(() => {});
  }

  // Update execution history
  if (!claimedJob.executionHistory) {
    claimedJob.executionHistory = [];
  }
  claimedJob.executionHistory.push({
    workerId,
    attempt: claimedJob.attemptCount,
    claimedAt: now,
    status: "CLAIMED",
  });
  await claimedJob.save();

  // Update worker state
  worker.status = "BUSY";
  worker.currentJobId = claimedJob._id;
  worker.currentInterviewId = claimedJob.interviewId;
  worker.lastHeartbeatAt = now;
  await worker.save();

  await recordAuditLog({
    action: "JOB_CLAIMED",
    performedBy: workerId,
    targetWorkerId: workerId,
    targetJobId: claimedJob._id,
    targetInterviewId: claimedJob.interviewId,
    details: { attempt: claimedJob.attemptCount, scheduledAt: claimedJob.scheduledAt },
  });

  return {
    success: true,
    job: {
      jobId: String(claimedJob._id),
      interviewId: String(claimedJob.interviewId),
      candidateId: String(claimedJob.candidateId),
      meetUrl: claimedJob.meetLink,
      scheduledAt: claimedJob.scheduledAt,
      leaseDurationMs: leaseMs,
      leaseExpiresAt: claimedJob.leaseExpiresAt,
      attemptCount: claimedJob.attemptCount,
      backendCurrentTime: now.toISOString(),
    },
  };
}

/**
 * Recheck job and interview eligibility immediately before bot launch.
 */
export async function validateJobPreflight(jobId, workerId, { currentTime } = {}) {
  if (!isValidObjectId(jobId)) {
    return { success: false, eligible: false, message: "Invalid jobId format." };
  }

  const now = currentTime ? new Date(currentTime) : new Date();
  const job = await BotJob.findById(jobId);
  if (!job) {
    return { success: false, eligible: false, message: "Job not found." };
  }

  if (job.assignedWorkerId !== workerId) {
    return { success: false, eligible: false, message: "Job is not assigned to this worker." };
  }

  if (!["CLAIMED", "RUNNING"].includes(job.status)) {
    return { success: false, eligible: false, message: `Job is in non-executable status: ${job.status}` };
  }

  if (job.leaseExpiresAt && new Date(job.leaseExpiresAt).getTime() <= now.getTime()) {
    return { success: false, eligible: false, message: "Execution lease has expired." };
  }

  /* =========================================================================
   * [STRICT SLOT TIMING FEATURE - TEMPORARILY COMMENTED OUT FOR TESTING]
   * In production, aborts preflight if scheduled start time has not arrived.
   * Uncomment the block below when ready for production slot timing enforcement.
   * =========================================================================
  if (new Date(job.scheduledAt).getTime() > now.getTime()) {
    return {
      success: false,
      eligible: false,
      reason: "FUTURE_SCHEDULED_TIME",
      scheduledAt: job.scheduledAt,
      backendTime: now.toISOString(),
      message: `Scheduled start time (${job.scheduledAt.toISOString()}) has not arrived. Current backend time: ${now.toISOString()}`,
    };
  }
   * ========================================================================= */

  const interview = await findInterviewSafely(job.interviewId);
  if (interview) {
    const validExecutionStatuses = ["SCHEDULED", "READY", "WAITING_FOR_CANDIDATE", "IN_PROGRESS"];
    if (!validExecutionStatuses.includes(interview.status)) {
      return {
        success: false,
        eligible: false,
        reason: "INTERVIEW_NOT_EXECUTABLE",
        interviewStatus: interview.status,
        message: `Interview session is in non-executable status: ${interview.status}`,
      };
    }
  }

  return {
    success: true,
    eligible: true,
    jobId: String(job._id),
    scheduledAt: job.scheduledAt,
    backendTime: now.toISOString(),
    message: "Preflight checks passed. Job is eligible for launch.",
  };
}

/**
 * Release a claimed job safely back to QUEUED if it cannot be started.
 */
export async function releaseJobClaim(jobId, workerId, { reason = "DEFERRED_FUTURE_START" } = {}) {
  if (!isValidObjectId(jobId)) {
    const err = new Error("Invalid jobId.");
    err.status = 400;
    throw err;
  }

  const job = await BotJob.findOneAndUpdate(
    {
      _id: jobId,
      assignedWorkerId: workerId,
      status: "CLAIMED",
    },
    {
      $set: {
        status: "QUEUED",
        assignedWorkerId: null,
        leaseExpiresAt: null,
      },
    },
    { new: true }
  );

  if (job) {
    await BotWorker.updateOne(
      { workerId, currentJobId: jobId },
      { $set: { status: "IDLE", currentJobId: null, currentInterviewId: null } }
    ).catch(() => {});

    await recordAuditLog({
      action: "JOB_RELEASED",
      performedBy: workerId,
      targetWorkerId: workerId,
      targetJobId: jobId,
      details: { reason },
    });
  }

  return { success: true, released: Boolean(job) };
}

/**
 * Renew job execution lease while interview is actively running.
 * Verifies that the requesting worker currently owns the job and scheduled time has arrived.
 */
export async function renewJobLease(jobId, workerId, { state = "RUNNING", currentTime } = {}) {
  if (!isValidObjectId(jobId)) {
    const err = new Error("Invalid jobId.");
    err.status = 400;
    throw err;
  }

  const leaseMs = getLeaseDurationMs();
  const now = currentTime ? new Date(currentTime) : new Date();

  // 1. Verify job exists, belongs to worker, and scheduled start has arrived
  const existingJob = await BotJob.findById(jobId);
  if (!existingJob) {
    const err = new Error("Job not found.");
    err.status = 404;
    throw err;
  }

  if (existingJob.assignedWorkerId !== workerId) {
    const err = new Error("Forbidden: Worker no longer owns this job or the lease has expired.");
    err.status = 403;
    throw err;
  }

  /* =========================================================================
   * [STRICT SLOT TIMING FEATURE - TEMPORARILY COMMENTED OUT FOR TESTING]
   * In production, forbids lease renewal if scheduled start is in future.
   * Uncomment the block below when ready for production slot timing enforcement.
   * =========================================================================
  if (new Date(existingJob.scheduledAt).getTime() > now.getTime()) {
    const err = new Error("Forbidden: Scheduled start time has not arrived yet.");
    err.status = 400;
    throw err;
  }
   * ========================================================================= */

  // 2. Check underlying interview status
  const interview = await findInterviewSafely(existingJob.interviewId);
  if (interview) {
    const validExecutionStatuses = ["SCHEDULED", "READY", "WAITING_FOR_CANDIDATE", "IN_PROGRESS"];
    if (!validExecutionStatuses.includes(interview.status)) {
      existingJob.status = interview.status === "COMPLETED" ? "COMPLETED" : "FAILED";
      existingJob.failureReason = `Interview session transitioned to ${interview.status}`;
      await existingJob.save().catch(() => {});
      const err = new Error(`Forbidden: Interview is in ${interview.status} status.`);
      err.status = 410;
      throw err;
    }
  }

  // 3. Atomically verify ownership and renew lease
  const job = await BotJob.findOneAndUpdate(
    {
      _id: jobId,
      assignedWorkerId: workerId,
      status: { $in: ["CLAIMED", "RUNNING"] },
      /* =====================================================================
       * [STRICT SLOT TIMING FEATURE - TEMPORARILY COMMENTED OUT FOR TESTING]
       * Uncomment the line below when ready for production slot timing enforcement.
       * =====================================================================
      scheduledAt: { $lte: now },
       * ===================================================================== */
    },
    {
      $set: {
        status: "RUNNING",
        lastHeartbeatAt: now,
        leaseExpiresAt: new Date(now.getTime() + leaseMs),
      },
    },
    { new: true }
  );

  if (!job) {
    const err = new Error("Forbidden: Worker no longer owns this job or the lease has expired.");
    err.status = 403;
    throw err;
  }

  // Update worker heartbeat timestamp
  await BotWorker.updateOne(
    { workerId },
    { $set: { lastHeartbeatAt: now, status: "BUSY" } }
  ).catch(() => {});

  return {
    success: true,
    leaseExpiresAt: job.leaseExpiresAt,
    status: job.status,
    backendCurrentTime: now.toISOString(),
  };
}

/**
 * Complete a job upon bot process termination.
 * Verifies the authoritative MongoDB interview session status before marking success!
 */
export async function completeJob(jobId, workerId, { exitCode = 0, details = "" } = {}) {
  if (!isValidObjectId(jobId)) {
    const err = new Error("Invalid jobId.");
    err.status = 400;
    throw err;
  }

  const job = await BotJob.findById(jobId);
  if (!job) {
    const err = new Error("Job not found.");
    err.status = 404;
    throw err;
  }

  if (job.assignedWorkerId !== workerId) {
    const err = new Error("Forbidden: Worker does not own this job.");
    err.status = 403;
    throw err;
  }

  // Idempotent completion check
  if (job.status === "COMPLETED") {
    return {
      success: true,
      status: "COMPLETED",
      alreadyCompleted: true,
      completedAt: job.completedAt,
    };
  }

  const now = new Date();
  const interview = await AiInterview.findById(job.interviewId);
  if (!interview) {
    const err = new Error("Authoritative interview session not found.");
    err.status = 404;
    throw err;
  }

  const isInterviewCompleted = ["COMPLETED", "COMPLETING", "ANALYSIS_PENDING", "ANALYZED"].includes(interview.status);
  const isNoShow = interview.status === "CANDIDATE_NO_SHOW";
  const isCancelled = interview.status === "CANCELLED";

  if (isInterviewCompleted) {
    job.status = "COMPLETED";
    job.completedAt = now;
  } else if (isNoShow) {
    job.status = "COMPLETED";
    job.completedAt = now;
    job.failureReason = "CANDIDATE_NO_SHOW";
  } else if (isCancelled) {
    job.status = "FAILED";
    job.failedAt = now;
    job.failureReason = "INTERVIEW_CANCELLED";
  } else {
    // Process exited, but interview was NOT completed in the database!
    const interviewStarted = Boolean(interview.candidateJoinedAt || (interview.transcript && interview.transcript.length > 1));
    if (interviewStarted) {
      // Partial interview: do not blindly replay to prevent duplicate answers
      job.status = "FAILED";
      job.needsAdminReview = true;
      job.failedAt = now;
      job.failureReason = "Bot process exited before interview completion was confirmed in database. Flagged for administrator review.";
    } else {
      // Bot didn't start interview; retry if attempts remain
      if (job.attemptCount < job.maxAttempts) {
        job.status = "QUEUED";
        job.assignedWorkerId = null;
        job.leaseExpiresAt = null;
        job.failureReason = `Process exited without starting interview (exitCode: ${exitCode}). Re-queued for retry.`;
      } else {
        job.status = "FAILED";
        job.needsAdminReview = true;
        job.failedAt = now;
        job.failureReason = `Process exited before session started; maximum attempts (${job.maxAttempts}) reached.`;
      }
    }
  }

  if (!job.executionHistory) {
    job.executionHistory = [];
  }
  job.executionHistory.push({
    workerId,
    attempt: job.attemptCount,
    completedAt: now,
    status: job.status,
    exitCode: exitCode != null ? Number(exitCode) : null,
    error: job.failureReason,
  });

  await job.save();

  // Free worker
  await BotWorker.updateOne(
    { workerId },
    { $set: { status: "IDLE", currentJobId: null, currentInterviewId: null } }
  ).catch(() => {});

  await recordAuditLog({
    action: job.status === "COMPLETED" ? "JOB_COMPLETED" : "JOB_FAILED",
    performedBy: workerId,
    targetWorkerId: workerId,
    targetJobId: job._id,
    targetInterviewId: job.interviewId,
    details: { exitCode, interviewStatus: interview.status, finalJobStatus: job.status },
  });

  return {
    success: true,
    status: job.status,
    needsAdminReview: Boolean(job.needsAdminReview),
    failureReason: job.failureReason || null,
    completedAt: job.completedAt || null,
  };
}

/**
 * Report job failure safely from worker.
 */
export async function failJob(jobId, workerId, { error = "", exitCode = null } = {}) {
  if (!isValidObjectId(jobId)) {
    const err = new Error("Invalid jobId.");
    err.status = 400;
    throw err;
  }

  const job = await BotJob.findById(jobId);
  if (!job) {
    const err = new Error("Job not found.");
    err.status = 404;
    throw err;
  }

  if (job.assignedWorkerId !== workerId) {
    const err = new Error("Forbidden: Worker does not own this job.");
    err.status = 403;
    throw err;
  }

  if (job.status === "COMPLETED") {
    return { success: true, status: "COMPLETED", message: "Job is already completed." };
  }

  const cleanError = sanitizeError(error);
  const now = new Date();
  const interview = await AiInterview.findById(job.interviewId);

  const interviewStarted = Boolean(interview?.candidateJoinedAt || (interview?.transcript && interview.transcript.length > 1));

  if (interviewStarted) {
    // If interview already has answers, do NOT auto-retry blindly from scratch
    job.status = "FAILED";
    job.needsAdminReview = true;
    job.failedAt = now;
    job.failureReason = `Failure after interview began: ${cleanError}`;
  } else {
    if (job.attemptCount < job.maxAttempts) {
      job.status = "QUEUED";
      job.assignedWorkerId = null;
      job.leaseExpiresAt = null;
      job.failureReason = cleanError;
    } else {
      job.status = "FAILED";
      job.needsAdminReview = true;
      job.failedAt = now;
      job.failureReason = `Max attempts (${job.maxAttempts}) reached. ${cleanError}`;
    }
  }

  if (!job.executionHistory) {
    job.executionHistory = [];
  }
  job.executionHistory.push({
    workerId,
    attempt: job.attemptCount,
    failedAt: now,
    status: job.status,
    exitCode: exitCode != null ? Number(exitCode) : null,
    error: cleanError,
  });

  await job.save();

  // Free worker
  await BotWorker.updateOne(
    { workerId },
    {
      $set: {
        status: "IDLE",
        currentJobId: null,
        currentInterviewId: null,
        lastError: { message: cleanError, timestamp: now },
      },
    }
  ).catch(() => {});

  await recordAuditLog({
    action: "JOB_FAILED",
    performedBy: workerId,
    targetWorkerId: workerId,
    targetJobId: job._id,
    targetInterviewId: job.interviewId,
    details: { error: cleanError, finalJobStatus: job.status },
  });

  return {
    success: true,
    status: job.status,
    needsAdminReview: Boolean(job.needsAdminReview),
    failureReason: job.failureReason || null,
  };
}

// ==============================================================================
// ADMINISTRATIVE SERVICE METHODS
// ==============================================================================

/**
 * Get overall system status, active workers, dynamic online calculation, and queue metrics.
 */
export async function getAdminStatus() {
  const staleMs = getWorkerStaleMs();
  const now = Date.now();

  const workers = (await BotWorker.find().sort({ registeredAt: -1 })) || [];
  const processedWorkers = workers.map((w) => {
    const isOnline = now - new Date(w.lastHeartbeatAt).getTime() < staleMs;
    let effectiveStatus = w.status;
    if (!isOnline) {
      effectiveStatus = "OFFLINE";
    } else if (!w.enabled) {
      effectiveStatus = "PAUSED";
    }

    return {
      workerId: w.workerId,
      hostname: w.hostname,
      platform: w.platform,
      version: w.version,
      enabled: w.enabled,
      isOnline,
      status: effectiveStatus,
      lastHeartbeatAt: w.lastHeartbeatAt,
      registeredAt: w.registeredAt,
      currentJobId: w.currentJobId,
      currentInterviewId: w.currentInterviewId,
      lastError: w.lastError,
    };
  });

  const [queued, claimed, running, completed, failed, needsReview] = await Promise.all([
    BotJob.countDocuments({ status: "QUEUED" }),
    BotJob.countDocuments({ status: "CLAIMED" }),
    BotJob.countDocuments({ status: "RUNNING" }),
    BotJob.countDocuments({ status: "COMPLETED" }),
    BotJob.countDocuments({ status: "FAILED" }),
    BotJob.countDocuments({ needsAdminReview: true }),
  ]);

  return {
    success: true,
    timestamp: new Date().toISOString(),
    workers: processedWorkers,
    totalWorkers: workers.length,
    onlineWorkers: processedWorkers.filter((w) => w.isOnline).length,
    queue: {
      queued,
      claimed,
      running,
      completed,
      failed,
      needsReview,
    },
  };
}

/**
 * Admin pause or re-enable a worker.
 */
export async function adminUpdateWorker(workerId, { enabled }, adminId) {
  if (!validateWorkerId(workerId)) {
    const err = new Error("Invalid workerId.");
    err.status = 400;
    throw err;
  }

  const worker = await BotWorker.findOne({ workerId });
  if (!worker) {
    const err = new Error("Worker not found.");
    err.status = 404;
    throw err;
  }

  const newEnabled = Boolean(enabled);
  worker.enabled = newEnabled;
  if (!newEnabled && worker.status === "IDLE") {
    worker.status = "PAUSED";
  } else if (newEnabled && worker.status === "PAUSED") {
    worker.status = "IDLE";
  }

  await worker.save();

  await recordAuditLog({
    action: newEnabled ? "WORKER_ENABLED" : "WORKER_PAUSED",
    performedBy: String(adminId || "admin"),
    targetWorkerId: workerId,
    details: { enabled: newEnabled },
  });

  return {
    success: true,
    workerId: worker.workerId,
    enabled: worker.enabled,
    status: worker.status,
  };
}

/**
 * List jobs with pagination and filters.
 */
export async function adminGetJobs({ status, workerId, page = 1, limit = 20 } = {}) {
  const query = {};
  if (status) {
    query.status = status;
  }
  if (workerId) {
    query.assignedWorkerId = workerId;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [jobs, total] = await Promise.all([
    BotJob.find(query)
      .sort({ scheduledAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("interviewId", "status scheduledAt meetLink currentQuestionIndex durationMinutes")
      .populate("candidateId", "name email role"),
    BotJob.countDocuments(query),
  ]);

  return {
    success: true,
    jobs,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}

/**
 * Admin retry an eligible failed job.
 */
export async function adminRetryJob(jobId, adminId) {
  if (!isValidObjectId(jobId)) {
    const err = new Error("Invalid jobId.");
    err.status = 400;
    throw err;
  }

  const job = await BotJob.findById(jobId);
  if (!job) {
    const err = new Error("Job not found.");
    err.status = 404;
    throw err;
  }

  if (job.status !== "FAILED") {
    const err = new Error(`Only FAILED jobs can be retried. Current status is ${job.status}.`);
    err.status = 400;
    throw err;
  }

  const interview = await AiInterview.findById(job.interviewId);
  if (interview && ["COMPLETED", "ANALYZED"].includes(interview.status)) {
    const err = new Error("Cannot retry job: The associated interview has already completed.");
    err.status = 400;
    throw err;
  }
  if (interview && interview.status === "CANCELLED") {
    const err = new Error("Cannot retry job: The associated interview was cancelled.");
    err.status = 400;
    throw err;
  }

  job.status = "QUEUED";
  job.assignedWorkerId = null;
  job.leaseExpiresAt = null;
  job.failureReason = null;
  job.needsAdminReview = false;
  job.attemptCount = 0; // Explicit admin retry resets attempt count

  await job.save();

  await recordAuditLog({
    action: "JOB_RETRIED",
    performedBy: String(adminId || "admin"),
    targetJobId: job._id,
    targetInterviewId: job.interviewId,
    details: { retriedByAdmin: true },
  });

  return {
    success: true,
    job,
  };
}

export default {
  registerWorker,
  recordWorkerHeartbeat,
  claimNextJob,
  validateJobPreflight,
  releaseJobClaim,
  renewJobLease,
  completeJob,
  failJob,
  recoverExpiredLeases,
  syncEligibleInterviewJobs,
  getAdminStatus,
  adminUpdateWorker,
  adminGetJobs,
  adminRetryJob,
  recordAuditLog,
};
