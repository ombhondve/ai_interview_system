/**
 * Interview Analysis Service
 * Consumes transcript + context, produces structured performance report.
 * AI recommendation is advisory only: STRONG | ADMIN_REVIEW | WEAK.
 */

import { generateStructuredAI } from "../ai/ai.service.js";
import { buildAnalysisPrompt, AI_RECOMMENDATIONS } from "./interview.prompt.js";
import logger from "../../utils/logger.js";

function clampScore(v, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function cleanBlock(raw, fallbackSummary = "") {
  return {
    score: clampScore(raw?.score),
    summary: typeof raw?.summary === "string" ? raw.summary.slice(0, 2000) : fallbackSummary,
  };
}

/**
 * Validate / sanitize raw LLM analysis. Returns null when unusable so the
 * caller can fall back safely instead of storing garbage.
 */
export function sanitizeAnalysis(raw) {
  if (!raw || typeof raw !== "object") return null;
  try {
    const rec = AI_RECOMMENDATIONS.includes(raw.recommendation) ? raw.recommendation : "ADMIN_REVIEW";
    const overall = clampScore(raw.overallScore, 0);
    const analysis = {
      technicalKnowledge: cleanBlock(raw.technicalKnowledge),
      projectUnderstanding: cleanBlock(raw.projectUnderstanding),
      problemSolving: cleanBlock(raw.problemSolving),
      communication: cleanBlock(raw.communication),
      projectWalkthrough: cleanBlock(raw.projectWalkthrough),
      strengths: Array.isArray(raw.strengths) ? raw.strengths.filter((s) => typeof s === "string").slice(0, 10) : [],
      areasForImprovement: Array.isArray(raw.areasForImprovement)
        ? raw.areasForImprovement.filter((s) => typeof s === "string").slice(0, 10)
        : [],
      overallScore: overall,
      recommendation: rec,
      summary: typeof raw.summary === "string" ? raw.summary.slice(0, 3000) : "",
      analyzedAt: new Date(),
    };
    // Scores must be present; if all zero and no summary, treat as unusable.
    const allZero =
      analysis.technicalKnowledge.score === 0 &&
      analysis.projectUnderstanding.score === 0 &&
      analysis.problemSolving.score === 0 &&
      analysis.communication.score === 0 &&
      analysis.projectWalkthrough.score === 0;
    if (allZero && !analysis.summary) return null;
    return analysis;
  } catch {
    return null;
  }
}

/**
 * Deterministic fallback report when AI is unavailable.
 * Clearly marked zero-evidence so admins never mistake it for AI output.
 */
export function fallbackAnalysis({ transcriptLength = 0 } = {}) {
  return {
    technicalKnowledge: { score: 0, summary: "AI analysis unavailable — insufficient evidence to score." },
    projectUnderstanding: { score: 0, summary: "AI analysis unavailable — insufficient evidence to score." },
    problemSolving: { score: 0, summary: "AI analysis unavailable — insufficient evidence to score." },
    communication: { score: 0, summary: "AI analysis unavailable — insufficient evidence to score." },
    projectWalkthrough: { score: 0, summary: "AI analysis unavailable — insufficient evidence to score." },
    strengths: [],
    areasForImprovement: ["Interview transcript could not be analysed automatically; please review manually."],
    overallScore: 0,
    recommendation: "ADMIN_REVIEW",
    summary: `Automatic analysis unavailable (transcript turns: ${transcriptLength}). Requires manual admin review.`,
    analyzedAt: new Date(),
  };
}

export async function analyzeInterview({ context, questions, transcript }) {
  logger.info("AI analysis started");
  try {
    const prompt = buildAnalysisPrompt({
      candidate: context.candidate,
      project: context.project,
      verification: context.verification,
      questions,
      transcript,
    });
    const raw = await generateStructuredAI([
      { role: "system", content: "You are a fair technical hiring evaluator. Return JSON only. Never output HIRE or REJECT." },
      { role: "user", content: prompt },
    ]);
    const clean = sanitizeAnalysis(raw);
    if (clean) {
      logger.info("AI analysis completed");
      return { ...clean, source: "ai" };
    }
    logger.warn("AI analysis output unusable, using fallback.");
  } catch (error) {
    logger.warn(`AI analysis failed, using fallback: ${error.message}`);
  }
  logger.info("AI analysis completed (fallback)");
  return { ...fallbackAnalysis({ transcriptLength: transcript?.length || 0 }), source: "fallback" };
}

export default { analyzeInterview, sanitizeAnalysis, fallbackAnalysis };
