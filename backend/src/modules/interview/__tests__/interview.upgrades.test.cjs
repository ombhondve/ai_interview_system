const { endInterview } = require("../interview.session.answers.service.js");
const persistence = require("../interview.analysis.persistence.js");
const AiInterview = require("../interview.model.js").default;

describe("RecruitAI Interview Bot Upgrades - Backend persistence & session tests", () => {
  let mockDoc;

  beforeEach(() => {
    mockDoc = {
      _id: "507f1f77bcf86cd799439011",
      candidateId: "507f1f77bcf86cd799439012",
      status: "IN_PROGRESS",
      transcript: [],
      save: jest.fn().mockResolvedValue(true),
    };

    jest.spyOn(AiInterview, "findById").mockImplementation(async (id) => {
      if (String(id) === String(mockDoc._id)) return mockDoc;
      return null;
    });

    jest.spyOn(persistence, "analyzeAndPersist").mockResolvedValue({
      ...mockDoc,
      status: "ANALYZED",
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("aiInterviewSchema contains completionReason field definition", () => {
    const paths = AiInterview.schema.paths;
    expect(paths.completionReason).toBeDefined();
    expect(paths.completionReason.instance).toBe("String");
  });

  test("endInterview persists completionReason from options.reason", async () => {
    const result = await endInterview(mockDoc._id, mockDoc.candidateId, {
      reason: "COMPLETED_NORMAL",
      waitForAnalysis: false,
    });

    expect(result.status).toBe("COMPLETING");
    expect(result.completionReason).toBe("COMPLETED_NORMAL");
    expect(mockDoc.save).toHaveBeenCalled();
  });

  test("endInterview handles CANDIDATE_DISCONNECTED completionReason", async () => {
    const result = await endInterview(mockDoc._id, mockDoc.candidateId, {
      reason: "CANDIDATE_DISCONNECTED",
      waitForAnalysis: false,
    });

    expect(result.status).toBe("COMPLETING");
    expect(result.completionReason).toBe("CANDIDATE_DISCONNECTED");
    expect(mockDoc.save).toHaveBeenCalled();
  });

  test("endInterview handles SCHEDULED_DURATION_REACHED completionReason", async () => {
    const result = await endInterview(mockDoc._id, mockDoc.candidateId, {
      reason: "SCHEDULED_DURATION_REACHED",
      waitForAnalysis: false,
    });

    expect(result.status).toBe("COMPLETING");
    expect(result.completionReason).toBe("SCHEDULED_DURATION_REACHED");
    expect(mockDoc.save).toHaveBeenCalled();
  });
});
