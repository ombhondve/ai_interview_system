import { Interview } from "@/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { HelpCircle } from "lucide-react";

const categoryVariant = { resume: "info", technical: "accent", behavioral: "warning", project: "success" } as const;

export function QuestionsTab({ interview }: { interview: Interview }) {
  if (interview.qa.length === 0) {
    return (
      <Card>
        <EmptyState icon={HelpCircle} title="No questions yet" description="Questions will appear here once the interview is completed." />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Interview Questions" subtitle={`${interview.qa.length} questions asked`} />
      <div className="divide-y divide-slate-50 px-6 dark:divide-white/5">
        {interview.qa.map((item, i) => (
          <div key={item.id} className="py-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                <span className="mr-2 text-slate-400">Q{i + 1}.</span>
                {item.question}
              </p>
              <Badge variant={categoryVariant[item.category]} className="shrink-0 capitalize">
                {item.category}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}