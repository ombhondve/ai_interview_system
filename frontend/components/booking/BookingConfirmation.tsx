"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { enhancedBookingService, EnhancedSlot, BookingConfirmation } from "@/services/enhancedBooking.api";
import { bookingHelpers } from "@/services/enhancedBooking.api";

interface BookingConfirmationProps {
  candidateId: string;
  selectedSlot: EnhancedSlot;
  onBookingComplete: (confirmation: BookingConfirmation) => void;
  onCancel: () => void;
}

export function BookingConfirmationModal({
  candidateId,
  selectedSlot,
  onBookingComplete,
  onCancel,
}: BookingConfirmationProps) {
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string>("");
  const [bookingData, setBookingData] = useState({
    source: "portal",
    interviewType: "ai" as const,
    aiConfig: {
      difficulty: "intermediate" as const,
      duration: 30,
    },
  });

  const handleBookInterview = async () => {
    try {
      setBooking(true);
      setError("");

      const confirmation = await enhancedBookingService.bookInterview(
        candidateId,
        selectedSlot.id,
        bookingData
      );

      if (confirmation.success) {
        onBookingComplete(confirmation);
      } else {
        setError("Booking failed. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to book interview");
    } finally {
      setBooking(false);
    }
  };

  const formatSlotDetails = () => {
    const startTime = new Date(selectedSlot.startTime);
    const endTime = new Date(selectedSlot.endTime);

    return {
      date: startTime.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      time: `${startTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })} - ${endTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      duration: selectedSlot.duration || Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)),
      timezone: selectedSlot.timezone,
      location: selectedSlot.location || "Online",
    };
  };

  const slotDetails = formatSlotDetails();

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title="Confirm Interview Booking"
      description="Please review the details before confirming your interview booking."
    >
      <div className="space-y-6">
        {/* Error message */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Slot details */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-slate-500">Interview Date</h3>
                <p className="mt-1 text-lg font-semibold text-slate-900">{slotDetails.date}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-slate-500">Time</h3>
                  <p className="mt-1 font-medium text-slate-900">{slotDetails.time}</p>
                  {slotDetails.timezone && (
                    <p className="mt-1 text-sm text-slate-500">{slotDetails.timezone}</p>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-500">Duration</h3>
                  <p className="mt-1 font-medium text-slate-900">{slotDetails.duration} minutes</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-slate-500">Location</h3>
                <p className="mt-1 font-medium text-slate-900">{slotDetails.location}</p>
              </div>

              {/* Requirements */}
              {selectedSlot.requirements && (
                <div>
                  <h3 className="text-sm font-medium text-slate-500">Requirements</h3>
                  <div className="mt-2 space-y-2">
                    {selectedSlot.requirements.completedProfile && (
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-slate-600">Complete candidate profile</span>
                      </div>
                    )}
                    
                    {selectedSlot.requirements.requiredDocuments && selectedSlot.requirements.requiredDocuments.length > 0 && (
                      <div>
                        <p className="text-sm text-slate-600">Required documents:</p>
                        <ul className="mt-1 space-y-1 pl-5">
                          {selectedSlot.requirements.requiredDocuments.map((doc, index) => (
                            <li key={index} className="text-sm text-slate-600">• {doc}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Buffer times */}
              {selectedSlot.bufferTime && (
                <div>
                  <h3 className="text-sm font-medium text-slate-500">Buffer Times</h3>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-500">Join window opens</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {selectedSlot.bufferTime.before} minutes before
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-500">Join window closes</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {selectedSlot.bufferTime.after} minutes after
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Interview type selection */}
        <div>
          <h3 className="text-sm font-medium text-slate-900">Interview Type</h3>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setBookingData(prev => ({ ...prev, interviewType: "ai" }))}
              className={`rounded-lg border p-3 text-center transition ${
                bookingData.interviewType === "ai"
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="font-medium text-slate-900">AI Interview</div>
              <div className="mt-1 text-xs text-slate-500">Automated assessment</div>
            </button>
            
            <button
              type="button"
              onClick={() => setBookingData(prev => ({ ...prev, interviewType: "mock" }))}
              className={`rounded-lg border p-3 text-center transition ${
                bookingData.interviewType === "mock"
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="font-medium text-slate-900">Mock Interview</div>
              <div className="mt-1 text-xs text-slate-500">Practice session</div>
            </button>
            
            <button
              type="button"
              onClick={() => setBookingData(prev => ({ ...prev, interviewType: "live" }))}
              className={`rounded-lg border p-3 text-center transition ${
                bookingData.interviewType === "live"
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="font-medium text-slate-900">Live Interview</div>
              <div className="mt-1 text-xs text-slate-500">With interviewer</div>
            </button>
          </div>
        </div>

        {/* AI Configuration (if AI interview selected) */}
        {bookingData.interviewType === "ai" && (
          <div>
            <h3 className="text-sm font-medium text-slate-900">AI Configuration</h3>
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Difficulty Level</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["beginner", "intermediate", "advanced"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setBookingData(prev => ({
                        ...prev,
                        aiConfig: { ...prev.aiConfig, difficulty: level }
                      }))}
                      className={`rounded-lg border px-3 py-2 text-center text-sm capitalize ${
                        bookingData.aiConfig.difficulty === level
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-slate-500">Duration</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[30, 45, 60].map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setBookingData(prev => ({
                        ...prev,
                        aiConfig: { ...prev.aiConfig, duration: minutes }
                      }))}
                      className={`rounded-lg border px-3 py-2 text-center text-sm ${
                        bookingData.aiConfig.duration === minutes
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {minutes} min
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Important notes */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-sm font-medium text-slate-900">Important Notes</h4>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 mt-0.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Please arrive 5-10 minutes before your scheduled time</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 mt-0.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Ensure you have all required documents ready</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 mt-0.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4 4 0 003 15z" />
              </svg>
              <span>Stable internet connection and working microphone required</span>
            </li>
          </ul>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={booking}
          >
            Cancel
          </Button>
          <Button
            onClick={handleBookInterview}
            loading={booking}
            disabled={booking}
          >
            {booking ? "Booking..." : "Confirm Booking"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
