import { requireVerifiedVoiceSession } from "./interview.voice.auth.js";
import { SpeechToTextProvider, TextToSpeechProvider } from "./providers/interview.providers.js";

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
      return { text, requestId: requestId || null };
    },
    async synthesize({ interviewId, candidateId, questionId }) {
      const doc = await requireVerifiedVoiceSession(interviewId, candidateId);
      const question = doc.questions.find((item) => item.questionId === String(questionId));
      if (!question) { const error = new Error("Question not found."); error.status = 404; throw error; }
      return tts.synthesize(question.question);
    },
  };
}


export default createInterviewVoiceService;
