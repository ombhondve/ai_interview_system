"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const nextErrors: typeof errors = {};
  if (!email) nextErrors.email = "Email is required";
  if (!password) nextErrors.password = "Password is required";
  setErrors(nextErrors);
  if (Object.keys(nextErrors).length) return;

  setLoading(true);
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast({
        type: "error",
        title: "Login failed",
        description: data?.message || "Invalid email or password.",
      });
      return;
    }

    toast({ type: "success", title: "Welcome back", description: "Logged in successfully." });
    router.push("/admin");
  } catch {
    toast({
      type: "error",
      title: "Login failed",
      description: "Could not reach the server. Please try again.",
    });
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-[#0f1117]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-600 text-sm font-bold text-white">
            AI
          </div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Sign in to the recruitment admin dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="surface space-y-4 rounded-2xl border p-6 shadow-card">
          <Input
            label="Email"
            type="email"
            placeholder="admin@company.com"
            icon={<Mail className="h-4 w-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            icon={<Lock className="h-4 w-4" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
              />
              Remember me
            </label>
            <button type="button" className="font-medium text-accent-600 hover:text-accent-700">
              Forgot password?
            </button>
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            Sign In
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Access is granted by your organization admin. No public registration.
        </p>
      </motion.div>
    </div>
  );
}