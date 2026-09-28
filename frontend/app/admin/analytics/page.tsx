"use client";

import {
  BarChart3,
  Users,
  CheckCircle2,
  CalendarCheck,
  Target,
  Award,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

const statusData = [
  { label: "Received", value: 124 },
  { label: "Under Review", value: 38 },
  { label: "Approved", value: 31 },
  { label: "Scheduled", value: 24 },
  { label: "Completed", value: 19 },
];

const scoreData = [
  { label: "50–59", value: 3 },
  { label: "60–69", value: 7 },
  { label: "70–79", value: 18 },
  { label: "80–89", value: 27 },
  { label: "90–100", value: 11 },
];

const interviewData = [
  { label: "Sep 11", value: 4 },
  { label: "Sep 12", value: 7 },
  { label: "Sep 13", value: 5 },
  { label: "Sep 14", value: 9 },
  { label: "Sep 15", value: 8 },
  { label: "Sep 16", value: 12 },
  { label: "Sep 17", value: 10 },
];

export default function AnalyticsPage() {
  const [range, setRange] = useState("30 days");

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <BarChart3 size={16} />
              Insights
            </div>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Recruitment Analytics
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Understand candidate flow, interview performance and recruitment
              activity.
            </p>
          </div>

          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium outline-none dark:border-white/10 dark:bg-[#151922]"
          >
            <option>7 days</option>
            <option>30 days</option>
            <option>90 days</option>
            <option>Custom</option>
          </select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            icon={<Users size={19} />}
            label="Total Candidates"
            value="124"
            change="+12.4%"
          />

          <MetricCard
            icon={<CheckCircle2 size={19} />}
            label="Approval Rate"
            value="73.4%"
            change="+4.8%"
          />

          <MetricCard
            icon={<CalendarCheck size={19} />}
            label="Interview Completion"
            value="82.6%"
            change="+6.2%"
          />

          <MetricCard
            icon={<Target size={19} />}
            label="Average JD Match"
            value="84%"
            change="+3.1%"
          />

          <MetricCard
            icon={<Award size={19} />}
            label="Average Interview Score"
            value="82/100"
            change="+2.7%"
          />

          <MetricCard
            icon={<TrendingUp size={19} />}
            label="Selected Candidates"
            value="18"
            change="+5"
          />
        </div>

        {/* Funnel */}
        <section className="surface rounded-2xl border p-5 shadow-sm">
          <ChartHeader
            title="Recruitment Funnel"
            description="Candidate progression through the recruitment workflow."
          />

          <div className="mt-6 space-y-4">
            {[
              ["Applications", 124],
              ["Reviewed", 82],
              ["Approved", 31],
              ["Scheduled", 24],
              ["Interviewed", 19],
              ["Selected", 18],
            ].map(([label, value]) => {
              const numericValue = Number(value);
              const width = (numericValue / 124) * 100;

              return (
                <div key={label as string}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300">
                      {label}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {value}
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all duration-700"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Two Charts */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <section className="surface rounded-2xl border p-5 shadow-sm">
            <ChartHeader
              title="Candidates by Status"
              description="Current candidate distribution."
            />

            <div className="mt-8 flex h-64 items-end justify-between gap-3">
              {statusData.map((item) => {
                const height = (item.value / 124) * 100;

                return (
                  <div
                    key={item.label}
                    className="flex h-full flex-1 flex-col items-center justify-end"
                  >
                    <span className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {item.value}
                    </span>

                    <div className="flex h-[85%] w-full items-end">
                      <div
                        className="w-full rounded-t-lg bg-indigo-600 transition-all duration-700 hover:bg-indigo-700"
                        style={{ height: `${height}%` }}
                      />
                    </div>

                    <span className="mt-3 text-center text-[11px] text-slate-400">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="surface rounded-2xl border p-5 shadow-sm">
            <ChartHeader
              title="Interviews Over Time"
              description="Completed and scheduled interviews."
            />

            <div className="mt-8 flex h-64 items-end gap-3">
              {interviewData.map((item) => {
                const height = (item.value / 12) * 100;

                return (
                  <div
                    key={item.label}
                    className="flex h-full flex-1 flex-col items-center justify-end"
                  >
                    <span className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {item.value}
                    </span>

                    <div className="flex h-[85%] w-full items-end">
                      <div
                        className="w-full rounded-t-lg bg-slate-800 transition-all duration-700 dark:bg-slate-200"
                        style={{ height: `${height}%` }}
                      />
                    </div>

                    <span className="mt-3 text-[11px] text-slate-400">
                      {item.label.replace("Sep ", "")}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Score Distribution */}
        <section className="surface rounded-2xl border p-5 shadow-sm">
          <ChartHeader
            title="Interview Score Distribution"
            description="Distribution of overall interview scores."
          />

          <div className="mt-8 flex h-64 items-end gap-4">
            {scoreData.map((item) => {
              const height = (item.value / 30) * 100;

              return (
                <div
                  key={item.label}
                  className="flex h-full flex-1 flex-col items-center justify-end"
                >
                  <span className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {item.value}
                  </span>

                  <div className="flex h-[85%] w-full items-end">
                    <div
                      className="w-full rounded-t-xl bg-indigo-500 transition-all duration-700"
                      style={{ height: `${height}%` }}
                    />
                  </div>

                  <span className="mt-3 text-xs text-slate-400">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* JD Match */}
        <section className="surface rounded-2xl border p-5 shadow-sm">
          <ChartHeader
            title="JD Match Distribution"
            description="How closely candidate profiles match the selected roles."
          />

          <div className="mt-6 space-y-5">
            <DistributionRow label="90–100%" value={28} total={60} />
            <DistributionRow label="80–89%" value={21} total={60} />
            <DistributionRow label="70–79%" value={8} total={60} />
            <DistributionRow label="60–69%" value={3} total={60} />
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  change,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: string;
}) {
  return (
    <div className="surface rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
          {icon}
        </div>

        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
          {change}
        </span>
      </div>

      <p className="mt-5 text-sm text-slate-500">{label}</p>

      <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function ChartHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function DistributionRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percentage = (value / total) * 100;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-slate-600 dark:text-slate-300">
          {label}
        </span>

        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          {value} candidates
        </span>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
        <div
          className="h-full rounded-full bg-indigo-600 transition-all duration-700"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}