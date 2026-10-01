"use client";

import { CalendarX2, Clock, User } from "lucide-react";
import { motion } from "framer-motion";
import { Slot } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const statusVariant = { available: "success", booked: "accent", cancelled: "neutral" } as const;

export function SlotList({
  date,
  slots,
  onEdit,
  onCancel,
}: {
  date: string;
  slots: Slot[];
  onEdit: (slot: Slot) => void;
  onCancel: (slot: Slot) => void;
}) {
  if (slots.length === 0) {
    return (
      <EmptyState
        icon={CalendarX2}
        title="No slots on this day"
        description="Create a new interview slot to get started."
      />
    );
  }

  return (
    <div className="divide-y divide-slate-50 dark:divide-white/5">
      {slots
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/5">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {s.startTime} – {s.endTime}
                  <span className="ml-2 text-xs font-normal text-slate-400">{s.timezone}</span>
                </p>
                {s.role && <p className="text-xs text-slate-500 dark:text-slate-400">{s.role}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {s.bookedBy && (
                <span className="hidden items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 sm:flex">
                  <User className="h-3.5 w-3.5" />
                  {s.bookedBy}
                </span>
              )}
              <Badge variant={statusVariant[s.status]} className="capitalize">
                {s.status}
              </Badge>
              {s.status !== "cancelled" && (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => onEdit(s)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-danger-600" onClick={() => onCancel(s)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
    </div>
  );
}
