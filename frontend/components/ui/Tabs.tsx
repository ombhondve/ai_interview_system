"use client";

import { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  active: string;
  setActive: (v: string) => void;
}
const TabsContext = createContext<TabsContextValue | null>(null);

export function Tabs({
  defaultValue,
  children,
  className,
}: {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [active, setActive] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex gap-1 border-b border-[#E2E8F0]", className)} role="tablist">
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = useContext(TabsContext)!;
  const isActive = ctx?.active === value;
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx?.setActive(value)}
      className={cn(
        "relative px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors",
        isActive
          ? "text-[#1976D2]"
          : "text-[#64748B] hover:text-[#111F33]"
      )}
    >
      {children}
      {isActive && (
        <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#1976D2]" />
      )}
    </button>
  );
}

export function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = useContext(TabsContext)!;
  if (ctx?.active !== value) return null;
  return (
    <div role="tabpanel" className={cn("animate-fade-in py-4", className)}>
      {children}
    </div>
  );
}
