import { NextResponse } from "next/server";
import { listCandidates } from "@/lib/server-store";
import { handleApiError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth-server";
//import { handleApiError } from "@/lib/api-error";
import type { CandidateStatus } from "@/types";

type SortField = "name" | "jdMatchScore" | "receivedDate";
const SORT_FIELDS: SortField[] = ["name", "jdMatchScore", "receivedDate"];

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const params = new URL(req.url).searchParams;

    const search = params.get("search") || undefined;
    const status = (params.get("status") || "all") as CandidateStatus | "all";
    const role = params.get("role") || "all";
    const batch = params.get("batch") || "all";
    const jdMatchMinParam = params.get("jdMatchMin");
    const jdMatchMin = jdMatchMinParam !== null ? Number(jdMatchMinParam) : undefined;

    const page = Math.max(1, Number(params.get("page") || 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") || 6)));

    const sortByParam = params.get("sortBy") || "receivedDate";
    const sortBy: SortField = SORT_FIELDS.includes(sortByParam as SortField)
      ? (sortByParam as SortField)
      : "receivedDate";
    const sortDir = params.get("sortDir") === "asc" ? "asc" : "desc";

    const { data, total, roles, batches } = await listCandidates({
      search,
      status,
      role,
      batch,
      jdMatchMin,
      sortBy,
      sortDir,
      page,
      pageSize,
    });

    return NextResponse.json({ data, total, page, pageSize, roles, batches });
  } catch (err) {
    return handleApiError(err);
  }
}