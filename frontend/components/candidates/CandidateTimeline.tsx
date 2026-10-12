"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Circle,
  Clock,
  AlertTriangle,
  XCircle,
} from "lucide-react";

import { Candidate, ActivityEvent } from "@/types";
import { apiUrl } from "@/lib/client";

import {
  Card,
  CardHeader,
} from "@/components/ui/Card";

import { cn } from "@/lib/utils";

type InterviewSessionData = {
  _id?: string;
  status?: string;
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  evaluatedAt?: string;
  evaluation?: any;
  adminDecision?: {
    status?: string;
    decidedAt?: string;
    decisionNotes?: string;
  };
};

export function CandidateTimeline({
  candidate,
}: {
  candidate: Candidate;
}) {
  const [interviewSession, setInterviewSession] = useState<InterviewSessionData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInterviewSession() {
      if (!candidate?.id) return;
      try {
        const res = await fetch(
          apiUrl(`/api/ai-interviews/admin/candidate/${encodeURIComponent(candidate.id)}`),
          { credentials: "include", cache: "no-store" }
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.interview) {
            setInterviewSession(data.interview);
          }
        }
      } catch {
        // Safe fallback to candidate records
      }
    }

    void loadInterviewSession();
    return () => {
      cancelled = true;
    };
  }, [candidate?.id]);

  // Construct complete recruitment lifecycle timeline
  const timelineEvents = useMemo(() => {
    const events: {
      id: string;
      label: string;
      description?: string;
      timestamp?: string | null;
      state: "complete" | "current" | "pending";
      isRejected?: boolean;
    }[] = [];

    // Helper to find existing logged activity by label
    const findLogged = (regex: RegExp) =>
      candidate.activity?.find((a) => regex.test(a.label || ""));

    // 1. Resume Received
    const resumeLogged = findLogged(/received|resume|registered/i);
    events.push({
      id: "resume-received",
      label: "Resume Received",
      description: "Candidate submitted resume application to RecruitAI.",
      timestamp: resumeLogged?.timestamp || candidate.createdAt || candidate.receivedDate || null,
      state: "complete",
    });

    // 2. Candidate Approved / Rejected
    const isRejected = candidate.status === "rejected";
    const approveLogged = findLogged(/approved/i);
    const isApproved =
      Boolean(approveLogged) ||
      (candidate.status !== "received" &&
        candidate.status !== "under_review" &&
        !isRejected);

    if (isRejected) {
      events.push({
        id: "candidate-decision",
        label: "Candidate Rejected",
        description: candidate.rejectionReason
          ? `Application rejected: ${candidate.rejectionReason}`
          : "Candidate application was not approved.",
        timestamp: candidate.updatedAt || candidate.createdAt || null,
        state: "complete",
        isRejected: true,
      });
      return events;
    } else if (isApproved) {
      events.push({
        id: "candidate-approved",
        label: "Candidate Approved",
        description: "Candidate profile and resume verified and approved for technical assessment.",
        timestamp: approveLogged?.timestamp || candidate.createdAt || null,
        state: "complete",
      });
    } else {
      events.push({
        id: "candidate-approved",
        label: "Candidate Approval",
        description: "Application is under recruiter review.",
        timestamp: null,
        state: "current",
      });
      return events;
    }

    // 3. Project Assigned
    const projectLogged = findLogged(/project assigned/i);
    const isProjectAssigned =
      Boolean(candidate.assignedProjectId) ||
      Boolean(candidate.assignedProject) ||
      Boolean(projectLogged);

    if (isProjectAssigned) {
      events.push({
        id: "project-assigned",
        label: "Project Assigned",
        description: "Personalized technical project brief assigned to candidate.",
        timestamp:
          candidate.projectAssignedAt ||
          projectLogged?.timestamp ||
          candidate.updatedAt ||
          null,
        state: "complete",
      });
    } else {
      events.push({
        id: "project-assigned",
        label: "Project Assignment",
        description: "Awaiting project assignment by recruiting team.",
        timestamp: null,
        state: "pending",
      });
      return events;
    }

    // 4. Project Submitted
    const submitLogged = findLogged(/project submitted|submission/i);
    const hasSubmission =
      Boolean(candidate.submissionUrl) ||
      Boolean(candidate.projectSubmission?.url) ||
      Boolean(candidate.projectSubmission?.submittedAt) ||
      Boolean(submitLogged);

    if (hasSubmission) {
      events.push({
        id: "project-submitted",
        label: "Project Submitted",
        description: `Project repository submitted: ${candidate.submissionUrl || candidate.projectSubmission?.url || "Code repository"}`,
        timestamp:
          candidate.projectSubmission?.submittedAt ||
          submitLogged?.timestamp ||
          null,
        state: "complete",
      });
    } else {
      events.push({
        id: "project-submitted",
        label: "Project Submission",
        description: "Candidate working on assigned project.",
        timestamp: null,
        state: "pending",
      });
      return events;
    }

    // 5. Project Verification Started
    const isVerifying =
      Boolean(candidate.projectSubmission?.aiVerificationStartedAt) ||
      Boolean(candidate.projectSubmission?.aiVerificationStatus) ||
      candidate.projectSubmissionStatus === "ai_verification" ||
      candidate.projectSubmissionStatus === "verified" ||
      candidate.projectSubmissionStatus === "rejected";

    if (isVerifying) {
      events.push({
        id: "verification-started",
        label: "Project Verification Started",
        description: "AI verification engine initiated automated code analysis.",
        timestamp:
          candidate.projectSubmission?.aiVerificationStartedAt ||
          candidate.projectSubmission?.submittedAt ||
          null,
        state: "complete",
      });
    } else {
      events.push({
        id: "verification-started",
        label: "Project Verification Started",
        description: "Awaiting AI verification analysis queue.",
        timestamp: null,
        state: "pending",
      });
      return events;
    }

    // 6. Project Verification Completed
    const isVerificationDone =
      Boolean(candidate.projectSubmission?.aiVerificationCompletedAt) ||
      candidate.projectSubmissionStatus === "verified" ||
      candidate.projectSubmissionStatus === "rejected";

    if (isVerificationDone) {
      events.push({
        id: "verification-completed",
        label: "Project Verification Completed",
        description: "AI project analysis, test suite, and architecture review completed.",
        timestamp:
          candidate.projectSubmission?.aiVerificationCompletedAt ||
          candidate.projectSubmission?.submittedAt ||
          null,
        state: "complete",
      });
    } else {
      events.push({
        id: "verification-completed",
        label: "Project Verification",
        description: "AI analysis in progress.",
        timestamp: null,
        state: "current",
      });
      return events;
    }

    // 7. Project Verified or Rejected
    const isVerified =
      candidate.projectSubmissionStatus === "verified" ||
      candidate.projectSubmission?.aiVerificationStatus === "verified" ||
      candidate.projectSubmission?.aiVerificationResult?.verificationStatus === "VERIFIED";

    const isProjectRejected =
      candidate.projectSubmissionStatus === "rejected" ||
      candidate.projectSubmission?.aiVerificationStatus === "rejected" ||
      candidate.projectSubmission?.aiVerificationResult?.verificationStatus === "REJECTED";

    if (isVerified) {
      events.push({
        id: "project-verified",
        label: "Project Verified",
        description: "Technical project passed verification requirements.",
        timestamp: candidate.projectSubmission?.aiVerificationCompletedAt || null,
        state: "complete",
      });
    } else if (isProjectRejected) {
      events.push({
        id: "project-rejected",
        label: "Project Verification Rejected",
        description: "Project did not meet automated technical standards.",
        timestamp: candidate.projectSubmission?.aiVerificationCompletedAt || null,
        state: "complete",
        isRejected: true,
      });
      return events;
    }

    // 8. Interview Eligibility Confirmed
    if (isVerified) {
      events.push({
        id: "interview-eligible",
        label: "Interview Eligibility Confirmed",
        description: "Candidate cleared to book technical AI interview conference.",
        timestamp: candidate.projectSubmission?.aiVerificationCompletedAt || null,
        state: "complete",
      });
    }

    // 9. Interview Scheduled
    const isScheduled =
      candidate.interviewStatus === "scheduled" ||
      Boolean(interviewSession?.scheduledAt) ||
      Boolean(candidate.interviewDate);

    if (isScheduled) {
      events.push({
        id: "interview-scheduled",
        label: "Interview Scheduled",
        description: "Google Meet technical interview booked with AI bot.",
        timestamp: interviewSession?.scheduledAt || candidate.interviewDate || null,
        state: "complete",
      });
    } else {
      events.push({
        id: "interview-scheduled",
        label: "Interview Scheduling",
        description: "Awaiting candidate to select an interview slot.",
        timestamp: null,
        state: "pending",
      });
      return events;
    }

    // 10. Interview Started
    const isStarted =
      Boolean(interviewSession?.startedAt) ||
      interviewSession?.status === "IN_PROGRESS" ||
      interviewSession?.status === "COMPLETED" ||
      interviewSession?.status === "ANALYZED";

    if (isStarted) {
      events.push({
        id: "interview-started",
        label: "Interview Started",
        description: "AI interviewer conducted technical interview with candidate.",
        timestamp: interviewSession?.startedAt || null,
        state: "complete",
      });
    } else {
      events.push({
        id: "interview-started",
        label: "Interview Session",
        description: "Interview not yet started.",
        timestamp: null,
        state: "pending",
      });
      return events;
    }

    // 11. Interview Completed
    const isInterviewDone =
      interviewSession?.status === "COMPLETED" ||
      interviewSession?.status === "ANALYZED" ||
      candidate.interviewStatus === "completed";

    if (isInterviewDone) {
      events.push({
        id: "interview-completed",
        label: "Interview Completed",
        description: "Technical interview concluded successfully.",
        timestamp: interviewSession?.endedAt || null,
        state: "complete",
      });
    } else {
      events.push({
        id: "interview-completed",
        label: "Interview Completion",
        description: "Interview session ongoing.",
        timestamp: null,
        state: "current",
      });
      return events;
    }

    // 12. Interview Report Generated
    const isReportDone =
      interviewSession?.status === "ANALYZED" ||
      Boolean(interviewSession?.evaluation);

    if (isReportDone) {
      events.push({
        id: "report-generated",
        label: "Interview Report Generated",
        description: "AI evaluation report, questions, transcript, and scoring generated.",
        timestamp: interviewSession?.evaluatedAt || interviewSession?.endedAt || null,
        state: "complete",
      });
    } else {
      events.push({
        id: "report-generated",
        label: "Interview Report Generation",
        description: "AI transcription and score evaluation in progress.",
        timestamp: null,
        state: "current",
      });
      return events;
    }

    // 13. Final Decision
    const hasDecision =
      candidate.status === "decided" ||
      Boolean(interviewSession?.adminDecision?.status) ||
      Boolean(candidate.finalDecision);

    if (hasDecision) {
      events.push({
        id: "final-decision",
        label: "Final Recruitment Decision",
        description: `Recruitment outcome finalized: ${interviewSession?.adminDecision?.status || candidate.finalDecision || candidate.status}.`,
        timestamp: interviewSession?.adminDecision?.decidedAt || candidate.updatedAt || null,
        state: "complete",
      });
    } else {
      events.push({
        id: "final-decision",
        label: "Final Recruitment Decision",
        description: "Pending hiring team review and decision.",
        timestamp: null,
        state: "pending",
      });
    }

    return events;
  }, [candidate, interviewSession]);

  return (
    <Card>
      <CardHeader title="Activity Timeline" />

      <div className="px-6 pb-6 pt-2">
        {timelineEvents.map((event, index) => {
          const isComplete = event.state === "complete";
          const isCurrent = event.state === "current";
          const isPending = event.state === "pending";
          const isLast = index === timelineEvents.length - 1;

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, duration: 0.2 }}
              className="relative flex gap-4 pb-7 last:pb-0"
            >
              {/* Connecting line */}
              {!isLast && (
                <span
                  className={cn(
                    "absolute left-[15px] top-8 h-full w-px",
                    isComplete
                      ? "bg-blue-300 dark:bg-blue-500/40"
                      : "bg-slate-200 dark:bg-white/10"
                  )}
                />
              )}

              {/* Status Icon */}
              <div
                className={cn(
                  "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold shadow-xs transition",
                  event.isRejected
                    ? "bg-red-500 text-white"
                    : isComplete
                      ? "bg-[#1976D2] text-white"
                      : isCurrent
                        ? "bg-amber-500 text-white animate-pulse"
                        : "bg-slate-100 text-slate-400 border border-slate-200"
                )}
              >
                {event.isRejected ? (
                  <XCircle className="h-4 w-4" />
                ) : isComplete ? (
                  <Check className="h-4 w-4" />
                ) : isCurrent ? (
                  <Clock className="h-4 w-4" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </div>

              {/* Event Content */}
              <div className="flex-1 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      event.isRejected
                        ? "text-red-600"
                        : isComplete
                          ? "text-[#111F33]"
                          : isCurrent
                            ? "text-amber-800"
                            : "text-[#94A3B8]"
                    )}
                  >
                    {event.label}
                  </p>

                  {/* Timestamp in Asia/Kolkata */}
                  {event.timestamp ? (
                    <span className="text-xs text-[#64748B]">
                      {new Date(event.timestamp).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                        timeZone: "Asia/Kolkata",
                      })}
                    </span>
                  ) : isPending ? (
                    <span className="text-[11px] font-medium text-slate-400">
                      Pending
                    </span>
                  ) : null}
                </div>

                {event.description && (
                  <p
                    className={cn(
                      "mt-0.5 text-xs",
                      isPending ? "text-slate-400" : "text-[#64748B]"
                    )}
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
