"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Menu,
  Search,
  Bell,
  Moon,
  Sun,
  ChevronDown,
  LogOut,
  User,
  Settings,
  ShieldCheck,
  Check,
} from "lucide-react";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [dark, setDark] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);

  // Sync theme
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/admin/candidates?search=${encodeURIComponent(searchQuery.trim())}`);
  };

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

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 sm:px-6 z-10 select-none">
        {/* Left: Mobile Toggle & Page Context */}
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

        {/* Center: Global Search */}
        <div className="flex-1 max-w-md mx-4">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate, project, or role (Press Enter)..."
              className="h-8.5 w-full rounded-md border border-[#E2E8F0] bg-[#F5F7FA] pl-8 pr-12 text-xs text-[#111F33] placeholder:text-slate-400 focus:border-[#1976D2] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1976D2]"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-[#E2E8F0] bg-white px-1.5 text-[10px] font-medium text-slate-400">
              ↵
            </kbd>
          </form>
        </div>

        {/* Right: Notifications, Theme, Profile */}
        <div className="flex items-center gap-2">
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
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1976D2] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1976D2]" />
                  </span>
                )}
              </button>
            }
          >
            <div className="w-72 p-2">
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#E2E8F0] pb-2">
                <span className="text-xs font-semibold text-[#111F33]">Notifications</span>
                <button
                  type="button"
                  onClick={() => setUnreadCount(0)}
                  className="text-[11px] text-[#1976D2] hover:underline"
                >
                  Mark all read
                </button>
              </div>
              <div className="py-2 space-y-1 text-xs">
                <div className="p-2 rounded hover:bg-[#F5F7FA] transition-colors">
                  <p className="font-medium text-[#111F33]">New candidate submission</p>
                  <p className="text-[11px] text-[#64748B]">GitHub repository submitted for review</p>
                  <span className="text-[10px] text-slate-400">10m ago</span>
                </div>
                <div className="p-2 rounded hover:bg-[#F5F7FA] transition-colors">
                  <p className="font-medium text-[#111F33]">Interview completed</p>
                  <p className="text-[11px] text-[#64748B]">AI evaluation report ready for review</p>
                  <span className="text-[10px] text-slate-400">1h ago</span>
                </div>
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

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-md p-2 text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#111F33] transition-colors"
            aria-label="Toggle visual theme"
          >
            {dark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Admin Profile Dropdown */}
          <Dropdown
            trigger={
              <button
                type="button"
                className="flex items-center gap-2 rounded-md p-1.5 hover:bg-[#F5F7FA] transition-colors text-left"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111F33] text-white text-xs font-semibold">
                  A
                </div>
                <div className="hidden sm:block leading-tight">
                  <p className="text-xs font-semibold text-[#111F33]">Administrator</p>
                  <p className="text-[10px] text-[#64748B]">Super Admin</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-[#64748B] hidden sm:block" />
              </button>
            }
          >
            <div className="w-48 py-1">
              <div className="px-3 py-2 border-b border-[#E2E8F0] mb-1">
                <p className="text-xs font-semibold text-[#111F33]">System Admin</p>
                <p className="text-[11px] text-[#64748B] truncate">admin@recruitai.com</p>
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
