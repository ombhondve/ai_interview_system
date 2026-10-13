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

  test("GET /:interviewId rejects access when candidateId does not match requesting candidate (403)", async () => {
    const express = require("express");
    const request = require("supertest");
    const routes = require("../interview.routes.js").default;

    const app = express();
    app.use(express.json());
    // Attach middleware injecting requesting candidate "507f1f77bcf86cd799439099"
    app.use((req, res, next) => {
      req.candidate = { _id: "507f1f77bcf86cd799439099", projectSubmission: { aiVerificationStatus: "verified" } };
      next();
    });
    app.use("/api/ai-interviews", routes);

    // Mock interview belonging to candidate "507f1f77bcf86cd799439012"
    AiInterview.findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      candidateId: "507f1f77bcf86cd799439012",
      status: "IN_PROGRESS",
    });

    const res = await request(app).get("/api/ai-interviews/507f1f77bcf86cd799439011");
    expect(res.status).toBe(403);
    expect(res.body.message).toContain("You cannot access this interview");
  });

  test("GET /:interviewId/transcript rejects student callers without admin credentials (401)", async () => {
    const express = require("express");
    const request = require("supertest");
    const routes = require("../interview.routes.js").default;

    const app = express();
    app.use(express.json());
    app.use("/api/ai-interviews", routes);

    const res = await request(app).get("/api/ai-interviews/507f1f77bcf86cd799439011/transcript");
    expect(res.status).toBe(401);
  });

  test("GET /:interviewId/transcript succeeds for authorized admin role", async () => {
    const express = require("express");
    const request = require("supertest");
    const jwt = require("jsonwebtoken");
    const routes = require("../interview.routes.js").default;

    const secret = "test-secret";
    process.env.JWT_SECRET = secret;
    // Using a non-ObjectId adminId (e.g., system admin) allows requireAuth without triggering unmocked DB query
    const token = jwt.sign({ adminId: "admin-root", role: "superadmin" }, secret);

    const app = express();
    app.use(express.json());
    app.use("/api/ai-interviews", routes);

    AiInterview.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        transcript: [{ speaker: "AI", text: "Hello" }],
        status: "COMPLETED",
      }),
    });

    const res = await request(app)
      .get("/api/ai-interviews/507f1f77bcf86cd799439011/transcript")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transcript.length).toBe(1);
  });

  test("requireVerifiedSession security: cannot bypass verification when NODE_ENV !== 'test'", async () => {
    const { requireVerifiedSession } = require("../../../middleware/requireVerifiedSession.js");
    const req = {
      candidate: { _id: "malicious-injected-id" },
      headers: {},
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      await requireVerifiedSession(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("Authentication required") })
      );
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });
});

