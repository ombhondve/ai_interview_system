import express from "express";
import { requireVerifiedSession } from "../../middleware/requireVerifiedSession.js";
import { isValidObjectId } from "./interview.validation.js";
import { createInterviewVoiceService } from "./interview.voice.service.js";
import { DeepgramSpeechToTextProvider } from "./providers/speech-to-text.provider.js";
import { ElevenLabsTextToSpeechProvider } from "./providers/text-to-speech.provider.js";

const router = express.Router();
const voiceService = createInterviewVoiceService({
  stt: process.env.DEEPGRAM_API_KEY ? new DeepgramSpeechToTextProvider() : undefined,
  tts: process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID ? new ElevenLabsTextToSpeechProvider() : undefined,
});

router.post("/:interviewId/transcribe", requireVerifiedSession, async (req, res) => {
  if (!isValidObjectId(req.params.interviewId)) return res.status(400).json({ success: false, message: "Invalid interview ID." });
  const contentType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (!contentType.startsWith("audio/")) return res.status(415).json({ success: false, message: "Upload an audio file to transcribe." });
  if (!Buffer.isBuffer(req.body) || req.body.length > 8 * 1024 * 1024) return res.status(413).json({ success: false, message: "Audio is empty or exceeds the 8 MB limit." });
  try {
    const result = await voiceService.transcribe({ interviewId: req.params.interviewId, candidateId: req.candidate._id, audio: req.body, contentType, requestId: req.headers["x-request-id"] });
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(error.status || 502).json({ success: false, message: error.status ? error.message : "Speech recognition failed. You can type your answer instead." });
  }
});

router.get("/:interviewId/questions/:questionId/audio", requireVerifiedSession, async (req, res) => {
  if (!isValidObjectId(req.params.interviewId)) return res.status(400).json({ success: false, message: "Invalid interview ID." });
  try {
    const result = await voiceService.synthesize({ interviewId: req.params.interviewId, candidateId: req.candidate._id, questionId: req.params.questionId });
    res.setHeader("Content-Type", result.contentType || "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Length", result.audio.length);
    return res.send(result.audio);
  } catch (error) {
    return res.status(error.status || 502).json({ success: false, message: error.status ? error.message : "Voice synthesis failed. You can read the question instead." });
  }
});

export default router;
