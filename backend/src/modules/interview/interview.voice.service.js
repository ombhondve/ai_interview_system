import { requireVerifiedVoiceSession } from "./interview.voice.auth.js";

import { SpeechToTextProvider, TextToSpeechProvider } from "./providers/interview.providers.js";
import { submitAnswer } from "./interview.session.answers.service.js";

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

export function createInterviewVoiceService({ stt = new SpeechToTextProvider(), tts = new TextToSpeechProvider() } = {}) {
  return {
    async transcribe({ interviewId, candidateId, audio, contentType, requestId }) {
      const doc = await requireVerifiedVoiceSession(interviewId, candidateId);
      if (!Buffer.isBuffer(audio) || audio.length === 0 || audio.length > MAX_AUDIO_BYTES) {
        const error = new Error("Audio is empty or exceeds the 8 MB limit."); error.status = 400; throw error;
      }
      if (requestId && doc.transcript.some((entry) => entry.requestId === requestId)) {
        return { text: doc.transcript.find((entry) => entry.requestId === requestId)?.text || "", requestId, duplicate: true };
      }
      const transcript = await stt.transcribe({ buffer: audio, contentType });
      const text = transcript.text?.trim().slice(0, 8000) || "";
      if (!text) return { text: "", silence: true };
      const turnRequestId = requestId || `voice-${interviewId}-${Date.now()}`;
      const answerResult = await submitAnswer(interviewId, candidateId, text, turnRequestId);
      return { text, requestId: turnRequestId, interview: answerResult.interview, nextQuestion: answerResult.nextQuestion, duplicate: answerResult.duplicate, closing: answerResult.closing };
    },
    async synthesize({ interviewId, candidateId, questionId }) {
      const doc = await requireVerifiedVoiceSession(interviewId, candidateId);
      const question = doc.questions.find((item) => item.questionId === String(questionId));
      if (!question) { const error = new Error("Question not found."); error.status = 404; throw error; }
      const result = await tts.synthesize(question.question);
      if (!result?.audio || !Buffer.isBuffer(result.audio)) {
        const error = new Error("Voice synthesis is not configured."); error.status = 503; throw error;
      }
      return result;
    },
  };
}


export default createInterviewVoiceService;
