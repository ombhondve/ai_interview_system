"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronRight,
  MapPin,
} from "lucide-react";

import { Candidate } from "@/types";

import { Avatar } from "@/components/ui/Avatar";

import {
  Badge,
  statusToBadgeVariant,
} from "@/components/ui/Badge";


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
// CANDIDATE CARD
// =====================================================

export function CandidateCard({
  candidate,
  index,
}: {
  candidate: Candidate;
  index: number;
}) {
  const router = useRouter();


  // =====================================================
  // SAFE VALUES
  // =====================================================

  const name =
    candidate.name ||
    "Unknown Candidate";

  const role =
    candidate.role ||
    "Role not specified";

  const location =
    candidate.location ||
    "Location not available";

  const jdMatchScore =
    typeof candidate.jdMatchScore === "number"
      ? candidate.jdMatchScore
      : 0;


  // =====================================================
  // RENDER
  // =====================================================

  return (
    <motion.button
      type="button"

      initial={{
        opacity: 0,
        y: 8,
      }}

      animate={{
        opacity: 1,
        y: 0,
      }}

      transition={{
        delay: index * 0.04,
        duration: 0.25,
      }}

      onClick={() =>
        router.push(
          `/admin/candidates/${candidate.id}`
        )
      }

      className="
        surface
        flex
        w-full
        items-center
        gap-3
        rounded-xl
        border
        p-4
        text-left
        shadow-subtle
        active:scale-[0.99]
      "
    >

      {/* =================================================
          AVATAR
      ================================================= */}

      <Avatar
        name={name}
        size="md"
      />


      {/* =================================================
          CANDIDATE INFORMATION
      ================================================= */}

      <div className="min-w-0 flex-1">

        {/* ===============================================
            NAME + JD SCORE
        =============================================== */}

        <div className="flex items-center justify-between gap-2">

          <p
            className="
              truncate
              text-sm
              font-semibold
              text-slate-900
              dark:text-white
            "
          >
            {name}
          </p>


          <span
            className="
              shrink-0
              text-sm
              font-semibold
              text-success-600
            "
          >
            {jdMatchScore}%
          </span>

        </div>


        {/* ===============================================
            ROLE
        =============================================== */}

        <p
          className="
            mt-0.5
            truncate
            text-xs
            text-slate-500
            dark:text-slate-400
          "
        >
          {role}
        </p>


        {/* ===============================================
            LOCATION
        =============================================== */}

        <div
          className="
            mt-1.5
            flex
            items-center
            gap-1
            text-xs
            text-slate-400
          "
        >

          <MapPin className="h-3 w-3" />

          <span className="truncate">
            {location}
          </span>

        </div>


        {/* ===============================================
            STATUS
        =============================================== */}

        <div className="mt-2">

          <Badge
            variant={
              statusToBadgeVariant[
                candidate.status
              ] || "neutral"
            }
          >
            {statusLabel(
              candidate.status
            )}
          </Badge>

        </div>

      </div>


      {/* =================================================
          ARROW
      ================================================= */}

      <ChevronRight
        className="
          h-4
          w-4
          shrink-0
          text-slate-300
          dark:text-slate-600
        "
      />

    </motion.button>
  );
}
