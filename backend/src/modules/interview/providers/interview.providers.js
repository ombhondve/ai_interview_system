/**
 * Meeting / speech provider abstractions.
 *
 * The InterviewEngine depends ONLY on these interfaces, never on
 * Google-specific code. This keeps the AI interview engine independent
 * from Google Meet so another provider can be added later.
 */

export class MeetingProvider {
  constructor() {
    if (new.target === MeetingProvider) {
      throw new Error("MeetingProvider is an interface and cannot be instantiated directly.");
    }
  }
  async createMeeting() { throw new Error("createMeeting() not implemented"); }
  async getMeeting() { throw new Error("getMeeting() not implemented"); }
  // Live media participation boundary. Returns capability info; providers
  // that cannot join audio return { supported: false, ... }.
  async startAgent() { throw new Error("startAgent() not implemented"); }
  async stopAgent() { throw new Error("stopAgent() not implemented"); }
  async getTranscript() { throw new Error("getTranscript() not implemented"); }
}

export class SpeechToTextProvider {
  async transcribe() { throw new Error("transcribe() not implemented"); }
}

export class TextToSpeechProvider {
  async synthesize() { throw new Error("synthesize() not implemented"); }
}

/**
 * Browser-room speech providers (working fallback).
 *
 * Audio capture/synthesis happens in the browser via WebRTC / Web Speech
 * API. The backend receives TEXT answers, so these server providers are
 * intentionally pass-through: they document the boundary instead of
 * pretending a server-side vendor call exists.
 */
export class BrowserTranscriptProvider extends SpeechToTextProvider {
  async transcribe({ text }) {
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("No transcript text provided.");
    }
    return { text: text.trim(), provider: "browser" };
  }
}

export class BrowserSpeechProvider extends TextToSpeechProvider {
  async synthesize(text) {
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("No text provided for synthesis.");
    }
    // Frontend speaks via speechSynthesis; backend returns the text.
    return { audio: null, text: text.trim(), provider: "browser", mode: "client-synthesis" };
  }
}
