"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/client";
import {
  FileText,
  User,
  Calendar,
  Clock,
  Briefcase,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Award,
  BookOpen,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  Play,
  Volume2,
} from "lucide-react";

type InterviewReport = {
  _id: string;
  status: string;
  phase?: string;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  durationMinutes?: number;
  meetLink?: string;
  analysisError?: string;
  candidateId: {
    _id: string;
    name: string;
    email: string;
    role?: string;
    skills?: string[];
    projectSubmission?: {
      url?: string;
      aiVerificationStatus?: string;
      aiVerificationResult?: {
        verificationStatus?: string;
        summary?: string;
        verifiedFeatures?: string[];
        missingRequirements?: string[];
      };
    };
  } | null;
  projectId: {
    _id: string;
    title: string;
    role?: string;
    technologies?: string[];
    requirements?: string[];
  } | null;
  questions: Array<{
    questionId: string;
    category: string;
    question: string;
    difficulty: string;
    reason?: string;
  }>;
  transcript: Array<{
    sequence: number;
    speaker: "AI" | "CANDIDATE" | "SYSTEM";
    text: string;
    timestamp: string;
    section?: string;
    questionId?: string;
    category?: string;
    answerQuality?: string;
  }>;
  candidateStrengths?: string[];
  candidateWeaknesses?: string[];
  technicalAreas?: string[];
  knowledgeGaps?: string[];
  projectOwnershipAssessment?: string;
  recordingStatus?: string;
  recordingUrl?: string;
  recordingPublicId?: string;
  recordingDuration?: number;
  recordingError?: string;
  analysis?: {
    technicalKnowledge: { score: number; summary: string };
    projectUnderstanding: { score: number; summary: string };
    problemSolving: { score: number; summary: string };
    communication: { score: number; summary: string };
    projectWalkthrough: { score: number; summary: string };
    strengths: string[];
    areasForImprovement: string[];
    evidence?: string[];
    overallScore: number;
    recommendation: "STRONG" | "ADMIN_REVIEW" | "WEAK" | string;
    summary: string;
    analyzedAt?: string;
    source?: string;
  } | null;
  adminDecision?: {
    status: "pending" | "selected" | "rejected" | "another_interview";
    notes?: string;
    decidedBy?: string;
    decidedAt?: string;
  } | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(`/api/ai-interviews${path}`), {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`);
  return body;
}

export default function AdminReportDetailPage() {
  const params = useParams<{ id?: string; interviewId?: string }>();
  const interviewId = params.id || params.interviewId;
  const router = useRouter();

  const [interview, setInterview] = useState<InterviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadReport = useCallback(async () => {
    if (!interviewId) return;
    try {
      setLoading(true);
      const data = await request<{ interview: InterviewReport }>(`/${interviewId}/report`);
      setInterview(data.interview);
      setNotes(data.interview.adminDecision?.notes || "");
    } catch (err: unknown) {
      setNotice({
        text: err instanceof Error ? err.message : "Unable to load interview report.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const handleRetryAnalysis = async () => {
    if (!interviewId) return;
    setBusy(true);
    setNotice(null);
    try {
      const data = await request<{ interview: InterviewReport }>(`/${interviewId}/retry-analysis`, {
        method: "POST",
      });
      setInterview(data.interview);
      setNotice({ text: "AI report generated successfully.", type: "success" });
    } catch (err: unknown) {
      setNotice({
        text: err instanceof Error ? err.message : "Analysis generation failed.",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAdminDecision = async (status: "selected" | "rejected" | "another_interview") => {
    if (!interviewId) return;
    setBusy(true);
    setNotice(null);
    try {
      const data = await request<{ interview: InterviewReport }>(`/${interviewId}/admin-decision`, {
        method: "POST",
        body: JSON.stringify({ status, notes }),
      });
      setInterview(data.interview);
      setNotice({
        text: `Admin decision saved: ${status.toUpperCase().replace("_", " ")}`,
        type: "success",
      });
    } catch (err: unknown) {
      setNotice({
        text: err instanceof Error ? err.message : "Unable to persist decision.",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen p-6 sm:p-8">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-6 w-32 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
          <div className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />
        </div>
      </main>
    );
  }

  if (!interview) {
    return (
      <main className="min-h-screen p-6 sm:p-8">
        <div className="mx-auto max-w-md rounded-2xl border p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto text-red-500" size={36} />
          <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Report Not Found</h2>
          <p className="mt-1 text-sm text-slate-500">
            {notice?.text || "The requested interview report does not exist."}
          </p>
          <button
            onClick={() => router.push("/admin/reports")}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <ArrowLeft size={14} /> Back to Reports
          </button>
        </div>
      </main>
    );
  }

  const candidate = interview.candidateId;
  const project = interview.projectId;
  const analysis = interview.analysis;
  const submission = candidate?.projectSubmission;
  const verification = submission?.aiVerificationResult;

  // Compute interview duration in minutes
  let durationText = `${interview.durationMinutes || 30} mins`;
  if (interview.startedAt && interview.endedAt) {
    const diffMs = new Date(interview.endedAt).getTime() - new Date(interview.startedAt).getTime();
    durationText = `${Math.round(diffMs / 60000)} mins`;
  }

  // Extract candidate introduction and project walkthrough answers from transcript
  const candidateIntroTurn = interview.transcript.find(
    (t) => t.speaker === "CANDIDATE" && (t.section === "OPENING" || t.section === "PRECHECK")
  );
  const projectUnderstandingTurn = interview.transcript.find(
    (t) => t.speaker === "CANDIDATE" && (t.section === "PROJECT_CONFIRMATION" || t.section === "PROJECT_UNDERSTANDING")
  );

  return (
    <main className="min-h-screen pb-16">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Top Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/reports"
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-400"
            >
              <ArrowLeft size={16} /> Reports
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {candidate?.name || "Candidate Report"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadReport()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> Refresh
            </button>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                interview.adminDecision?.status && interview.adminDecision.status !== "pending"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                  : analysis
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                  : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300"
              }`}
            >
              {interview.adminDecision?.status && interview.adminDecision.status !== "pending"
                ? `Decided: ${interview.adminDecision.status.toUpperCase()}`
                : analysis
                ? "Awaiting Admin Decision"
                : interview.status}
            </span>
          </div>
        </div>

        {notice && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
            }`}
          >
            {notice.text}
          </div>
        )}

        {/* 1. CANDIDATE INFORMATION & INTERVIEW SUMMARY */}
        <section className="surface rounded-2xl border p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-bold text-white shadow-sm">
                  {candidate?.name
                    ? candidate.name
                        .split(/\s+/)
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()
                    : "NA"}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                    {candidate?.name || "Unknown Candidate"}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {candidate?.email} · {candidate?.role || "Developer"}
                  </p>
                </div>
              </div>
            </div>

            {analysis && (
              <div className="flex items-center gap-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-500/10 dark:bg-indigo-500/5">
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                    AI Evaluation Score
                  </p>
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {analysis.overallScore}
                    <span className="text-sm font-normal text-slate-500">/100</span>
                  </p>
                </div>
                <div className="h-10 w-[1px] bg-indigo-200 dark:bg-white/10" />
                <div>
                  <p className="text-xs text-slate-500">AI Recommendation</p>
                  <span
                    className={`inline-block mt-0.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      analysis.recommendation === "STRONG"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                        : analysis.recommendation === "WEAK"
                        ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                    }`}
                  >
                    {analysis.recommendation === "STRONG"
                      ? "Recommended"
                      : analysis.recommendation === "WEAK"
                      ? "Not Recommended"
                      : "Needs Review"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs sm:grid-cols-4 dark:border-white/5">
            <div>
              <span className="text-slate-400">Candidate ID</span>
              <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-300 font-mono">
                {candidate?._id || "—"}
              </p>
            </div>
            <div>
              <span className="text-slate-400">Interview ID</span>
              <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-300 font-mono">
                {interview._id}
              </p>
            </div>
            <div>
              <span className="text-slate-400">Interview Date</span>
              <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-300">
                {interview.scheduledAt ? new Date(interview.scheduledAt).toLocaleString() : "—"}
              </p>
            </div>
            <div>
              <span className="text-slate-400">Interview Duration</span>
              <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-300">
                {durationText}
              </p>
            </div>
          </div>
        </section>

        {/* 2. PROJECT OVERVIEW & CANDIDATE INTRODUCTION */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="surface rounded-2xl border p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
              <Briefcase size={16} className="text-indigo-600" />
              Assigned Project & Tech Stack
            </div>
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              {project?.title || "Assigned Project"}
            </p>
            <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-400">
              <p>
                <b>Technologies Claimed / Stack:</b>{" "}
                {project?.technologies?.length ? project.technologies.join(", ") : "Not listed"}
              </p>
              <p>
                <b>Repository URL:</b>{" "}
                {submission?.url ? (
                  <a
                    href={submission.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 underline"
                  >
                    {submission.url}
                  </a>
                ) : (
                  "Not submitted"
                )}
              </p>
              <p>
                <b>Verification Status:</b>{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {verification?.verificationStatus || submission?.aiVerificationStatus || "Unverified"}
                </span>
              </p>
              {verification?.summary && (
                <p className="mt-1 rounded-lg bg-slate-50 p-2 text-slate-600 dark:bg-white/[0.02]">
                  {verification.summary}
                </p>
              )}
            </div>
          </div>

          <div className="surface rounded-2xl border p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
              <User size={16} className="text-indigo-600" />
              Candidate Introduction & Background
            </div>
            {candidateIntroTurn ? (
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 leading-relaxed dark:bg-white/[0.02] dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">Candidate: </span>
                {candidateIntroTurn.text}
              </div>
            ) : (
              <p className="text-xs italic text-slate-400">
                Candidate self-introduction recorded during early turns.
              </p>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-white/5 text-xs text-slate-600 dark:text-slate-400">
              <b>Resume Skills:</b> {candidate?.skills?.join(", ") || "Not provided"}
            </div>
          </div>
        </section>

        {/* 3. FOUR CORE EVALUATION SCORES */}
        {analysis ? (
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Core Competency Scores & Assessments
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ScoreCard
                title="Technical Knowledge"
                score={analysis.technicalKnowledge.score}
                summary={analysis.technicalKnowledge.summary}
              />
              <ScoreCard
                title="Communication"
                score={analysis.communication.score}
                summary={analysis.communication.summary}
              />
              <ScoreCard
                title="Problem Solving"
                score={analysis.problemSolving.score}
                summary={analysis.problemSolving.summary}
              />
              <ScoreCard
                title="Project Understanding"
                score={analysis.projectUnderstanding.score}
                summary={analysis.projectUnderstanding.summary}
              />
            </div>

            {/* AI Executive Summary */}
            <div className="surface rounded-2xl border p-5 shadow-sm space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                AI Executive Summary
              </h3>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {analysis.summary || "No executive summary provided."}
              </p>
            </div>
          </section>
        ) : (
          <section className="surface rounded-2xl border p-8 text-center shadow-sm">
            <HelpCircle className="mx-auto text-amber-500" size={36} />
            <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
              {interview.status === "ANALYSIS_PENDING" || interview.status === "COMPLETING"
                ? "AI Report Generation in Progress"
                : "AI Evaluation Not Yet Generated"}
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
              {interview.analysisError
                ? `Error: ${interview.analysisError}`
                : "The interview transcript is ready. Click below to generate the structured AI evaluation and report."}
            </p>
            <button
              onClick={() => void handleRetryAnalysis()}
              disabled={busy}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
            >
              <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
              Generate / Retry AI Report
            </button>
          </section>
        )}

        {/* 4. STRENGTHS, WEAKNESSES, KNOWLEDGE GAPS & PROJECT OWNERSHIP */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Strengths & Demonstrated Areas */}
          <div className="surface rounded-2xl border p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <TrendingUp size={18} />
              Demonstrated Strengths
            </div>
            {analysis?.strengths?.length ? (
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                {analysis.strengths.map((str, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            ) : interview.candidateStrengths?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {interview.candidateStrengths.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                  >
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-slate-400">Not sufficiently demonstrated</p>
            )}

            <div className="border-t border-slate-100 pt-3 dark:border-white/5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Technical Areas Demonstrated:
              </span>
              <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                {interview.technicalAreas?.length
                  ? interview.technicalAreas.join(", ")
                  : "Not sufficiently demonstrated"}
              </p>
            </div>
          </div>

          {/* Weaknesses & Knowledge Gaps */}
          <div className="surface rounded-2xl border p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
              <TrendingDown size={18} />
              Weaknesses & Knowledge Gaps
            </div>
            {analysis?.areasForImprovement?.length ? (
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                {analysis.areasForImprovement.map((area, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <XCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            ) : interview.candidateWeaknesses?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {interview.candidateWeaknesses.map((w, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                  >
                    {w}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-slate-400">Not sufficiently demonstrated</p>
            )}

            <div className="border-t border-slate-100 pt-3 dark:border-white/5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Identified Knowledge Gaps:
              </span>
              <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                {interview.knowledgeGaps?.length
                  ? interview.knowledgeGaps.join(", ")
                  : "None noted during questioning"}
              </p>
            </div>
          </div>
        </section>

        {/* 5. INTERVIEW RECORDING (CLOUDINARY) */}
        <section className="surface rounded-2xl border p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
              <Volume2 size={17} className="text-indigo-600" />
              Master Interview Audio Recording
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                interview.recordingStatus === "UPLOADED"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                  : interview.recordingStatus === "UPLOAD_FAILED"
                  ? "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300"
                  : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300"
              }`}
            >
              {interview.recordingStatus === "UPLOADED"
                ? "Recording Available"
                : interview.recordingStatus === "UPLOAD_FAILED"
                ? "Upload Failed"
                : interview.recordingStatus || "Recording Not Found"}
            </span>
          </div>

          {interview.recordingUrl ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.02] space-y-2">
              <audio controls src={interview.recordingUrl} className="w-full h-10" />
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>Duration: {Math.round(interview.recordingDuration || 0)}s</span>
                <a
                  href={interview.recordingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  Open Audio in New Tab ↗
                </a>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              {interview.recordingError
                ? `Recording error: ${interview.recordingError}`
                : "No cloud recording uploaded. Master audio file preserved locally or recording was disabled."}
            </p>
          )}
        </section>

        {/* 6. FULL INTERVIEW TRANSCRIPT */}
        <section className="surface rounded-2xl border p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
              <MessageSquare size={17} className="text-indigo-600" />
              Complete Synchronized Interview Transcript ({interview.transcript.length} Turns)
            </div>
          </div>

          <div className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
            {interview.transcript.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">
                No transcript turns recorded for this interview session.
              </p>
            ) : (
              interview.transcript.map((turn, i) => (
                <div
                  key={i}
                  className={`rounded-xl p-3 text-xs leading-relaxed ${
                    turn.speaker === "AI"
                      ? "border border-indigo-100 bg-indigo-50/40 text-slate-800 dark:border-indigo-500/10 dark:bg-indigo-500/5 dark:text-slate-200"
                      : turn.speaker === "CANDIDATE"
                      ? "border border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100"
                      : "bg-slate-100 text-slate-500 dark:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span
                      className={
                        turn.speaker === "AI"
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-emerald-700 dark:text-emerald-400"
                      }
                    >
                      {turn.speaker === "AI" ? "AI Interviewer" : candidate?.name || "Candidate"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {turn.section || "QUESTIONING"} · {new Date(turn.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{turn.text}</p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 7. FINAL ADMIN DECISION (HUMAN DECISION ONLY) */}
        <section className="surface rounded-2xl border p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Final Admin Hiring Decision
              </h2>
              <p className="text-xs text-slate-500">
                The AI provides an advisory assessment. The final hiring decision is made by the Admin.
              </p>
            </div>
            {interview.adminDecision?.status && interview.adminDecision.status !== "pending" && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400">
                Current: {interview.adminDecision.status.toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Admin Decision Notes / Rationale
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add review feedback, justification, or interview follow-up notes..."
              rows={3}
              maxLength={2000}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-[#10141d]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => void handleAdminDecision("selected")}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle size={15} /> Select Candidate (Hire)
            </button>

            <button
              onClick={() => void handleAdminDecision("rejected")}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
            >
              <XCircle size={15} /> Reject Candidate
            </button>

            <button
              onClick={() => void handleAdminDecision("another_interview")}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              <Clock size={15} /> Hold / Request Another Interview
            </button>
          </div>

          {interview.adminDecision?.decidedAt && (
            <p className="text-[11px] text-slate-400">
              Decided on {new Date(interview.adminDecision.decidedAt).toLocaleString()}
              {interview.adminDecision.decidedBy ? ` by ${interview.adminDecision.decidedBy}` : ""}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function ScoreCard({ title, score, summary }: { title: string; score: number; summary: string }) {
  return (
    <div className="surface rounded-2xl border p-4 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">{title}</span>
          <span
            className={`text-lg font-bold ${
              score >= 80
                ? "text-emerald-600 dark:text-emerald-400"
                : score >= 60
                ? "text-amber-600 dark:text-amber-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {score}/100
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-4">
          {summary || "No specific feedback generated for this category."}
        </p>
      </div>
    </div>
  );
}
