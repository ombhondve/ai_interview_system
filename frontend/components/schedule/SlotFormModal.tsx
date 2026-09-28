"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Slot } from "@/types";
import { CreateSlotInput } from "@/services/slot.api";

export function SlotFormModal({
  open,
  mode,
  initialData,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  initialData?: Slot | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: CreateSlotInput) => void;
}) {
  const [form, setForm] = useState<CreateSlotInput>({
    date: new Date().toISOString().split("T")[0],
    startTime: "10:00 AM",
    endTime: "10:45 AM",
    timezone: "IST",
    capacity: 1,
    role: "Full Stack Developer",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setForm({
        date: initialData.date,
        startTime: initialData.startTime,
        endTime: initialData.endTime,
        timezone: initialData.timezone,
        capacity: initialData.capacity,
        role: initialData.role,
      });
    }
  }, [initialData, open]);

  const handleSubmit = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.date) nextErrors.date = "Date is required";
    if (!form.startTime) nextErrors.startTime = "Start time is required";
    if (!form.endTime) nextErrors.endTime = "End time is required";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSubmit(form);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Create Interview Slot" : "Edit Interview Slot"}
      description={mode === "create" ? "Define a new time slot students can book." : "Update this slot's timing or capacity."}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={loading}>
            {mode === "create" ? "Create Slot" : "Save Changes"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Date"
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          error={errors.date}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start Time"
            placeholder="10:00 AM"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            error={errors.startTime}
          />
          <Input
            label="End Time"
            placeholder="10:45 AM"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            error={errors.endTime}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Timezone"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          >
            <option value="IST">IST (India)</option>
            <option value="UTC">UTC</option>
            <option value="PST">PST</option>
          </Select>
          <Input
            label="Capacity"
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
          />
        </div>
        <Select
          label="Role"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option>Full Stack Developer</option>
          <option>Frontend Developer</option>
          <option>Backend Developer</option>
          <option>AI/ML Intern</option>
        </Select>
      </div>
    </Modal>
  );
}