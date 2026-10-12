import express from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { getAnalytics } from "./analytics.controller.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireRole("superadmin", "recruiter", "admin"));

router.get("/", getAnalytics);

export default router;
