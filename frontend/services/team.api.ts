import { apiUrl } from "@/lib/client";

export type AdminRole = "superadmin" | "recruiter";
export type AdminStatus = "active" | "inactive";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
  lastLogin?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeamOverview {
  totalAdmins: number;
  activeAdmins: number;
  superAdminCount: number;
  recruiterCount: number;
}

export interface TeamListResponse {
  success: boolean;
  members: TeamMember[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  overview: TeamOverview;
}

export interface CreateTeamMemberPayload {
  name: string;
  email: string;
  role: AdminRole;
  password?: string;
}

export interface UpdateTeamMemberPayload {
  name?: string;
  role?: AdminRole;
  status?: AdminStatus;
  password?: string;
}

export async function fetchTeamMembers(options: {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
} = {}): Promise<TeamListResponse> {
  const query = new URLSearchParams();
  if (options.search) query.set("search", options.search.trim());
  if (options.role && options.role !== "all" && options.role !== "All") query.set("role", options.role);
  if (options.status && options.status !== "all" && options.status !== "All") query.set("status", options.status);
  if (options.page) query.set("page", String(options.page));
  if (options.limit) query.set("limit", String(options.limit));

  const res = await fetch(apiUrl(`/api/admin/team?${query.toString()}`), {
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to load team members.");
  }

  return res.json();
}

export async function createTeamMember(payload: CreateTeamMemberPayload): Promise<TeamMember> {
  const res = await fetch(apiUrl("/api/admin/team"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to create team member.");
  }

  const data = await res.json();
  return data.member;
}

export async function updateTeamMember(
  id: string,
  payload: UpdateTeamMemberPayload
): Promise<TeamMember> {
  const res = await fetch(apiUrl(`/api/admin/team/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to update team member.");
  }

  const data = await res.json();
  return data.member;
}

export async function toggleTeamMemberStatus(
  id: string,
  status: AdminStatus
): Promise<TeamMember> {
  const res = await fetch(apiUrl(`/api/admin/team/${id}/status`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to update team member status.");
  }

  const data = await res.json();
  return data.member;
}

export async function deleteTeamMember(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/admin/team/${id}`), {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to delete team member.");
  }
}
