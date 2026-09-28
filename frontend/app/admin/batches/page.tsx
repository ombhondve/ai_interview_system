"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Layers, Users } from "lucide-react";
import { request } from "@/lib/client";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

type BatchSummary = { name: string; count: number };

export default function BatchesPage() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await request<{ data: BatchSummary[] }>("/api/batches");
      setBatches(result.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Batches</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Candidate batches grouped by intake cohort.
        </p>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState onRetry={load} />
        </Card>
      ) : batches.length === 0 ? (
        <Card>
          <EmptyState
            icon={Layers}
            title="No batches found"
            description="Batches are created automatically as candidates are received."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((batch, i) => (
            <motion.div
              key={batch.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card>
                <CardHeader
                  title={batch.name}
                  subtitle={`${batch.count} candidate${batch.count === 1 ? "" : "s"}`}
                  action={
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-500/10">
                      <Users className="h-4 w-4" />
                    </div>
                  }
                />
                <CardContent className="text-sm text-slate-500 dark:text-slate-400">
                  Batch intake cohort tracked from candidate applications.
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
