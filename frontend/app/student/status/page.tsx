"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { StudentShell } from "@/components/student/StudentShell";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/Card";

interface Candidate {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  status?: string;

  interview?: {
    date?: string;
    time?: string;
  };
}

/**
 * ============================================
 * FORMAT APPLICATION STATUS
 * ============================================
 */

function formatStatus(status?: string) {
  if (!status) {
    return "Pending";
  }

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

/**
 * ============================================
 * STATUS STYLES
 * =========================================
 */

function getStatusStyles(status?: string) {
  switch (status) {
    case "approved":
      return {
        badge:
          "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
        dot: "bg-emerald-500",
        icon: "✓",
      };

    case "rejected":
      return {
        badge:
          "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
        dot: "bg-red-500",
        icon: "×",
      };

    case "interview_scheduled":
      return {
        badge:
          "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
        dot: "bg-blue-500",
        icon: "•",
      };

    case "interview_completed":
      return {
        badge:
          "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200",
        dot: "bg-purple-500",
        icon: "✓",
      };

    case "shortlisted":
      return {
        badge:
          "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
        dot: "bg-amber-500",
        icon: "★",
      };

    default:
      return {
        badge:
          "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200",
        dot: "bg-slate-400",
        icon: "•",
      };
  }
}

/**
 * ============================================
 * FORMAT DATE
 * ============================================
 */

function formatDate(date?: string) {
  if (!date) {
    return "Not scheduled";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );
}

/**
 * ============================================
 * LOADING CARD
 * ============================================
 */

function LoadingCard() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-5 w-40 rounded bg-slate-200" />

          <div className="h-10 w-56 rounded bg-slate-200" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-28 rounded-xl bg-slate-100" />
            <div className="h-28 rounded-xl bg-slate-100" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ============================================
 * MAIN PAGE
 * ============================================
 */

export default function Status() {
  const router = useRouter();

  const [candidate, setCandidate] =
    useState<Candidate | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /**
   * ==========================================
   * LOAD CURRENT STUDENT
   * ==========================================
   */

  useEffect(() => {
    let mounted = true;

    async function loadCandidate() {
      try {
        setLoading(true);
        setError("");

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://ai-interview-system-eewl.vercel.app";
        const response = await fetch(
          `${backendUrl}/api/student/me`,
          {
            method: "GET",
            cache: "no-store",
            credentials: "include",
          }
        );

        const data =
          await response.json();

        /**
         * Student session is invalid.
         */
        if (!response.ok) {
          if (mounted) {
            router.replace(
              "/student/verify"
            );
          }

          return;
        }

        /**
         * Candidate data missing.
         */
        if (!data.candidate) {
          if (mounted) {
            setError(
              "Candidate information could not be found."
            );
          }

          return;
        }

        if (mounted) {
          setCandidate(
            data.candidate
          );
        }
      } catch (error) {
        console.error(
          "Failed to load student status:",
          error
        );

        if (mounted) {
          setError(
            "Unable to load your application status. Please try again."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadCandidate();

    return () => {
      mounted = false;
    };
  }, [router]);

  /**
   * ============================================
   * LOADING STATE
   * ============================================
   */

  if (loading) {
    return (
      <StudentShell>
        <div className="mx-auto w-full max-w-5xl space-y-5 sm:space-y-6">
          <div>
            <div className="h-7 w-56 animate-pulse rounded bg-slate-200 sm:h-8 sm:w-64" />

            <div className="mt-2 h-4 w-72 animate-pulse rounded bg-slate-100 sm:w-80" />
          </div>

          <LoadingCard />
        </div>
      </StudentShell>
    );
  }

  /**
   * ============================================
   * ERROR STATE
   * ============================================
   */

  if (error) {
    return (
      <StudentShell>
        <div className="mx-auto w-full max-w-5xl">
          <Card>
            <CardContent className="p-6 text-center sm:p-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl font-semibold text-red-600">
                !
              </div>

              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                Unable to load application
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                {error}
              </p>
            </CardContent>
          </Card>
        </div>
      </StudentShell>
    );
  }

  /**
   * ============================================
   * NO CANDIDATE
   * ============================================
   */

  if (!candidate) {
    return (
      <StudentShell>
        <div className="mx-auto w-full max-w-5xl">
          <Card>
            <CardContent className="p-6 text-center sm:p-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                ?
              </div>

              <p className="mt-4 text-sm text-slate-500">
                Candidate information could not
                be found.
              </p>
            </CardContent>
          </Card>
        </div>
      </StudentShell>
    );
  }

  /**
   * ============================================
   * STATUS DATA
   * ============================================
   */

  const statusStyles =
    getStatusStyles(
      candidate.status
    );

  const statusText =
    formatStatus(
      candidate.status
    );

  const hasInterview =
    Boolean(candidate.interview);

  /**
   * ============================================
   * MAIN UI
   * ============================================
   */

  return (
    <StudentShell>
      <div className="mx-auto w-full max-w-5xl space-y-5 sm:space-y-6">
        {/* ====================================== */}
        {/* PAGE HEADER */}
        {/* ====================================== */}

        <div>
          <p className="text-sm font-medium text-indigo-600">
            Candidate portal
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Application status
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            Track your recruitment progress and
            interview information.
          </p>
        </div>

        {/* ====================================== */}
        {/* MAIN CANDIDATE STATUS CARD */}
        {/* ====================================== */}

        <Card className="overflow-hidden">
          {/* Gradient header */}

          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-6 text-white sm:px-8 sm:py-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              {/* Candidate information */}

              <div className="min-w-0">
                <p className="text-sm font-medium text-indigo-100">
                  Welcome back
                </p>

                <h2 className="mt-1 break-words text-2xl font-bold sm:text-3xl">
                  {candidate.name}
                </h2>

                <p className="mt-2 break-words text-sm text-indigo-100 sm:text-base">
                  {candidate.role ||
                    "Candidate"}
                </p>
              </div>

              {/* Status badge */}

              <div
                className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${statusStyles.badge}`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${statusStyles.dot}`}
                />

                <span>
                  {statusText}
                </span>
              </div>
            </div>
          </div>

          {/* Candidate summary */}

          <CardContent className="p-5 sm:p-7 lg:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* ================================= */}
              {/* POSITION */}
              {/* ================================= */}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 transition-colors hover:bg-slate-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Position
                </p>

                <p className="mt-2 break-words text-base font-semibold leading-6 text-slate-900 sm:text-lg">
                  {candidate.role ||
                    "Not available"}
                </p>
              </div>

              {/* ================================= */}
              {/* CURRENT STAGE */}
              {/* ================================= */}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 transition-colors hover:bg-slate-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Current stage
                </p>

                <div className="mt-3 flex items-center gap-3">
                  <span
                    className={`h-3 w-3 shrink-0 rounded-full ${statusStyles.dot}`}
                  />

                  <p className="break-words text-base font-semibold text-slate-900 sm:text-lg">
                    {statusText}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ====================================== */}
        {/* INTERVIEW SECTION */}
        {/* ====================================== */}

        {hasInterview ? (
          <Card className="overflow-hidden">
            <CardHeader
              title="Interview scheduled"
              subtitle="Your interview details are shown below."
            />

            <CardContent className="p-5 sm:p-6">
              {/* Interview details */}

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Date */}

                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-lg">
                      📅
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        Interview date
                      </p>

                      <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-900 sm:text-base">
                        {formatDate(
                          candidate
                            .interview
                            ?.date
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Time */}

                <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-lg">
                      🕐
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                        Interview time
                      </p>

                      <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-900 sm:text-base">
                        {candidate
                          .interview
                          ?.time ||
                          "Not scheduled"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reminder */}

              <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                    ⏰
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-amber-900">
                      Interview reminder
                    </p>

                    <p className="mt-1 text-sm leading-6 text-amber-800">
                      Please make sure you are
                      available at the scheduled
                      date and time.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start gap-4">
                {/* Icon */}

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg">
                  📅
                </div>

                {/* Content */}

                <div className="min-w-0">
                  <p className="text-base font-semibold text-slate-900 sm:text-lg">
                    Interview not scheduled
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Interview details will appear
                    here when they are available.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ====================================== */}
        {/* APPLICATION INFORMATION */}
        {/* ====================================== */}

        <Card>
          <CardHeader
            title="Application information"
            subtitle="Information associated with your application."
          />

          <CardContent className="p-5 sm:p-6">
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {/* Candidate */}

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Candidate
                </p>

                <p className="mt-1 break-words text-sm font-medium text-slate-900">
                  {candidate.name}
                </p>
              </div>

              {/* Email */}

              {candidate.email && (
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Email
                  </p>

                  <p className="mt-1 break-all text-sm font-medium text-slate-900">
                    {candidate.email}
                  </p>
                </div>
              )}

              {/* Phone */}

              {candidate.phone && (
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Phone
                  </p>

                  <p className="mt-1 break-words text-sm font-medium text-slate-900">
                    {candidate.phone}
                  </p>
                </div>
              )}

              {/* Application status */}

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Application status
                </p>

                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusStyles.dot}`}
                  />

                  <p className="break-words text-sm font-medium text-slate-900">
                    {statusText}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ====================================== */}
        {/* MOBILE BOTTOM SPACING */}
        {/* ====================================== */}

        <div className="h-2 sm:h-4" />
      </div>
    </StudentShell>
  );
}
