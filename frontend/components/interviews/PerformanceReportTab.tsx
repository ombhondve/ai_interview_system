"use client";

import { useState } from "react";
import { Interview } from "@/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { CircularProgress, ProgressBar } from "@/components/ui/Progress";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { FileBarChart } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

type Decision = "selected" | "rejected" | "pending";

export function PerformanceReportTab({ interview }: { interview: Interview }) {
  const { toast } = useToast();
  const [decision, setDecision] = useState<Decision>("pending");
  const [confirmDecision, setConfirmDecision] = useState<Decision | null>(null);

  if (!interview.scores || interview.overallScore === undefined) {
    return (
      <Card>
        <EmptyState icon={FileBarChart} title="Report not ready" description="The performance report will be generated once the interview is completed." />
      </Card>
    );
  }

  const handleConfirm = () => {
    if (!confirmDecision) return;
    setDecision(confirmDecision);
    toast({
      type: "success",
      title: `Decision recorded: ${confirmDecision === "selected" ? "Selected" : confirmDecision === "rejected" ? "Rejected" : "Kept Pending"}`,
      description: `${interview.candidateName} has been updated.`,
    });
    setConfirmDecision(null);
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Overall Score" />
        <CardContent className="flex flex-col items-center py-6">
          <CircularProgress value={interview.overallScore} size={130} label="/ 100" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Score Breakdown" />
        <CardContent className="space-y-4">
          <ProgressBar label="Communication" value={interview.scores.communication} color="accent" />
          <ProgressBar label="Technical Knowledge" value={interview.scores.technical} color="accent" />
          <ProgressBar label="Problem Solving" value={interview.scores.problemSolving} color="accent" />
          <ProgressBar label="Project Walkthrough" value={interview.scores.project} color="accent" />
        </CardContent>
      </Card>

      <Card className="border-accent-100 bg-accent-50/40 dark:border-accent-500/20 dark:bg-accent-500/5">
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">AI Recommendation</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Generated automatically — not the final decision</p>
          </div>
          {interview.aiAnalysis && (
            <Badge variant={interview.aiAnalysis.recommendation === "select" ? "success" : interview.aiAnalysis.recommendation === "reject" ? "danger" : "warning"}>
              {interview.aiAnalysis.recommendation === "select" ? "Select" : interview.aiAnalysis.recommendation === "reject" ? "Reject" : "Borderline"}
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Final Admin Decision" subtitle="This is a human decision, made independently of the AI recommendation." />
        <CardContent>
          {decision !== "pending" && (
            <div className="mb-4">
              <Badge variant={decision === "selected" ? "success" : "danger"}>
                Decision: {decision === "selected" ? "Selected" : "Rejected"}
              </Badge>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setConfirmDecision("selected")}>Select Candidate</Button>
            <Button variant="destructive" onClick={() => setConfirmDecision("rejected")}>Reject Candidate</Button>
            <Button variant="outline" onClick={() => setConfirmDecision("pending")}>Keep Pending</Button>
          </div>
        </CardContent>
      </Card>

      <Modal
        open={!!confirmDecision}
        onClose={() => setConfirmDecision(null)}
        title="Confirm Final Decision"
        description={`Confirm final decision for ${interview.candidateName}?`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmDecision(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirm}>
              Confirm
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This action will notify the candidate and update their status. It cannot be automatically undone.
        </p>
      </Modal>
    </div>
  );
}