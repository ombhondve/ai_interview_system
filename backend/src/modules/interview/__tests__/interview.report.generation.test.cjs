const { analyzeAndPersist } = require("../interview.analysis.persistence.js");
const { analyzeInterview, sanitizeAnalysis, fallbackAnalysis } = require("../interview.analysis.service.js");
const AiInterview = require("../interview.model.js").default;
const aiService = require("../../ai/ai.service.js");
const contextService = require("../interview.context.service.js");

describe("RecruitAI Interview Report Generation & Retry Pipeline", () => {
  let mockDoc;
  let mockContext;
  let validAnalysisOutput;

  beforeEach(() => {
    mockDoc = {
      _id: "507f1f77bcf86cd799439011",
      candidateId: "507f1f77bcf86cd799439012",
      projectId: "507f1f77bcf86cd799439013",
      bookingId: "507f1f77bcf86cd799439014",
      status: "COMPLETED",
      endedAt: new Date("2026-10-12T10:30:00Z"),
      transcript: [
        { sequence: 0, speaker: "AI", text: "Welcome. Can you describe how your backend handles concurrency?" },
        { sequence: 1, speaker: "CANDIDATE", text: "We implemented Node.js worker threads and Redis locks for mutual exclusion." },
        { sequence: 2, speaker: "AI", text: "How did you structure database indexing in MongoDB?" },
        { sequence: 3, speaker: "CANDIDATE", text: "We created compound indexes on candidateId and status to keep query times sub-5ms." },
      ],
      questions: [
        { questionId: "q1", category: "QUESTIONING", question: "How does backend handle concurrency?" },
        { questionId: "q2", category: "QUESTIONING", question: "How did you structure database indexing?" },
      ],
      analysis: null,
      analysisError: null,
      analysisAttempts: 0,
      save: jest.fn().mockImplementation(function() {
        return Promise.resolve(this);
      }),
      populate: jest.fn().mockImplementation(function() {
        return Promise.resolve(this);
      }),
    };

    mockContext = {
      candidate: {
        id: "507f1f77bcf86cd799439012",
        name: "Test Candidate",
        role: "Backend Engineer",
        skills: ["Node.js", "MongoDB", "Redis"],
      },
      project: {
        id: "507f1f77bcf86cd799439013",
        title: "Distributed Interview Platform",
      },
      verification: {
        verificationStatus: "verified",
        summary: "Repository passed requirements.",
      },
    };

    validAnalysisOutput = {
      technicalKnowledge: { score: 88, summary: "Demonstrated strong grasp of concurrency and indexing." },
      projectUnderstanding: { score: 85, summary: "Articulated architectural choices cleanly." },
      problemSolving: { score: 82, summary: "Proposed reasonable trade-offs with Redis." },
      communication: { score: 80, summary: "Concise and clear explanations." },
      projectWalkthrough: { score: 84, summary: "Detailed the actual implementation code." },
      strengths: ["Concurrency primitives", "Compound indexing"],
      areasForImprovement: ["Could elaborate on deadlocks"],
      evidence: ["Candidate cited worker threads and Redis locks"],
      overallScore: 85,
      recommendation: "STRONG",
      summary: "Candidate provided sound technical responses grounded in implementation.",
    };

    jest.spyOn(AiInterview, "findById").mockImplementation(async (id) => {
      if (String(id) === String(mockDoc._id)) return mockDoc;
      return null;
    });

    jest.spyOn(contextService, "buildInterviewContext").mockResolvedValue(mockContext);
    jest.spyOn(aiService, "generateStructuredAI").mockResolvedValue(validAnalysisOutput);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("1. Successful report generation and database persistence", async () => {
    const updated = await analyzeAndPersist(mockDoc._id);

    expect(updated.status).toBe("ANALYZED");
    expect(updated.analysis).toBeDefined();
    expect(updated.analysis.overallScore).toBe(85);
    expect(updated.analysis.recommendation).toBe("STRONG");
    expect(updated.analysisError).toBeNull();
    expect(updated.save).toHaveBeenCalled();
  });

  test("2. Rejects when interview is missing or identifier not found", async () => {
    await expect(analyzeAndPersist("000000000000000000000000")).rejects.toThrow("Interview not found");
  });

  test("3. Fails cleanly with clear explanation when transcript has insufficient candidate answers", async () => {
    // Only AI speaking, zero candidate responses
    mockDoc.transcript = [
      { sequence: 0, speaker: "AI", text: "Hello, welcome to your interview." },
    ];

    await expect(analyzeAndPersist(mockDoc._id)).rejects.toThrow(
      "Interview transcript contains insufficient candidate responses to generate an evaluation."
    );

    expect(mockDoc.status).toBe("FAILED");
    expect(mockDoc.analysisError).toBe(
      "Interview transcript contains insufficient candidate responses to generate an evaluation."
    );
    expect(mockDoc.analysis).toBeNull();
  });

  test("4. AI provider failure records real diagnostic error in analysisError and sets status to FAILED", async () => {
    jest.spyOn(aiService, "generateStructuredAI").mockRejectedValue(new Error("Groq API rate limit exceeded (429)"));

    await expect(analyzeAndPersist(mockDoc._id)).rejects.toThrow("Groq API rate limit exceeded (429)");

    expect(mockDoc.status).toBe("FAILED");
    expect(mockDoc.analysisError).toBe("Groq API rate limit exceeded (429)");
    expect(mockDoc.analysis).toBeNull();
  });

  test("5. Malformed AI provider output is rejected instead of fabricating scores", async () => {
    jest.spyOn(aiService, "generateStructuredAI").mockResolvedValue({
      brokenField: true,
      // Missing all required scores
    });

    await expect(analyzeAndPersist(mockDoc._id)).rejects.toThrow(
      "AI provider returned invalid or malformed evaluation output."
    );

    expect(mockDoc.status).toBe("FAILED");
    expect(mockDoc.analysisError).toBe("AI provider returned invalid or malformed evaluation output.");
  });

  test("6. Retry after a failed attempt succeeds and updates report", async () => {
    mockDoc.status = "FAILED";
    mockDoc.analysisError = "Previous connection error";

    const updated = await analyzeAndPersist(mockDoc._id);

    expect(updated.status).toBe("ANALYZED");
    expect(updated.analysisError).toBeNull();
    expect(updated.analysis.overallScore).toBe(85);
  });

  test("7. Preserves existing report if a subsequent retry encounters provider failure", async () => {
    // Interview already had a valid previously generated analysis
    mockDoc.status = "ANALYZED";
    mockDoc.analysis = { ...validAnalysisOutput };

    jest.spyOn(aiService, "generateStructuredAI").mockRejectedValue(new Error("Temporary network timeout"));

    await expect(analyzeAndPersist(mockDoc._id)).rejects.toThrow("Temporary network timeout");

    // Existing analysis should NOT be wiped out
    expect(mockDoc.analysis).not.toBeNull();
    expect(mockDoc.analysis.overallScore).toBe(85);
    expect(mockDoc.analysisError).toBe("Temporary network timeout");
    expect(mockDoc.status).toBe("ANALYZED");
  });

  test("8. sanitizeAnalysis returns null for completely empty or zero-score unsummarized payload", () => {
    expect(sanitizeAnalysis(null)).toBeNull();
    expect(sanitizeAnalysis({})).toBeNull();
    expect(sanitizeAnalysis({
      technicalKnowledge: { score: 0, summary: "" },
      projectUnderstanding: { score: 0, summary: "" },
      problemSolving: { score: 0, summary: "" },
      communication: { score: 0, summary: "" },
      projectWalkthrough: { score: 0, summary: "" },
      summary: "",
    })).toBeNull();
  });

  test("9. fallbackAnalysis returns clear zero-evidence structure with explicit disclaimer", () => {
    const fb = fallbackAnalysis({ transcriptLength: 2 });
    expect(fb.overallScore).toBe(0);
    expect(fb.recommendation).toBe("ADMIN_REVIEW");
    expect(fb.summary).toContain("Requires manual admin review");
  });
});
