/** Server-side speech-to-text provider contract. */
export class SpeechToTextProvider {
  async transcribe(_audio) {
    throw new Error("Speech-to-text provider is not configured");
  }
}
