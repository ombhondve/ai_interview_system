import { TextToSpeechProvider } from "./interview.providers.js";

/** Configurable ElevenLabs TTS adapter. Credentials remain server-side. */
export class ElevenLabsTextToSpeechProvider extends TextToSpeechProvider {
  constructor({ apiKey = process.env.ELEVENLABS_API_KEY, voiceId = process.env.ELEVENLABS_VOICE_ID, modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2", timeoutMs = 30_000 } = {}) {
    super();
    this.apiKey = apiKey;
    this.voiceId = voiceId;
    this.modelId = modelId;
    this.timeoutMs = timeoutMs;
  }

  async synthesize(text) {
    if (!this.apiKey || !this.voiceId) throw new Error("Voice synthesis is not configured.");
    const clean = typeof text === "string" ? text.trim().slice(0, 2000) : "";
    if (!clean) throw new Error("No text provided for synthesis.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(this.voiceId)}`, {
        method: "POST",
        headers: { "xi-api-key": this.apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text: clean, model_id: this.modelId }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error(response.status === 429 ? "Voice synthesis is rate limited." : "Voice synthesis failed.");
        error.status = response.status === 429 ? 429 : 502;
        throw error;
      }
      const audio = Buffer.from(await response.arrayBuffer());
      if (!audio.length || audio.length > 8 * 1024 * 1024) throw new Error("Voice provider returned invalid audio.");
      return { audio, contentType: response.headers.get("content-type") || "audio/mpeg", provider: "elevenlabs" };
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Voice synthesis timed out.");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

export default ElevenLabsTextToSpeechProvider;
