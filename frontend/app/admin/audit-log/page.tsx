"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Calendar,
  User,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  Activity,
  X,
} from "lucide-react";
import { apiUrl } from "@/lib/client";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";

interface AuditLogEntry {
  _id: string;
  id?: string;
  actor: string;
  actorId?: string;
  actorName: string;
  actorEmail?: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId?: string;
  targetName?: string;
  description: string;
  outcome: "SUCCESS" | "FAILURE" | "ATTEMPT" | string;
  details?: unknown;
  beforeState?: unknown;
  afterState?: unknown;
  ipAddress?: string;
  timestamp: string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [targetFilter, setTargetFilter] = useState("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState("ALL");

  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search) params.set("search", search);
      if (actionFilter && actionFilter !== "ALL") params.set("action", actionFilter);
      if (targetFilter && targetFilter !== "ALL") params.set("targetType", targetFilter);
      if (outcomeFilter && outcomeFilter !== "ALL") params.set("outcome", outcomeFilter);

      const res = await fetch(apiUrl(`/api/admin/audit-logs?${params.toString()}`), {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to load audit logs");
      const json = await res.json();
      if (json.success) {
        setLogs(json.logs || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 1);
      } else {
        throw new Error("Invalid audit logs response");
      }
    } catch (err) {
      console.error("Audit log fetch error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, actionFilter, targetFilter, outcomeFilter]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleResetFilters = () => {
    setSearch("");
    setSearchInput("");
    setActionFilter("ALL");
    setTargetFilter("ALL");
    setOutcomeFilter("ALL");
    setPage(1);
  };

  const exportCSV = () => {
    if (!logs.length) return;
    const headers = ["Timestamp", "Action", "Actor Name", "Actor Role", "Target Type", "Target ID", "Description", "Outcome", "IP Address"];
    const rows = logs.map((l) => [
      `"${new Date(l.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}"`,
      `"${l.action}"`,
      `"${l.actorName || l.actor}"`,
      `"${l.actorRole || "admin"}"`,
      `"${l.targetType || "System"}"`,
      `"${l.targetId || ""}"`,
      `"${(l.description || "").replace(/"/g, '""')}"`,
      `"${l.outcome || "SUCCESS"}"`,
      `"${l.ipAddress || ""}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `recruitai_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Tab Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1976D2]">
            <Activity className="h-4 w-4" />
            Security & Compliance
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#111F33]">
            System Audit Logs
          </h1>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Immutable chronological audit trail recording administrator activities, authorizations, and recruitment lifecycle changes.
          </p>
        </div>

        {/* Tab switch to Analytics */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[#E2E8F0] bg-white p-1 shadow-xs">
            <Link
              href="/admin/analytics"
              className="rounded-md px-3 py-1.5 text-xs font-medium text-[#64748B] hover:text-[#111F33] transition-colors"
            >
              Analytics
            </Link>
            <button
              type="button"
              className="rounded-md bg-[#111F33] px-3 py-1.5 text-xs font-semibold text-white shadow-xs"
            >
              Audit Logs
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={!logs.length}
            className="text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Filters & Search Bar */}
      <Card className="border-[#E2E8F0] shadow-xs">
        <CardContent className="p-4 space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#64748B]" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search audit events by description, actor, target ID..."
                className="w-full rounded-md border border-[#E2E8F0] bg-white pl-9 pr-3 py-2 text-xs text-[#111F33] placeholder-[#64748B] outline-none focus:border-[#1976D2] transition-colors"
              />
            </div>

            <Button type="submit" size="sm" className="text-xs">
              Search
            </Button>

            {(search || actionFilter !== "ALL" || targetFilter !== "ALL" || outcomeFilter !== "ALL") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs text-[#64748B]"
              >
                Clear Filters
              </Button>
            )}
          </form>

          <div className="flex flex-wrap items-center gap-3 border-t border-[#E2E8F0] pt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-[#64748B]">Action:</span>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs text-[#111F33] outline-none focus:border-[#1976D2]"
              >
                <option value="ALL">All Actions</option>
                <option value="ADMIN_LOGIN">Admin Login</option>
                <option value="ADMIN_LOGOUT">Admin Logout</option>
                <option value="CANDIDATE_APPROVE">Candidate Approval</option>
                <option value="CANDIDATE_REJECT">Candidate Rejection</option>
                <option value="PROJECT_ASSIGN">Project Assigned</option>
                <option value="SUBMIT_ADMIN_DECISION">Recruitment Decision</option>
                <option value="ADMIN_PROFILE_UPDATE">Profile Update</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-[#64748B]">Entity:</span>
              <select
                value={targetFilter}
                onChange={(e) => {
                  setTargetFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs text-[#111F33] outline-none focus:border-[#1976D2]"
              >
                <option value="ALL">All Entities</option>
                <option value="Candidate">Candidate</option>
                <option value="Interview">Interview</option>
                <option value="Project">Project</option>
                <option value="Admin">Admin</option>
                <option value="Authentication">Auth</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-[#64748B]">Outcome:</span>
              <select
                value={outcomeFilter}
                onChange={(e) => {
                  setOutcomeFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs text-[#111F33] outline-none focus:border-[#1976D2]"
              >
                <option value="ALL">All Outcomes</option>
                <option value="SUCCESS">Success Only</option>
                <option value="FAILURE">Failure Only</option>
              </select>
            </div>

            <div className="ml-auto text-[11px] text-[#64748B]">
              Showing {logs.length} of {total} events recorded
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Audit Log Records Table */}
      {loading && !logs.length ? (
        <Card>
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        </Card>
      ) : error ? (
        <ErrorState
          title="Audit Log Service Unavailable"
          description="Could not retrieve administrative audit trail. Please verify database connectivity."
          onRetry={fetchLogs}
        />
      ) : !logs.length ? (
        <Card className="p-12 text-center border-[#E2E8F0]">
          <ShieldCheck className="mx-auto h-10 w-10 text-[#64748B]" />
          <h3 className="mt-3 text-sm font-semibold text-[#111F33]">No Audit Events Found</h3>
          <p className="mt-1 text-xs text-[#64748B]">
            No administrative events matched the specified filter criteria.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={handleResetFilters}
            className="mt-4 text-xs"
          >
            Reset Filters
          </Button>
        </Card>
      ) : (
        <Card className="border-[#E2E8F0] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b border-[#E2E8F0] bg-[#F5F7FA] text-[#64748B]">
                <tr>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">Timestamp (IST)</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">Actor</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">Action</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">Target Entity</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">Description</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px] text-center">Outcome</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px] text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-[#111F33]">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-[#F8FAFC] transition-colors">
                    {/* Timestamp */}
                    <td className="py-3 px-4 font-mono text-[11px] text-[#64748B] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>

                    {/* Actor */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[#111F33]">
                          {log.actorName || "Admin"}
                        </span>
                        <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] font-medium text-[#64748B] uppercase">
                          {log.actorRole || "admin"}
                        </span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="rounded-md border border-[#E2E8F0] bg-[#F5F7FA] px-2 py-0.5 text-[11px] font-mono text-[#111F33]">
                        {log.action}
                      </span>
                    </td>

                    {/* Target Entity */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#1976D2]">
                          {log.targetType || "System"}
                        </span>
                        <span className="text-[#64748B] text-[11px] font-mono truncate max-w-[120px]">
                          {log.targetName || log.targetId || "—"}
                        </span>
                      </div>
                    </td>

                    {/* Description */}
                    <td className="py-3 px-4 text-[#111F33] max-w-xs truncate">
                      {log.description || "—"}
                    </td>

                    {/* Outcome */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {log.outcome === "SUCCESS" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#16A34A]/10 px-2 py-0.5 text-[10px] font-semibold text-[#16A34A]">
                          <CheckCircle2 className="h-3 w-3" /> OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#DC2626]/10 px-2 py-0.5 text-[10px] font-semibold text-[#DC2626]">
                          <XCircle className="h-3 w-3" /> FAILED
                        </span>
                      )}
                    </td>

                    {/* View Details button */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="rounded p-1 text-[#1976D2] hover:bg-blue-50 transition-colors inline-flex items-center gap-1 text-[11px] font-medium"
                      >
                        <Eye className="h-3.5 w-3.5" /> Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 py-3 bg-white text-xs">
            <span className="text-[#64748B]">
              Page <span className="font-semibold text-[#111F33]">{page}</span> of{" "}
              <span className="font-semibold text-[#111F33]">{totalPages}</span>
            </span>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="text-xs gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="text-xs gap-1"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 4. Event Inspection Modal */}
      {selectedLog && (
        <Modal
          open={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title="Audit Event Inspection"
          description={`Unique Event Record: ${selectedLog._id}`}
          footer={
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-[#E2E8F0] bg-[#F5F7FA] p-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#64748B]">Action Type</span>
                <p className="font-mono font-semibold text-[#111F33]">{selectedLog.action}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#64748B]">Outcome</span>
                <p className={`font-semibold ${selectedLog.outcome === "SUCCESS" ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                  {selectedLog.outcome}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#64748B]">Actor Identity</span>
                <p className="text-[#111F33] font-medium">
                  {selectedLog.actorName} ({selectedLog.actorRole})
                </p>
                {selectedLog.actorEmail && (
                  <p className="text-[#64748B] text-[11px]">{selectedLog.actorEmail}</p>
                )}
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#64748B]">Timestamp</span>
                <p className="text-[#111F33]">
                  {new Date(selectedLog.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#64748B]">Target Entity</span>
                <p className="text-[#111F33]">
                  {selectedLog.targetType}: {selectedLog.targetName || selectedLog.targetId || "—"}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#64748B]">Client IP</span>
                <p className="font-mono text-[#64748B]">{selectedLog.ipAddress || "Internal Server / Loopback"}</p>
              </div>
            </div>

            <div>
              <span className="font-semibold text-[#111F33]">Event Description:</span>
              <p className="mt-1 rounded-md border border-[#E2E8F0] bg-white p-2.5 text-[#111F33]">
                {selectedLog.description}
              </p>
            </div>

            {Boolean(selectedLog.details) && (
              <div>
                <span className="font-semibold text-[#111F33]">Safe Metadata & Context:</span>
                <pre className="mt-1 max-h-48 overflow-y-auto rounded-md border border-[#E2E8F0] bg-[#111F33] p-3 text-[11px] font-mono text-emerald-400">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
