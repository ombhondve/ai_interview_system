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
  User,
  ShieldCheck,
  FileCode,
  Sparkles,
  ExternalLink,
} from "lucide-react";

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

    if (candidate.interview?.date || candidate.interviewDate) {
      return {
        title: "Attend Technical Interview",
        description: `Your interview is scheduled for ${
          candidate.interview?.date || candidate.interviewDate
        }${candidate.interview?.time ? ` at ${candidate.interview.time}` : ""}. Review your project and join the session on time.`,
        actionLabel: "View Interview Details",
        actionHref: "/student/interview",
        badge: "Interview Ready",
        badgeColor: "bg-[#40916C] text-white",
        icon: Video,
      };
    }

    if (candidate.interviewEligible) {
      return {
        title: "Schedule Your Technical Interview",
        description:
          "Your project has been accepted and verified. Select your preferred date and time slot to complete the interview.",
        actionLabel: "Choose Interview Slot",
        actionHref: "/student/interview-scheduling",
        badge: "Action Required",
        badgeColor: "bg-[#15803D] text-white",
        icon: CalendarDays,
      };
    }

    if (candidate.rejectionReason) {
      return {
        title: "Project Verification Feedback",
        description:
          "Your recent project submission requires review or updates. Check the automated verification notes on the Projects page.",
        actionLabel: "Review Project Status",
        actionHref: "/student/project",
        badge: "Update Needed",
        badgeColor: "bg-[#B91C1C] text-white",
        icon: AlertCircle,
      };
    }

    if (candidate.projectSubmissionStatus === "submitted") {
      return {
        title: "Project Under Verification",
        description:
          "Your repository submission is currently undergoing automated code analysis and AI requirement verification.",
        actionLabel: "View Live Progress",
        actionHref: "/student/project",
        badge: "In Progress",
        badgeColor: "bg-[#B45309] text-white",
        icon: Clock,
      };
    }

    return {
      title: "Complete Assigned Project",
      description: projectData?.title
        ? `Your assigned project is "${projectData.title}". Read the requirements and submit your GitHub repository.`
        : "View your assigned recruitment project, review the technical requirements, and submit your work.",
      actionLabel: "Go to Projects",
      actionHref: "/student/project",
      badge: "In Progress",
      badgeColor: "bg-[#40916C] text-white",
      icon: FolderKanban,
    };
  };

  const nextAction = getNextAction();

  if (loading) {
    return (
      <StudentShell>
        <div className="space-y-6 animate-pulse">
          <div className="h-28 rounded-2xl bg-[#E9E4D8]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="h-32 rounded-xl bg-white border border-[#D6D3C8]" />
            <div className="h-32 rounded-xl bg-white border border-[#D6D3C8]" />
            <div className="h-32 rounded-xl bg-white border border-[#D6D3C8]" />
            <div className="h-32 rounded-xl bg-white border border-[#D6D3C8]" />
          </div>
          <div className="h-64 rounded-xl bg-white border border-[#D6D3C8]" />
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
      <div className="space-y-6 sm:space-y-8">
        {/* ======================================================== */}
        {/* WELCOME BANNER (Forest Green #1B4332) */}
        {/* ======================================================== */}
        <div className="rounded-2xl bg-[#1B4332] text-white p-6 sm:p-8 shadow-sm border border-[#255A44] relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-xl space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#255A44] text-[#F5F1E8] text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5 text-[#40916C]" />
                <span>Candidate Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Welcome, {candidate.name}
              </h1>
              <p className="text-sm text-[#D8CDBB] leading-relaxed">
                Applying for{" "}
                <span className="font-semibold text-white">
                  {candidate.role || "Software Engineer"}
                </span>
                . Track your recruitment milestones, submit your project, and
                prepare for your interview below.
              </p>
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
          <div className="rounded-2xl bg-white border border-[#D6D3C8] p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-5 transition-all">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EAF4EE] text-[#1B4332]">
                <nextAction.icon className="h-6 w-6 text-[#40916C]" />
              </div>
              <div className="space-y-1">
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
                <h2 className="text-lg font-bold text-[#1F2937]">
                  {nextAction.title}
                </h2>
                <p className="text-sm text-[#64748B] leading-relaxed max-w-2xl">
                  {nextAction.description}
                </p>
              </div>
            </div>

            <div className="shrink-0 sm:self-center">
              <Link
                href={nextAction.actionHref}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#40916C] hover:bg-[#347959] text-white text-sm font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#40916C]"
              >
                <span>{nextAction.actionLabel}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 4 CORE OVERVIEW METRICS / STATUS PANELS */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* 1. Application Milestone */}
          <div className="bg-white border border-[#D6D3C8] rounded-xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Application
              </span>
              <User className="h-4 w-4 text-[#40916C]" />
            </div>
            <div className="text-base font-bold text-[#1F2937] truncate">
              {candidate.role || "Software Engineer"}
            </div>
            <p className="text-xs text-[#64748B]">
              Status:{" "}
              <span className="font-semibold text-[#15803D] capitalize">
                {candidate.status || "Approved"}
              </span>
            </p>
          </div>

          {/* 2. Assigned Project */}
          <div className="bg-white border border-[#D6D3C8] rounded-xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Assigned Project
              </span>
              <FolderKanban className="h-4 w-4 text-[#40916C]" />
            </div>
            <div className="text-base font-bold text-[#1F2937] truncate">
              {projectData?.title || "Project Assignment"}
            </div>
            <p className="text-xs text-[#64748B] truncate">
              {projectData?.deadline
                ? `Due: ${projectData.deadline}`
                : "Requirements available"}
            </p>
          </div>

          {/* 3. Verification State */}
          <div className="bg-white border border-[#D6D3C8] rounded-xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                AI Verification
              </span>
              <ShieldCheck className="h-4 w-4 text-[#40916C]" />
            </div>
            <div className="text-base font-bold text-[#1F2937]">
              {candidate.interviewEligible ? (
                <span className="text-[#15803D]">Verified & Accepted</span>
              ) : candidate.rejectionReason ? (
                <span className="text-[#B91C1C]">Changes Required</span>
              ) : candidate.projectSubmissionStatus === "submitted" ? (
                <span className="text-[#B45309]">Under Review</span>
              ) : (
                <span className="text-[#64748B]">Pending Submission</span>
              )}
            </div>
            <p className="text-xs text-[#64748B]">
              {candidate.interviewEligible
                ? "Eligible for Interview"
                : "Continuous evaluation"}
            </p>
          </div>

          {/* 4. Technical Interview */}
          <div className="bg-white border border-[#D6D3C8] rounded-xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Interview
              </span>
              <CalendarDays className="h-4 w-4 text-[#40916C]" />
            </div>
            <div className="text-base font-bold text-[#1F2937] truncate">
              {candidate.interview?.date || candidate.interviewDate ? (
                <span>
                  {candidate.interview?.date || candidate.interviewDate}
                </span>
              ) : candidate.interviewEligible ? (
                <span className="text-[#15803D]">Slot Ready to Book</span>
              ) : (
                <span className="text-[#64748B]">Not Scheduled</span>
              )}
            </div>
            <p className="text-xs text-[#64748B] truncate">
              {candidate.interview?.time
                ? `Time: ${candidate.interview.time}`
                : candidate.interviewEligible
                ? "Pick available slot"
                : "Unlocks after verification"}
            </p>
          </div>
        </div>

        {/* ======================================================== */}
        {/* DETAILED WORKFLOW GUIDANCE CARDS */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Projects Link */}
          <div className="bg-white border border-[#D6D3C8] rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF4EE] text-[#1B4332]">
                <FileCode className="h-5 w-5 text-[#40916C]" />
              </div>
              <h3 className="text-base font-bold text-[#1F2937]">
                Project Implementation
              </h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Review assigned requirements, clone resources, and submit your
                public GitHub repository before the deadline.
              </p>
            </div>
            <Link
              href="/student/project"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B4332] hover:text-[#40916C] transition-colors"
            >
              <span>View Projects</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Card 2: Schedule Link */}
          <div className="bg-white border border-[#D6D3C8] rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF4EE] text-[#1B4332]">
                <CalendarDays className="h-5 w-5 text-[#40916C]" />
              </div>
              <h3 className="text-base font-bold text-[#1F2937]">
                Interview Schedule
              </h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Once your project is verified, select a convenient date and time
                slot with synchronized calendar invites.
              </p>
            </div>
            <Link
              href="/student/interview-scheduling"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B4332] hover:text-[#40916C] transition-colors"
            >
              <span>Check Scheduling</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Card 3: Interviews Link */}
          <div className="bg-white border border-[#D6D3C8] rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF4EE] text-[#1B4332]">
                <Video className="h-5 w-5 text-[#40916C]" />
              </div>
              <h3 className="text-base font-bold text-[#1F2937]">
                AI Technical Interview
              </h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Join the interactive interview console with voice responses,
                question evaluation, and real-time transcripts.
              </p>
            </div>
            <Link
              href="/student/interview"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B4332] hover:text-[#40916C] transition-colors"
            >
              <span>Enter Interview Console</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </StudentShell>
  );
}
