"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Video, ExternalLink } from "lucide-react";
import { interviewService } from "@/services/interview.api";
import { Interview } from "@/types";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, statusToBadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { InterviewOverviewTab } from "@/components/interviews/InterviewOverviewTab";
import { QuestionsTab } from "@/components/interviews/QuestionsTab";
import { ResponsesTab } from "@/components/interviews/ResponsesTab";
import { ProjectWalkthroughTab } from "@/components/interviews/ProjectWalkthroughTab";
import { IntegrityIndicatorsTab } from "@/components/interviews/IntegrityIndicatorsTab";
import { AIAnalysisTab } from "@/components/interviews/AIAnalysisTab";
import { PerformanceReportTab } from "@/components/interviews/PerformanceReportTab";

export default function InterviewDetailPage() {
  const params = useParams<{ interviewId: string }>();
  const router = useRouter();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await interviewService.getInterview(params.interviewId);
      if (!data) setError(true);
      else setInterview(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [params.interviewId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !interview) {
    return (
      <Card>
        <ErrorState title="Interview not found" onRetry={() => router.push("/admin/interviews")} />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="surface rounded-2xl border p-6 shadow-subtle">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Avatar name={interview.candidateName} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{interview.candidateName}</h1>
                <Badge variant={statusToBadgeVariant[interview.status]} className="capitalize">
                  {interview.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {interview.role} · {new Date(interview.date).toLocaleDateString("en-US", { month: "long", day: "numeric" })} at {interview.time}
              </p>
            </div>
          </div>
          {interview.status === "scheduled" && (
            <Button>
              <Video className="h-4 w-4" />
              Join Google Meet
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </motion.div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="responses">Responses</TabsTrigger>
          <TabsTrigger value="walkthrough">Project Walkthrough</TabsTrigger>
          <TabsTrigger value="integrity">Integrity Indicators</TabsTrigger>
          <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
          <TabsTrigger value="report">Performance Report</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><InterviewOverviewTab interview={interview} /></TabsContent>
        <TabsContent value="questions"><QuestionsTab interview={interview} /></TabsContent>
        <TabsContent value="responses"><ResponsesTab interview={interview} /></TabsContent>
        <TabsContent value="walkthrough"><ProjectWalkthroughTab interview={interview} /></TabsContent>
        <TabsContent value="integrity"><IntegrityIndicatorsTab interview={interview} /></TabsContent>
        <TabsContent value="analysis"><AIAnalysisTab interview={interview} /></TabsContent>
        <TabsContent value="report"><PerformanceReportTab interview={interview} /></TabsContent>
      </Tabs>
    </div>
  );
}