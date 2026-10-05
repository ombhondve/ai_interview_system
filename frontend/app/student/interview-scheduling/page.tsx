"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { StudentShell } from "@/components/student/StudentShell";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  interviewSchedulingService,
  InterviewApiError,
} from "@/services/interviewScheduling.api";
import type {
  InterviewBooking,
  InterviewConfigResponse,
  InterviewSlot,
} from "@/services/interviewScheduling.api";
import { cn } from "@/lib/utils";

type ViewState =
  | { kind: "loading" }
  | { kind: "eligible"; data: InterviewConfigResponse }
  | { kind: "ineligible"; message: string; alreadyBooked: boolean }
  | { kind: "error"; message: string };

export default function InterviewSchedulingPage() {
  const router = useRouter();

  const [view, setView] = useState<ViewState>({ kind: "loading" });
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [selectedStartAt, setSelectedStartAt] = useState<string | null>(null);

  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookingResult, setBookingResult] =
    useState<InterviewBooking | null>(null);
  const [notice, setNotice] = useState<{
    tone: "error" | "warning";
    text: string;
  } | null>(null);

  /**
   * Load the student's eligibility + the interview configuration.
   *
   * The backend derives eligibility from the PERSISTED verification state, so a
   * VERIFIED student is never blocked by an admin-review step here.
   */
  const loadConfig = useCallback(async () => {
    try {
      const data = await interviewSchedulingService.getConfig();

      if (!data.interviewEligible) {
        setView({
          kind: "ineligible",
          message: data.eligibilityMessage,
          alreadyBooked: data.eligibilityReason === "already_booked",
        });
        return;
      }

      setView({ kind: "eligible", data });

      if (data.existingBooking) {
        setBookingResult(data.existingBooking);
      } else if (data.availableDates.length > 0) {
        setSelectedDate(data.availableDates[0]);
      }
    } catch (error) {
      setView({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load your interview eligibility.",
      });
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  /**
   * Fetch availability whenever the selected date changes.
   */
  const loadAvailability = useCallback(async (date: string) => {
    if (!date) return;

    setLoadingSlots(true);
    setSelectedStartAt(null);

    try {
      const data = await interviewSchedulingService.getAvailability(date);
      setSlots(data.slots || []);
    } catch (error) {
      setSlots([]);
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to load interview times.",
      });
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadAvailability(selectedDate);
    }
  }, [selectedDate, loadAvailability]);

  /**
   * Book the selected time.
   *
   * On a 409 conflict the page does NOT crash or reset: availability is
   * refreshed, the contested time becomes Already Taken, and the student can
   * immediately choose another slot.
   */
  const handleBook = useCallback(async () => {
    if (!selectedStartAt || booking) return;

    setBooking(true);
    setNotice(null);

    try {
      const result = await interviewSchedulingService.book(selectedStartAt);
      setBookingResult(result.booking);
      setSelectedStartAt(null);
      await loadAvailability(selectedDate);
    } catch (error) {
      if (
        error instanceof InterviewApiError &&
        error.code === "INTERVIEW_TIME_ALREADY_BOOKED"
      ) {
        setNotice({
          tone: "warning",
          text: "This interview time was just booked by another student. Please choose another available time.",
        });
        await loadAvailability(selectedDate);
      } else if (
        error instanceof InterviewApiError &&
        error.code === "INTERVIEW_ALREADY_BOOKED"
      ) {
        setNotice({
          tone: "warning",
          text: "You already have an active interview scheduled.",
        });
        await loadConfig();
      } else {
        setNotice({
          tone: "error",
          text:
            error instanceof Error
              ? error.message
              : "Unable to book this interview.",
        });
      }
    } finally {
      setBooking(false);
    }
  }, [
    selectedStartAt,
    booking,
    selectedDate,
    loadAvailability,
    loadConfig,
  ]);

  const eligibleData = view.kind === "eligible" ? view.data : null;
  const config = eligibleData?.config ?? null;

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.startAt === selectedStartAt) ?? null,
    [slots, selectedStartAt]
  );

  // ---------------------------------------------------------------
  // LOADING
  // ---------------------------------------------------------------

  if (view.kind === "loading") {
    return (
      <StudentShell>
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </StudentShell>
    );
  }

  // ---------------------------------------------------------------
  // NOT ELIGIBLE (rejected / unverified / already booked upstream)
  // ---------------------------------------------------------------

  if (view.kind === "ineligible" || view.kind === "error") {
    const alreadyBooked = view.kind === "ineligible" && view.alreadyBooked;

    return (
      <StudentShell>
        <div className="mx-auto w-full max-w-2xl">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <span className="text-2xl" aria-hidden>
                  {alreadyBooked ? "📅" : "⛔"}
                </span>

                <div>
                  <h1 className="text-lg font-semibold text-slate-900">
                    {alreadyBooked
                      ? "Interview already scheduled"
                      : view.kind === "error"
                        ? "Unable to load scheduling"
                        : "Project not verified"}
                  </h1>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {view.message}
                  </p>

                  <Button
                    className="mt-5"
                    variant="outline"
                    onClick={() => router.push("/student/status")}
                  >
                    Back to application status
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </StudentShell>
    );
  }

  // ---------------------------------------------------------------
  // ALREADY BOOKED
  // ---------------------------------------------------------------

  if (bookingResult) {
    return (
      <StudentShell>
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <Card className="border-emerald-200 bg-emerald-50/60">
            <CardContent className="p-6">
              <p className="text-lg font-semibold text-emerald-900">
                Interview Scheduled Successfully ✓
              </p>

              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Student"
                  value={eligibleData?.candidate.name}
                />
                <Field label="Date" value={bookingResult.date} />
                <Field label="Time" value={bookingResult.time} />
                <Field label="Status" value="Scheduled" />
                <Field
                  label="Interview duration"
                  value={`${bookingResult.durationMinutes} minutes`}
                />
                <Field label="Timezone" value={bookingResult.timezone} />
                <Field label="Mode" value={bookingResult.mode} />
                <Field label="Location" value={bookingResult.location} />
              </dl>

              {bookingResult.meetLink && (
                <p className="mt-5 text-sm text-slate-700">
                  Meeting link:{" "}
                  <a
                    className="font-medium underline"
                    href={bookingResult.meetLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {bookingResult.meetLink}
                  </a>
                </p>
              )}

              <p className="mt-6 rounded-lg bg-white/70 p-3 text-sm text-slate-600">
                You already have an active interview scheduled, so no further
                booking is possible.
              </p>

              <Button
                className="mt-5"
                variant="outline"
                onClick={() => router.push("/student/status")}
              >
                View application status
              </Button>
            </CardContent>
          </Card>
        </div>
      </StudentShell>
    );
  }

  // ---------------------------------------------------------------
  // SCHEDULING
  // ---------------------------------------------------------------

  return (
    <StudentShell>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Interview Scheduling
          </h1>
        </header>

        {/* --- Project verified confirmation --- */}
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardContent className="p-5">
            <p className="flex items-center gap-2 text-base font-semibold text-emerald-900">
              <span aria-hidden>✓</span>
              Project Verified
            </p>
            <p className="mt-2 text-sm leading-6 text-emerald-900/80">
              Your project has been successfully verified. You are eligible to
              schedule your interview.
            </p>
          </CardContent>
        </Card>

        {/* --- Booking configuration summary --- */}
        {config && (
          <Card>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
              <Field
                label="Interview duration"
                value={`${config.interviewDurationMinutes} minutes`}
              />
              <Field label="Timezone" value={config.timezone} />
              <Field
                label="Working hours"
                value={`${String(config.workingHours.startHour).padStart(2, "0")}:00 – ${String(config.workingHours.endHour).padStart(2, "0")}:00`}
              />
            </CardContent>
          </Card>
        )}

        {notice && (
          <div
            role="alert"
            className={cn(
              "rounded-xl border px-4 py-3 text-sm",
              notice.tone === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-amber-200 bg-amber-50 text-amber-800"
            )}
          >
            {notice.text}
          </div>
        )}

        {/* --- Date selection --- */}
        <Card>
          <CardHeader
            title="Select Interview Date"
            subtitle="Only dates with interview availability are shown."
          />
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(eligibleData?.availableDates ?? []).map((date) => {
                const active = date === selectedDate;

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "border-accent-600 bg-accent-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-accent-400 hover:bg-slate-50"
                    )}
                  >
                    {formatDateLabel(date)}
                  </button>
                );
              })}

              {(eligibleData?.availableDates ?? []).length === 0 && (
                <p className="text-sm text-slate-500">
                  No interview dates are currently open for booking.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* --- Time selection --- */}
        <Card>
          <CardHeader
            title="Select Interview Time"
            subtitle="Times already taken are shown but cannot be selected."
          />
          <CardContent>
            {loadingSlots ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-slate-500">
                No interview times are available for this date.
              </p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Available
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                    Already Taken
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-accent-600" />
                    Selected
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {slots.map((slot) => {
                    const taken = slot.status === "already_taken";
                    const past = slot.status === "past";
                    // Already-taken and past times are NOT clickable.
                    const disabled = taken || past;
                    const selected = slot.startAt === selectedStartAt;

                    return (
                      <button
                        key={slot.startAt}
                        type="button"
                        disabled={disabled}
                        aria-pressed={selected}
                        aria-disabled={disabled}
                        onClick={() => setSelectedStartAt(slot.startAt)}
                        className={cn(
                          "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
                          selected &&
                            "border-accent-600 bg-accent-50 ring-2 ring-accent-600",
                          !selected &&
                            !disabled &&
                            "border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100",
                          disabled &&
                            "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60"
                        )}
                      >
                        <span className="text-sm font-semibold text-slate-900">
                          {slot.time}
                        </span>
                        <span className="text-xs text-slate-500">
                          {taken
                            ? "Already Taken"
                            : past
                              ? "Unavailable"
                              : "Available"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* --- Confirmation --- */}
        {selectedSlot && (
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Selected interview
              </p>

              <dl className="mt-3 grid gap-4 sm:grid-cols-3">
                <Field
                  label="Date"
                  value={formatDateLabel(selectedDate, true)}
                />
                <Field label="Time" value={selectedSlot.time} />
                <Field
                  label="Duration"
                  value={`${config?.interviewDurationMinutes ?? 0} minutes`}
                />
              </dl>

              <Button
                className="mt-5"
                onClick={handleBook}
                loading={booking}
                disabled={booking}
              >
                Book Interview
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </StudentShell>
  );
}

/**
 * Format a "YYYY-MM-DD" calendar date for display.
 *
 * The value is a calendar date rather than an instant, so it is formatted in
 * UTC to avoid shifting to the previous/next day.
 */
function formatDateLabel(date: string, long = false) {
  if (!date) return "—";

  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: long ? "long" : "short",
    day: "numeric",
    month: long ? "long" : "short",
    ...(long ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

function Field({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-900">
        {value || "—"}
      </dd>
    </div>
  );
}