"use client";

import { useState, useEffect } from "react";
import { StudentShell } from "@/components/student/StudentShell";
import { Card, CardContent } from "@/components/ui/Card";
import { SlotCalendar } from "@/components/booking/SlotCalendar";
import { BookingConfirmationModal } from "@/components/booking/BookingConfirmation";
import { PreparationWorkflow } from "@/components/booking/PreparationWorkflow";
import { enhancedBookingService } from "@/services/enhancedBooking.api";
import { bookingHelpers } from "@/services/enhancedBooking.api";

export default function EnhancedBookSlotPage() {
  const [candidateId, setCandidateId] = useState<string>("");
  const [candidate, setCandidate] = useState<any>(null);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [bookingConfirmation, setBookingConfirmation] = useState<any>(null);
  const [activeInterview, setActiveInterview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"slots" | "confirmation" | "preparation">("slots");

  useEffect(() => {
    loadCandidate();
  }, []);

  const loadCandidate = async () => {
    try {
      setLoading(true);
      setError("");
      
      // In a real app, this would come from authentication/API
      const response = await fetch("/api/student/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Your student session has expired.");
      }

      setCandidate(data.candidate);
      setCandidateId(data.candidate?.id || "");
      
      // Check if candidate already has an active interview
      if (data.candidate?.id) {
        const history = await enhancedBookingService.getCandidateInterviewHistory(data.candidate.id, {
          status: "scheduled,pending_preparation,ready,confirmed",
          limit: 1,
        });
        
        if (history.success && history.interviews.length > 0) {
          setActiveInterview(history.interviews[0]);
          setView("preparation");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load candidate information.");
    } finally {
      setLoading(false);
    }
  };

  const handleSlotSelect = (slot: any) => {
    setSelectedSlot(slot);
    setView("confirmation");
  };

  const handleBookingComplete = (confirmation: any) => {
    setBookingConfirmation(confirmation);
    setActiveInterview(confirmation.interview);
    setSelectedSlot(null);
    setView("preparation");
  };

  const handleBookingCancel = () => {
    setSelectedSlot(null);
    setView("slots");
  };

  const handlePreparationComplete = () => {
    // Refresh the active interview status
    if (candidateId && activeInterview) {
      enhancedBookingService.getInterviewStatus(activeInterview.id, candidateId)
        .then(status => {
          if (status.success) {
            setActiveInterview(status.interview);
          }
        })
        .catch(console.error);
    }
  };

  if (loading) {
    return (
      <StudentShell>
        <div className="mx-auto w-full max-w-5xl">
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                <p className="font-medium text-slate-900">Loading your information</p>
                <p className="mt-1 text-sm text-slate-500">Checking your student session...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </StudentShell>
    );
  }

  if (error) {
    return (
      <StudentShell>
        <div className="mx-auto w-full max-w-5xl">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-red-900">Unable to continue</h3>
                <p className="mt-1 text-red-600">{error}</p>
                <button
                  onClick={loadCandidate}
                  className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Try Again
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </StudentShell>
    );
  }

  return (
    <StudentShell>
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Header */}
        <div>
          <p className="text-sm font-medium text-slate-500">Enhanced Interview Scheduling</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {view === "slots" && "Book Your Interview"}
            {view === "confirmation" && "Confirm Booking"}
            {view === "preparation" && "Interview Preparation"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            {view === "slots" && "Select an available time slot and complete the enhanced booking workflow."}
            {view === "confirmation" && "Review and confirm your interview booking details."}
            {view === "preparation" && "Complete your preparation steps to get ready for the interview."}
          </p>
        </div>

        {/* Candidate Information */}
        {candidate && (
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Candidate
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {candidate.name || "Candidate"}
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

        {/* Success Message */}
        {bookingConfirmation && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                ✓
              </div>
              <div>
                <p className="font-medium text-emerald-900">
                  Interview Successfully Booked!
                </p>
                <p className="mt-1 text-sm text-emerald-700">
                  {bookingConfirmation.message}
                </p>
                {bookingConfirmation.interview?.slot?.startTime && (
                  <p className="mt-2 text-sm text-emerald-800">
                    Scheduled for: {bookingHelpers.formatDateTime(bookingConfirmation.interview.slot.startTime)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {view === "slots" && candidateId && (
          <SlotCalendar
            candidateId={candidateId}
            onSlotSelect={handleSlotSelect}
            filters={{
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              role: candidate?.role,
            }}
          />
        )}

        {view === "confirmation" && selectedSlot && candidateId && (
          <BookingConfirmationModal
            candidateId={candidateId}
            selectedSlot={selectedSlot}
            onBookingComplete={handleBookingComplete}
            onCancel={handleBookingCancel}
          />
        )}

        {view === "preparation" && activeInterview && candidateId && (
          <>
            {/* Interview Summary */}
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Interview Date</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {activeInterview.slot?.startTime 
                        ? bookingHelpers.formatDateTime(activeInterview.slot.startTime).split(" at ")[0]
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Interview Time</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {activeInterview.slot?.startTime 
                        ? bookingHelpers.formatDateTime(activeInterview.slot.startTime).split(" at ")[1]
                        : "N/A"}
                    </p>
                    {activeInterview.slot?.timezone && (
                      <p className="mt-1 text-sm text-slate-500">{activeInterview.slot.timezone}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Status</p>
                    <div className="mt-1">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                        activeInterview.status === "confirmed" 
                          ? "bg-green-100 text-green-800"
                          : activeInterview.status === "scheduled"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {activeInterview.status.charAt(0).toUpperCase() + activeInterview.status.slice(1).replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preparation Workflow */}
            <PreparationWorkflow
              candidateId={candidateId}
              interviewId={activeInterview.id}
              onPreparationComplete={handlePreparationComplete}
              onReadyToConfirm={handlePreparationComplete}
            />

            {/* Action Buttons */}
            <div className="flex justify-between gap-4">
              <button
                onClick={() => {
                  setActiveInterview(null);
                  setView("slots");
                  setBookingConfirmation(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Book Another Interview
              </button>
              
              {activeInterview.status === "confirmed" && activeInterview.slot?.meetLink && (
                <a
                  href={activeInterview.slot.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Join Interview
                </a>
              )}
            </div>
          </>
        )}

        {/* Information Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">Enhanced Booking Features</p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-500">
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 mt-0.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Multi-step preparation workflow with readiness scoring</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 mt-0.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Calendar integration with automatic reminders</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 mt-0.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Real-time status tracking and next-step guidance</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 mt-0.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Secure booking with eligibility validation</span>
            </li>
          </ul>
        </div>
      </div>
    </StudentShell>
  );
}
