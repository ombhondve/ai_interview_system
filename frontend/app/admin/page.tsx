"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  Video,
  FileCheck,
  Clock,
  CalendarDays,
  Search,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge, statusToBadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  adminScheduleService,
  AdminUpcomingInterview,
} from "@/services/interviewScheduling.api";
import { candidateService } from "@/services/candidate.api";
import { apiUrl } from "@/lib/client";
import { Candidate } from "@/types";
import { subscribeAdminSync } from "@/lib/adminDataSync";

interface CompletedReportRow {
  _id: string;
  status: string;
  scheduledAt: string;
  analysis?: {
    overallScore?: number;
    recommendation?: string;
  };
  candidateId?: {
    name?: string;
    email?: string;
    role?: string;
  } | string;
  projectId?: {
    title?: string;
  } | string;
}

interface ActivityEvent {
  id: string;
  type: "candidate" | "interview" | "report";
  title: string;
  detail: string;
  timestamp: string;
  href: string;
  statusVariant: "info" | "warning" | "success" | "neutral";
}

export default function AdminDashboardPage() {
  // State for upcoming interviews
  const [upcoming, setUpcoming] = useState<AdminUpcomingInterview[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [upcomingError, setUpcomingError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // State for candidates & pipeline metrics
  const [totalCandidates, setTotalCandidates] = useState<number>(0);
  const [candidatesList, setCandidatesList] = useState<Candidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(true);

  // State for completed reports
  const [reports, setReports] = useState<CompletedReportRow[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  // Load all dashboard operational data
  const loadDashboardData = useCallback(async () => {
    // 1. Upcoming interviews
    setUpcomingLoading(true);
    setUpcomingError(false);
    try {
      const data = await adminScheduleService.getUpcoming(10);
      setUpcoming(data.interviews || []);
    } catch (err) {
      console.error("Failed to load upcoming interviews:", err);
      setUpcomingError(true);
    } finally {
      setUpcomingLoading(false);
    }

    // 2. Candidate stats & pipeline
    setCandidatesLoading(true);
    try {
      const candResult = await candidateService.getCandidates({ pageSize: 50 });
      setTotalCandidates(candResult.total || 0);
      setCandidatesList(candResult.data || []);
    } catch (err) {
      console.error("Failed to load candidates:", err);
    } finally {
      setCandidatesLoading(false);
    }

    // 3. Completed reports
    setReportsLoading(true);
    try {
      const res = await fetch(apiUrl("/api/ai-interviews/admin/reports"), {
        credentials: "include",
      });
      if (res.ok) {
        const reportData = await res.json();
        setReports(reportData.interviews || []);
      }
    } catch (err) {
      console.error("Failed to load interview reports:", err);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    const unsubCandidate = subscribeAdminSync("admin:candidate:updated", () => {
      void loadDashboardData();
    });
    const unsubProject = subscribeAdminSync("admin:project:updated", () => {
      void loadDashboardData();
    });
    const unsubInterview = subscribeAdminSync("admin:interview:updated", () => {
      void loadDashboardData();
    });
    return () => {
      unsubCandidate();
      unsubProject();
      unsubInterview();
    };
  }, [loadDashboardData]);

  // Compute accurate pipeline counts from real candidate status model
  const pipelineStats = useMemo(() => {
    const counts = {
      received: 0,
      under_review: 0,
      approved: 0,
      scheduled: 0,
      completed: 0,
      selected: 0,
    };

    candidatesList.forEach((c) => {
      const s = c.status as keyof typeof counts;
      if (counts[s] !== undefined) {
        counts[s]++;
      } else {
        counts.received++;
      }
    });

    // Also include upcoming scheduled interviews count if greater
    if (upcoming.length > counts.scheduled) {
      counts.scheduled = upcoming.length;
    }
    // Include completed reports count if greater
    if (reports.length > counts.completed) {
      counts.completed = reports.length;
    }

    const stages = [
      { key: "received", label: "Applied / Received", count: counts.received, color: "#64748B" },
      { key: "under_review", label: "Under Review", count: counts.under_review, color: "#D97706" },
      { key: "approved", label: "Eligible / Approved", count: counts.approved, color: "#1976D2" },
      { key: "scheduled", label: "Interview Scheduled", count: counts.scheduled, color: "#1976D2" },
      { key: "completed", label: "Interview Completed", count: counts.completed, color: "#16A34A" },
      { key: "selected", label: "Selected", count: counts.selected, color: "#16A34A" },
    ];

    const maxCount = Math.max(...stages.map((s) => s.count), 1);
    return { stages, maxCount, counts };
  }, [candidatesList, upcoming.length, reports.length]);

  // Filtered upcoming interviews
  const filteredInterviews = useMemo(() => {
    return upcoming.filter((item) => {
      const matchesSearch =
        !searchQuery.trim() ||
        [
          item.candidate?.name,
          item.candidate?.email,
          item.candidate?.role,
          item.project,
          item.date,
          item.time,
        ]
          .filter(Boolean)
          .some((val) =>
            String(val).toLowerCase().includes(searchQuery.trim().toLowerCase())
          );

      const matchesStatus =
        statusFilter === "all" ||
        (item.status && item.status.toLowerCase() === statusFilter.toLowerCase());

      return matchesSearch && matchesStatus;
    });
  }, [upcoming, searchQuery, statusFilter]);

  // Derived real recent activity events from active DB records
  const recentActivities = useMemo<ActivityEvent[]>(() => {
    const list: ActivityEvent[] = [];

    // Latest candidates
    candidatesList.slice(0, 3).forEach((c) => {
      list.push({
        id: `cand-${c.id}`,
        type: "candidate",
        title: `Candidate ${c.name}`,
        detail: `Applied for ${c.role || "Technical Role"} · Stage: ${c.status.replace("_", " ")}`,
        timestamp: c.receivedDate ? new Date(c.receivedDate).toLocaleDateString() : "Recent",
        href: `/admin/candidates/${c.id}`,
        statusVariant: c.status === "under_review" ? "warning" : "info",
      });
    });

    // Latest upcoming interviews
    upcoming.slice(0, 3).forEach((i) => {
      list.push({
        id: `int-${i.id}`,
        type: "interview",
        title: `Interview scheduled: ${i.candidate?.name}`,
        detail: `${i.project || "Project Review"} on ${i.date} at ${i.time}`,
        timestamp: `${i.date}`,
        href: `/admin/interviews`,
        statusVariant: "info",
      });
    });

    // Latest completed reports
    reports.slice(0, 3).forEach((r) => {
      const cName = typeof r.candidateId === "object" ? r.candidateId?.name : "Candidate";
      list.push({
        id: `rep-${r._id}`,
        type: "report",
        title: `Evaluation ready for ${cName}`,
        detail: `Score: ${r.analysis?.overallScore ?? "—"}/100 · ${r.analysis?.recommendation || "Pending review"}`,
        timestamp: r.scheduledAt ? new Date(r.scheduledAt).toLocaleDateString() : "Recent",
        href: `/admin/interviews/${r._id}`,
        statusVariant: "success",
      });
    });

    return list.slice(0, 6);
  }, [candidatesList, upcoming, reports]);

  const awaitingEvaluationCount = useMemo(() => {
    return reports.filter((r) => !r.analysis?.overallScore || r.status === "pending_evaluation").length;
  }, [reports]);

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E2E8F0] pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111F33]">
            Recruitment Operations
          </h1>
          <p className="mt-1 text-xs text-[#64748B]">
            Real-time candidate pipeline, AI interview schedules, and evaluation oversight.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            className="text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Link href="/admin/schedule">
            <Button size="sm" className="text-xs">
              <CalendarDays className="h-3.5 w-3.5" />
              View Master Schedule
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Key Performance Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Total Candidates */}
        <Card className="p-4 border-[#E2E8F0] hover:border-[#1976D2]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Total Candidates
            </span>
            <div className="rounded-md bg-blue-50 p-2 text-[#1976D2]">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#111F33]">
              {candidatesLoading ? "—" : totalCandidates}
            </span>
            <span className="text-xs text-[#64748B]">in pipeline</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#E2E8F0] pt-2 text-[11px]">
            <Link
              href="/admin/candidates"
              className="font-medium text-[#1976D2] hover:underline flex items-center gap-1"
            >
              Browse candidate pool
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>

        {/* Metric 2: Upcoming Interviews */}
        <Card className="p-4 border-[#E2E8F0] hover:border-[#1976D2]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Scheduled Interviews
            </span>
            <div className="rounded-md bg-blue-50 p-2 text-[#1976D2]">
              <Video className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#111F33]">
              {upcomingLoading ? "—" : upcoming.length}
            </span>
            <span className="text-xs text-[#64748B]">upcoming slots</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#E2E8F0] pt-2 text-[11px]">
            <Link
              href="/admin/schedule"
              className="font-medium text-[#1976D2] hover:underline flex items-center gap-1"
            >
              Inspect calendar slots
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>

        {/* Metric 3: Completed Interviews */}
        <Card className="p-4 border-[#E2E8F0] hover:border-[#1976D2]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Completed Sessions
            </span>
            <div className="rounded-md bg-emerald-50 p-2 text-[#16A34A]">
              <FileCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#111F33]">
              {reportsLoading ? "—" : reports.length}
            </span>
            <span className="text-xs text-[#64748B]">evaluated reports</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#E2E8F0] pt-2 text-[11px]">
            <Link
              href="/admin/interviews"
              className="font-medium text-[#1976D2] hover:underline flex items-center gap-1"
            >
              Review session results
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>

        {/* Metric 4: Pending Admin Action */}
        <Card className="p-4 border-[#E2E8F0] hover:border-[#1976D2]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Awaiting Evaluation
            </span>
            <div className="rounded-md bg-amber-50 p-2 text-[#D97706]">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#111F33]">
              {reportsLoading ? "—" : awaitingEvaluationCount}
            </span>
            <span className="text-xs text-[#64748B]">require decision</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#E2E8F0] pt-2 text-[11px]">
            <Link
              href="/admin/reports"
              className="font-medium text-[#D97706] hover:underline flex items-center gap-1"
            >
              Action report decisions
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>
      </div>

      {/* 3. Hero Section: Scheduled Interviews Table */}
      <Card>
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <span>Upcoming Scheduled Interviews</span>
              <Badge variant="info">
                {filteredInterviews.length} Booked
              </Badge>
            </div>
          }
          subtitle="Real-time interview sessions booked by candidates through the scheduling engine."
          action={
            <div className="flex flex-wrap items-center gap-2">
              {/* Search Control */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter candidate or project…"
                  className="h-8 w-44 rounded-md border border-[#E2E8F0] bg-[#F5F7FA] pl-8 pr-3 text-xs text-[#111F33] focus:border-[#1976D2] focus:bg-white focus:outline-none"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-md border border-[#E2E8F0] bg-white px-2.5 text-xs text-[#111F33] focus:border-[#1976D2] focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>

              <Link href="/admin/schedule">
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  Full Calendar →
                </Button>
              </Link>
            </div>
          }
        />

        <CardContent className="p-0">
          {upcomingLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : upcomingError ? (
            <div className="p-6">
              <ErrorState
                title="Could not load interview schedule"
                description="Please verify backend connectivity and try again."
                onRetry={loadDashboardData}
              />
            </div>
          ) : filteredInterviews.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={Video}
                title={upcoming.length === 0 ? "No interviews scheduled yet" : "No matching interviews"}
                description={
                  upcoming.length === 0
                    ? "Candidates will appear here once they complete project verification and book an available slot."
                    : "Try adjusting your search query or status filter."
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F5F7FA] text-[#64748B] font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Role / Project</th>
                    <th className="py-3 px-4">Schedule</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-[#111F33]">
                  {filteredInterviews.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-[#F5F7FA]/75 transition-colors group"
                    >
                      {/* Candidate Column */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-[#111F33]">
                            {item.candidate?.name || "Candidate"}
                          </span>
                          <span className="text-[11px] text-[#64748B]">
                            {item.candidate?.email || "No email on file"}
                          </span>
                        </div>
                      </td>

                      {/* Role / Project */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-[#111F33]">
                            {item.candidate?.role || "Engineering Role"}
                          </span>
                          <span className="text-[11px] text-[#64748B] truncate max-w-[200px]">
                            {item.project || "Technical Project Review"}
                          </span>
                        </div>
                      </td>

                      {/* Schedule */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-[#111F33]">
                            {item.date}
                          </span>
                          <span className="text-[11px] text-[#64748B]">
                            {item.time} {item.endTime ? `– ${item.endTime}` : ""}
                          </span>
                        </div>
                      </td>

                      {/* Interview Mode */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1976D2]">
                          <Video className="h-3 w-3" />
                          AI Voice / Meet
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            item.status === "completed"
                              ? "success"
                              : item.status === "scheduled"
                              ? "info"
                              : "warning"
                          }
                          dot
                        >
                          {item.status ? item.status.toUpperCase() : "SCHEDULED"}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/admin/candidates`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[11px] text-[#1976D2] hover:bg-blue-50"
                            >
                              Profile
                            </Button>
                          </Link>
                          <Link href={`/admin/interviews`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[11px]"
                            >
                              Details
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Bottom Grid: Pipeline Status Visualization & Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Candidate Recruitment Pipeline Visualization */}
        <Card>
          <CardHeader
            title="Recruitment Pipeline Distribution"
            subtitle="Stage progression of all candidates currently tracked by the system."
            action={
              <Link
                href="/admin/candidates"
                className="text-xs font-semibold text-[#1976D2] hover:underline"
              >
                View Candidates →
              </Link>
            }
          />
          <CardContent className="space-y-4 pt-4">
            {pipelineStats.stages.map((stage) => {
              const pct = Math.round(
                (stage.count / Math.max(totalCandidates, 1)) * 100
              );
              const barWidth = Math.max(
                (stage.count / pipelineStats.maxCount) * 100,
                stage.count > 0 ? 6 : 0
              );

              return (
                <div key={stage.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#111F33] flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#111F33]">
                        {stage.count}
                      </span>
                      <span className="text-[11px] text-[#64748B] w-8 text-right">
                        {pct}%
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="h-2 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: stage.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Real Recent Recruitment Activity */}
        <Card>
          <CardHeader
            title="Recent Recruitment Activity"
            subtitle="Verified actions, scheduling changes, and evaluation updates."
            action={
              <Link
                href="/admin/audit-log"
                className="text-xs font-semibold text-[#1976D2] hover:underline"
              >
                Audit Log →
              </Link>
            }
          />
          <CardContent className="p-0">
            {recentActivities.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#64748B]">
                No recent activity recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-[#E2E8F0]">
                {recentActivities.map((event) => (
                  <Link
                    key={event.id}
                    href={event.href}
                    className="flex items-start justify-between gap-3 p-3.5 hover:bg-[#F5F7FA] transition-colors group"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-1">
                        <span
                          className={`h-2 w-2 rounded-full inline-block ${
                            event.statusVariant === "success"
                              ? "bg-[#16A34A]"
                              : event.statusVariant === "warning"
                              ? "bg-[#D97706]"
                              : "bg-[#1976D2]"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#111F33] group-hover:text-[#1976D2] transition-colors">
                          {event.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#64748B]">
                          {event.detail}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 text-right">
                      <span className="text-[10px] text-[#64748B]">
                        {event.timestamp}
                      </span>
                      <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-[#1976D2] transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
