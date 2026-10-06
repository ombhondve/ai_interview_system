/** Server-side text-to-speech provider contract. */
export class TextToSpeechProvider {
  async synthesize(_text) {
    throw new Error("Text-to-speech provider is not configured");
  }
}
