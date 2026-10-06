import AiInterview from "./interview.model.js";

export async function requireVerifiedVoiceSession(interviewId, candidateId) {
  const doc = await AiInterview.findById(interviewId);
  if (!doc) { const error = new Error("Interview not found."); error.status = 404; throw error; }
  if (String(doc.candidateId) !== String(candidateId)) { const error = new Error("Forbidden."); error.status = 403; throw error; }
  if (doc.status !== "IN_PROGRESS") { const error = new Error("Interview is not in progress."); error.status = 409; throw error; }
  return doc;
}
