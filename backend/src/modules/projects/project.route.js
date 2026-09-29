import express from "express";

import {
  getProjects,
  getProjectById,
  createProject,
  generateProject,
  regenerateProject,
  updateProject,
  uploadAdminPdf,
  archiveProject,
  deleteProject,
  getAssignedCandidates,
} from "./project.controller.js";

const router = express.Router();

router.get("/", getProjects);

// IMPORTANT: keep these before /:id.

router.post("/generate", generateProject);

router.post(
  "/:id/regenerate",
  regenerateProject
);

router.get(
  "/:id/candidates",
  getAssignedCandidates
);

router.get(
  "/:id",
  getProjectById
);

router.post(
  "/",
  createProject
);

router.patch(
  "/:id",
  updateProject
);

router.post(
  "/:id/admin-pdf",
  uploadAdminPdf
);

router.put(
  "/:id",
  updateProject
);

router.patch(
  "/:id/archive",
  archiveProject
);

router.delete(
  "/:id",
  deleteProject
);

export default router;