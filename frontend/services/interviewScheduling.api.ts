import { apiUrl, backendApiUrl } from "@/lib/client";

export type InterviewSlotStatus = "available" | "already_taken" | "past";
export interface InterviewSlot { startAt: string; endAt: string; time: string; endTime: string; status: InterviewSlotStatus }
export interface InterviewConfig { timezone: string; interviewDurationMinutes: number; workingHours: { startHour: number; endHour: number }; allowedWeekdays: number[]; schedulingHorizonDays: number; minLeadHours: number; mode: "online" | "onsite" | "phone"; location: string }
export interface InterviewBooking { id: string; interviewId?: string | null; startAt: string; endAt: string; date: string; time: string; endTime: string; timezone: string; durationMinutes: number; status: string; mode: string; location: string; meetLink: string | null; bookedAt: string }
export interface InterviewConfigResponse { success: boolean; config: InterviewConfig; availableDates: string[]; interviewEligible: boolean; eligibilityReason: string | null; eligibilityMessage: string; candidate: { id: string; name: string }; existingBooking: InterviewBooking | null }
export interface AvailabilityResponse { success: boolean; date: string; timezone: string; interviewDurationMinutes: number; slots: InterviewSlot[] }
export interface BookInterviewResponse { success: boolean; message: string; booking: InterviewBooking; interviewId?: string | null }
export interface AdminScheduleEntry { startAt: string; endAt: string; time: string; endTime: string; status: string; booking: null | { id: string; status: string; bookedAt: string; candidate: { id: string | null; name: string | null; email: string | null; phone: string | null; role: string | null }; project: string | null; meetLink: string | null } }
export interface AdminScheduleResponse { date: string; timezone: string; interviewDurationMinutes: number; mode: string; location: string; entries: AdminScheduleEntry[]; readOnly: boolean; formattedDate?: string; serverTime?: string }
export interface AdminUpcomingInterview { id: string; startAt: string; endAt: string; date: string; time: string; endTime: string; status: string; candidate: { id: string | null; name: string | null; email: string | null; phone: string | null; role: string | null }; project: string | null; meetLink: string | null }
export class InterviewApiError extends Error { status: number; code: string; constructor(status: number, message: string, code: string) { super(message); this.name = "InterviewApiError"; this.status = status; this.code = code; } }
function toApiError(status: number, data: Record<string, unknown>): InterviewApiError { const code = typeof data?.code === "string" ? data.code : "UNKNOWN"; const message = typeof data?.message === "string" ? data.message : "Unable to complete the request."; return new InterviewApiError(status, message, code); }
async function call<T>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" }); const data = await response.json().catch(() => ({})); if (!response.ok) throw toApiError(response.status, data); return data as T; }
export const interviewSchedulingService = {
  getConfig: () => call<InterviewConfigResponse>(backendApiUrl("/api/student/interview/config")),
  getAvailability: (date: string) => call<AvailabilityResponse>(backendApiUrl(`/api/student/interview/availability?date=${encodeURIComponent(date)}`)),
  book: async (startAt: string) => call<BookInterviewResponse>(backendApiUrl("/api/student/interview/book"), { method: "POST", body: JSON.stringify({ startAt }) }),
};
export const adminScheduleService = {
  getSchedule: (date: string) => call<AdminScheduleResponse>(apiUrl(`/api/admin/interviews/schedule?date=${encodeURIComponent(date)}`)),
  getUpcoming: (limit = 50) => call<{ interviews: AdminUpcomingInterview[] }>(apiUrl(`/api/admin/interviews/upcoming?limit=${limit}`)),
};

