"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
  );

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-[#E2E8F0] px-5 py-3 sm:flex-row bg-white">
      <p className="text-xs text-[#64748B]">
        Showing <span className="font-medium text-[#111F33]">{start}–{end}</span> of{" "}
        <span className="font-medium text-[#111F33]">{total}</span> records
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E2E8F0] text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#111F33] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {pages.map((p, i) => (
          <span key={p} className="flex items-center">
            {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-xs text-[#64748B]">…</span>}
            <button
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition-colors",
                p === page
                  ? "bg-[#1976D2] text-white shadow-xs font-semibold"
                  : "text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#111F33]"
              )}
            >
              {p}
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E2E8F0] text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#111F33] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
