"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Video,
  CalendarDays,
  FolderKanban,
  Layers,
  FileBarChart,
  BarChart3,
  Bell,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Candidates", href: "/admin/candidates", icon: Users },
  { label: "Batches", href: "/admin/batches", icon: Layers },
  { label: "Interviews", href: "/admin/interviews", icon: Video },
  { label: "Schedule", href: "/admin/schedule", icon: CalendarDays },
  { label: "Projects", href: "/admin/projects", icon: FolderKanban },
  { label: "Reports", href: "/admin/reports", icon: FileBarChart },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Notifications", href: "/admin/notifications", icon: Bell },
];

export function Sidebar({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      router.replace("/login");
    }
  };

  return (
    <>
      <aside
        className={cn(
          "flex h-full flex-col bg-[#111F33] text-white transition-all duration-200 select-none border-r border-[#1C2C44]",
          mobile ? "w-[240px]" : collapsed ? "w-[68px]" : "w-[240px]"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-[#1C2C44] px-4">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1976D2]"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1976D2] text-white font-bold text-xs tracking-wider shadow-sm">
              RA
            </div>
            {(mobile || !collapsed) && (
              <div className="flex flex-col">
                <span className="font-semibold text-sm tracking-tight text-white leading-tight">
                  RecruitAI
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                  Enterprise
                </span>
              </div>
            )}
          </Link>

          {!mobile && (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Section Label */}
        {(mobile || !collapsed) && (
          <div className="px-4 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Navigation
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const linkContent = (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-all duration-150",
                  active
                    ? "bg-[#1976D2] text-white font-semibold shadow-sm"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-150",
                    active ? "text-white" : "text-slate-400 group-hover:text-white"
                  )}
                />
                {(mobile || !collapsed) && (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            );

            if (!mobile && collapsed) {
              return (
                <Tooltip key={item.href} content={item.label} side="right">
                  {linkContent}
                </Tooltip>
              );
            }
            return linkContent;
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="border-t border-[#1C2C44] px-2.5 py-3 space-y-0.5">
          {/* Settings Link */}
          {(() => {
            const active = isActive("/admin/settings");
            const settingsLink = (
              <Link
                href="/admin/settings"
                onClick={onNavigate}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-[#1976D2] text-white font-semibold shadow-sm"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                )}
              >
                <Settings className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-white" />
                {(mobile || !collapsed) && <span className="truncate">Settings</span>}
              </Link>
            );

            return !mobile && collapsed ? (
              <Tooltip content="Settings" side="right">
                {settingsLink}
              </Tooltip>
            ) : (
              settingsLink
            );
          })()}

          {/* Logout Button */}
          {(() => {
            const logoutButton = (
              <button
                type="button"
                onClick={() => setLogoutModalOpen(true)}
                className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs font-medium text-slate-300 hover:bg-red-500/15 hover:text-red-300 transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-red-300" />
                {(mobile || !collapsed) && <span className="truncate">Sign Out</span>}
              </button>
            );

            return !mobile && collapsed ? (
              <Tooltip content="Sign Out" side="right">
                {logoutButton}
              </Tooltip>
            ) : (
              logoutButton
            );
          })()}
        </div>
      </aside>

      {/* Confirmation Modal */}
      <Modal
        open={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        title="Sign Out of RecruitAI"
        description="Are you sure you want to log out of your administrator session?"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLogoutModalOpen(false)}
              disabled={loggingOut}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleLogout}
              loading={loggingOut}
            >
              Sign Out
            </Button>
          </div>
        }
      />
    </>
  );
}
