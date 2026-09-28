"use client";

import {
  Search,
  X,
  SlidersHorizontal,
} from "lucide-react";

import {
  CandidateFilters as Filters,
} from "@/services/candidate.api";

interface CandidateFiltersBarProps {
  filters: Filters;
  roles: string[];
  batches: string[];
  onChange: (filters: Filters) => void;
  onClear: () => void;
}

const selectClass =
  "h-9 shrink-0 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 " +
  "outline-none transition-colors focus:border-slate-400 " +
  "dark:border-white/10 dark:bg-white/5 dark:text-slate-200";

export function CandidateFiltersBar({
  filters,
  roles,
  batches,
  onChange,
  onClear,
}: CandidateFiltersBarProps) {

  // =====================================================
  // CHECK ACTIVE FILTERS
  // =====================================================

  const hasActiveFilters =
    !!filters.search ||
    !!filters.role ||
    !!filters.batch ||
    !!filters.status;


  // =====================================================
  // UPDATE FILTERS
  // =====================================================

  const update = (
    patch: Partial<Filters>
  ) => {
    onChange({
      ...filters,
      ...patch,
      page: 1,
    });
  };


  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">

      {/* =================================================
          FILTER ICON
      ================================================= */}

      <div className="flex shrink-0 items-center gap-1.5 pr-1 text-slate-400">
        <SlidersHorizontal className="h-4 w-4" />
      </div>


      {/* =================================================
          SEARCH
      ================================================= */}

      <div className="relative min-w-[180px] flex-1">

        <Search
          className="
            pointer-events-none
            absolute
            left-2.5
            top-1/2
            h-3.5
            w-3.5
            -translate-y-1/2
            text-slate-400
          "
        />

        <input
          value={filters.search ?? ""}
          onChange={(e) =>
            update({
              search: e.target.value,
            })
          }
          placeholder="Search candidates…"
          className="
            h-9
            w-full
            rounded-md
            border
            border-slate-200
            bg-white
            pl-8
            pr-3
            text-sm
            text-slate-700
            placeholder:text-slate-400
            outline-none
            transition-colors
            focus:border-slate-400
            dark:border-white/10
            dark:bg-white/5
            dark:text-slate-200
          "
        />

      </div>


      {/* =================================================
          ROLE FILTER
      ================================================= */}

      <select
        value={filters.role ?? ""}
        onChange={(e) =>
          update({
            role:
              e.target.value ||
              undefined,
          })
        }
        className={selectClass}
      >

        <option value="">
          All roles
        </option>

        {roles.map((role) => (
          <option
            key={role}
            value={role}
          >
            {role}
          </option>
        ))}

      </select>


      {/* =================================================
          BATCH FILTER
      ================================================= */}

      <select
        value={filters.batch ?? ""}
        onChange={(e) =>
          update({
            batch:
              e.target.value ||
              undefined,
          })
        }
        className={selectClass}
      >

        <option value="">
          All batches
        </option>

        {batches.map((batch) => (
          <option
            key={batch}
            value={batch}
          >
            {batch}
          </option>
        ))}

      </select>


      {/* =================================================
          STATUS FILTER
      ================================================= */}

      <select
        value={filters.status ?? ""}
        onChange={(e) =>
          update({
            status: (e.target.value || undefined) as Filters["status"],
          })
        }
        className={selectClass}
      >

        <option value="">
          All statuses
        </option>

        <option value="received">
          Received
        </option>

        <option value="under_review">
          Under Review
        </option>

        <option value="approved">
          Approved
        </option>

        <option value="rejected">
          Rejected
        </option>

        <option value="scheduled">
          Scheduled
        </option>

        <option value="completed">
          Completed
        </option>

        <option value="decided">
          Decided
        </option>

      </select>


      {/* =================================================
          CLEAR FILTERS
      ================================================= */}

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClear}
          className="
            flex
            h-9
            shrink-0
            items-center
            gap-1
            rounded-md
            px-2.5
            text-sm
            text-slate-500
            transition-colors
            hover:bg-slate-100
            hover:text-slate-700
            dark:hover:bg-white/10
            dark:hover:text-slate-200
          "
        >

          <X className="h-3.5 w-3.5" />

          Clear

        </button>
      )}

    </div>
  );
}