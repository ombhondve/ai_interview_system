import { CalendarDays, Clock3, FolderKanban, Mail, UserRound, Video } from "lucide-react";
import { Interview } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export function InterviewOverviewTab({ interview }: { interview: Interview }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Interview details" />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Info icon={UserRound} label="Candidate" value={interview.candidateName} />
          <Info icon={Mail} label="Email" value={interview.candidateEmail} />
          <Info icon={CalendarDays} label="Date" value={interview.date} />
          <Info icon={Clock3} label="Time" value={`${interview.time} · ${interview.durationMinutes} min`} />
          <Info icon={FolderKanban} label="Assigned project" value={interview.project} />
          <Info icon={Video} label="Meeting" value={interview.meetLink ? "Google Meet" : "Not available"} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Interview outcome" />
        <CardContent>
          {interview.overallScore !== undefined ? (
            <div>
              <p className="text-3xl font-semibold text-slate-900 dark:text-white">{interview.overallScore}%</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Overall interview score</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">The performance score will appear after the interview is completed and analyzed.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-slate-800 dark:text-slate-200">{value}</p>
      </div>
    </div>
  );
}
