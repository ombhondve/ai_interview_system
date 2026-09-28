"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import { useEffect, useState } from "react";

import {
  LayoutDashboard,
  CalendarDays,
  Video,
  FolderKanban,
  ClipboardCheck,
  Menu,
  X,
  LogOut,
  UserRound,
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
 * NAVIGATION
 * ============================================
 */

const navItems: NavItem[] = [
  {
    href: "/student/status",
    label: "Status",
    icon: LayoutDashboard,
  },
  {
    href: "/student/guide/book-slot",
    label: "Book slot",
    icon: CalendarDays,
  },
  {
    href: "/student/guide/interview",
    label: "Interview",
    icon: Video,
  },
  {
    href: "/student/guide/mock-interview",
    label: "Mock interview",
    icon: Video,
  },
  {
    href: "/student/guide/project",
    label: "Project",
    icon: FolderKanban,
  },
  {
    href: "/student/guide/result",
    label: "Result",
    icon: ClipboardCheck,
  },
];

/**
 * ============================================
 * STUDENT SHELL
 * ============================================
 */

export function StudentShell({
  children,
}: StudentShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [name, setName] =
    useState("");

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const [loadingStudent, setLoadingStudent] =
    useState(true);

  /**
   * ==========================================
   * LOAD CURRENT STUDENT
   * ==========================================
   */

  useEffect(() => {
    let mounted = true;

    async function loadStudent() {
      try {
        const response = await fetch(
          "/api/student/me",
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          if (mounted) {
            router.replace(
              "/student/verify"
            );
          }

          return;
        }

        const data =
          await response.json();

        if (
          mounted &&
          data?.candidate?.name
        ) {
          setName(
            data.candidate.name
          );
        }
      } catch (error) {
        console.error(
          "Failed to load student:",
          error
        );

        if (mounted) {
          router.replace(
            "/student/verify"
          );
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
   * ==========================================
   * CLOSE MOBILE MENU AFTER NAVIGATION
   * ==========================================
   */

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  /**
   * ==========================================
   * LOGOUT
   * ==========================================
   *
   * Currently this only clears the frontend
   * navigation state.
   *
   * Your backend should eventually provide
   * a real logout endpoint that invalidates
   * the candidate session.
   */

  async function handleLogout() {
    try {
      await fetch(
        "/api/student/logout",
        {
          method: "POST",
          credentials: "include",
        }
      );
    } catch (error) {
      console.error(
        "Student logout error:",
        error
      );
    } finally {
      router.replace(
        "/student/verify"
      );
    }
  }

  /**
   * ==========================================
   * CHECK ACTIVE ROUTE
   * ==========================================
   */

  function isActive(
    href: string
  ) {
    if (pathname === href) {
      return true;
    }

    /**
     * Allows nested pages to keep the
     * parent navigation item active.
     */
    return (
      pathname.startsWith(
        `${href}/`
      )
    );
  }

  /**
   * ==========================================
   * NAVIGATION ITEM
   * ==========================================
   */

  function NavigationItem({
    item,
    mobile = false,
  }: {
    item: NavItem;
    mobile?: boolean;
  }) {
    const Icon = item.icon;
    const active = isActive(
      item.href
    );

    return (
      <Link
        href={item.href}
        className={`
          group
          flex
          items-center
          gap-3
          rounded-xl
          font-medium
          transition-all
          duration-150
          ${
            mobile
              ? "min-w-[112px] shrink-0 px-4 py-3 text-sm"
              : "w-full px-3 py-3 text-sm"
          }
          ${
            active
              ? "bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-500/15 dark:text-indigo-300"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
          }
        `}
      >
        <Icon
          className={`
            h-5
            w-5
            shrink-0
            ${
              active
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
            }
          `}
        />

        <span className="truncate">
          {item.label}
        </span>
      </Link>
    );
  }

  /**
   * ==========================================
   * PAGE
   * ==========================================
   */

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1117]">
      {/* ====================================== */}
      {/* TOP HEADER */}
      {/* ====================================== */}

      <header className="surface sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-[#111318]/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}

          <Link
            href="/student/status"
            className="flex min-w-0 items-center gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-sm">
              AI
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
                RecruitAI
              </p>

              <p className="hidden text-xs text-slate-500 sm:block">
                Student Portal
              </p>
            </div>
          </Link>

          {/* Desktop candidate information */}

          <div className="hidden items-center gap-3 sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
              <UserRound className="h-4 w-4" />
            </div>

            <div className="max-w-[180px]">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {loadingStudent
                  ? "Loading..."
                  : name ||
                    "Student"}
              </p>

              <p className="text-xs text-slate-500">
                Candidate
              </p>
            </div>
          </div>

          {/* Mobile menu button */}

          <button
            type="button"
            onClick={() =>
              setMobileMenuOpen(
                !mobileMenuOpen
              )
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5 sm:hidden"
            aria-label={
              mobileMenuOpen
                ? "Close navigation"
                : "Open navigation"
            }
            aria-expanded={
              mobileMenuOpen
            }
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* ==================================== */}
        {/* MOBILE MENU */}
        {/* ==================================== */}

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-[#111318] sm:hidden">
            {/* Student */}

            <div className="mb-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                <UserRound className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {loadingStudent
                    ? "Loading..."
                    : name ||
                      "Student"}
                </p>

                <p className="text-xs text-slate-500">
                  Candidate
                </p>
              </div>
            </div>

            {/* Mobile navigation */}

            <nav
              aria-label="Student navigation"
              className="space-y-1"
            >
              {navItems.map(
                (item) => (
                  <NavigationItem
                    key={item.href}
                    item={item}
                  />
                )
              )}
            </nav>

            {/* Mobile logout */}

            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 dark:text-slate-300 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <LogOut className="h-5 w-5" />

              <span>
                Sign out
              </span>
            </button>
          </div>
        )}
      </header>

      {/* ====================================== */}
      {/* MAIN APPLICATION AREA */}
      {/* ====================================== */}

      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-7 lg:px-8">
        {/* ==================================== */}
        {/* DESKTOP SIDEBAR */}
        {/* ==================================== */}

        <aside className="hidden lg:block">
          <nav
            aria-label="Student navigation"
            className="surface sticky top-24 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-[#151820]"
          >
            {/* Navigation title */}

            <div className="px-3 pb-3 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Student portal
              </p>
            </div>

            {/* Navigation links */}

            <div className="space-y-1">
              {navItems.map(
                (item) => (
                  <NavigationItem
                    key={item.href}
                    item={item}
                  />
                )
              )}
            </div>

            {/* Divider */}

            <div className="my-3 border-t border-slate-200 dark:border-white/10" />

            {/* Logout */}

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-700 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <LogOut className="h-5 w-5" />

              <span>
                Sign out
              </span>
            </button>
          </nav>
        </aside>

        {/* ==================================== */}
        {/* MAIN CONTENT */}
        {/* ==================================== */}

        <main className="min-w-0">
          {children}
        </main>
      </div>

      {/* ====================================== */}
      {/* MOBILE BOTTOM SAFE SPACE */}
      {/* ====================================== */}

      <div className="h-4 sm:hidden" />
    </div>
  );
}