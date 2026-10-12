"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const shouldReduceMotion = useReducedMotion();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const nextErrors: typeof errors = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      nextErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      nextErrors.password = "Password is required";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = data?.message || "Invalid administrator credentials. Please check your email and password.";
        setErrorMessage(message);
        toast({
          type: "error",
          title: "Sign in failed",
          description: message,
        });
        return;
      }

      toast({
        type: "success",
        title: "Welcome to RecruitAI",
        description: "Administrator session authenticated successfully.",
      });
      router.push("/admin");
    } catch {
      const netError = "Unable to connect to the authentication server. Please check your network connection.";
      setErrorMessage(netError);
      toast({
        type: "error",
        title: "Network error",
        description: netError,
      });
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.35, ease: "easeOut" },
    },
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#F5F7FA] px-4 py-12">
      {/* Background ambient pattern */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-100/40 blur-3xl" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-[420px]"
      >
        {/* Branding header */}
        <div className="mb-6 text-center">
          <motion.div
            initial={shouldReduceMotion ? { scale: 1 } : { scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1976D2] shadow-md shadow-blue-500/20"
          >
            <span className="text-base font-bold tracking-tight text-white">RA</span>
          </motion.div>
          <h1 className="text-xl font-bold tracking-tight text-[#111F33]">
            RecruitAI Admin
          </h1>
          <p className="mt-1 text-xs text-[#64748B]">
            Sign in to access your recruitment management system
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-7 shadow-sm">
          {/* Server error alert banner */}
          <AnimatePresence mode="wait">
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <p className="leading-snug">{errorMessage}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4.5" noValidate>
            {/* Email input */}
            <div>
              <label
                htmlFor="admin-email"
                className="mb-1.5 block text-xs font-semibold text-[#111F33]"
              >
                Work Email
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#94A3B8]">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  disabled={loading}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder="admin@recruitai.com"
                  className={`w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-xs text-[#111F33] placeholder:text-[#94A3B8] transition outline-none disabled:bg-slate-50 disabled:opacity-60 ${
                    errors.email
                      ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                      : "border-[#E2E8F0] focus:border-[#1976D2] focus:ring-2 focus:ring-[#1976D2]/10 hover:border-slate-300"
                  }`}
                />
              </div>
              <AnimatePresence>
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="mt-1 text-xs text-red-600"
                  >
                    {errors.email}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Password input */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-semibold text-[#111F33]"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#94A3B8]">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  disabled={loading}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  placeholder="••••••••••••"
                  className={`w-full rounded-lg border bg-white py-2 pl-9 pr-9 text-xs text-[#111F33] placeholder:text-[#94A3B8] transition outline-none disabled:bg-slate-50 disabled:opacity-60 ${
                    errors.password
                      ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                      : "border-[#E2E8F0] focus:border-[#1976D2] focus:ring-2 focus:ring-[#1976D2]/10 hover:border-slate-300"
                  }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#94A3B8] hover:text-[#64748B] focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <AnimatePresence>
                {errors.password && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="mt-1 text-xs text-red-600"
                  >
                    {errors.password}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Remember me & Security info */}
            <div className="flex items-center justify-between pt-0.5 text-xs">
              <label className="flex cursor-pointer items-center gap-2 text-[#64748B]">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#1976D2] focus:ring-[#1976D2]"
                />
                Remember this device
              </label>
              <span className="flex items-center gap-1 text-[11px] text-[#64748B]">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                TLS Secured
              </span>
            </div>

            {/* Submit button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="relative flex w-full items-center justify-center rounded-lg bg-[#1976D2] py-2.5 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1565C0] active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
                    Authenticating…
                  </>
                ) : (
                  "Sign In to Admin Panel"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer info */}
        <div className="mt-6 flex flex-col items-center gap-1 text-center">
          <p className="text-[11px] text-[#64748B]">
            Access restricted to authorized RecruitAI administrators only.
          </p>
          <p className="text-[10px] text-[#94A3B8]">
            RecruitAI Enterprise System • Asia/Kolkata
          </p>
        </div>
      </motion.div>
    </div>
  );
}
