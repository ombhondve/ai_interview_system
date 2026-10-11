import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

export function ErrorState({
  title = "Unable to load data",
  description = "Something went wrong while fetching this information. Please try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center bg-white">
      <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-[#DC2626]">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-[#111F33]">{title}</h3>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#64748B]">{description}</p>
      {onRetry && (
        <Button size="sm" variant="outline" className="mt-4" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
