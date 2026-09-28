"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Video, FolderKanban, ChevronRight } from "lucide-react";
import { Interview } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, statusToBadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export function InterviewCard({ interview, index }: { interview: Interview; index: number }) {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className="surface flex flex-col gap-3 rounded-xl border p-4 shadow-subtle sm:flex-row sm:items-center"
    >
      <div className="flex items-center gap-3 sm:flex-1">
        <Avatar name={interview.candidateName} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{interview.candidateName}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{interview.role}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400 sm:flex-1">
        <span>
          {new Date(interview.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {interview.time}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FolderKanban className="h-3.5 w-3.5" />
          {interview.project}
        </span>
        {interview.status === "scheduled" && (
          <span className="inline-flex items-center gap-1.5 text-accent-600 dark:text-accent-400">
            <Video className="h-3.5 w-3.5" />
            Google Meet ready
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 sm:justify-end">
        <Badge variant={statusToBadgeVariant[interview.status]} className="capitalize">
          {interview.status.replace("_", " ")}
        </Badge>
        <Button size="sm" variant="outline" onClick={() => router.push(`/admin/interviews/${interview.id}`)}>
          View
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}