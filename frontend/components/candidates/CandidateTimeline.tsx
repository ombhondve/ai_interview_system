"use client";

import { motion } from "framer-motion";
import {
  Check,
  Circle,
  Clock,
} from "lucide-react";

import { Candidate } from "@/types";

import {
  Card,
  CardHeader,
} from "@/components/ui/Card";

import { cn } from "@/lib/utils";


// =====================================================
// CANDIDATE TIMELINE
// =====================================================

export function CandidateTimeline({
  candidate,
}: {
  candidate: Candidate;
}) {

  const activity = candidate.activity ?? [];


  // =====================================================
  // EMPTY TIMELINE
  // =====================================================

  if (activity.length === 0) {
    return (
      <Card>

        <CardHeader title="Activity Timeline" />

        <div className="px-6 pb-6 pt-2">

          <p className="text-sm text-slate-500 dark:text-slate-400">
            No activity recorded yet.
          </p>

        </div>

      </Card>
    );
  }


  // =====================================================
  // TIMELINE
  // =====================================================

  return (
    <Card>

      <CardHeader title="Activity Timeline" />

      <div className="px-6 pb-6 pt-2">

        {activity.map((event, index) => {

          const isComplete =
            event.state === "complete";

          const isCurrent =
            event.state === "current";

          const isLast =
            index === activity.length - 1;


          return (
            <motion.div
              key={
                event.id ||
                `activity-${index}`
              }

              initial={{
                opacity: 0,
                x: -10,
              }}

              animate={{
                opacity: 1,
                x: 0,
              }}

              transition={{
                delay: index * 0.08,
                duration: 0.25,
              }}

              className="
                relative
                flex
                gap-4
                pb-8
                last:pb-0
              "
            >

              {/* =================================================
                  CONNECTING LINE
              ================================================= */}

              {!isLast && (

                <span
                  className={cn(
                    `
                      absolute
                      left-[15px]
                      top-8
                      h-full
                      w-px
                    `,
                    isComplete
                      ? `
                        bg-accent-200
                        dark:bg-accent-500/30
                      `
                      : `
                        bg-slate-200
                        dark:bg-white/10
                      `
                  )}
                />

              )}


              {/* =================================================
                  STATUS ICON
              ================================================= */}

              <div
                className={cn(
                  `
                    z-10
                    flex
                    h-8
                    w-8
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                  `,

                  isComplete &&
                    `
                      bg-success-500
                      text-white
                    `,

                  isCurrent &&
                    `
                      bg-accent-600
                      text-white
                    `,

                  !isComplete &&
                    !isCurrent &&
                    `
                      bg-slate-100
                      text-slate-400
                      dark:bg-white/5
                    `
                )}
              >

                {isComplete && (
                  <Check className="h-4 w-4" />
                )}

                {isCurrent && (
                  <Clock className="h-4 w-4" />
                )}

                {!isComplete &&
                  !isCurrent && (
                    <Circle className="h-3 w-3" />
                  )}

              </div>


              {/* =================================================
                  EVENT CONTENT
              ================================================= */}

              <div className="flex-1 pt-1">

                <div className="flex flex-wrap items-center justify-between gap-2">

                  <p
                    className={cn(
                      "text-sm font-medium",

                      !isComplete &&
                        !isCurrent
                        ? "text-slate-400"
                        : `
                          text-slate-900
                          dark:text-white
                        `
                    )}
                  >
                    {event.label ||
                      "Activity"}
                  </p>


                  {/* TIMESTAMP */}

                  {event.timestamp && (

                    <span className="text-xs text-slate-400">

                      {new Date(
                        event.timestamp
                      ).toLocaleString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        }
                      )}

                    </span>

                  )}

                </div>


                {/* DESCRIPTION */}

                {event.description && (

                  <p
                    className="
                      mt-0.5
                      text-xs
                      text-slate-500
                      dark:text-slate-400
                    "
                  >
                    {event.description}
                  </p>

                )}

              </div>

            </motion.div>
          );
        })}

      </div>

    </Card>
  );
}