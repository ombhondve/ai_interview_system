"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Users,
  CheckCircle2,
  CalendarCheck,
  Target,
  Award,
  TrendingUp,
  RefreshCw,
  FolderKanban,
  FileCheck2,
  Video,
  ShieldCheck,
  Clock,
  XCircle,
  FileText,
  Filter,
  ArrowRight,
} from "lucide-react";
import { apiUrl } from "@/lib/client";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

interface AnalyticsData {
  overview: {
    candidates: {
      total: number;
      awaitingApproval: number;
      approved: number;
      rejected: number;
      approvalRate: number;
    };
    projects: {
      totalCreated: number;
      assigned: number;
      submitted: number;
      awaitingVerification: number;
      verified: number;
      rejected: number;
      completionRate: number;
    };
    interviews: {
      totalBooked: number;
      upcoming: number;
      completed: number;
      cancelled: number;
      completionRate: number;
    };
    decisions: {
      hired: number;
      rejected: number;
      followUp: number;
      pending: number;
      totalDecided: number;
    };
  };
  funnel: Array<{ stage: string; label: string; count: number }>;
  scoreDistribution: Record<string, number>;
  candidateStatusDistribution: Array<{ status: string; count: number }>;
  filtersApplied: {
    range: string;
    role: string | null;
    status: string | null;
    decision: string | null;
  };
}

export default function AnalyticsPage() {
  const [range, setRange] = useState("30d");
  const [role, setRole] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [decision, setDecision] = useState("ALL");

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (range) params.set("range", range);
      if (role && role !== "ALL") params.set("role", role);
      if (status && status !== "ALL") params.set("status", status);
      if (decision && decision !== "ALL") params.set("decision", decision);

      const res = await fetch(apiUrl(`/api/admin/analytics?${params.toString()}`), {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to load analytics");
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        throw new Error("Invalid analytics response");
      }
    } catch (err) {
      console.error("Analytics fetch error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [range, role, status, decision]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const overview = data?.overview;
  const maxFunnelCount = data?.funnel?.[0]?.count || 1;

  return (
    <div className="space-y-6">
      {/* 1. Header & Navigation Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1976D2]">
            <BarChart3 className="h-4 w-4" />
            Executive Oversight
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#111F33]">
            Recruitment Analytics & Insights
          </h1>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Data-backed metrics across candidate pipeline, technical verifications, AI interviews, and admin hiring decisions.
          </p>
        </div>

        {/* Tab switch to Audit Logs */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[#E2E8F0] bg-white p-1 shadow-xs">
            <button
              type="button"
              className="rounded-md bg-[#111F33] px-3 py-1.5 text-xs font-semibold text-white shadow-xs"
            >
              Analytics
            </button>
            <Link
              href="/admin/audit-log"
              className="rounded-md px-3 py-1.5 text-xs font-medium text-[#64748B] hover:text-[#111F33] transition-colors"
            >
              Audit Logs
            </Link>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Global Filters Bar */}
      <Card className="border-[#E2E8F0] shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#111F33]">
              <Filter className="h-4 w-4 text-[#1976D2]" />
              Filter Analytics:
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Range Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-[#64748B]">Timeframe:</span>
                <select
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  className="rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#111F33] outline-none focus:border-[#1976D2]"
                >
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="all">All Time</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-[#64748B]">Status:</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#111F33] outline-none focus:border-[#1976D2]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="received">Received / Applied</option>
                  <option value="approved">Approved</option>
                  <option value="Project Assigned">Project Assigned</option>
                  <option value="Project Completed">Project Completed</option>
                  <option value="scheduled">Interview Scheduled</option>
                  <option value="completed">Interview Completed</option>
                  <option value="decided">Final Decided</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Decision Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-[#64748B]">Decision:</span>
                <select
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  className="rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#111F33] outline-none focus:border-[#1976D2]"
                >
                  <option value="ALL">All Decisions</option>
                  <option value="selected">Hired / Selected</option>
                  <option value="rejected">Rejected</option>
                  <option value="another_interview">Follow-up Round</option>
                  <option value="pending">Pending Decision</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to Load Analytics"
          description="Could not compute recruitment statistics. Please verify backend connectivity and try again."
          onRetry={fetchAnalytics}
        />
      ) : data ? (
        <>
          {/* 3. Core KPI Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* KPI 1: Candidate Pool */}
            <Card className="p-4 border-[#E2E8F0]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                  Candidate Pipeline
                </span>
                <div className="rounded-md bg-blue-50 p-2 text-[#1976D2]">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#111F33]">
                  {overview?.candidates.total ?? 0}
                </span>
                <span className="text-xs text-[#64748B]">registered</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#E2E8F0] pt-2 text-[11px]">
                <span className="text-[#16A34A] font-semibold">
                  {overview?.candidates.approved ?? 0} Approved
                </span>
                <span className="text-[#64748B]">
                  {overview?.candidates.awaitingApproval ?? 0} Awaiting Review
                </span>
              </div>
            </Card>

            {/* KPI 2: Project Performance */}
            <Card className="p-4 border-[#E2E8F0]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                  Project Submissions
                </span>
                <div className="rounded-md bg-indigo-50 p-2 text-indigo-600">
                  <FolderKanban className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#111F33]">
                  {overview?.projects.submitted ?? 0}
                </span>
                <span className="text-xs text-[#64748B]">
                  / {overview?.projects.assigned ?? 0} assigned
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#E2E8F0] pt-2 text-[11px]">
                <span className="text-[#16A34A] font-semibold">
                  {overview?.projects.verified ?? 0} Verified
                </span>
                <span className="text-[#D97706] font-medium">
                  {overview?.projects.awaitingVerification ?? 0} Under Review
                </span>
              </div>
            </Card>

            {/* KPI 3: Interview Completion */}
            <Card className="p-4 border-[#E2E8F0]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                  Interview Sessions
                </span>
                <div className="rounded-md bg-emerald-50 p-2 text-[#16A34A]">
                  <Video className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#111F33]">
                  {overview?.interviews.completed ?? 0}
                </span>
                <span className="text-xs text-[#64748B]">
                  / {overview?.interviews.totalBooked ?? 0} booked
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#E2E8F0] pt-2 text-[11px]">
                <span className="text-[#1976D2] font-semibold">
                  {overview?.interviews.upcoming ?? 0} Upcoming
                </span>
                <span className="text-[#64748B]">
                  {overview?.interviews.completionRate ?? 0}% Completion
                </span>
              </div>
            </Card>

            {/* KPI 4: Hiring Decisions */}
            <Card className="p-4 border-[#E2E8F0]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                  Admin Hiring Decisions
                </span>
                <div className="rounded-md bg-amber-50 p-2 text-amber-600">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#16A34A]">
                  {overview?.decisions.hired ?? 0}
                </span>
                <span className="text-xs text-[#64748B]">
                  Hired ({overview?.decisions.totalDecided ?? 0} Decided)
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#E2E8F0] pt-2 text-[11px]">
                <span className="text-[#D97706] font-medium">
                  {overview?.decisions.followUp ?? 0} Follow-up
                </span>
                <span className="text-[#DC2626] font-medium">
                  {overview?.decisions.rejected ?? 0} Rejected
                </span>
              </div>
            </Card>
          </div>

          {/* 4. Recruitment Funnel & Score Distribution */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Recruitment Funnel Chart (2 Cols) */}
            <Card className="lg:col-span-2 border-[#E2E8F0] shadow-xs">
              <CardHeader
                title="Candidate Recruitment Conversion Funnel"
                subtitle="Stage-by-stage progression from initial application through final hiring decision."
              />
              <CardContent className="space-y-3.5 pt-2">
                {data.funnel.map((item, idx) => {
                  const percentOfApplied = maxFunnelCount > 0
                    ? Math.round((item.count / maxFunnelCount) * 100)
                    : 0;

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#111F33]">
                          {idx + 1}. {item.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#111F33]">{item.count}</span>
                          <span className="text-[11px] text-[#64748B] w-12 text-right">
                            ({percentOfApplied}%)
                          </span>
                        </div>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F5F7FA] border border-[#E2E8F0]">
                        <div
                          className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-[#1976D2] to-[#1565C0]"
                          style={{ width: `${Math.max(item.count > 0 ? 3 : 0, percentOfApplied)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* AI Technical Score Distribution (1 Col) */}
            <Card className="border-[#E2E8F0] shadow-xs flex flex-col justify-between">
              <div>
                <CardHeader
                  title="AI Interview Score Tiers"
                  subtitle="Candidate performance distribution evaluated across technical categories."
                />
                <CardContent className="space-y-3 pt-2">
                  {Object.entries(data.scoreDistribution).map(([bracket, count]) => {
                    const totalScored = Object.values(data.scoreDistribution).reduce((a, b) => a + b, 0);
                    const pct = totalScored > 0 ? Math.round((count / totalScored) * 100) : 0;

                    return (
                      <div key={bracket} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-[#111F33]">{bracket} Points</span>
                          <span className="text-[#64748B]">
                            {count} candidates ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[#F5F7FA] border border-[#E2E8F0]">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              bracket === "90-100"
                                ? "bg-[#16A34A]"
                                : bracket === "80-89"
                                ? "bg-[#1976D2]"
                                : bracket === "70-79"
                                ? "bg-[#0284C7]"
                                : bracket === "60-69"
                                ? "bg-[#D97706]"
                                : "bg-[#DC2626]"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </div>

              <div className="border-t border-[#E2E8F0] p-4 bg-[#F5F7FA] rounded-b-lg text-xs text-[#64748B]">
                <p>
                  Scores reflect AI rubrics for technical knowledge, problem solving, and architecture design.
                </p>
              </div>
            </Card>
          </div>

          {/* 5. Breakdown Cards Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Card A: Decision Outcomes */}
            <Card className="border-[#E2E8F0] shadow-xs">
              <CardHeader
                title="Recruitment Decisions Breakdown"
                subtitle="Authoritative admin decisions recorded post-interview."
              />
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-[#16A34A]/20 bg-[#16A34A]/5 p-3 text-center">
                    <span className="text-[11px] font-semibold text-[#16A34A]">Hired / Selected</span>
                    <p className="mt-1 text-xl font-bold text-[#16A34A]">
                      {overview?.decisions.hired ?? 0}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#D97706]/20 bg-[#D97706]/5 p-3 text-center">
                    <span className="text-[11px] font-semibold text-[#D97706]">Follow-up Round</span>
                    <p className="mt-1 text-xl font-bold text-[#D97706]">
                      {overview?.decisions.followUp ?? 0}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#DC2626]/20 bg-[#DC2626]/5 p-3 text-center">
                    <span className="text-[11px] font-semibold text-[#DC2626]">Rejected</span>
                    <p className="mt-1 text-xl font-bold text-[#DC2626]">
                      {overview?.decisions.rejected ?? 0}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F5F7FA] p-3 text-center">
                    <span className="text-[11px] font-semibold text-[#64748B]">Pending Review</span>
                    <p className="mt-1 text-xl font-bold text-[#111F33]">
                      {overview?.decisions.pending ?? 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card B: Project Verification Statuses */}
            <Card className="border-[#E2E8F0] shadow-xs">
              <CardHeader
                title="Project AI Verification Statuses"
                subtitle="Outcome of automated code repository inspections."
              />
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-[#16A34A]/20 bg-[#16A34A]/5 p-3 text-center">
                    <span className="text-[11px] font-semibold text-[#16A34A]">Verified Code</span>
                    <p className="mt-1 text-xl font-bold text-[#16A34A]">
                      {overview?.projects.verified ?? 0}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#D97706]/20 bg-[#D97706]/5 p-3 text-center">
                    <span className="text-[11px] font-semibold text-[#D97706]">Needs Review</span>
                    <p className="mt-1 text-xl font-bold text-[#D97706]">
                      {overview?.projects.awaitingVerification ?? 0}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#DC2626]/20 bg-[#DC2626]/5 p-3 text-center">
                    <span className="text-[11px] font-semibold text-[#DC2626]">Failed / Rejected</span>
                    <p className="mt-1 text-xl font-bold text-[#DC2626]">
                      {overview?.projects.rejected ?? 0}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F5F7FA] p-3 text-center">
                    <span className="text-[11px] font-semibold text-[#64748B]">Total Created</span>
                    <p className="mt-1 text-xl font-bold text-[#111F33]">
                      {overview?.projects.totalCreated ?? 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
