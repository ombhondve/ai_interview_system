"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Search,
  CheckCircle2,
  Clock3,
  AlertCircle,
  RefreshCw,
  Video,
  Users,
  FolderKanban,
  Shield,
  Trash2,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  NotificationItem,
} from "@/services/notification.api";

function formatTimeAgo(dateString?: string | null) {
  if (!dateString) return "Recently";
  const date = new Date(dateString);
  const now = new Date();
  const diffInSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSec < 60) return "Just now";
  const diffInMin = Math.floor(diffInSec / 60);
  if (diffInMin < 60) return `${diffInMin}m ago`;
  const diffInHours = Math.floor(diffInMin / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getNotificationIcon(type?: string, entityType?: string | null) {
  if (entityType === "interview" || type?.startsWith("interview_") || type?.startsWith("evaluation_")) {
    return <Video className="h-4 w-4 text-[#1976D2]" />;
  }
  if (entityType === "candidate" || type?.startsWith("candidate_")) {
    return <Users className="h-4 w-4 text-emerald-600" />;
  }
  if (entityType === "project" || type?.startsWith("project_") || type?.startsWith("verification_")) {
    return <FolderKanban className="h-4 w-4 text-amber-600" />;
  }
  if (entityType === "team" || type?.startsWith("team_")) {
    return <Shield className="h-4 w-4 text-purple-600" />;
  }
  return <Bell className="h-4 w-4 text-slate-500" />;
}

function getNotificationTypeBadge(type?: string) {
  if (type?.includes("interview") || type?.includes("evaluation")) return "Interview";
  if (type?.includes("candidate")) return "Candidate";
  if (type?.includes("project") || type?.includes("verification")) return "Project";
  if (type?.includes("team")) return "Team & Security";
  return "System";
}

export default function NotificationsPage() {
  const router = useRouter();

  // State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "read">("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Actions state
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<NotificationItem | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const readParam = statusFilter === "unread" ? false : statusFilter === "read" ? true : undefined;
      const data = await fetchNotifications({
        read: readParam,
        type: typeFilter === "all" ? undefined : typeFilter,
        search: search.trim() || undefined,
        page,
        limit: 15,
      });

      setNotifications(data.notifications || []);
      setTotal(data.total || 0);
      setUnreadCount(data.unreadCount || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      setError(err?.message || "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, search, page]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item._id === id ? { ...item, read: true, readAt: new Date().toISOString() } : item))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err: any) {
      alert(err?.message || "Failed to mark as read.");
    }
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAllRead(true);
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err: any) {
      alert(err?.message || "Failed to mark all as read.");
    } finally {
      setMarkingAllRead(false);
    }
  };

  const confirmDelete = (notif: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotificationToDelete(notif);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!notificationToDelete) return;
    setDeletingId(notificationToDelete._id);
    try {
      await deleteNotification(notificationToDelete._id);
      setNotifications((prev) => prev.filter((item) => item._id !== notificationToDelete._id));
      setTotal((t) => Math.max(0, t - 1));
      if (!notificationToDelete.read) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      setDeleteModalOpen(false);
      setNotificationToDelete(null);
    } catch (err: any) {
      alert(err?.message || "Failed to delete notification.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.read) {
      await handleMarkAsRead(notif._id);
    }
    // Only navigate to trusted internal admin routes
    if (notif.actionUrl && notif.actionUrl.startsWith("/admin")) {
      router.push(notif.actionUrl);
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F7FA] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#64748B]">
              <Bell className="h-3.5 w-3.5" />
              <span>System & Workspace Alerts</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#111F33]">
              Notifications Center
            </h1>
            <p className="mt-1 text-xs text-[#64748B]">
              Real-time events, interview decisions, project submissions, and security audits.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0 || markingAllRead}
              loading={markingAllRead}
              className="border-[#E2E8F0] text-xs font-semibold text-[#111F33] hover:bg-white"
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5 text-[#1976D2]" />
              Mark all as read
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={loading}
              className="border-[#E2E8F0] text-xs hover:bg-white"
              aria-label="Refresh notifications"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-[#64748B]", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#64748B]">Total Notifications</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#1976D2]">
                <Bell className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-[#111F33]">{total}</p>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#64748B]">Unread Items</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Clock3 className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-[#111F33]">{unreadCount}</p>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#64748B]">Read Items</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-[#111F33]">{Math.max(0, total - unreadCount)}</p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === "all"
                  ? "bg-[#111F33] text-white shadow-xs"
                  : "text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#111F33]"
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("unread");
                setPage(1);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === "unread"
                  ? "bg-[#1976D2] text-white shadow-xs"
                  : "text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#111F33]"
              )}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                  statusFilter === "unread" ? "bg-white/20 text-white" : "bg-blue-100 text-[#1976D2]"
                )}>
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("read");
                setPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === "read"
                  ? "bg-[#111F33] text-white shadow-xs"
                  : "text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#111F33]"
              )}
            >
              Read
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Category Filter */}
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="h-8.5 rounded-md border border-[#E2E8F0] bg-[#F5F7FA] px-2.5 text-xs text-[#111F33] focus:border-[#1976D2] focus:bg-white focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="interview_scheduled">Interview Scheduled</option>
              <option value="interview_completed">Interview Completed</option>
              <option value="evaluation_completed">Evaluation Decision</option>
              <option value="candidate_status_updated">Candidate Update</option>
              <option value="project_assigned">Project Assigned</option>
              <option value="project_verified">Project Verified</option>
              <option value="verification_review_required">Review Required</option>
              <option value="team_member_added">Team & Security</option>
            </select>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search alerts..."
                className="h-8.5 w-full rounded-md border border-[#E2E8F0] bg-[#F5F7FA] pl-8 pr-3 text-xs text-[#111F33] placeholder:text-slate-400 focus:border-[#1976D2] focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Notifications List Card */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
          {/* Loading Skeletons */}
          {loading && (
            <div className="divide-y divide-[#E2E8F0] p-4 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start gap-4 pt-3 first:pt-0 animate-pulse">
                  <div className="h-9 w-9 rounded-lg bg-slate-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded bg-slate-200" />
                    <div className="h-3 w-3/4 rounded bg-slate-100" />
                  </div>
                  <div className="h-4 w-16 rounded bg-slate-100 shrink-0" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
              <h3 className="text-sm font-semibold text-[#111F33]">Failed to load notifications</h3>
              <p className="mt-1 text-xs text-[#64748B] max-w-sm">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadData()}
                className="mt-4 text-xs"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center p-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <Bell className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-[#111F33]">No notifications found</h3>
              <p className="mt-1 text-xs text-[#64748B] max-w-xs">
                {search || typeFilter !== "all" || statusFilter !== "all"
                  ? "Try adjusting your filters or search terms to find what you're looking for."
                  : "You're all caught up! New events and updates will appear here."}
              </p>
              {(search || typeFilter !== "all" || statusFilter !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
                    setStatusFilter("all");
                    setPage(1);
                  }}
                  className="mt-4 text-xs"
                >
                  Clear all filters
                </Button>
              )}
            </div>
          )}

          {/* Notification Items */}
          {!loading && !error && notifications.length > 0 && (
            <div className="divide-y divide-[#E2E8F0]">
              {notifications.map((notif) => {
                const isUnread = !notif.read;
                return (
                  <div
                    key={notif._id}
                    onClick={() => handleItemClick(notif)}
                    className={cn(
                      "group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 transition-colors cursor-pointer",
                      isUnread
                        ? "bg-blue-50/40 hover:bg-blue-50/80"
                        : "hover:bg-[#F5F7FA]"
                    )}
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      {/* Unread indicator / Icon */}
                      <div className="relative mt-0.5 shrink-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white shadow-2xs">
                          {getNotificationIcon(notif.type, notif.entityType)}
                        </div>
                        {isUnread && (
                          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[#1976D2] ring-2 ring-white" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className={cn("text-xs tracking-tight", isUnread ? "font-bold text-[#111F33]" : "font-medium text-slate-800")}>
                            {notif.title}
                          </h4>
                          <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-[#64748B]">
                            {getNotificationTypeBadge(notif.type)}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-[#64748B] line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>

                        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                          <span>{formatTimeAgo(notif.createdAt)}</span>
                          {notif.actionUrl && (
                            <span className="flex items-center gap-1 text-[#1976D2] font-medium group-hover:underline">
                              <span>View details</span>
                              <ExternalLink className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 sm:self-center shrink-0" onClick={(e) => e.stopPropagation()}>
                      {isUnread && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkAsRead(notif._id, e)}
                          title="Mark as read"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-[#64748B] transition-colors hover:bg-blue-50 hover:text-[#1976D2]"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => confirmDelete(notif, e)}
                        title="Delete notification"
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-[#64748B] transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {!loading && !error && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#E2E8F0] bg-white px-4 py-3 sm:px-6">
              <span className="text-xs text-[#64748B]">
                Page <span className="font-semibold text-[#111F33]">{page}</span> of{" "}
                <span className="font-semibold text-[#111F33]">{totalPages}</span>
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-8 px-2.5 text-xs"
                >
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                  Previous
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-8 px-2.5 text-xs"
                >
                  Next
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Notification"
        description="Are you sure you want to remove this notification? This action cannot be undone."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
              disabled={Boolean(deletingId)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              loading={Boolean(deletingId)}
            >
              Delete
            </Button>
          </div>
        }
      />
    </main>
  );
}
