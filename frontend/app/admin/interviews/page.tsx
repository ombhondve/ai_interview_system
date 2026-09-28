"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Video, Search } from "lucide-react";
import { interviewService, InterviewFilters } from "@/services/interview.api";
import { Interview } from "@/types";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { InterviewCard } from "@/components/interviews/InterviewCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";

const TABS: { value: NonNullable<InterviewFilters["tab"]>; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No-Shows" },
];

export default function InterviewsPage() {
  const [tab, setTab] = useState<InterviewFilters["tab"]>("upcoming");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const roles = interviewService.getRoles();

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await interviewService.getInterviews({ tab, search, role });
      setInterviews(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tab, search, role]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Interviews</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Track scheduled, completed, and missed interviews.</p>
      </motion.div>

      <Tabs defaultValue="upcoming">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                <span onClick={() => setTab(t.value)}>{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex gap-2">
            <Input
              placeholder="Search candidate..."
              icon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48"
            />
            <Select value={role} onChange={(e) => setRole(e.target.value)} className="w-40">
              <option value="all">All Roles</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : error ? (
              <Card>
                <ErrorState onRetry={load} />
              </Card>
            ) : interviews.length === 0 ? (
              <Card>
                <EmptyState icon={Video} title={`No ${t.label.toLowerCase()} interviews`} description="Check back later or adjust your filters." />
              </Card>
            ) : (
              <div className="space-y-3">
                {interviews.map((interview, i) => (
                  <InterviewCard key={interview.id} interview={interview} index={i} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}