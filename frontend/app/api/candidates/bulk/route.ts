import { NextResponse } from "next/server";
import { updateManyCandidateStatus, type CandidateStatus } from "@/lib/server-store";
import { requireAdmin } from "@/lib/auth-server";
import { handleApiError } from "@/lib/api-error";

const VALID_STATUSES: CandidateStatus[] = ["pending", "approved", "rejected"];

export async function PATCH(req: Request) {
  try {
    requireAdmin();

    const body = await req.json().catch(() => null);
    const ids = body?.ids as string[] | undefined;
    const status = body?.status as CandidateStatus | undefined;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ message: "ids must be a non-empty array" }, { status: 400 });
    }
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { message: `status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const updated = updateManyCandidateStatus(ids, status);

    return NextResponse.json({ data: updated, updatedCount: updated.length });
  } catch (err) {
    return handleApiError(err);
  }
}