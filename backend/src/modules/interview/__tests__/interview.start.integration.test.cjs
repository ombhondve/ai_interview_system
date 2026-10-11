/**
 * Integration unit test for interview session start and candidate presence bootstrapping.
 */

const { recordCandidatePresence } = require("../interview.lifecycle.service.js");
const { startInterview } = require("../interview.session.service.js");
const AiInterview = require("../interview.model.js").default;
const Candidate = require("../../candidate/candidate.model.js").default;
const Project = require("../../projects/project.model.js").default;
const InterviewBooking = require("../../scheduling/interviewBooking.model.js").default;
const contextService = require("../interview.context.service.js");

const origAiFindById = AiInterview.findById;
const origCandidateFindById = Candidate.findById;
const origProjectFindById = Project?.findById;
const origBookingFindById = InterviewBooking.findById;
const origLoadContext = contextService.loadInterviewContext;

describe("Interview Start and Candidate Presence Bootstrapping", () => {
  beforeEach(() => {
    AiInterview.findById = jest.fn();
    Candidate.findById = jest.fn();
    if (Project) Project.findById = jest.fn().mockResolvedValue({ title: "Test Project" });
    InterviewBooking.findById = jest.fn();
    contextService.loadInterviewContext = jest.fn().mockResolvedValue({
      candidateName: "Test Candidate",
      projectTitle: "Test Project",
    });
  });

  afterEach(() => {
    AiInterview.findById = origAiFindById;
    Candidate.findById = origCandidateFindById;
    if (Project && origProjectFindById) Project.findById = origProjectFindById;
    InterviewBooking.findById = origBookingFindById;
    contextService.loadInterviewContext = origLoadContext;
    jest.restoreAllMocks();
  });

  test("recordCandidatePresence transitions WAITING_FOR_CANDIDATE to IN_PROGRESS and adds PRECHECK question", async () => {
    const interviewDoc = {
      _id: "507f1f77bcf86cd799439011",
      candidateId: "507f1f77bcf86cd799439012",
      bookingId: "507f1f77bcf86cd799439013",
      projectId: "507f1f77bcf86cd799439014",
      status: "WAITING_FOR_CANDIDATE",
      questions: [],
      transcript: [],
      save: jest.fn().mockResolvedValue(true),
    };

    const candidateDoc = {
      _id: "507f1f77bcf86cd799439012",
      projectSubmissionStatus: "submitted",
      interviewStatus: "scheduled",
    };

    const bookingDoc = {
      _id: "507f1f77bcf86cd799439013",
      status: "scheduled",
    };

    AiInterview.findById.mockResolvedValue(interviewDoc);
    Candidate.findById.mockResolvedValue(candidateDoc);
    InterviewBooking.findById.mockResolvedValue(bookingDoc);

    const result = await recordCandidatePresence("507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012");

    expect(result.started).toBe(true);
    expect(interviewDoc.status).toBe("IN_PROGRESS");
    expect(interviewDoc.questions.length).toBe(1);
    expect(interviewDoc.questions[0].category).toBe("PRECHECK");
    expect(interviewDoc.questions[0].question).toContain("clearly");
  });

  test("recordCandidatePresence idempotently provides initial question even on reconnect when IN_PROGRESS", async () => {
    const interviewDoc = {
      _id: "507f1f77bcf86cd799439011",
      candidateId: "507f1f77bcf86cd799439012",
      bookingId: "507f1f77bcf86cd799439013",
      status: "IN_PROGRESS",
      questions: [],
      transcript: [],
      save: jest.fn().mockResolvedValue(true),
    };

    AiInterview.findById.mockResolvedValue(interviewDoc);

    const result = await recordCandidatePresence("507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012");

    expect(result.started).toBe(true);
    expect(interviewDoc.questions.length).toBe(1);
    expect(interviewDoc.questions[0].category).toBe("PRECHECK");
  });
});
