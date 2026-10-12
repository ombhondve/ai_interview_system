import Candidate from "../candidate/candidate.model.js";
import Project from "../projects/project.model.js";
import InterviewBooking from "../scheduling/interviewBooking.model.js";
import AiInterview from "../interview/interview.model.js";

/**
 * Computes date boundaries in Asia/Kolkata timezone or UTC
 */
function resolveDateRange(range = "30d", startDate = "", endDate = "") {
  if (startDate && endDate) {
    return {
      start: new Date(`${startDate}T00:00:00.000Z`),
      end: new Date(`${endDate}T23:59:59.999Z`),
    };
  }

  const now = new Date();
  let days = 30;

  if (range === "7d") days = 7;
  else if (range === "30d") days = 30;
  else if (range === "90d") days = 90;
  else if (range === "all") return null;

  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end: now };
}

/**
 * Main analytics calculation query
 */
export async function getRecruitmentAnalytics({
  range = "30d",
  startDate = "",
  endDate = "",
  role = "",
  status = "",
  projectStatus = "",
  interviewStatus = "",
  decision = "",
} = {}) {
  const dateRange = resolveDateRange(range, startDate, endDate);

  // 1. Candidate query filter
  const candidateFilter = {};
  if (dateRange) {
    candidateFilter.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
  }
  if (role && role !== "ALL") {
    candidateFilter.role = { $regex: role, $options: "i" };
  }
  if (status && status !== "ALL") {
    candidateFilter.status = status;
  }

  // 2. Project query filter
  const projectFilter = {};
  if (dateRange) {
    projectFilter.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
  }
  if (role && role !== "ALL") {
    projectFilter.role = { $regex: role, $options: "i" };
  }

  // 3. Interview Booking query filter
  const bookingFilter = {};
  if (dateRange) {
    bookingFilter.startAt = { $gte: dateRange.start, $lte: dateRange.end };
  }
  if (interviewStatus && interviewStatus !== "ALL") {
    bookingFilter.status = interviewStatus;
  }

  // 4. AI Interview query filter
  const interviewFilter = {};
  if (dateRange) {
    interviewFilter.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
  }
  if (decision && decision !== "ALL") {
    interviewFilter["adminDecision.status"] = decision;
  }

  // Run database aggregations concurrently
  const [
    totalCandidates,
    awaitingApprovalCandidates,
    approvedCandidates,
    rejectedCandidates,
    totalProjectsCreated,
    projectsAssigned,
    projectsSubmitted,
    projectsAwaitingVerification,
    verifiedProjects,
    rejectedProjects,
    totalBookings,
    upcomingBookings,
    completedBookings,
    cancelledBookings,
    hiredDecisions,
    rejectedDecisions,
    followUpDecisions,
    pendingDecisions,
    statusGroup,
    scoreSamples,
  ] = await Promise.all([
    // Candidates
    Candidate.countDocuments(candidateFilter),
    Candidate.countDocuments({ ...candidateFilter, status: { $in: ["received", "under_review"] } }),
    Candidate.countDocuments({
      ...candidateFilter,
      status: { $in: ["approved", "Approved", "Project Assigned", "Project Completed", "scheduled", "completed", "decided"] },
    }),
    Candidate.countDocuments({ ...candidateFilter, status: "rejected" }),

    // Projects
    Project.countDocuments(projectFilter),
    Candidate.countDocuments({
      ...candidateFilter,
      $or: [
        { "projectSubmission.projectId": { $ne: null } },
        { status: { $in: ["Project Assigned", "Project Completed"] } },
      ],
    }),
    Candidate.countDocuments({
      ...candidateFilter,
      "projectSubmission.url": { $exists: true, $ne: "" },
    }),
    Candidate.countDocuments({
      ...candidateFilter,
      "projectSubmission.aiVerificationStatus": { $in: ["pending", "in_progress", "NEEDS_ADMIN_REVIEW"] },
    }),
    Candidate.countDocuments({
      ...candidateFilter,
      "projectSubmission.aiVerificationStatus": { $in: ["verified", "VERIFIED", "completed"] },
    }),
    Candidate.countDocuments({
      ...candidateFilter,
      "projectSubmission.aiVerificationStatus": { $in: ["failed", "rejected", "REJECTED"] },
    }),

    // Interview Bookings
    InterviewBooking.countDocuments(bookingFilter),
    InterviewBooking.countDocuments({
      ...bookingFilter,
      status: "scheduled",
      startAt: { $gte: new Date() },
    }),
    InterviewBooking.countDocuments({ ...bookingFilter, status: "completed" }),
    InterviewBooking.countDocuments({ ...bookingFilter, status: { $in: ["cancelled", "no_show"] } }),

    // Decisions from AiInterview
    AiInterview.countDocuments({ ...interviewFilter, "adminDecision.status": "selected" }),
    AiInterview.countDocuments({ ...interviewFilter, "adminDecision.status": "rejected" }),
    AiInterview.countDocuments({ ...interviewFilter, "adminDecision.status": "another_interview" }),
    AiInterview.countDocuments({
      ...interviewFilter,
      status: "completed",
      "adminDecision.status": { $in: [null, "pending"] },
    }),

    // Distribution by candidate status
    Candidate.aggregate([
      { $match: candidateFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    // Scores
    AiInterview.find(
      { "analysis.overallScore": { $exists: true, $ne: null } },
      { "analysis.overallScore": 1 }
    )
      .limit(200)
      .lean(),
  ]);

  // Candidate funnel stages
  const funnel = [
    { stage: "Applied", label: "Registered Candidates", count: totalCandidates },
    { stage: "Approved", label: "Application Approved", count: approvedCandidates },
    { stage: "Project Assigned", label: "Project Assigned", count: projectsAssigned },
    { stage: "Project Submitted", label: "Project Submitted", count: projectsSubmitted },
    { stage: "Project Verified", label: "Project Verified", count: verifiedProjects },
    { stage: "Interview Booked", label: "Interview Booked", count: totalBookings },
    { stage: "Interview Completed", label: "Interview Completed", count: completedBookings },
    { stage: "Hired", label: "Candidate Hired", count: hiredDecisions },
  ];

  // Score distribution calculation
  const scoreDistribution = {
    "90-100": 0,
    "80-89": 0,
    "70-79": 0,
    "60-69": 0,
    "Below 60": 0,
  };

  scoreSamples.forEach((item) => {
    const s = Number(item.analysis?.overallScore) || 0;
    if (s >= 90) scoreDistribution["90-100"] += 1;
    else if (s >= 80) scoreDistribution["80-89"] += 1;
    else if (s >= 70) scoreDistribution["70-79"] += 1;
    else if (s >= 60) scoreDistribution["60-69"] += 1;
    else scoreDistribution["Below 60"] += 1;
  });

  // Calculate approval and completion rates
  const approvalRate = totalCandidates > 0
    ? Math.round((approvedCandidates / totalCandidates) * 1000) / 10
    : 0;
  const projectCompletionRate = projectsAssigned > 0
    ? Math.round((projectsSubmitted / projectsAssigned) * 1000) / 10
    : 0;
  const interviewCompletionRate = totalBookings > 0
    ? Math.round((completedBookings / totalBookings) * 1000) / 10
    : 0;

  return {
    overview: {
      candidates: {
        total: totalCandidates,
        awaitingApproval: awaitingApprovalCandidates,
        approved: approvedCandidates,
        rejected: rejectedCandidates,
        approvalRate,
      },
      projects: {
        totalCreated: totalProjectsCreated,
        assigned: projectsAssigned,
        submitted: projectsSubmitted,
        awaitingVerification: projectsAwaitingVerification,
        verified: verifiedProjects,
        rejected: rejectedProjects,
        completionRate: projectCompletionRate,
      },
      interviews: {
        totalBooked: totalBookings,
        upcoming: upcomingBookings,
        completed: completedBookings,
        cancelled: cancelledBookings,
        completionRate: interviewCompletionRate,
      },
      decisions: {
        hired: hiredDecisions,
        rejected: rejectedDecisions,
        followUp: followUpDecisions,
        pending: pendingDecisions,
        totalDecided: hiredDecisions + rejectedDecisions + followUpDecisions,
      },
    },
    funnel,
    scoreDistribution,
    candidateStatusDistribution: statusGroup.map((g) => ({
      status: g._id || "Unknown",
      count: g.count,
    })),
    filtersApplied: {
      range,
      startDate: startDate || null,
      endDate: endDate || null,
      role: role || null,
      status: status || null,
      projectStatus: projectStatus || null,
      interviewStatus: interviewStatus || null,
      decision: decision || null,
    },
  };
}

export default {
  getRecruitmentAnalytics,
};
