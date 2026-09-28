import { cn, initials } from "@/lib/utils";

const colorPalette = [
  "bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400",
  "bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-500",
  "bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500",
  "bg-info-100 text-info-600 dark:bg-info-500/15 dark:text-info-500",
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
  const sizeClasses = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm", lg: "h-12 w-12 text-base" };
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        sizeClasses[size],
        colorFor(name),
        className
      )}
    >
      {initials(name)}
    </div>
  );
}