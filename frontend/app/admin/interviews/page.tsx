"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Video,
  Search,
  Filter,
  RefreshCw,
  ArrowUpRight,
  ChevronRight,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
} from "lucide-react";
import { apiUrl } from "@/lib/client";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

interface ReportRow {
  _id: string;
  status: string;
  scheduledAt: string;
  analysis?: {
    overallScore?: number;
    recommendation?: string;
    summary?: string;
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

export default function InterviewsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [recFilter, setRecFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(apiUrl("/api/ai-interviews/admin/reports"), {
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load reports.");
      setRows(data.interviews || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load interview reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const candidate = typeof row.candidateId === "object" ? row.candidateId : null;
      const project = typeof row.projectId === "object" ? row.projectId : null;

      const matchesSearch =
        !searchQuery.trim() ||
        [candidate?.name, candidate?.email, candidate?.role, project?.title]
          .filter(Boolean)
          .some((val) =>
            String(val).toLowerCase().includes(searchQuery.trim().toLowerCase())
          );

      const rec = row.analysis?.recommendation?.toLowerCase() || "";
      const matchesRec =
        recFilter === "all" ||
        (recFilter === "hire" && (rec.includes("hire") || rec.includes("strong") || rec.includes("pass"))) ||
        (recFilter === "review" && (rec.includes("review") || rec.includes("consider"))) ||
        (recFilter === "no_hire" && (rec.includes("no") || rec.includes("reject")));

      return matchesSearch && matchesRec;
    });
  }, [rows, searchQuery, recFilter]);

  // Metrics summary
  const metrics = useMemo(() => {
    const total = rows.length;
    let scoreSum = 0;
    let scoredCount = 0;
    let hireCount = 0;

    rows.forEach((r) => {
      if (r.analysis?.overallScore !== undefined) {
        scoreSum += r.analysis.overallScore;
        scoredCount++;
      }
      const rec = r.analysis?.recommendation?.toLowerCase() || "";
      if (rec.includes("hire") || rec.includes("pass")) {
        hireCount++;
      }
    });

    const avgScore = scoredCount > 0 ? Math.round(scoreSum / scoredCount) : 0;
    return { total, avgScore, hireCount };
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E2E8F0] pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111F33]">
            Interview Intelligence & Evaluations
          </h1>
          <p className="mt-1 text-xs text-[#64748B]">
            Automated AI interview sessions, transcripts, rubric scores, and admin decisions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={load} className="text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Link href="/admin/schedule">
            <Button size="sm" className="text-xs">
              <Clock className="h-3.5 w-3.5" />
              Live Schedule
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
            Completed Sessions
          </span>
          <p className="mt-1 text-2xl font-bold text-[#111F33]">{metrics.total}</p>
          <p className="mt-1 text-xs text-[#64748B]">recorded and analyzed by AI</p>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
            Average Performance
          </span>
          <p className="mt-1 text-2xl font-bold text-[#111F33]">
            {metrics.avgScore > 0 ? `${metrics.avgScore}/100` : "—"}
          </p>
          <p className="mt-1 text-xs text-[#64748B]">across all technical rubric criteria</p>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
            Positive Recommendations
          </span>
          <p className="mt-1 text-2xl font-bold text-[#16A34A]">{metrics.hireCount}</p>
          <p className="mt-1 text-xs text-[#64748B]">evaluated as Hire / Strong Match</p>
        </Card>
      </div>

      {/* Error alert if any */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-[#DC2626]">
          {error}
        </div>
      )}

      {/* Main Table Card */}
      <Card>
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <span>Interview Session Reports</span>
              <Badge variant="neutral">{filteredRows.length}</Badge>
            </div>
          }
          subtitle="Click any row to open the complete multi-rubric assessment report and question breakdown."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search candidate or project…"
                  className="h-8 w-48 rounded-md border border-[#E2E8F0] bg-[#F5F7FA] pl-8 pr-3 text-xs text-[#111F33] focus:border-[#1976D2] focus:bg-white focus:outline-none"
                />
              </div>

              <select
                value={recFilter}
                onChange={(e) => setRecFilter(e.target.value)}
                className="h-8 rounded-md border border-[#E2E8F0] bg-white px-2.5 text-xs text-[#111F33] focus:border-[#1976D2] focus:outline-none"
              >
                <option value="all">All Recommendations</option>
                <option value="hire">Hire / Pass</option>
                <option value="review">Under Review</option>
                <option value="no_hire">Reject / No Hire</option>
              </select>
            </div>
          }
        />

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={Video}
                title="No interview reports found"
                description={
                  rows.length === 0
                    ? "Completed AI interview sessions will appear here once candidates conclude their meetings."
                    : "No sessions matched your filter criteria."
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F5F7FA] text-[#64748B] font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Assigned Project</th>
                    <th className="py-3 px-4">Scheduled Date</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4">Recommendation</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-[#111F33]">
                  {filteredRows.map((row) => {
                    const candidate = typeof row.candidateId === "object" ? row.candidateId : null;
                    const project = typeof row.projectId === "object" ? row.projectId : null;
                    const score = row.analysis?.overallScore;
                    const rec = row.analysis?.recommendation;

                    return (
                      <tr
                        key={row._id}
                        className="hover:bg-[#F5F7FA]/75 transition-colors group cursor-pointer"
                      >
                        <td className="py-3.5 px-4">
                          <Link href={`/admin/reports/${row._id}`} className="block">
                            <p className="font-semibold text-[#111F33] group-hover:text-[#1976D2] transition-colors">
                              {candidate?.name || "Candidate"}
                            </p>
                            <p className="text-[11px] text-[#64748B]">
                              {candidate?.email || "No email on record"}
                            </p>
                          </Link>
                        </td>

                        <td className="py-3.5 px-4">
                          <Link href={`/admin/reports/${row._id}`} className="block">
                            <p className="font-medium text-[#111F33]">
                              {project?.title || "Technical Project"}
                            </p>
                            <p className="text-[11px] text-[#64748B]">
                              {candidate?.role || "Engineering Candidate"}
                            </p>
                          </Link>
                        </td>

                        <td className="py-3.5 px-4">
                          <Link href={`/admin/reports/${row._id}`} className="block">
                            <p className="font-medium text-[#111F33]">
                              {row.scheduledAt ? new Date(row.scheduledAt).toLocaleDateString() : "—"}
                            </p>
                            <p className="text-[11px] text-[#64748B]">
                              {row.scheduledAt ? new Date(row.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                            </p>
                          </Link>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            {score !== undefined ? (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                  score >= 75
                                    ? "bg-emerald-50 text-[#16A34A] border border-emerald-200"
                                    : score >= 60
                                    ? "bg-amber-50 text-[#D97706] border border-amber-200"
                                    : "bg-red-50 text-[#DC2626] border border-red-200"
                                }`}
                              >
                                {score}/100
                              </span>
                            ) : (
                              <span className="text-xs text-[#64748B]">Pending</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <Badge
                            variant={
                              rec?.toLowerCase().includes("hire")
                                ? "success"
                                : rec?.toLowerCase().includes("review")
                                ? "warning"
                                : "neutral"
                            }
                            dot
                          >
                            {rec || row.status.replace("_", " ").toUpperCase()}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <Link href={`/admin/reports/${row._id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-[11px]"
                            >
                              Report
                              <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
