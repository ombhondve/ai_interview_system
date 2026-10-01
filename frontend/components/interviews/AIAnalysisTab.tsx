import { Sparkles, ThumbsUp, AlertCircle } from "lucide-react";
import { Interview } from "@/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";

const recVariant = { select: "success", reject: "danger", borderline: "warning" } as const;
const recLabel = { select: "Recommend to Select", reject: "Recommend to Reject", borderline: "Borderline" } as const;

export function AIAnalysisTab({ interview }: { interview: Interview }) {
  if (!interview.aiAnalysis) {
    return (
      <Card>
        <EmptyState icon={Sparkles} title="AI analysis pending" description="This will be generated automatically once the interview is complete." />
      </Card>
    );
  }

  const a = interview.aiAnalysis;

  return (
    <div className="space-y-5">
      <Card className="border-accent-100 dark:border-accent-500/20">
        <CardHeader
          title="AI Summary"
          action={<Badge variant={recVariant[a.recommendation]}>{recLabel[a.recommendation]}</Badge>}
        />
        <CardContent>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{a.summary}</p>
          <p className="mt-3 text-xs text-slate-400">
            This is an AI-generated recommendation — not the final decision. See the Performance Report tab for the admin decision panel.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2">
        <Card>
          <CardHeader title="Strengths" />
          <CardContent className="space-y-2">
            {a.strengths.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <ThumbsUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-500" />
                {s}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Areas for Improvement" />
          <CardContent className="space-y-2">
            {a.improvements.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-500" />
                {s}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
