"use client";

import {
  CalendarClock,
  Video,
} from "lucide-react";

import { Candidate } from "@/types";

import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/ui/Card";

import {
  Badge,
  statusToBadgeVariant,
} from "@/components/ui/Badge";

import { EmptyState } from "@/components/ui/EmptyState";

import { Button } from "@/components/ui/Button";


// =====================================================
// INTERVIEW TAB
// =====================================================

export function CandidateInterviewTab({
  candidate,
}: {
  candidate: Candidate;
}) {

  // =====================================================
  // CHECK INTERVIEW
  // =====================================================

  const hasInterview =
    candidate.interviewStatus === "scheduled" ||
    !!candidate.interviewDate ||
    !!candidate.interviewUrl;


  // =====================================================
  // NO INTERVIEW
  // =====================================================

  if (!hasInterview) {
    return (
      <Card>

        <EmptyState
          icon={CalendarClock}
          title="No interview scheduled"
          description="This candidate hasn't booked an interview slot yet."
        />

      </Card>
    );
  }


  // =====================================================
  // INTERVIEW STATUS
  // =====================================================

  const interviewStatus =
    candidate.interviewStatus ||
    "pending";


  // =====================================================
  // INTERVIEW DATE
  // =====================================================

  let interviewDate = "Not scheduled";

  if (candidate.interviewDate) {
    const date = new Date(
      candidate.interviewDate
    );

    if (!Number.isNaN(date.getTime())) {
      interviewDate =
        date.toLocaleDateString(
          "en-US",
          {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          }
        );
    }
  }


  // =====================================================
  // INTERVIEW TIME
  // =====================================================

  let interviewTime = "Not specified";

  if (candidate.interviewDate) {
    const date = new Date(
      candidate.interviewDate
    );

    if (!Number.isNaN(date.getTime())) {
      interviewTime =
        date.toLocaleTimeString(
          "en-US",
          {
            hour: "numeric",
            minute: "2-digit",
          }
        );
    }
  }


  // =====================================================
  // RENDER
  // =====================================================

  return (
    <Card>

      <CardHeader
        title="Interview Details"
      />

      <CardContent
        className="
          grid
          grid-cols-1
          gap-4
          sm:grid-cols-2
        "
      >

        {/* =================================================
            DATE
        ================================================= */}

        <div>

          <p
            className="
              text-xs
              font-medium
              uppercase
              tracking-wide
              text-slate-400
            "
          >
            Date
          </p>

          <p
            className="
              mt-1
              text-sm
              text-slate-800
              dark:text-slate-200
            "
          >
            {interviewDate}
          </p>

        </div>


        {/* =================================================
            TIME
        ================================================= */}

        <div>

          <p
            className="
              text-xs
              font-medium
              uppercase
              tracking-wide
              text-slate-400
            "
          >
            Time
          </p>

          <p
            className="
              mt-1
              text-sm
              text-slate-800
              dark:text-slate-200
            "
          >
            {interviewTime}
          </p>

        </div>


        {/* =================================================
            STATUS
        ================================================= */}

        <div>

          <p
            className="
              text-xs
              font-medium
              uppercase
              tracking-wide
              text-slate-400
            "
          >
            Status
          </p>

          <Badge
            variant={
              statusToBadgeVariant[
                interviewStatus
              ] || "neutral"
            }
            className="mt-1.5"
          >
            {interviewStatus
              .split("_")
              .map(
                (word) =>
                  word.charAt(0).toUpperCase() +
                  word.slice(1)
              )
              .join(" ")}
          </Badge>

        </div>


        {/* =================================================
            MEETING
        ================================================= */}

        <div>

          <p
            className="
              text-xs
              font-medium
              uppercase
              tracking-wide
              text-slate-400
            "
          >
            Meeting
          </p>

          {candidate.interviewUrl ? (

            <a
              href={candidate.interviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-1.5"
              >
                <Video className="h-3.5 w-3.5" />

                Join Interview
              </Button>
            </a>

          ) : (

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-1.5"
              disabled
            >
              <Video className="h-3.5 w-3.5" />

              Meeting link not available
            </Button>

          )}

        </div>

      </CardContent>

    </Card>
  );
}