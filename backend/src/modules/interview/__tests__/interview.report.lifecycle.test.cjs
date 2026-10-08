const { endInterview, saveAdminDecision } = require("../interview.session.answers.service.js");
const { analyzeAndPersist } = require("../interview.analysis.persistence.js");
const AiInterview = require("../interview.model.js").default;

describe("Interview Report & Admin Decision Lifecycle Synchronization", () => {
  let mockDoc;

  beforeEach(() => {
    mockDoc = {
      _id: "507f1f77bcf86cd799439011",
      candidateId: "507f1f77bcf86cd799439012",
      projectId: "507f1f77bcf86cd799439013",
      bookingId: "507f1f77bcf86cd799439014",
      status: "IN_PROGRESS",
      transcript: [
        { sequence: 0, speaker: "AI", text: "Hello, welcome to your interview." },
        { sequence: 1, speaker: "CANDIDATE", text: "Hi, I built the backend with Node.js and MongoDB." },
      ],
      questions: [
        { questionId: "0", category: "PRECHECK", question: "Hello, welcome to your interview." },
      ],
      save: jest.fn().mockResolvedValue(true),
    };

    jest.spyOn(AiInterview, "findById").mockImplementation(async (id) => {
      if (id === mockDoc._id || String(id) === String(mockDoc._id)) return mockDoc;
      return null;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("endInterview transitions status to COMPLETING, records endedAt, and triggers idempotent lifecycle", async () => {
    const persistence = require("../interview.analysis.persistence.js");
    jest.spyOn(persistence, "analyzeAndPersist").mockResolvedValue({ ...mockDoc, status: "ANALYZED" });

    const res = await endInterview(mockDoc._id, mockDoc.candidateId, { waitForAnalysis: false });
    expect(res.status).toBe("COMPLETING");
    expect(res.endedAt).toBeDefined();
    expect(mockDoc.save).toHaveBeenCalled();
  });

  test("endInterview is idempotent when already COMPLETING or ANALYZED", async () => {
    mockDoc.status = "ANALYZED";
    const res = await endInterview(mockDoc._id, mockDoc.candidateId);
    expect(res.status).toBe("ANALYZED");
  });

  test("saveAdminDecision saves human decision (selected/rejected/another_interview) and notes", async () => {
    const res = await saveAdminDecision(mockDoc._id, {
      status: "selected",
      notes: "Candidate has strong backend architecture skills.",
      decidedBy: "admin-user-1",
    });

    expect(res.adminDecision).toMatchObject({
      status: "selected",
      notes: "Candidate has strong backend architecture skills.",
      decidedBy: "admin-user-1",
    });
    expect(res.adminDecision.decidedAt).toBeInstanceOf(Date);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  test("saveAdminDecision rejects invalid decision values", async () => {
    await expect(
      saveAdminDecision(mockDoc._id, { status: "HIRE" })
    ).rejects.toThrow("Invalid decision");
  });
});
