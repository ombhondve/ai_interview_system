import { request } from "@/lib/client";

// Enhanced booking types
export interface EnhancedSlot {
  id: string;
  startTime: string;
  endTime: string;
  timezone: string;
  capacity: number;
  bookedCount: number;
  status: "open" | "booked" | "cancelled" | "completed" | "hidden";
  location?: string;
  meetLink?: string;
  duration?: number;
  bufferTime?: {
    before: number; // minutes
    after: number; // minutes
  };
  requirements?: {
    requiredDocuments?: string[];
    completedProfile?: boolean;
    minimumScore?: number;
  };
  bookingWindow?: {
    maxHoursBefore: number;
    minHoursBefore: number;
  };
  recurrencePattern?: {
    type: "daily" | "weekly" | "monthly";
    interval: number;
    endDate?: string;
    exceptions?: string[];
  };
  tags?: string[];
  metadata?: {
    source: string;
    externalId?: string;
  };
  // Virtual/computed fields
  availableSeats?: number;
  isAvailable?: boolean;
  bookingWindowStatus?: "too_early" | "too_late" | "within_window";
}

export interface InterviewPreparationStatus {
  profileComplete: boolean;
  testCompleted: boolean;
  readinessScore: number;
  documentsSubmitted?: string[];
  preparationNotes?: string;
  lastPreparationCheck?: string;
}

export interface InterviewBooking {
  id: string;
  candidateId: string;
  slotId: string;
  status: "scheduled" | "pending_preparation" | "ready" | "confirmed" | "in_progress" | "completed" | "cancelled" | "rescheduled" | "no_show" | "failed";
  interviewType: "ai" | "mock" | "live";
  preparationStatus: InterviewPreparationStatus;
  bookingMetadata: {
    bookedAt: string;
    bookingSource: string;
    ipAddress?: string;
    userAgent?: string;
    bookingSessionId: string;
  };
  aiConfig?: {
    difficulty: "beginner" | "intermediate" | "advanced";
    duration: number;
  };
  timeline: Array<{
    event: string;
    timestamp: string;
    initiatedBy: "candidate" | "admin" | "system";
    data?: Record<string, any>;
  }>;
  rescheduleHistory?: Array<{
    fromSlot: string;
    toSlot: string;
    reason: string;
    requestedBy: string;
    timestamp: string;
  }>;
  cancellationData?: {
    cancelledAt: string;
    cancelledBy: string;
    reason: string;
    refundStatus: string;
  };
  calendarEventId?: string;
  metadata?: {
    source: string;
    tags: string[];
    calendarIntegration?: {
      integrated: boolean;
      eventId: string;
      integratedAt: string;
    };
  };
  // Populated fields
  slot?: EnhancedSlot;
  candidate?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role?: string;
  };
}

export interface BookingConfirmation {
  success: boolean;
  interview: InterviewBooking;
  bookingSteps: string[];
  nextStep: string;
  message: string;
}

export interface PreparationRequirements {
  documents: string[];
  profileComplete: boolean;
  testRequired: boolean;
}

export interface PreparationStep {
  id: string;
  title: string;
  description: string;
  required: boolean;
}

export interface PreparationUpdateResponse {
  success: boolean;
  interview: InterviewBooking;
  preparationComplete: boolean;
  nextAction: string;
  completionPercentage: number;
}

export interface InterviewStatusResponse {
  success: boolean;
  interview: InterviewBooking;
  phase: "scheduled" | "upcoming" | "starting_soon" | "in_progress" | "completed" | "cancelled" | "missed" | "no_show";
  timeline: {
    currentTime: string;
    interviewStart: string;
    interviewEnd: string;
    timeUntilStart: number;
    hoursUntilStart: number;
    formattedTimeUntil: string;
  };
  preparation: {
    progress: number;
    complete: boolean;
    requirements: string[];
  };
  nextActions: Array<{
    id: string;
    label: string;
    priority: "high" | "medium" | "low";
  }>;
  joinInstructions: {
    link: string;
    joinWindow: {
      opens: string;
      closes: string;
    };
    preparationTime: number;
    requirements: string[];
  };
}

export interface InterviewHistoryResponse {
  success: boolean;
  interviews: InterviewBooking[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  statistics: {
    totalInterviews: number;
    completed: number;
    completionRate: number;
    averageScore: number;
    statusBreakdown: Array<{
      _id: string;
      count: number;
      avgScore: number;
    }>;
  };
}

// Enhanced booking service
export const enhancedBookingService = {
  /**
   * Get available slots with enhanced filtering
   */
  async getAvailableSlots(filters?: {
    startDate?: string;
    endDate?: string;
    timezone?: string;
    role?: string;
    includeBooked?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<EnhancedSlot[]> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.set("startDate", filters.startDate);
    if (filters?.endDate) params.set("endDate", filters.endDate);
    if (filters?.timezone) params.set("timezone", filters.timezone);
    if (filters?.role) params.set("role", filters.role);
    if (filters?.includeBooked !== undefined) params.set("includeBooked", filters.includeBooked.toString());
    if (filters?.limit) params.set("limit", filters.limit.toString());
    if (filters?.offset) params.set("offset", filters.offset.toString());

    const result = await request<{ data: EnhancedSlot[] }>(
      `/api/interviews/slots?${params.toString()}`
    );
    return result.data;
  },

  /**
   * Check slot eligibility for a candidate
   */
  async checkSlotEligibility(slotId: string, candidateId: string): Promise<{
    eligible: boolean;
    failedChecks: string[];
    requirements?: {
      requiredDocuments?: string[];
      completedProfile?: boolean;
      minimumScore?: number;
    };
  }> {
    return request(`/api/interviews/slots/${slotId}/eligibility/${candidateId}`);
  },

  /**
   * Book an interview slot with enhanced workflow
   */
  async bookInterview(
    candidateId: string,
    slotId: string,
    bookingData?: {
      source?: string;
      interviewType?: "ai" | "mock" | "live";
      aiConfig?: {
        difficulty: "beginner" | "intermediate" | "advanced";
        duration: number;
      };
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<BookingConfirmation> {
    return request(`/api/interviews/${candidateId}/book/${slotId}`, {
      method: "POST",
      body: JSON.stringify(bookingData || {}),
    });
  },

  /**
   * Start preparation workflow
   */
  async startPreparation(interviewId: string, candidateId: string): Promise<{
    success: boolean;
    interview: InterviewBooking;
    requirements: PreparationRequirements;
    nextSteps: PreparationStep[];
  }> {
    return request(`/api/interviews/${interviewId}/candidate/${candidateId}/preparation/start`, {
      method: "POST",
    });
  },

  /**
   * Update preparation status
   */
  async updatePreparation(
    interviewId: string,
    candidateId: string,
    preparationData: {
      documentsSubmitted?: string[];
      profileComplete?: boolean;
      testCompleted?: boolean;
      readinessScore?: number;
      notes?: string;
    }
  ): Promise<PreparationUpdateResponse> {
    return request(`/api/interviews/${interviewId}/candidate/${candidateId}/preparation`, {
      method: "PUT",
      body: JSON.stringify(preparationData),
    });
  },

  /**
   * Confirm interview readiness
   */
  async confirmReadiness(interviewId: string, candidateId: string): Promise<{
    success: boolean;
    interview: InterviewBooking;
    nextAction: string;
    joinWindow: {
      opens: string;
      closes: string;
    };
  }> {
    return request(`/api/interviews/${interviewId}/candidate/${candidateId}/preparation/confirm`, {
      method: "POST",
    });
  },

  /**
   * Reschedule an interview
   */
  async rescheduleInterview(
    interviewId: string,
    candidateId: string,
    newSlotId: string,
    reason?: string
  ): Promise<{
    success: boolean;
    interview: InterviewBooking;
    previousSlot: EnhancedSlot;
    newSlot: EnhancedSlot;
    message: string;
  }> {
    return request(`/api/interviews/${interviewId}/candidate/${candidateId}/reschedule`, {
      method: "POST",
      body: JSON.stringify({ newSlotId, reason }),
    });
  },

  /**
   * Cancel an interview
   */
  async cancelInterview(
    interviewId: string,
    candidateId: string,
    reason?: string
  ): Promise<{
    success: boolean;
    interview: InterviewBooking;
    slotFreed: EnhancedSlot;
    message: string;
  }> {
    return request(`/api/interviews/${interviewId}/candidate/${candidateId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * Get interview status and next steps
   */
  async getInterviewStatus(interviewId: string, candidateId: string): Promise<InterviewStatusResponse> {
    return request(`/api/interviews/${interviewId}/candidate/${candidateId}/status`);
  },

  /**
   * Get candidate interview history
   */
  async getCandidateInterviewHistory(
    candidateId: string,
    filters?: {
      status?: string;
      limit?: number;
      offset?: number;
      sortBy?: string;
    }
  ): Promise<InterviewHistoryResponse> {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.limit) params.set("limit", filters.limit.toString());
    if (filters?.offset) params.set("offset", filters.offset.toString());
    if (filters?.sortBy) params.set("sortBy", filters.sortBy);

    return request(`/api/interviews/candidate/${candidateId}/history?${params.toString()}`);
  },

  /**
   * Get interview statistics for candidate
   */
  async getInterviewStatistics(candidateId: string): Promise<{
    totalInterviews: number;
    completed: number;
    completionRate: number;
    averageScore: number;
    statusBreakdown: Array<{
      _id: string;
      count: number;
      avgScore: number;
    }>;
  }> {
    const result = await request<{ data: any }>(`/api/interviews/candidate/${candidateId}/statistics`);
    return result.data;
  },

  /**
   * Get calendar integration status
   */
  async getCalendarIntegrationStatus(interviewId: string): Promise<{
    integrated: boolean;
    eventId?: string;
    eventLink?: string;
    status?: string;
  }> {
    try {
      return await request(`/api/interviews/${interviewId}/calendar/status`);
    } catch {
      return { integrated: false };
    }
  },

  /**
   * Send calendar invite (if not already sent)
   */
  async sendCalendarInvite(interviewId: string, candidateId: string): Promise<{
    success: boolean;
    eventId?: string;
    invitationLink?: string;
  }> {
    return request(`/api/interviews/${interviewId}/candidate/${candidateId}/calendar/invite`, {
      method: "POST",
    });
  },
};

// Helper functions
export const bookingHelpers = {
  formatDateTime(dateTime: string): string {
    const date = new Date(dateTime);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  },

  formatTimeRemaining(milliseconds: number): string {
    if (milliseconds <= 0) return "Now";

    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
    const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  },

  calculatePreparationProgress(preparationStatus: InterviewPreparationStatus): number {
    let progress = 0;
    let totalSteps = 3; // profile, documents, test

    // Profile completion
    if (preparationStatus.profileComplete) progress += 33;

    // Documents (if required)
    const hasDocuments = preparationStatus.documentsSubmitted && preparationStatus.documentsSubmitted.length > 0;
    if (hasDocuments) progress += 33;

    // Test completion
    if (preparationStatus.testCompleted) progress += 34;

    return Math.min(100, Math.round(progress));
  },

  getNextActionByPhase(phase: string, interview: InterviewBooking): string {
    switch (phase) {
      case "scheduled":
      case "upcoming":
        if (!interview.preparationStatus?.testCompleted) return "complete_preparation";
        if (interview.status === "scheduled") return "confirm_readiness";
        return "view_details";

      case "starting_soon":
        return "join_interview";

      case "completed":
        if (!interview.metadata?.feedbackSubmitted) return "submit_feedback";
        return "view_report";

      case "cancelled":
        return "book_new";

      default:
        return "view_details";
    }
  },
};
