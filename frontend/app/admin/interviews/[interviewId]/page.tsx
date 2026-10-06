"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { backendApiUrl } from "@/lib/client";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type InterviewReport = {
  _id: string; candidateId: { name?: string; email?: string; role?: string; resumeData?: unknown; skills?: string[]; projectSubmission?: { url?: string; aiVerificationStatus?: string; aiVerificationResult?: { verificationStatus?: string; summary?: string; detailedAnalysis?: { verifiedFeatures?: string[]; requirementsAssessment?: Array<{ description: string; status: string }> } } } } | string;
  projectId?: { title?: string; requirements?: string[]; technologies?: string[] } | string; scheduledAt: string; status: string; meetLink?: string; analysisError?: string;
  questions: Array<{ question: string; category: string; difficulty: string }>;
  transcript: Array<{ speaker: string; text: string; timestamp: string; section?: string }>;
  analysis?: { technicalKnowledge: { score: number; summary: string }; projectUnderstanding: { score: number; summary: string }; problemSolving: { score: number; summary: string }; communication: { score: number; summary: string }; projectWalkthrough: { score: number; summary: string }; strengths: string[]; areasForImprovement: string[]; evidence?: string[]; overallScore: number; recommendation: string; summary: string; source?: string };
  adminDecision?: { status: string; notes?: string };
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(backendApiUrl(`/api/ai-interviews${path}`), { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`);
  return body;
}

export default function InterviewReportPage() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const router = useRouter();
  const [interview, setInterview] = useState<InterviewReport | null>(null);
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const data = await request<{ interview: InterviewReport }>(`/${interviewId}/report`); setInterview(data.interview); setNotes(data.interview.adminDecision?.notes || ""); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Unable to load report."); }
  }, [interviewId]);
  useEffect(() => { void load(); }, [load]);

  const retryAnalysis = async () => {
    setBusy(true); setNotice("");
    try { const data = await request<{ interview: InterviewReport }>(`/${interviewId}/retry-analysis`, { method: "POST" }); setInterview(data.interview); setNotice("Analysis retry completed."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Analysis retry failed."); }
    finally { setBusy(false); }
  };

  const decide = async (status: "selected" | "rejected" | "another_interview") => {
    setBusy(true); setNotice("");
    try { const data = await request<{ interview: InterviewReport }>(`/${interviewId}/admin-decision`, { method: "POST", body: JSON.stringify({ status, notes }) }); setInterview(data.interview); setNotice("Admin decision saved."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save decision."); }
    finally { setBusy(false); }
  };
  const candidate = typeof interview?.candidateId === "object" ? interview.candidateId : null;
  const project = typeof interview?.projectId === "object" ? interview.projectId : null;
  const analysis = interview?.analysis;
  const submission = candidate?.projectSubmission;
  const verification = submission?.aiVerificationResult;

  return <div className="mx-auto max-w-5xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><button className="text-sm text-indigo-700 hover:underline" onClick={() => router.push("/admin/interviews")}>← Interviews</button><h1 className="mt-2 text-2xl font-semibold">Interview report</h1></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{interview?.status || "Loading"}</span></div>
    {notice && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{notice}</p>}
    {interview && <>
      <Card><CardHeader title={candidate?.name || "Candidate"} subtitle={`${candidate?.email || ""} · ${candidate?.role || ""}`}/><CardContent className="grid gap-3 text-sm sm:grid-cols-3"><p><b>Project:</b> {project?.title || "—"}</p><p><b>Interview date:</b> {new Date(interview.scheduledAt).toLocaleString()}</p><p><b>Status:</b> {interview.status}</p>{interview.meetLink && <p className="sm:col-span-3"><b>Google Meet:</b> <a className="underline" href={interview.meetLink} target="_blank" rel="noreferrer">{interview.meetLink}</a> (scheduled meeting link; AI interview runs in the separate interview room.)</p>}</CardContent></Card>
      <Card><CardHeader title="Candidate and project evidence"/><CardContent className="space-y-3 text-sm"><p><b>Resume skills:</b> {candidate?.skills?.join(", ") || "Not available"}</p><p><b>Repository:</b> {submission?.url ? <a className="underline" href={submission.url} target="_blank" rel="noreferrer">{submission.url}</a> : "Not provided"}</p><p><b>Verification:</b> {verification?.verificationStatus || submission?.aiVerificationStatus || "Not available"}</p><p><b>Verification summary:</b> {verification?.summary || verification?.detailedAnalysis?.overallAssessment || "Not available"}</p><p><b>Verified features:</b> {verification?.detailedAnalysis?.verifiedFeatures?.join(", ") || "Not listed"}</p><p><b>Project technologies:</b> {project?.technologies?.join(", ") || "Not listed"}</p></CardContent></Card>
      {!analysis ? <Card><CardContent className="p-5 text-sm text-slate-600">Analysis is {interview.status === "ANALYSIS_PENDING" || interview.status === "COMPLETING" ? "in progress" : "not available"}. The transcript remains available for manual review.{interview.analysisError && <><p className="mt-2 text-amber-800">{interview.analysisError}</p><Button className="mt-3" loading={busy} onClick={() => void retryAnalysis()}>Retry analysis</Button></>}</CardContent></Card> : <>
        <Card><CardHeader title={`Overall score: ${analysis.overallScore}/100`} subtitle={`Advisory recommendation: ${analysis.recommendation} · ${analysis.source === "fallback" ? "Automatic analysis unavailable; manual review required" : "AI-generated report for admin review"}`}/><CardContent className="grid gap-3 sm:grid-cols-2">{([["Technical knowledge", analysis.technicalKnowledge], ["Project understanding", analysis.projectUnderstanding], ["Problem solving", analysis.problemSolving], ["Communication", analysis.communication], ["Project walkthrough", analysis.projectWalkthrough]] as const).map(([label, block]) => <div key={label} className="rounded-xl border p-4"><div className="flex justify-between gap-2"><b>{label}</b><span>{block.score}/100</span></div><p className="mt-2 text-sm text-slate-600">{block.summary}</p></div>)}</CardContent></Card>
        <Card><CardHeader title="Summary"/><CardContent><p className="text-sm leading-6 text-slate-700">{analysis.summary}</p><div className="mt-5 grid gap-5 sm:grid-cols-2"><div><h3 className="font-semibold">Strengths</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{analysis.strengths.map((item, i) => <li key={i}>{item}</li>)}</ul></div><div><h3 className="font-semibold">Areas for improvement</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{analysis.areasForImprovement.map((item, i) => <li key={i}>{item}</li>)}</ul></div></div>{analysis.evidence?.length ? <div className="mt-5"><h3 className="font-semibold">Transcript evidence</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{analysis.evidence.map((item, i) => <li key={i}>{item}</li>)}</ul></div> : null}</CardContent></Card>
      </>}
      <Card><CardHeader title="Transcript" subtitle="Google Meet media is not captured. This is the candidate's submitted answer text (including speech recognized through configured audio transcription)."/><CardContent className="max-h-96 space-y-3 overflow-y-auto">{interview.transcript.map((turn, i) => <div key={i} className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{turn.speaker} · {turn.section || "QUESTIONING"}</p><p className="mt-1 whitespace-pre-wrap text-sm">{turn.text}</p></div>)}</CardContent></Card>
      <Card><CardHeader title="Final admin decision" subtitle="The AI recommendation does not make or trigger this decision."/><CardContent className="space-y-4"><label className="block text-sm font-medium">Decision notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={3} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm"/></label><div className="flex flex-wrap gap-2"><Button loading={busy} onClick={() => void decide("selected")}>Hire</Button><Button variant="outline" loading={busy} onClick={() => void decide("rejected")}>Reject</Button><Button variant="outline" loading={busy} onClick={() => void decide("another_interview")}>Request another interview</Button></div><p className="text-xs text-slate-500">Current decision: {interview.adminDecision?.status || "pending"}</p></CardContent></Card>
    </>}
  </div>;
}
