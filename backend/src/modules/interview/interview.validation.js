import mongoose from "mongoose";

export function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

export function validateAnswerInput(body) {
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return { ok: false, message: "Answer text is required." };
  if (text.length > 8000) return { ok: false, message: "Answer is too long (max 8000 characters)." };
  const requestId = typeof body?.requestId === "string" && /^[\w-]{8,80}$/.test(body.requestId) ? body.requestId : null;
  return { ok: true, text, requestId };
}

export function validateDecisionInput(body) {
  const allowed = ["selected", "rejected", "another_interview"];
  const status = body?.status;
  if (!allowed.includes(status)) {
    return { ok: false, message: "Decision status must be one of: selected, rejected, another_interview." };
  }
  const notes = typeof body?.notes === "string" ? body.notes.slice(0, 2000).trim() : "";
  return { ok: true, status, notes };
}

export const ADMIN_DECISIONS = ["selected", "rejected", "another_interview"];

export default { isValidObjectId, validateAnswerInput, validateDecisionInput, ADMIN_DECISIONS };
