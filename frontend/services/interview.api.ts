import { Interview } from "@/types";
import { request } from "@/lib/client";

// Cached from the most recent /api/interviews response so getRoles() can stay
// synchronous for existing callers (e.g. app/admin/interviews/page.tsx).
let cachedRoles: string[] = [];

export interface InterviewFilters {
  tab?: "upcoming" | "completed" | "no_show";
  search?: string;
  role?: string | "all";
  date?: string;
}

export const interviewService = {
  async getInterviews(filters: InterviewFilters = {}): Promise<Interview[]> {
    const params = new URLSearchParams();
    if (filters.tab) params.set("tab", filters.tab);
    if (filters.search) params.set("search", filters.search);
    if (filters.role) params.set("role", filters.role);
    if (filters.date) params.set("date", filters.date);

    const result = await request<{ data: Interview[]; roles: string[] }>(
      `/api/interviews?${params.toString()}`
    );
    cachedRoles = result.roles;
    return result.data;
  },

  async getInterview(id: string): Promise<Interview | null> {
    try {
      return await request<Interview>(`/api/interviews/${id}`);
    } catch {
      return null;
    }
  },

  getRoles(): string[] {
    return cachedRoles;
  },
};
