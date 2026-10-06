"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Users,
  Clock3,
  Video,
  FileCheck2,
  ArrowUpRight,
  CalendarDays,
  Search,
} from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { getGreeting } from "@/lib/utils";
import {
  adminScheduleService,
  AdminUpcomingInterview,
} from "@/services/interviewScheduling.api";

const stats = [
  {
    title: "New Candidates",
    value: 12,
    description: "Received recently",
    icon: Users,
    href: "/admin/candidates",
    tone: "accent" as const,
  },
  {
    title: "Pending Reviews",
    value: 7,
    description: "Need your attention",
    icon: FileCheck2,
    href: "/admin/candidates",
    tone: "warning" as const,
  },
  {
    title: "Upcoming Interviews",
    value: 5,
    description: "Scheduled interviews",
    icon: Video,
    href: "/admin/schedule",
    tone: "info" as const,
  },
  {
    title: "Awaiting Decision",
    value: 3,
    description: "Reports ready for review",
    icon: Clock3,
    href: "/admin/reports",
    tone: "success" as const,
  },
];

const toneClasses: Record<string, { bg: string; text: string; ring: string }> = {
  accent: { bg: "bg-accent-50 dark:bg-accent-500/10", text: "text-accent-600 dark:text-accent-400", ring: "group-hover:ring-accent-200 dark:group-hover:ring-accent-500/30" },
  warning: { bg: "bg-warning-50 dark:bg-warning-500/10", text: "text-warning-600 dark:text-warning-500", ring: "group-hover:ring-warning-200 dark:group-hover:ring-warning-500/30" },
  info: { bg: "bg-info-50 dark:bg-info-500/10", text: "text-info-600 dark:text-info-500", ring: "group-hover:ring-info-200 dark:group-hover:ring-info-500/30" },
  success: { bg: "bg-success-50 dark:bg-success-500/10", text: "text-success-600 dark:text-success-500", ring: "group-hover:ring-success-200 dark:group-hover:ring-success-500/30" },
};

const attentionItems = [
  {
    title: "Candidate reviews",
    description: "7 candidates are waiting for admin review.",
    href: "/admin/candidates",
    tone: "warning" as const,
  },
  {
    title: "Upcoming interviews",
    description: "5 interviews are scheduled.",
    href: "/admin/interviews",
    tone: "info" as const,
  },
  {
    title: "Interview reports",
    description: "3 reports are waiting for a final decision.",
    href: "/admin/reports",
    tone: "success" as const,
  },
];

const pipeline = [
  { label: "Received", value: 12, tone: "bg-slate-400 dark:bg-slate-500" },
  { label: "Under Review", value: 7, tone: "bg-warning-500" },
  { label: "Approved", value: 5, tone: "bg-info-500" },
  { label: "Scheduled", value: 5, tone: "bg-accent-500" },
  { label: "Completed", value: 3, tone: "bg-accent-600" },
  { label: "Report Ready", value: 3, tone: "bg-success-500" },
  { label: "Decision", value: 1, tone: "bg-success-600" },
];

function useCountUp(target: number, durationMs = 900, skip = false) {
  const [value, setValue] = useState(skip ? target : 0);

  useEffect(() => {
    if (skip) {
      setValue(target);
      return;
    }
    let frame: number;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, skip]);

  return value;
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-slate-900 dark:text-slate-100">
        {value || "—"}
      </dd>
    </div>
  );
}

function StatCard({ stat, index }: { stat: (typeof stats)[number]; index: number }) {
  const reduceMotion = useReducedMotion();
  const Icon = stat.icon;
  const tone = toneClasses[stat.tone];
  const displayValue = useCountUp(stat.value, 700 + index * 80, !!reduceMotion);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduceMotion ? 0 : index * 0.06 }}
    >
      <Link href={stat.href} className="group block">
        <Card className={`p-5 ring-1 ring-transparent transition-all hover:-translate-y-0.5 ${tone.ring}`}>
          <div className="flex items-start justify-between">
            <div className={`rounded-xl p-2.5 ${tone.bg}`}>
              <Icon className={`h-5 w-5 ${tone.text}`} />
            </div>
            <ArrowUpRight className="h-4 w-4 -translate-x-1 translate-y-1 text-slate-300 opacity-0 transition-all group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100 dark:text-slate-600" />
          </div>

          <p className="mt-4 text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {displayValue}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{stat.title}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{stat.description}</p>
        </Card>
      </Link>
    </motion.div>
  );
}

function PipelineBar() {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = pipeline[0].value || 1;

  return (
    <div className="space-y-2.5">
      {pipeline.map((stage, i) => {
        const widthPct = Math.max((stage.value / max) * 100, stage.value > 0 ? 4 : 0);
        const pctOfStart = Math.round((stage.value / max) * 100);
        const isHovered = hovered === i;

        return (
          <button
            key={stage.label}
            type="button"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
            className="group flex w-full items-center gap-4 rounded-lg px-2 py-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            <span className="w-28 shrink-0 text-xs text-slate-500 dark:text-slate-400 sm:w-32">
              {stage.label}
            </span>

            <span className="relative h-6 flex-1 overflow-hidden rounded-md bg-slate-100 dark:bg-white/5">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${widthPct}%` }}
                transition={{ duration: 0.7, delay: 0.1 + i * 0.06, ease: "easeOut" }}
                className={`absolute inset-y-0 left-0 rounded-md ${stage.tone} ${
                  hovered !== null && !isHovered ? "opacity-50" : "opacity-100"
                } transition-opacity`}
              />
            </span>

            <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
              {stage.value}
            </span>
            <span
              className={`w-10 shrink-0 text-right text-xs tabular-nums text-slate-400 transition-opacity dark:text-slate-500 ${
                isHovered ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              {pctOfStart}%
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function AdminDashboardPage() {
  const greeting = useMemo(() => getGreeting(), []);
  const [upcoming, setUpcoming] = useState<AdminUpcomingInterview[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [upcomingError, setUpcomingError] = useState(false);
  const [upcomingQuery, setUpcomingQuery] = useState("");

  const loadUpcoming = async () => {
    setUpcomingLoading(true);
    setUpcomingError(false);
    try {
      const data = await adminScheduleService.getUpcoming(8);
      setUpcoming(data.interviews ?? []);
    } catch {
      setUpcomingError(true);
    } finally {
      setUpcomingLoading(false);
      {/* -------------------------------------------------------- */}
      {/* SCHEDULED INTERVIEWS (READ-ONLY)                             */}
      {/* -------------------------------------------------------- */}
      {/* Visualised as booked slots: student slot cards only.         */}
      {/* No create / edit / delete / reschedule controls exist here   */}
      {/* (or anywhere in the admin app) — the admin can only VIEW.    */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-accent-600 dark:text-accent-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Scheduled Interviews
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Slots booked by students. Read-only — no changes possible here.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={upcomingQuery}
                onChange={(event) => setUpcomingQuery(event.target.value)}
                placeholder="Search candidate…"
                aria-label="Search scheduled interviews"
                className="w-52 rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-700 outline-none focus:border-accent-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              />
            </div>
            <Link
              href="/admin/schedule"
              className="text-sm font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400"
            >
              View full schedule →
            </Link>
          </div>
        </div>

        <div className="mt-5">
          {upcomingLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : upcomingError ? (
            <ErrorState
              title="Unable to load scheduled interviews"
              onRetry={loadUpcoming}
            />
          ) : filteredUpcoming.length === 0 ? (
            <EmptyState
              icon={Video}
              title={
                upcoming.length === 0
                  ? "No interviews scheduled yet"
                  : "No matches found"
              }
              description={
                upcoming.length === 0
                  ? "Booked slots will appear here as soon as students schedule their interviews."
                  : "Try a different name, email, role or project."
              }
            />
          ) : (
            <ul className="space-y-3">
              {filteredUpcoming.map((interview) => (
                <li
                  key={interview.id}
                  className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-4 sm:flex-row sm:items-start sm:justify-between dark:border-white/5 dark:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3 sm:w-44 sm:shrink-0">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {interview.time} – {interview.endTime}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {interview.date}
                      </p>
                    </div>
                  </div>

                  <dl className="grid flex-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <Detail
                      label="Candidate"
                      value={interview.candidate.name}
                    />
                    <Detail label="Email" value={interview.candidate.email} />
                    <Detail label="Phone" value={interview.candidate.phone} />
                    <Detail label="Role" value={interview.candidate.role} />
                    <Detail label="Project" value={interview.project} />
                    <Detail
                      label="Status"
                      value={
                        interview.status
                          ? interview.status.charAt(0).toUpperCase() +
                            interview.status.slice(1)
                          : null
                      }
                    />
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

    }
  };

  useEffect(() => {
    loadUpcoming();
  }, []);

  const filteredUpcoming = useMemo(() => {
    const needle = upcomingQuery.trim().toLowerCase();
    if (!needle) return upcoming;
    return upcoming.filter((interview) =>
      [
        interview.candidate.name,
        interview.candidate.email,
        interview.candidate.phone,
        interview.candidate.role,
        interview.project,
        interview.date,
        interview.time,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [upcoming, upcomingQuery]);

  const liveStats = useMemo(
    () =>
      stats.map((stat) =>
        stat.title === "Upcoming Interviews" && !upcomingLoading
          ? { ...stat, value: upcoming.length }
          : stat
      ),
    [upcoming.length, upcomingLoading]
  );

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-sm text-slate-500 dark:text-slate-400">Admin Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{greeting}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Here&apos;s an overview of your recruitment activity.
        </p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {liveStats.map((stat, index) => (
          <StatCard key={stat.title} stat={stat} index={index} />
        ))}
      </div>

      <Card className="p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Needs Your Attention</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Tasks that may require an admin action.
          </p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {attentionItems.map((item) => {
            const tone = toneClasses[item.tone];
            return (
              <Link
                key={item.title}
                href={item.href}
                className="group flex items-center justify-between gap-4 py-4 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.text.replace("text-", "bg-")}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-900 group-hover:text-accent-600 dark:text-white dark:group-hover:text-accent-400">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
                  </div>
                </div>

                <ArrowUpRight className="h-4 w-4 shrink-0 -translate-x-1 translate-y-1 text-slate-300 opacity-0 transition-all group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100 dark:text-slate-600" />
              </Link>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Recruitment Pipeline</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Current candidate flow through the recruitment process. Hover a stage for detail.
        </p>

        <div className="mt-6">
          <PipelineBar />
        </div>
      </Card>
    </div>
  );
}
