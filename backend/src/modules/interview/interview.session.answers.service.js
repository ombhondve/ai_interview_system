/** Interview answer loop, append-only transcript, completion, and admin decision. */
import AiInterview from "./interview.model.js";
import { loadInterviewContext } from "./interview.context.service.js";
import { generateNextQuestion } from "./interview.question.service.js";
import { analyzeAndPersist } from "./interview.analysis.persistence.js";
import logger from "../../utils/logger.js";
import { isProjectVerified } from "../projects/deadline.service.js";
import Candidate from "../candidate/candidate.model.js";

/**
 * Conversational intent detection for human-like interviewer reactions.
 * Categorizes answer into:
 * - DONT_KNOW: "I don't know", "not sure", "don't remember", etc.
 * - THINKING: "give me a moment", "let me think", "trying to remember", etc.
 * - CLARIFY_REPEAT: "can you repeat?", "what do you mean?", "don't understand", etc.
 * - SHORT_ANSWER: single word or ultra brief (e.g. "React", "JWT")
 * - VALID_ANSWER: genuine technical or conversational answer
 */
export function classifyCandidateIntent(text) {
  const clean = String(text || "").trim().toLowerCase();
  if (!clean) return { intent: "SILENCE", text: "" };

  // Clarification / repeat request (English, Hindi, Marathi)
  if (
    /^(can you (please )?repeat|could you repeat|repeat the question|can you rephrase|pardon|what do you mean|i don't understand|i do not understand|could you clarify|can you clarify)\b/i.test(clean) ||
    /\b(repeat (the )?question|what does that mean|explain what you mean|not understand|samajh nahi aaya|samajla nahi|samajh nahi aa raha)\b/i.test(clean)
  ) {
    return { intent: "CLARIFY_REPEAT", text: clean };
  }

  // Thinking / pause request (English, Hindi, Marathi)
  if (
    /\b(give me a (moment|second|min)|let me think|i'm thinking|just a (moment|sec|second)|give me a sec|trying to remember|thinking about it|ek minute|thoda sochna hai|zara thamba|thoda vel dya)\b/i.test(clean)
  ) {
    return { intent: "THINKING", text: clean };
  }

  // "I don't know" / unsure (English, Hindi, Marathi code-switching)
  // "I don't know", "not sure", "mala exact athvat nahi", "mujhe nahi pata", "mala mahit nahi", "ye part nahi pata"
  if (
    /^(i don't know|i do not know|not sure|i'm not sure|i am not sure|i don't remember|i do not remember|haven't worked with that|never used that|no idea|cannot answer|can't answer|don't have an answer|can't remember)\b/i.test(clean) ||
    /\b(i don't know|i don't remember|not really sure|haven't used that|mala mahit nahi|mala athvat nahi|mala exact athvat nahi|mujhe nahi pata|ye part nahi pata|pata nahi|athavat nahi)\b/i.test(clean)
  ) {
    // If the candidate mentions a technical keyword despite saying "don't remember exactly" (e.g. "Mala exact athvat nahi, but I think JWT")
    // treat as a valid answer mentioning that keyword so AI can probe it!
    const techMention = /\b(jwt|token|tokens|react|node|mongodb|mongo|express|sql|redis|aws|docker|auth|api|rest)\b/i.test(clean);
    if (techMention) {
      return { intent: "VALID_ANSWER", text: clean, note: "Hesitant answer with technical mention" };
    }
    return { intent: "DONT_KNOW", text: clean };
  }

  // Off-topic detection (e.g. "Actually during college I also worked on sports/event...")
  if (/\b(during college i also|in my free time i like|unrelated to this project|out of topic)\b/i.test(clean)) {
    return { intent: "OFF_TOPIC", text: clean };
  }

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length <= 3 && !/\b(yes|no|yeah|yep|sure|fine)\b/i.test(clean)) {
    return { intent: "SHORT_ANSWER", text: clean, wordsCount: words.length };
  }

  return { intent: "VALID_ANSWER", text: clean, wordsCount: words.length };
}

/** Short, varied natural acknowledgments */
const NATURAL_ACKS = [
  "Got it.",
  "That makes sense.",
  "Understood.",
  "Thanks for explaining that.",
  "I see.",
];

export function getNaturalAcknowledgment(index = 0) {
  return NATURAL_ACKS[index % NATURAL_ACKS.length];
}

function assessAnswer(text) {
  const answer = String(text || "").trim();
  const words = answer.split(/\s+/).filter(Boolean);
  const intentInfo = classifyCandidateIntent(answer);
  if (intentInfo.intent === "DONT_KNOW") {
    return { quality: "WEAK", intent: "DONT_KNOW", reason: "Candidate is unsure or does not know; move on gracefully." };
  }
  if (intentInfo.intent === "CLARIFY_REPEAT") {
    return { quality: "INCOMPLETE", intent: "CLARIFY_REPEAT", reason: "Candidate asked for clarification or question repeat." };
  }
  if (intentInfo.intent === "THINKING") {
    return { quality: "INCOMPLETE", intent: "THINKING", reason: "Candidate asked for a moment to think." };
  }
  const hasImplementationDetail = /\b(I (used|built|implemented|chose|designed|handled)|because|for example|specifically|the reason)\b/i.test(answer);
  if (words.length < 8) return { quality: "WEAK", intent: intentInfo.intent, reason: "The response is very brief; ask for a clearer explanation." };
  if (words.length < 24 || !hasImplementationDetail) return { quality: "INCOMPLETE", intent: intentInfo.intent, reason: "The response needs more implementation detail or rationale." };
  return { quality: "POTENTIALLY_DETAILED", intent: "VALID_ANSWER", reason: "Probe a concrete detail or continue to an uncovered topic." };
}

export async function submitAnswer(interviewId, candidateId, text, requestId = null) {
  const clean = String(text || "").trim().slice(0, 8000);
  if (!clean) { const e = new Error("Answer text required"); e.status = 400; throw e; }
  const doc = await AiInterview.findById(interviewId);
  if (!doc) { const e = new Error("Interview not found"); e.status = 404; throw e; }
  if (String(doc.candidateId) !== String(candidateId)) { const e = new Error("Forbidden"); e.status = 403; throw e; }
  if (doc.status !== "IN_PROGRESS") { const e = new Error("Interview is not in progress"); e.status = 400; throw e; }
  const candidate = await Candidate.findById(candidateId);
  if (!isProjectVerified(candidate)) { const e = new Error("The assigned project must remain verified to continue."); e.status = 403; throw e; }
  const questionId = String(doc.currentQuestionIndex ?? Math.max(0, doc.questions.length - 1));
  const duplicate = requestId && doc.transcript.find((entry) => entry.requestId === requestId);
  if (duplicate) return { interview: doc, duplicate: true, nextQuestion: doc.questions[doc.currentQuestionIndex] };
  const lastTurn = doc.transcript[doc.transcript.length - 1];
  let answer;
  if (lastTurn?.speaker === "CANDIDATE" && lastTurn.questionId === questionId) {
    if (lastTurn.answerProcessed) { const e = new Error("An answer for the current question has already been submitted."); e.status = 409; throw e; }
    answer = lastTurn;
    if (requestId && !answer.requestId) answer.requestId = requestId;
  } else {
    answer = { sequence: doc.transcript.length, speaker: "CANDIDATE", text: clean, timestamp: new Date(), questionId, requestId: requestId || null, section: doc.phase, answerProcessed: false };
    doc.transcript.push(answer);
    await doc.save();
    logger.info(`Answer received ${doc._id} q=${questionId}`);
  }
  try {
    const context = await loadInterviewContext(doc.candidateId, doc.projectId, doc.bookingId);
    let phase = doc.phase || "OPENING";
    let next;
    let acknowledgment = "";
    let actionType = "NEXT_TOPIC";

    const projectName = context?.project?.title || "assigned project";

    if (phase === "PRECHECK") {
      // Candidate answered pre-check audio/video question
      phase = "OPENING";
      next = {
        category: "INTRODUCTION",
        question: "Great, everything looks good. I'm your AI interviewer today. I'll ask you about your project and some technical decisions you made. Before we begin, could you briefly introduce yourself?",
        difficulty: "EASY",
        reason: "AI introduction and asking candidate for self-introduction.",
        source: "fallback",
        followUpExpected: true,
      };
      actionType = "FOLLOW_UP";
      acknowledgment = "Great, I can hear you clearly.";
    } else if (phase === "OPENING") {
      // Candidate gave self-introduction
      phase = "PROJECT_CONFIRMATION";
      next = {
        category: "PROJECT_CONFIRMATION",
        question: `Thanks, that's helpful. I see that you've been assigned the ${projectName} project. Is that the project you worked on?`,
        difficulty: "EASY",
        reason: "Confirming assigned project with candidate before technical questions.",
        source: "fallback",
        followUpExpected: true,
      };
      actionType = "FOLLOW_UP";
      acknowledgment = "Thanks, that's helpful.";
    } else if (phase === "PROJECT_CONFIRMATION") {
      // Candidate confirmed project
      phase = "PROJECT_UNDERSTANDING";
      next = {
        category: "PROJECT_UNDERSTANDING",
        question: "Great. Can you give me a brief overview of what you built and what problem it solves?",
        difficulty: "MEDIUM",
        reason: "High-level project understanding before technical probing.",
        source: "fallback",
        followUpExpected: true,
      };
      actionType = "FOLLOW_UP";
      acknowledgment = "Great.";
    } else if (phase === "PROJECT_UNDERSTANDING") {
      // Candidate gave overview; ask for personal role / ownership
      phase = "QUESTIONING";
      next = {
        category: "IMPLEMENTATION",
        question: "Understood. Which part of the project did you personally implement?",
        difficulty: "MEDIUM",
        reason: "Determining project ownership and personal contribution.",
        source: "fallback",
        followUpExpected: true,
      };
      actionType = "FOLLOW_UP";
      acknowledgment = "Understood.";
    } else {
      const intentInfo = classifyCandidateIntent(clean);
      const lastQ = doc.questions[doc.currentQuestionIndex] || doc.questions[doc.questions.length - 1];

      // 1. CLARIFY / REPEAT handling
      if (intentInfo.intent === "CLARIFY_REPEAT") {
        actionType = "REPEAT";
        const repeatedText = `Sure. What I mean is: ${lastQ?.question || "can you explain how your project works?"}`;
        return {
          interview: doc,
          duplicate: false,
          nextQuestion: { ...lastQ, question: repeatedText, reason: "Candidate requested repeat/clarification" },
          acknowledgment: "Sure.",
          action: "REPEAT",
          closing: false,
        };
      }

      // 2. THINKING handling
      if (intentInfo.intent === "THINKING") {
        actionType = "WAIT";
        return {
          interview: doc,
          duplicate: false,
          nextQuestion: { question: "Sure, take your time.", category: "FOLLOW_UP" },
          acknowledgment: "Sure, take your time.",
          action: "WAIT",
          closing: false,
        };
      }

      // 2b. OFF_TOPIC redirection
      if (intentInfo.intent === "OFF_TOPIC") {
        actionType = "FOLLOW_UP";
        const redirectQuestion = `Understood. Let's stay with your project for now: ${lastQ?.question || "can you tell me how you built the backend?"}`;
        return {
          interview: doc,
          duplicate: false,
          nextQuestion: { ...lastQ, question: redirectQuestion, reason: "Polite redirection back to project" },
          acknowledgment: "Understood.",
          action: "FOLLOW_UP",
          closing: false,
        };
      }

      // 3. "I DON'T KNOW" handling
      if (intentInfo.intent === "DONT_KNOW") {
        actionType = "MOVE_ON";
        acknowledgment = "No problem. Let's move on.";
        if (lastQ?.category) {
          doc.knowledgeGaps = [...new Set([...(doc.knowledgeGaps || []), lastQ.category])];
        }
      } else {
        acknowledgment = getNaturalAcknowledgment(doc.questions.length);
      }

      // Track evaluation metrics
      const candidateAnswers = doc.transcript.filter((turn) => turn.speaker === "CANDIDATE");
      const answerAssessment = assessAnswer(answer.text);
      answer.answerQuality = answerAssessment.quality;
      answer.answerProcessed = true;

      if (lastQ?.category) {
        doc.technicalAreas = [...new Set([...(doc.technicalAreas || []), lastQ.category])];
        if (answerAssessment.quality === "POTENTIALLY_DETAILED") {
          doc.candidateStrengths = [...new Set([...(doc.candidateStrengths || []), lastQ.category])];
        } else if (answerAssessment.quality === "WEAK") {
          doc.candidateWeaknesses = [...new Set([...(doc.candidateWeaknesses || []), lastQ.category])];
        }
      }

      // Adaptive Phase Progression:
      // QUESTIONING (turns 4-7) -> STRENGTH_DEPTH or WEAKNESS_GAP (turns 8-10) -> CLOSING (turn 11+)
      const techQuestionCount = doc.questions.filter((q) =>
        !["PRECHECK", "INTRODUCTION", "PROJECT_CONFIRMATION"].includes(q.category)
      ).length;

      if (techQuestionCount >= 3 && phase === "QUESTIONING") {
        phase = doc.candidateStrengths.length > 0 ? "STRENGTH_DEPTH" : "WEAKNESS_GAP";
      } else if (techQuestionCount >= 6 && ["STRENGTH_DEPTH", "WEAKNESS_GAP"].includes(phase)) {
        phase = "CLOSING";
      }

      await doc.save();
      const coveredTopics = [...new Set(doc.questions.map((q) => q.category))];

      next = await generateNextQuestion({
        context,
        askedQuestions: doc.questions,
        transcript: doc.transcript.map(({ speaker, text: turnText }) => ({ speaker, text: turnText })),
        answersSoFar: candidateAnswers.map((turn) => turn.text),
        coveredTopics,
        answerAssessment,
        phase,
      });

      if (intentInfo.intent === "SHORT_ANSWER") {
        actionType = "FOLLOW_UP";
      }
    }

    answer.answerProcessed = true;
    if (next.category === "CLOSING") phase = "CLOSING";
    doc.phase = phase;
    const nextQuestionId = String(doc.questions.length);
    doc.questions.push({ ...next, questionId: nextQuestionId, askedAt: new Date() });
    doc.currentQuestionIndex = doc.questions.length - 1;
    doc.transcript.push({ sequence: doc.transcript.length, speaker: "AI", text: next.question, timestamp: new Date(), questionId: nextQuestionId, category: next.category, section: phase });
    await doc.save();
    logger.info(`Question generated ${doc._id} category=${next.category}`);
    return {
      interview: doc,
      duplicate: false,
      nextQuestion: next,
      acknowledgment: acknowledgment || null,
      action: actionType,
      closing: next.category === "CLOSING",
    };
  } catch (error) {
    await doc.save();
    logger.warn(`Question generation failed after answer persistence ${doc._id}: ${error.message}`);
    error.answerPersisted = true;
    error.status = 503;
    throw error;
  }
}

export async function endInterview(interviewId, candidateId = null, options = {}) {
  const doc = await AiInterview.findById(interviewId);
  if (!doc) { const e = new Error("Interview not found"); e.status = 404; throw e; }
  if (candidateId && String(doc.candidateId) !== String(candidateId)) { const e = new Error("Forbidden"); e.status = 403; throw e; }
  if (["COMPLETED", "ANALYZED"].includes(doc.status)) return doc;
  if (["COMPLETING", "ANALYSIS_PENDING"].includes(doc.status)) {
    if (options.waitForAnalysis) {
      return await analyzeAndPersist(doc._id);
    }
    return doc;
  }
  if (!["IN_PROGRESS", "WAITING_FOR_CANDIDATE"].includes(doc.status)) {
    const e = new Error("Interview is not in progress"); e.status = 400; throw e;
  }
  doc.status = "COMPLETING";
  doc.endedAt = doc.endedAt || new Date();
  doc.analysisError = null;
  doc.transcript.forEach((entry, index) => { if (entry.sequence == null) entry.sequence = index; });
  await doc.save();
  logger.info(`Interview completed ${doc._id}`);

  // Mark candidate status if applicable
  try {
    const { default: mongoose } = await import("mongoose");
    if (mongoose.connection.readyState === 1) {
      const { default: Candidate } = await import("../candidate/candidate.model.js");
      await Candidate.findByIdAndUpdate(doc.candidateId, { status: "completed" });
    }
  } catch (cErr) {
    logger.warn(`Could not update candidate status on interview completion: ${cErr.message}`);
  }

  if (options.waitForAnalysis) {
    return await analyzeAndPersist(doc._id);
  }
  analyzeAndPersist(doc._id).catch((err) => logger.error(`AI analysis failed ${doc._id}:`, err.message));
  return doc;
}

export async function saveAdminDecision(interviewId, input) {
  const { status, notes, decidedBy } = input || {};
  const doc = await AiInterview.findById(interviewId);
  if (!doc) { const e = new Error("Interview not found"); e.status = 404; throw e; }
  if (!["selected", "rejected", "another_interview"].includes(status)) { const e = new Error("Invalid decision"); e.status = 400; throw e; }
  doc.adminDecision = { status, notes: String(notes || "").slice(0, 2000), decidedBy, decidedAt: new Date() };
  await doc.save();

  // Sync candidate document status
  try {
    const { default: mongoose } = await import("mongoose");
    if (mongoose.connection.readyState === 1) {
      const { default: Candidate } = await import("../candidate/candidate.model.js");
      const candidateStatus = status === "selected" ? "approved" : (status === "rejected" ? "rejected" : "decided");
      await Candidate.findByIdAndUpdate(doc.candidateId, { status: candidateStatus });
    }
  } catch (cErr) {
    logger.warn(`Could not update candidate status on admin decision: ${cErr.message}`);
  }

  return doc;
}

export default { submitAnswer, endInterview, saveAdminDecision };
