"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/components/student/StudentShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { backendApiUrl } from "@/lib/client";

type Turn = { speaker: string; text: string; timestamp: string; questionId?: string; section?: string };
type Session = { _id: string; status: string; scheduledAt: string; meetLink?: string; questions: Array<{ question: string; category: string }>; transcript: Turn[]; currentQuestionIndex: number; startedAt?: string };

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
  const recognition = useRef<any>(null);
  const turnId = useRef(0);

  const load = useCallback(async () => {
    try {
      const data = await api<{ interview: Session | null }>("/mine");
      setSession(data.interview);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load your interview.";
      setNotice(message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!session?.startedAt || session.status !== "IN_PROGRESS") return;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(session.startedAt!).getTime()) / 1000)));
    tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer);
  }, [session?.startedAt, session?.status]);
  useEffect(() => {
    return () => {
      recognition.current?.stop?.();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const currentQuestion = session?.questions?.[session.currentQuestionIndex]?.question || "";
  const completedCount = session?.transcript?.filter((turn) => turn.speaker === "CANDIDATE").length || 0;
  const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const say = (text: string) => {
    if (!voice || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  const start = async () => {
    setBusy(true); setNotice("");
    try {
      const data = await api<{ interview: Session }>(`/${session?._id}/start`, { method: "POST" });
      setSession(data.interview);
      say(data.interview.questions[data.interview.currentQuestionIndex]?.question || "");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to start interview."); }
    finally { setBusy(false); }
  };

  const submitAnswer = async (text: string) => {
    if (!session || !text.trim() || busy) return;
    setBusy(true); setNotice("");
    const requestId = `ans-${session._id}-${turnId.current++}-${Date.now()}`;
    try {
      const data = await api<{ interview: Session; nextQuestion?: { question: string }; answerPersisted?: boolean }>(`/${session._id}/answer`, { method: "POST", body: JSON.stringify({ text: text.trim(), requestId }) });
      setSession(data.interview); setAnswer("");
      if (data.nextQuestion?.question) say(data.nextQuestion.question);
    } catch (error) {
      setNotice(error instanceof Error ? `${error.message} Your answer has been retained if it reached the server.` : "Answer submission failed. Please retry.");
      await load();
    } finally { setBusy(false); }
  };

  const listen = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setMic("unavailable"); setNotice("Speech recognition is unavailable in this browser. Type your answer instead."); return; }
    const recorder = new SpeechRecognition();
    recorder.lang = "en-US"; recorder.interimResults = true; recorder.continuous = false;
    recorder.onstart = () => setMic("listening");
    recorder.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) transcript += event.results[i][0].transcript;
      setAnswer((previous) => `${previous}${previous ? " " : ""}${transcript}`.trim());
    };
    recorder.onerror = (event: any) => { setMic(event.error === "not-allowed" ? "denied" : "unavailable"); setNotice(event.error === "not-allowed" ? "Microphone permission was denied. You can type your answer below." : "Speech recognition failed. You can type your answer below."); };
    recorder.onend = () => setMic("idle");
    recognition.current = recorder;
    try { recorder.start(); } catch { setMic("unavailable"); setNotice("Microphone is unavailable. You can type your answer below."); }
  };

  const end = async () => {
    if (!session || busy) return;
    if (!window.confirm("End the interview now? Your saved transcript will be sent for analysis.")) return;
    setBusy(true);
    try {
      const data = await api<{ interview: Session }>(`/${session._id}/end`, { method: "POST" });
      setSession(data.interview); window.speechSynthesis?.cancel();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to end interview."); }
    finally { setBusy(false); }
  };

  if (loading) return <StudentShell><p className="p-6 text-sm text-slate-500">Loading interview…</p></StudentShell>;
  if (!session) return <StudentShell><div className="mx-auto max-w-2xl"><Card><CardHeader title="AI Interview" subtitle="A verified project and scheduled booking are required."/><CardContent><p className="text-sm text-slate-600">{notice || "No interview is currently scheduled."}</p><Button className="mt-4" onClick={() => router.push("/student/interview-scheduling")}>View interview schedule</Button></CardContent></Card></div></StudentShell>;

  const isFinished = ["COMPLETED", "ANALYSIS_PENDING", "ANALYZED"].includes(session.status);
  const isActive = session.status === "IN_PROGRESS";
  return <StudentShell><div className="mx-auto max-w-3xl space-y-5">
    <Card><CardHeader title="AI Interview" subtitle="Browser-based interview room. Answers are stored securely by the interview service."/><CardContent>
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-slate-500">Status</p><p className="font-semibold text-slate-900">{session.status.replaceAll("_", " ")}</p></div><div><p className="text-sm text-slate-500">Interview time</p><p className="font-mono text-lg font-semibold">{formatTime(elapsed)}</p></div><div><p className="text-sm text-slate-500">Question</p><p className="font-semibold">{session.currentQuestionIndex + 1} · {session.questions.length}</p></div></div>
      {session.meetLink && <p className="mt-4 text-sm">Google Meet link (human meeting only): <a href={session.meetLink} target="_blank" rel="noreferrer" className="break-all underline">{session.meetLink}</a></p>}
    </CardContent></Card>

    {notice && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{notice}</p>}

    {isFinished ? <Card><CardContent className="p-6"><h2 className="text-lg font-semibold">Interview completed</h2><p className="mt-2 text-sm text-slate-600">Your results will be reviewed by the recruitment team. The AI provides an advisory report only; the recruitment team makes the final decision.</p></CardContent></Card> : !isActive ? <Card><CardContent className="space-y-4 p-6"><p className="text-sm text-slate-700">Your interview can start from 15 minutes before its scheduled time until the booking ends.</p><p className="text-xs text-slate-500">Voice features use your browser. Microphone audio is not uploaded; speech recognition may be provided by your browser vendor. Typing is available as a fallback.</p><Button loading={busy} onClick={start}>Start interview</Button></CardContent></Card> : <>
      <Card><CardHeader title="AI Interviewer" subtitle={session.questions[session.currentQuestionIndex]?.category?.replaceAll("_", " ") || "Technical interview"}/><CardContent><p className="text-lg leading-8 text-slate-900">{currentQuestion}</p><p className="mt-3 text-xs text-slate-500">The interviewer does not see your screen. Please explain your submitted project verbally during the walkthrough.</p></CardContent></Card>
      <Card><CardContent className="space-y-4 p-5"><div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy} onClick={listen}>{mic === "listening" ? "Listening…" : "Use microphone"}</Button><span className="text-sm text-slate-600">{mic === "listening" ? "Listening in browser" : mic === "denied" ? "Microphone permission denied" : mic === "unavailable" ? "Microphone unavailable" : "Microphone idle"}</span><label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)}/> Read questions aloud</label></div><textarea value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={8000} rows={5} placeholder="Type your answer or use your browser microphone…" className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-indigo-500"/><div className="flex flex-wrap justify-between gap-3"><p className="self-center text-xs text-slate-500">Answer {completedCount + 1} · Transcript turns are saved by the server.</p><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={end}>End interview</Button><Button loading={busy} disabled={!answer.trim()} onClick={() => void submitAnswer(answer)}>Submit answer</Button></div></div></CardContent></Card>
      </>}
    <Card><CardHeader title="Interview transcript" subtitle="Only you and authorized recruitment administrators can view this transcript."/><CardContent><div className="max-h-80 space-y-3 overflow-y-auto">{session.transcript.map((turn, index) => <div key={`${turn.questionId || "turn"}-${index}`} className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{turn.speaker === "AI" ? "AI interviewer" : "You"}{turn.section === "PROJECT_WALKTHROUGH" ? " · Project walkthrough" : ""}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{turn.text}</p></div>)}</div></CardContent></Card>
  </div></StudentShell>;
}
