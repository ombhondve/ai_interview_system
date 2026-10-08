"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  FileText,
  Eye,
  CheckCircle2,
  Clock3,
  Filter,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { apiUrl } from "@/lib/client";

export type ReportItem = {
  id: string; // interview._id
  candidate: string;
  initials: string;
  interview: string;
  role: string;
  technical: number;
  communication: number;
  problemSolving: number;
  project: number;
  overall: number;
  status: "Awaiting Decision" | "Reviewed" | "Generating Report" | "Report Failed" | "Pending";
  date: string;
  hasAnalysis: boolean;
};

type ApiInterview = {
  _id: string;
  status: string;
  scheduledAt: string;
  candidateId?: {
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
  } | string;
  projectId?: {
    _id?: string;
    title?: string;
  } | string;
  analysis?: {
    technicalKnowledge?: { score: number; summary: string };
    projectUnderstanding?: { score: number; summary: string };
    problemSolving?: { score: number; summary: string };
    communication?: { score: number; summary: string };
    projectWalkthrough?: { score: number; summary: string };
    strengths?: string[];
    areasForImprovement?: string[];
    evidence?: string[];
    overallScore?: number;
    recommendation?: string;
    summary?: string;
  } | null;
  adminDecision?: {
    status?: "pending" | "selected" | "rejected" | "another_interview";
    notes?: string;
    decidedBy?: string;
    decidedAt?: string;
  } | null;
};

function getInitials(name: string): string {
  if (!name) return "NA";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function mapApiToReport(doc: ApiInterview): ReportItem {
  const candidateObj = typeof doc.candidateId === "object" && doc.candidateId !== null ? doc.candidateId : null;
  const projectObj = typeof doc.projectId === "object" && doc.projectId !== null ? doc.projectId : null;

  const candidateName = candidateObj?.name || "Candidate";
  const roleName = candidateObj?.role || projectObj?.title || "Applicant";
  const hasAnalysis = Boolean(doc.analysis && typeof doc.analysis.overallScore === "number");

  let status: ReportItem["status"] = "Pending";
  if (doc.adminDecision?.status && doc.adminDecision.status !== "pending") {
    status = "Reviewed";
  } else if (doc.status === "ANALYZED" && hasAnalysis) {
    status = "Awaiting Decision";
  } else if (doc.status === "ANALYSIS_PENDING" || doc.status === "COMPLETING") {
    status = "Generating Report";
  } else if (doc.status === "FAILED") {
    status = "Report Failed";
  } else if (["COMPLETED"].includes(doc.status) && hasAnalysis) {
    status = "Awaiting Decision";
  } else {
    status = "Pending";
  }

  const technical = doc.analysis?.technicalKnowledge?.score ?? 0;
  const communication = doc.analysis?.communication?.score ?? 0;
  const problemSolving = doc.analysis?.problemSolving?.score ?? 0;
  const projectScore = doc.analysis?.projectUnderstanding?.score ?? 0;
  const overall = doc.analysis?.overallScore ?? 0;

  const dateFormatted = doc.scheduledAt
    ? new Date(doc.scheduledAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return {
    id: doc._id,
    candidate: candidateName,
    initials: getInitials(candidateName),
    interview: `INT-${doc._id.slice(-6).toUpperCase()}`,
    role: roleName,
    technical,
    communication,
    problemSolving,
    project: projectScore,
    overall,
    status,
    date: dateFormatted,
    hasAnalysis,
  };
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [role, setRole] = useState("All");
  const [score, setScore] = useState("All");

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(apiUrl("/api/ai-interviews/admin/reports"), {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Failed to fetch reports (${res.status})`);
      }
      const rawList: ApiInterview[] = Array.isArray(data.interviews) ? data.interviews : [];
      setReports(rawList.map(mapApiToReport));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load performance reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  const uniqueRoles = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      if (r.role) set.add(r.role);
    });
    return Array.from(set);
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const query = search.toLowerCase();

      const matchesSearch =
        report.candidate.toLowerCase().includes(query) ||
        report.interview.toLowerCase().includes(query);

      const matchesStatus =
        status === "All" || report.status === status;

      const matchesRole = role === "All" || report.role === role;

      const matchesScore =
        score === "All" ||
        (score === "80+" && report.overall >= 80) ||
        (score === "70-79" &&
          report.overall >= 70 &&
          report.overall <= 79) ||
        (score === "Below 70" && report.overall < 70);

      return matchesSearch && matchesStatus && matchesRole && matchesScore;
    });
  }, [reports, search, status, role, score]);

  const scoredReports = useMemo(
    () => reports.filter((r) => r.hasAnalysis && r.overall > 0),
    [reports]
  );
  const avgScore = scoredReports.length
    ? Math.round(scoredReports.reduce((sum, r) => sum + r.overall, 0) / scoredReports.length)
    : 0;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <FileText size={16} />
              Recruitment
            </div>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Performance Reports
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Review AI-generated interview performance reports before making
              the final admin decision.
            </p>
          </div>

          <button
            onClick={() => void fetchReports()}
            disabled={loading}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            icon={<FileText size={19} />}
            label="Total Reports"
            value={reports.length}
          />

          <SummaryCard
            icon={<Clock3 size={19} />}
            label="Awaiting Decision"
            value={
              reports.filter((r) => r.status === "Awaiting Decision").length
            }
          />

          <SummaryCard
            icon={<CheckCircle2 size={19} />}
            label="Average Score"
            value={scoredReports.length ? `${avgScore}/100` : "—"}
          />
        </div>

        {/* Filters */}
        <section className="surface rounded-2xl border p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <Filter size={16} />
            Filters
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search candidate or ID..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-[#10141d]"
              />
            </div>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#10141d]"
            >
              <option value="All">All Statuses</option>
              <option value="Awaiting Decision">Awaiting Decision</option>
              <option value="Reviewed">Reviewed</option>
              <option value="Generating Report">Generating Report</option>
              <option value="Report Failed">Report Failed</option>
              <option value="Pending">Pending</option>
            </select>

            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#10141d]"
            >
              <option value="All">All Roles</option>
              {uniqueRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <select
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#10141d]"
            >
              <option value="All">All Scores</option>
              <option value="80+">80+</option>
              <option value="70-79">70-79</option>
              <option value="Below 70">Below 70</option>
            </select>
          </div>
        </section>

        {/* Table */}
        <section className="surface overflow-hidden rounded-2xl border shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-white/[0.02]">
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Candidate
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Interview
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Technical
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Communication
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Problem Solving
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Project
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Overall
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-sm text-slate-500">
                      Loading real reports from backend...
                    </td>
                  </tr>
                ) : filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center">
                      <FileText className="mx-auto text-slate-400" size={35} />
                      <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">
                        No reports found
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Try changing your filters or verify that completed interviews exist in MongoDB.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report) => (
                    <tr
                      key={report.id}
                      className="border-b border-slate-100 transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                            {report.initials}
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                              {report.candidate}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {report.role}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {report.interview}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {report.date}
                        </p>
                      </td>

                      <Score value={report.technical} hasAnalysis={report.hasAnalysis} />
                      <Score value={report.communication} hasAnalysis={report.hasAnalysis} />
                      <Score value={report.problemSolving} hasAnalysis={report.hasAnalysis} />
                      <Score value={report.project} hasAnalysis={report.hasAnalysis} />

                      <td className="px-4 py-4 text-center">
                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                          {report.hasAnalysis ? report.overall : "—"}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge status={report.status} />
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/reports/${report.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                          >
                            <Eye size={14} />
                            View
                          </Link>

                          <Link
                            href={`/admin/reports/${report.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-700"
                          >
                            Decision
                            <ChevronRight size={14} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Score({ value, hasAnalysis }: { value: number; hasAnalysis: boolean }) {
  if (!hasAnalysis) {
    return (
      <td className="px-4 py-4 text-center">
        <span className="text-sm text-slate-400">—</span>
      </td>
    );
  }

  return (
    <td className="px-4 py-4 text-center">
      <span
        className={`text-sm font-semibold ${
          value >= 80
            ? "text-emerald-600 dark:text-emerald-400"
            : value >= 60
            ? "text-amber-600 dark:text-amber-400"
            : "text-red-600 dark:text-red-400"
        }`}
      >
        {value}
      </span>
      <span className="text-xs text-slate-400">/100</span>
    </td>
  );
}

function StatusBadge({ status }: { status: ReportItem["status"] }) {
  const styles: Record<ReportItem["status"], string> = {
    "Awaiting Decision":
      "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
    Reviewed:
      "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
    "Generating Report":
      "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 animate-pulse",
    "Report Failed":
      "bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
    Pending:
      "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="surface rounded-2xl border p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
          {icon}
        </div>

        <span className="text-2xl font-semibold text-slate-900 dark:text-white">
          {value}
        </span>
      </div>

      <p className="mt-4 text-sm text-slate-500">{label}</p>
    </div>
  );
}
