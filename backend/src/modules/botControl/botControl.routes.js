import express from "express";
import {
  requireWorkerRegistrationAuth,
  requireWorkerAuth,
  requireAdminAuth,
} from "./botControl.auth.js";
import {
  limitRegistration,
  limitClaim,
  limitAdminActions,
} from "./botControl.rateLimiter.js";
import {
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
} from "./botControl.controller.js";

const router = express.Router();

// ==============================================================================
// WORKER CONTROL ENDPOINTS
// ==============================================================================

// Worker registration
router.post("/worker/register", limitRegistration, requireWorkerRegistrationAuth, handleRegisterWorker);

// Worker periodic health heartbeat
router.post("/worker/heartbeat", requireWorkerAuth, handleWorkerHeartbeat);

// Worker claim eligible interview job (both GET and POST supported)
router.get("/worker/claim", limitClaim, requireWorkerAuth, handleClaimJob);
router.post("/worker/claim", limitClaim, requireWorkerAuth, handleClaimJob);

// Active job execution lease renewal
router.post("/worker/jobs/:jobId/heartbeat", requireWorkerAuth, handleJobHeartbeat);

// Job completion notification
router.post("/worker/jobs/:jobId/complete", requireWorkerAuth, handleJobComplete);

// Job failure notification
router.post("/worker/jobs/:jobId/fail", requireWorkerAuth, handleJobFail);

// ==============================================================================
// ADMINISTRATOR MANAGEMENT ENDPOINTS
// ==============================================================================

// Overview status of all workers, online metrics, and job queue
router.get("/admin/status", requireAdminAuth, handleAdminStatus);

// Enable or pause worker
router.patch("/admin/workers/:workerId", requireAdminAuth, limitAdminActions, handleAdminUpdateWorker);

// Inspect jobs list and history with pagination
router.get("/admin/jobs", requireAdminAuth, handleAdminGetJobs);

// Retry an eligible failed job
router.post("/admin/jobs/:jobId/retry", requireAdminAuth, limitAdminActions, handleAdminRetryJob);

export default router;
