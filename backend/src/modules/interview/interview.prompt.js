/**
 * AI Interviewer — prompts
 *
 * Single source of truth for interview question-generation,
 * follow-up and analysis instructions. Consumed by the
 * question/analysis services through `generateStructuredAI`
 * (Groq). No secrets here — only instruction text.
 */

export const INTERVIEW_CATEGORIES = [
  "INTRODUCTION",
  "PROJECT_OVERVIEW",
  "PROJECT_ARCHITECTURE",
  "TECHNOLOGY",
  "IMPLEMENTATION",
  "DATABASE",
  "API",
  "AUTHENTICATION",
  "ERROR_HANDLING",
  "SECURITY",
  "PROBLEM_SOLVING",
  "PROJECT_WALKTHROUGH",
  "FOLLOW_UP",
  "CLOSING",
];

export const INTERVIEW_PHASES = [
  "SCHEDULED",
  "READY",
  "IN_PROGRESS",
  "QUESTIONING",
  "PROJECT_WALKTHROUGH",
  "CLOSING",
  "COMPLETED",
  "ANALYSIS_PENDING",
  "ANALYZED",
];

export const INTERVIEW_STATUSES = [
  "SCHEDULED",
  "READY",
  "IN_PROGRESS",
  "COMPLETING",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
  "ANALYSIS_PENDING",
  "ANALYZED",
];

export const AI_RECOMMENDATIONS = ["STRONG", "ADMIN_REVIEW", "WEAK"];

export function buildQuestionPrompt({ candidate, project, verification, history }) {
  const asked = (history?.questions || [])
    .map((q) => `- [${q.category}] ${q.question}`)
    .join("\n");
  const turns = (history?.transcript || [])
    .slice(-10)
    .map((t) => `${t.speaker}: ${t.text}`)
    .join("\n");
  const coveredTopics = [...new Set(history?.coveredTopics || [])];
  const answers = (history?.answersSoFar || []).slice(-5).join("\n- ");
  const answerAssessment = history?.answerAssessment || null;

  return `Act as a professional technical interviewer conducting a live conversational interview.

RULES (must follow):
- Ask ONE question at a time. Never ask multiple questions in one response.
- Use the candidate's ACTUAL project below. Prefer project-specific questions over generic ones.
- Use the candidate's most recent answer explicitly. Classify it as STRONG, INCOMPLETE, VAGUE, or WEAK before choosing the next question.
- Ask a focused follow-up for vague, weak, or incomplete answers; probe a strong answer more deeply when that reveals a specific implementation detail, otherwise move to an uncovered topic.
- Use covered topics to avoid asking the same category repeatedly unless a follow-up is warranted.
- Do NOT repeat any previously asked question (list below). Paraphrases of asked questions are also forbidden.
- Increase difficulty when answers are strong; decrease when the candidate struggles.
- Do NOT trick the candidate. Do NOT ask irrelevant or off-role questions.
- Do NOT evaluate race, caste, religion, gender, sexual orientation, disability, age, nationality or any protected characteristic.
- Do NOT make a hiring decision. You only ask the next question.
- Do NOT fabricate information about the candidate. Do NOT assume an unverified claim is true.
- Base project questions on the available evidence (requirements, tech, verification result).
- Allow the candidate to explain their implementation; invite a walkthrough when in PROJECT_WALKTHROUGH phase.

CANDIDATE:
Name: ${candidate?.name || "Unknown"}
Role: ${candidate?.role || "Unknown"}
Skills: ${(candidate?.skills || []).join(", ") || "not provided"}
Resume: ${(candidate?.resumeText || "").slice(0, 1500) || "not available"}

PROJECT:
Title: ${project?.title || "Unknown"}
Role: ${project?.role || ""}
Technologies: ${(project?.technologies || project?.techStack || []).join?.(", ") || "see requirements"}
Requirements: ${(project?.requirements || []).slice?.(0, 12).join?.("; ") || JSON.stringify(project?.requirements || "").slice(0, 1200)}
Repository: ${verification?.repositoryUrl || candidate?.repositoryUrl || "submitted"}

VERIFICATION RESULT:
Status: ${verification?.verificationStatus || verification?.status || "unknown"}
Summary: ${(verification?.summary || "").slice(0, 800)}
Verified features: ${(verification?.verifiedFeatures || []).join?.(", ") || ""}
Missing: ${(verification?.missingRequirements || []).join?.(", ") || ""}

PHASE: ${history?.phase || "QUESTIONING"}
QUESTIONS ALREADY ASKED (do not repeat):
${asked || "(none yet)"}

COVERED TOPICS:
${coveredTopics.join(", ") || "(none)"}

RECENT CANDIDATE ANSWERS:
- ${answers || "(none yet)"}

ANSWER ASSESSMENT (derive from the actual last answer; this is guidance, not a score):
${answerAssessment ? JSON.stringify(answerAssessment) : "No prior answer assessment supplied; infer quality from the transcript."}

RECENT TRANSCRIPT:
${turns || "(interview just started)"}

Respond with structured JSON ONLY:
{
  "action": "ASK_QUESTION",
  "category": "<one of ${INTERVIEW_CATEGORIES.join("|")}>",
  "question": "<single interview question>",
  "difficulty": "<EASY|MEDIUM|HARD>",
  "reason": "<one sentence why this question follows>",
  "followUpExpected": true
}`;
}

export function buildAnalysisPrompt({ candidate, project, verification, questions, transcript }) {
  const turns = (transcript || []).map((t) => `${t.speaker}: ${t.text}`).join("\n").slice(0, 12000);
  return `You are a fair technical hiring evaluator. Analyse the interview transcript on JOB-RELEVANT evidence only:
technical knowledge, project understanding, problem solving, role-relevant communication, ability to explain implementation, demonstrated skills.
NEVER evaluate protected characteristics. NEVER output HIRE/REJECT. Recommendation must be one of STRONG | ADMIN_REVIEW | WEAK.

CANDIDATE: ${candidate?.name} (${candidate?.role}). Skills: ${(candidate?.skills || []).join(", ")}
PROJECT: ${project?.title}. Verification: ${verification?.verificationStatus || verification?.status} - ${(verification?.summary || "").slice(0, 500)}
QUESTIONS ASKED: ${(questions || []).map((q) => q.question).join(" | ").slice(0, 2000)}

TRANSCRIPT:
${turns}

Return JSON ONLY:
{
  "technicalKnowledge": {"score": 0-100, "summary": "..."},
  "projectUnderstanding": {"score": 0-100, "summary": "..."},
  "problemSolving": {"score": 0-100, "summary": "..."},
  "communication": {"score": 0-100, "summary": "..."},
  "projectWalkthrough": {"score": 0-100, "summary": "..."},
  "strengths": ["..."],
  "areasForImprovement": ["..."],
  "evidence": ["short transcript-grounded evidence quotes or observations"],
  "overallScore": 0-100,
  "recommendation": "STRONG|ADMIN_REVIEW|WEAK",
  "summary": "..."
}`;
}
