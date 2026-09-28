"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  FileText,
  Eye,
  CheckCircle2,
  Clock3,
  Filter,
  ChevronRight,
} from "lucide-react";

type Report = {
  id: string;
  candidate: string;
  initials: string;
  interview: string;
  role: string;
  technical: number;
  communication: number;
  problemSolving: number;
  project: number;
  overall: number;
  status: "Awaiting Decision" | "Reviewed" | "Pending";
  date: string;
};

const reports: Report[] = [
  {
    id: "RPT-001",
    candidate: "Rahul Sharma",
    initials: "RS",
    interview: "INT-1042",
    role: "Full Stack Developer",
    technical: 84,
    communication: 88,
    problemSolving: 81,
    project: 86,
    overall: 85,
    status: "Awaiting Decision",
    date: "Sep 16, 2026",
  },
  {
    id: "RPT-002",
    candidate: "Priya Patil",
    initials: "PP",
    interview: "INT-1041",
    role: "Frontend Developer",
    technical: 91,
    communication: 86,
    problemSolving: 89,
    project: 92,
    overall: 90,
    status: "Reviewed",
    date: "Sep 15, 2026",
  },
  {
    id: "RPT-003",
    candidate: "Amit Joshi",
    initials: "AJ",
    interview: "INT-1040",
    role: "Backend Developer",
    technical: 78,
    communication: 80,
    problemSolving: 76,
    project: 82,
    overall: 79,
    status: "Pending",
    date: "Sep 14, 2026",
  },
  {
    id: "RPT-004",
    candidate: "Sneha More",
    initials: "SM",
    interview: "INT-1039",
    role: "AI/ML Intern",
    technical: 87,
    communication: 83,
    problemSolving: 90,
    project: 88,
    overall: 87,
    status: "Awaiting Decision",
    date: "Sep 13, 2026",
  },
  {
    id: "RPT-005",
    candidate: "Aditya Kulkarni",
    initials: "AK",
    interview: "INT-1038",
    role: "Full Stack Developer",
    technical: 72,
    communication: 76,
    problemSolving: 74,
    project: 79,
    overall: 75,
    status: "Reviewed",
    date: "Sep 12, 2026",
  },
];

export default function ReportsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [role, setRole] = useState("All");
  const [score, setScore] = useState("All");

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
  }, [search, status, role, score]);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Header */}
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
            value={`${Math.round(
              reports.reduce((sum, report) => sum + report.overall, 0) /
                reports.length
            )}/100`}
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
                placeholder="Search candidate..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-[#10141d]"
              />
            </div>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#10141d]"
            >
              <option>All</option>
              <option>Awaiting Decision</option>
              <option>Reviewed</option>
              <option>Pending</option>
            </select>

            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#10141d]"
            >
              <option>All</option>
              <option>Full Stack Developer</option>
              <option>Frontend Developer</option>
              <option>Backend Developer</option>
              <option>AI/ML Intern</option>
            </select>

            <select
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#10141d]"
            >
              <option>All</option>
              <option>80+</option>
              <option>70-79</option>
              <option>Below 70</option>
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
                {filteredReports.map((report) => (
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

                    <Score value={report.technical} />
                    <Score value={report.communication} />
                    <Score value={report.problemSolving} />
                    <Score value={report.project} />

                    <td className="px-4 py-4 text-center">
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        {report.overall}
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
                ))}
              </tbody>
            </table>
          </div>

          {filteredReports.length === 0 && (
            <div className="p-12 text-center">
              <FileText className="mx-auto text-slate-400" size={35} />
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">
                No reports found
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Try changing your filters or search query.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Score({ value }: { value: number }) {
  return (
    <td className="px-4 py-4 text-center">
      <span
        className={`text-sm font-semibold ${
          value >= 85
            ? "text-emerald-600 dark:text-emerald-400"
            : value >= 75
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

function StatusBadge({ status }: { status: Report["status"] }) {
  const styles = {
    "Awaiting Decision":
      "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    Reviewed:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    Pending:
      "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400",
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