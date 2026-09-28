"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";


// =====================================================
// REJECT CANDIDATE MODAL
// =====================================================

export function RejectCandidateModal({
  open,
  candidateName,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  candidateName: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {

  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);


  // =====================================================
  // CONFIRM REJECTION
  // =====================================================

  const handleConfirm = () => {

    setTouched(true);

    const trimmedReason =
      reason.trim();

    if (!trimmedReason) {
      return;
    }

    onConfirm(trimmedReason);
  };


  // =====================================================
  // CLOSE MODAL
  // =====================================================

  const handleClose = () => {

    if (loading) {
      return;
    }

    setReason("");
    setTouched(false);

    onClose();
  };


  // =====================================================
  // RENDER
  // =====================================================

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Reject Candidate"
      description="This action will notify the candidate. Please provide a reason."
      footer={
        <>
          {/* CANCEL */}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>


          {/* CONFIRM */}

          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            loading={loading}
            disabled={loading}
          >
            Confirm Rejection
          </Button>
        </>
      }
    >

      {/* =================================================
          CANDIDATE
      ================================================= */}

      <div
        className="
          mb-4
          flex
          items-center
          gap-3
          rounded-lg
          bg-slate-50
          p-3
          dark:bg-white/5
        "
      >

        <Avatar
          name={candidateName || "Unknown"}
          size="md"
        />

        <p
          className="
            text-sm
            font-medium
            text-slate-900
            dark:text-white
          "
        >
          {candidateName || "Unknown"}
        </p>

      </div>


      {/* =================================================
          REASON LABEL
      ================================================= */}

      <label
        htmlFor="rejection-reason"
        className="
          mb-1.5
          block
          text-sm
          font-medium
          text-slate-700
          dark:text-slate-300
        "
      >
        Reason for rejection
      </label>


      {/* =================================================
          REASON INPUT
      ================================================= */}

      <textarea
        id="rejection-reason"
        value={reason}
        onChange={(event) =>
          setReason(event.target.value)
        }
        rows={3}
        disabled={loading}
        placeholder="e.g. Skill set does not match the JD requirements"
        className="
          w-full
          rounded-lg
          border
          border-slate-200
          bg-white
          px-3
          py-2
          text-sm
          text-slate-900
          placeholder:text-slate-400
          focus:border-accent-500
          focus:outline-none
          focus:ring-2
          focus:ring-accent-500/30
          disabled:cursor-not-allowed
          disabled:opacity-60
          dark:border-white/10
          dark:bg-white/5
          dark:text-white
        "
      />


      {/* =================================================
          VALIDATION ERROR
      ================================================= */}

      {touched && !reason.trim() && (

        <p className="mt-1.5 text-xs text-danger-600">
          A reason is required to reject a candidate.
        </p>

      )}

    </Modal>
  );
}