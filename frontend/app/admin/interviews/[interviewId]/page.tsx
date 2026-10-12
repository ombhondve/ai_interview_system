"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Video,
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  FileText,
  User,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { apiUrl } from "@/lib/client";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface InterviewReport {
  _id: string;
  candidateId: {
    name?: string;
    email?: string;
    role?: string;
    resumeData?: unknown;
    skills?: string[];
    projectSubmission?: {
      url?: string;
      aiVerificationStatus?: string;
      aiVerificationResult?: {
        verificationStatus?: string;
        summary?: string;
        detailedAnalysis?: {
          overallAssessment?: string;
          verifiedFeatures?: string[];
          requirementsAssessment?: Array<{ description: string; status: string }>;
        };
      };
    };
  } | string;
  projectId?: {
    title?: string;
    requirements?: string[];
    technologies?: string[];
  } | string;
  scheduledAt: string;
  status: string;
  meetLink?: string;
  analysisError?: string;
  questions: Array<{ question: string; category: string; difficulty: string }>;
  transcript: Array<{ speaker: string; text: string; timestamp: string; section?: string }>;
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
    recommendation: string;
    summary: string;
    source?: string;
  };
  adminDecision?: { status: string; notes?: string };
}

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

export default function InterviewReportPage() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const router = useRouter();
  const [interview, setInterview] = useState<InterviewReport | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await request<{ interview: InterviewReport }>(`/${interviewId}/report`);
      setInterview(data.interview);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load report.");
    }
  }, [interviewId]);

  useEffect(() => {
    void load();
  }, [load]);

  const retryAnalysis = async () => {
    setBusy(true);
    setNotice("");
    try {
      const data = await request<{ interview: InterviewReport }>(`/${interviewId}/retry-analysis`, {
        method: "POST",
      });
      setInterview(data.interview);
      setNotice("Analysis retry completed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Analysis retry failed.");
    } finally {
      setBusy(false);
    }
  };

  const candidate = typeof interview?.candidateId === "object" ? interview.candidateId : null;
  const project = typeof interview?.projectId === "object" ? interview.projectId : null;
  const analysis = interview?.analysis;
  const submission = candidate?.projectSubmission;
  const verification = submission?.aiVerificationResult;

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#E2E8F0] pb-4">
        <div>
          <button
            onClick={() => router.push("/admin/interviews")}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#1976D2] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Interviews
          </button>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-[#111F33]">
            Interview Evaluation & Report
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {interview && (
            <Badge
              variant={
                interview.status === "COMPLETED" || interview.status === "ANALYZED"
                  ? "success"
                  : "warning"
              }
              dot
            >
              {interview.status.replace("_", " ").toUpperCase()}
            </Badge>
          )}
        </div>
      </div>

      {notice && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {notice}
        </div>
      )}

      {interview ? (
        <div className="space-y-6">
          {/* Candidate & Session Info Card */}
          <Card>
            <CardHeader
              title={candidate?.name || "Candidate"}
              subtitle={`${candidate?.email || "No email"} · ${candidate?.role || "Engineering Candidate"}`}
              action={
                analysis?.overallScore !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-semibold text-[#64748B]">
                      Overall Score:
                    </span>
                    <span className="rounded-md bg-blue-50 border border-blue-200/60 px-3 py-1 text-sm font-bold text-[#1976D2]">
                      {analysis.overallScore}/100
                    </span>
                  </div>
                )
              }
            />
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
                <div>
                  <span className="font-semibold text-[#64748B] uppercase tracking-wider block">
                    Project
                  </span>
                  <span className="mt-1 block font-medium text-[#111F33]">
                    {project?.title || "Assigned Project"}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-[#64748B] uppercase tracking-wider block">
                    Interview Scheduled
                  </span>
                  <span className="mt-1 block font-medium text-[#111F33]">
                    {new Date(interview.scheduledAt).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-[#64748B] uppercase tracking-wider block">
                    Status
                  </span>
                  <span className="mt-1 block font-medium text-[#111F33]">
                    {interview.status.replace("_", " ")}
                  </span>
                </div>

                {interview.meetLink && (
                  <div className="sm:col-span-3 pt-2 border-t border-[#E2E8F0]">
                    <span className="font-semibold text-[#64748B] uppercase tracking-wider block">
                      Google Meet Conference
                    </span>
                    <a
                      href={interview.meetLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 font-medium text-[#1976D2] hover:underline"
                    >
                      {interview.meetLink}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Candidate & Project Evidence */}
          <Card>
            <CardHeader
              title="Repository & Project Verification Evidence"
              subtitle="Data collected during candidate submission and automated GitHub analysis."
            />
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-xs">
                <div>
                  <dt className="font-semibold text-[#64748B] uppercase tracking-wider">
                    Resume Skills
                  </dt>
                  <dd className="mt-0.5 font-medium text-[#111F33]">
                    {candidate?.skills?.join(", ") || "None extracted"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#64748B] uppercase tracking-wider">
                    Submitted Repository
                  </dt>
                  <dd className="mt-0.5 font-medium text-[#111F33]">
                    {submission?.url ? (
                      <a
                        href={submission.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#1976D2] hover:underline inline-flex items-center gap-1"
                      >
                        {submission.url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      "Not provided"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#64748B] uppercase tracking-wider">
                    Verification Outcome
                  </dt>
                  <dd className="mt-0.5 font-medium text-[#111F33]">
                    {verification?.verificationStatus ||
                      submission?.aiVerificationStatus ||
                      "Pending analysis"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#64748B] uppercase tracking-wider">
                    Project Technologies
                  </dt>
                  <dd className="mt-0.5 font-medium text-[#111F33]">
                    {project?.technologies?.join(", ") || "Standard stack"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* AI Analysis & Rubrics */}
          {!analysis ? (
            <Card>
              <CardContent className="p-6 text-xs text-[#64748B]">
                <p>
                  AI analysis is{" "}
                  {interview.status === "ANALYSIS_PENDING" || interview.status === "COMPLETING"
                    ? "in progress. Please refresh shortly."
                    : "pending or not yet generated."}
                </p>
                {interview.analysisError && (
                  <div className="mt-3 rounded-md bg-amber-50 p-3 text-amber-900 border border-amber-200">
                    <p className="font-medium">{interview.analysisError}</p>
                    <Button
                      size="sm"
                      className="mt-3 text-xs"
                      loading={busy}
                      onClick={() => void retryAnalysis()}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry Analysis
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Detailed Rubric Breakdown */}
              <Card>
                <CardHeader
                  title="Multi-Criteria Technical Assessment"
                  subtitle={`Advisory recommendation: ${analysis.recommendation} · Evaluated by RecruitAI Llama-3 Engine`}
                />
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {[
                      ["Technical Knowledge", analysis.technicalKnowledge],
                      ["Project Understanding", analysis.projectUnderstanding],
                      ["Problem Solving", analysis.problemSolving],
                      ["Communication", analysis.communication],
                      ["Project Walkthrough", analysis.projectWalkthrough],
                    ].map(([label, block]: any) => (
                      <div
                        key={label}
                        className="rounded-lg border border-[#E2E8F0] p-4 bg-white"
                      >
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="font-semibold text-[#111F33]">{label}</span>
                          <span className="font-bold text-[#1976D2]">{block.score}/100</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#E2E8F0] rounded-full overflow-hidden mb-2">
                          <div
                            className="h-full bg-[#1976D2] rounded-full"
                            style={{ width: `${block.score}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-[#64748B] leading-relaxed">
                          {block.summary}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Summary & Strengths */}
                  <div className="pt-4 border-t border-[#E2E8F0]">
                    <h3 className="text-xs font-semibold text-[#111F33] uppercase tracking-wider mb-2">
                      Executive Summary
                    </h3>
                    <p className="text-xs text-[#111F33] leading-relaxed">
                      {analysis.summary}
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-md border border-emerald-200/60 bg-emerald-50/50 p-3.5">
                        <h4 className="text-xs font-semibold text-[#16A34A] flex items-center gap-1.5 mb-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Key Strengths
                        </h4>
                        <ul className="list-disc pl-4 space-y-1 text-xs text-[#111F33]">
                          {analysis.strengths.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-md border border-amber-200/60 bg-amber-50/50 p-3.5">
                        <h4 className="text-xs font-semibold text-[#D97706] flex items-center gap-1.5 mb-2">
                          <AlertTriangle className="h-4 w-4" />
                          Areas for Improvement
                        </h4>
                        <ul className="list-disc pl-4 space-y-1 text-xs text-[#111F33]">
                          {analysis.areasForImprovement.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Transcript Log */}
          <Card>
            <CardHeader
              title="Interview Dialogue Transcript"
              subtitle="Candidate verbal and text responses transcribed via Deepgram STT."
            />
            <CardContent>
              <div className="max-h-96 space-y-3 overflow-y-auto pr-2">
                {interview.transcript.length === 0 ? (
                  <p className="text-xs text-[#64748B]">No transcript lines recorded.</p>
                ) : (
                  interview.transcript.map((turn, i) => (
                    <div
                      key={i}
                      className={`rounded-md border p-3 text-xs ${
                        turn.speaker === "ai" || turn.speaker.toLowerCase().includes("ai")
                          ? "bg-blue-50/40 border-blue-200/60"
                          : "bg-white border-[#E2E8F0]"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748B] mb-1">
                        <span className={turn.speaker === "ai" ? "text-[#1976D2]" : "text-[#111F33]"}>
                          {turn.speaker.toUpperCase()}
                        </span>
                        <span className="text-slate-400">
                          {turn.section || "QUESTIONING"}
                        </span>
                      </div>
                      <p className="text-xs text-[#111F33] leading-relaxed whitespace-pre-wrap">
                        {turn.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <div className="p-12 text-center text-xs text-[#64748B]">
            Loading interview details…
          </div>
        </Card>
      )}
    </div>
  );
}
