"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/components/student/StudentShell";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/Card";
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
import { formatIndianDate, formatIndianTime } from "@/lib/dateUtils";
import {
  CalendarDays,
  Clock,
  Video,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Sparkles,
  MapPin,
  Globe,
} from "lucide-react";

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
   * Load candidate interview eligibility and scheduling config
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
      if (error instanceof InterviewApiError && error.status === 401) {
        router.replace("/student/verify");
        return;
      }

      setView({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load interview scheduling.",
      });
    }
  }, [router]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  /**
   * Fetch slot availability for selected date
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
            : "Unable to load interview slots.",
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
   * Book selected interview slot
   */
  const handleBook = useCallback(async () => {
    if (!selectedStartAt || booking) return;

    setBooking(true);
    setNotice(null);

    try {
      const result = await interviewSchedulingService.book(selectedStartAt);
      setBookingResult({ ...result.booking, interviewId: result.interviewId });
      setSelectedStartAt(null);
      await loadAvailability(selectedDate);
    } catch (error) {
      if (
        error instanceof InterviewApiError &&
        error.code === "INTERVIEW_TIME_ALREADY_BOOKED"
      ) {
        setNotice({
          tone: "warning",
          text: "This time slot was just booked by another applicant. Please select another slot.",
        });
        await loadAvailability(selectedDate);
      } else if (
        error instanceof InterviewApiError &&
        error.code === "INTERVIEW_ALREADY_BOOKED"
      ) {
        setNotice({
          tone: "warning",
          text: "You already have an active scheduled interview.",
        });
        await loadConfig();
      } else {
        setNotice({
          tone: "error",
          text:
            error instanceof Error
              ? error.message
              : "Unable to complete interview booking.",
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
  // LOADING STATE
  // ---------------------------------------------------------------
  if (view.kind === "loading") {
    return (
      <StudentShell>
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <Skeleton className="h-10 w-64 rounded-xl bg-[#E9E4D8]" />
          <Skeleton className="h-32 w-full rounded-2xl bg-white" />
          <Skeleton className="h-64 w-full rounded-2xl bg-white" />
        </div>
      </StudentShell>
    );
  }

  // ---------------------------------------------------------------
  // INELIGIBLE / UNVERIFIED / ERROR
  // ---------------------------------------------------------------
  if (view.kind === "ineligible" || view.kind === "error") {
    const alreadyBooked = view.kind === "ineligible" && view.alreadyBooked;

    return (
      <StudentShell>
        <div className="mx-auto w-full max-w-2xl">
          <Card className="border-[#D6D3C8] bg-white shadow-sm">
            <CardContent className="p-8 text-center space-y-4">
              <div
                className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold ${
                  alreadyBooked
                    ? "bg-[#EAF4EE] text-[#15803D]"
                    : "bg-[#FEE2E2] text-[#B91C1C]"
                }`}
              >
                {alreadyBooked ? "✓" : "!"}
              </div>

              <h1 className="text-xl font-bold text-[#1B4332]">
                {alreadyBooked
                  ? "Interview Already Scheduled"
                  : view.kind === "error"
                  ? "Unable to Load Scheduling"
                  : "Project Verification Pending"}
              </h1>

              <p className="text-sm leading-relaxed text-[#64748B] max-w-md mx-auto">
                {view.message}
              </p>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => router.push(alreadyBooked ? "/student/interview" : "/student/status")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#143326] cursor-pointer"
                >
                  {alreadyBooked ? "View Interview" : "Back to Dashboard"}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </StudentShell>
    );
  }

  // ---------------------------------------------------------------
  // CONFIRMED BOOKING VIEW
  // ---------------------------------------------------------------
  if (bookingResult) {
    return (
      <StudentShell>
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <div className="rounded-2xl border border-[#40916C]/40 bg-[#EAF4EE] p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#15803D] text-white">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#1B4332]">
                  Interview Scheduled
                </h1>
                <p className="text-sm text-[#1F2937] mt-1">
                  Your interview slot has been confirmed.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 bg-white p-5 rounded-xl border border-[#D6D3C8]">
              <Field label="Candidate" value={eligibleData?.candidate.name} />
              <Field label="Date" value={formatIndianDate(bookingResult.startAt || bookingResult.date)} />
              <Field label="Time" value={formatIndianTime(bookingResult.startAt || bookingResult.time, { includeTimezone: true })} />
              <Field label="Duration" value={`${bookingResult.durationMinutes} minutes`} />
              <Field label="Timezone" value="IST" />
              <Field label="Format" value={bookingResult.mode || "Google Meet Video"} />
            </div>

            {bookingResult.meetLink && (
              <div className="rounded-xl bg-[#1B4332] text-white p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D8CDBB]">
                  <Video className="h-4 w-4 text-[#40916C]" />
                  Official Google Meet Video Room
                </div>
                <a
                  href={bookingResult.meetLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#F5F1E8] hover:text-[#40916C] break-all underline"
                >
                  {bookingResult.meetLink}
                </a>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push("/student/interview")}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#40916C] hover:bg-[#347959] text-white text-sm font-semibold shadow-sm transition-all cursor-pointer"
              >
                <Video className="h-4 w-4" />
                <span>View Interview</span>
              </button>
              <button
                type="button"
                onClick={() => router.push("/student/status")}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-white border border-[#D6D3C8] text-[#1F2937] text-sm font-medium hover:bg-[#F5F1E8] cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </StudentShell>
    );
  }

  // ---------------------------------------------------------------
  // SCHEDULING SELECTION VIEW
  // ---------------------------------------------------------------
  return (
    <StudentShell>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Page Header */}
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-[#40916C]">
            Interview
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1B4332]">
            Schedule Interview
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-[#64748B]">
            Select an available date and time slot.
          </p>
        </div>

        {/* Verification Status Pill */}
        <div className="rounded-xl border border-[#40916C]/40 bg-[#EAF4EE] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#15803D] text-white text-sm font-bold">
              ✓
            </div>
            <div>
              <p className="text-sm font-bold text-[#1B4332]">
                Project Verified
              </p>
              <p className="text-xs text-[#1F2937]">
                Eligible for technical interview.
              </p>
            </div>
          </div>
          {config && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded bg-white text-[#1B4332] border border-[#D6D3C8]">
              <Clock className="h-3.5 w-3.5 text-[#40916C]" />
              {config.interviewDurationMinutes} min session
            </span>
          )}
        </div>

        {/* Notice Alert */}
        {notice && (
          <div
            role="alert"
            className={cn(
              "rounded-xl border px-4 py-3 text-xs sm:text-sm font-medium flex items-center gap-2",
              notice.tone === "error"
                ? "border-[#B91C1C]/30 bg-[#FEE2E2] text-[#B91C1C]"
                : "border-[#B45309]/30 bg-[#FEF3C7] text-[#B45309]"
            )}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{notice.text}</span>
          </div>
        )}

        {/* Date Selection Card */}
        <Card className="border-[#D6D3C8] bg-white shadow-sm">
          <CardHeader
            title="Select Date"
            subtitle="Available interview dates."
          />
          <CardContent>
            <div className="flex flex-wrap gap-2.5">
              {(eligibleData?.availableDates ?? []).map((date) => {
                const active = date === selectedDate;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer focus:outline-none",
                      active
                        ? "border-[#1B4332] bg-[#1B4332] text-white shadow-sm"
                        : "border-[#D6D3C8] bg-white text-[#1F2937] hover:border-[#40916C] hover:bg-[#F5F1E8]"
                    )}
                  >
                    {formatDateLabel(date)}
                  </button>
                );
              })}

              {(eligibleData?.availableDates ?? []).length === 0 && (
                <p className="text-sm text-[#64748B]">
                  No upcoming interview dates are open right now. Please check back shortly.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Time Selection Card */}
        <Card className="border-[#D6D3C8] bg-white shadow-sm">
          <CardHeader
            title="Select Time"
            subtitle="Available interview times."
          />
          <CardContent>
            {loadingSlots ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full rounded-xl bg-[#F5F1E8]" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-[#64748B]">
                No available interview slots found for this date. Please pick another date above.
              </p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-[#64748B]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#15803D]" />
                    Available
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#D8CDBB]" />
                    Already Taken
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#1B4332]" />
                    Selected
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {slots.map((slot) => {
                    const taken = slot.status === "already_taken";
                    const past = slot.status === "past";
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
                          "flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-all cursor-pointer",
                          selected &&
                            "border-[#1B4332] bg-[#EAF4EE] ring-2 ring-[#40916C] shadow-sm",
                          !selected &&
                            !disabled &&
                            "border-[#D6D3C8] bg-white hover:border-[#40916C] hover:bg-[#F5F1E8]",
                          disabled &&
                            "cursor-not-allowed border-[#D8CDBB] bg-[#E9E4D8]/50 opacity-60 text-[#64748B]"
                        )}
                      >
                        <span className="text-sm font-bold text-[#1F2937]">
                          {formatIndianTime(slot.time)}
                        </span>
                        <span className="text-[11px] font-medium text-[#64748B]">
                          {taken
                            ? "Already Taken"
                            : past
                            ? "Unavailable"
                            : "Available Slot"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Confirmation & Booking Card */}
        {selectedSlot && (
          <Card className="border-[#40916C]/40 bg-[#EAF4EE] shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#15803D]">
                    Selected Slot Confirmation
                  </p>
                  <p className="text-lg font-bold text-[#1B4332] mt-0.5">
                    {formatDateLabel(selectedDate, true)} at {formatIndianTime(selectedSlot.time, { includeTimezone: true })}
                  </p>
                  <p className="text-xs text-[#1F2937] mt-1">
                    Duration: {config?.interviewDurationMinutes ?? 30} mins • Timezone: {config?.timezone ?? "IST"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleBook}
                  disabled={booking}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-white font-semibold text-sm transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {booking ? "Scheduling..." : "Schedule Interview"}
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </StudentShell>
  );
}

function formatDateLabel(date: string, long = false) {
  if (!date) return "—";

  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: long ? "long" : "short",
    day: "numeric",
    month: long ? "long" : "short",
    ...(long ? { year: "numeric" } : {}),
    timeZone: "Asia/Kolkata",
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
      <dt className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-[#1F2937]">
        {value || "—"}
      </dd>
    </div>
  );
}