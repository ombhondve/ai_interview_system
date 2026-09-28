import { FolderKanban } from "lucide-react";
import { Interview } from "@/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/Progress";

export function ProjectWalkthroughTab({ interview }: { interview: Interview }) {
  if (!interview.projectWalkthrough) {
    return (
      <Card>
        <EmptyState icon={FolderKanban} title="No walkthrough recorded" description="This will populate once the candidate completes their project demo." />
      </Card>
    );
  }

  const w = interview.projectWalkthrough;

  return (
    <Card>
      <CardHeader title="Project Walkthrough" subtitle={w.projectTitle} />
      <CardContent className="space-y-5">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{w.summary}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ProgressBar label="Code Quality" value={w.codeQualityScore} color="accent" />
          <ProgressBar label="Explanation Clarity" value={w.explanationClarityScore} color="success" />
          <ProgressBar label="Ownership" value={w.ownershipScore} color="warning" />
        </div>
      </CardContent>
    </Card>
  );
}