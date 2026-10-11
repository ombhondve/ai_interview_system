import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "./Button";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center bg-white">
      <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#F5F7FA]">
        <Icon className="h-5 w-5 text-[#64748B]" />
      </div>
      <h3 className="text-sm font-semibold text-[#111F33]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#64748B]">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button size="sm" variant="outline" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
