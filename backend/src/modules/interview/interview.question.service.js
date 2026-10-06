/**
 * Interview Question Service
 *
 * Dynamically generates the next interview question using the existing AI
 * provider (`generateStructuredAI` on Groq). Questions are NEVER a fixed
 * list: they are chosen from the candidate/project/verification context,
 * the interview phase, previously asked questions and recent answers.
 *
 * An AI provider failure NEVER breaks the interview: a deterministic
 * fallback pool (filtered against asked questions) keeps the conversation
 * moving so the transcript is not lost.
 */

import { generateStructuredAI } from "../ai/ai.service.js";
import {
  INTERVIEW_CATEGORIES,
  buildQuestionPrompt,
} from "./interview.prompt.js";
import logger from "../../utils/logger.js";

/** Category used when the phase forces a specific kind of question. */
const PHASE_CATEGORY = {
  PROJECT_WALKTHROUGH: "PROJECT_WALKTHROUGH",
  CLOSING: "CLOSING",
};

/** Deterministic fallback pool per phase - only used when the AI fails. */
const FALLBACK_QUESTIONS = {
  QUESTIONING: [
    { category: "INTRODUCTION", question: "Please introduce yourself briefly and tell us about your role.", difficulty: "EASY" },
    { category: "PROJECT_OVERVIEW", question: "Can you give a short overview of the project you submitted?", difficulty: "EASY" },
    { category: "PROJECT_ARCHITECTURE", question: "Can you explain the overall architecture of your project?", difficulty: "MEDIUM" },
    { category: "TECHNOLOGY", question: "Which technologies did you use, and why did you choose them?", difficulty: "MEDIUM" },
    { category: "IMPLEMENTATION", question: "Which part of the implementation was the most challenging, and how did you solve it?", difficulty: "MEDIUM" },
    { category: "DATABASE", question: "How did you design the database schema for this project?", difficulty: "MEDIUM" },
    { category: "API", question: "How does your frontend communicate with your backend?", difficulty: "MEDIUM" },
    { category: "AUTHENTICATION", question: "How did you implement authentication in your project?", difficulty: "MEDIUM" },
    { category: "ERROR_HANDLING", question: "How does your application handle errors and failures?", difficulty: "MEDIUM" },
    { category: "SECURITY", question: "What security measures did you take in this project?", difficulty: "HARD" },
    { category: "PROBLEM_SOLVING", question: "If a user reports a bug you cannot reproduce locally, how would you track it down?", difficulty: "HARD" },
  ],
  PROJECT_WALKTHROUGH: [
    {
      category: "PROJECT_WALKTHROUGH",
      question:
        "Please share your screen and walk me through the main functionality of the project you submitted. Start with the frontend, then explain the backend, APIs, database and authentication.",
      difficulty: "MEDIUM",
    },
    {
      category: "PROJECT_WALKTHROUGH",
      question:
        "Which feature are you most proud of in this project, and can you show us how it works end to end?",
      difficulty: "MEDIUM",
    },
  ],
  CLOSING: [
    {
      category: "CLOSING",
      question: "Thank you for walking us through your project. Do you have any questions for us?",
      difficulty: "EASY",
    },
  ],
};

/**
 * Normalize raw LLM output into a safe question object.
 * NEVER throws for bad AI output — falls back to deterministic pool.
 */
function sanitizeAiQuestion(raw, askedQuestions) {
  if (!raw || typeof raw.question !== "string" || !raw.question.trim()) {
    return null;
  }
  const category = INTERVIEW_CATEGORIES.includes(raw.category)
    ? raw.category
    : "FOLLOW_UP";
  const difficulty = ["EASY", "MEDIUM", "HARD"].includes(raw.difficulty)
    ? raw.difficulty
    : "MEDIUM";
  const text = raw.question.trim().slice(0, 800);
  // Duplicate prevention: exact or near-duplicate of an asked question.
  const normalized = text.toLowerCase();
  const dup = (askedQuestions || []).some((q) => {
    const prev = String(q.question || "").toLowerCase();
    return prev && (prev === normalized || (normalized.length > 20 && prev.includes(normalized.slice(0, 40))));
  });
  if (dup) return null;
  return {
    category,
    question: text,
    difficulty,
    reason: typeof raw.reason === "string" ? raw.reason.slice(0, 300) : "",
    followUpExpected: raw.followUpExpected !== false,
  };
}

function pickFallback(phase, askedQuestions) {
  const pool = FALLBACK_QUESTIONS[phase] || FALLBACK_QUESTIONS.QUESTIONING;
  const asked = new Set((askedQuestions || []).map((q) => String(q?.question || q || "").toLowerCase()));
  return (
    pool.find((q) => !asked.has(q.question.toLowerCase())) ||
    { category: "FOLLOW_UP", question: "Could you explain a different technical decision you made in your project?", difficulty: "MEDIUM" }
  );
}

/**
 * Generate the next interview question.
 *
 * @param {object} params
 * @param {object} params.context output of buildInterviewContext
 * @param {Array} params.askedQuestions questions already asked
 * @param {Array} params.transcript transcript entries so far
 * @param {string} params.phase QUESTIONING | PROJECT_WALKTHROUGH | CLOSING
 */
export async function generateNextQuestion({ context, askedQuestions = [], transcript = [], phase = "QUESTIONING" }) {
  const forced = PHASE_CATEGORY[phase];
  if (forced === "PROJECT_WALKTHROUGH" || forced === "CLOSING") {
    // Phase-forced questions still come from fallback pool deterministically
    // when AI is unavailable; try AI first for a contextual variant.
    try {
      const prompt = buildQuestionPrompt({
        candidate: context.candidate,
        project: context.project,
        verification: context.verification,
        history: { questions: askedQuestions, transcript, phase },
      });
      const raw = await generateStructuredAI([
        { role: "system", content: "You are a professional technical interviewer. Return JSON only." },
        { role: "user", content: prompt },
      ]);
      const clean = sanitizeAiQuestion(raw, askedQuestions);
      if (clean) {
        logger.info(`Question generated (AI, phase=${phase}, category=${clean.category})`);
        return { ...clean, source: "ai" };
      }
    } catch (error) {
      logger.warn(`AI question generation failed (phase=${phase}), using fallback: ${error.message}`);
    }
    const fb = pickFallback(phase, askedQuestions);
    logger.info(`Question generated (fallback, phase=${phase}, category=${fb.category})`);
    return { ...fb, reason: `Fallback for ${phase} phase.`, followUpExpected: false, source: "fallback" };
  }

  try {
    const prompt = buildQuestionPrompt({
      candidate: context.candidate,
      project: context.project,
      verification: context.verification,
      history: { questions: askedQuestions, transcript, phase },
    });
    const raw = await generateStructuredAI([
      { role: "system", content: "You are a professional technical interviewer. Return JSON only." },
      { role: "user", content: prompt },
    ]);
    const clean = sanitizeAiQuestion(raw, askedQuestions);
    if (clean) {
      logger.info(`Question generated (AI, category=${clean.category}, difficulty=${clean.difficulty})`);
      return { ...clean, source: "ai" };
    }
    logger.warn("AI question was duplicate/empty, using fallback.");
  } catch (error) {
    logger.warn(`AI question generation failed, using fallback: ${error.message}`);
  }
  const fb = pickFallback("QUESTIONING", askedQuestions);
  logger.info(`Question generated (fallback, category=${fb.category})`);
  return { ...fb, reason: "Fallback question (AI unavailable).", followUpExpected: false, source: "fallback" };
}

export default { generateNextQuestion };
