"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { slotService, CreateSlotInput } from "@/services/slot.api";
import { Slot } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";
import { CalendarView } from "@/components/schedule/CalendarView";
import { SlotList } from "@/components/schedule/SlotList";
import { SlotFormModal } from "@/components/schedule/SlotFormModal";
import { CancelSlotModal } from "@/components/schedule/CancelSlotModal";
import { cn } from "@/lib/utils";

type ViewMode = "month" | "week" | "day";

function toKey(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function SchedulePage() {
  const { toast } = useToast();
  const [view, setView] = useState<ViewMode>("month");
  const [focusedDate, setFocusedDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(toKey(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editSlot, setEditSlot] = useState<Slot | null>(null);
  const [cancelSlot, setCancelSlot] = useState<Slot | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await slotService.getSlots();
      setSlots(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const navigate = (dir: -1 | 1) => {
    const next = new Date(focusedDate);
    if (view === "month") next.setMonth(next.getMonth() + dir);
    if (view === "week") next.setDate(next.getDate() + dir * 7);
    if (view === "day") next.setDate(next.getDate() + dir);
    setFocusedDate(next);
  };

  const handleCreate = async (input: CreateSlotInput) => {
    setActionLoading(true);
    const created = await slotService.createSlot(input);
    setSlots((prev) => [...prev, created]);
    setActionLoading(false);
    setCreateOpen(false);
    toast({ type: "success", title: "Slot created", description: `${input.date} at ${input.startTime}` });
  };

  const handleEdit = async (input: CreateSlotInput) => {
    if (!editSlot) return;
    setActionLoading(true);
    const updated = await slotService.updateSlot(editSlot.id, input);
    if (updated) setSlots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setActionLoading(false);
    setEditSlot(null);
    toast({ type: "success", title: "Slot updated" });
  };

  const handleCancel = async () => {
    if (!cancelSlot) return;
    setActionLoading(true);
    const updated = await slotService.cancelSlot(cancelSlot.id);
    if (updated) setSlots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setActionLoading(false);
    setCancelSlot(null);
    toast({ type: "warning", title: "Slot cancelled", description: cancelSlot.bookedBy ? `${cancelSlot.bookedBy} will be notified.` : undefined });
  };

  const daySlots = slots.filter((s) => s.date === selectedDate);

  const headerLabel =
    view === "month"
      ? focusedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : view === "week"
      ? `Week of ${focusedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : focusedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Schedule</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage interview slots and availability.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Slot
        </Button>
      </motion.div>

      <Card className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[160px] text-sm font-semibold text-slate-900 dark:text-white">{headerLabel}</span>
            <button onClick={() => navigate(1)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
              <ChevronRight className="h-4 w-4" />
            </button>
            <Button size="sm" variant="ghost" onClick={() => { setFocusedDate(new Date()); setSelectedDate(toKey(new Date())); }}>
              Today
            </Button>
          </div>
          <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10">
            {(["month", "week", "day"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  view === v ? "bg-accent-600 text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 px-5 py-2.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success-500" />Available</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent-600" />Booked</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />Cancelled</span>
        </div>

        {loading ? (
          <div className="p-5">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : (
          <CalendarView
            view={view}
            focusedDate={focusedDate}
            slots={slots}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-5 py-3.5 dark:border-white/5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Slots for {new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </h3>
        </div>
        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <SlotList date={selectedDate} slots={daySlots} onEdit={setEditSlot} onCancel={setCancelSlot} />
        )}
      </Card>

      <SlotFormModal
        open={createOpen}
        mode="create"
        loading={actionLoading}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
      <SlotFormModal
        open={!!editSlot}
        mode="edit"
        initialData={editSlot}
        loading={actionLoading}
        onClose={() => setEditSlot(null)}
        onSubmit={handleEdit}
      />
      <CancelSlotModal
        open={!!cancelSlot}
        slot={cancelSlot}
        loading={actionLoading}
        onClose={() => setCancelSlot(null)}
        onConfirm={handleCancel}
      />
    </div>
  );
}