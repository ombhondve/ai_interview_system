import { createInterviewVoiceService } from "./interview.voice.service.js";
import AiInterview from "./interview.model.js";

const originalFindById = AiInterview.findById;

afterEach(() => {
  AiInterview.findById = originalFindById;
});

test("voice transcription validates ownership/state and returns provider transcript", async () => {
  AiInterview.findById = async () => ({ _id: "i1", candidateId: "c1", status: "IN_PROGRESS", questions: [], transcript: [] });
  const service = createInterviewVoiceService({
    stt: { transcribe: async () => ({ text: "I implemented the API." }) },
    tts: { synthesize: async () => ({ audio: Buffer.from("audio"), contentType: "audio/mpeg" }) },
  });
  const result = await service.transcribe({ interviewId: "i1", candidateId: "c1", audio: Buffer.from("sample"), contentType: "audio/webm" });
  expect(result.text).toBe("I implemented the API.");
});

test("voice transcription rejects a different candidate", async () => {
  AiInterview.findById = async () => ({ _id: "i1", candidateId: "other", status: "IN_PROGRESS", questions: [], transcript: [] });
  const service = createInterviewVoiceService({ stt: { transcribe: jest.fn() } });
  await expect(service.transcribe({ interviewId: "i1", candidateId: "c1", audio: Buffer.from("sample"), contentType: "audio/webm" })).rejects.toMatchObject({ status: 403 });
});

test("voice provider failures propagate for safe route fallback", async () => {
  AiInterview.findById = async () => ({ _id: "i1", candidateId: "c1", status: "IN_PROGRESS", questions: [], transcript: [] });
  const service = createInterviewVoiceService({ stt: { transcribe: async () => { throw new Error("provider unavailable"); } } });
  await expect(service.transcribe({ interviewId: "i1", candidateId: "c1", audio: Buffer.from("sample"), contentType: "audio/webm" })).rejects.toThrow("provider unavailable");
});
