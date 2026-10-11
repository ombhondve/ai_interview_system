import { cn } from "@/lib/utils";

export type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-emerald-50 text-[#16A34A] border border-emerald-200/70",
  warning: "bg-amber-50 text-[#D97706] border border-amber-200/70",
  danger: "bg-red-50 text-[#DC2626] border border-red-200/70",
  info: "bg-blue-50 text-[#1976D2] border border-blue-200/70",
  neutral: "bg-slate-50 text-[#64748B] border border-slate-200/70",
  accent: "bg-blue-50 text-[#1976D2] border border-blue-200/70",
};

const dotClasses: Record<BadgeVariant, string> = {
  success: "bg-[#16A34A]",
  warning: "bg-[#D97706]",
  danger: "bg-[#DC2626]",
  info: "bg-[#1976D2]",
  neutral: "bg-[#64748B]",
  accent: "bg-[#1976D2]",
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
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none tracking-tight",
        variantClasses[variant],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClasses[variant])} />}
      {children}
    </span>
  );
}

export const statusToBadgeVariant: Record<string, BadgeVariant> = {
  received: "info",
  under_review: "warning",
  approved: "success",
  rejected: "danger",
  scheduled: "info",
  completed: "success",
  decided: "neutral",
  pending: "warning",
  sent: "info",
  delivered: "success",
  failed: "danger",
  no_show: "danger",
  selected: "success",
};
