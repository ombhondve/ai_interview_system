"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/components/student/StudentShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export default function Result() {
  const router = useRouter();
  const [c, setC] = useState<any>(null);

  useEffect(() => {
    fetch("/api/student/me").then(async (r) => {
      const d = await r.json();
      if (!r.ok) {
        router.replace("/student/verify");
        return;
      }
      setC(d.candidate);
    });
  }, [router]);

  return (
    <StudentShell>
      <Card>
        <CardHeader title="Result" subtitle="Your final application outcome." />
        <CardContent>
          {c ? (
            <>
              <p className="text-2xl font-semibold capitalize">
                {c.finalDecision ? c.finalDecision : c.status.replace("_", " ")}
              </p>
              <p className="mt-3 text-sm text-slate-500">
                Final results become visible after the administrator records the interview decision.
              </p>
            </>
          ) : (
            <p>Loading…</p>
          )}
        </CardContent>
      </Card>
    </StudentShell>
  );
}