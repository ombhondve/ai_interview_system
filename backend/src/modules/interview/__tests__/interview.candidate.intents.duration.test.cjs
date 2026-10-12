const answerService = require("../interview.session.answers.service.js");
const { classifyCandidateIntent, classifyClosingIntent, submitAnswer } = answerService;
const AiInterview = require("../interview.model.js").default;
const Candidate = require("../../candidate/candidate.model.js").default;
const InterviewBooking = require("../../scheduling/interviewBooking.model.js").default;
const contextService = require("../interview.context.service.js");

describe("Candidate Intent Handling, Closing Loop Guard, and Duration Enforcement", () => {
  describe("1. Utterance Intent Classification", () => {
    test("Classifies 'Is my voice audible?' as AUDIO_CHECK", () => {
      const res = classifyCandidateIntent("Is my voice audible?");
      expect(res.intent).toBe("AUDIO_CHECK");
    });

    test("Classifies 'Can you hear me?' as AUDIO_CHECK", () => {
      const res = classifyCandidateIntent("Can you hear me clearly?");
      expect(res.intent).toBe("AUDIO_CHECK");
    });

    test("Classifies 'Could you repeat the question?' as REPEAT_REQUEST", () => {
      const res = classifyCandidateIntent("Could you repeat the question please?");
      expect(res.intent).toBe("REPEAT_REQUEST");
    });

    test("Classifies 'I don't understand the question. Can you explain it?' as EXPLAIN_REQUEST", () => {
      const res = classifyCandidateIntent("I don't understand what cache invalidation means. Can you explain it?");
      expect(res.intent).toBe("EXPLAIN_REQUEST");
    });

    test("Classifies substantive technical answer as VALID_ANSWER", () => {
      const res = classifyCandidateIntent("I implemented authentication using JWT tokens and stored password hashes with bcrypt in MongoDB.");
      expect(res.intent).toBe("VALID_ANSWER");
    });

    test("Classifies candidate asking a role/company question as CANDIDATE_QUESTION", () => {
      const res = classifyCandidateIntent("What technologies does your engineering team use in production?");
      expect(res.intent).toBe("CANDIDATE_QUESTION");
    });

    test("Classifies 'I don't have any more questions' as NO_MORE_QUESTIONS", () => {
      const res = classifyCandidateIntent("I don't have any more questions. Thank you!");
      expect(res.intent).toBe("NO_MORE_QUESTIONS");
    });

    test("Classifies 'I want to end the interview' as END_INTERVIEW_REQUEST", () => {
      const res = classifyCandidateIntent("I want to end the interview now please.");
      expect(res.intent).toBe("END_INTERVIEW_REQUEST");
    });

    test("Classifies very short response as SHORT_ANSWER", () => {
      const res = classifyCandidateIntent("Redis caching");
      expect(res.intent).toBe("SHORT_ANSWER");
    });
  });

  describe("2. Audio Check & Candidate Question Handling in submitAnswer", () => {
    let mockSession;

    beforeEach(() => {
      mockSession = {
        _id: "int-test-1",
        candidateId: "cand-test-1",
        projectId: "proj-test-1",
        bookingId: "book-test-1",
        status: "IN_PROGRESS",
        phase: "QUESTIONING",
        currentQuestionIndex: 2,
        durationMinutes: 30,
        startedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes in
        questions: [
          { questionId: "0", category: "PRECHECK", question: "Can you hear me clearly?" },
          { questionId: "1", category: "INTRODUCTION", question: "Please introduce yourself." },
          { questionId: "2", category: "IMPLEMENTATION", question: "How did you design the database schema for your project?" },
        ],
        transcript: [
          { sequence: 0, speaker: "AI", text: "How did you design the database schema for your project?", questionId: "2", category: "IMPLEMENTATION", section: "QUESTIONING" },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(AiInterview, "findById").mockImplementation(async () => mockSession);
      jest.spyOn(Candidate, "findById").mockImplementation(async () => ({
        _id: "cand-test-1",
        projectSubmissionStatus: "verified",
        projectSubmission: { aiVerificationStatus: "verified" },
      }));
      jest.spyOn(InterviewBooking, "findById").mockImplementation(async () => ({
        _id: "book-test-1",
        status: "scheduled",
        startAt: new Date(Date.now() - 5 * 60 * 1000),
        endAt: new Date(Date.now() + 25 * 60 * 1000),
        durationMinutes: 30,
      }));
      jest.spyOn(contextService, "loadInterviewContext").mockImplementation(async () => ({
        candidate: { name: "Alex Candidate", role: "Full Stack Engineer" },
        project: { title: "E-Commerce Microservices" },
      }));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test("Audio check during active technical question does NOT advance question index, does NOT move to closing, and confirms audio", async () => {
      const res = await submitAnswer("int-test-1", "cand-test-1", "Is my voice audible?");

      expect(res.action).toBe("AUDIO_CHECK");
      expect(res.closing).toBe(false);
      expect(res.phase).toBe("QUESTIONING");
      // Current question index must NOT have advanced
      expect(mockSession.currentQuestionIndex).toBe(2);
      expect(res.nextQuestion.question).toContain("Yes, I can hear you clearly");
      expect(res.nextQuestion.question).toContain("How did you design the database schema for your project?");
      // Question count must not have added a new technical question
      expect(mockSession.questions).toHaveLength(3);
    });

    test("Candidate asks a question about the company during active questioning: AI answers it, resumes question, and does NOT enter closing", async () => {
      const res = await submitAnswer("int-test-1", "cand-test-1", "What technologies does the company primarily use in production?");

      expect(res.action).toBe("CANDIDATE_QUESTION");
      expect(res.closing).toBe(false);
      expect(res.phase).toBe("QUESTIONING");
      expect(mockSession.currentQuestionIndex).toBe(2);
      expect(res.nextQuestion.question).toContain("How did you design the database schema for your project?");
      expect(mockSession.questions).toHaveLength(3);
    });

    test("Repeat request does not advance question index", async () => {
      const res = await submitAnswer("int-test-1", "cand-test-1", "Could you please repeat the question?");

      expect(res.action).toBe("REPEAT");
      expect(res.closing).toBe(false);
      expect(mockSession.currentQuestionIndex).toBe(2);
      expect(res.nextQuestion.question).toContain("Let me repeat");
    });

    test("Candidate requests to end the interview early: concludes gracefully with explicit completion reason", async () => {
      const res = await submitAnswer("int-test-1", "cand-test-1", "I would like to end the interview here.");

      expect(res.action).toBe("CLOSING");
      expect(res.closing).toBe(true);
      expect(res.phase).toBe("CLOSING");
      expect(mockSession.completionReason).toBe("CANDIDATE_REQUESTED_EARLY_TERMINATION");
    });
  });

  describe("3. Regression Test: Closing Sequence and Loop Prevention", () => {
    let mockSession;

    beforeEach(() => {
      mockSession = {
        _id: "int-closing-1",
        candidateId: "cand-closing-1",
        projectId: "proj-closing-1",
        bookingId: "book-closing-1",
        status: "IN_PROGRESS",
        phase: "CLOSING",
        currentQuestionIndex: 5,
        durationMinutes: 30,
        startedAt: new Date(Date.now() - 27 * 60 * 1000), // 27 minutes in (closing window)
        questions: [
          { questionId: "0", category: "PRECHECK", question: "Can you hear me clearly?" },
          { questionId: "1", category: "INTRODUCTION", question: "Introduce yourself." },
          { questionId: "2", category: "PROJECT_CONFIRMATION", question: "Confirm project." },
          { questionId: "3", category: "PROJECT_UNDERSTANDING", question: "Project overview." },
          { questionId: "4", category: "IMPLEMENTATION", question: "Technical details." },
          { questionId: "5", category: "CLOSING", question: "Do you have any questions for me before we finish?" },
        ],
        transcript: [
          { sequence: 0, speaker: "AI", text: "Do you have any questions for me before we finish?", questionId: "5", category: "CLOSING", section: "CLOSING" },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(AiInterview, "findById").mockImplementation(async () => mockSession);
      jest.spyOn(Candidate, "findById").mockImplementation(async () => ({
        _id: "cand-closing-1",
        projectSubmissionStatus: "verified",
        projectSubmission: { aiVerificationStatus: "verified" },
      }));
      jest.spyOn(InterviewBooking, "findById").mockImplementation(async () => ({
        _id: "book-closing-1",
        status: "scheduled",
        startAt: new Date(Date.now() - 27 * 60 * 1000),
        endAt: new Date(Date.now() + 3 * 60 * 1000),
        durationMinutes: 30,
      }));
      jest.spyOn(contextService, "loadInterviewContext").mockImplementation(async () => ({
        candidate: { name: "Sam Candidate", role: "Backend Engineer" },
        project: { title: "Distributed Task Queue" },
      }));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test("Audio check during CLOSING confirms audio and does NOT conclude interview prematurely", async () => {
      const res = await submitAnswer("int-closing-1", "cand-closing-1", "Is my voice audible?", { closing: true });

      expect(res.action).toBe("FOLLOW_UP");
      expect(res.closing).toBe(false);
      expect(res.phase).toBe("CLOSING");
      expect(res.nextQuestion.question).toContain("Yes, I can hear you clearly");
      expect(res.nextQuestion.question).toContain("Do you have any questions");
    });

    test("Candidate asks multiple substantive questions in closing, each is answered, and interview closes when candidate says no more questions", async () => {
      // Turn 1: Candidate asks first question
      const res1 = await submitAnswer(
        "int-closing-1",
        "cand-closing-1",
        "What does the engineering onboarding process look like?",
        { closing: true }
      );
      expect(res1.action).toBe("FOLLOW_UP");
      expect(res1.closing).toBe(false);
      expect(res1.nextQuestion.question).toBeDefined();

      // Turn 2: Candidate asks second question
      const res2 = await submitAnswer(
        "int-closing-1",
        "cand-closing-1",
        "How large is the engineering team working on this project?",
        { closing: true }
      );
      expect(res2.action).toBe("FOLLOW_UP");
      expect(res2.closing).toBe(false);
      expect(res2.nextQuestion.question).toBeDefined();

      // Turn 3: Candidate indicates no more questions
      const res3 = await submitAnswer(
        "int-closing-1",
        "cand-closing-1",
        "No, that was all from my side. Thank you!",
        { closing: true }
      );
      expect(res3.action).toBe("CLOSING");
      expect(res3.closing).toBe(true);
      expect(res3.nextQuestion.question).toContain("That concludes the interview");
    });
  });

  describe("4. Duration Enforcement (30-Minute Interview Does Not End at 10 Minutes)", () => {
    let mockSession;

    beforeEach(() => {
      mockSession = {
        _id: "int-dur-1",
        candidateId: "cand-dur-1",
        projectId: "proj-dur-1",
        bookingId: "book-dur-1",
        status: "IN_PROGRESS",
        phase: "QUESTIONING",
        currentQuestionIndex: 6,
        durationMinutes: 30,
        startedAt: new Date(Date.now() - 10 * 60 * 1000), // Only 10 minutes elapsed in a 30-min interview!
        candidateStrengths: ["DATABASE", "API"],
        candidateWeaknesses: [],
        knowledgeGaps: [],
        technicalAreas: ["DATABASE", "API"],
        questions: [
          { questionId: "0", category: "PRECHECK", question: "Audio test" },
          { questionId: "1", category: "INTRODUCTION", question: "Intro" },
          { questionId: "2", category: "PROJECT_CONFIRMATION", question: "Project" },
          { questionId: "3", category: "PROJECT_UNDERSTANDING", question: "Overview" },
          { questionId: "4", category: "DATABASE", question: "How did you design DB?" },
          { questionId: "5", category: "API", question: "How do APIs work?" },
          { questionId: "6", category: "AUTHENTICATION", question: "How did you handle auth?" },
        ],
        transcript: [
          { sequence: 0, speaker: "AI", text: "How did you handle auth?", questionId: "6", category: "AUTHENTICATION", section: "QUESTIONING" },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(AiInterview, "findById").mockImplementation(async () => mockSession);
      jest.spyOn(Candidate, "findById").mockImplementation(async () => ({
        _id: "cand-dur-1",
        projectSubmissionStatus: "verified",
        projectSubmission: { aiVerificationStatus: "verified" },
      }));
      jest.spyOn(InterviewBooking, "findById").mockImplementation(async () => ({
        _id: "book-dur-1",
        status: "scheduled",
        startAt: new Date(Date.now() - 10 * 60 * 1000),
        endAt: new Date(Date.now() + 20 * 60 * 1000),
        durationMinutes: 30,
      }));
      jest.spyOn(contextService, "loadInterviewContext").mockImplementation(async () => ({
        candidate: { name: "Jordan Dev", role: "Full Stack Engineer" },
        project: { title: "High Throughput Web App" },
      }));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test("At 10 minutes of a 30-minute interview, answer submission does NOT transition to CLOSING phase even after 6+ questions", async () => {
      const res = await submitAnswer(
        "int-dur-1",
        "cand-dur-1",
        "I implemented authentication with bcrypt for hashing passwords and signed JWTs with expiration for stateless session management."
      );

      // Phase must NOT be CLOSING at 10 minutes of a 30-minute interview
      expect(res.phase).not.toBe("CLOSING");
      expect(res.closing).toBe(false);
      expect(res.nextQuestion.category).not.toBe("CLOSING");
      expect(mockSession.phase).not.toBe("CLOSING");
    });

    test("When elapsed time reaches closing window (e.g. 27 minutes of 30), interview transitions to CLOSING phase", async () => {
      // Simulate elapsed time at 27 minutes
      mockSession.startedAt = new Date(Date.now() - 27 * 60 * 1000);

      const res = await submitAnswer(
        "int-dur-1",
        "cand-dur-1",
        "We used Docker containers deployed on ECS with CloudWatch alarms for monitoring."
      );

      expect(res.phase).toBe("CLOSING");
      expect(mockSession.phase).toBe("CLOSING");
      expect(res.nextQuestion.category).toBe("CLOSING");
    });
  });
});
