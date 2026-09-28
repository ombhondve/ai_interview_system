import express from "express";
import {
  analyzeResume,
  generateProjectWithAI,
} from "./ai.controller.js";

const router = express.Router();

router.post("/analyze-resume", analyzeResume);
router.post("/generate-project", generateProjectWithAI);

export default router;
