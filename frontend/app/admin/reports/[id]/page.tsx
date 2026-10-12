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
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadReport = useCallback(async () => {
    if (!interviewId) return;
    try {
      setLoading(true);
      const data = await request<{ interview: InterviewReport }>(`/${interviewId}/report`);
      setInterview(data.interview);
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

  if (loading) {
    return (
      <main className="min-h-screen p-6 sm:p-8 bg-[#F5F7FA]">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-32 animate-pulse rounded-lg border border-[#E2E8F0] bg-white" />
          <div className="h-64 animate-pulse rounded-lg border border-[#E2E8F0] bg-white" />
        </div>
      </main>
    );
  }

  if (!interview) {
    return (
      <main className="min-h-screen p-6 sm:p-8 bg-[#F5F7FA]">
        <div className="mx-auto max-w-md rounded-lg border border-[#E2E8F0] bg-white p-8 text-center shadow-xs">
          <AlertCircle className="mx-auto text-[#DC2626]" size={36} />
          <h2 className="mt-4 text-lg font-semibold text-[#111F33]">Report Not Found</h2>
          <p className="mt-1 text-sm text-[#64748B]">
            {notice?.text || "The requested interview report does not exist."}
          </p>
          <button
            onClick={() => router.push("/admin/reports")}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#1976D2] px-4 py-2 text-xs font-medium text-white hover:bg-[#1565C0] transition-colors"
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

  return (
    <main className="min-h-screen bg-[#F5F7FA] pb-16">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Top Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/reports"
              className="inline-flex items-center gap-1 text-sm text-[#64748B] hover:text-[#1976D2] transition-colors"
            >
              <ArrowLeft size={16} /> Reports
            </Link>
            <span className="text-[#E2E8F0]">/</span>
            <span className="text-sm font-medium text-[#111F33]">
              {candidate?.name || "Candidate Report"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadReport()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748B] hover:bg-[#F5F7FA] transition-colors"
            >
              <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> Refresh
            </button>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                analysis
                  ? "bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/30"
                  : "bg-[#F5F7FA] text-[#64748B] border border-[#E2E8F0]"
              }`}
            >
              {analysis ? "AI Evaluation Complete" : (interview.status.replace("_", " ").toUpperCase() || "PENDING")}
            </span>
          </div>
        </div>

        {notice && (
          <div
            className={`rounded-lg border p-4 text-sm ${
              notice.type === "success"
                ? "border-[#16A34A]/30 bg-[#16A34A]/10 text-[#16A34A]"
                : "border-[#DC2626]/30 bg-[#DC2626]/10 text-[#DC2626]"
            }`}
          >
            {notice.text}
          </div>
        )}

        {/* 1. CANDIDATE INFORMATION & INTERVIEW SUMMARY */}
        <section className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-xs">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#111F33] text-base font-bold text-white shadow-xs">
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
                  <h1 className="text-xl font-bold text-[#111F33]">
                    {candidate?.name || "Unknown Candidate"}
                  </h1>
                  <p className="text-sm text-[#64748B]">
                    {candidate?.email} · {candidate?.role || "Developer"}
                  </p>
                </div>
              </div>
            </div>

            {analysis && (
              <div className="flex items-center gap-4 rounded-lg border border-[#E2E8F0] bg-[#F5F7FA] p-4">
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#1976D2]">
                    AI Evaluation Score
                  </p>
                  <p className="text-3xl font-extrabold text-[#111F33]">
                    {analysis.overallScore}
                    <span className="text-sm font-normal text-[#64748B]">/100</span>
                  </p>
                </div>
                <div className="h-10 w-[1px] bg-[#E2E8F0]" />
                <div>
                  <p className="text-xs text-[#64748B]">AI Recommendation</p>
                  <span
                    className={`inline-block mt-0.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      analysis.recommendation === "STRONG"
                        ? "bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/30"
                        : analysis.recommendation === "WEAK"
                        ? "bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/30"
                        : "bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/30"
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

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#E2E8F0] pt-4 text-xs sm:grid-cols-4">
            <div>
              <span className="text-[#64748B]">Candidate ID</span>
              <p className="mt-0.5 font-medium text-[#111F33] font-mono">
                {candidate?._id || "—"}
              </p>
            </div>
            <div>
              <span className="text-[#64748B]">Interview ID</span>
              <p className="mt-0.5 font-medium text-[#111F33] font-mono">
                {interview._id}
              </p>
            </div>
            <div>
              <span className="text-[#64748B]">Interview Date</span>
              <p className="mt-0.5 font-medium text-[#111F33]">
                {interview.scheduledAt ? new Date(interview.scheduledAt).toLocaleString() : "—"}
              </p>
            </div>
            <div>
              <span className="text-[#64748B]">Interview Duration</span>
              <p className="mt-0.5 font-medium text-[#111F33]">
                {durationText}
              </p>
            </div>
          </div>
        </section>

        {/* 2. PROJECT OVERVIEW & CANDIDATE INTRODUCTION */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#111F33]">
              <Briefcase size={16} className="text-[#1976D2]" />
              Assigned Project & Tech Stack
            </div>
            <p className="text-base font-semibold text-[#111F33]">
              {project?.title || "Assigned Project"}
            </p>
            <div className="text-xs space-y-1.5 text-[#64748B]">
              <p>
                <b className="text-[#111F33]">Technologies Claimed / Stack:</b>{" "}
                {project?.technologies?.length ? project.technologies.join(", ") : "Not listed"}
              </p>
              <p>
                <b className="text-[#111F33]">Repository URL:</b>{" "}
                {submission?.url ? (
                  <a
                    href={submission.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#1976D2] underline hover:text-[#1565C0]"
                  >
                    {submission.url}
                  </a>
                ) : (
                  "Not submitted"
                )}
              </p>
              <p>
                <b className="text-[#111F33]">Verification Status:</b>{" "}
                <span className="font-semibold text-[#111F33]">
                  {verification?.verificationStatus || submission?.aiVerificationStatus || "Unverified"}
                </span>
              </p>
              {verification?.summary && (
                <p className="mt-1 rounded-md bg-[#F5F7FA] border border-[#E2E8F0] p-2 text-[#64748B]">
                  {verification.summary}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#111F33]">
              <User size={16} className="text-[#1976D2]" />
              Candidate Introduction & Background
            </div>
            {candidateIntroTurn ? (
              <div className="rounded-md bg-[#F5F7FA] border border-[#E2E8F0] p-3 text-xs text-[#111F33] leading-relaxed">
                <span className="font-semibold text-[#111F33]">Candidate: </span>
                {candidateIntroTurn.text}
              </div>
            ) : (
              <p className="text-xs italic text-[#64748B]">
                Candidate self-introduction recorded during early turns.
              </p>
            )}

            <div className="pt-2 border-t border-[#E2E8F0] text-xs text-[#64748B]">
              <b className="text-[#111F33]">Resume Skills:</b> {candidate?.skills?.join(", ") || "Not provided"}
            </div>
          </div>
        </section>

        {/* 3. FOUR CORE EVALUATION SCORES */}
        {analysis ? (
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-[#111F33]">
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
            <div className="rounded-lg border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#1976D2]">
                AI Executive Summary
              </h3>
              <p className="text-sm leading-relaxed text-[#64748B]">
                {analysis.summary || "No executive summary provided."}
              </p>
            </div>
          </section>
        ) : (
          <section className="rounded-lg border border-[#E2E8F0] bg-white p-8 text-center shadow-xs">
            <HelpCircle className="mx-auto text-[#D97706]" size={36} />
            <h3 className="mt-3 text-base font-semibold text-[#111F33]">
              {interview.status === "ANALYSIS_PENDING" || interview.status === "COMPLETING"
                ? "AI Report Generation in Progress"
                : "AI Evaluation Not Yet Generated"}
            </h3>
            <p className="mt-1 text-xs text-[#64748B] max-w-md mx-auto">
              {interview.analysisError
                ? `Error: ${interview.analysisError}`
                : "The interview transcript is ready. Click below to generate the structured AI evaluation and report."}
            </p>
            <button
              onClick={() => void handleRetryAnalysis()}
              disabled={busy}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1976D2] px-4 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-[#1565C0] disabled:opacity-50"
            >
              <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
              Generate / Retry AI Report
            </button>
          </section>
        )}

        {/* 4. STRENGTHS, WEAKNESSES, KNOWLEDGE GAPS & PROJECT OWNERSHIP */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Strengths & Demonstrated Areas */}
          <div className="rounded-lg border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#16A34A]">
              <TrendingUp size={18} />
              Demonstrated Strengths
            </div>
            {analysis?.strengths?.length ? (
              <ul className="space-y-2 text-xs text-[#64748B]">
                {analysis.strengths.map((str, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle size={14} className="mt-0.5 shrink-0 text-[#16A34A]" />
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            ) : interview.candidateStrengths?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {interview.candidateStrengths.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-[#16A34A]/10 border border-[#16A34A]/20 px-2.5 py-1 text-xs font-medium text-[#16A34A]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-[#64748B]">Not sufficiently demonstrated</p>
            )}

            <div className="border-t border-[#E2E8F0] pt-3">
              <span className="text-xs font-semibold text-[#111F33]">
                Technical Areas Demonstrated:
              </span>
              <p className="mt-1 text-xs text-[#64748B]">
                {interview.technicalAreas?.length
                  ? interview.technicalAreas.join(", ")
                  : "Not sufficiently demonstrated"}
              </p>
            </div>
          </div>

          {/* Weaknesses & Knowledge Gaps */}
          <div className="rounded-lg border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#D97706]">
              <TrendingDown size={18} />
              Weaknesses & Knowledge Gaps
            </div>
            {analysis?.areasForImprovement?.length ? (
              <ul className="space-y-2 text-xs text-[#64748B]">
                {analysis.areasForImprovement.map((area, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <XCircle size={14} className="mt-0.5 shrink-0 text-[#D97706]" />
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            ) : interview.candidateWeaknesses?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {interview.candidateWeaknesses.map((w, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-[#D97706]/10 border border-[#D97706]/20 px-2.5 py-1 text-xs font-medium text-[#D97706]"
                  >
                    {w}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-[#64748B]">Not sufficiently demonstrated</p>
            )}

            <div className="border-t border-[#E2E8F0] pt-3">
              <span className="text-xs font-semibold text-[#111F33]">
                Identified Knowledge Gaps:
              </span>
              <p className="mt-1 text-xs text-[#64748B]">
                {interview.knowledgeGaps?.length
                  ? interview.knowledgeGaps.join(", ")
                  : "None noted during questioning"}
              </p>
            </div>
          </div>
        </section>

        {/* 5. INTERVIEW RECORDING (CLOUDINARY) */}
        <section className="rounded-lg border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#111F33]">
              <Volume2 size={17} className="text-[#1976D2]" />
              Master Interview Audio Recording
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                interview.recordingStatus === "UPLOADED"
                  ? "bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/30"
                  : interview.recordingStatus === "UPLOAD_FAILED"
                  ? "bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/30"
                  : "bg-[#F5F7FA] text-[#64748B] border border-[#E2E8F0]"
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
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F5F7FA] p-4 space-y-2">
              <audio controls src={interview.recordingUrl} className="w-full h-10" />
              <div className="flex justify-between items-center text-xs text-[#64748B]">
                <span>Duration: {Math.round(interview.recordingDuration || 0)}s</span>
                <a
                  href={interview.recordingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#1976D2] hover:underline"
                >
                  Open Audio in New Tab ↗
                </a>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#64748B]">
              {interview.recordingError
                ? `Recording error: ${interview.recordingError}`
                : "No cloud recording uploaded. Master audio file preserved locally or recording was disabled."}
            </p>
          )}
        </section>

        {/* 6. FULL INTERVIEW TRANSCRIPT */}
        <section className="rounded-lg border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#111F33]">
              <MessageSquare size={17} className="text-[#1976D2]" />
              Complete Synchronized Interview Transcript ({interview.transcript.length} Turns)
            </div>
          </div>

          <div className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
            {interview.transcript.length === 0 ? (
              <p className="p-4 text-center text-xs text-[#64748B]">
                No transcript turns recorded for this interview session.
              </p>
            ) : (
              interview.transcript.map((turn, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-3 text-xs leading-relaxed ${
                    turn.speaker === "AI"
                      ? "border border-[#1976D2]/20 bg-[#1976D2]/5 text-[#111F33]"
                      : turn.speaker === "CANDIDATE"
                      ? "border border-[#E2E8F0] bg-white text-[#111F33]"
                      : "bg-[#F5F7FA] text-[#64748B] border border-[#E2E8F0]"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span
                      className={
                        turn.speaker === "AI"
                          ? "text-[#1976D2]"
                          : "text-[#16A34A]"
                      }
                    >
                      {turn.speaker === "AI" ? "AI Interviewer" : candidate?.name || "Candidate"}
                    </span>
                    <span className="text-[10px] text-[#64748B] font-normal">
                      {turn.section || "QUESTIONING"} · {new Date(turn.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{turn.text}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ScoreCard({ title, score, summary }: { title: string; score: number; summary: string }) {
  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#64748B]">{title}</span>
          <span
            className={`text-lg font-bold ${
              score >= 80
                ? "text-[#16A34A]"
                : score >= 60
                ? "text-[#D97706]"
                : "text-[#DC2626]"
            }`}
          >
            {score}/100
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#64748B] line-clamp-4">
          {summary || "No specific feedback generated for this category."}
        </p>
      </div>
    </div>
  );
}
