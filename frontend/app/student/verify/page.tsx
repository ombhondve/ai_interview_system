"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
}

function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();

  const token = params.get("token") || "";

  const [candidate, setCandidate] =
    useState<Candidate | null>(null);

  const [identifier, setIdentifier] =
    useState("");

  const [otp, setOtp] = useState("");

  const [sent, setSent] = useState(false);

  const [error, setError] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [verifying, setVerifying] =
    useState(false);

  // --------------------------------------------------
  // VERIFY INVITATION TOKEN
  // --------------------------------------------------

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError(
        "Invitation token is missing."
      );
      return;
    }

    const verifyInvitation = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/student/invite?token=${encodeURIComponent(
            token
          )}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data = await response.json();

        console.log(
          "INVITATION RESPONSE:",
          response.status,
          data
        );

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Unable to verify invitation."
          );
        }

        setCandidate(data.candidate);

        /*
         * Use the candidate's phone as the
         * default OTP destination.
         *
         * This is useful because your current
         * OTP test is using Twilio SMS.
         */
        setIdentifier(
          data.candidate.phone || ""
        );
      } catch (error) {
        console.error(
          "INVITATION ERROR:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Failed to verify invitation."
        );
      } finally {
        setLoading(false);
      }
    };

    verifyInvitation();
  }, [token]);

  // --------------------------------------------------
  // SEND OTP
  // --------------------------------------------------

  async function send() {
    if (!candidate?.id) {
      setError(
        "Candidate information is missing."
      );
      return;
    }

    if (!identifier.trim()) {
      setError(
        "Please enter your email or phone number."
      );
      return;
    }

    try {
      setSending(true);
      setError("");

      const response = await fetch(
        "/api/verification/send",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            candidateId: candidate.id,
            identifier:
              identifier.trim(),
          }),
        }
      );

      const data =
        await response.json();

      console.log(
        "SEND OTP RESPONSE:",
        response.status,
        data
      );

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to send OTP."
        );
      }

      setSent(true);
      setOtp("");

      setError("");
    } catch (error) {
      console.error(
        "SEND OTP ERROR:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to send OTP."
      );
    } finally {
      setSending(false);
    }
  }

  // --------------------------------------------------
  // VERIFY OTP
  // --------------------------------------------------

  async function verify() {
    if (!identifier.trim()) {
      setError(
        "Email or phone number is required."
      );
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      setError(
        "Please enter the 6-digit OTP."
      );
      return;
    }

    try {
      setVerifying(true);
      setError("");

      const response = await fetch(
        "/api/verification/verify",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials: "include",

          body: JSON.stringify({
            identifier:
              identifier.trim(),
            otp,
          }),
        }
      );

      const data =
        await response.json();

      console.log(
        "VERIFY OTP RESPONSE:",
        response.status,
        data
      );

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Invalid OTP."
        );
      }

      /*
       * Backend sets the candidate_session
       * HttpOnly cookie here.
       *
       * Do not store the session token
       * in localStorage or sessionStorage.
       */
      router.replace(
        "/student/status"
      );
    } catch (error) {
      console.error(
        "VERIFY OTP ERROR:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to verify OTP."
      );
    } finally {
      setVerifying(false);
    }
  }

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-[#0f1117]">
        <Card className="w-full max-w-lg">
          <CardContent className="p-7">
            <h1 className="text-xl font-semibold">
              Student verification
            </h1>

            <p className="mt-4 text-sm text-slate-500">
              Verifying your invitation...
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-[#0f1117]">
      <Card className="w-full max-w-lg">
        <CardContent className="p-7">
          <h1 className="text-xl font-semibold">
            Student verification
          </h1>

          {candidate ? (
            <>
              <p className="mt-2 text-sm text-slate-500">
                Hello {candidate.name}.
                Verify your identity to
                continue with your{" "}
                {candidate.role} application.
              </p>

              <div className="mt-6 space-y-4">
                <Input
                  label="Email or phone"
                  value={identifier}
                  onChange={(e) =>
                    setIdentifier(
                      e.target.value
                    )
                  }
                  disabled={sending}
                />

                <Button
                  onClick={send}
                  disabled={
                    !identifier.trim() ||
                    sending
                  }
                >
                  {sending
                    ? "Sending OTP..."
                    : "Send OTP"}
                </Button>

                {sent && (
                  <>
                    <Input
                      label="OTP"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) =>
                        setOtp(
                          e.target.value.replace(
                            /\D/g,
                            ""
                          )
                        )
                      }
                      disabled={verifying}
                    />

                    <Button
                      onClick={verify}
                      disabled={
                        otp.length !== 6 ||
                        verifying
                      }
                    >
                      {verifying
                        ? "Verifying..."
                        : "Verify and continue"}
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-danger-600">
              {error ||
                "Open this page using the invitation link sent by the administrator."}
            </p>
          )}

          {error && candidate && (
            <p className="mt-3 text-sm text-danger-600">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

// --------------------------------------------------
// SUSPENSE WRAPPER
// --------------------------------------------------

export default function Verify() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}