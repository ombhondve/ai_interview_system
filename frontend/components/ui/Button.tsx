"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[#1976D2] text-white hover:bg-[#1565C0] focus-visible:ring-[#1976D2]/30 shadow-sm",
  secondary:
    "bg-[#F5F7FA] text-[#111F33] hover:bg-[#E2E8F0] focus-visible:ring-slate-300 dark:bg-white/10 dark:text-white dark:hover:bg-white/15",
  outline:
    "border border-[#E2E8F0] bg-white text-slate-700 hover:bg-[#F5F7FA] hover:text-[#111F33] focus-visible:ring-[#1976D2]/20 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5",
  ghost:
    "text-slate-600 hover:bg-[#F5F7FA] hover:text-[#111F33] focus-visible:ring-slate-300 dark:text-slate-300 dark:hover:bg-white/10",
  destructive:
    "bg-[#DC2626] text-white hover:bg-[#B91C1C] focus-visible:ring-[#DC2626]/30 shadow-sm",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-xs font-medium gap-1.5",
  md: "h-9 px-3.5 text-sm font-medium gap-2",
  lg: "h-10 px-4 text-sm font-semibold gap-2",
  icon: "h-8 w-8 p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "inline-flex items-center justify-center rounded-md transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          "disabled:pointer-events-none disabled:opacity-50 select-none",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        disabled={disabled || loading}
        {...(props as any)}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = "Button";
