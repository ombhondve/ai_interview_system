const { shortenForVoice, sanitizeAiQuestion } = require("../interview.question.service.js");
const sessionService = require("../interview.session.service.js");
const answerService = require("../interview.session.answers.service.js");
const AiInterview = require("../interview.model.js").default;
const Candidate = require("../../candidate/candidate.model.js").default;
const InterviewBooking = require("../../scheduling/interviewBooking.model.js").default;
const contextService = require("../interview.context.service.js");

describe("Interview Warmup and Spoken Question Flow", () => {
  describe("Spoken question length guard and rewriting", () => {
    test("accepts conversational question under 20 words directly", () => {
      const q = "How did you troubleshoot the CI/CD credential issue in your project?";
      const cleaned = shortenForVoice(q);
      const words = cleaned.split(/\s+/).filter(Boolean);
      expect(words.length).toBeLessThanOrEqual(20);
      expect(cleaned).toBe(q);
    });

    test("rewrites / shortens questions exceeding word limit into concise question", () => {
      const longQ =
        "Can you walk me through the exact steps you took to troubleshoot and resolve the CI/CD pipeline credential configuration issue you encountered, including any tools, environment variables, or secret-management approaches you used?";
      const cleaned = shortenForVoice(longQ);
      const words = cleaned.split(/\s+/).filter(Boolean);
      expect(words.length).toBeLessThanOrEqual(25);
      expect(cleaned).not.toMatch(/including/i);
      expect(cleaned.endsWith("?")).toBe(true);
    });

    test("removes multi-part 'including X, Y, Z' clause construction", () => {
      const multiPart =
        "Can you explain how you implemented authentication, including JWT handling, refresh tokens, middleware, and database storage?";
      const cleaned = shortenForVoice(multiPart);
      expect(cleaned).not.toMatch(/including/i);
      expect(cleaned.endsWith("?")).toBe(true);
      const words = cleaned.split(/\s+/).filter(Boolean);
      expect(words.length).toBeLessThanOrEqual(20);
    });

    test("sanitizeAiQuestion enforces concise spoken question under 25 words", () => {
      const raw = {
        category: "AUTHENTICATION",
        question:
          "Can you explain exactly how you implemented authentication, including JWT tokens, database lookups, and session management?",
        difficulty: "MEDIUM",
        reason: "Checking auth details",
      };
      const sanitized = sanitizeAiQuestion(raw, []);
      expect(sanitized).not.toBeNull();
      const words = sanitized.question.split(/\s+/).filter(Boolean);
      expect(words.length).toBeLessThanOrEqual(25);
      expect(sanitized.question).not.toMatch(/including/i);
    });
  });

  describe("Interview Warmup Lifecycle Flow", () => {
    let mockSession;

    beforeEach(() => {
      mockSession = {
        _id: "int-123",
        candidateId: "cand-123",
        projectId: "proj-123",
        bookingId: "book-123",
        status: "READY",
        phase: "OPENING",
        currentQuestionIndex: 0,
        questions: [],
        transcript: [],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(AiInterview, "findById").mockImplementation(async () => mockSession);
      jest.spyOn(Candidate, "findById").mockImplementation(async () => ({
        _id: "cand-123",
        projectSubmissionStatus: "verified",
        projectSubmission: { aiVerificationStatus: "verified" },
      }));
      jest.spyOn(InterviewBooking, "findById").mockImplementation(async () => ({
        _id: "book-123",
        status: "scheduled",
        startAt: new Date(Date.now() - 60000),
        endAt: new Date(Date.now() + 1800000),
      }));
      jest.spyOn(contextService, "loadInterviewContext").mockImplementation(async () => ({
        candidate: { name: "Test Candidate", role: "Software Engineer" },
        project: { title: "Test Project" },
      }));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test("Interview starts with OPENING/WARMUP greeting and audio check, not technical question", async () => {
      const started = await sessionService.startInterview("int-123", "cand-123");
      expect(started.phase).toBe("OPENING");
      expect(started.questions).toHaveLength(1);
      const firstQ = started.questions[0];
      expect(firstQ.category).toBe("INTRODUCTION");
      expect(firstQ.question).toBe("Hello, welcome to your interview. Can you hear me clearly?");
      expect(started.transcript[0].text).toBe(firstQ.question);
    });

    test("Warmup step 1: Candidate answers audio check -> AI asks short introduction", async () => {
      // Setup session after startInterview
      mockSession.status = "IN_PROGRESS";
      mockSession.phase = "OPENING";
      mockSession.questions = [
        {
          questionId: "0",
          category: "INTRODUCTION",
          question: "Hello, welcome to your interview. Can you hear me clearly?",
          difficulty: "EASY",
        },
      ];
      mockSession.transcript = [
        { speaker: "AI", text: mockSession.questions[0].question, questionId: "0" },
      ];

      const res = await answerService.submitAnswer("int-123", "cand-123", "Yes, I can hear you clearly.");
      expect(res.interview.phase).toBe("OPENING");
      expect(res.nextQuestion.category).toBe("INTRODUCTION");
      expect(res.nextQuestion.question).toBe("Great. Before we begin, could you briefly introduce yourself?");
      expect(mockSession.questions).toHaveLength(2);
    });

    test("Warmup step 2: Candidate answers introduction -> Transitions to PROJECT_WALKTHROUGH", async () => {
      mockSession.status = "IN_PROGRESS";
      mockSession.phase = "OPENING";
      mockSession.questions = [
        {
          questionId: "0",
          category: "INTRODUCTION",
          question: "Hello, welcome to your interview. Can you hear me clearly?",
        },
        {
          questionId: "1",
          category: "INTRODUCTION",
          question: "Great. Before we begin, could you briefly introduce yourself?",
        },
      ];
      mockSession.transcript = [
        { speaker: "AI", text: mockSession.questions[0].question, questionId: "0" },
        { speaker: "CANDIDATE", text: "Yes, I hear you.", questionId: "0", answerProcessed: true },
        { speaker: "AI", text: mockSession.questions[1].question, questionId: "1" },
      ];

      const res = await answerService.submitAnswer(
        "int-123",
        "cand-123",
        "Hi, I'm a full stack developer with experience in React and Node.js."
      );

      // Must have transitioned out of OPENING into PROJECT_WALKTHROUGH
      expect(res.interview.phase).toBe("PROJECT_WALKTHROUGH");
      expect(res.nextQuestion.category).toBe("PROJECT_WALKTHROUGH");
      expect(res.nextQuestion.question).toContain("Let's talk about your project");
    });

    test("Candidate says 'I don't know' -> Acknowledges gracefully and moves on with action: MOVE_ON", async () => {
      mockSession.status = "IN_PROGRESS";
      mockSession.phase = "QUESTIONING";
      mockSession.questions = [
        { questionId: "0", category: "DATABASE", question: "How did you design your database schema?" },
      ];
      mockSession.transcript = [
        { speaker: "AI", text: "How did you design your database schema?", questionId: "0" },
      ];

      const res = await answerService.submitAnswer("int-123", "cand-123", "I don't know, I haven't worked with that.");
      expect(res.action).toBe("MOVE_ON");
      expect(res.acknowledgment).toBe("No problem. Let's move on.");
      expect(res.nextQuestion).toBeDefined();
    });

    test("Candidate says 'Can you repeat the question?' -> Does not advance question, repeats with action: REPEAT", async () => {
      mockSession.status = "IN_PROGRESS";
      mockSession.phase = "QUESTIONING";
      mockSession.questions = [
        { questionId: "0", category: "AUTHENTICATION", question: "How did you implement authentication?" },
      ];
      mockSession.transcript = [
        { speaker: "AI", text: "How did you implement authentication?", questionId: "0" },
      ];

      const res = await answerService.submitAnswer("int-123", "cand-123", "Can you repeat the question please?");
      expect(res.action).toBe("REPEAT");
      expect(res.acknowledgment).toBe("No problem.");
      expect(res.nextQuestion.question).toContain("How did you implement authentication?");
      // Questions array should NOT have added a new question index
      expect(mockSession.questions).toHaveLength(1);
    });

    test("Candidate asks for time ('Give me a moment') -> Returns action: WAIT without advancing", async () => {
      mockSession.status = "IN_PROGRESS";
      mockSession.phase = "QUESTIONING";
      mockSession.questions = [
        { questionId: "0", category: "API", question: "How does your frontend interact with APIs?" },
      ];
      mockSession.transcript = [
        { speaker: "AI", text: "How does your frontend interact with APIs?", questionId: "0" },
      ];

      const res = await answerService.submitAnswer("int-123", "cand-123", "Give me a moment, let me think.");
      expect(res.action).toBe("WAIT");
      expect(res.acknowledgment).toBe("Sure, take your time.");
      expect(mockSession.questions).toHaveLength(1);
    });

    test("Candidate gives short answer -> Triggers follow-up action: FOLLOW_UP", async () => {
      mockSession.status = "IN_PROGRESS";
      mockSession.phase = "QUESTIONING";
      mockSession.questions = [
        { questionId: "0", category: "TECHNOLOGY", question: "Which technologies did you choose?" },
      ];
      mockSession.transcript = [
        { speaker: "AI", text: "Which technologies did you choose?", questionId: "0" },
      ];

      const res = await answerService.submitAnswer("int-123", "cand-123", "React and Node.");
      expect(res.action).toBe("FOLLOW_UP");
      expect(res.acknowledgment).toBeDefined();
    });

    test("Candidate uses Hindi phrase 'Mujhe nahi pata' -> Maps to DONT_KNOW and moves on", async () => {
      mockSession.status = "IN_PROGRESS";
      mockSession.phase = "QUESTIONING";
      mockSession.questions = [
        { questionId: "0", category: "AUTHENTICATION", question: "How did you implement authentication?" },
      ];
      mockSession.transcript = [
        { speaker: "AI", text: "How did you implement authentication?", questionId: "0" },
      ];

      const res = await answerService.submitAnswer("int-123", "cand-123", "Sir ye part mujhe nahi pata.");
      expect(res.action).toBe("MOVE_ON");
      expect(res.acknowledgment).toBe("No problem. Let's move on.");
    });

    test("Candidate uses Marathi phrase 'Mala exact athvat nahi, but I think JWT' -> Technical mention recognized as valid answer", async () => {
      mockSession.status = "IN_PROGRESS";
      mockSession.phase = "QUESTIONING";
      mockSession.questions = [
        { questionId: "0", category: "AUTHENTICATION", question: "How did you implement authentication?" },
      ];
      mockSession.transcript = [
        { speaker: "AI", text: "How did you implement authentication?", questionId: "0" },
      ];

      const res = await answerService.submitAnswer("int-123", "cand-123", "Mala exact athvat nahi, but I think JWT tokens.");
      expect(res.action).toBeDefined();
      // Should not be rejected as empty/unknown
      expect(["NEXT_TOPIC", "FOLLOW_UP"]).toContain(res.action);
    });

    test("Candidate gives off-topic answer -> Gently redirected back to project", async () => {
      mockSession.status = "IN_PROGRESS";
      mockSession.phase = "QUESTIONING";
      mockSession.questions = [
        { questionId: "0", category: "PROJECT_WALKTHROUGH", question: "How did you structure the backend?" },
      ];
      mockSession.transcript = [
        { speaker: "AI", text: "How did you structure the backend?", questionId: "0" },
      ];

      const res = await answerService.submitAnswer("int-123", "cand-123", "Actually during college I also worked on cricket tournament event management.");
      expect(res.action).toBe("FOLLOW_UP");
      expect(res.acknowledgment).toBe("Understood.");
      expect(res.nextQuestion.question).toContain("stay with your project");
    });
  });
});


