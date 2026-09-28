"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  X,
  User,
  Shield,
  Users,
  CalendarDays,
  FileText,
  Settings,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock3,
  ChevronDown,
  Trash2,
  LogIn,
  LogOut,
  UserPlus,
  Pencil,
  Ban,
} from "lucide-react";

type AuditAction =
  | "Login"
  | "Logout"
  | "Create"
  | "Update"
  | "Delete"
  | "Approve"
  | "Reject"
  | "Activate"
  | "Deactivate";

type AuditCategory =
  | "Authentication"
  | "Candidates"
  | "Interviews"
  | "Slots"
  | "Projects"
  | "Reports"
  | "Team"
  | "Settings";

type AuditSeverity = "Info" | "Success" | "Warning" | "Critical";

type AuditLog = {
  id: string;
  action: AuditAction;
  category: AuditCategory;
  description: string;
  performedBy: string;
  email: string;
  target: string;
  targetId: string;
  timestamp: string;
  ipAddress: string;
  severity: AuditSeverity;
};

const initialLogs: AuditLog[] = [
  {
    id: "LOG-001",
    action: "Login",
    category: "Authentication",
    description: "Administrator logged into the dashboard.",
    performedBy: "Om Bhondve",
    email: "admin@recruitai.com",
    target: "Admin Dashboard",
    targetId: "ADM-001",
    timestamp: "2026-09-17 14:32:18",
    ipAddress: "192.168.1.10",
    severity: "Success",
  },
  {
    id: "LOG-002",
    action: "Approve",
    category: "Candidates",
    description: "Candidate application was approved for interview scheduling.",
    performedBy: "Om Bhondve",
    email: "admin@recruitai.com",
    target: "Priya Patil",
    targetId: "CAN-002",
    timestamp: "2026-09-17 14:18:42",
    ipAddress: "192.168.1.10",
    severity: "Success",
  },
  {
    id: "LOG-003",
    action: "Create",
    category: "Slots",
    description: "New interview slot was created.",
    performedBy: "Priya Patil",
    email: "priya@recruitai.com",
    target: "Interview Slot",
    targetId: "SLOT-007",
    timestamp: "2026-09-17 13:55:10",
    ipAddress: "192.168.1.25",
    severity: "Info",
  },
  {
    id: "LOG-004",
    action: "Update",
    category: "Candidates",
    description: "Candidate profile information was updated.",
    performedBy: "Amit Joshi",
    email: "amit@recruitai.com",
    target: "Rahul Sharma",
    targetId: "CAN-001",
    timestamp: "2026-09-17 13:21:05",
    ipAddress: "192.168.1.31",
    severity: "Info",
  },
  {
    id: "LOG-005",
    action: "Reject",
    category: "Candidates",
    description: "Candidate application was rejected.",
    performedBy: "Om Bhondve",
    email: "admin@recruitai.com",
    target: "Candidate Application",
    targetId: "CAN-008",
    timestamp: "2026-09-17 12:48:32",
    ipAddress: "192.168.1.10",
    severity: "Warning",
  },
  {
    id: "LOG-006",
    action: "Create",
    category: "Team",
    description: "New recruiter administrator account was created.",
    performedBy: "Om Bhondve",
    email: "admin@recruitai.com",
    target: "Sneha More",
    targetId: "ADM-004",
    timestamp: "2026-09-17 11:35:22",
    ipAddress: "192.168.1.10",
    severity: "Success",
  },
  {
    id: "LOG-007",
    action: "Deactivate",
    category: "Team",
    description: "Administrator account was deactivated.",
    performedBy: "Om Bhondve",
    email: "admin@recruitai.com",
    target: "Sneha More",
    targetId: "ADM-004",
    timestamp: "2026-09-17 11:10:14",
    ipAddress: "192.168.1.10",
    severity: "Warning",
  },
  {
    id: "LOG-008",
    action: "Update",
    category: "Settings",
    description: "Notification preferences were updated.",
    performedBy: "Om Bhondve",
    email: "admin@recruitai.com",
    target: "Notification Settings",
    targetId: "SETTINGS-001",
    timestamp: "2026-09-17 10:42:08",
    ipAddress: "192.168.1.10",
    severity: "Info",
  },
  {
    id: "LOG-009",
    action: "Create",
    category: "Projects",
    description: "New demo project was added to the project bank.",
    performedBy: "Priya Patil",
    email: "priya@recruitai.com",
    target: "Student Management Portal",
    targetId: "PROJ-003",
    timestamp: "2026-09-17 10:15:44",
    ipAddress: "192.168.1.25",
    severity: "Success",
  },
  {
    id: "LOG-010",
    action: "Delete",
    category: "Slots",
    description: "Interview slot was deleted from the schedule.",
    performedBy: "Amit Joshi",
    email: "amit@recruitai.com",
    target: "Interview Slot",
    targetId: "SLOT-004",
    timestamp: "2026-09-17 09:52:31",
    ipAddress: "192.168.1.31",
    severity: "Warning",
  },
  {
    id: "LOG-011",
    action: "Approve",
    category: "Reports",
    description: "AI interview performance report was reviewed.",
    performedBy: "Om Bhondve",
    email: "admin@recruitai.com",
    target: "Akash Kulkarni",
    targetId: "REP-002",
    timestamp: "2026-09-17 09:24:18",
    ipAddress: "192.168.1.10",
    severity: "Success",
  },
  {
    id: "LOG-012",
    action: "Login",
    category: "Authentication",
    description: "Recruiter logged into the dashboard.",
    performedBy: "Priya Patil",
    email: "priya@recruitai.com",
    target: "Admin Dashboard",
    targetId: "ADM-002",
    timestamp: "2026-09-17 09:02:05",
    ipAddress: "192.168.1.25",
    severity: "Success",
  },
  {
    id: "LOG-013",
    action: "Deactivate",
    category: "Slots",
    description: "Interview slot was made unavailable for booking.",
    performedBy: "Priya Patil",
    email: "priya@recruitai.com",
    target: "Interview Slot",
    targetId: "SLOT-006",
    timestamp: "2026-09-16 17:42:11",
    ipAddress: "192.168.1.25",
    severity: "Warning",
  },
  {
    id: "LOG-014",
    action: "Update",
    category: "Projects",
    description: "Demo project configuration was updated.",
    performedBy: "Om Bhondve",
    email: "admin@recruitai.com",
    target: "E-Commerce API",
    targetId: "PROJ-001",
    timestamp: "2026-09-16 16:28:45",
    ipAddress: "192.168.1.10",
    severity: "Info",
  },
  {
    id: "LOG-015",
    action: "Logout",
    category: "Authentication",
    description: "Administrator logged out of the dashboard.",
    performedBy: "Amit Joshi",
    email: "amit@recruitai.com",
    target: "Admin Dashboard",
    targetId: "ADM-003",
    timestamp: "2026-09-16 16:02:19",
    ipAddress: "192.168.1.31",
    severity: "Info",
  },
];

const actions: Array<"All" | AuditAction> = [
  "All",
  "Login",
  "Logout",
  "Create",
  "Update",
  "Delete",
  "Approve",
  "Reject",
  "Activate",
  "Deactivate",
];

const categories: Array<"All" | AuditCategory> = [
  "All",
  "Authentication",
  "Candidates",
  "Interviews",
  "Slots",
  "Projects",
  "Reports",
  "Team",
  "Settings",
];

const severities: Array<"All" | AuditSeverity> = [
  "All",
  "Info",
  "Success",
  "Warning",
  "Critical",
];

export default function AuditLogPage() {
  const [logs, setLogs] =
    useState<AuditLog[]>(initialLogs);

  const [search, setSearch] = useState("");

  const [actionFilter, setActionFilter] = useState<
    "All" | AuditAction
  >("All");

  const [categoryFilter, setCategoryFilter] = useState<
    "All" | AuditCategory
  >("All");

  const [severityFilter, setSeverityFilter] = useState<
    "All" | AuditSeverity
  >("All");

  const [adminFilter, setAdminFilter] =
    useState("All");

  const [viewTarget, setViewTarget] =
    useState<AuditLog | null>(null);

  const [notice, setNotice] = useState("");

  const [refreshing, setRefreshing] =
    useState(false);

  const [showFilters, setShowFilters] =
    useState(false);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesSearch =
        !query ||
        log.id.toLowerCase().includes(query) ||
        log.description.toLowerCase().includes(query) ||
        log.performedBy.toLowerCase().includes(query) ||
        log.email.toLowerCase().includes(query) ||
        log.target.toLowerCase().includes(query) ||
        log.targetId.toLowerCase().includes(query) ||
        log.ipAddress.toLowerCase().includes(query);

      const matchesAction =
        actionFilter === "All" ||
        log.action === actionFilter;

      const matchesCategory =
        categoryFilter === "All" ||
        log.category === categoryFilter;

      const matchesSeverity =
        severityFilter === "All" ||
        log.severity === severityFilter;

      const matchesAdmin =
        adminFilter === "All" ||
        log.performedBy === adminFilter;

      return (
        matchesSearch &&
        matchesAction &&
        matchesCategory &&
        matchesSeverity &&
        matchesAdmin
      );
    });
  }, [
    logs,
    search,
    actionFilter,
    categoryFilter,
    severityFilter,
    adminFilter,
  ]);

  const adminOptions = Array.from(
    new Set(logs.map((log) => log.performedBy))
  );

  const loginCount = logs.filter(
    (log) => log.action === "Login"
  ).length;

  const changesCount = logs.filter((log) =>
    ["Create", "Update", "Delete"].includes(
      log.action
    )
  ).length;

  const warningsCount = logs.filter(
    (log) =>
      log.severity === "Warning" ||
      log.severity === "Critical"
  ).length;

  const approvalCount = logs.filter(
    (log) =>
      log.action === "Approve" ||
      log.action === "Reject"
  ).length;

  const showNotice = (message: string) => {
    setNotice(message);

    window.setTimeout(() => {
      setNotice("");
    }, 2500);
  };

  const refreshLogs = () => {
    setRefreshing(true);

    window.setTimeout(() => {
      setRefreshing(false);
      showNotice("Audit log refreshed.");
    }, 700);
  };

  const resetFilters = () => {
    setSearch("");
    setActionFilter("All");
    setCategoryFilter("All");
    setSeverityFilter("All");
    setAdminFilter("All");
  };

  const exportLogs = () => {
    const headers = [
      "ID",
      "Action",
      "Category",
      "Description",
      "Performed By",
      "Email",
      "Target",
      "Target ID",
      "Timestamp",
      "IP Address",
      "Severity",
    ];

    const rows = filteredLogs.map((log) => [
      log.id,
      log.action,
      log.category,
      log.description,
      log.performedBy,
      log.email,
      log.target,
      log.targetId,
      log.timestamp,
      log.ipAddress,
      log.severity,
    ]);

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) =>
            `"${String(value).replace(
              /"/g,
              '""'
            )}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = `audit-log-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    showNotice(
      `${filteredLogs.length} audit log records exported.`
    );
  };

  const clearDemoLogs = () => {
    setLogs([]);
    showNotice("Demo audit logs cleared.");
  };

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* HEADER */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Activity size={16} />
              Security & Administration
            </div>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Audit Log
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Track administrator actions and important
              system events.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/settings"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-[#151922] dark:text-slate-200 dark:hover:bg-white/5"
            >
              Settings
            </Link>

            <button
              type="button"
              onClick={refreshLogs}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-[#151922] dark:text-slate-200 dark:hover:bg-white/5"
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={exportLogs}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>

        {/* NOTICE */}
        {notice && (
          <div className="fixed bottom-5 right-5 z-[100] flex max-w-sm items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-2xl dark:border-white/10 dark:bg-[#151922] dark:text-slate-200">
            <CheckCircle2
              size={18}
              className="shrink-0 text-emerald-500"
            />
            {notice}
          </div>
        )}

        {/* SECURITY INFO */}
        <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 dark:border-indigo-500/20 dark:bg-indigo-500/5 sm:p-6">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-[#151922] dark:text-indigo-400">
              <Shield size={20} />
            </div>

            <div>
              <h2 className="font-semibold text-indigo-900 dark:text-indigo-300">
                Activity monitoring
              </h2>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-indigo-700 dark:text-indigo-400">
                The audit log provides a record of important
                administrator actions including authentication,
                candidate decisions, scheduling, team changes
                and system configuration updates.
              </p>
            </div>
          </div>
        </section>

        {/* STATISTICS */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={<Activity size={19} />}
            label="Total Events"
            value={logs.length}
          />

          <StatCard
            icon={<LogIn size={19} />}
            label="Login Events"
            value={loginCount}
          />

          <StatCard
            icon={<Pencil size={19} />}
            label="System Changes"
            value={changesCount}
          />

          <StatCard
            icon={<AlertTriangle size={19} />}
            label="Warnings"
            value={warningsCount}
          />
        </div>

        {/* FILTER SECTION */}
        <section className="surface rounded-2xl border shadow-sm">
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">
                  Activity History
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {filteredLogs.length} event
                  {filteredLogs.length !== 1
                    ? "s"
                    : ""}{" "}
                  shown
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowFilters((value) => !value)
                }
                className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                <Filter size={16} />
                Filters
                <ChevronDown
                  size={14}
                  className={
                    showFilters
                      ? "rotate-180 transition"
                      : "transition"
                  }
                />
              </button>
            </div>

            {/* SEARCH */}
            <div className="relative mt-5">
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
                placeholder="Search by action, admin, target, description, IP address..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-[#10141d] dark:text-white"
              />
            </div>

            {/* FILTERS */}
            {showFilters && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FilterSelect
                  label="Action"
                  value={actionFilter}
                  options={actions}
                  onChange={(value) =>
                    setActionFilter(
                      value as "All" | AuditAction
                    )
                  }
                />

                <FilterSelect
                  label="Category"
                  value={categoryFilter}
                  options={categories}
                  onChange={(value) =>
                    setCategoryFilter(
                      value as
                        | "All"
                        | AuditCategory
                    )
                  }
                />

                <FilterSelect
                  label="Severity"
                  value={severityFilter}
                  options={severities}
                  onChange={(value) =>
                    setSeverityFilter(
                      value as
                        | "All"
                        | AuditSeverity
                    )
                  }
                />

                <FilterSelect
                  label="Administrator"
                  value={adminFilter}
                  options={[
                    "All",
                    ...adminOptions,
                  ]}
                  onChange={setAdminFilter}
                />
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {hasActiveFilters(
                search,
                actionFilter,
                categoryFilter,
                severityFilter,
                adminFilter
              ) && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  <X size={13} />
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-white/[0.02]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Event
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Administrator
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Target
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Time
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Severity
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Details
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredLogs.map((log) => (
                  <AuditTableRow
                    key={log.id}
                    log={log}
                    onView={() =>
                      setViewTarget(log)
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE */}
          <div className="space-y-3 p-4 md:hidden">
            {filteredLogs.map((log) => (
              <AuditMobileCard
                key={log.id}
                log={log}
                onView={() =>
                  setViewTarget(log)
                }
              />
            ))}
          </div>

          {/* EMPTY STATE */}
          {filteredLogs.length === 0 && (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">
                <Activity size={22} />
              </div>

              <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">
                No audit events found
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

        {/* ACTION INFORMATION */}
        <section className="surface rounded-2xl border p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            <Shield
              size={18}
              className="text-indigo-600 dark:text-indigo-400"
            />

            <h2 className="font-semibold text-slate-900 dark:text-white">
              Audited Operations
            </h2>
          </div>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Important operations that should be recorded by
            the production backend.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <OperationCard
              icon={<LogIn size={17} />}
              label="Authentication"
            />

            <OperationCard
              icon={<Users size={17} />}
              label="Candidate Decisions"
            />

            <OperationCard
              icon={<CalendarDays size={17} />}
              label="Interview Scheduling"
            />

            <OperationCard
              icon={<UserPlus size={17} />}
              label="Admin Management"
            />

            <OperationCard
              icon={<FileText size={17} />}
              label="Project Changes"
            />

            <OperationCard
              icon={<Activity size={17} />}
              label="Interview Reports"
            />

            <OperationCard
              icon={<Settings size={17} />}
              label="System Settings"
            />

            <OperationCard
              icon={<Trash2 size={17} />}
              label="Deletion Events"
            />
          </div>
        </section>

        {/* DEMO DATA CONTROL */}
        <section className="rounded-2xl border border-amber-100 bg-amber-50 p-5 dark:border-amber-500/20 dark:bg-amber-500/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-amber-900 dark:text-amber-300">
                Frontend demo data
              </h2>

              <p className="mt-1 text-xs leading-5 text-amber-700 dark:text-amber-400">
                These audit events are currently stored in
                frontend state. A production implementation
                should store immutable audit records in the
                backend database.
              </p>
            </div>

            <button
              type="button"
              onClick={clearDemoLogs}
              disabled={logs.length === 0}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-500/20 dark:bg-transparent dark:text-amber-400 dark:hover:bg-amber-500/10"
            >
              <Trash2 size={15} />
              Clear Demo Logs
            </button>
          </div>
        </section>
      </div>

      {/* DETAILS MODAL */}
      {viewTarget && (
        <AuditDetailsModal
          log={viewTarget}
          onClose={() => setViewTarget(null)}
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
   FILTER SELECT
========================================================= */

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-[#10141d] dark:text-white"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

/* =========================================================
   TABLE ROW
========================================================= */

function AuditTableRow({
  log,
  onView,
}: {
  log: AuditLog;
  onView: () => void;
}) {
  return (
    <tr className="border-b border-slate-100 transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/[0.02]">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <ActionIcon action={log.action} />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ActionBadge action={log.action} />
              <span className="text-[11px] text-slate-400">
                {log.id}
              </span>
            </div>

            <p className="mt-1 max-w-md truncate text-xs text-slate-500 dark:text-slate-400">
              {log.description}
            </p>

            <p className="mt-1 text-[11px] text-slate-400">
              {log.category}
            </p>
          </div>
        </div>
      </td>

      <td className="px-5 py-4">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-white">
            {log.performedBy}
          </p>

          <p className="mt-0.5 text-xs text-slate-400">
            {log.email}
          </p>
        </div>
      </td>

      <td className="px-5 py-4">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {log.target}
        </p>

        <p className="mt-0.5 text-xs text-slate-400">
          {log.targetId}
        </p>
      </td>

      <td className="px-5 py-4">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Clock3 size={13} />
          {log.timestamp}
        </div>

        <p className="mt-1 text-[11px] text-slate-400">
          IP: {log.ipAddress}
        </p>
      </td>

      <td className="px-5 py-4">
        <SeverityBadge severity={log.severity} />
      </td>

      <td className="px-5 py-4 text-right">
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
        >
          <Eye size={14} />
          Details
        </button>
      </td>
    </tr>
  );
}

/* =========================================================
   MOBILE CARD
========================================================= */

function AuditMobileCard({
  log,
  onView,
}: {
  log: AuditLog;
  onView: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
      <div className="flex items-start gap-3">
        <ActionIcon action={log.action} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ActionBadge action={log.action} />
            <SeverityBadge severity={log.severity} />
          </div>

          <p className="mt-2 text-sm font-medium text-slate-800 dark:text-white">
            {log.description}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            {log.id} · {log.category}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 dark:border-white/5">
        <MobileDetail
          label="Administrator"
          value={log.performedBy}
        />

        <MobileDetail
          label="Target"
          value={log.target}
        />

        <MobileDetail
          label="Time"
          value={log.timestamp}
        />

        <MobileDetail
          label="IP Address"
          value={log.ipAddress}
        />
      </div>

      <button
        type="button"
        onClick={onView}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 dark:border-white/10 dark:text-slate-300"
      >
        <Eye size={14} />
        View Full Details
      </button>
    </div>
  );
}

/* =========================================================
   ACTION ICON
========================================================= */

function ActionIcon({
  action,
}: {
  action: AuditAction;
}) {
  const icon = getActionIcon(action);

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300">
      {icon}
    </div>
  );
}

/* =========================================================
   ACTION BADGE
========================================================= */

function ActionBadge({
  action,
}: {
  action: AuditAction;
}) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-white/5 dark:text-slate-300">
      {action}
    </span>
  );
}

/* =========================================================
   SEVERITY BADGE
========================================================= */

function SeverityBadge({
  severity,
}: {
  severity: AuditSeverity;
}) {
  const styles: Record<AuditSeverity, string> = {
    Info:
      "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400",
    Success:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    Warning:
      "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    Critical:
      "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${styles[severity]}`}
    >
      {severity}
    </span>
  );
}

/* =========================================================
   OPERATION CARD
========================================================= */

function OperationCard({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs font-medium text-slate-600 dark:border-white/10 dark:text-slate-300">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
        {icon}
      </div>

      {label}
    </div>
  );
}

/* =========================================================
   MOBILE DETAIL
========================================================= */

function MobileDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   DETAILS MODAL
========================================================= */

function AuditDetailsModal({
  log,
  onClose,
}: {
  log: AuditLog;
  onClose: () => void;
}) {
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#151922]">
        <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-white/10">
          <div className="flex items-center gap-3">
            <ActionIcon action={log.action} />

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-900 dark:text-white">
                  Audit Event
                </h2>

                <ActionBadge action={log.action} />
              </div>

              <p className="mt-1 text-xs text-slate-400">
                {log.id}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.02]">
            <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
              {log.description}
            </p>
          </div>

          <div className="mt-5 space-y-3">
            <DetailRow
              icon={<User size={15} />}
              label="Performed By"
              value={log.performedBy}
            />

            <DetailRow
              icon={<MailIcon />}
              label="Email"
              value={log.email}
            />

            <DetailRow
              icon={<Activity size={15} />}
              label="Category"
              value={log.category}
            />

            <DetailRow
              icon={<FileText size={15} />}
              label="Target"
              value={log.target}
            />

            <DetailRow
              icon={<Shield size={15} />}
              label="Target ID"
              value={log.targetId}
            />

            <DetailRow
              icon={<Clock3 size={15} />}
              label="Timestamp"
              value={log.timestamp}
            />

            <DetailRow
              icon={<Activity size={15} />}
              label="IP Address"
              value={log.ipAddress}
            />

            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-3 dark:border-white/5">
              <span className="text-xs text-slate-500">
                Severity
              </span>

              <SeverityBadge severity={log.severity} />
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 p-5 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-white/10 dark:text-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

/* =========================================================
   DETAIL ROW
========================================================= */

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-3 dark:border-white/5">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {icon}
        {label}
      </div>

      <span className="max-w-[60%] break-words text-right text-sm font-medium text-slate-800 dark:text-slate-200">
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
   MAIL ICON
========================================================= */

function MailIcon() {
  return (
    <span className="text-[13px] font-bold">@</span>
  );
}

/* =========================================================
   HELPERS
========================================================= */

function getActionIcon(action: AuditAction) {
  switch (action) {
    case "Login":
      return <LogIn size={17} />;

    case "Logout":
      return <LogOut size={17} />;

    case "Create":
      return <PlusIcon />;

    case "Update":
      return <Pencil size={17} />;

    case "Delete":
      return <Trash2 size={17} />;

    case "Approve":
      return <CheckCircle2 size={17} />;

    case "Reject":
      return <XCircle size={17} />;

    case "Activate":
      return <CheckCircle2 size={17} />;

    case "Deactivate":
      return <Ban size={17} />;

    default:
      return <Activity size={17} />;
  }
}

function PlusIcon() {
  return <span className="text-lg leading-none">+</span>;
}

function hasActiveFilters(
  search: string,
  action: string,
  category: string,
  severity: string,
  admin: string
) {
  return (
    search.trim() !== "" ||
    action !== "All" ||
    category !== "All" ||
    severity !== "All" ||
    admin !== "All"
  );
}