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
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";

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

export function Sidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      router.replace("/login");
    }
  };

  return (
    <aside
      className={cn(
        "surface flex h-full flex-col border-r transition-all duration-200",
        mobile ? "w-64" : collapsed ? "w-[72px]" : "w-60"
      )}
    >
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-100 px-4 dark:border-white/5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-600 text-sm font-bold text-white">
          AI
        </div>
        {(mobile || !collapsed) && (
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            RecruitAI
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const link = (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
              )}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {(mobile || !collapsed) && <span className="truncate">{item.label}</span>}
            </Link>
          );

          if (!mobile && collapsed) {
            return (
              <Tooltip key={item.href} content={item.label} side="right">
                {link}
              </Tooltip>
            );
          }
          return link;
        })}
      </nav>

      <div className="space-y-1 border-t border-slate-100 px-3 py-4 dark:border-white/5">
        <Link
          href="/admin/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
        >
          <Settings className="h-[18px] w-[18px] shrink-0" />
          {(mobile || !collapsed) && "Settings"}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-500/10"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {(mobile || !collapsed) && "Logout"}
        </button>
      </div>

      {!mobile && (
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center justify-center border-t border-slate-100 py-3 text-slate-400 hover:text-slate-600 dark:border-white/5 dark:hover:text-slate-300"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      )}
    </aside>
  );
}