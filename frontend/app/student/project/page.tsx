"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { StudentShell } from "@/components/student/StudentShell";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type AssignedProject = {
  id?: string;
  title: string;
  difficulty?: string;
  description?: string;
  technologies?: string[];
  requirements?: string;
  pdfUrl?: string;
  detailedPdfUrl?: string;
  briefUrl?: string;
  duration?: number;
  deadline?: string;
  bufferDeadline?: string;
  remainingTime?: string;
  isExpired?: boolean;
};

type VerificationState = {
  state:
    | "not_submitted"
    | "in_progress"
    | "accepted"
    | "rejected";
  label: string;
  description: string;
  isTerminal: boolean;
  /** Actual persisted reason, surfaced for rejected submissions. */
  rejectionReason?: string | null;
  interviewEligible?: boolean;
};

type VerificationProgress = {
  stage: string;
  label: string;
  status: "active" | "completed" | "failed";
  completed?: boolean;
  failed?: boolean;
  message?: string;
  updatedAt?: string;
};

type VerificationStage = Omit<VerificationProgress, "status"> & {
  status: "active" | "completed" | "failed" | "pending";
  startedAt?: string | null;
  completedAt?: string | null;
};

type Candidate = {
  id: string;
  name?: string;
  role?: string;
  status?: string;
  projectSubmissionStatus?: string;
  projectDownloadedAt?: string;
  projectSubmission?: {
    url?: string;
    submittedAt?: string;
    status?: string;
    aiVerificationStatus?: string;
    aiVerificationCompletedAt?: string;
    verificationMetadata?: {
      verificationTimeMs?: number;
    };
  } | null;
  /**
   * Student-facing verification state, derived by the backend from the
   * existing verification fields. Keeping the mapping on the server means the
   * UI never has to interpret internal status names.
   */
  verification?: VerificationState;
};

type ProjectApiResponse = {
  candidate?: Candidate;
  project?: AssignedProject | null;
  submission?: {
    allowed: boolean;
    period: string;
    reason: string;
    message: string;
  };
  progress?: VerificationProgress | null;
  progressHistory?: VerificationStage[];
  message?: string;
};


/**
 * ============================================
 * VERIFICATION RESULT / PROGRESS
 * ============================================
 *
 * The same Project Submission page changes in place:
 *   submitted -> live verification -> Accepted OR Rejected.
 * No admin-review state is exposed to the student.
 */
function VerificationResultView({
  verification,
  progress,
  progressHistory = [],
  displayIndex,
  onScheduleInterview,
}: {
  verification: VerificationState;
  progress: VerificationProgress | null;
  progressHistory?: VerificationStage[];
  displayIndex?: number;
  onScheduleInterview: () => void;
}) {
  const state = verification.state;

  if (state === "accepted") {
    return (
      <Card className="border-[#40916C]/40 bg-[#EAF4EE] shadow-sm">
        <CardContent className="p-8">
          <div className="mx-auto max-w-2xl text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#15803D] text-2xl font-bold text-white shadow-sm">
              ✓
            </div>
            <h2 className="text-2xl font-bold text-[#1B4332]">
              Project Accepted & Verified
            </h2>
            <p className="text-sm leading-6 text-[#1F2937]">
              Your project submission has successfully passed all automated repository checks and AI requirement verification.
            </p>
            <span className="inline-flex rounded-full bg-[#15803D]/15 px-3 py-1 text-xs font-bold text-[#15803D]">
              Verified Candidate
            </span>
            <div className="pt-2">
              <button
                type="button"
                onClick={onScheduleInterview}
                className="bg-[#40916C] hover:bg-[#347959] text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#40916C] cursor-pointer"
              >
                Schedule Interview →
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === "rejected") {
    return (
      <Card className="border-[#B91C1C]/30 bg-[#FEE2E2]/50 shadow-sm">
        <CardContent className="p-8">
          <div className="mx-auto max-w-2xl text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#B91C1C] text-2xl font-bold text-white shadow-sm">
              ✕
            </div>
            <h2 className="text-2xl font-bold text-[#B91C1C]">
              Submission Not Verified
            </h2>
            <p className="text-sm leading-6 text-[#1F2937]">
              Your submission did not meet the required technical criteria. Please review the automated feedback below.
            </p>
            {verification.rejectionReason && (
              <div className="rounded-xl border border-[#B91C1C]/25 bg-white p-4 text-left shadow-2xs">
                <p className="text-xs font-bold uppercase tracking-wider text-[#B91C1C]">
                  Automated Feedback
                </p>
                <p className="mt-1 text-sm leading-6 text-[#1F2937]">
                  {verification.rejectionReason}
                </p>
              </div>
            )}
            <span className="inline-flex rounded-full bg-[#B91C1C]/15 px-3 py-1 text-xs font-bold text-[#B91C1C]">
              Changes Required
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const steps = [
    { key: "validating", label: "Validating repository" },
    { key: "project_requirements", label: "Loading project requirements" },
    { key: "repository", label: "Fetching repository" },
    { key: "analyzing", label: "Analyzing code and files" },
    { key: "requirements", label: "Checking project requirements" },
    { key: "ai", label: "AI verification in progress" },
    { key: "finalizing", label: "Finalizing results" },
  ];

  const stageMap = new Map(
    (progressHistory || []).map((entry) => [entry.stage, entry])
  );
  const currentIndex = Math.max(
    0,
    displayIndex ?? steps.findIndex((step) => step.key === progress?.stage)
  );

  return (
    <Card className="border-[#D6D3C8] bg-white shadow-sm">
      <CardContent className="p-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-3 border-[#D6D3C8] border-t-[#40916C]" />
          <h2 className="mt-5 text-xl font-bold text-[#1B4332]">
            Verifying Your Project
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#64748B]">
            {progress?.message || "Please wait while our verification engine analyzes your repository."}
          </p>
          <div className="mx-auto mt-7 max-w-md space-y-4 text-left">
            {steps.map((step, index) => {
              const recorded = stageMap.get(step.key);
              const isReplayCurrent = index === currentIndex;
              const isFailed =
                isReplayCurrent &&
                recorded?.status === "failed";
              const isActive =
                isReplayCurrent &&
                !isFailed &&
                (recorded?.status === "active" || progress?.stage === step.key);
              const isComplete =
                index < currentIndex ||
                (isReplayCurrent && recorded?.status === "completed");

              return (
                <VerificationStep
                  key={step.key}
                  label={step.label}
                  message={
                    isReplayCurrent
                      ? recorded?.message || progress?.message
                      : isComplete
                        ? "Completed successfully."
                        : undefined
                  }
                  active={isActive}
                  complete={!isFailed && isComplete}
                  failed={isFailed}
                />
              );
            })}
          </div>
          {progress?.status === "failed" ? (
            <div className="mt-7 rounded-xl border border-red-200 bg-red-50 p-4 text-left">
              <p className="text-sm font-semibold text-red-900">Verification stopped</p>
              <p className="mt-1 text-sm leading-6 text-red-700">
                {progress.message || "This verification step failed."}
              </p>
            </div>
          ) : (
            <div className="mt-7 rounded-xl border border-blue-200 bg-white/70 p-3 text-left text-sm text-blue-800">
              This may take a few minutes. Please do not close this page.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function VerificationStep({
  label,
  message,
  active = false,
  complete = false,
  failed = false,
}: {
  label: string;
  message?: string;
  active?: boolean;
  complete?: boolean;
  failed?: boolean;
}) {
  const indicatorClass =
    failed
      ? "bg-[#B91C1C] text-white"
      : complete
        ? "bg-[#15803D] text-white"
        : active
          ? "bg-[#40916C] text-white animate-pulse"
          : "bg-[#E9E4D8] text-[#64748B]";

  const labelClass =
    failed
      ? "font-semibold text-[#B91C1C]"
      : active
        ? "font-semibold text-[#1B4332]"
        : complete
          ? "text-[#1F2937]"
          : "text-[#64748B]";

  return (
    <div className="relative flex items-start gap-3">
      <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-500 ${indicatorClass}`}>
        {active && !failed && !complete && (
          <span className="absolute inset-0 rounded-full border-2 border-[#40916C] animate-ping" />
        )}
        <span className="relative z-10">
          {failed ? "×" : complete ? "✓" : active ? "•" : ""}
        </span>
      </span>
      <div className="min-w-0">
        <span className={`text-sm ${labelClass}`}>{label}</span>
        {message && <p className="mt-0.5 text-xs leading-5 text-[#64748B]">{message}</p>}
      </div>
    </div>
  );
}

export default function Project() {
  const router = useRouter();

  const [candidate, setCandidate] =
    useState<Candidate | null>(null);

  const [project, setProject] =
    useState<AssignedProject | null>(null);

  const [url, setUrl] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [downloading, setDownloading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /**
   * Student-facing verification state.
   *
   * Seeded from the backend and refreshed while a verification is running.
   * Optimistically set to "in_progress" right after a submission so the page
   * never shows a stale Accepted/Rejected while the new one verifies.
   */
  const [verification, setVerification] =
    useState<VerificationState | null>(null);

  const [verificationProgress, setVerificationProgress] =
    useState<VerificationProgress | null>(null);

  const [verificationHistory, setVerificationHistory] =
    useState<VerificationStage[]>([]);

  const [pendingTerminalVerification, setPendingTerminalVerification] =
    useState<VerificationState | null>(null);

  const [replayIndex, setReplayIndex] = useState(0);

  const [showTerminalResult, setShowTerminalResult] =
    useState(false);

  /**
   * ============================================
   * LOAD CURRENT STUDENT
   * ============================================
   */

  const loadCandidate = useCallback(
    async () => {
      try {
        setLoading(true);
        setError("");

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://ai-interview-system-eewl.vercel.app";
        const response = await fetch(
          `${backendUrl}/api/student/project`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        const data: ProjectApiResponse =
          await response.json();

        /**
         * Session expired.
         */
        if (response.status === 401) {
          router.replace(
            "/student/verify"
          );
          return;
        }

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Unable to load your project."
          );
        }

        if (!data.candidate) {
          throw new Error(
            "Candidate information could not be loaded."
          );
        }

        setCandidate(data.candidate);
        setProject(data.project || null);
        setVerification(
          data.candidate.verification ?? null
        );
        setVerificationProgress(
          (data as ProjectApiResponse & { progress?: VerificationProgress }).progress ?? null
        );
        setVerificationHistory(
          (data as ProjectApiResponse & { progressHistory?: VerificationStage[] }).progressHistory ?? []
        );

        /**
         * If the candidate already has a
         * submission, show it in the input.
         */
        if (
          data.candidate.projectSubmission?.url
        ) {
          setUrl(
            data.candidate
              .projectSubmission.url
          );
        }
      } catch (err) {
        console.error(
          "Load project error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load project information."
        );
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    loadCandidate();
  }, [loadCandidate]);

  /**
   * ============================================
   * POLL VERIFICATION STATUS
   * ============================================
   *
   * Verification runs asynchronously in the background, so while it is not in
   * a terminal state we poll the existing status endpoint and stop as soon as
   * it reaches Accepted / Rejected / Under Review.
   *
   * Polling is skipped entirely for terminal and "not submitted" states, so
   * there are no unnecessary requests.
   */

  const isPollingActive =
    verification?.state === "in_progress";

  useEffect(() => {
    if (!isPollingActive) {
      return;
    }

    let cancelled = false;

    /**
     * Fetch the latest student-facing verification state.
     */
    const poll = async () => {
      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL ||
          "https://ai-interview-system-eewl.vercel.app";

        const response = await fetch(
          `${backendUrl}/api/student/verification-status`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        if (cancelled || !response.ok) {
          return;
        }

        const data = await response.json();

        const next =
          data?.data?.verification ?? null;

        setVerificationProgress(data?.data?.progress ?? null);
        setVerificationHistory(data?.data?.progressHistory ?? []);

        if (cancelled || !next) {
          return;
        }

        if (next.isTerminal) {
          // Do not switch to Accepted/Rejected yet. Replay the persisted
          // verification history first so the student sees the complete
          // top-to-bottom process.
          setPendingTerminalVerification(next);
        } else {
          setVerification(next);
        }
      } catch {
        // Transient polling failures are ignored; the next tick retries.
      }
    };

    const intervalId = setInterval(
      poll,
      1000
    );

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isPollingActive, loadCandidate]);

  /**
   * Replay persisted verification stages visually.
   *
   * Backend speed must never cause the UI to skip stages. This is presentation
   * only: it does not delay or modify backend verification.
   */
  useEffect(() => {
    if (!isPollingActive) return;

    const occurredCount = verificationHistory.filter(
      (stage) => stage.status !== "pending"
    ).length;

    if (!occurredCount) return;

    if (replayIndex < occurredCount - 1) {
      const timer = window.setTimeout(() => {
        setReplayIndex((current) =>
          Math.min(current + 1, occurredCount - 1)
        );
      }, 900);

      return () => window.clearTimeout(timer);
    }

    if (pendingTerminalVerification && !showTerminalResult) {
      const timer = window.setTimeout(() => {
        setShowTerminalResult(true);
        setVerification(pendingTerminalVerification);
      }, 900);

      return () => window.clearTimeout(timer);
    }
  }, [
    isPollingActive,
    verificationHistory,
    replayIndex,
    pendingTerminalVerification,
    showTerminalResult
  ]);

  useEffect(() => {
    if (verification?.isTerminal && !isPollingActive) {
      setShowTerminalResult(true);
    }
  }, [verification?.isTerminal, isPollingActive]);

  /**
   * ============================================
   * DOWNLOAD PROJECT
   * ============================================
   */

  async function downloadProject() {
    setError("");
    setSuccess("");
    setDownloading(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://ai-interview-system-eewl.vercel.app";
      const response = await fetch(
        `${backendUrl}/api/student/project/download`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      const data = await response.json();

      /**
       * Session expired.
       */
      if (response.status === 401) {
        router.replace("/student/verify");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to download project."
        );
      }

      // Get PDF URL from response
      const pdfUrl = data.project?.pdfUrl;

      if (!pdfUrl) {
        throw new Error("Project PDF URL not found");
      }

      // Open/download the PDF
      window.open(pdfUrl, "_blank");

      // Refresh project data to show deadline
      await loadCandidate();

      // Show success message
      setSuccess("Project downloaded successfully. Your deadline has started.");
      
    } catch (err) {
      console.error("Download project error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to download the project. Please try again."
      );
    } finally {
      setDownloading(false);
    }
  }

  /**
   * ============================================
   * URL VALIDATION
   * ============================================
   */

  function isValidProjectUrl(
    value: string
  ) {
    try {
      const parsed = new URL(
        value.trim()
      );

      return (
        parsed.protocol === "http:" ||
        parsed.protocol === "https:"
      );
    } catch {
      return false;
    }
  }

  /**
   * ============================================
   * SUBMIT PROJECT
   * ============================================
   */

  async function submitProject() {
    const cleanUrl = url.trim();

    // Never allow two submissions while a request is already in progress.
    if (submitting) {
      return;
    }

    setError("");
    setSuccess("");

    /**
     * Empty URL.
     */
    if (!cleanUrl) {
      setError(
        "Please enter your project URL."
      );
      return;
    }

    /**
     * Invalid URL.
     */
    if (!isValidProjectUrl(cleanUrl)) {
      setError(
        "Please enter a valid URL beginning with http:// or https://."
      );
      return;
    }

    setSubmitting(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://ai-interview-system-eewl.vercel.app";
      const response = await fetch(
        `${backendUrl}/api/student/submit-project`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            url: cleanUrl,
          }),
        }
      );

      /**
       * Error responses are not guaranteed to carry JSON (e.g. a proxy or
       * 5xx page), so parsing must never break the error path.
       */
      let data: {
        message?: string;
        code?: string;
      } | null = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      /**
       * Session expired.
       */
      if (response.status === 401) {
        router.replace(
          "/student/verify"
        );
        return;
      }

      if (!response.ok) {
        /**
         * The backend could not fetch/validate the submitted repository, so
         * the submission was never started. Return the student to the Submit
         * URL page (the form stays rendered with the entered URL intact) and
         * show the safe, user-friendly message so they can correct the URL
         * and submit again — without refreshing the browser.
         */
        if (data?.code === "repository_fetch_failed") {
          // Make sure the page is not left on a verification/result view if
          // the flow had already moved away from the Submit URL page.
          setVerification(null);
          setVerificationProgress(null);
          setVerificationHistory([]);
          setReplayIndex(0);
          setPendingTerminalVerification(null);
          setShowTerminalResult(false);

          setError(
            data.message ||
              "Unable to fetch the repository. Please check the URL and submit again."
          );
          return;
        }

        // Any other existing error type keeps its current behaviour.
        throw new Error(
          data?.message ||
            "Unable to submit your project."
        );
      }

      /**
       * Immediately show "Verification In Progress".
       *
       * A previous Accepted/Rejected result must not remain visible while the
       * new submission is being verified, so we clear it locally right away
       * and then adopt the backend's derived state from the response.
       */
      setVerification({
        state: "in_progress",
        label: "Verification In Progress",
        description:
          "Your project has been submitted and is currently being verified.",
        isTerminal: false,
      });
      setVerificationProgress({
        stage: "validating",
        label: "Validating repository",
        status: "active",
        message: "Checking the submitted project URL..."
      });
      setVerificationHistory([
        {
          stage: "validating",
          label: "Validating repository",
          status: "active",
          message: "Checking the submitted project URL..."
        },
        {
          stage: "project_requirements",
          label: "Loading project requirements",
          status: "pending"
        },
        {
          stage: "repository",
          label: "Fetching repository",
          status: "pending"
        },
        {
          stage: "analyzing",
          label: "Analyzing code and files",
          status: "pending"
        },
        {
          stage: "requirements",
          label: "Checking project requirements",
          status: "pending"
        },
        {
          stage: "ai",
          label: "AI verification in progress",
          status: "pending"
        },
        {
          stage: "finalizing",
          label: "Finalizing results",
          status: "pending"
        }
      ]);
      setReplayIndex(0);
      setPendingTerminalVerification(null);
      setShowTerminalResult(false);

      // Do not reload the candidate immediately. That can read the previous
      // terminal result before the new async verification reaches processing.
      // The verification-status polling endpoint is now the source of truth.
    } catch (err) {
      console.error(
        "Project submission error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit your project."
      );
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * ============================================
   * LOADING UI
   * ============================================
   */

  if (loading) {
    return (
      <StudentShell>
        <div className="mx-auto w-full max-w-4xl">
          <Card>
            <CardContent className="py-14">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />

                <p className="font-medium text-slate-900">
                  Loading your project
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Checking your student account...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </StudentShell>
    );
  }

  /**
   * ============================================
   * MAIN UI
   * ============================================
   */

  return (
    <StudentShell>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* ====================================== */}
        {/* PAGE HEADER */}
        {/* ====================================== */}

        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-[#40916C]">
            Technical Assessment
          </p>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1B4332]">
            Assigned Project Submission
          </h1>

          <p className="max-w-2xl text-sm leading-6 text-[#64748B]">
            Complete the assigned recruitment challenge and submit your public GitHub or repository URL for automated AI evaluation.
          </p>
        </div>

        {/* ====================================== */}
        {/* ERROR MESSAGE */}
        {/* ====================================== */}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-[#B91C1C]/30 bg-[#FEE2E2]/70 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#B91C1C] text-xs font-bold text-white">
                  !
                </div>

                <div>
                  <p className="font-semibold text-[#B91C1C]">
                    Unable to continue
                  </p>

                  <p className="mt-1 text-sm text-[#1F2937]">
                    {error}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setError("")}
                className="text-xs font-semibold text-[#B91C1C] hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ====================================== */}
        {/* PROJECT / SUBMISSION / VERIFICATION */}
        {/* ====================================== */}

        {!project ? (
          <Card className="border-[#D6D3C8] bg-white shadow-sm">
            <CardContent className="py-14">
              <div className="text-center">
                <h2 className="text-lg font-bold text-[#1B4332]">
                  No Project Assigned
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-[#64748B]">
                  A project has not been assigned to your candidate profile yet. Please check back later or contact your recruiter.
                </p>
                <button
                  type="button"
                  onClick={loadCandidate}
                  className="mt-5 inline-flex items-center px-4 py-2 rounded-xl bg-[#40916C] text-white text-xs font-semibold hover:bg-[#347959] cursor-pointer"
                >
                  Refresh Status
                </button>
              </div>
            </CardContent>
          </Card>
        ) : verification?.state === "in_progress" || verification?.state === "accepted" || verification?.state === "rejected" ? (
          <VerificationResultView
            verification={verification}
            progress={verificationProgress}
            progressHistory={verificationHistory}
            displayIndex={replayIndex}
            onScheduleInterview={() => router.push("/student/interview-scheduling")}
          />
        ) : (
          <>
            {/* Assigned project briefing */}
            <Card className="border-[#D6D3C8] bg-white shadow-sm">
              <CardHeader
                title="Project Specification"
                subtitle="Review technical requirements before starting implementation."
              />
              <CardContent>
                <div className="rounded-xl border border-[#D8CDBB] bg-[#F5F1E8] p-5 sm:p-6 space-y-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Assigned Challenge</p>
                      <h2 className="mt-1 text-xl font-bold text-[#1B4332]">{project.title}</h2>
                    </div>
                    {project.difficulty && (
                      <span className="inline-flex w-fit rounded-full bg-[#1B4332] text-[#F5F1E8] px-3 py-1 text-xs font-semibold">
                        {project.difficulty}
                      </span>
                    )}
                  </div>

                  {project.description && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#1F2937]">Requirements & Guidelines</p>
                      <p className="whitespace-pre-line text-sm leading-6 text-[#1F2937] bg-white p-4 rounded-xl border border-[#D6D3C8]">{project.description}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm bg-white px-3.5 py-2.5 rounded-xl border border-[#D6D3C8]">
                    <span className="font-bold text-[#1B4332]">Deadline:</span>
                    <span className="text-[#64748B]">
                      {project.deadline || "Deadline timer begins once you download the project resources."}
                    </span>
                  </div>

                  <div className="border-t border-[#D8CDBB] pt-4">
                    {(project.pdfUrl || project.detailedPdfUrl || project.briefUrl) ? (
                      <button
                        type="button"
                        disabled={downloading}
                        onClick={downloadProject}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#40916C] hover:bg-[#347959] text-white font-semibold text-sm transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        {downloading ? "Preparing download..." : "Download Project Resources (PDF)"}
                      </button>
                    ) : (
                      <div className="rounded-xl border border-[#B45309]/30 bg-[#FFFBEB] p-4">
                        <p className="text-sm font-semibold text-[#B45309]">Project brief is currently being prepared.</p>
                        <p className="mt-1 text-xs text-[#64748B]">Please contact the hiring team to make the project brief available.</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submission appears only after the project has actually been downloaded. */}
            {(candidate?.projectSubmissionStatus === "downloaded" || candidate?.projectDownloadedAt) && (
              <Card className="border-[#D6D3C8] bg-white shadow-sm">
                <CardHeader
                  title="Submit Your Solution"
                  subtitle="Provide a public GitHub, GitLab, or hosted repository URL."
                />
                <CardContent>
                  <div className="max-w-2xl space-y-4">
                    <Input
                      label="GitHub / Repository URL"
                      type="url"
                      placeholder="https://github.com/username/project"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        if (error) setError("");
                      }}
                      disabled={submitting}
                    />
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      Make sure your repository is public so our automated verification engine can inspect your commits, dependencies, and test coverage.
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={!url.trim() || submitting}
                        onClick={submitProject}
                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-white font-semibold text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {submitting ? "Analyzing & Submitting..." : "Submit Project for Verification"}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </StudentShell>
  );
}
