import { Candidate, CandidateStatus } from "@/types";
import { request } from "@/lib/client";

let cachedRoles: string[] = [];
let cachedBatches: string[] = [];

export interface CandidateFilters {
  search?: string;
  status?: CandidateStatus | "all";
  role?: string | "all";
  batch?: string | "all";
  jdMatchMin?: number;
  sortBy?: "name" | "jdMatchScore" | "receivedDate";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface CandidateListResult {
  data: Candidate[];
  total: number;
  page: number;
  pageSize: number;
}

export const candidateService = {

  async getCandidates(
    filters: CandidateFilters = {}
  ): Promise<CandidateListResult> {

    const params = new URLSearchParams();

    if (filters.search)
      params.set("search", filters.search);

    if (filters.status)
      params.set("status", filters.status);

    if (filters.role)
      params.set("role", filters.role);

    if (filters.batch)
      params.set("batch", filters.batch);

    if (filters.jdMatchMin !== undefined)
      params.set(
        "jdMatchMin",
        String(filters.jdMatchMin)
      );

    if (filters.sortBy)
      params.set("sortBy", filters.sortBy);

    if (filters.sortDir)
      params.set("sortDir", filters.sortDir);

    params.set(
      "page",
      String(filters.page ?? 1)
    );

    params.set(
      "pageSize",
      String(filters.pageSize ?? 6)
    );

    const result = await request<{
      data: Candidate[];
      total: number;
      page: number;
      pageSize: number;
      roles: string[];
      batches: string[];
    }>(
      `/api/candidates?${params.toString()}`
    );

    cachedRoles = result.roles;
    cachedBatches = result.batches;

    return {
      data: result.data,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  },

  async getCandidate(
    id: string
  ): Promise<Candidate | null> {

    try {
      return await request<Candidate>(
        `/api/candidates/${id}`
      );
    } catch {
      return null;
    }
  },

  async approveCandidate(
    id: string
  ): Promise<Candidate | null> {

    const result = await request<{
      candidate: Candidate;
    }>(
      `/api/candidates/${id}/approve`,
      {
        method: "POST",
      }
    );

    return result.candidate;
  },

  async rejectCandidate(
    id: string,
    reason: string
  ): Promise<Candidate | null> {

    return request<Candidate>(
      `/api/candidates/${id}/reject`,
      {
        method: "POST",
        body: JSON.stringify({
          reason,
        }),
      }
    );
  },

  getRoles(): string[] {
    return cachedRoles;
  },

  getBatches(): string[] {
    return cachedBatches;
  },
};