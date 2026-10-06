import { SpeechToTextProvider } from "./interview.providers.js";

/**
 * Configurable Deepgram prerecorded-audio transcription adapter.
 * Supply DEEPGRAM_API_KEY server-side. This adapter is HTTP-based (audio chunk
 * upload), not a live streaming socket; no audio is routed through Google Meet.
 */
export class DeepgramSpeechToTextProvider extends SpeechToTextProvider {
  constructor({ apiKey = process.env.DEEPGRAM_API_KEY, model = process.env.DEEPGRAM_MODEL || "nova-2", timeoutMs = 30_000 } = {}) {
    super();
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  async transcribe(audio) {
    if (!this.apiKey) throw new Error("Speech recognition is not configured.");
    const bytes = Buffer.isBuffer(audio?.buffer) ? audio.buffer : Buffer.isBuffer(audio) ? audio : null;
    if (!bytes?.length) throw new Error("Audio payload is empty or invalid.");
    if (bytes.length > 8 * 1024 * 1024) throw new Error("Audio payload is too large.");
    const contentType = audio?.contentType || "audio/webm";
    if (!/^audio\/(webm|wav|mpeg|mp4|ogg|mp3|x-wav)(;.*)?$/i.test(contentType)) throw new Error("Unsupported audio format.");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url = new URL("https://api.deepgram.com/v1/listen");
      url.searchParams.set("model", this.model);
      url.searchParams.set("smart_format", "true");
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Token ${this.apiKey}`, "Content-Type": contentType },
        body: bytes,
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error(response.status === 429 ? "Speech recognition is rate limited." : "Speech recognition failed.");
        error.status = response.status === 429 ? 429 : 502;
        throw error;
      }
      const data = await response.json();
      const text = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
      if (typeof text !== "string") throw new Error("Speech recognition returned no transcript.");
      return { text: text.trim(), provider: "deepgram" };
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Speech recognition timed out.");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

export default DeepgramSpeechToTextProvider;
