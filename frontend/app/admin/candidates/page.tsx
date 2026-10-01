"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Users, X } from "lucide-react";
import { candidateService, CandidateFilters as Filters } from "@/services/candidate.api";
import { Candidate } from "@/types";
import { Card } from "@/components/ui/Card";
import { SkeletonTableRow } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { CandidateFiltersBar } from "@/components/candidates/CandidateFilters";
import { CandidateTable } from "@/components/candidates/CandidateTable";
import { CandidateCard } from "@/components/candidates/CandidateCard";
import { Button } from "@/components/ui/Button";

const DEFAULT_FILTERS: Filters = { page: 1, pageSize: 6, sortBy: "receivedDate", sortDir: "desc" };

export default function CandidatesPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const roles = candidateService.getRoles();
  const batches = candidateService.getBatches();

  const load = useCallback(async (f: Filters) => {
    setLoading(true);
    setError(false);
    try {
      const result = await candidateService.getCandidates(f);
      setCandidates(result.data);
      setTotal(result.total);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  const handleSort = (field: Filters["sortBy"]) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: field,
      sortDir: prev.sortBy === field && prev.sortDir === "desc" ? "asc" : "desc",
    }));
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (candidates.every((c) => prev.has(c.id))) return new Set();
      return new Set(candidates.map((c) => c.id));
    });
  };

  const clearSelection = () => setSelected(new Set());

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="mb-6 flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Candidates
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {loading ? "Loading applications…" : `${total} application${total === 1 ? "" : "s"} on file`}
          </p>
        </div>

        {/* Selection toolbar — replaces the subtitle area instead of stacking below it */}
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-1.5 shadow-sm dark:border-white/10 dark:bg-white/5"
          >
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {selected.size} selected
            </span>
            <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-white/10" />
            <Button size="sm" variant="secondary">
              Approve
            </Button>
            <Button size="sm" variant="destructive">
              Reject
            </Button>
            <button
              onClick={clearSelection}
              aria-label="Clear selection"
              className="ml-1 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* Filters — single horizontal row, wraps only if the viewport is too narrow */}
      <Card className="mb-5 p-3">
        <CandidateFiltersBar
          filters={filters}
          roles={roles}
          batches={batches}
          onChange={setFilters}
          onClear={() => setFilters(DEFAULT_FILTERS)}
        />
      </Card>

      <Card>
        {loading ? (
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonTableRow key={i} />
            ))}
          </div>
        ) : error ? (
          <ErrorState onRetry={() => load(filters)} />
        ) : candidates.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No candidates found"
            description="Try changing your filters or search query."
            actionLabel="Clear filters"
            onAction={() => setFilters(DEFAULT_FILTERS)}
          />
        ) : (
          <>
            <CandidateTable
              candidates={candidates}
              selected={selected}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              sortBy={filters.sortBy}
              sortDir={filters.sortDir}
              onSort={handleSort}
            />
            <div className="space-y-3 p-4 sm:hidden">
              {candidates.map((c, i) => (
                <CandidateCard key={c.id} candidate={c} index={i} />
              ))}
            </div>
            <Pagination
              page={filters.page ?? 1}
              pageSize={filters.pageSize ?? 6}
              total={total}
              onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
            />
          </>
        )}
      </Card>
    </div>
  );
}
