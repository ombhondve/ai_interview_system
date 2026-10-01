import { Interview } from "@/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export function ResponsesTab({ interview }: { interview: Interview }) {
  if (interview.qa.length === 0) {
    return (
      <Card>
        <EmptyState icon={MessageSquare} title="No responses recorded" description="Candidate responses will appear here after the interview." />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Candidate Responses" />
      <div className="divide-y divide-slate-50 px-6 dark:divide-white/5">
        {interview.qa.map((item, i) => (
          <div key={item.id} className="py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Q{i + 1}. {item.question}</p>
            <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-300">
              {item.response}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Response quality:</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, s) => (
                  <span
                    key={s}
                    className={cn("h-1.5 w-4 rounded-full", s < item.score ? "bg-accent-500" : "bg-slate-100 dark:bg-white/10")}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
