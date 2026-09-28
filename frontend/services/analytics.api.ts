import api from "./api";

export type AnalyticsDateRange =
  | "7d"
  | "30d"
  | "90d"
  | "1y";

export type AnalyticsOverview = {
  totalCandidates: number;
  approvedCandidates: number;
  rejectedCandidates: number;
  scheduledInterviews: number;
  completedInterviews: number;
  selectedCandidates: number;
  pendingDecisions: number;
  averageScore: number;
};

export type CandidateAnalytics = {
  date: string;
  received: number;
  approved: number;
  rejected: number;
};

export type InterviewAnalytics = {
  date: string;
  scheduled: number;
  completed: number;
  cancelled: number;
};

export type StatusDistribution = {
  status: string;
  count: number;
  percentage: number;
};

export type ScoreDistribution = {
  range: string;
  count: number;
};

export type AdminActivity = {
  adminId: string;
  adminName: string;
  actions: number;
};

export type AnalyticsResponse = {
  overview: AnalyticsOverview;
  candidateTrend: CandidateAnalytics[];
  interviewTrend: InterviewAnalytics[];
  statusDistribution: StatusDistribution[];
  scoreDistribution: ScoreDistribution[];
  adminActivity: AdminActivity[];
};

const mockAnalytics: AnalyticsResponse = {
  overview: {
    totalCandidates: 248,
    approvedCandidates: 126,
    rejectedCandidates: 64,
    scheduledInterviews: 82,
    completedInterviews: 71,
    selectedCandidates: 32,
    pendingDecisions: 39,
    averageScore: 78.4,
  },

  candidateTrend: [
    {
      date: "Sep 11",
      received: 18,
      approved: 9,
      rejected: 4,
    },
    {
      date: "Sep 12",
      received: 24,
      approved: 12,
      rejected: 6,
    },
    {
      date: "Sep 13",
      received: 21,
      approved: 11,
      rejected: 5,
    },
    {
      date: "Sep 14",
      received: 31,
      approved: 16,
      rejected: 8,
    },
    {
      date: "Sep 15",
      received: 28,
      approved: 15,
      rejected: 7,
    },
    {
      date: "Sep 16",
      received: 35,
      approved: 18,
      rejected: 9,
    },
    {
      date: "Sep 17",
      received: 41,
      approved: 22,
      rejected: 11,
    },
  ],

  interviewTrend: [
    {
      date: "Sep 11",
      scheduled: 8,
      completed: 6,
      cancelled: 1,
    },
    {
      date: "Sep 12",
      scheduled: 11,
      completed: 8,
      cancelled: 1,
    },
    {
      date: "Sep 13",
      scheduled: 9,
      completed: 7,
      cancelled: 0,
    },
    {
      date: "Sep 14",
      scheduled: 14,
      completed: 11,
      cancelled: 2,
    },
    {
      date: "Sep 15",
      scheduled: 13,
      completed: 10,
      cancelled: 1,
    },
    {
      date: "Sep 16",
      scheduled: 15,
      completed: 13,
      cancelled: 1,
    },
    {
      date: "Sep 17",
      scheduled: 12,
      completed: 9,
      cancelled: 0,
    },
  ],

  statusDistribution: [
    {
      status: "Received",
      count: 32,
      percentage: 12.9,
    },
    {
      status: "Under Review",
      count: 26,
      percentage: 10.5,
    },
    {
      status: "Approved",
      count: 126,
      percentage: 50.8,
    },
    {
      status: "Scheduled",
      count: 82,
      percentage: 33.1,
    },
    {
      status: "Completed",
      count: 71,
      percentage: 28.6,
    },
    {
      status: "Selected",
      count: 32,
      percentage: 12.9,
    },
    {
      status: "Rejected",
      count: 64,
      percentage: 25.8,
    },
  ],

  scoreDistribution: [
    {
      range: "0–40",
      count: 8,
    },
    {
      range: "41–50",
      count: 11,
    },
    {
      range: "51–60",
      count: 16,
    },
    {
      range: "61–70",
      count: 25,
    },
    {
      range: "71–80",
      count: 34,
    },
    {
      range: "81–90",
      count: 28,
    },
    {
      range: "91–100",
      count: 12,
    },
  ],

  adminActivity: [
    {
      adminId: "ADM-001",
      adminName: "Om Bhondve",
      actions: 148,
    },
    {
      adminId: "ADM-002",
      adminName: "Priya Patil",
      actions: 96,
    },
    {
      adminId: "ADM-003",
      adminName: "Amit Joshi",
      actions: 74,
    },
    {
      adminId: "ADM-004",
      adminName: "Sneha More",
      actions: 42,
    },
  ],
};

/**
 * Get analytics overview.
 *
 * Frontend demo:
 * Returns mock data when the backend is not connected.
 */
export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  try {
    const response = await api.get<AnalyticsOverview>(
      "/analytics/overview"
    );

    return response.data;
  } catch {
    return mockAnalytics.overview;
  }
}

/**
 * Get candidate recruitment analytics.
 */
export async function getCandidateAnalytics(
  range: AnalyticsDateRange = "7d"
): Promise<CandidateAnalytics[]> {
  try {
    const response = await api.get<CandidateAnalytics[]>(
      "/analytics/candidates",
      {
        params: { range },
      }
    );

    return response.data;
  } catch {
    return getMockCandidateTrend(range);
  }
}

/**
 * Get interview analytics.
 */
export async function getInterviewAnalytics(
  range: AnalyticsDateRange = "7d"
): Promise<InterviewAnalytics[]> {
  try {
    const response = await api.get<InterviewAnalytics[]>(
      "/analytics/interviews",
      {
        params: { range },
      }
    );

    return response.data;
  } catch {
    return getMockInterviewTrend(range);
  }
}

/**
 * Get candidate status distribution.
 */
export async function getStatusDistribution(): Promise<
  StatusDistribution[]
> {
  try {
    const response = await api.get<StatusDistribution[]>(
      "/analytics/status-distribution"
    );

    return response.data;
  } catch {
    return mockAnalytics.statusDistribution;
  }
}

/**
 * Get interview score distribution.
 */
export async function getScoreDistribution(): Promise<
  ScoreDistribution[]
> {
  try {
    const response = await api.get<ScoreDistribution[]>(
      "/analytics/score-distribution"
    );

    return response.data;
  } catch {
    return mockAnalytics.scoreDistribution;
  }
}

/**
 * Get administrator activity.
 */
export async function getAdminActivity(): Promise<
  AdminActivity[]
> {
  try {
    const response = await api.get<AdminActivity[]>(
      "/analytics/admin-activity"
    );

    return response.data;
  } catch {
    return mockAnalytics.adminActivity;
  }
}

/**
 * Get complete analytics data.
 */
export async function getAnalytics(
  range: AnalyticsDateRange = "7d"
): Promise<AnalyticsResponse> {
  try {
    const response = await api.get<AnalyticsResponse>(
      "/analytics",
      {
        params: { range },
      }
    );

    return response.data;
  } catch {
    return {
      ...mockAnalytics,
      candidateTrend:
        getMockCandidateTrend(range),
      interviewTrend:
        getMockInterviewTrend(range),
    };
  }
}

/**
 * Refresh analytics data.
 *
 * Useful when the analytics page has a refresh button.
 */
export async function refreshAnalytics(
  range: AnalyticsDateRange = "7d"
): Promise<AnalyticsResponse> {
  return getAnalytics(range);
}

/* =========================================================
   MOCK DATA HELPERS
========================================================= */

function getMockCandidateTrend(
  range: AnalyticsDateRange
): CandidateAnalytics[] {
  if (range === "7d") {
    return mockAnalytics.candidateTrend;
  }

  if (range === "30d") {
    return [
      {
        date: "Week 1",
        received: 62,
        approved: 31,
        rejected: 14,
      },
      {
        date: "Week 2",
        received: 74,
        approved: 38,
        rejected: 18,
      },
      {
        date: "Week 3",
        received: 81,
        approved: 42,
        rejected: 21,
      },
      {
        date: "Week 4",
        received: 91,
        approved: 47,
        rejected: 25,
      },
    ];
  }

  if (range === "90d") {
    return [
      {
        date: "Jul",
        received: 218,
        approved: 108,
        rejected: 51,
      },
      {
        date: "Aug",
        received: 264,
        approved: 136,
        rejected: 63,
      },
      {
        date: "Sep",
        received: 248,
        approved: 126,
        rejected: 64,
      },
    ];
  }

  return [
    {
      date: "Q1",
      received: 612,
      approved: 302,
      rejected: 141,
    },
    {
      date: "Q2",
      received: 748,
      approved: 381,
      rejected: 177,
    },
    {
      date: "Q3",
      received: 730,
      approved: 370,
      rejected: 181,
    },
    {
      date: "Q4",
      received: 812,
      approved: 416,
      rejected: 194,
    },
  ];
}

function getMockInterviewTrend(
  range: AnalyticsDateRange
): InterviewAnalytics[] {
  if (range === "7d") {
    return mockAnalytics.interviewTrend;
  }

  if (range === "30d") {
    return [
      {
        date: "Week 1",
        scheduled: 28,
        completed: 21,
        cancelled: 2,
      },
      {
        date: "Week 2",
        scheduled: 34,
        completed: 27,
        cancelled: 3,
      },
      {
        date: "Week 3",
        scheduled: 39,
        completed: 31,
        cancelled: 2,
      },
      {
        date: "Week 4",
        scheduled: 45,
        completed: 37,
        cancelled: 3,
      },
    ];
  }

  if (range === "90d") {
    return [
      {
        date: "Jul",
        scheduled: 94,
        completed: 78,
        cancelled: 7,
      },
      {
        date: "Aug",
        scheduled: 121,
        completed: 99,
        cancelled: 8,
      },
      {
        date: "Sep",
        scheduled: 82,
        completed: 71,
        cancelled: 4,
      },
    ];
  }

  return [
    {
      date: "Q1",
      scheduled: 286,
      completed: 231,
      cancelled: 19,
    },
    {
      date: "Q2",
      scheduled: 341,
      completed: 279,
      cancelled: 24,
    },
    {
      date: "Q3",
      scheduled: 297,
      completed: 248,
      cancelled: 18,
    },
    {
      date: "Q4",
      scheduled: 382,
      completed: 321,
      cancelled: 21,
    },
  ];
}