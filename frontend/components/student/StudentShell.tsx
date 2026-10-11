"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  CalendarDays,
  Video,
  Menu,
  X,
  LogOut,
  UserCheck,
  Briefcase,
  ChevronRight,
} from "lucide-react";

/**
 * ============================================
 * TYPES
 * ============================================
 */
type StudentShellProps = {
  children: React.ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
};

/**
 * ============================================
 * EXACT 4 STUDENT NAVIGATION ITEMS (ORDER PRESERVED)
 * 1. Dashboard
 * 2. Projects
 * 3. Schedule
 * 4. Interviews
 * ============================================
 */
const navItems: NavItem[] = [
  {
    href: "/student/status",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/student/project",
    label: "Projects",
    icon: FolderKanban,
  },
  {
    href: "/student/interview-scheduling",
    label: "Schedule",
    icon: CalendarDays,
  },
  {
    href: "/student/interview",
    label: "Interviews",
    icon: Video,
  },
];

/**
 * ============================================
 * RECRUITAI STUDENT SHELL
 * Forest & Sand Design System
 * ============================================
 */
export function StudentShell({ children }: StudentShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [candidate, setCandidate] = useState<{
    name: string;
    role?: string;
    email?: string;
  } | null>(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loadingStudent, setLoadingStudent] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  /**
   * Load authenticated candidate session
   */
  useEffect(() => {
    let mounted = true;

    async function loadStudent() {
      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL ||
          "https://ai-interview-system-eewl.vercel.app";
        const response = await fetch(`${backendUrl}/api/student/me`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          if (mounted) {
            router.replace("/student/verify");
          }
          return;
        }

        const data = await response.json();
        if (mounted && data?.candidate) {
          setCandidate({
            name: data.candidate.name || "Candidate",
            role: data.candidate.role || "Applicant",
            email: data.candidate.email,
          });
        }
      } catch (error) {
        console.error("Failed to load candidate profile:", error);
        if (mounted) {
          router.replace("/student/verify");
        }
      } finally {
        if (mounted) {
          setLoadingStudent(false);
        }
      }
    }

    loadStudent();

    return () => {
      mounted = false;
    };
  }, [router]);

  /**
   * Close mobile navigation automatically when route changes
   */
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  /**
   * Invalidate candidate session on server & redirect to verification
   */
  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        "https://ai-interview-system-eewl.vercel.app";
      await fetch(`${backendUrl}/api/student/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Student logout error:", error);
    } finally {
      router.replace("/student/verify");
    }
  }

  /**
   * Active route matching
   */
  function isActive(href: string) {
    if (pathname === href) return true;
    if (href !== "/student/status" && pathname.startsWith(`${href}/`)) {
      return true;
    }
    return false;
  }

  return (
    <div className="min-h-screen bg-[#F5F1E8] text-[#1F2937] flex flex-col antialiased">
      {/* ======================================================== */}
      {/* MOBILE / TABLET TOP HEADER */}
      {/* ======================================================== */}
      <header className="lg:hidden sticky top-0 z-40 bg-[#1B4332] text-white border-b border-[#255A44] shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/student/status"
            className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-[#40916C] rounded-lg"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#40916C] text-white font-bold text-base shadow-sm">
              RA
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-white leading-tight">
                RecruitAI
              </div>
              <div className="text-xs text-[#D8CDBB]">Student Portal</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {candidate && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#255A44] text-[#F5F1E8]">
                {candidate.name}
              </span>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-[#F5F1E8] hover:bg-[#255A44] transition-colors focus:outline-none focus:ring-2 focus:ring-[#40916C]"
              aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer / Slide-Down */}
        {mobileMenuOpen && (
          <div className="border-t border-[#255A44] bg-[#143326] px-4 py-5 sm:px-6 space-y-4">
            {/* Candidate Card */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1B4332] border border-[#255A44]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#40916C] text-white font-semibold">
                {candidate?.name ? candidate.name.charAt(0).toUpperCase() : "C"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">
                  {loadingStudent ? "Loading..." : candidate?.name || "Student"}
                </p>
                <p className="text-xs text-[#D8CDBB] truncate">
                  {candidate?.role || "Candidate"}
                </p>
              </div>
            </div>

            {/* 4 Nav Links */}
            <nav aria-label="Mobile student navigation" className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-3 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? "bg-[#40916C] text-white shadow-sm font-semibold"
                        : "text-[#D8CDBB] hover:bg-[#1B4332] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                    {active && <span className="h-2 w-2 rounded-full bg-white" />}
                  </Link>
                );
              })}
            </nav>

            {/* Logout at bottom of mobile menu */}
            <div className="pt-2 border-t border-[#255A44]">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-medium text-[#F5F1E8] hover:bg-[#B91C1C]/20 hover:text-red-300 transition-colors"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                <span>{loggingOut ? "Signing out..." : "Sign Out"}</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ======================================================== */}
      {/* MAIN LAYOUT WRAPPER */}
      {/* ======================================================== */}
      <div className="flex-1 flex w-full">
        {/* ====================================================== */}
        {/* DESKTOP SIDEBAR (Forest Green #1B4332) */}
        {/* ====================================================== */}
        <aside
          aria-label="Student sidebar navigation"
          className="hidden lg:flex w-64 shrink-0 flex-col bg-[#1B4332] text-white border-r border-[#255A44] sticky top-0 h-screen"
        >
          {/* Top Logo / Brand Section */}
          <div className="p-6 border-b border-[#255A44]/80">
            <Link
              href="/student/status"
              className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-[#40916C] rounded-lg"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#40916C] text-white font-bold text-base shadow-sm group-hover:bg-[#347959] transition-colors">
                RA
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold tracking-tight text-white leading-tight">
                  RecruitAI
                </div>
                <div className="text-xs font-medium text-[#D8CDBB]">
                  Student Portal
                </div>
              </div>
            </Link>
          </div>

          {/* Navigation Section */}
          <div className="flex-1 px-4 py-6 overflow-y-auto space-y-6">
            <div>
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#D8CDBB]/70 mb-3">
                Main Menu
              </p>
              <nav aria-label="Desktop student navigation" className="space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        active
                          ? "bg-[#40916C] text-white shadow-sm font-semibold"
                          : "text-[#D8CDBB] hover:bg-[#255A44] hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`h-4.5 w-4.5 shrink-0 ${
                            active
                              ? "text-white"
                              : "text-[#D8CDBB] group-hover:text-white"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {active && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Candidate Identity Profile Box */}
            <div className="p-3.5 rounded-xl bg-[#143326] border border-[#255A44] space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#40916C] text-white font-semibold text-xs">
                  {candidate?.name
                    ? candidate.name.charAt(0).toUpperCase()
                    : "C"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">
                    {loadingStudent ? "Loading..." : candidate?.name || "Student"}
                  </p>
                  <p className="text-[11px] text-[#D8CDBB] truncate">
                    {candidate?.role || "Candidate"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#40916C] bg-[#1B4332] px-2 py-1 rounded">
                <UserCheck className="h-3 w-3 shrink-0" />
                <span className="font-medium truncate">Verified Candidate</span>
              </div>
            </div>
          </div>

          {/* Bottom Logout Action Anchored at Bottom */}
          <div className="p-4 border-t border-[#255A44]/80 bg-[#143326]/60">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-[#D8CDBB] hover:bg-[#B91C1C]/20 hover:text-red-300 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              <LogOut className="h-4.5 w-4.5 shrink-0 text-red-400" />
              <span>{loggingOut ? "Signing out..." : "Sign Out"}</span>
            </button>
          </div>
        </aside>

        {/* ====================================================== */}
        {/* MAIN CONTENT AREA (Warm Sand #F5F1E8) */}
        {/* ====================================================== */}
        <main className="flex-1 min-w-0 bg-[#F5F1E8] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto max-w-6xl w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
