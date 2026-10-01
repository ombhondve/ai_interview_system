"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Users,
  Clock3,
  Video,
  FileCheck2,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { getGreeting } from "@/lib/utils";

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
    href: "/admin/interviews",
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
        {stats.map((stat, index) => (
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
