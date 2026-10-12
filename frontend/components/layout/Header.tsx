"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Menu,
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { subscribeAdminSync } from "@/lib/adminDataSync";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
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
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface AdminProfile {
  id?: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  phone?: string;
}

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<NotificationItem[]>([]);
  const [adminUser, setAdminUser] = useState<AdminProfile | null>(null);

  const loadNotificationData = useCallback(async () => {
    try {
      const [count, data] = await Promise.all([
        fetchUnreadCount(),
        fetchNotifications({ limit: 5 }),
      ]);
      setUnreadCount(count);
      setRecentNotifications(data.notifications || []);
    } catch {
      // Ignore transient errors
    }
  }, []);

  const loadAdminProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          setAdminUser(data.user);
        }
      }
    } catch {
      // Ignore transient errors
    }
  }, []);

  useEffect(() => {
    void loadNotificationData();
    void loadAdminProfile();

    const interval = setInterval(() => {
      void loadNotificationData();
    }, 30000);

    const unsubscribeProfile = subscribeAdminSync("admin:profile:updated", (data) => {
      if (data && typeof data === "object") {
        setAdminUser((prev) => ({ ...(prev || { name: "", email: "", role: "superadmin" }), ...(data as Partial<AdminProfile>) }));
      } else {
        void loadAdminProfile();
      }
    });

    const unsubscribeNotifs = subscribeAdminSync("notifications:updated", () => {
      void loadNotificationData();
    });

    return () => {
      clearInterval(interval);
      unsubscribeProfile();
      unsubscribeNotifs();
    };
  }, [loadNotificationData, loadAdminProfile]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      router.replace("/login");
    }
  };

  // Compute clean breadcrumb label based on active route
  const getBreadcrumb = () => {
    if (pathname === "/admin") return "Overview";
    const segments = pathname.replace("/admin/", "").split("/");
    return segments[0].charAt(0).toUpperCase() + segments[0].slice(1).replace("-", " ");
  };

  const getInitials = (name?: string) => {
    if (!name) return "A";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const displayName = adminUser?.name || "System Administrator";
  const displayRole =
    adminUser?.role === "superadmin"
      ? "Super Admin"
      : adminUser?.role === "recruiter"
      ? "Recruiter"
      : "Admin";
  const displayEmail = adminUser?.email || "admin@recruitai.com";

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 sm:px-6 z-10 select-none">
        {/* Left: Mobile Toggle & Page Breadcrumb Context */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="rounded-md p-1.5 text-slate-500 hover:bg-[#F5F7FA] hover:text-[#111F33] lg:hidden"
            aria-label="Open mobile menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb Context */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="font-medium text-[#64748B]">RecruitAI</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-[#111F33]">{getBreadcrumb()}</span>
          </div>
        </div>

        {/* Right: Notifications, Profile Menu */}
        <div className="flex items-center gap-3">
          {/* Notifications Dropdown */}
          <Dropdown
            trigger={
              <button
                type="button"
                className="relative rounded-md p-2 text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#111F33] transition-colors"
                aria-label="View notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1976D2] px-1 text-[10px] font-bold text-white shadow-xs">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            }
          >
            <div className="w-80 p-2">
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#E2E8F0] pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-[#111F33]">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-[#1976D2]">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await markAllNotificationsAsRead();
                        setUnreadCount(0);
                        setRecentNotifications((prev) =>
                          prev.map((n) => ({ ...n, read: true }))
                        );
                      } catch {}
                    }}
                    className="text-[11px] font-medium text-[#1976D2] hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto py-1 space-y-1 text-xs">
                {recentNotifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#64748B]">
                    No notifications yet
                  </div>
                ) : (
                  recentNotifications.map((notif) => (
                    <div
                      key={notif._id}
                      onClick={async () => {
                        if (!notif.read) {
                          try {
                            await markNotificationAsRead(notif._id);
                            setUnreadCount((c) => Math.max(0, c - 1));
                            setRecentNotifications((prev) =>
                              prev.map((n) =>
                                n._id === notif._id ? { ...n, read: true } : n
                              )
                            );
                          } catch {}
                        }
                        if (notif.actionUrl && notif.actionUrl.startsWith("/admin")) {
                          router.push(notif.actionUrl);
                        } else {
                          router.push("/admin/notifications");
                        }
                      }}
                      className={cn(
                        "group relative flex cursor-pointer items-start gap-2.5 rounded-md p-2 transition-colors",
                        notif.read
                          ? "hover:bg-[#F5F7FA]"
                          : "bg-blue-50/50 hover:bg-blue-50"
                      )}
                    >
                      <div className="mt-0.5 shrink-0">
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full",
                            notif.read ? "bg-transparent" : "bg-[#1976D2]"
                          )}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-xs",
                            notif.read
                              ? "font-normal text-[#111F33]"
                              : "font-semibold text-[#111F33]"
                          )}
                        >
                          {notif.title}
                        </p>
                        <p className="line-clamp-2 text-[11px] text-[#64748B]">
                          {notif.message}
                        </p>
                        <span className="mt-1 block text-[10px] text-slate-400">
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <DropdownSeparator />
              <Link
                href="/admin/notifications"
                className="block text-center text-xs font-medium text-[#1976D2] pt-1.5 hover:underline"
              >
                View all notifications →
              </Link>
            </div>
          </Dropdown>

          {/* Admin Profile Dropdown */}
          <Dropdown
            trigger={
              <button
                type="button"
                className="flex items-center gap-2 rounded-md p-1.5 hover:bg-[#F5F7FA] transition-colors text-left"
                aria-label="Administrator profile menu"
              >
                {adminUser?.avatar ? (
                  <img
                    src={adminUser.avatar}
                    alt={displayName}
                    className="h-7 w-7 rounded-full object-cover border border-[#E2E8F0]"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111F33] text-white text-xs font-semibold">
                    {getInitials(displayName)}
                  </div>
                )}
                <div className="hidden sm:block leading-tight">
                  <p className="text-xs font-semibold text-[#111F33]">{displayName}</p>
                  <p className="text-[10px] text-[#64748B]">{displayRole}</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-[#64748B] hidden sm:block" />
              </button>
            }
          >
            <div className="w-52 py-1">
              <div className="px-3 py-2 border-b border-[#E2E8F0] mb-1">
                <p className="text-xs font-semibold text-[#111F33] truncate">{displayName}</p>
                <p className="text-[11px] text-[#64748B] truncate">{displayEmail}</p>
                <span className="inline-block mt-1 rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-[#1976D2] uppercase tracking-wide">
                  {displayRole}
                </span>
              </div>
              <DropdownItem onClick={() => router.push("/admin/settings")}>
                <Settings className="h-3.5 w-3.5 mr-2 text-[#64748B]" />
                System Settings
              </DropdownItem>
              <DropdownItem onClick={() => router.push("/admin/analytics")}>
                <ShieldCheck className="h-3.5 w-3.5 mr-2 text-[#64748B]" />
                Analytics & Logs
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem danger onClick={() => setLogoutOpen(true)}>
                <LogOut className="h-3.5 w-3.5 mr-2" />
                Sign Out
              </DropdownItem>
            </div>
          </Dropdown>
        </div>
      </header>

      {/* Logout Confirmation */}
      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Sign Out of RecruitAI"
        description="Are you sure you want to log out of the administration console?"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setLogoutOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleLogout}>
              Sign Out
            </Button>
          </div>
        }
      />
    </>
  );
}
