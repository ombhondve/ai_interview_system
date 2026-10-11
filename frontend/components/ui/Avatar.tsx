import { cn, initials } from "@/lib/utils";

const colorPalette = [
  "bg-blue-50 text-[#1976D2] border border-blue-200",
  "bg-emerald-50 text-[#16A34A] border border-emerald-200",
  "bg-amber-50 text-[#D97706] border border-amber-200",
  "bg-slate-100 text-[#64748B] border border-[#E2E8F0]",
];

function colorFor(name: string) {
  const idx = name.charCodeAt(0) % colorPalette.length;
  return colorPalette[idx];
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-7 w-7 text-[11px]",
    md: "h-9 w-9 text-xs",
    lg: "h-11 w-11 text-sm",
  };

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold select-none",
        sizeClasses[size],
        colorFor(name || "Unknown"),
        className
      )}
    >
      {initials(name || "U")}
    </div>
  );
}
