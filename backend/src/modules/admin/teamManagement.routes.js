import express from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import {
  listTeamMembers,
  addTeamMember,
  editTeamMember,
  changeTeamMemberStatus,
  removeTeamMember,
} from "./teamManagement.controller.js";

const router = express.Router();

router.use(requireAuth);

// All authenticated admins can view the team roster
router.get("/", requireRole("superadmin", "recruiter", "admin"), listTeamMembers);

// Superadmin-only operations
router.post("/", requireRole("superadmin"), addTeamMember);
router.patch("/:id", requireRole("superadmin"), editTeamMember);
router.patch("/:id/status", requireRole("superadmin"), changeTeamMemberStatus);
router.delete("/:id", requireRole("superadmin"), removeTeamMember);

export default router;
