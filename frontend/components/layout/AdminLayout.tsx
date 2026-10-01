"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileNavigation } from "./MobileNavigation";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        if (!active) return;
        if (!res.ok) {
          router.replace("/login");
          return;
        }
        setCheckingSession(false);
      })
      .catch(() => {
        if (active) router.replace("/login");
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (checkingSession) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-[#0f1117]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <MobileNavigation open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0f1117] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
