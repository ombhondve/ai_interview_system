const { describe, test, expect, beforeEach, afterEach } = require("@jest/globals");
const AiInterview = require("../interview.model.js").default;
const Candidate = require("../../candidate/candidate.model.js").default;
const InterviewBooking = require("../../scheduling/interviewBooking.model.js").default;
const contextService = require("../interview.context.service.js");
const analysisPersistence = require("../interview.analysis.persistence.js");
const answerService = require("../interview.session.answers.service.js");
const { submitAnswer, endInterview, evaluateEarlyCompletionEligibility, classifyCandidateIntent } = answerService;

describe("RecruitAI 15-Minute Engine, Authoritative Timer, and Early Completion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("1. Authoritative Timer & 15-Minute Duration", () => {
    let mockSession;

    beforeEach(() => {
      mockSession = {
        _id: "int-15m-1",
        candidateId: "cand-15m-1",
        projectId: "proj-15m-1",
        bookingId: "book-15m-1",
        status: "IN_PROGRESS",
        phase: "QUESTIONING",
        currentQuestionIndex: 5,
        durationMinutes: 15,
        startedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes elapsed
        scheduledAt: new Date(Date.now() - 45 * 60 * 1000), // Scheduled 45 mins ago! Must NOT be used!
        createdAt: new Date(Date.now() - 60 * 60 * 1000), // Created 60 mins ago! Must NOT be used!
        candidateStrengths: ["ARCHITECTURE"],
        candidateWeaknesses: [],
        knowledgeGaps: [],
        technicalAreas: ["ARCHITECTURE"],
        questions: [
          { questionId: "0", category: "PRECHECK", question: "Audio test" },
          { questionId: "1", category: "INTRODUCTION", question: "Intro" },
          { questionId: "2", category: "PROJECT_CONFIRMATION", question: "Project" },
          { questionId: "3", category: "ARCHITECTURE", question: "System design?" },
          { questionId: "4", category: "DATABASE", question: "Database choice?" },
          { questionId: "5", category: "PERFORMANCE", question: "How did you optimize queries?" },
        ],
        transcript: [
          { sequence: 0, speaker: "AI", text: "How did you optimize queries?", questionId: "5", category: "PERFORMANCE", section: "QUESTIONING" },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(AiInterview, "findById").mockImplementation(async () => mockSession);
      jest.spyOn(Candidate, "findById").mockImplementation(async () => ({
        _id: "cand-15m-1",
        projectSubmissionStatus: "verified",
        projectSubmission: { aiVerificationStatus: "verified" },
      }));
      jest.spyOn(InterviewBooking, "findById").mockImplementation(async () => ({
        _id: "book-15m-1",
        status: "scheduled",
        startAt: new Date(Date.now() - 5 * 60 * 1000),
        durationMinutes: 15,
      }));
      jest.spyOn(contextService, "loadInterviewContext").mockImplementation(async () => ({
        candidate: { name: "Alex Test", role: "Backend Engineer" },
        project: { title: "E-Commerce Microservices" },
      }));
    });

    test("At 5 minutes of a 15-minute interview, answer submission stays in technical QUESTIONING even if scheduledAt was 45 minutes ago", async () => {
      const res = await submitAnswer(
        "int-15m-1",
        "cand-15m-1",
        "I added Redis caching with a TTL of 300 seconds and indexed the foreign keys in PostgreSQL."
      );

      // Must NOT be in closing because actual startedAt was only 5 minutes ago!
      expect(res.phase).not.toBe("CLOSING");
      expect(res.closing).toBe(false);
      expect(res.nextQuestion.category).not.toBe("CLOSING");
      expect(mockSession.phase).not.toBe("CLOSING");
    });

    test("Missing actual start timestamp defaults elapsed time to 0 and does not trigger false early close", async () => {
      mockSession.startedAt = null;
      mockSession.candidateJoinedAt = null;
      // scheduledAt is 2 hours in the past
      mockSession.scheduledAt = new Date(Date.now() - 120 * 60 * 1000);

      const res = await submitAnswer(
        "int-15m-1",
        "cand-15m-1",
        "We used connection pooling with pgBouncer to avoid exhausting database connections."
      );

      // Safe fallback: elapsed time is treated as 0, not 120 minutes!
      expect(res.phase).not.toBe("CLOSING");
      expect(res.closing).toBe(false);
    });

    test("When actual elapsed time reaches closing threshold for 15m interview (e.g. 13.5 minutes), transitions to CLOSING", async () => {
      // 13.5 minutes elapsed out of 15 minutes
      mockSession.startedAt = new Date(Date.now() - 13.5 * 60 * 1000);

      const res = await submitAnswer(
        "int-15m-1",
        "cand-15m-1",
        "We configured Prometheus metrics and Grafana dashboards for monitoring request latencies."
      );

      expect(res.phase).toBe("CLOSING");
      expect(mockSession.phase).toBe("CLOSING");
      expect(res.nextQuestion.category).toBe("CLOSING");
    });
  });

  describe("2. Performance-Based Early Completion Evaluation", () => {
    test("Candidate with fewer than minimum technical questions (<8) is NOT eligible for early completion", () => {
      const doc = {
        questions: [
          { category: "PRECHECK" },
          { category: "INTRODUCTION" },
          { category: "PROJECT_CONFIRMATION" },
          { category: "ARCHITECTURE" },
          { category: "DATABASE" },
          { category: "SECURITY" },
        ],
        transcript: [
          { speaker: "CANDIDATE", text: "Very detailed architecture response with clear design choices.", answerQuality: "POTENTIALLY_DETAILED" },
          { speaker: "CANDIDATE", text: "Very detailed database response with indexing rationale.", answerQuality: "POTENTIALLY_DETAILED" },
          { speaker: "CANDIDATE", text: "Very detailed security response with JWT implementation.", answerQuality: "POTENTIALLY_DETAILED" },
        ],
        candidateStrengths: ["ARCHITECTURE", "DATABASE", "SECURITY"],
      };

      const result = evaluateEarlyCompletionEligibility(doc);
      expect(result.eligible).toBe(false);
      expect(result.completedTechnicalQuestions).toBe(3);
      expect(result.reason).toContain("Minimum question threshold not reached");
    });

    test("Candidate with >=8 technical questions across >=4 categories with proficient answers qualifies for early completion", () => {
      const doc = {
        questions: [
          { category: "PRECHECK" },
          { category: "INTRODUCTION" },
          { category: "PROJECT_CONFIRMATION" },
          { category: "ARCHITECTURE" },
          { category: "DATABASE" },
          { category: "AUTHENTICATION" },
          { category: "CACHING" },
          { category: "PERFORMANCE" },
          { category: "TESTING" },
          { category: "DEPLOYMENT" },
          { category: "MONITORING" },
        ],
        transcript: [
          { speaker: "CANDIDATE", text: "I used an event-driven architecture with RabbitMQ because...", answerQuality: "POTENTIALLY_DETAILED" },
          { speaker: "CANDIDATE", text: "I designed third normal form relational schema with composite indexes...", answerQuality: "POTENTIALLY_DETAILED" },
          { speaker: "CANDIDATE", text: "I implemented stateless JWT authentication with bcrypt password hashing...", answerQuality: "POTENTIALLY_DETAILED" },
          { speaker: "CANDIDATE", text: "We used Redis cache-aside pattern to reduce database load by 60%...", answerQuality: "POTENTIALLY_DETAILED" },
          { speaker: "CANDIDATE", text: "I optimized N+1 queries using eager loading and pagination...", answerQuality: "POTENTIALLY_DETAILED" },
          { speaker: "CANDIDATE", text: "We wrote unit tests in Jest with 85% branch coverage...", answerQuality: "POTENTIALLY_DETAILED" },
        ],
        candidateStrengths: ["ARCHITECTURE", "DATABASE", "AUTHENTICATION", "CACHING"],
      };

      const result = evaluateEarlyCompletionEligibility(doc);
      expect(result.eligible).toBe(true);
      expect(result.reason).toBe("SUFFICIENT_COMPETENCY_DEMONSTRATED");
      expect(result.completedTechnicalQuestions).toBe(8);
      expect(result.coveredSkillsCount).toBe(8);
    });

    test("Weak candidate is NOT terminated prematurely; additional probing continues", () => {
      const doc = {
        questions: [
          { category: "PRECHECK" },
          { category: "INTRODUCTION" },
          { category: "PROJECT_CONFIRMATION" },
          { category: "ARCHITECTURE" },
          { category: "DATABASE" },
          { category: "AUTHENTICATION" },
          { category: "CACHING" },
        ],
        transcript: [
          { speaker: "CANDIDATE", text: "I don't know.", answerQuality: "WEAK" },
          { speaker: "CANDIDATE", text: "Not sure about that.", answerQuality: "WEAK" },
          { speaker: "CANDIDATE", text: "No idea.", answerQuality: "WEAK" },
        ],
        candidateStrengths: [],
      };

      const result = evaluateEarlyCompletionEligibility(doc);
      expect(result.eligible).toBe(false);
    });
  });

  describe("3. Candidate Intent & Conversational Integrity", () => {
    test("Classifies CAMERA_CHECK intent accurately without score penalty", () => {
      const intent1 = classifyCandidateIntent("Can you see me clearly?");
      expect(intent1.intent).toBe("CAMERA_CHECK");

      const intent2 = classifyCandidateIntent("Is my video working properly?");
      expect(intent2.intent).toBe("CAMERA_CHECK");

      const intent3 = classifyCandidateIntent("Am I visible on the camera?");
      expect(intent3.intent).toBe("CAMERA_CHECK");
    });

    test("CAMERA_CHECK in active interview confirms video and does NOT advance question index", async () => {
      const mockSession = {
        _id: "int-cam-1",
        candidateId: "cand-cam-1",
        projectId: "proj-cam-1",
        bookingId: "book-cam-1",
        status: "IN_PROGRESS",
        phase: "QUESTIONING",
        currentQuestionIndex: 3,
        durationMinutes: 15,
        startedAt: new Date(Date.now() - 4 * 60 * 1000),
        candidateStrengths: [],
        candidateWeaknesses: [],
        knowledgeGaps: [],
        technicalAreas: [],
        questions: [
          { questionId: "0", category: "PRECHECK", question: "Audio test" },
          { questionId: "1", category: "INTRODUCTION", question: "Intro" },
          { questionId: "2", category: "PROJECT_CONFIRMATION", question: "Project" },
          { questionId: "3", category: "DATABASE", question: "How did you design the schema?" },
        ],
        transcript: [
          { sequence: 0, speaker: "AI", text: "How did you design the schema?", questionId: "3" },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(AiInterview, "findById").mockImplementation(async () => mockSession);
      jest.spyOn(Candidate, "findById").mockImplementation(async () => ({
        _id: "cand-cam-1",
        projectSubmissionStatus: "verified",
        projectSubmission: { aiVerificationStatus: "verified" },
      }));
      jest.spyOn(contextService, "loadInterviewContext").mockImplementation(async () => ({
        candidate: { name: "Test Candidate" },
        project: { title: "Test Project" },
      }));

      const res = await submitAnswer("int-cam-1", "cand-cam-1", "Can you see me? Is my video on?");
      expect(res.action).toBe("CAMERA_CHECK");
      expect(res.acknowledgment).toBe("Yes, I can see you clearly.");
      expect(res.nextQuestion.question).toContain("Yes, I can see you clearly");
      expect(res.phase).toBe("QUESTIONING");
      // Current question index must remain at 3
      expect(mockSession.currentQuestionIndex).toBe(3);
    });

    test("Candidate requesting early termination concludes interview cleanly", async () => {
      const mockSession = {
        _id: "int-end-1",
        candidateId: "cand-end-1",
        projectId: "proj-end-1",
        bookingId: "book-end-1",
        status: "IN_PROGRESS",
        phase: "QUESTIONING",
        currentQuestionIndex: 3,
        durationMinutes: 15,
        startedAt: new Date(Date.now() - 6 * 60 * 1000),
        candidateStrengths: [],
        candidateWeaknesses: [],
        knowledgeGaps: [],
        technicalAreas: [],
        questions: [
          { questionId: "0", category: "PRECHECK", question: "Audio test" },
          { questionId: "1", category: "INTRODUCTION", question: "Intro" },
          { questionId: "2", category: "PROJECT_CONFIRMATION", question: "Project" },
          { questionId: "3", category: "DATABASE", question: "How did you design the schema?" },
        ],
        transcript: [
          { sequence: 0, speaker: "AI", text: "How did you design the schema?", questionId: "3" },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(AiInterview, "findById").mockImplementation(async () => mockSession);
      jest.spyOn(Candidate, "findById").mockImplementation(async () => ({
        _id: "cand-end-1",
        projectSubmissionStatus: "verified",
        projectSubmission: { aiVerificationStatus: "verified" },
      }));
      jest.spyOn(contextService, "loadInterviewContext").mockImplementation(async () => ({
        candidate: { name: "Test Candidate" },
        project: { title: "Test Project" },
      }));

      const res = await submitAnswer("int-end-1", "cand-end-1", "I would like to stop the interview here please.");
      expect(res.action).toBe("CLOSING");
      expect(res.closing).toBe(true);
      expect(mockSession.phase).toBe("CLOSING");
      expect(mockSession.completionReason).toBe("CANDIDATE_REQUESTED_EARLY_TERMINATION");
      expect(res.nextQuestion.question).toContain("Understood. We will conclude the interview here");
    });
  });

  describe("4. Idempotency & Termination Reason Persistence", () => {
    test("endInterview records timing metrics and completion reason idempotently", async () => {
      const mockSession = {
        _id: "507f1f77bcf86cd799439011",
        candidateId: "507f1f77bcf86cd799439012",
        status: "IN_PROGRESS",
        startedAt: new Date(Date.now() - 14 * 60 * 1000),
        transcript: [
          { sequence: 0, speaker: "AI", text: "Hello" },
          { sequence: 1, speaker: "CANDIDATE", text: "Hi" },
        ],
        earlyCompletion: {
          isEligible: true,
          reason: "SUFFICIENT_COMPETENCY_DEMONSTRATED",
        },
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(AiInterview, "findById").mockImplementation(async () => mockSession);
      jest.spyOn(analysisPersistence, "analyzeAndPersist").mockResolvedValue(mockSession);

      const doc = await endInterview("507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012");
      expect(["COMPLETING", "ANALYSIS_PENDING"]).toContain(doc.status);
      expect(doc.completionReason).toBe("SUFFICIENT_COMPETENCY_DEMONSTRATED");
      expect(doc.timingMetrics.botDisconnectAt).toBeDefined();
      expect(doc.timingMetrics.totalTurnCount).toBe(2);

      // Repeated call returns existing doc idempotently
      mockSession.status = "COMPLETED";
      const doc2 = await endInterview("507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012");
      expect(doc2.status).toBe("COMPLETED");
    });
  });

  describe("5. Regression: 25-Minute and 30-Minute Sessions Capped at 15-Minute Policy", () => {
    test("A legacy session saved in DB with durationMinutes: 25 is strictly capped at 15 minutes", async () => {
      const mockSession25 = {
        _id: "int-25m-1",
        candidateId: "cand-25m-1",
        projectId: "proj-25m-1",
        bookingId: "book-25m-1",
        status: "IN_PROGRESS",
        phase: "QUESTIONING",
        currentQuestionIndex: 5,
        durationMinutes: 25, // Legacy 25 minutes saved in database
        startedAt: new Date(Date.now() - 14 * 60 * 1000), // 14 mins elapsed!
        scheduledAt: new Date(Date.now() - 30 * 60 * 1000),
        candidateStrengths: ["ARCHITECTURE"],
        candidateWeaknesses: [],
        knowledgeGaps: [],
        technicalAreas: ["ARCHITECTURE"],
        questions: [
          { questionId: "0", category: "PRECHECK", question: "Audio test" },
          { questionId: "1", category: "ARCHITECTURE", question: "System design?" },
        ],
        transcript: [
          { sequence: 0, speaker: "AI", text: "System design?", questionId: "1", category: "ARCHITECTURE", section: "QUESTIONING" },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(AiInterview, "findById").mockImplementation(async () => mockSession25);
      jest.spyOn(Candidate, "findById").mockImplementation(async () => ({
        _id: "cand-25m-1",
        projectSubmissionStatus: "verified",
        projectSubmission: { aiVerificationStatus: "verified" },
      }));
      jest.spyOn(contextService, "loadInterviewContext").mockImplementation(async () => ({
        candidate: { name: "Test Candidate" },
        project: { title: "Test Project" },
      }));

      // At 14 minutes elapsed with 15m effective cap, closing window (15 - 1.8 = 13.2m) is active!
      // If it erroneously used 25m, 14m would NOT trigger closing (25 - 3 = 22m).
      const res = await submitAnswer("int-25m-1", "cand-25m-1", "We used Kafka for distributed messaging.");
      expect(mockSession25.phase).toBe("CLOSING");
      expect(res.phase).toBe("CLOSING");
    });
  });

  describe("6. Regression: Candidate Answer Text Cannot Leak Into Generated Questions", () => {
    const { sanitizeAiQuestion } = require("../interview.question.service.js");

    test("sanitizeAiQuestion rejects AI questions that echo previous candidate answers", () => {
      const candidatePreviousAnswer = "We keep the JWT secret in an env variable and verify the signature on each request.";
      const candidateAnswers = [candidatePreviousAnswer];

      // Exact candidate answer regurgitation from log
      const leakedOutput = {
        category: "AUTHENTICATION",
        question: "We keep the JWT secret in an env variable and verify the signature on each request.",
        difficulty: "MEDIUM",
        reason: "Checking authentication implementation",
      };

      const result = sanitizeAiQuestion(leakedOutput, [], candidateAnswers);
      expect(result).toBeNull();
    });

    test("sanitizeAiQuestion rejects declarative answer statements masquerading as questions", () => {
      const declarativeOutput = {
        category: "AUTHENTICATION",
        question: "We keep the JWT secret in an env variable.",
        difficulty: "MEDIUM",
      };

      const result = sanitizeAiQuestion(declarativeOutput, [], []);
      expect(result).toBeNull();
    });

    test("sanitizeAiQuestion allows valid technical questions with question form", () => {
      const validOutput = {
        category: "AUTHENTICATION",
        question: "How do you protect your JWT secret in your deployment environment?",
        difficulty: "MEDIUM",
      };

      const result = sanitizeAiQuestion(validOutput, [], ["We keep the JWT secret in an env variable."]);
      expect(result).not.toBeNull();
      expect(result.question).toContain("How do you protect your JWT secret");
    });
  });

  describe("7. Regression: Repeat-Question Index Advancement and Question Count Preservation", () => {
    test("Hello? Can you repeat the question? preserves currentQuestionIndex and question count", async () => {
      const mockRepeatSession = {
        _id: "int-repeat-1",
        candidateId: "cand-repeat-1",
        projectId: "proj-repeat-1",
        bookingId: "book-repeat-1",
        status: "IN_PROGRESS",
        phase: "QUESTIONING",
        currentQuestionIndex: 3,
        durationMinutes: 15,
        startedAt: new Date(Date.now() - 4 * 60 * 1000),
        questions: [
          { questionId: "0", category: "PRECHECK", question: "Audio test" },
          { questionId: "1", category: "INTRODUCTION", question: "Intro" },
          { questionId: "2", category: "PROJECT_CONFIRMATION", question: "Project" },
          { questionId: "3", category: "AUTHENTICATION", question: "How do you securely store JWT tokens in your React application?" },
        ],
        transcript: [
          { sequence: 0, speaker: "AI", text: "How do you securely store JWT tokens in your React application?", questionId: "3", category: "AUTHENTICATION", section: "QUESTIONING" },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(AiInterview, "findById").mockImplementation(async () => mockRepeatSession);
      jest.spyOn(Candidate, "findById").mockImplementation(async () => ({
        _id: "cand-repeat-1",
        projectSubmissionStatus: "verified",
        projectSubmission: { aiVerificationStatus: "verified" },
      }));
      jest.spyOn(contextService, "loadInterviewContext").mockImplementation(async () => ({
        candidate: { name: "Test Candidate" },
        project: { title: "Test Project" },
      }));

      const initialQIndex = mockRepeatSession.currentQuestionIndex;
      const initialQuestionCount = mockRepeatSession.questions.length;

      // Candidate asks to repeat: "Hello? Can you repeat the question?"
      const res = await submitAnswer("int-repeat-1", "cand-repeat-1", "Hello? Can you repeat the question?");

      // Requirements:
      // 1. Must recognize REPEAT action
      expect(res.action).toBe("REPEAT");
      // 2. Question index must NOT advance
      expect(mockRepeatSession.currentQuestionIndex).toBe(initialQIndex);
      // 3. Question array must NOT increment
      expect(mockRepeatSession.questions.length).toBe(initialQuestionCount);
      // 4. Must replay the current question
      expect(res.nextQuestion.question).toContain("How do you securely store JWT tokens");
      // 5. Returns natural acknowledgment
      expect(res.acknowledgment).toBe("Sure.");
    });
  });
});
