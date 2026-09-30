"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { enhancedBookingService, EnhancedSlot } from "@/services/enhancedBooking.api";
import { bookingHelpers } from "@/services/enhancedBooking.api";

interface SlotCalendarProps {
  candidateId: string;
  onSlotSelect?: (slot: EnhancedSlot) => void;
  filters?: {
    startDate?: string;
    endDate?: string;
    timezone?: string;
    role?: string;
  };
}

export function SlotCalendar({ candidateId, onSlotSelect, filters }: SlotCalendarProps) {
  const [slots, setSlots] = useState<EnhancedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [checkingEligibility, setCheckingEligibility] = useState<string | null>(null);

  // Group slots by date
  const slotsByDate = slots.reduce((acc, slot) => {
    const date = new Date(slot.startTime).toISOString().split("T")[0];
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(slot);
    return acc;
  }, {} as Record<string, EnhancedSlot[]>);

  const dates = Object.keys(slotsByDate).sort();

  useEffect(() => {
    loadSlots();
  }, [filters]);

  const loadSlots = async () => {
    try {
      setLoading(true);
      setError("");
      const availableSlots = await enhancedBookingService.getAvailableSlots({
        ...filters,
        includeBooked: false,
      });
      setSlots(availableSlots);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load available slots");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckEligibility = async (slotId: string) => {
    try {
      setCheckingEligibility(slotId);
      const eligibility = await enhancedBookingService.checkSlotEligibility(slotId, candidateId);
      
      if (eligibility.eligible) {
        const slot = slots.find(s => s.id === slotId);
        if (slot && onSlotSelect) {
          onSlotSelect(slot);
        }
      } else {
        setError(`Not eligible: ${eligibility.failedChecks.join(", ")}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check eligibility");
    } finally {
      setCheckingEligibility(null);
    }
  };

  const getSlotStatusBadge = (slot: EnhancedSlot) => {
    if (!slot.isAvailable) {
      return <Badge variant="destructive">Unavailable</Badge>;
    }
    
    if (slot.bookingWindowStatus === "too_early") {
      return <Badge variant="secondary">Booking opens soon</Badge>;
    }
    
    if (slot.bookingWindowStatus === "too_late") {
      return <Badge variant="secondary">Booking closed</Badge>;
    }
    
    if (slot.availableSeats && slot.availableSeats > 0) {
      return <Badge variant="success">Available</Badge>;
    }
    
    return <Badge variant="outline">Full</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
            <p className="font-medium text-slate-900">Loading available slots</p>
            <p className="mt-1 text-sm text-slate-500">Checking schedule availability...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <p className="font-medium text-red-600">Error loading slots</p>
            <p className="mt-1 text-sm text-red-500">{error}</p>
            <Button className="mt-4" size="sm" onClick={loadSlots}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (slots.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <svg
                className="h-6 w-6 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="mt-4 font-medium text-slate-900">No slots available</h3>
            <p className="mt-1 text-sm text-slate-500">
              There are currently no interview slots available matching your criteria.
            </p>
            <Button className="mt-4" size="sm" onClick={loadSlots}>
              Refresh Slots
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Available Interview Slots"
          subtitle="Select a date to view available time slots"
        />
        <CardContent>
          {/* Date tabs */}
          <div className="mb-6 overflow-x-auto">
            <div className="flex space-x-2 pb-2">
              {dates.map((date) => (
                <Button
                  key={date}
                  size="sm"
                  variant={selectedDate === date ? "default" : "outline"}
                  onClick={() => setSelectedDate(date)}
                >
                  {new Date(date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </Button>
              ))}
            </div>
          </div>

          {/* Slots for selected date */}
          {selectedDate && slotsByDate[selectedDate] && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Slots for {new Date(selectedDate).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              
              <div className="grid gap-4 md:grid-cols-2">
                {slotsByDate[selectedDate].map((slot) => (
                  <div
                    key={slot.id}
                    className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">
                            {new Date(slot.startTime).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {" - "}
                            {new Date(slot.endTime).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {getSlotStatusBadge(slot)}
                        </div>
                        
                        <div className="mt-2 space-y-1 text-sm text-slate-600">
                          {slot.timezone && (
                            <div className="flex items-center gap-1">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{slot.timezone}</span>
                            </div>
                          )}
                          
                          {slot.location && (
                            <div className="flex items-center gap-1">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>{slot.location}</span>
                            </div>
                          )}
                          
                          {slot.availableSeats !== undefined && (
                            <div className="flex items-center gap-1">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13 0a9 9 0 10-18 0 9 9 0 0018 0z" />
                              </svg>
                              <span>{slot.availableSeats} seat{slot.availableSeats !== 1 ? "s" : ""} available</span>
                            </div>
                          )}
                        </div>
                        
                        {slot.requirements?.requiredDocuments && slot.requirements.requiredDocuments.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-slate-500">Required documents:</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {slot.requirements.requiredDocuments.map((doc, index) => (
                                <span key={index} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                                  {doc}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={!slot.isAvailable || checkingEligibility === slot.id}
                        loading={checkingEligibility === slot.id}
                        onClick={() => handleCheckEligibility(slot.id)}
                      >
                        {checkingEligibility === slot.id ? "Checking..." : "Select Slot"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedDate && !slotsByDate[selectedDate] && (
            <div className="py-8 text-center">
              <p className="text-slate-500">No slots available for the selected date.</p>
            </div>
          )}

          {!selectedDate && (
            <div className="py-8 text-center">
              <p className="text-slate-500">Please select a date to view available slots.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional information */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h4 className="font-medium text-slate-900">Booking Information</h4>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          <li className="flex items-start gap-2">
            <svg className="h-4 w-4 mt-0.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Slots are booked on a first-come, first-served basis</span>
          </li>
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
            <span>Ensure you have all required documents ready before booking</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
