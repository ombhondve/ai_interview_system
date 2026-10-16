"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/components/student/StudentShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { backendApiUrl } from "@/lib/client";

type Turn = { speaker: string; text: string; timestamp: string; questionId?: string; section?: string };
type BotJobInfo = {
  _id?: string;
  status: string;
  assignedWorkerId?: string | null;
  retryAfter?: string | null;
  failureReason?: string | null;
  needsAdminReview?: boolean;
};
type Session = {
  _id: string;
  status: string;
  scheduledAt: string;
  meetLink?: string;
  calendarEventId?: string;
  botJobId?: BotJobInfo | string | null;
  questions: Array<{ question: string; category: string; questionId?: string }>;
  transcript: Turn[];
  currentQuestionIndex: number;
  startedAt?: string;
  analysisError?: string;
};

function getStatusBadge(session: Session) {
  const isFinished = ["COMPLETING", "COMPLETED", "ANALYSIS_PENDING", "ANALYZED"].includes(session.status);
  if (isFinished) {
    return { text: "Completed", subtext: "Concluded", colorClass: "text-[#1B4332]" };
  }
  if (session.status === "FAILED") {
    return { text: "Session Interrupted", subtext: "Your interview was interrupted due to a technical issue. Please contact the administrator for assistance.", colorClass: "text-[#DC2626]" };
  }

  const botJob = typeof session.botJobId === "object" && session.botJobId ? session.botJobId : null;
  if (botJob && botJob.status === "FAILED") {
    return { text: "Session Interrupted", subtext: "Your interview was interrupted due to a technical issue. Please contact the administrator for assistance.", colorClass: "text-[#DC2626]" };
  }

  if (session.status === "IN_PROGRESS") {
    return { text: "🟢 In Progress", subtext: "Interview active in call", colorClass: "text-[#15803D]" };
  }

  const now = Date.now();
  const scheduledTime = new Date(session.scheduledAt).getTime();
  const isFuture = scheduledTime > now;

  if (botJob) {
    if (botJob.status === "RUNNING") {
      return { text: "🔵 Bot Joining Call", subtext: "Connecting to Google Meet...", colorClass: "text-[#2563EB]" };
    }
    if (botJob.status === "CLAIMED") {
      return { text: "🔵 Bot Starting", subtext: "Worker assigned & initializing...", colorClass: "text-[#2563EB]" };
    }
    if (botJob.status === "QUEUED") {
      if (isFuture) {
        return { text: "🟡 Scheduled", subtext: "Job queued for start time", colorClass: "text-[#D97706]" };
      }
      return { text: "🟡 Waiting for Bot", subtext: "Due for execution", colorClass: "text-[#D97706]" };
    }
  }

  if (isFuture) {
    return { text: "🟡 Scheduled", subtext: "Awaiting scheduled time", colorClass: "text-[#D97706]" };
  }

  if (session.status === "WAITING_FOR_CANDIDATE") {
    return { text: "🟡 Ready — Waiting for You", subtext: "Please join meeting", colorClass: "text-[#15803D]" };
  }

  return { text: session.status.replaceAll("_", " "), subtext: "", colorClass: "text-[#1B4332]" };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(backendApiUrl(`/api/ai-interviews${path}`), { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`);
  return body;
}

export default function InterviewPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [answer, setAnswer] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [mic, setMic] = useState<"idle" | "listening" | "unavailable" | "denied">("idle");
  const [voice, setVoice] = useState(true);
  const [connection, setConnection] = useState<"connected" | "error">("connected");
  const recorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recognition = useRef<any>(null);
  const turnId = useRef(0);

  const isEndingRef = useRef(false);
  const autoEndTriggeredRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ interview: Session | null }>("/mine");
      setSession(data.interview);
      // If interview is scheduled or waiting, notify backend of candidate presence
      if (data.interview?._id && ["SCHEDULED", "READY", "WAITING_FOR_CANDIDATE"].includes(data.interview.status)) {
        try {
          const presenceRes = await api<{ interview: Session; started?: boolean }>(`/${data.interview._id}/presence`, { method: "POST" });
          if (presenceRes.interview) {
            setSession(presenceRes.interview);
            if (presenceRes.started) {
              const q = presenceRes.interview.questions[presenceRes.interview.currentQuestionIndex];
              await say(q?.questionId, q?.question);
            }
          }
        } catch { /* ignore presence signal errors */ }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load your interview.";
      setNotice(message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Polling hook: While interview is active or pending, poll /mine every 4 seconds to catch bot joining and updates
  useEffect(() => {
    if (!session) return;
    const isTerminal = ["COMPLETING", "COMPLETED", "ANALYSIS_PENDING", "ANALYZED", "FAILED", "CANDIDATE_NO_SHOW"].includes(session.status);
    if (isTerminal) return;

    const interval = window.setInterval(async () => {
      try {
        const data = await api<{ interview: Session | null }>("/mine");
        if (data.interview) {
          setSession((prev) => {
            if (!prev) return data.interview;
            if (
              prev.status !== data.interview!.status ||
              prev.currentQuestionIndex !== data.interview!.currentQuestionIndex ||
              (prev.transcript?.length || 0) !== (data.interview!.transcript?.length || 0)
            ) {
              return data.interview;
            }
            return prev;
          });
        }
      } catch {
        // Silently tolerate transient polling errors
      }
    }, 4000);

    return () => window.clearInterval(interval);
  }, [session?.status]);
  useEffect(() => {
    if (!session?.startedAt || session.status !== "IN_PROGRESS") return;
    const tick = () => {
      const secs = Math.max(0, Math.floor((Date.now() - new Date(session.startedAt!).getTime()) / 1000));
      setElapsed(secs);
      // Auto-complete if 30-minute duration has expired (1800s) - trigger once without confirm dialog
      if (secs >= 1800 && !autoEndTriggeredRef.current && !isEndingRef.current && !busy) {
        autoEndTriggeredRef.current = true;
        setNotice("Scheduled 30-minute interview duration reached. Concluding interview session...");
        void performEndInterview(false);
      }
    };
    tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer);
  }, [session?.startedAt, session?.status, busy]);
  useEffect(() => {
    return () => {
      recognition.current?.stop?.();
      if (recorder.current?.state === "recording") recorder.current.stop();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const currentQuestion = session?.questions?.[session.currentQuestionIndex]?.question || "";
  const completedCount = session?.transcript?.filter((turn) => turn.speaker === "CANDIDATE").length || 0;
  const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const say = async (questionId?: string, text?: string) => {
    if (!voice || !session || typeof window === "undefined") return;
    const id = questionId || session.questions[session.currentQuestionIndex]?.questionId;
    if (id) {
      try {
        const response = await fetch(backendApiUrl(`/api/ai-interviews/${session._id}/questions/${encodeURIComponent(id)}/audio`), { credentials: "include", cache: "no-store" });
        if (response.ok) {
          const blob = await response.blob();
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          audio.onended = () => URL.revokeObjectURL(audioUrl);
          await audio.play();
          return;
        }
      } catch { /* use local voice fallback */ }
    }
    if (text && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  };

  const start = async () => {
    setBusy(true); setNotice("");
    try {
      const data = await api<{ interview: Session }>(`/${session?._id}/start`, { method: "POST" });
      setSession(data.interview);
      const question = data.interview.questions[data.interview.currentQuestionIndex];
      await say(question?.questionId, question?.question);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to start interview."); }
    finally { setBusy(false); }
  };

  const submitAnswer = async (text: string) => {
    if (!session || !text.trim() || busy) return;
    setBusy(true); setNotice("");
    const requestId = `ans-${session._id}-${turnId.current++}-${Date.now()}`;
    try {
      setConnection("connected");
      const data = await api<{ interview: Session; nextQuestion?: { question: string; questionId?: string }; answerPersisted?: boolean }>(`/${session._id}/answer`, { method: "POST", body: JSON.stringify({ text: text.trim(), requestId }) });
      setSession(data.interview); setAnswer("");
      if (data.nextQuestion?.question) await say(data.nextQuestion.questionId, data.nextQuestion.question);
    } catch (error) {
      setConnection("error");
      setNotice(error instanceof Error ? `${error.message} Your answer has been retained if it reached the server.` : "Answer submission failed. Please retry.");
      await load();
    } finally { setBusy(false); }
  };

  const listen = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMic("unavailable");
      setNotice("Audio capture is not supported in this browser. Type your answer instead.");
      return;
    }
    try {
      setMic("listening");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioRecorder = new MediaRecorder(stream);
      recorder.current = audioRecorder;
      audioChunks.current = [];
      audioRecorder.ondataavailable = (event) => { if (event.data.size) audioChunks.current.push(event.data); };
      audioRecorder.onerror = () => { setMic("unavailable"); setNotice("Audio recording failed. You can type your answer below."); };
      audioRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        try {
          const audioBlob = new Blob(audioChunks.current, { type: audioRecorder.mimeType || "audio/webm" });
          if (!audioBlob.size) { setMic("idle"); return; }
          const voiceRequestId = `voice-${session?._id}-${turnId.current++}-${Date.now()}`;
          const response = await fetch(backendApiUrl(`/api/ai-interviews/${session?._id}/transcribe`), {
            method: "POST", credentials: "include", headers: { "Content-Type": audioBlob.type, "X-Request-Id": voiceRequestId }, body: audioBlob,
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.message || "Speech recognition failed.");
          if (result.interview) {
            setSession(result.interview);
            setAnswer("");
            setConnection("connected");
            if (result.nextQuestion?.question) await say(result.nextQuestion.questionId, result.nextQuestion.question);
          } else {
            setAnswer((previous) => `${previous}${previous && result.text ? " " : ""}${result.text || ""}`.trim());
            if (result.silence) setNotice("No speech detected. Try again or type your answer.");
            setConnection("connected");
          }
        } catch (error) {
          setConnection("error");
          setNotice(error instanceof Error ? `${error.message} Type your answer or retry recording.` : "Speech recognition failed. Type your answer instead.");
        } finally { setMic("idle"); }
      };
      audioRecorder.start();
      window.setTimeout(() => { if (audioRecorder.state === "recording") audioRecorder.stop(); }, 60_000);
    } catch (error) {
      setMic((error as DOMException)?.name === "NotAllowedError" ? "denied" : "unavailable");
      setNotice((error as DOMException)?.name === "NotAllowedError" ? "Microphone permission was denied. You can type your answer below." : "Microphone is unavailable. You can type your answer below.");
    }
  };

  const performEndInterview = async (askConfirmation = true) => {
    if (!session || busy || isEndingRef.current) return;
    if (["COMPLETING", "COMPLETED", "ANALYSIS_PENDING", "ANALYZED", "FAILED"].includes(session.status)) {
      return;
    }

    if (askConfirmation) {
      const confirmed = window.confirm("End the interview now? Your saved transcript will be sent for analysis.");
      if (!confirmed) {
        return;
      }
    }

    isEndingRef.current = true;
    setBusy(true);
    try {
      const data = await api<{ interview: Session }>(`/${session._id}/end`, { method: "POST" });
      setSession(data.interview);
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    } catch (error) {
      isEndingRef.current = false;
      const message = error instanceof Error ? error.message : "Unable to end interview.";
      setNotice(message);
    } finally {
      setBusy(false);
    }
  };

  const end = () => performEndInterview(true);

  if (loading) return <StudentShell><p className="p-6 text-sm text-slate-500">Loading interview…</p></StudentShell>;
  if (!session) return <StudentShell><div className="mx-auto max-w-2xl"><Card><CardHeader title="Technical Interview" subtitle="Schedule an interview slot once your project is verified."/><CardContent><p className="text-sm text-slate-600">{notice || "No interview is currently scheduled."}</p><Button className="mt-4" onClick={() => router.push("/student/interview-scheduling")}>Schedule Interview</Button></CardContent></Card></div></StudentShell>;

  const isFinished = ["COMPLETING", "COMPLETED", "ANALYSIS_PENDING", "ANALYZED", "FAILED"].includes(session.status);
  const scheduledTime = new Date(session.scheduledAt).getTime();
  const now = Date.now();
  const isDueOrPast = now >= (scheduledTime - 15 * 60 * 1000);

  const openGoogleMeet = () => {
    if (session.meetLink) {
      window.open(session.meetLink, "_blank", "noopener,noreferrer");
    }
  };

  return <StudentShell><div className="mx-auto max-w-3xl space-y-5">
    <Card className="border-[#D6D3C8] bg-white shadow-sm">
      <CardHeader
        title="Technical Interview"
        subtitle="Voice interview via Google Meet."
      />
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[#F5F1E8] border border-[#D8CDBB]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Status</p>
            {(() => {
              const badge = getStatusBadge(session);
              return (
                <div className="mt-0.5">
                  <p className={`text-sm font-bold ${badge.colorClass}`}>{badge.text}</p>
                  {badge.subtext && <p className="text-[11px] text-[#64748B]">{badge.subtext}</p>}
                </div>
              );
            })()}
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Scheduled Time</p>
            <p className="text-sm font-bold text-[#1F2937] mt-0.5">{new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Duration</p>
            <p className="text-sm font-bold text-[#1F2937] mt-0.5">30 Minutes</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Platform</p>
            <p className="text-sm font-bold text-[#40916C] mt-0.5">Google Meet</p>
          </div>
        </div>
      </CardContent>
    </Card>

    {notice && (
      <p role="alert" className="rounded-xl border border-[#B45309]/30 bg-[#FEF3C7] p-3 text-xs sm:text-sm font-medium text-[#B45309]">
        {notice}
      </p>
    )}

    {!isFinished && (
      <Card className="border-[#40916C]/40 bg-[#EAF4EE] shadow-sm">
        <CardContent className="space-y-4 p-6 sm:p-7">
          <h2 className="text-xl font-bold text-[#1B4332]">Google Meet Voice Interview</h2>
          <p className="text-sm leading-relaxed text-[#1F2937]">
            This technical interview is conducted in real time inside Google Meet.
          </p>

          <div className="rounded-xl border border-[#D6D3C8] bg-white p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#15803D]">
              Instructions
            </p>
            <ol className="list-decimal pl-5 text-sm space-y-2 text-[#1F2937]">
              <li>Click <strong>Join Interview</strong> when your scheduled interview time arrives.</li>
              <li>Ensure your microphone and audio are enabled.</li>
              <li>Answer the interviewer&apos;s questions verbally.</li>
            </ol>
          </div>

          {session.meetLink ? (
            <div className="pt-2 space-y-2">
              <button
                type="button"
                disabled={!isDueOrPast}
                onClick={openGoogleMeet}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-semibold py-3 px-6 rounded-xl bg-[#40916C] hover:bg-[#347959] text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Join Interview
              </button>
              {!isDueOrPast && (
                <p className="text-xs text-[#64748B]">
                  Join button unlocks at your scheduled interview time.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#B45309]">Google Meet link is generating. Please refresh in a moment.</p>
          )}
        </CardContent>
      </Card>
    )}
  </div></StudentShell>;
}
