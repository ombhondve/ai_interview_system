"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Video,
  Clock,
  Calendar,
  Layers3,
  Bot,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  FileBarChart,
  Loader2,
} from "lucide-react";

import { Candidate } from "@/types";
import { apiUrl } from "@/lib/client";

import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/ui/Card";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

type InterviewData = {
  _id?: string;
  status?: string;
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  meetLink?: string;
  projectId?: {
    _id?: string;
    title?: string;
    role?: string;
    difficulty?: string;
  };
  evaluation?: any;
};

type BookingData = {
  _id?: string;
  startAt?: string;
  endAt?: string;
  meetLink?: string;
  status?: string;
  attendanceStatus?: string;
};

export function CandidateInterviewTab({
  candidate,
}: {
  candidate: Candidate;
}) {
  const [loading, setLoading] = useState(true);
  const [interview, setInterview] = useState<InterviewData | null>(null);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCandidateInterview() {
      if (!candidate?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setFetchError(null);
        const res = await fetch(
          apiUrl(`/api/ai-interviews/admin/candidate/${encodeURIComponent(candidate.id)}`),
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setInterview(data.interview || null);
            setBooking(data.booking || null);
          }
        } else if (res.status !== 404) {
          const errData = await res.json().catch(() => ({}));
          if (!cancelled) {
            setFetchError(errData.message || "Failed to load candidate interview records.");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError("Unable to reach the interview service.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCandidateInterview();

    return () => {
      cancelled = true;
    };
  }, [candidate?.id]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex min-h-[220px] items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-[#64748B]">
            <Loader2 className="h-4 w-4 animate-spin text-[#1976D2]" />
            <span>Loading candidate interview details…</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Authoritative date and times
  const rawDate =
    booking?.startAt ||
    interview?.scheduledAt ||
    candidate.interviewDate ||
    null;

  const hasInterview =
    Boolean(rawDate) ||
    Boolean(interview) ||
    Boolean(booking) ||
    candidate.interviewStatus === "scheduled" ||
    Boolean(candidate.interviewUrl);

  if (!hasInterview) {
    return (
      <Card>
        <EmptyState
          icon={CalendarClock}
          title="No interview scheduled"
          description="This candidate has not booked an interview slot yet. Once their project is verified, they can book a live technical interview slot."
        />
      </Card>
    );
  }

  // Format date and times in Asia/Kolkata
  let formattedDate = "Not scheduled";
  let startTimeStr = "—";
  let endTimeStr = "—";

  if (rawDate) {
    const d = new Date(rawDate);
    if (!Number.isNaN(d.getTime())) {
      formattedDate = d.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      });
      startTimeStr = d.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      });
    }
  }

  if (booking?.endAt) {
    const endD = new Date(booking.endAt);
    if (!Number.isNaN(endD.getTime())) {
      endTimeStr = endD.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      });
    }
  } else if (rawDate) {
    // 45 minute default session duration
    const endD = new Date(new Date(rawDate).getTime() + 45 * 60 * 1000);
    endTimeStr = endD.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  }

  // Interview status
  const rawStatus =
    interview?.status ||
    booking?.status ||
    candidate.interviewStatus ||
    "scheduled";

  const displayStatus = String(rawStatus).replace(/_/g, " ").toUpperCase();

  // Attendance status separated from scheduling status
  let attendanceStatus = "Not yet attended";
  if (
    rawStatus === "COMPLETED" ||
    rawStatus === "ANALYZED" ||
    rawStatus === "completed"
  ) {
    attendanceStatus = "Attended";
  } else if (
    rawStatus === "IN_PROGRESS" ||
    rawStatus === "WAITING_FOR_CANDIDATE"
  ) {
    attendanceStatus = "Attending";
  } else if (rawStatus === "CANDIDATE_NO_SHOW" || rawStatus === "no_show") {
    attendanceStatus = "Missed / No Show";
  } else if (rawStatus === "CANCELLED" || rawStatus === "cancelled") {
    attendanceStatus = "Not applicable";
  }

  // Meet URL
  const meetingUrl =
    booking?.meetLink ||
    interview?.meetLink ||
    candidate.interviewUrl ||
    "";

  // Associated project
  const projectTitle =
    interview?.projectId?.title ||
    candidate.assignedProject?.title ||
    "Assigned Technical Assessment";

  // Report availability
  const hasReport =
    interview?._id &&
    (interview.status === "ANALYZED" || Boolean(interview.evaluation));

  return (
    <Card>
      <CardHeader title="Interview Details" />

      <CardContent className="space-y-6">
        {fetchError && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertCircle size={15} className="shrink-0 text-amber-600" />
            <span>{fetchError}</span>
          </div>
        )}

        {/* Top Info Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Interview Status */}
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F5F7FA] p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[#64748B]">
              <CalendarClock className="h-4 w-4 text-[#1976D2]" />
              Interview Status
            </div>
            <div className="mt-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-blue-50 text-[#1976D2] border border-blue-200">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1976D2]" />
                {displayStatus}
              </span>
            </div>
          </div>

          {/* Attendance Status */}
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F5F7FA] p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[#64748B]">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Attendance Status
            </div>
            <div className="mt-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${
                  attendanceStatus === "Attended"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : attendanceStatus === "Attending"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : attendanceStatus === "Missed / No Show"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                {attendanceStatus}
              </span>
            </div>
          </div>

          {/* Timezone */}
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F5F7FA] p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[#64748B]">
              <Clock className="h-4 w-4 text-[#64748B]" />
              Timezone
            </div>
            <p className="mt-2 text-sm font-semibold text-[#111F33]">
              Asia/Kolkata (IST)
            </p>
          </div>

          {/* Date */}
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F5F7FA] p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[#64748B]">
              <Calendar className="h-4 w-4 text-[#64748B]" />
              Interview Date
            </div>
            <p className="mt-2 text-sm font-semibold text-[#111F33]">
              {formattedDate}
            </p>
          </div>

          {/* Start & End Time */}
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F5F7FA] p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[#64748B]">
              <Clock className="h-4 w-4 text-[#64748B]" />
              Time Slot
            </div>
            <p className="mt-2 text-sm font-semibold text-[#111F33]">
              {startTimeStr} – {endTimeStr}
            </p>
          </div>

          {/* Interview Round / Type */}
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F5F7FA] p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[#64748B]">
              <Layers3 className="h-4 w-4 text-[#64748B]" />
              Round & Type
            </div>
            <p className="mt-2 text-sm font-semibold text-[#111F33]">
              Round 1: AI Technical Assessment
            </p>
          </div>

          {/* Interviewer */}
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F5F7FA] p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[#64748B]">
              <Bot className="h-4 w-4 text-[#1976D2]" />
              Interviewer
            </div>
            <p className="mt-2 text-sm font-semibold text-[#111F33]">
              RecruitAI Autonomous Bot
            </p>
          </div>

          {/* Associated Project */}
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F5F7FA] p-4 sm:col-span-2">
            <div className="flex items-center gap-2 text-xs font-medium text-[#64748B]">
              <Layers3 className="h-4 w-4 text-[#64748B]" />
              Associated Project
            </div>
            <p className="mt-2 text-sm font-semibold text-[#111F33] truncate">
              {projectTitle}
            </p>
          </div>
        </div>

        {/* Meeting & Evaluation Action Row */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
          <div>
            <h4 className="text-xs font-semibold text-[#111F33]">
              Google Meet Conference
            </h4>
            <p className="text-xs text-[#64748B]">
              {meetingUrl
                ? "Active conference room for this candidate's interview session."
                : "A Google Meet conference link will be created automatically upon booking."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {meetingUrl ? (
              <a
                href={meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#1976D2] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1565C0]"
              >
                <Video size={14} />
                Join Interview
                <ExternalLink size={12} />
              </a>
            ) : (
              <button
                disabled
                className="inline-flex items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-400 cursor-not-allowed"
              >
                <Video size={14} />
                Meeting link unavailable
              </button>
            )}

            {hasReport && (
              <Link
                href={`/admin/reports/${interview._id}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#1976D2] bg-blue-50 px-3.5 py-2 text-xs font-semibold text-[#1976D2] hover:bg-blue-100"
              >
                <FileBarChart size={14} />
                View AI Report
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
