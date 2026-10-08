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
  OPENING: [
    { category: "INTRODUCTION", question: "Hello, welcome to your interview. Can you hear me clearly?", difficulty: "EASY" },
    { category: "INTRODUCTION", question: "Great. Before we begin, could you briefly introduce yourself?", difficulty: "EASY" },
  ],
  QUESTIONING: [
    { category: "PROJECT_OVERVIEW", question: "Can you give a short overview of your project?", difficulty: "EASY" },
    { category: "PROJECT_ARCHITECTURE", question: "How is your project structured architecturally?", difficulty: "MEDIUM" },
    { category: "TECHNOLOGY", question: "Which technologies did you choose, and why?", difficulty: "MEDIUM" },
    { category: "IMPLEMENTATION", question: "What was the most challenging feature you built?", difficulty: "MEDIUM" },
    { category: "DATABASE", question: "How did you design your database schema?", difficulty: "MEDIUM" },
    { category: "API", question: "How does your frontend interact with the backend APIs?", difficulty: "MEDIUM" },
    { category: "AUTHENTICATION", question: "How did you implement authentication in your project?", difficulty: "MEDIUM" },
    { category: "ERROR_HANDLING", question: "How does your application handle errors and edge cases?", difficulty: "MEDIUM" },
    { category: "SECURITY", question: "What security measures did you put in place?", difficulty: "HARD" },
    { category: "PROBLEM_SOLVING", question: "How would you debug an issue you cannot reproduce locally?", difficulty: "HARD" },
  ],
  PROJECT_WALKTHROUGH: [
    {
      category: "PROJECT_WALKTHROUGH",
      question: "Can you give a brief walkthrough of your project's main features?",
      difficulty: "MEDIUM",
    },
    {
      category: "PROJECT_WALKTHROUGH",
      question: "Which feature are you most proud of in this project?",
      difficulty: "MEDIUM",
    },
  ],
  CLOSING: [
    {
      category: "CLOSING",
      question: "Thank you. Do you have any questions for us before we finish?",
      difficulty: "EASY",
    },
  ],
};

/**
 * Clean and simplify conversational questions to fit voice requirements:
 * 1. Single sentence / single idea.
 * 2. Under 20 words normal, 25 words absolute limit.
 * 3. Strips clause lists like "including ...".
 */
export function shortenForVoice(rawText) {
  let text = String(rawText || "").trim();
  if (!text) return "";

  // Split on multiple sentences if present and take the first interrogative sentence
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let firstSentence = sentences[0].trim();

  // Strip multi-clause lists like ", including...", ", such as...", ", along with..."
  firstSentence = firstSentence.replace(/,\s*(including|such as|along with|as well as)\b.*$/i, "?");

  // Ensure it ends with a question mark if interrogative
  if (!firstSentence.endsWith("?") && !firstSentence.endsWith(".")) {
    firstSentence += "?";
  }

  // Count words
  const words = firstSentence.split(/\s+/).filter(Boolean);
  if (words.length <= 20) {
    return firstSentence;
  }

  // If between 21 and 25 words, check if it's already a single clean sentence
  if (words.length <= 25 && !/(\band\b.*\band\b|,.*,)/i.test(firstSentence)) {
    return firstSentence;
  }

  // If still too long (> 20 words or complex clause), prune or simplify
  // E.g. "Can you walk me through the exact steps you took to troubleshoot and resolve the CI/CD pipeline credential configuration issue you encountered?"
  // -> "How did you troubleshoot the CI/CD pipeline issue in your project?"
  // Or extract up to the main punctuation clause / direct question:
  const subClause = firstSentence.split(/,\s*/)[0];
  const subWords = subClause.split(/\s+/).filter(Boolean);
  if (subWords.length >= 4 && subWords.length <= 20) {
    let result = subClause.trim();
    if (!result.endsWith("?")) result += "?";
    return result;
  }

  // Slice to 20 words gracefully
  const truncated = words.slice(0, 20).join(" ").replace(/[,;:]+$/, "");
  return truncated.endsWith("?") ? truncated : `${truncated}?`;
}

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
  
  // Enforce voice brevity and conciseness
  const text = shortenForVoice(raw.question);
  if (!text) return null;

  // Normalize punctuation and stop words so common paraphrases do not repeat
  // the same underlying wording. This remains deliberately provider-free.
  const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word && !["the", "a", "an", "is", "are", "did", "do", "you", "your", "how", "what", "can", "could", "please", "explain", "describe", "tell", "about", "in", "for", "to", "of", "and"].includes(word));
  const normalizedTokens = normalize(text);
  const normalized = normalizedTokens.join(" ");
  const dup = (askedQuestions || []).some((q) => {
    const previousTokens = normalize(q?.question || q || "");
    if (!previousTokens.length || !normalizedTokens.length) return false;
    const previous = previousTokens.join(" ");
    if (previous === normalized) return true;
    const common = normalizedTokens.filter((token) => previousTokens.includes(token)).length;
    return common >= 6 && common / Math.max(normalizedTokens.length, previousTokens.length) >= 0.78;
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
  const available = pool.find((q) => !asked.has(q.question.toLowerCase()));
  if (available) return available;
  if (phase === "PROJECT_WALKTHROUGH") {
    return { category: "PROJECT_WALKTHROUGH", question: "Which code or feature did you personally implement, and what technical trade-offs did you consider?", difficulty: "MEDIUM" };
  }
  if (phase === "CLOSING") return { category: "CLOSING", question: "Is there anything else about your implementation you would like the recruitment team to know?", difficulty: "EASY" };
  return { category: "FOLLOW_UP", question: "Can you give a specific example from your project that supports your answer?", difficulty: "MEDIUM" };
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
export async function generateNextQuestion({ context, askedQuestions = [], transcript = [], answersSoFar = [], coveredTopics = [], answerAssessment = null, phase = "QUESTIONING" }) {
  const forced = PHASE_CATEGORY[phase];
  if (forced === "PROJECT_WALKTHROUGH" || forced === "CLOSING") {
    // Phase-forced questions still come from fallback pool deterministically
    // when AI is unavailable; try AI first for a contextual variant.
    try {
      const prompt = buildQuestionPrompt({
        candidate: context.candidate,
        project: context.project,
        verification: context.verification,
        history: { questions: askedQuestions, transcript, answersSoFar, coveredTopics, answerAssessment, phase },
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
      history: { questions: askedQuestions, transcript, answersSoFar, coveredTopics, answerAssessment, phase },
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

export { sanitizeAiQuestion };
export default { generateNextQuestion, shortenForVoice, sanitizeAiQuestion };
