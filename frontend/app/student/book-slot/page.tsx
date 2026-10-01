"use client";

import { useCallback, useEffect, useState } from "react";

import { StudentShell } from "@/components/student/StudentShell";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type InterviewSlot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  role?: string;
};

type Candidate = {
  id: string;
  name?: string;
  role?: string;
  status?: string;
};

type ApiResponse = {
  data?: InterviewSlot[];
  message?: string;
};

export default function BookSlot() {
  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [candidate, setCandidate] =
    useState<Candidate | null>(null);

  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] =
    useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedSlot, setSelectedSlot] =
    useState<InterviewSlot | null>(null);

  /**
   * ============================================
   * LOAD CURRENT STUDENT
   * ============================================
   *
   * This checks the authenticated student session.
   *
   * The backend remains responsible for actually
   * authorizing the candidate.
   */

  const loadCandidate = useCallback(
    async () => {
      try {
        const response = await fetch(
          "/api/student/me",
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ||
              "Your student session has expired."
          );
        }

        setCandidate(data.candidate);
      } catch (err) {
        throw err;
      }
    },
    []
  );

  /**
   * ============================================
   * LOAD AVAILABLE SLOTS
   * ============================================
   */

  const loadSlots = useCallback(
    async () => {
      const response = await fetch(
        "/api/student/slots",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data: ApiResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Unable to load interview slots."
        );
      }

      setSlots(data.data || []);
    },
    []
  );

  /**
   * ============================================
   * INITIAL PAGE LOAD
   * ============================================
   */

  const loadPage = useCallback(
    async () => {
      try {
        setLoading(true);
        setError("");

        await loadCandidate();
        await loadSlots();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load interview slots."
        );
      } finally {
        setLoading(false);
      }
    },
    [loadCandidate, loadSlots]
  );

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  /**
   * ============================================
   * BOOK INTERVIEW SLOT
   * ============================================
   */

  async function bookSlot(
    slot: InterviewSlot
  ) {
    /**
     * Prevent duplicate clicks.
     */
    if (bookingId) {
      return;
    }

    /**
     * Basic client-side validation.
     *
     * The backend MUST perform the real
     * authorization and availability checks.
     */
    if (!slot?.id) {
      setError(
        "This interview slot is no longer valid."
      );
      return;
    }

    setBookingId(slot.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        "/api/student/book",
        {
          method: "POST",

          credentials: "include",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            slotId: slot.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Unable to book this interview slot."
        );
      }

      /**
       * Booking successful.
       */
      setSuccess(
        "Your interview slot has been booked successfully."
      );

      /**
       * Close confirmation dialog.
       */
      setSelectedSlot(null);

      /**
       * Reload available slots.
       *
       * This removes the booked slot if the
       * backend no longer returns it.
       */
      await loadSlots();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to book the interview slot."
      );
    } finally {
      setBookingId(null);
    }
  }

  /**
   * ============================================
   * LOADING STATE
   * ============================================
   */

  if (loading) {
    return (
      <StudentShell>
        <div className="mx-auto w-full max-w-5xl">
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />

                <p className="font-medium text-slate-900">
                  Loading interview slots
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Checking your student session and
                  available slots...
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
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* ====================================== */}
        {/* HEADER */}
        {/* ====================================== */}

        <div>
          <p className="text-sm font-medium text-slate-500">
            Interview scheduling
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Book your interview
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Choose one available interview slot that
            works for you. Once booked, the slot will
            no longer be available to other candidates.
          </p>
        </div>

        {/* ====================================== */}
        {/* CANDIDATE INFORMATION */}
        {/* ====================================== */}

        {candidate && (
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Candidate
                  </p>

                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {candidate.name ||
                      "Candidate"}
                  </p>

                  {candidate.role && (
                    <p className="mt-1 text-sm text-slate-500">
                      Position:{" "}
                      <span className="font-medium text-slate-700">
                        {candidate.role}
                      </span>
                    </p>
                  )}
                </div>

                <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                  Eligible for scheduling
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ====================================== */}
        {/* SUCCESS MESSAGE */}
        {/* ====================================== */}

        {success && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
          >
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                ✓
              </div>

              <div>
                <p className="font-medium text-emerald-900">
                  Interview slot booked
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
              <div className="flex gap-3">
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
                aria-label="Dismiss error"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ====================================== */}
        {/* AVAILABLE SLOTS */}
        {/* ====================================== */}

        <Card>
          <CardHeader
            title="Available interview slots"
            subtitle={
              candidate?.role
                ? `Showing slots available for ${candidate.role}.`
                : "Choose an available time for your interview."
            }
          />

          <CardContent>
            {slots.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {slots.map((slot) => {
                  const isBooking =
                    bookingId === slot.id;

                  return (
                    <div
                      key={slot.id}
                      className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
                    >
                      {/* Date */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Interview date
                          </p>

                          <p className="mt-1 text-lg font-semibold text-slate-900">
                            {slot.date}
                          </p>
                        </div>

                        <div className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          Available
                        </div>
                      </div>

                      {/* Time */}
                      <div className="mt-4 rounded-lg bg-slate-50 p-3">
                        <p className="text-sm font-medium text-slate-900">
                          {slot.startTime} –{" "}
                          {slot.endTime}
                        </p>

                        {slot.timezone && (
                          <p className="mt-1 text-xs text-slate-500">
                            {slot.timezone}
                          </p>
                        )}
                      </div>

                      {/* Role */}
                      <div className="mt-4">
                        <p className="text-xs text-slate-500">
                          Role
                        </p>

                        <p className="mt-0.5 text-sm font-medium text-slate-700">
                          {slot.role ||
                            "Any role"}
                        </p>
                      </div>

                      {/* Button */}
                      <Button
                        className="mt-5 w-full"
                        size="sm"
                        loading={isBooking}
                        disabled={
                          bookingId !== null
                        }
                        onClick={() =>
                          setSelectedSlot(slot)
                        }
                      >
                        {isBooking
                          ? "Booking..."
                          : "Book this slot"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ================================== */
              /* NO SLOTS */
              /* ================================== */

              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-6 w-6 text-slate-500"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>

                <h3 className="mt-4 font-medium text-slate-900">
                  No interview slots available
                </h3>

                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  There are currently no matching
                  interview slots available for you.
                  Please check again later.
                </p>

                <Button
                  className="mt-5"
                  size="sm"
                  onClick={loadPage}
                >
                  Refresh slots
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ====================================== */}
        {/* SECURITY / BOOKING INFORMATION */}
        {/* ====================================== */}

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">
            Before you book
          </p>

          <ul className="mt-2 space-y-1.5 text-sm text-slate-500">
            <li>
              • Make sure the selected date and time
              work for you.
            </li>

            <li>
              • A slot may be taken by another
              candidate before you confirm it.
            </li>

            <li>
              • Your booking is confirmed only after
              the server successfully processes it.
            </li>
          </ul>
        </div>
      </div>

      {/* ======================================== */}
      {/* CONFIRMATION MODAL */}
      {/* ======================================== */}

      {selectedSlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-dialog-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="booking-dialog-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Confirm interview booking
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Please review the details before
                  confirming.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedSlot(null)
                }
                disabled={bookingId !== null}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Date
              </p>

              <p className="mt-1 font-semibold text-slate-900">
                {selectedSlot.date}
              </p>

              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                Time
              </p>

              <p className="mt-1 font-semibold text-slate-900">
                {selectedSlot.startTime} –{" "}
                {selectedSlot.endTime}
              </p>

              {selectedSlot.timezone && (
                <p className="mt-1 text-xs text-slate-500">
                  {selectedSlot.timezone}
                </p>
              )}

              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                Role
              </p>

              <p className="mt-1 font-semibold text-slate-900">
                {selectedSlot.role ||
                  candidate?.role ||
                  "Any role"}
              </p>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                size="sm"
                onClick={() =>
                  setSelectedSlot(null)
                }
                disabled={bookingId !== null}
              >
                Cancel
              </Button>

              <Button
                size="sm"
                loading={
                  bookingId ===
                  selectedSlot.id
                }
                disabled={
                  bookingId !== null
                }
                onClick={() =>
                  bookSlot(selectedSlot)
                }
              >
                Confirm booking
              </Button>
            </div>
          </div>
        </div>
      )}
    </StudentShell>
  );
}
