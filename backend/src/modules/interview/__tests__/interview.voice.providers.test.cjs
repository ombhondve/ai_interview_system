const { createInterviewVoiceService } = require("../interview.voice.service.js");
const AiInterview = require("../interview.model.js").default;
const answerService = require("../interview.session.answers.service.js");

const originalFindById = AiInterview.findById;

afterEach(() => {
  AiInterview.findById = originalFindById;
  jest.restoreAllMocks();
});

test("voice transcription submits provider transcript through the interview answer flow", async () => {
  AiInterview.findById = async () => ({ _id: "i1", candidateId: "c1", status: "IN_PROGRESS", questions: [], transcript: [] });
  jest.spyOn(answerService, "submitAnswer").mockResolvedValue({ interview: { _id: "i1" }, nextQuestion: { question: "Next?" } });
  const service = createInterviewVoiceService({ stt: { transcribe: async () => ({ text: "I implemented the API." }) } });
  const result = await service.transcribe({ interviewId: "i1", candidateId: "c1", audio: Buffer.from("sample"), contentType: "audio/webm" });
  expect(result.text).toBe("I implemented the API.");
  expect(result.interview._id).toBe("i1");
  expect(answerService.submitAnswer).toHaveBeenCalledWith("i1", "c1", "I implemented the API.", expect.stringMatching(/^voice-i1-/));
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
