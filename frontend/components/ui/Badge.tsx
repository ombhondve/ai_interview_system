import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500",
  warning: "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-500",
  danger: "bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-500",
  info: "bg-info-50 text-info-600 dark:bg-info-500/10 dark:text-info-500",
  neutral: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  accent: "bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400",
};

export function Badge({
  children,
  variant = "neutral",
  dot = false,
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const statusToBadgeVariant: Record<string, BadgeVariant> = {
  received: "info",
  under_review: "warning",
  approved: "success",
  rejected: "danger",
  scheduled: "accent",
  completed: "success",
  decided: "neutral",
  pending: "warning",
  sent: "info",
  delivered: "success",
  failed: "danger",
  no_show: "danger",
  selected: "success",
};