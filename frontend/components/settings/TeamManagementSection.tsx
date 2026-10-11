"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Shield,
  Mail,
  Clock3,
  CalendarDays,
  Search,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  fetchTeamMembers,
  createTeamMember,
  updateTeamMember,
  toggleTeamMemberStatus,
  deleteTeamMember,
  TeamMember,
  TeamOverview,
  AdminRole,
  AdminStatus,
} from "@/services/team.api";
import { apiUrl } from "@/lib/client";

function formatTimestamp(dateStr?: string | null) {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RoleBadge({ role }: { role: AdminRole }) {
  const isSuper = role === "superadmin";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        isSuper
          ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
          : "bg-slate-100 text-slate-700 border border-slate-200"
      )}
    >
      {isSuper ? <ShieldCheck className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
      {isSuper ? "Super Admin" : "Recruiter"}
    </span>
  );
}

function StatusBadge({ status }: { status: AdminStatus }) {
  const isActive = status === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        isActive
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
          : "bg-amber-50 text-amber-700 border border-amber-200/60"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isActive ? "bg-emerald-600" : "bg-amber-500"
        )}
      />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export function TeamManagementSection() {
  // Current logged in admin
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; role: string } | null>(null);

  // State
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [overview, setOverview] = useState<TeamOverview>({
    totalAdmins: 0,
    activeAdmins: 0,
    superAdminCount: 0,
    recruiterCount: 0,
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [activeMember, setActiveMember] = useState<TeamMember | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<AdminRole>("recruiter");
  const [formStatus, setFormStatus] = useState<AdminStatus>("active");
  const [formPassword, setFormPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Fetch current user from /api/auth/me
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(apiUrl("/api/auth/me"), { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setCurrentUser({
              id: String(data.user.id),
              email: data.user.email,
              role: data.user.role,
            });
          }
        }
      } catch {}
    }
    void checkAuth();
  }, []);

  const isSuperAdmin = currentUser?.role === "superadmin";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeamMembers({
        search: search.trim() || undefined,
        role: roleFilter === "all" ? undefined : roleFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
        limit: 20,
      });

      setMembers(data.members || []);
      setOverview(data.overview || {
        totalAdmins: 0,
        activeAdmins: 0,
        superAdminCount: 0,
        recruiterCount: 0,
      });
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err?.message || "Failed to load team roster.");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, page]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openAddModal = () => {
    setFormName("");
    setFormEmail("");
    setFormRole("recruiter");
    setFormPassword("");
    setShowPassword(false);
    setModalError(null);
    setAddModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formName.trim() || formName.trim().length < 2) {
      setModalError("Please enter a name with at least 2 characters.");
      return;
    }
    if (!formEmail.trim() || !formEmail.includes("@")) {
      setModalError("Please provide a valid email address.");
      return;
    }
    if (!formPassword || formPassword.length < 8) {
      setModalError("Password must be at least 8 characters.");
      return;
    }

    setModalLoading(true);
    try {
      await createTeamMember({
        name: formName.trim(),
        email: formEmail.trim(),
        role: formRole,
        password: formPassword,
      });

      setAddModalOpen(false);
      setSuccessNotice(`Team member ${formName.trim()} created successfully.`);
      setTimeout(() => setSuccessNotice(null), 4000);
      void loadData();
    } catch (err: any) {
      setModalError(err?.message || "Failed to create team member.");
    } finally {
      setModalLoading(false);
    }
  };

  const openEditModal = (member: TeamMember) => {
    setActiveMember(member);
    setFormName(member.name);
    setFormEmail(member.email);
    setFormRole(member.role);
    setFormStatus(member.status);
    setFormPassword("");
    setShowPassword(false);
    setModalError(null);
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMember) return;
    setModalError(null);

    if (!formName.trim() || formName.trim().length < 2) {
      setModalError("Please enter a name with at least 2 characters.");
      return;
    }
    if (formPassword && formPassword.length < 8) {
      setModalError("If changing password, it must be at least 8 characters.");
      return;
    }

    setModalLoading(true);
    try {
      await updateTeamMember(activeMember.id, {
        name: formName.trim(),
        role: formRole,
        status: formStatus,
        password: formPassword || undefined,
      });

      setEditModalOpen(false);
      setSuccessNotice(`Updated ${formName.trim()} successfully.`);
      setTimeout(() => setSuccessNotice(null), 4000);
      void loadData();
    } catch (err: any) {
      setModalError(err?.message || "Failed to update team member.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleStatus = async (member: TeamMember) => {
    const nextStatus: AdminStatus = member.status === "active" ? "inactive" : "active";
    try {
      await toggleTeamMemberStatus(member.id, nextStatus);
      setSuccessNotice(`${member.name} is now ${nextStatus}.`);
      setTimeout(() => setSuccessNotice(null), 4000);
      void loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to change account status.");
    }
  };

  const openDeleteModal = (member: TeamMember) => {
    setActiveMember(member);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!activeMember) return;
    setModalLoading(true);
    try {
      await deleteTeamMember(activeMember.id);
      setDeleteModalOpen(false);
      setSuccessNotice(`Removed ${activeMember.name} from team.`);
      setTimeout(() => setSuccessNotice(null), 4000);
      void loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to remove team member.");
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Notification Banner */}
      {successNotice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 shadow-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Role Notice */}
      {!isSuperAdmin && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
          <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Recruiter Read-Only Mode</p>
            <p className="mt-0.5 text-amber-700">
              You are signed in as a Recruiter. Creating new administrators, changing roles, or deactivating accounts requires Super Admin authorization.
            </p>
          </div>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748B]">Total Admins</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-xl font-bold text-[#111F33]">{overview.totalAdmins}</p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748B]">Active Members</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-xl font-bold text-[#111F33]">{overview.activeAdmins}</p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748B]">Super Admins</span>
            <ShieldCheck className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-xl font-bold text-[#111F33]">{overview.superAdminCount}</p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748B]">Recruiters</span>
            <Shield className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mt-2 text-xl font-bold text-[#111F33]">{overview.recruiterCount}</p>
        </div>
      </div>

      {/* Main Team Card */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
        {/* Card Header & Controls */}
        <div className="border-b border-[#E2E8F0] p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#111F33]">Team & Administrator Roster</h2>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Configure authorized recruitment staff and administrative access.
              </p>
            </div>

            {isSuperAdmin && (
              <Button
                size="sm"
                onClick={openAddModal}
                className="bg-[#1976D2] hover:bg-[#1565C0] text-xs font-semibold"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Admin
              </Button>
            )}
          </div>

          {/* Filters Bar */}
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email..."
                className="h-8.5 w-full rounded-md border border-[#E2E8F0] bg-[#F5F7FA] pl-8 pr-3 text-xs text-[#111F33] placeholder:text-slate-400 focus:border-[#1976D2] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-8.5 rounded-md border border-[#E2E8F0] bg-[#F5F7FA] px-2.5 text-xs text-[#111F33] focus:border-[#1976D2] focus:bg-white focus:outline-none"
              >
                <option value="all">All Roles</option>
                <option value="superadmin">Super Admin</option>
                <option value="recruiter">Recruiter</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8.5 rounded-md border border-[#E2E8F0] bg-[#F5F7FA] px-2.5 text-xs text-[#111F33] focus:border-[#1976D2] focus:bg-white focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <button
                type="button"
                onClick={() => void loadData()}
                className="flex h-8.5 w-8.5 items-center justify-center rounded-md border border-[#E2E8F0] bg-[#F5F7FA] text-[#64748B] hover:bg-white hover:text-[#111F33] transition-colors"
                title="Refresh roster"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              </button>
            </div>
          </div>
        </div>

        {/* Content Table / Cards */}
        {loading ? (
          <div className="p-8 text-center text-xs text-[#64748B]">
            <RefreshCw className="mx-auto h-5 w-5 animate-spin text-[#1976D2] mb-2" />
            Loading team roster...
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertTriangle className="mx-auto h-6 w-6 text-red-500 mb-2" />
            <p className="text-xs font-semibold text-[#111F33]">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void loadData()} className="mt-3 text-xs">
              Retry
            </Button>
          </div>
        ) : members.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-[#111F33]">No team members found</p>
            <p className="mt-1 text-xs text-[#64748B]">Try clearing your search or filter criteria.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F5F7FA]/60 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                    <th className="px-4 py-3">Team Member</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last Active</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-xs">
                  {members.map((member) => {
                    const initials = member.name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                    const isSelf = String(currentUser?.id) === String(member.id);

                    return (
                      <tr key={member.id} className="hover:bg-[#F5F7FA]/40 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111F33] text-white text-[11px] font-bold">
                              {initials}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 font-semibold text-[#111F33]">
                                <span>{member.name}</span>
                                {isSelf && (
                                  <span className="rounded bg-blue-100 px-1 text-[10px] text-[#1976D2] font-medium">
                                    You
                                  </span>
                                )}
                              </div>
                              <span className="flex items-center gap-1 text-[11px] text-[#64748B]">
                                <Mail className="h-3 w-3" />
                                {member.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <RoleBadge role={member.role} />
                        </td>

                        <td className="px-4 py-3.5">
                          <StatusBadge status={member.status} />
                        </td>

                        <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                          {formatTimestamp(member.lastLogin)}
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          {isSuperAdmin ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditModal(member)}
                                title="Edit Administrator"
                                className="rounded-md border border-[#E2E8F0] p-1.5 text-[#64748B] hover:bg-white hover:text-[#1976D2] transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleStatus(member)}
                                disabled={isSelf}
                                title={
                                  isSelf
                                    ? "Cannot deactivate your own account"
                                    : member.status === "active"
                                    ? "Deactivate Account"
                                    : "Activate Account"
                                }
                                className={cn(
                                  "rounded-md border p-1.5 transition-colors",
                                  isSelf && "opacity-40 cursor-not-allowed",
                                  member.status === "active"
                                    ? "border-amber-200 text-amber-600 hover:bg-amber-50"
                                    : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                )}
                              >
                                {member.status === "active" ? (
                                  <XCircle className="h-3.5 w-3.5" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => openDeleteModal(member)}
                                disabled={isSelf}
                                title={isSelf ? "Cannot delete yourself" : "Delete Team Member"}
                                className={cn(
                                  "rounded-md border border-red-200 p-1.5 text-red-500 hover:bg-red-50 transition-colors",
                                  isSelf && "opacity-40 cursor-not-allowed"
                                )}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Read-only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View Cards */}
            <div className="divide-y divide-[#E2E8F0] md:hidden">
              {members.map((member) => {
                const isSelf = String(currentUser?.id) === String(member.id);
                return (
                  <div key={member.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 font-semibold text-[#111F33] text-sm">
                          <span>{member.name}</span>
                          {isSelf && (
                            <span className="rounded bg-blue-100 px-1 text-[10px] text-[#1976D2] font-medium">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#64748B]">{member.email}</p>
                      </div>
                      <StatusBadge status={member.status} />
                    </div>

                    <div className="flex items-center gap-2">
                      <RoleBadge role={member.role} />
                      <span className="text-[11px] text-slate-400">
                        Active: {formatTimestamp(member.lastLogin)}
                      </span>
                    </div>

                    {isSuperAdmin && (
                      <div className="flex items-center gap-2 pt-1 border-t border-[#E2E8F0]">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(member)}
                          className="flex-1 text-xs h-8"
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(member)}
                          disabled={isSelf}
                          className="flex-1 text-xs h-8"
                        >
                          {member.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Role Permissions Reference Card */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#111F33]">Super Admin Privileges</h3>
              <p className="text-[11px] text-[#64748B]">Full administrative and workspace authority</p>
            </div>
          </div>
          <ul className="mt-3.5 space-y-1.5 text-xs text-[#64748B]">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Create, modify, deactivate, and delete administrators</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Full candidate lifecycle, hiring decisions & approvals</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>System integrations (Google Calendar OAuth, API access)</span>
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#111F33]">Recruiter Privileges</h3>
              <p className="text-[11px] text-[#64748B]">Standard hiring and interview operations</p>
            </div>
          </div>
          <ul className="mt-3.5 space-y-1.5 text-xs text-[#64748B]">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>View and evaluate candidates and interview sessions</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Manage scheduling slots and review candidate submissions</span>
            </li>
            <li className="flex items-center gap-2">
              <XCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>Cannot alter administrator accounts or system credentials</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Add Admin Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Administrator"
        description="Create an authorized administrator account for your RecruitAI workspace."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddModalOpen(false)}
              disabled={modalLoading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateSubmit}
              loading={modalLoading}
              className="bg-[#1976D2] hover:bg-[#1565C0]"
            >
              Create Account
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
          {modalError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
              {modalError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#111F33] mb-1">Full Name</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Sarah Connor"
              className="w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-xs text-[#111F33] focus:border-[#1976D2] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#111F33] mb-1">Email Address</label>
            <input
              type="email"
              required
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="admin@company.com"
              className="w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-xs text-[#111F33] focus:border-[#1976D2] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#111F33] mb-1">Assigned Role</label>
            <select
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as AdminRole)}
              className="w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-xs text-[#111F33] focus:border-[#1976D2] focus:outline-none"
            >
              <option value="recruiter">Recruiter (Standard Operations)</option>
              <option value="superadmin">Super Admin (Full Authority)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#111F33] mb-1">Initial Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-md border border-[#E2E8F0] px-3 py-2 pr-9 text-xs text-[#111F33] focus:border-[#1976D2] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-[#64748B]">Passwords are securely hashed with bcrypt on the server.</p>
          </div>
        </form>
      </Modal>

      {/* Edit Admin Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Administrator"
        description="Update role, account status, or credentials."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(false)}
              disabled={modalLoading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleEditSubmit}
              loading={modalLoading}
              className="bg-[#1976D2] hover:bg-[#1565C0]"
            >
              Save Changes
            </Button>
          </div>
        }
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
          {modalError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
              {modalError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#111F33] mb-1">Full Name</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-xs text-[#111F33] focus:border-[#1976D2] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#111F33] mb-1">Email (Cannot be modified)</label>
            <input
              type="email"
              disabled
              value={formEmail}
              className="w-full rounded-md border border-[#E2E8F0] bg-slate-50 px-3 py-2 text-xs text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#111F33] mb-1">Role</label>
            <select
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as AdminRole)}
              className="w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-xs text-[#111F33] focus:border-[#1976D2] focus:outline-none"
            >
              <option value="recruiter">Recruiter</option>
              <option value="superadmin">Super Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#111F33] mb-1">Account Status</label>
            <select
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as AdminStatus)}
              className="w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-xs text-[#111F33] focus:border-[#1976D2] focus:outline-none"
            >
              <option value="active">Active (Access allowed)</option>
              <option value="inactive">Inactive (Access denied)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#111F33] mb-1">
              Reset Password (Optional)
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Leave blank to preserve current password"
                className="w-full rounded-md border border-[#E2E8F0] px-3 py-2 pr-9 text-xs text-[#111F33] focus:border-[#1976D2] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Remove Administrator"
        description={`Are you sure you want to permanently remove ${activeMember?.name} (${activeMember?.email})?`}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
              disabled={modalLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
              loading={modalLoading}
            >
              Confirm Removal
            </Button>
          </div>
        }
      >
        <div className="py-2 text-xs text-[#64748B] space-y-2">
          <p>
            This action will delete the administrator account from the database. All existing audit logs, interviews, and candidate evaluations will remain intact.
          </p>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-800">
            <strong>Security note:</strong> The last Super Admin account cannot be deleted.
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default TeamManagementSection;
