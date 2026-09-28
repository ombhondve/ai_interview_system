import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import {
  updateCandidate,
  addAudit,
  addNotification,
  createInviteToken,
  getCandidate,
} from "@/lib/server-store";

export async function POST(
  _: Request,
  { params }: { params: { candidateId: string } }
) {
  try {
    const admin = await requireAdmin();
    const current = getCandidate(params.candidateId);

    if (!current)
      return NextResponse.json(
        { message: "Candidate not found" },
        { status: 404 }
      );

    if (
      ["approved", "scheduled", "completed", "decided"].includes(
        current.status
      )
    )
      return NextResponse.json(
        { message: "Candidate is already past the approval stage." },
        { status: 409 }
      );

    const updated = updateCandidate(params.candidateId, (c) => ({
      ...c,
      status: "approved",
      activity: [
        ...c.activity.filter((a) => a.state !== "current"),
        {
          id: crypto.randomUUID(),
          label: "Approved",
          description: "Candidate approved for interview",
          timestamp: new Date().toISOString(),
          state: "complete",
        },
      ],
    }));

    if (!updated)
      return NextResponse.json(
        { message: "Candidate not found" },
        { status: 404 }
      );

    const token = createInviteToken(updated.id);
    const base =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const link = `${base}/student/verify?token=${token}`;

    addNotification({
      recipient: updated.phone,
      candidateName: updated.name,
      message: `Your application has been approved. Continue here: ${link}`,
      channel: "whatsapp",
      status: "pending",
    });

    addAudit(
      admin.name,
      "approve_candidate",
      updated.name,
      "candidate",
      "info"
    );

    return NextResponse.json({
      candidate: updated,
      inviteLink: link,
      whatsappUrl: `https://wa.me/?text=${encodeURIComponent(
        `Hello ${updated.name}, your application has been approved. Please continue here: ${link}`
      )}`,
    });
  } catch {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }
}