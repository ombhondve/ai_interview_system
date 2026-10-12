const { getRecruitmentAnalytics } = require("../analytics.service.js");
const Candidate = require("../../candidate/candidate.model.js").default;
const Project = require("../../projects/project.model.js").default;
const InterviewBooking = require("../../scheduling/interviewBooking.model.js").default;
const AiInterview = require("../../interview/interview.model.js").default;

describe("Recruitment Analytics Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("calculates accurate overview KPIs, rates, and funnel stages", async () => {
    jest.spyOn(Candidate, "countDocuments").mockImplementation(async (query) => {
      if (query?.status === "rejected") return 5;
      if (query?.status?.$in?.includes("received")) return 10;
      if (query?.status?.$in?.includes("approved")) return 35;
      if (query?.["projectSubmission.url"]) return 20;
      if (query?.["projectSubmission.aiVerificationStatus"]?.$in?.includes("verified")) return 18;
      if (query?.["projectSubmission.aiVerificationStatus"]?.$in?.includes("failed")) return 2;
      if (query?.["projectSubmission.aiVerificationStatus"]?.$in?.includes("pending")) return 3;
      if (query?.$or) return 25; // assigned
      return 50; // total
    });

    jest.spyOn(Project, "countDocuments").mockResolvedValue(12);

    jest.spyOn(InterviewBooking, "countDocuments").mockImplementation(async (query) => {
      if (query?.status === "completed") return 15;
      if (query?.status === "scheduled") return 5;
      if (query?.status?.$in) return 2;
      return 22; // total booked
    });

    jest.spyOn(AiInterview, "countDocuments").mockImplementation(async (query) => {
      if (query?.["adminDecision.status"] === "selected") return 10;
      if (query?.["adminDecision.status"] === "rejected") return 3;
      if (query?.["adminDecision.status"] === "another_interview") return 2;
      return 0;
    });

    jest.spyOn(Candidate, "aggregate").mockResolvedValue([
      { _id: "approved", count: 35 },
      { _id: "rejected", count: 5 },
      { _id: "received", count: 10 },
    ]);

    jest.spyOn(AiInterview, "find").mockReturnValue({
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { analysis: { overallScore: 92 } },
        { analysis: { overallScore: 85 } },
        { analysis: { overallScore: 78 } },
      ]),
    });

    const result = await getRecruitmentAnalytics({ range: "30d" });

    expect(result.overview.candidates.total).toBe(50);
    expect(result.overview.candidates.approved).toBe(35);
    expect(result.overview.candidates.approvalRate).toBe(70);
    expect(result.overview.projects.totalCreated).toBe(12);
    expect(result.overview.projects.verified).toBe(18);
    expect(result.overview.interviews.totalBooked).toBe(22);
    expect(result.overview.interviews.completed).toBe(15);
    expect(result.overview.decisions.hired).toBe(10);
    expect(result.overview.decisions.rejected).toBe(3);
    expect(result.overview.decisions.followUp).toBe(2);
    expect(result.overview.decisions.totalDecided).toBe(15);

    expect(result.funnel).toHaveLength(8);
    expect(result.funnel[0].stage).toBe("Applied");
    expect(result.funnel[0].count).toBe(50);

    expect(result.scoreDistribution["90-100"]).toBe(1);
    expect(result.scoreDistribution["80-89"]).toBe(1);
    expect(result.scoreDistribution["70-79"]).toBe(1);
  });

  test("handles empty database without division by zero errors", async () => {
    jest.spyOn(Candidate, "countDocuments").mockResolvedValue(0);
    jest.spyOn(Project, "countDocuments").mockResolvedValue(0);
    jest.spyOn(InterviewBooking, "countDocuments").mockResolvedValue(0);
    jest.spyOn(AiInterview, "countDocuments").mockResolvedValue(0);
    jest.spyOn(Candidate, "aggregate").mockResolvedValue([]);
    jest.spyOn(AiInterview, "find").mockReturnValue({
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    const result = await getRecruitmentAnalytics({ range: "all" });

    expect(result.overview.candidates.total).toBe(0);
    expect(result.overview.candidates.approvalRate).toBe(0);
    expect(result.overview.projects.completionRate).toBe(0);
    expect(result.overview.interviews.completionRate).toBe(0);
  });
});
