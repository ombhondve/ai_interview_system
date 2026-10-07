"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/client";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

type ReportRow = { _id: string; status: string; scheduledAt: string; analysis?: { overallScore?: number; recommendation?: string }; candidateId?: { name?: string; email?: string } | string; projectId?: { title?: string } | string };
export default function InterviewsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]); const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const response = await fetch(apiUrl("/api/ai-interviews/admin/reports"), { credentials: "include" }); const data = await response.json(); if (!response.ok) throw new Error(data.message || "Unable to load reports."); setRows(data.interviews || []); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load interviews."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="space-y-5"><div><h1 className="text-xl font-semibold">Interviews</h1><p className="mt-1 text-sm text-slate-500">Completed interview reports for administrator review.</p></div>{error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}<Card><CardHeader title="Interview reports" subtitle={`${rows.length} completed or analyzed sessions`}/><CardContent className="space-y-3">{rows.length === 0 ? <p className="text-sm text-slate-500">No completed interview reports are available yet.</p> : rows.map((row) => { const candidate = typeof row.candidateId === "object" ? row.candidateId : null; const project = typeof row.projectId === "object" ? row.projectId : null; return <Link key={row._id} href={`/admin/interviews/${row._id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 transition hover:border-indigo-300"><div><p className="font-medium">{candidate?.name || "Candidate"}</p><p className="text-sm text-slate-500">{project?.title || "Project"} · {new Date(row.scheduledAt).toLocaleString()}</p></div><div className="text-right"><p className="font-semibold">{row.analysis ? `${row.analysis.overallScore}/100` : "Pending analysis"}</p><p className="text-xs text-slate-500">{row.analysis?.recommendation || row.status.replaceAll("_", " ")}</p></div></Link>; })}</CardContent></Card></div>;
}
