"use client";

import Link from "next/link";
import { StudentShell } from "@/components/student/StudentShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export default function MockInterview() {
  return (
    <StudentShell>
      <div className="mx-auto max-w-2xl">
        <Card className="border-[#D6D3C8] bg-white shadow-sm">
          <CardHeader title="Mock Interview" subtitle="Optional practice session." />
          <CardContent className="space-y-4">
            <p className="text-sm text-[#64748B]">
              Practice answering questions verbally before your scheduled interview.
            </p>
            <div>
              <Link
                href="/student/interview"
                className="inline-flex items-center px-5 py-2.5 rounded-xl bg-[#40916C] hover:bg-[#347959] text-white text-sm font-semibold transition-all shadow-sm"
              >
                Start Practice
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </StudentShell>
  );
}
