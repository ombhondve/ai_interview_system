"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/components/student/StudentShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export default function Result() {
  const router = useRouter();
  const [c, setC] = useState<any>(null);

  useEffect(() => {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "https://ai-interview-system-eewl.vercel.app";

    fetch(`${backendUrl}/api/student/me`, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
    })
      .then(async (r) => {
        if (!r.ok) {
          router.replace("/student/verify");
          return;
        }
        const d = await r.json();
        setC(d.candidate);
      })
      .catch(() => {
        router.replace("/student/verify");
      });
  }, [router]);

  return (
    <StudentShell>
      <div className="mx-auto max-w-2xl">
        <Card className="border-[#D6D3C8] bg-white shadow-sm">
          <CardHeader title="Application Result" subtitle="Your recruitment application status." />
          <CardContent className="space-y-4">
            {c ? (
              <>
                <div className="p-4 rounded-xl bg-[#F5F1E8] border border-[#D8CDBB]">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Status</p>
                  <p className="text-xl font-bold text-[#1B4332] mt-1 capitalize">
                    {c.finalDecision ? c.finalDecision : c.status.replace("_", " ")}
                  </p>
                </div>
                <p className="text-xs text-[#64748B]">
                  Decisions are finalized following interview review.
                </p>
              </>
            ) : (
              <p className="text-sm text-[#64748B]">Loading result...</p>
            )}
          </CardContent>
        </Card>
      </div>
    </StudentShell>
  );
}
