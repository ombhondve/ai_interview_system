"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Layers, Users, Search, ArrowRight, ArrowUpDown, Filter } from "lucide-react";
import Link from "next/link";
import { request } from "@/lib/client";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { SkeletonTableRow, SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type BatchSummary = { name: string; count: number };

export default function BatchesPage() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await request<{ data: BatchSummary[] }>("/api/batches");
      setBatches(result.data || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredBatches = useMemo(() => {
    let list = batches.filter((b) =>
      b.name.toLowerCase().includes(search.trim().toLowerCase())
    );
    list = list.sort((a, b) =>
      sortOrder === "desc" ? b.count - a.count : a.count - b.count
    );
    return list;
  }, [batches, search, sortOrder]);

  const totalCandidates = useMemo(() => {
    return batches.reduce((acc, b) => acc + (b.count || 0), 0);
  }, [batches]);

  const avgPerBatch = useMemo(() => {
    if (!batches.length) return 0;
    return Math.round(totalCandidates / batches.length);
  }, [batches, totalCandidates]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111F33]">Batches</h1>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Candidate batches grouped by intake cohort and application cycles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={load}
            disabled={loading}
          >
            Refresh
          </Button>
          <Link href="/admin/candidates">
            <Button size="sm">
              All Candidates
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* KPI Metric Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748B]">Total Cohorts</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-[#1976D2] border border-blue-200">
              <Layers className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-[#111F33]">
              {loading ? "…" : batches.length}
            </span>
            <span className="text-xs text-[#64748B]">active batches</span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748B]">Total Enrolled</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-[#16A34A] border border-emerald-200">
              <Users className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-[#111F33]">
              {loading ? "…" : totalCandidates}
            </span>
            <span className="text-xs text-[#64748B]">candidates across cohorts</span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748B]">Cohort Average</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-[#D97706] border border-amber-200">
              <Filter className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-[#111F33]">
              {loading ? "…" : avgPerBatch}
            </span>
            <span className="text-xs text-[#64748B]">candidates / cohort</span>
          </div>
        </Card>
      </div>

      {/* Main Table & Filter Toolbar */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#E2E8F0] p-4 sm:flex-row sm:items-center sm:justify-between bg-white">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cohort by name…"
              className="h-9 w-full rounded-md border border-[#E2E8F0] bg-white pl-9 pr-3 text-xs text-[#111F33] placeholder:text-[#64748B] focus:border-[#1976D2] focus:outline-none focus:ring-1 focus:ring-[#1976D2]"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#111F33] transition-colors"
            >
              <ArrowUpDown className="h-3 w-3" />
              <span>Sort by Size: {sortOrder === "desc" ? "High to Low" : "Low to High"}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonTableRow key={i} />
            ))}
          </div>
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : filteredBatches.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={search ? "No matching batches" : "No batches found"}
            description={
              search
                ? `No cohorts matching "${search}". Try adjusting your query.`
                : "Batches are automatically indexed as candidate applications are received."
            }
            actionLabel={search ? "Clear Search" : undefined}
            onAction={search ? () => setSearch("") : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F5F7FA]/70 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                  <th className="px-5 py-3">Cohort Name</th>
                  <th className="px-5 py-3">Enrolled Candidates</th>
                  <th className="px-5 py-3">Distribution Share</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredBatches.map((batch) => {
                  const sharePercent = totalCandidates > 0 ? Math.round((batch.count / totalCandidates) * 100) : 0;
                  return (
                    <tr
                      key={batch.name}
                      className="hover:bg-[#F5F7FA]/80 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-[#111F33]">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-[#1976D2] border border-blue-200">
                            <Layers className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-semibold">{batch.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[#111F33]">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-[#111F33] border border-[#E2E8F0]">
                          <Users className="h-3 w-3 text-[#64748B]" />
                          {batch.count} candidate{batch.count === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 max-w-xs">
                          <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden border border-[#E2E8F0]">
                            <div
                              className="h-full bg-[#1976D2] rounded-full"
                              style={{ width: `${Math.min(100, sharePercent)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-[#64748B] font-medium">{sharePercent}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="success">Active Cohort</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/admin/candidates?batch=${encodeURIComponent(batch.name)}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#1976D2] hover:underline"
                        >
                          View Candidates
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
