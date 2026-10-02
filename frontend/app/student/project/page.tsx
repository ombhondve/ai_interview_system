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
  title: string;
  difficulty?: string;
  description?: string;
  deadline?: string;
};

type Candidate = {
  id: string;
  name?: string;
  role?: string;
  status?: string;
  assignedProject?: AssignedProject | null;
  projectSubmission?: {
    url?: string;
    submittedAt?: string;
    status?: string;
  } | null;
};

type ApiResponse = {
  candidate?: Candidate;
  message?: string;
};

export default function Project() {
  const router = useRouter();

  const [candidate, setCandidate] =
    useState<Candidate | null>(null);

  const [url, setUrl] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [showConfirm, setShowConfirm] =
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
          `${backendUrl}/api/student/me`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        const data: ApiResponse =
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

      setSuccess(
        "Your project has been submitted successfully."
      );

      /**
       * Keep the submitted URL visible.
       */
      setUrl(cleanUrl);

      /**
       * Close confirmation dialog.
       */
      setShowConfirm(false);

      /**
       * Refresh candidate data so the UI
       * reflects the current submission state.
       */
      await loadCandidate();
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

  const project =
    candidate?.assignedProject;

  const existingSubmission =
    candidate?.projectSubmission;

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
        {/* SUCCESS MESSAGE */}
        {/* ====================================== */}

        {success && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                ✓
              </div>

              <div>
                <p className="font-medium text-emerald-900">
                  Project submitted
                </p>

                <p className="mt-1 text-sm text-emerald-700">
                  {success}
                </p>
              </div>
            </div>
          </div>
        )}

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
        {/* NO PROJECT ASSIGNED */}
        {/* ====================================== */}

        {!project ? (
          <Card>
            <CardContent className="py-14">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-7 w-7 text-slate-500"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 13h6m-6 4h6M8 3h8a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2z"
                    />
                  </svg>
                </div>

                <h2 className="mt-4 text-lg font-semibold text-slate-900">
                  No project assigned
                </h2>

                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  A project has not been assigned to
                  your application yet. Please check
                  back later.
                </p>

                <Button
                  className="mt-5"
                  size="sm"
                  onClick={loadCandidate}
                >
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ==================================== */}
            {/* PROJECT DETAILS */}
            {/* ==================================== */}

            <Card>
              <CardHeader
                title="Assigned project"
                subtitle="Review the requirements before submitting your work."
              />

              <CardContent>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Project
                      </p>

                      <h2 className="mt-1 text-lg font-semibold text-slate-900">
                        {project.title}
                      </h2>
                    </div>

                    {project.difficulty && (
                      <span className="inline-flex w-fit rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                        {project.difficulty}
                      </span>
                    )}
                  </div>

                  {project.description && (
                    <div className="mt-5">
                      <p className="text-sm font-medium text-slate-800">
                        Requirements
                      </p>

                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                        {project.description}
                      </p>
                    </div>
                  )}

                  {project.deadline && (
                    <div className="mt-5 flex items-center gap-2 text-sm">
                      <span className="font-medium text-slate-800">
                        Deadline:
                      </span>

                      <span className="text-slate-600">
                        {project.deadline}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ==================================== */}
            {/* SUBMISSION FORM */}
            {/* ==================================== */}

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
                      setUrl(
                        e.target.value
                      );

                      if (error) {
                        setError("");
                      }

                      if (success) {
                        setSuccess("");
                      }
                    }}
                    disabled={submitting}
                  />

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    You can submit a GitHub/GitLab
                    repository, a live deployment, or
                    another publicly accessible project
                    URL.
                  </p>

                  {existingSubmission?.url && (
                    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm font-medium text-blue-900">
                        Previous submission
                      </p>

                      <a
                        href={
                          existingSubmission.url
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block break-all text-sm text-blue-700 underline hover:text-blue-900"
                      >
                        {
                          existingSubmission.url
                        }
                      </a>

                      {existingSubmission.submittedAt && (
                        <p className="mt-2 text-xs text-blue-700">
                          Submitted on{" "}
                          {
                            existingSubmission.submittedAt
                          }
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button
                      loading={submitting}
                      disabled={
                        !url.trim() ||
                        submitting
                      }
                      onClick={() =>
                        setShowConfirm(true)
                      }
                    >
                      {existingSubmission?.url
                        ? "Update submission"
                        : "Submit project"}
                    </Button>

                    {url.trim() && (
                      <button
                        type="button"
                        onClick={() =>
                          setUrl("")
                        }
                        disabled={
                          submitting
                        }
                        className="text-sm font-medium text-slate-500 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ==================================== */}
            {/* SUBMISSION GUIDELINES */}
            {/* ==================================== */}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">
                Submission guidelines
              </p>

              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>
                  • Make sure your repository or
                  deployment is accessible to the
                  reviewer.
                </p>

                <p>
                  • Include a clear README with setup
                  and usage instructions.
                </p>

                <p>
                  • Verify the submitted URL before
                  confirming.
                </p>

                <p>
                  • Do not submit passwords, API keys,
                  access tokens, or other secrets.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ======================================== */}
      {/* CONFIRMATION DIALOG */}
      {/* ======================================== */}

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-confirm-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="project-confirm-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Confirm project submission
                </h2>

                <p className="mt-1 text-sm leading-5 text-slate-500">
                  Please make sure the URL below is
                  correct before submitting.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowConfirm(false)
                }
                disabled={submitting}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close confirmation"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Project
              </p>

              <p className="mt-1 font-medium text-slate-900">
                {project?.title}
              </p>

              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                Submitted URL
              </p>

              <p className="mt-1 break-all text-sm text-slate-700">
                {url.trim()}
              </p>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                size="sm"
                onClick={() =>
                  setShowConfirm(false)
                }
                disabled={submitting}
              >
                Cancel
              </Button>

              <Button
                size="sm"
                loading={submitting}
                disabled={submitting}
                onClick={submitProject}
              >
                Confirm submission
              </Button>
            </div>
          </div>
        </div>
      )}
    </StudentShell>
  );
}
