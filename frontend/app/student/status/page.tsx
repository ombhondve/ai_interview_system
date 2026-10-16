"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StudentShell } from "@/components/student/StudentShell";
import {
  FolderKanban,
  CalendarDays,
  Video,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { formatInterviewSchedule } from "@/lib/dateUtils";

interface Candidate {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  status?: string;
  projectSubmissionStatus?: string;
  interviewEligible?: boolean;
  interviewEligibilityReason?: string | null;
  interviewEligibilityMessage?: string;
  rejectionReason?: string | null;
  interviewDate?: string;
  interviewStatus?: string;
  interview?: {
    date?: string;
    time?: string;
    meetLink?: string;
  };
}

interface ProjectData {
  title?: string;
  deadline?: string;
  remainingTime?: string;
  isExpired?: boolean;
}

export default function StudentDashboardPage() {
  const router = useRouter();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL ||
          "https://ai-interview-system-eewl.vercel.app";

        // Fetch candidate data
        const res = await fetch(`${backendUrl}/api/student/me`, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (!res.ok) {
          if (mounted) router.replace("/student/verify");
          return;
        }

        const data = await res.json();
        if (mounted && data.candidate) {
          setCandidate(data.candidate);

          // Fetch assigned project info
          try {
            const projRes = await fetch(`${backendUrl}/api/student/project`, {
              method: "GET",
              cache: "no-store",
              credentials: "include",
            });
            if (projRes.ok) {
              const projData = await projRes.json();
              if (projData.project) {
                setProjectData({
                  title: projData.project.title,
                  deadline: projData.project.deadline,
                  remainingTime: projData.project.remainingTime,
                  isExpired: projData.project.isExpired,
                });
              }
            }
          } catch {
            // Project might not be assigned yet
          }
        }
      } catch (err) {
        console.error("Failed to load dashboard:", err);
        if (mounted) {
          setError("Unable to load application dashboard. Please refresh.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [router]);

  /**
   * Determine primary Next Action for the candidate
   */
  const getNextAction = () => {
    if (!candidate) return null;

    // Check if interview is completed/finished
    const isInterviewFinished =
      candidate.interviewStatus === "completed" ||
      candidate.interviewStatus === "ANALYZED" ||
      candidate.status === "selected" ||
      candidate.status === "rejected";

    if (isInterviewFinished) {
      // If final results are available
      if (candidate.status === "selected" || candidate.status === "rejected") {
        return {
          title: "Application Results",
          description: "Your interview outcome is available.",
          actionLabel: "View Results",
          actionHref: "/student/result",
          badge: "Completed",
          badgeColor: "bg-[#15803D] text-white",
          icon: CheckCircle2,
        };
      }
      return null;
    }

    if (candidate.interview?.date || candidate.interviewDate) {
      const interviewTimestamp = candidate.interview?.date || candidate.interviewDate;
      const scheduleString = formatInterviewSchedule(
        interviewTimestamp,
        candidate.interview?.time
      );

      return {
        title: "Technical Interview",
        schedule: scheduleString,
        actionLabel: "Join Interview",
        actionHref: "/student/interview",
        badge: "Scheduled",
        badgeColor: "bg-[#40916C] text-white",
        icon: Video,
      };
    }

    if (candidate.interviewEligible) {
      return {
        title: "Technical Interview",
        description: "Project verified. Select your interview time slot.",
        actionLabel: "Schedule Interview",
        actionHref: "/student/interview-scheduling",
        badge: "Action Required",
        badgeColor: "bg-[#15803D] text-white",
        icon: CalendarDays,
      };
    }

    if (candidate.rejectionReason) {
      return {
        title: "Project Feedback",
        description:
          candidate.rejectionReason || "Updates required for your project submission.",
        actionLabel: "View Project",
        actionHref: "/student/project",
        badge: "Update Needed",
        badgeColor: "bg-[#B91C1C] text-white",
        icon: AlertCircle,
      };
    }

    if (candidate.projectSubmissionStatus === "submitted") {
      return {
        title: "Project Under Review",
        description: "Your submission is undergoing automated verification.",
        actionLabel: "View Project",
        actionHref: "/student/project",
        badge: "Under Review",
        badgeColor: "bg-[#B45309] text-white",
        icon: Clock,
      };
    }

    return {
      title: projectData?.title || "Assigned Project",
      description: projectData?.deadline
        ? `Due: ${projectData.deadline}`
        : "Review project requirements and submit.",
      actionLabel: "View Project",
      actionHref: "/student/project",
      badge: "Pending",
      badgeColor: "bg-[#40916C] text-white",
      icon: FolderKanban,
    };
  };

  const nextAction = getNextAction();

  if (loading) {
    return (
      <StudentShell>
        <div className="space-y-6 sm:space-y-8 max-w-4xl mx-auto w-full animate-pulse">
          <div className="h-28 rounded-2xl bg-[#E9E4D8]" />
          <div className="h-28 rounded-2xl bg-white border border-[#D6D3C8]" />
        </div>
      </StudentShell>
    );
  }

  if (error || !candidate) {
    return (
      <StudentShell>
        <div className="bg-white border border-[#D6D3C8] rounded-2xl p-8 text-center max-w-lg mx-auto">
          <div className="mx-auto h-12 w-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold text-xl mb-4">
            !
          </div>
          <h2 className="text-lg font-bold text-[#1F2937]">
            Unable to load dashboard
          </h2>
          <p className="mt-2 text-sm text-[#64748B]">
            {error || "Candidate data is unavailable."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#143326]"
          >
            Retry
          </button>
        </div>
      </StudentShell>
    );
  }

  return (
    <StudentShell>
      <div className="space-y-6 sm:space-y-8 max-w-4xl mx-auto w-full">
        {/* ======================================================== */}
        {/* WELCOME BANNER (Forest Green #1B4332) */}
        {/* ======================================================== */}
        <div className="rounded-2xl bg-[#1B4332] text-white p-6 sm:p-8 shadow-sm border border-[#255A44] relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-xl space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#255A44] text-[#F5F1E8] text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5 text-[#40916C]" />
                <span>Candidate Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Welcome, {candidate.name}
              </h1>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <div className="px-4 py-2.5 rounded-xl bg-[#143326] border border-[#255A44] text-center">
                <div className="text-[11px] uppercase font-bold text-[#D8CDBB]">
                  Candidate ID
                </div>
                <div className="text-sm font-mono font-bold text-white mt-0.5">
                  {candidate.id.slice(-6).toUpperCase()}
                </div>
              </div>
              <div className="px-4 py-2.5 rounded-xl bg-[#143326] border border-[#255A44] text-center">
                <div className="text-[11px] uppercase font-bold text-[#D8CDBB]">
                  Status
                </div>
                <div className="text-sm font-bold text-[#40916C] mt-0.5 capitalize">
                  {candidate.status || "Active"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* MOST IMPORTANT NEXT ACTION BANNER */}
        {/* ======================================================== */}
        {nextAction && (
          <div className="w-full rounded-2xl bg-white border border-[#D6D3C8] p-6 sm:p-7 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-6 transition-all">
            <div className="flex items-center gap-4 sm:gap-5 min-w-0">
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl bg-[#EAF4EE] text-[#1B4332]">
                <nextAction.icon className="h-6 w-6 sm:h-7 sm:w-7 text-[#40916C]" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${nextAction.badgeColor}`}
                  >
                    {nextAction.badge}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Next Step
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-[#1F2937] truncate">
                  {nextAction.title}
                </h2>
                {nextAction.schedule && (
                  <p className="text-sm font-medium text-[#4B5563]">
                    {nextAction.schedule}
                  </p>
                )}
                {nextAction.description && (
                  <p className="text-sm text-[#64748B] leading-relaxed max-w-2xl">
                    {nextAction.description}
                  </p>
                )}
              </div>
            </div>

            <div className="shrink-0 sm:self-center w-full sm:w-auto">
              <Link
                href={nextAction.actionHref}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#40916C] hover:bg-[#347959] text-white text-sm font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#40916C] whitespace-nowrap"
              >
                <span>{nextAction.actionLabel}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </StudentShell>
  );
}
