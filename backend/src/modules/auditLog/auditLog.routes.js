import express from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { listLogs, getLog } from "./auditLog.controller.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireRole("superadmin", "recruiter", "admin"));

router.get("/", listLogs);
router.get("/:id", getLog);

export default router;
