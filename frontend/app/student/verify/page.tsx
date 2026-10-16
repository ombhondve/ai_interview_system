"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Mail,
  ArrowRight,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  Lock,
  Sparkles,
  User,
} from "lucide-react";

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
}

const STORAGE_KEY = "recruitai_verification_session";

function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();

  const token = params.get("token") || "";

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [hasResumeEmail, setHasResumeEmail] = useState(false);

  // 6 Individual OTP Digits
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [sent, setSent] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  /**
   * ========================================================
   * 1. VERIFY INVITATION TOKEN & LOAD RESUME EMAIL
   * ========================================================
   */
  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("Invitation token is missing. Please access this page using the link sent to your email.");
      return;
    }

    let mounted = true;

    const verifyInvitation = async () => {
      try {
        setLoading(true);
        setError("");

        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL ||
          "https://ai-interview-system-eewl.vercel.app";

        const response = await fetch(
          `${backendUrl}/api/student/invite?token=${encodeURIComponent(token)}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to verify candidate invitation link."
          );
        }

        if (mounted && data.candidate) {
          setCandidate(data.candidate);

          // Populates from resume email as primary source of truth
          const resumeEmail = (data.candidate.email || "").trim();
          if (resumeEmail) {
            setIdentifier(resumeEmail);
            setHasResumeEmail(true);
          } else {
            setHasResumeEmail(false);
            setError(
              "No verified email was detected from your resume. Please enter your application email below."
            );
          }

          // Restore existing active OTP session across page refresh
          try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            if (stored) {
              const parsed = JSON.parse(stored);
              if (
                parsed.candidateId === data.candidate.id &&
                parsed.expiresAt
              ) {
                const diffSec = Math.max(
                  0,
                  Math.floor(
                    (new Date(parsed.expiresAt).getTime() - Date.now()) / 1000
                  )
                );
                if (diffSec > 0) {
                  setSent(true);
                  setExpiresAt(parsed.expiresAt);
                  setRemainingSeconds(diffSec);
                } else {
                  sessionStorage.removeItem(STORAGE_KEY);
                }
              }
            }
          } catch {
            // Ignore storage parse issues
          }
        }
      } catch (err) {
        console.error("INVITATION ERROR:", err);
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to verify invitation token."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    verifyInvitation();

    return () => {
      mounted = false;
    };
  }, [token]);

  /**
   * ========================================================
   * 2. 60-SECOND SERVER-SYNCED COUNTDOWN TIMER
   * ========================================================
   */
  useEffect(() => {
    if (!sent || !expiresAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );

      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        setIsExpired(true);
        setError("OTP expired. Please request a new verification code.");
        clearInterval(interval);
      } else {
        setIsExpired(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sent, expiresAt]);

  /**
   * Resend cooldown timer
   */
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  /**
   * ========================================================
   * 3. SEND OTP REQUEST (60s Expiry)
   * ========================================================
   */
  const handleSendOtp = async () => {
    if (!candidate?.id) {
      setError("Candidate identity could not be verified.");
      triggerShake();
      return;
    }

    const emailToUse = identifier.trim();
    if (!emailToUse || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToUse)) {
      setError("Please provide a valid email address.");
      triggerShake();
      return;
    }

    try {
      setSending(true);
      setError("");

      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        "https://ai-interview-system-eewl.vercel.app";

      const response = await fetch(`${backendUrl}/api/verification/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidateId: candidate.id,
          identifier: emailToUse,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to deliver OTP.");
      }

      setSent(true);
      setIsExpired(false);
      setOtpDigits(["", "", "", "", "", ""]);
      setResendCooldown(30); // 30s resend throttle

      // Calculate expiry from server response (60s)
      const serverExpiresAt =
        data.expiresAt || new Date(Date.now() + 60 * 1000).toISOString();
      setExpiresAt(serverExpiresAt);

      const diffSec = Math.max(
        0,
        Math.floor((new Date(serverExpiresAt).getTime() - Date.now()) / 1000)
      );
      setRemainingSeconds(diffSec > 0 ? diffSec : 60);

      // Persist to session storage for refresh resilience
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            candidateId: candidate.id,
            expiresAt: serverExpiresAt,
          })
        );
      } catch {
        // Ignore
      }

      // Auto-focus first digit input
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
    } catch (err) {
      console.error("SEND OTP ERROR:", err);
      setError(err instanceof Error ? err.message : "Unable to send OTP.");
      triggerShake();
    } finally {
      setSending(false);
    }
  };

  /**
   * ========================================================
   * 4. DIGIT INPUT & PASTE HANDLING
   * ========================================================
   */
  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric digit
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      const next = [...otpDigits];
      next[index] = "";
      setOtpDigits(next);
      return;
    }

    const next = [...otpDigits];
    next[index] = cleaned[cleaned.length - 1]; // take latest typed char
    setOtpDigits(next);

    // Auto-advance focus to next cell
    if (index < 5 && cleaned.length > 0) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        // Move to previous cell on empty backspace
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasteData) return;

    const digits = pasteData.slice(0, 6).split("");
    const next = [...otpDigits];
    digits.forEach((d, i) => {
      if (i < 6) next[i] = d;
    });
    setOtpDigits(next);

    const focusIndex = Math.min(digits.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const enteredOtp = otpDigits.join("");

  /**
   * ========================================================
   * 5. VERIFY OTP SUBMISSION
   * ========================================================
   */
  const handleVerifyOtp = async () => {
    if (isExpired || remainingSeconds <= 0) {
      setError("This OTP has expired. Please request a new code.");
      triggerShake();
      return;
    }

    if (enteredOtp.length !== 6) {
      setError("Please enter the complete 6-digit OTP.");
      triggerShake();
      return;
    }

    try {
      setVerifying(true);
      setError("");

      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        "https://ai-interview-system-eewl.vercel.app";

      const response = await fetch(`${backendUrl}/api/verification/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          identifier: identifier.trim(),
          otp: enteredOtp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Invalid or expired OTP.");
      }

      // Success
      setVerifiedSuccess(true);
      sessionStorage.removeItem(STORAGE_KEY);

      // Transition smoothly into student dashboard
      setTimeout(() => {
        router.replace("/student/status");
      }, 1000);
    } catch (err) {
      console.error("VERIFY OTP ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Verification failed. Please check the code."
      );
      triggerShake();
    } finally {
      setVerifying(false);
    }
  };

  /**
   * Format countdown as 00:59
   */
  const formatCountdown = (secs: number) => {
    const s = Math.max(0, secs);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  // ----------------------------------------------------
  // LOADING SKELETON
  // ----------------------------------------------------
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F5F1E8] px-4 py-8">
        <div className="w-full max-w-md bg-white border border-[#D6D3C8] rounded-2xl p-8 shadow-sm text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-[#EAF4EE] flex items-center justify-center text-[#1B4332] animate-pulse">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-[#1F2937]">
            Verifying Invitation
          </h2>
          <p className="mt-2 text-sm text-[#64748B]">
            Validating candidate security credentials...
          </p>
          <div className="mt-6 flex justify-center">
            <div className="h-1.5 w-32 rounded-full bg-[#E9E4D8] overflow-hidden">
              <div className="h-full bg-[#40916C] animate-pulse w-2/3 rounded-full" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ----------------------------------------------------
  // VERIFICATION CARD
  // ----------------------------------------------------
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F5F1E8] px-4 py-12 antialiased selection:bg-[#40916C] selection:text-white">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-lg"
      >
        {/* Brand / Logo Topmark */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1B4332]">
            Student Verification
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Verify your email to access the portal.
          </p>
        </div>

        {/* Main Card */}
        <motion.div
          animate={{ x: shake ? [-6, 6, -5, 5, -2, 2, 0] : 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white border border-[#D6D3C8] rounded-2xl shadow-sm overflow-hidden"
        >
          {/* Top Stage Bar */}
          <div className="bg-[#1B4332] px-6 py-3.5 text-white flex items-center justify-between border-b border-[#255A44]">
            <span className="text-sm font-semibold tracking-wide">
              Identity Verification
            </span>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Candidate Identity Profile Confirmation */}
            {candidate ? (
              <div className="p-4 rounded-xl bg-[#F5F1E8] border border-[#D8CDBB]/70 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1B4332] text-white font-bold text-sm">
                  {candidate.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#1F2937] truncate">
                      {candidate.name}
                    </p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#40916C]/15 text-[#1B4332]">
                      {candidate.role}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Application reference:{" "}
                    <span className="font-mono text-[#1F2937]">
                      {candidate.id.slice(-6).toUpperCase()}
                    </span>
                  </p>
                </div>
              </div>
            ) : null}

            {/* Verification Stage 1: Email Confirmation */}
            {!sent && candidate && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1F2937] mb-1.5">
                    Resume Verified Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Enter candidate email"
                      disabled={sending}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D6D3C8] rounded-xl text-sm font-medium text-[#1F2937] placeholder-[#64748B]/60 focus:outline-none focus:ring-2 focus:ring-[#40916C] focus:border-transparent transition-all disabled:bg-[#F5F1E8]"
                    />
                  </div>
                  {hasResumeEmail ? (
                    <p className="mt-1.5 text-xs text-[#15803D] flex items-center gap-1 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Auto-populated from parsed resume profile
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-[#B45309]">
                      Please confirm the email used during job application.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sending || !identifier.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#40916C] hover:bg-[#347959] text-white font-semibold text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#40916C] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {sending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <span>Send OTP</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Verification Stage 2: OTP Entry & 60s Live Countdown */}
            {sent && (
              <div className="space-y-6">
                {/* Destination Banner */}
                <div className="flex items-center justify-between text-xs p-3 rounded-lg bg-[#F5F1E8] border border-[#D8CDBB]">
                  <div className="flex items-center gap-2 text-[#1F2937]">
                    <Mail className="h-4 w-4 text-[#40916C]" />
                    <span>
                      OTP sent to: <strong>{identifier}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSent(false);
                      setOtpDigits(["", "", "", "", "", ""]);
                      setError("");
                    }}
                    className="text-[#40916C] hover:underline font-semibold text-xs"
                  >
                    Change
                  </button>
                </div>

                {/* 6-Digit OTP Boxes */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1F2937] text-center mb-3">
                    Enter 6-Digit Verification Code
                  </label>
                  <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          inputRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        disabled={verifying || verifiedSuccess}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold font-mono rounded-xl border transition-all focus:outline-none ${
                          digit
                            ? "border-[#40916C] bg-[#EAF4EE] text-[#1B4332] shadow-sm"
                            : "border-[#D6D3C8] bg-white text-[#1F2937]"
                        } focus:ring-2 focus:ring-[#40916C] focus:border-transparent`}
                      />
                    ))}
                  </div>
                </div>

                {/* 60-Second Countdown Status */}
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8CDBB]">
                  <div className="flex items-center gap-2">
                    <Clock
                      className={`h-4 w-4 ${
                        remainingSeconds <= 15
                          ? "text-[#B91C1C] animate-pulse"
                          : "text-[#B45309]"
                      }`}
                    />
                    <span className="text-xs font-semibold text-[#1F2937]">
                      {isExpired || remainingSeconds <= 0
                        ? "OTP expired"
                        : `OTP expires in ${formatCountdown(remainingSeconds)}`}
                    </span>
                  </div>

                  {/* Resend Action */}
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sending || resendCooldown > 0}
                    className="text-xs font-semibold text-[#40916C] hover:text-[#347959] disabled:text-[#64748B] disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${sending ? "animate-spin" : ""}`}
                    />
                    <span>
                      {resendCooldown > 0
                        ? `Resend in ${resendCooldown}s`
                        : "Resend OTP"}
                    </span>
                  </button>
                </div>

                {/* Verify Action Button */}
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={
                    verifying ||
                    enteredOtp.length !== 6 ||
                    isExpired ||
                    remainingSeconds <= 0 ||
                    verifiedSuccess
                  }
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-white font-semibold text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1B4332] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {verifying ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : verifiedSuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      <span>Verified</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      <span>Verify OTP</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Success State Indicator */}
            <AnimatePresence>
              {verifiedSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-4 rounded-xl bg-[#EAF4EE] border border-[#40916C]/40 text-[#15803D] text-center space-y-1"
                >
                  <div className="flex justify-center">
                    <CheckCircle2 className="h-6 w-6 text-[#15803D]" />
                  </div>
                  <p className="text-sm font-bold">
                    Authentication Successful!
                  </p>
                  <p className="text-xs text-[#1B4332]">
                    Establishing authorized session and launching your portal...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Message Box */}
            {error && !verifiedSuccess && (
              <div className="p-3.5 rounded-xl bg-[#FEE2E2]/70 border border-[#B91C1C]/30 text-[#B91C1C] flex items-start gap-2.5 text-xs font-medium">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}
          </div>

          {/* Security Footer Note */}
          <div className="px-6 py-3.5 bg-[#F5F1E8] border-t border-[#D6D3C8] text-[11px] text-[#64748B] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-[#1B4332]" />
              Encrypted HttpOnly Session
            </span>
            <span>RecruitAI Trust & Safety</span>
          </div>
        </motion.div>
      </motion.div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
