"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Search,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Shield,
  Mail,
  CalendarDays,
  MoreHorizontal,
  X,
  Eye,
  EyeOff,
  Lock,
  UserCheck,
  UserX,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

type AdminRole = "Super Admin" | "Recruiter";

type AdminStatus = "Active" | "Inactive";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
  joined: string;
  lastActive: string;
};

const initialAdmins: AdminUser[] = [
  {
    id: "ADM-001",
    name: "Om Bhondve",
    email: "admin@recruitai.com",
    role: "Super Admin",
    status: "Active",
    joined: "Jan 12, 2026",
    lastActive: "Just now",
  },
  {
    id: "ADM-002",
    name: "Priya Patil",
    email: "priya@recruitai.com",
    role: "Recruiter",
    status: "Active",
    joined: "Mar 08, 2026",
    lastActive: "12 min ago",
  },
  {
    id: "ADM-003",
    name: "Amit Joshi",
    email: "amit@recruitai.com",
    role: "Recruiter",
    status: "Active",
    joined: "Apr 21, 2026",
    lastActive: "1 hour ago",
  },
  {
    id: "ADM-004",
    name: "Sneha More",
    email: "sneha@recruitai.com",
    role: "Recruiter",
    status: "Inactive",
    joined: "May 14, 2026",
    lastActive: "Sep 10, 2026",
  },
];

type AdminForm = {
  name: string;
  email: string;
  role: AdminRole;
  password: string;
};

const emptyForm: AdminForm = {
  name: "",
  email: "",
  role: "Recruiter",
  password: "",
};

export default function TeamPage() {
  const [admins, setAdmins] = useState<AdminUser[]>(initialAdmins);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<
    "All" | AdminRole
  >("All");
  const [statusFilter, setStatusFilter] = useState<
    "All" | AdminStatus
  >("All");

  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] =
    useState<AdminUser | null>(null);

  const [form, setForm] = useState<AdminForm>(emptyForm);

  const [showPassword, setShowPassword] = useState(false);

  const [deleteTarget, setDeleteTarget] =
    useState<AdminUser | null>(null);

  const [viewTarget, setViewTarget] =
    useState<AdminUser | null>(null);

  const [notice, setNotice] = useState("");

  const filteredAdmins = useMemo(() => {
    const query = search.trim().toLowerCase();

    return admins.filter((admin) => {
      const matchesSearch =
        !query ||
        admin.name.toLowerCase().includes(query) ||
        admin.email.toLowerCase().includes(query) ||
        admin.id.toLowerCase().includes(query);

      const matchesRole =
        roleFilter === "All" || admin.role === roleFilter;

      const matchesStatus =
        statusFilter === "All" ||
        admin.status === statusFilter;

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus
      );
    });
  }, [admins, search, roleFilter, statusFilter]);

  const totalAdmins = admins.length;

  const activeAdmins = admins.filter(
    (admin) => admin.status === "Active"
  ).length;

  const inactiveAdmins = admins.filter(
    (admin) => admin.status === "Inactive"
  ).length;

  const recruiters = admins.filter(
    (admin) => admin.role === "Recruiter"
  ).length;

  const showNotice = (message: string) => {
    setNotice(message);

    window.setTimeout(() => {
      setNotice("");
    }, 2500);
  };

  const openAddModal = () => {
    setEditingAdmin(null);
    setForm(emptyForm);
    setShowPassword(false);
    setShowModal(true);
  };

  const openEditModal = (admin: AdminUser) => {
    setEditingAdmin(admin);

    setForm({
      name: admin.name,
      email: admin.email,
      role: admin.role,
      password: "",
    });

    setShowPassword(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAdmin(null);
    setForm(emptyForm);
    setShowPassword(false);
  };

  const updateForm = <K extends keyof AdminForm>(
    field: K,
    value: AdminForm[K]
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const saveAdmin = () => {
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();

    if (!name || !email) {
      showNotice("Name and email are required.");
      return;
    }

    if (!email.includes("@")) {
      showNotice("Please enter a valid email address.");
      return;
    }

    const duplicateEmail = admins.some(
      (admin) =>
        admin.email.toLowerCase() === email &&
        admin.id !== editingAdmin?.id
    );

    if (duplicateEmail) {
      showNotice("An administrator with this email already exists.");
      return;
    }

    if (!editingAdmin) {
      if (form.password.length < 6) {
        showNotice(
          "Temporary password must contain at least 6 characters."
        );
        return;
      }

      const newAdmin: AdminUser = {
        id: `ADM-${String(admins.length + 1).padStart(3, "0")}`,
        name,
        email,
        role: form.role,
        status: "Active",
        joined: new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        lastActive: "Never",
      };

      setAdmins((current) => [...current, newAdmin]);

      closeModal();
      showNotice("Administrator added successfully.");
      return;
    }

    setAdmins((current) =>
      current.map((admin) =>
        admin.id === editingAdmin.id
          ? {
              ...admin,
              name,
              email,
              role: form.role,
            }
          : admin
      )
    );

    closeModal();
    showNotice("Administrator updated successfully.");
  };

  const toggleStatus = (admin: AdminUser) => {
    if (admin.role === "Super Admin") {
      showNotice("The Super Admin cannot be disabled.");
      return;
    }

    const newStatus: AdminStatus =
      admin.status === "Active" ? "Inactive" : "Active";

    setAdmins((current) =>
      current.map((item) =>
        item.id === admin.id
          ? {
              ...item,
              status: newStatus,
            }
          : item
      )
    );

    showNotice(
      newStatus === "Active"
        ? `${admin.name} has been activated.`
        : `${admin.name} has been deactivated.`
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;

    if (deleteTarget.role === "Super Admin") {
      showNotice("The Super Admin cannot be removed.");
      setDeleteTarget(null);
      return;
    }

    setAdmins((current) =>
      current.filter(
        (admin) => admin.id !== deleteTarget.id
      )
    );

    showNotice(
      `${deleteTarget.name} has been removed from the team.`
    );

    setDeleteTarget(null);
  };

  const resetFilters = () => {
    setSearch("");
    setRoleFilter("All");
    setStatusFilter("All");
  };

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* HEADER */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Users size={16} />
              Administration
            </div>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Team & Admins
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage administrator accounts, roles and access.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/settings"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-[#151922] dark:text-slate-200 dark:hover:bg-white/5"
            >
              Settings
            </Link>

            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
            >
              <UserPlus size={17} />
              Add Admin
            </button>
          </div>
        </div>

        {/* SUCCESS / ERROR NOTICE */}
        {notice && (
          <div className="fixed bottom-5 right-5 z-[100] flex max-w-sm items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-2xl dark:border-white/10 dark:bg-[#151922] dark:text-slate-200">
            <CheckCircle2
              size={18}
              className="shrink-0 text-emerald-500"
            />
            {notice}
          </div>
        )}

        {/* SECURITY NOTICE */}
        <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 dark:border-indigo-500/20 dark:bg-indigo-500/5 sm:p-6">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-[#151922] dark:text-indigo-400">
              <ShieldCheck size={20} />
            </div>

            <div>
              <h2 className="font-semibold text-indigo-900 dark:text-indigo-300">
                Administrator access
              </h2>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-indigo-700 dark:text-indigo-400">
                Only authorized administrators should have access
                to the recruitment dashboard. Super Admins can
                manage administrator accounts and permissions.
              </p>
            </div>
          </div>
        </section>

        {/* STATISTICS */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={<Users size={19} />}
            label="Total Admins"
            value={totalAdmins}
          />

          <StatCard
            icon={<UserCheck size={19} />}
            label="Active Admins"
            value={activeAdmins}
          />

          <StatCard
            icon={<UserX size={19} />}
            label="Inactive Admins"
            value={inactiveAdmins}
          />

          <StatCard
            icon={<Shield size={19} />}
            label="Recruiters"
            value={recruiters}
          />
        </div>

        {/* ADMIN LIST */}
        <section className="surface overflow-hidden rounded-2xl border shadow-sm">
          {/* SECTION HEADER */}
          <div className="border-b border-slate-200 p-5 dark:border-white/10 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">
                  Administrators
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {filteredAdmins.length} administrator
                  {filteredAdmins.length !== 1 ? "s" : ""} shown
                </p>
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                <RefreshCw size={14} />
                Reset Filters
              </button>
            </div>

            {/* FILTERS */}
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px]">
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search by name, email or ID..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-[#10141d] dark:text-white"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(
                    event.target.value as "All" | AdminRole
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#10141d] dark:text-white"
              >
                <option value="All">All Roles</option>
                <option value="Super Admin">Super Admin</option>
                <option value="Recruiter">Recruiter</option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as
                      | "All"
                      | AdminStatus
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#10141d] dark:text-white"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-white/[0.02]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Administrator
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Role
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Joined
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Last Active
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredAdmins.map((admin) => (
                  <AdminTableRow
                    key={admin.id}
                    admin={admin}
                    onView={() => setViewTarget(admin)}
                    onEdit={() => openEditModal(admin)}
                    onToggle={() => toggleStatus(admin)}
                    onDelete={() => setDeleteTarget(admin)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS */}
          <div className="space-y-3 p-4 md:hidden">
            {filteredAdmins.map((admin) => (
              <AdminMobileCard
                key={admin.id}
                admin={admin}
                onView={() => setViewTarget(admin)}
                onEdit={() => openEditModal(admin)}
                onToggle={() => toggleStatus(admin)}
                onDelete={() => setDeleteTarget(admin)}
              />
            ))}
          </div>

          {/* EMPTY STATE */}
          {filteredAdmins.length === 0 && (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">
                <Users size={22} />
              </div>

              <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">
                No administrators found
              </h3>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Try changing your search or filters.
              </p>

              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Clear Filters
              </button>
            </div>
          )}
        </section>

        {/* ROLE PERMISSIONS */}
        <section className="surface rounded-2xl border p-5 shadow-sm sm:p-6">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Role Permissions
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Access levels available in the recruitment system.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <PermissionCard
              icon={<ShieldCheck size={20} />}
              title="Super Admin"
              description="Full access to the recruitment platform and administrator management."
              permissions={[
                "Manage administrators",
                "Add and remove recruiters",
                "Activate and deactivate accounts",
                "Manage candidates",
                "Approve or reject candidates",
                "Manage interview slots",
                "Manage projects",
                "Review AI reports",
                "Make final hiring decisions",
                "View analytics",
                "Manage system settings",
              ]}
            />

            <PermissionCard
              icon={<Shield size={20} />}
              title="Recruiter"
              description="Recruitment access without administrator-management privileges."
              permissions={[
                "View candidates",
                "Review candidate profiles",
                "Manage interview slots",
                "View interviews",
                "View projects",
                "Review performance reports",
                "View analytics",
              ]}
            />
          </div>
        </section>
      </div>

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <AdminFormModal
          editingAdmin={editingAdmin}
          form={form}
          showPassword={showPassword}
          onChange={updateForm}
          onTogglePassword={() =>
            setShowPassword((value) => !value)
          }
          onClose={closeModal}
          onSave={saveAdmin}
        />
      )}

      {/* VIEW MODAL */}
      {viewTarget && (
        <ViewAdminModal
          admin={viewTarget}
          onClose={() => setViewTarget(null)}
          onEdit={() => {
            setViewTarget(null);
            openEditModal(viewTarget);
          }}
        />
      )}

      {/* DELETE MODAL */}
      {deleteTarget && (
        <DeleteModal
          admin={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </main>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="surface rounded-2xl border p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
          {icon}
        </div>

        <span className="text-2xl font-semibold text-slate-900 dark:text-white">
          {value}
        </span>
      </div>

      <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
    </div>
  );
}

/* =========================================================
   TABLE ROW
========================================================= */

function AdminTableRow({
  admin,
  onView,
  onEdit,
  onToggle,
  onDelete,
}: {
  admin: AdminUser;
  onView: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const initials = getInitials(admin.name);

  return (
    <tr className="border-b border-slate-100 transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/[0.02]">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <Avatar initials={initials} />

          <div>
            <button
              type="button"
              onClick={onView}
              className="text-left text-sm font-semibold text-slate-800 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
            >
              {admin.name}
            </button>

            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
              <Mail size={12} />
              {admin.email}
            </p>

            <p className="mt-0.5 text-[11px] text-slate-400">
              {admin.id}
            </p>
          </div>
        </div>
      </td>

      <td className="px-5 py-4">
        <RoleBadge role={admin.role} />
      </td>

      <td className="px-5 py-4">
        <StatusBadge status={admin.status} />
      </td>

      <td className="px-5 py-4">
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <CalendarDays size={14} />
          {admin.joined}
        </div>
      </td>

      <td className="px-5 py-4 text-sm text-slate-500">
        {admin.lastActive}
      </td>

      <td className="px-5 py-4">
        <div className="flex justify-end gap-1.5">
          <ActionButton
            title="View"
            onClick={onView}
          >
            <Eye size={15} />
          </ActionButton>

          <ActionButton
            title="Edit"
            onClick={onEdit}
          >
            <Pencil size={15} />
          </ActionButton>

          {admin.role !== "Super Admin" && (
            <>
              <ActionButton
                title={
                  admin.status === "Active"
                    ? "Deactivate"
                    : "Activate"
                }
                onClick={onToggle}
              >
                {admin.status === "Active" ? (
                  <XCircle size={15} />
                ) : (
                  <CheckCircle2 size={15} />
                )}
              </ActionButton>

              <ActionButton
                title="Remove"
                onClick={onDelete}
                danger
              >
                <Trash2 size={15} />
              </ActionButton>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

/* =========================================================
   MOBILE CARD
========================================================= */

function AdminMobileCard({
  admin,
  onView,
  onEdit,
  onToggle,
  onDelete,
}: {
  admin: AdminUser;
  onView: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const initials = getInitials(admin.name);

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
      <div className="flex items-start gap-3">
        <Avatar initials={initials} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <button
                type="button"
                onClick={onView}
                className="text-left text-sm font-semibold text-slate-800 dark:text-white"
              >
                {admin.name}
              </button>

              <p className="mt-0.5 truncate text-xs text-slate-400">
                {admin.email}
              </p>
            </div>

            <MoreHorizontal
              size={17}
              className="text-slate-400"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <RoleBadge role={admin.role} />
            <StatusBadge status={admin.status} />
          </div>

          <div className="mt-3 space-y-1 text-xs text-slate-400">
            <p>Admin ID: {admin.id}</p>
            <p>Joined: {admin.joined}</p>
            <p>Last active: {admin.lastActive}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-white/5">
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 dark:border-white/10 dark:text-slate-300"
        >
          <Eye size={14} />
          View
        </button>

        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 dark:border-white/10 dark:text-slate-300"
        >
          <Pencil size={14} />
          Edit
        </button>

        {admin.role !== "Super Admin" && (
          <>
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 dark:border-white/10 dark:text-slate-300"
            >
              {admin.status === "Active" ? (
                <>
                  <XCircle size={14} />
                  Disable
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  Activate
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 py-2 text-xs font-medium text-red-600 dark:border-red-500/20"
            >
              <Trash2 size={14} />
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   AVATAR
========================================================= */

function Avatar({
  initials,
}: {
  initials: string;
}) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
      {initials}
    </div>
  );
}

/* =========================================================
   ROLE BADGE
========================================================= */

function RoleBadge({
  role,
}: {
  role: AdminRole;
}) {
  const isSuperAdmin = role === "Super Admin";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        isSuperAdmin
          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400"
          : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400"
      }`}
    >
      {isSuperAdmin ? (
        <ShieldCheck size={13} />
      ) : (
        <Shield size={13} />
      )}

      {role}
    </span>
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({
  status,
}: {
  status: AdminStatus;
}) {
  const active = status === "Active";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
          : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />

      {status}
    </span>
  );
}

/* =========================================================
   ACTION BUTTON
========================================================= */

function ActionButton({
  children,
  title,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-lg border p-2 transition ${
        danger
          ? "border-red-200 text-red-500 hover:bg-red-50 dark:border-red-500/20 dark:hover:bg-red-500/10"
          : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:hover:bg-white/5 dark:hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/* =========================================================
   PERMISSION CARD
========================================================= */

function PermissionCard({
  icon,
  title,
  description,
  permissions,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  permissions: string[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-5 dark:border-white/10">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
        {icon}
      </div>

      <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">
        {title}
      </h3>

      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>

      <div className="mt-4 space-y-2">
        {permissions.map((permission) => (
          <div
            key={permission}
            className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
          >
            <CheckCircle2
              size={14}
              className="shrink-0 text-emerald-500"
            />

            {permission}
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   ADD / EDIT MODAL
========================================================= */

function AdminFormModal({
  editingAdmin,
  form,
  showPassword,
  onChange,
  onTogglePassword,
  onClose,
  onSave,
}: {
  editingAdmin: AdminUser | null;
  form: AdminForm;
  showPassword: boolean;
  onChange: <K extends keyof AdminForm>(
    field: K,
    value: AdminForm[K]
  ) => void;
  onTogglePassword: () => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#151922]">
        <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-white/10">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              {editingAdmin
                ? "Edit Administrator"
                : "Add Administrator"}
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {editingAdmin
                ? "Update the administrator's account information."
                : "Create a new administrator for the recruitment dashboard."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <FormField
            label="Full Name"
            value={form.name}
            placeholder="Enter administrator name"
            onChange={(value) =>
              onChange("name", value)
            }
          />

          <FormField
            label="Email Address"
            type="email"
            value={form.email}
            placeholder="admin@example.com"
            onChange={(value) =>
              onChange("email", value)
            }
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Role
            </label>

            <select
              value={form.role}
              onChange={(event) =>
                onChange(
                  "role",
                  event.target.value as AdminRole
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-[#10141d] dark:text-white"
            >
              <option value="Recruiter">Recruiter</option>
              <option value="Super Admin">
                Super Admin
              </option>
            </select>
          </div>

          {!editingAdmin && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Temporary Password
              </label>

              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type={
                    showPassword ? "text" : "password"
                  }
                  value={form.password}
                  onChange={(event) =>
                    onChange(
                      "password",
                      event.target.value
                    )
                  }
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-[#10141d] dark:text-white"
                />

                <button
                  type="button"
                  onClick={onTogglePassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </div>

              <p className="mt-1.5 text-xs text-slate-400">
                Frontend demo only. Real password
                creation must be handled securely by
                the backend.
              </p>
            </div>
          )}

          {editingAdmin && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-400">
              <div className="flex gap-2">
                <ShieldCheck
                  size={15}
                  className="mt-0.5 shrink-0 text-indigo-500"
                />

                <span>
                  Password changes should be implemented
                  through a secure backend password-reset
                  flow.
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 p-5 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-white/10 dark:text-slate-300"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {editingAdmin ? (
              <>
                <Pencil size={16} />
                Save Changes
              </>
            ) : (
              <>
                <UserPlus size={16} />
                Add Admin
              </>
            )}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

/* =========================================================
   VIEW ADMIN MODAL
========================================================= */

function ViewAdminModal({
  admin,
  onClose,
  onEdit,
}: {
  admin: AdminUser;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#151922]">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-white/10">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Administrator Details
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-4">
            <Avatar initials={getInitials(admin.name)} />

            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {admin.name}
              </h3>

              <p className="mt-0.5 text-sm text-slate-500">
                {admin.email}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <DetailRow
              label="Admin ID"
              value={admin.id}
            />

            <DetailRow
              label="Role"
              value={admin.role}
            />

            <DetailRow
              label="Status"
              value={admin.status}
            />

            <DetailRow
              label="Joined"
              value={admin.joined}
            />

            <DetailRow
              label="Last Active"
              value={admin.lastActive}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 p-5 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-white/10 dark:text-slate-300"
          >
            Close
          </button>

          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Pencil size={15} />
            Edit
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

/* =========================================================
   DELETE MODAL
========================================================= */

function DeleteModal({
  admin,
  onClose,
  onConfirm,
}: {
  admin: AdminUser;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#151922]">
        <div className="p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <AlertTriangle size={21} />
          </div>

          <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
            Remove administrator?
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            You are about to remove{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {admin.name}
            </span>{" "}
            from the administrator team.
          </p>

          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-xs leading-5 text-red-700 dark:border-red-500/20 dark:bg-red-500/5 dark:text-red-400">
            This is a frontend mock operation. The
            real backend should revoke the account and
            access tokens.
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 p-5 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-white/10 dark:text-slate-300"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
          >
            <Trash2 size={15} />
            Remove Admin
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

/* =========================================================
   FORM FIELD
========================================================= */

function FormField({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-[#10141d] dark:text-white"
      />
    </div>
  );
}

/* =========================================================
   DETAIL ROW
========================================================= */

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-3 dark:border-white/5">
      <span className="text-xs text-slate-500">
        {label}
      </span>

      <span className="text-right text-sm font-medium text-slate-800 dark:text-slate-200">
        {value}
      </span>
    </div>
  );
}

/* =========================================================
   MODAL BACKDROP
========================================================= */

function ModalBackdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      {children}
    </div>
  );
}

/* =========================================================
   HELPERS
========================================================= */

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}