"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Slot } from "@/types";

export function CancelSlotModal({
  open,
  slot,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  slot: Slot | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!slot) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cancel Slot"
      description={`This will cancel the slot on ${slot.date} at ${slot.startTime}${slot.bookedBy ? `. ${slot.bookedBy} has already booked this — they'll be notified.` : "."}`}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Keep Slot
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} loading={loading}>
            Cancel Slot
          </Button>
        </>
      }
    />
  );
}