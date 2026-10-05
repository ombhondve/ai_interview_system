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

type VerificationStage = VerificationProgress & {
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
      <Card className="border-emerald-200 bg-emerald-50/60">
        <CardContent className="p-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-2xl font-bold text-white">
              ✓
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-emerald-950">
              Accepted
            </h2>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              Your project passed verification.
            </p>
            <span className="mt-4 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
              Accepted
            </span>
            <div className="mt-7">
              <Button onClick={onScheduleInterview}>
                Schedule Interview →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === "rejected") {
    return (
      <Card className="border-rose-200 bg-rose-50/60">
        <CardContent className="p-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-2xl font-bold text-white">
              ×
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-rose-950">
              Rejected
            </h2>
            <p className="mt-2 text-sm leading-6 text-rose-800">
              Your project did not meet the required project requirements.
            </p>
            {verification.rejectionReason && (
              <div className="mt-6 rounded-xl border border-rose-200 bg-white/70 p-4 text-left">
                <p className="text-sm font-semibold text-rose-900">Reason</p>
                <p className="mt-2 text-sm leading-6 text-rose-800">
                  {verification.rejectionReason}
                </p>
              </div>
            )}
            <span className="mt-5 inline-flex rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-800">
              Rejected
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
    <Card className="border-blue-200 bg-blue-50/60">
      <CardContent className="p-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <h2 className="mt-5 text-xl font-semibold text-slate-950">Verifying your project</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {progress?.message || "Please wait while we analyze your submission."}
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
      ? "bg-red-600 text-white"
      : complete
        ? "bg-emerald-600 text-white"
        : active
          ? "bg-blue-600 text-white animate-pulse"
          : "bg-slate-200 text-slate-500";

  const labelClass =
    failed
      ? "font-semibold text-red-800"
      : active
        ? "font-semibold text-blue-800"
        : complete
          ? "text-slate-800"
          : "text-slate-500";

  return (
    <div className="relative flex items-start gap-3">
      <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-500 ${indicatorClass}`}>
        {active && !failed && !complete && (
          <span className="absolute inset-0 rounded-full border-2 border-blue-300 animate-ping" />
        )}
        <span className="relative z-10">
          {failed ? "×" : complete ? "✓" : active ? "•" : ""}
        </span>
      </span>
      <div className="min-w-0">
        <span className={`text-sm ${labelClass}`}>{label}</span>
        {message && <p className="mt-0.5 text-xs leading-5 text-slate-500">{message}</p>}
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

      const data =
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

        <div>
          <p className="text-sm font-medium text-slate-500">
            Candidate portal
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Project submission
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Complete the assigned project and submit
            your repository or deployed project URL.
          </p>
        </div>

        {/* ====================================== */}
        {/* ERROR MESSAGE */}
        {/* ====================================== */}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                  !
                </div>

                <div>
                  <p className="font-medium text-red-900">
                    Unable to continue
                  </p>

                  <p className="mt-1 text-sm text-red-700">
                    {error}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setError("")}
                className="text-sm font-medium text-red-700 hover:text-red-900"
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
          <Card>
            <CardContent className="py-14">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-slate-900">
                  No project assigned
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  A project has not been assigned to your application yet. Please check back later.
                </p>
                <Button className="mt-5" size="sm" onClick={loadCandidate}>
                  Refresh
                </Button>
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
            {/* Assigned project stays on this same page until the student submits. */}
            <Card>
              <CardHeader
                title="Assigned project"
                subtitle="Review the requirements before submitting your work."
              />
              <CardContent>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Project</p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-900">{project.title}</h2>
                    </div>
                    {project.difficulty && (
                      <span className="inline-flex w-fit rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                        {project.difficulty}
                      </span>
                    )}
                  </div>

                  {project.description && (
                    <div className="mt-5">
                      <p className="text-sm font-medium text-slate-800">Requirements</p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{project.description}</p>
                    </div>
                  )}

                  <div className="mt-5 flex items-center gap-2 text-sm">
                    <span className="font-medium text-slate-800">Deadline:</span>
                    <span className="text-slate-600">
                      {project.deadline || "Deadline will start after you download the project."}
                    </span>
                  </div>

                  <div className="mt-5 border-t border-slate-200 pt-5">
                    {(project.pdfUrl || project.detailedPdfUrl || project.briefUrl) ? (
                      <Button
                        loading={downloading}
                        disabled={downloading}
                        onClick={downloadProject}
                        className="w-full sm:w-auto"
                      >
                        {downloading ? "Preparing download..." : "Download Project"}
                      </Button>
                    ) : (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-medium text-amber-900">Project PDF is not available yet.</p>
                        <p className="mt-1 text-sm text-amber-700">Please contact the administrator to make the project PDF available.</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submission appears only after the project has actually been downloaded. */}
            {(candidate?.projectSubmissionStatus === "downloaded" || candidate?.projectDownloadedAt) && (
              <Card>
                <CardHeader
                  title="Submit your project"
                  subtitle="Provide a public repository or deployed project URL."
                />
                <CardContent>
                  <div className="max-w-2xl">
                    <Input
                      label="Project URL"
                      type="url"
                      placeholder="https://github.com/username/project"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        if (error) setError("");
                      }}
                      disabled={submitting}
                    />
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      You can submit a GitHub/GitLab repository, a live deployment, or another publicly accessible project URL.
                    </p>
                    <div className="mt-5">
                      <Button
                        loading={submitting}
                        disabled={!url.trim() || submitting}
                        onClick={submitProject}
                      >
                        Submit Project
                      </Button>
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
