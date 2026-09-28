import { NextResponse } from "next/server";
import { findCandidateById, updateCandidateStatus } from "@/lib/server-store";
import { requireAdmin } from "@/lib/auth-server";
import { handleApiError } from "@/lib/api-error";
import type { CandidateStatus } from "@/types";

// =====================================================
// VALID CANDIDATE STATUSES
// =====================================================
//
// These should match the candidate statuses used by
// your recruitment application.
//
// received       -> Resume received
// under_review  -> Admin is reviewing
// approved      -> Candidate approved
// rejected      -> Candidate rejected
// scheduled     -> Interview scheduled
// completed     -> Interview completed
// decided       -> Final decision completed
//
// =====================================================

const VALID_STATUSES: CandidateStatus[] = [
  "received",
  "under_review",
  "approved",
  "rejected",
  "scheduled",
  "completed",
  "decided",
];

// =====================================================
// GET CANDIDATE
// =====================================================

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Make sure only an admin can access candidate details.
    await requireAdmin();

    const candidate = await findCandidateById(params.id);

    if (!candidate) {
      return NextResponse.json(
        {
          message: "Candidate not found",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(candidate);
  } catch (err) {
    return handleApiError(err);
  }
}

// =====================================================
// UPDATE CANDIDATE STATUS
// =====================================================

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Only admin can change candidate status.
    requireAdmin();

    const body = await req.json().catch(() => null);

    const status =
      body?.status as CandidateStatus | undefined;

    // =================================================
    // VALIDATE STATUS
    // =================================================

    if (
      !status ||
      !VALID_STATUSES.includes(status)
    ) {
      return NextResponse.json(
        {
          message:
            `status must be one of: ${VALID_STATUSES.join(", ")}`,
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // UPDATE CANDIDATE
    // =================================================

    const candidate =
      await updateCandidateStatus(
        params.id,
        status
      );

    if (!candidate) {
      return NextResponse.json(
        {
          message: "Candidate not found",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(candidate);
  } catch (err) {
    return handleApiError(err);
  }
}