"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Slot } from "@/types";
import { cn } from "@/lib/utils";

type ViewMode = "month" | "week" | "day";

const statusDot = {
  available: "bg-success-500",
  booked: "bg-accent-600",
  cancelled: "bg-slate-300 dark:bg-slate-600",
};

function toKey(d: Date) {
  return d.toISOString().split("T")[0];
}

export function CalendarView({
  view,
  focusedDate,
  slots,
  selectedDate,
  onSelectDate,
}: {
  view: ViewMode;
  focusedDate: Date;
  slots: Slot[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const slotsByDate = useMemo(() => {
    const map: Record<string, Slot[]> = {};
    for (const s of slots) {
      map[s.date] = map[s.date] ? [...map[s.date], s] : [s];
    }
    return map;
  }, [slots]);

  if (view === "month") {
    const year = focusedDate.getFullYear();
    const month = focusedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = toKey(new Date());

    const cells: (Date | null)[] = [
      ...Array.from({ length: startOffset }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
    ];

    return (
      <div>
        <div className="grid grid-cols-7 border-b border-slate-100 dark:border-white/5">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-slate-400">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            if (!date) return <div key={i} className="min-h-[88px] border-b border-r border-slate-50 dark:border-white/5" />;
            const key = toKey(date);
            const daySlots = slotsByDate[key] ?? [];
            const isToday = key === today;
            const isSelected = key === selectedDate;

            return (
              <button
                key={i}
                onClick={() => onSelectDate(key)}
                className={cn(
                  "min-h-[88px] border-b border-r border-slate-50 p-2 text-left transition-colors dark:border-white/5",
                  "hover:bg-slate-50 dark:hover:bg-white/[0.03]",
                  isSelected && "bg-accent-50 dark:bg-accent-500/10"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    isToday ? "bg-accent-600 text-white" : "text-slate-600 dark:text-slate-300"
                  )}
                >
                  {date.getDate()}
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {daySlots.slice(0, 4).map((s) => (
                    <span key={s.id} className={cn("h-1.5 w-1.5 rounded-full", statusDot[s.status])} />
                  ))}
                  {daySlots.length > 4 && <span className="text-[10px] text-slate-400">+{daySlots.length - 4}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === "week") {
    const start = new Date(focusedDate);
    start.setDate(start.getDate() - start.getDay());
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
    const today = toKey(new Date());

    return (
      <div className="grid grid-cols-7 divide-x divide-slate-50 dark:divide-white/5">
        {days.map((date) => {
          const key = toKey(date);
          const daySlots = (slotsByDate[key] ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime));
          const isSelected = key === selectedDate;
          return (
            <button
              key={key}
              onClick={() => onSelectDate(key)}
              className={cn(
                "min-h-[220px] p-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]",
                isSelected && "bg-accent-50 dark:bg-accent-500/10"
              )}
            >
              <p className="text-xs font-semibold text-slate-500">
                {date.toLocaleDateString("en-US", { weekday: "short" })}
              </p>
              <span
                className={cn(
                  "mt-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  key === today ? "bg-accent-600 text-white" : "text-slate-700 dark:text-slate-300"
                )}
              >
                {date.getDate()}
              </span>
              <div className="mt-2 space-y-1">
                {daySlots.map((s) => (
                  <div key={s.id} className="flex items-center gap-1.5 rounded-md bg-slate-50 px-1.5 py-1 text-[10px] dark:bg-white/5">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDot[s.status])} />
                    <span className="truncate text-slate-600 dark:text-slate-300">{s.startTime}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // day view
  const key = toKey(focusedDate);
  const daySlots = (slotsByDate[key] ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="p-4">
      <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
        {focusedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </p>
      {daySlots.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No slots for this day.</p>
      ) : (
        <div className="space-y-2">
          {daySlots.map((s, i) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onSelectDate(key)}
              className="flex w-full items-center gap-3 rounded-lg border border-slate-100 p-3 text-left hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/[0.03]"
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", statusDot[s.status])} />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {s.startTime} – {s.endTime}
              </span>
              <span className="ml-auto text-xs capitalize text-slate-400">{s.status}</span>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
