import * as botControlService from "./botControl.service.js";
import logger from "../../utils/logger.js";

function handleError(res, error) {
  const status = error.status || 500;
  if (status >= 500) {
    logger.error("BotControl request failed:", error.message);
  }
  return res.status(status).json({
    success: false,
    message: error.message || "An error occurred.",
  });
}

export async function handleRegisterWorker(req, res) {
  try {
    const { workerId, hostname, platform, version } = req.body || {};
    const result = await botControlService.registerWorker({
      workerId,
      hostname,
      platform,
      version,
    });
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function handleWorkerHeartbeat(req, res) {
  try {
    const workerId = req.workerId || req.body?.workerId || req.query?.workerId;
    const { status, currentJobId } = req.body || {};
    const result = await botControlService.recordWorkerHeartbeat(workerId, {
      status,
      currentJobId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function handleClaimJob(req, res) {
  try {
    const workerId = req.workerId || req.query?.workerId || req.body?.workerId;
    if (!workerId) {
      return res.status(400).json({
        success: false,
        message: "workerId is required to claim an interview job.",
      });
    }
    const result = await botControlService.claimNextJob(workerId);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function handleJobHeartbeat(req, res) {
  try {
    const { jobId } = req.params;
    const workerId = req.workerId || req.body?.workerId;
    const { state } = req.body || {};
    const result = await botControlService.renewJobLease(jobId, workerId, { state });
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function handleJobComplete(req, res) {
  try {
    const { jobId } = req.params;
    const workerId = req.workerId || req.body?.workerId;
    const { exitCode, details } = req.body || {};
    const result = await botControlService.completeJob(jobId, workerId, {
      exitCode,
      details,
    });
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function handleJobFail(req, res) {
  try {
    const { jobId } = req.params;
    const workerId = req.workerId || req.body?.workerId;
    const { error, exitCode } = req.body || {};
    const result = await botControlService.failJob(jobId, workerId, {
      error,
      exitCode,
    });
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

// ==============================================================================
// ADMIN CONTROLLERS
// ==============================================================================

export async function handleAdminStatus(req, res) {
  try {
    const result = await botControlService.getAdminStatus();
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function handleAdminUpdateWorker(req, res) {
  try {
    const { workerId } = req.params;
    const { enabled } = req.body || {};
    const adminId = req.user?.id || "admin";
    const result = await botControlService.adminUpdateWorker(workerId, { enabled }, adminId);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function handleAdminGetJobs(req, res) {
  try {
    const { status, workerId, page, limit } = req.query || {};
    const result = await botControlService.adminGetJobs({ status, workerId, page, limit });
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function handleAdminRetryJob(req, res) {
  try {
    const { jobId } = req.params;
    const adminId = req.user?.id || "admin";
    const result = await botControlService.adminRetryJob(jobId, adminId);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

export default {
  handleRegisterWorker,
  handleWorkerHeartbeat,
  handleClaimJob,
  handleJobHeartbeat,
  handleJobComplete,
  handleJobFail,
  handleAdminStatus,
  handleAdminUpdateWorker,
  handleAdminGetJobs,
  handleAdminRetryJob,
};
