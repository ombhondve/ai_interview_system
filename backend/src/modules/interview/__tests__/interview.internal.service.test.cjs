const { requireInternalServiceSession } = require("../interview.voice.auth.js");
const AiInterview = require("../interview.model.js").default;

const originalFindById = AiInterview.findById;
const originalSecret = process.env.RECRUITAI_INTERNAL_API_SECRET;

describe("requireInternalServiceSession unit tests", () => {
  beforeEach(() => {
    process.env.RECRUITAI_INTERNAL_API_SECRET = "test-internal-secret-12345";
  });

  afterEach(() => {
    AiInterview.findById = originalFindById;
    process.env.RECRUITAI_INTERNAL_API_SECRET = originalSecret;
    jest.restoreAllMocks();
  });

  test("rejects request when no secret header is provided", async () => {
    const req = { headers: {} };
    await expect(requireInternalServiceSession(req, "507f1f77bcf86cd799439011")).rejects.toMatchObject({
      status: 401,
      message: expect.stringMatching(/Unauthorized/i),
    });
  });

  test("rejects request when incorrect secret is provided", async () => {
    const req = { headers: { "x-internal-secret": "wrong-secret" } };
    await expect(requireInternalServiceSession(req, "507f1f77bcf86cd799439011")).rejects.toMatchObject({
      status: 401,
      message: expect.stringMatching(/Unauthorized/i),
    });
  });

  test("rejects request when server secret is missing", async () => {
    delete process.env.RECRUITAI_INTERNAL_API_SECRET;
    delete process.env.MEETING_BOT_API_SECRET;
    const req = { headers: { "x-internal-secret": "some-secret" } };
    await expect(requireInternalServiceSession(req, "507f1f77bcf86cd799439011")).rejects.toMatchObject({
      status: 500,
    });
  });

  test("rejects request when interviewId does not exist", async () => {
    AiInterview.findById = async () => null;
    const req = { headers: { "x-internal-secret": "test-internal-secret-12345" } };
    await expect(requireInternalServiceSession(req, "507f1f77bcf86cd799439011")).rejects.toMatchObject({
      status: 404,
      message: expect.stringMatching(/Interview not found/i),
    });
  });

  test("rejects request when candidateId does not match interview session", async () => {
    AiInterview.findById = async () => ({
      _id: "507f1f77bcf86cd799439011",
      candidateId: "507f1f77bcf86cd799439012",
      status: "IN_PROGRESS",
    });
    const req = { headers: { "x-internal-secret": "test-internal-secret-12345" } };
    await expect(
      requireInternalServiceSession(req, "507f1f77bcf86cd799439011", "507f1f77bcf86cd799439099")
    ).rejects.toMatchObject({
      status: 403,
      message: expect.stringMatching(/does not match/i),
    });
  });

  test("rejects request when interview is not IN_PROGRESS", async () => {
    AiInterview.findById = async () => ({
      _id: "507f1f77bcf86cd799439011",
      candidateId: "507f1f77bcf86cd799439012",
      status: "COMPLETED",
    });
    const req = { headers: { "x-internal-secret": "test-internal-secret-12345" } };
    await expect(
      requireInternalServiceSession(req, "507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012")
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/not in progress/i),
    });
  });

  test("succeeds when secret matches and interview is IN_PROGRESS", async () => {
    const mockDoc = {
      _id: "507f1f77bcf86cd799439011",
      candidateId: "507f1f77bcf86cd799439012",
      status: "IN_PROGRESS",
    };
    AiInterview.findById = async () => mockDoc;
    const req = { headers: { "x-internal-secret": "test-internal-secret-12345" } };
    const result = await requireInternalServiceSession(req, "507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012");
    expect(result).toBe(mockDoc);
  });

  test("allows preflight when interview is SCHEDULED or WAITING_FOR_CANDIDATE", async () => {
    const mockDoc = {
      _id: "507f1f77bcf86cd799439011",
      candidateId: "507f1f77bcf86cd799439012",
      status: "SCHEDULED",
    };
    AiInterview.findById = async () => mockDoc;
    const req = { headers: { "x-internal-secret": "test-internal-secret-12345" } };
    const result = await requireInternalServiceSession(
      req,
      "507f1f77bcf86cd799439011",
      "507f1f77bcf86cd799439012",
      { allowPreflight: true }
    );
    expect(result).toBe(mockDoc);
  });

  test("rejects preflight when interview is cancelled or completed", async () => {
    AiInterview.findById = async () => ({
      _id: "507f1f77bcf86cd799439011",
      candidateId: "507f1f77bcf86cd799439012",
      status: "CANCELLED",
    });
    const req = { headers: { "x-internal-secret": "test-internal-secret-12345" } };
    await expect(
      requireInternalServiceSession(
        req,
        "507f1f77bcf86cd799439011",
        "507f1f77bcf86cd799439012",
        { allowPreflight: true }
      )
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/already concluded or cancelled/i),
    });
  });
});
