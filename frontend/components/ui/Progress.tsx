"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  label,
  color = "accent",
}: {
  value: number;
  label?: string;
  color?: "accent" | "success" | "warning" | "danger";
}) {
  const colorMap = {
    accent: "bg-accent-600",
    success: "bg-success-500",
    warning: "bg-warning-500",
    danger: "bg-danger-500",
  };
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-slate-600 dark:text-slate-300">{label}</span>
          <span className="font-medium text-slate-900 dark:text-white">{value}%</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn("h-full rounded-full", colorMap[color])}
        />
      </div>
    </div>
  );
}

export function CircularProgress({
  value,
  size = 96,
  strokeWidth = 8,
  label,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const [display, setDisplay] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (display / 100) * circumference;

  const color = value >= 75 ? "#22c55e" : value >= 50 ? "#f59e0b" : "#ef4444";

  useEffect(() => {
    const timeout = setTimeout(() => setDisplay(value), 50);
    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="fill-none stroke-slate-100 dark:stroke-white/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={color}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-slate-900 dark:text-white">{display}</span>
        {label && <span className="text-[10px] text-slate-500 dark:text-slate-400">{label}</span>}
      </div>
    </div>
  );
}
