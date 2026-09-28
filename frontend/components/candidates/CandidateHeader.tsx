"use client";

import { motion } from "framer-motion";
import {
  Mail,
  Phone,
  MapPin,
  Check,
  X,
} from "lucide-react";

import { Candidate } from "@/types";

import { Avatar } from "@/components/ui/Avatar";

import {
  Badge,
  statusToBadgeVariant,
} from "@/components/ui/Badge";

import { Button } from "@/components/ui/Button";

// =====================================================
// STATUS LABEL
// =====================================================

function statusLabel(status?: string) {
  if (!status) {
    return "Unknown";
  }

  return status
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

// =====================================================
// CANDIDATE HEADER
// =====================================================

export function CandidateHeader({
  candidate,
  onApprove,
  onReject,
}: {
  candidate: Candidate;
  onApprove: () => void;
  onReject: () => void;
}) {
  // =====================================================
  // ADMIN DECISION
  // =====================================================
  // Approve / Reject should be available only when
  // the candidate is waiting for an admin decision.
  //
  // Your backend uses:
  // received
  // under_review
  // approved
  // rejected
  // =====================================================

  const canDecide =
    candidate.status === "received" ||
    candidate.status === "under_review";

  // =====================================================
  // SAFE VALUES
  // =====================================================

  const name =
    candidate.name || "Unknown Candidate";

  const role =
    candidate.role || "Role not specified";

  const batch =
    candidate.batch || "Batch not assigned";

  const email =
    candidate.email || "Email not available";

  const phone =
    candidate.phone || "Phone not available";

  const location =
    candidate.location || "Location not available";

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -8,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      className="surface rounded-2xl border p-6 shadow-subtle"
    >
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">

        {/* =================================================
            CANDIDATE INFORMATION
        ================================================= */}

        <div className="flex items-start gap-4">

          {/* Avatar */}

          <Avatar
            name={name}
            size="lg"
          />

          <div>

            {/* =================================================
                NAME + STATUS
            ================================================= */}

            <div className="flex flex-wrap items-center gap-2">

              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
                {name}
              </h1>

              <Badge
                variant={
                  statusToBadgeVariant[
                    candidate.status
                  ] || "neutral"
                }
              >
                {statusLabel(candidate.status)}
              </Badge>

            </div>

            {/* =================================================
                ROLE + BATCH
            ================================================= */}

            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {role}

              <span className="mx-1">
                ·
              </span>

              {batch}
            </p>

            {/* =================================================
                CONTACT INFORMATION
            ================================================= */}

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">

              {/* Email */}

              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {email}
              </span>

              {/* Phone */}

              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {phone}
              </span>

              {/* Location */}

              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {location}
              </span>

            </div>

          </div>

        </div>

        {/* =================================================
            APPROVE / REJECT BUTTONS
        ================================================= */}

        {canDecide && (
          <div className="flex shrink-0 gap-2">

            {/* Reject */}

            <Button
              type="button"
              variant="outline"
              onClick={onReject}
            >
              <X className="h-4 w-4" />
              Reject
            </Button>

            {/* Approve */}

            <Button
              type="button"
              onClick={onApprove}
            >
              <Check className="h-4 w-4" />
              Approve
            </Button>

          </div>
        )}

      </div>
    </motion.div>
  );
}