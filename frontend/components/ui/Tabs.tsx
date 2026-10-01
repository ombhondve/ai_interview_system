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

export function TabsList({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-1 border-b border-slate-200 dark:border-white/10" role="tablist">
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = useContext(TabsContext)!;
  const isActive = ctx.active === value;
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx.setActive(value)}
      className={cn(
        "relative px-4 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "text-accent-600 dark:text-accent-400"
          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      )}
    >
      {children}
      {isActive && (
        <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent-600 dark:bg-accent-400" />
      )}
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = useContext(TabsContext)!;
  if (ctx.active !== value) return null;
  return (
    <div role="tabpanel" className="animate-fade-in py-4">
      {children}
    </div>
  );
}
