"use client";

import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  ChevronRight,
} from "lucide-react";

import { Candidate } from "@/types";

import { Avatar } from "@/components/ui/Avatar";

import {
  Badge,
  statusToBadgeVariant,
} from "@/components/ui/Badge";

import { cn } from "@/lib/utils";

import { CandidateFilters } from "@/services/candidate.api";


// =====================================================
// STATUS LABEL
// =====================================================

function statusLabel(status?: string) {
  if (!status) {
    return "Unknown";
  }

  return status
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}


// =====================================================
// INTERVIEW STATUS
// =====================================================

function getInterviewBadgeVariant(
  status?: string
) {
  if (status === "completed") {
    return "success";
  }

  if (status === "scheduled") {
    return "accent";
  }

  return "neutral";
}


// =====================================================
// DATE FORMAT
// =====================================================

function formatDate(
  date?: string | Date
) {
  if (!date) {
    return "—";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  return parsedDate.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
    }
  );
}


// =====================================================
// CANDIDATE TABLE
// =====================================================

export function CandidateTable({
  candidates,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  sortBy,
  sortDir,
  onSort,
}: {
  candidates: Candidate[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  sortBy: CandidateFilters["sortBy"];
  sortDir: CandidateFilters["sortDir"];
  onSort: (
    field: CandidateFilters["sortBy"]
  ) => void;
}) {
  const router = useRouter();


  // =====================================================
  // SELECT ALL
  // =====================================================

  const allSelected =
    candidates.length > 0 &&
    candidates.every((candidate) =>
      selected.has(candidate.id)
    );


  // =====================================================
  // SORT HEADER
  // =====================================================

  const SortHeader = ({
    field,
    children,
  }: {
    field: CandidateFilters["sortBy"];
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="
        inline-flex
        items-center
        gap-1
        text-xs
        font-semibold
        uppercase
        tracking-wide
        text-slate-500
        hover:text-slate-700
        dark:text-slate-400
        dark:hover:text-slate-200
      "
    >
      {children}

      <ArrowUpDown
        className={cn(
          "h-3 w-3",
          sortBy === field &&
            "text-accent-600 dark:text-accent-400"
        )}
      />
    </button>
  );


  // =====================================================
  // RENDER
  // =====================================================

  return (
    <>

      {/* =================================================
          MOBILE VIEW
          Visible below sm
      ================================================= */}

      <div className="space-y-3 sm:hidden">

        {/* MOBILE SELECT ALL */}

        {candidates.length > 0 && (
          <div
            className="
              flex
              items-center
              justify-between
              rounded-lg
              border
              border-slate-200
              bg-white
              px-4
              py-3
              dark:border-white/10
              dark:bg-white/[0.03]
            "
          >

            <label
              className="
                flex
                items-center
                gap-2
                text-sm
                font-medium
                text-slate-700
                dark:text-slate-300
              "
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                className="
                  h-4
                  w-4
                  rounded
                  border-slate-300
                  text-accent-600
                  focus:ring-accent-500
                "
                aria-label="Select all candidates"
              />

              Select all
            </label>

            <span className="text-xs text-slate-400">
              {candidates.length} candidates
            </span>

          </div>
        )}


        {/* MOBILE CANDIDATE CARDS */}

        {candidates.map((candidate) => (

          <div
            key={candidate.id}
            onClick={() =>
              router.push(
                `/admin/candidates/${candidate.id}`
              )
            }
            className="
              cursor-pointer
              rounded-xl
              border
              border-slate-200
              bg-white
              p-4
              shadow-sm
              transition
              active:scale-[0.99]
              dark:border-white/10
              dark:bg-white/[0.03]
            "
          >

            {/* =================================================
                TOP ROW
            ================================================= */}

            <div className="flex items-start gap-3">

              {/* CHECKBOX */}

              <div
                className="pt-1"
                onClick={(event) =>
                  event.stopPropagation()
                }
              >
                <input
                  type="checkbox"
                  checked={selected.has(
                    candidate.id
                  )}
                  onChange={() =>
                    onToggleSelect(
                      candidate.id
                    )
                  }
                  className="
                    h-4
                    w-4
                    rounded
                    border-slate-300
                    text-accent-600
                    focus:ring-accent-500
                  "
                  aria-label={`Select ${
                    candidate.name ||
                    "candidate"
                  }`}
                />
              </div>


              {/* AVATAR */}

              <Avatar
                name={
                  candidate.name ||
                  "Unknown"
                }
                size="sm"
              />


              {/* NAME */}

              <div className="min-w-0 flex-1">

                <p
                  className="
                    truncate
                    text-sm
                    font-semibold
                    text-slate-900
                    dark:text-white
                  "
                >
                  {candidate.name ||
                    "Unknown"}
                </p>

                <p
                  className="
                    mt-0.5
                    truncate
                    text-xs
                    text-slate-500
                    dark:text-slate-400
                  "
                >
                  {candidate.email ||
                    "No email"}
                </p>

              </div>


              {/* ARROW */}

              <ChevronRight
                className="
                  mt-1
                  h-4
                  w-4
                  shrink-0
                  text-slate-300
                  dark:text-slate-600
                "
              />

            </div>


            {/* =================================================
                ROLE
            ================================================= */}

            <div
              className="
                mt-4
                rounded-lg
                bg-slate-50
                px-3
                py-2
                dark:bg-white/[0.04]
              "
            >

              <p
                className="
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-wide
                  text-slate-400
                "
              >
                Role
              </p>

              <p
                className="
                  mt-0.5
                  text-sm
                  text-slate-700
                  dark:text-slate-300
                "
              >
                {candidate.role || "—"}
              </p>

            </div>


            {/* =================================================
                DETAILS
            ================================================= */}

            <div
              className="
                mt-3
                grid
                grid-cols-2
                gap-3
              "
            >

              {/* JD MATCH */}

              <div>

                <p
                  className="
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-wide
                    text-slate-400
                  "
                >
                  JD Match
                </p>

                <p
                  className={cn(
                    "mt-1 text-sm font-semibold",
                    (candidate.jdMatchScore ??
                      0) >= 80
                      ? "text-success-600"
                      : (candidate.jdMatchScore ??
                          0) >= 60
                      ? "text-warning-600"
                      : "text-danger-600"
                  )}
                >
                  {candidate.jdMatchScore ??
                    0}
                  %
                </p>

              </div>


              {/* RECEIVED */}

              <div>

                <p
                  className="
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-wide
                    text-slate-400
                  "
                >
                  Received
                </p>

                <p
                  className="
                    mt-1
                    text-sm
                    text-slate-600
                    dark:text-slate-300
                  "
                >
                  {formatDate(
                    candidate.receivedDate ||
                      candidate.createdAt
                  )}
                </p>

              </div>

            </div>


            {/* =================================================
                STATUS ROW
            ================================================= */}

            <div
              className="
                mt-4
                flex
                flex-wrap
                items-center
                gap-2
                border-t
                border-slate-100
                pt-3
                dark:border-white/5
              "
            >

              <Badge
                variant={
                  statusToBadgeVariant[
                    candidate.status
                  ] || "neutral"
                }
              >
                {statusLabel(
                  candidate.status
                )}
              </Badge>


              <Badge
                variant={getInterviewBadgeVariant(
                  candidate.interviewStatus
                )}
              >
                {statusLabel(
                  candidate.interviewStatus
                )}
              </Badge>

            </div>

          </div>

        ))}


        {/* EMPTY STATE */}

        {candidates.length === 0 && (

          <div
            className="
              rounded-xl
              border
              border-dashed
              border-slate-200
              px-4
              py-10
              text-center
              dark:border-white/10
            "
          >
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No candidates found.
            </p>
          </div>

        )}

      </div>


      {/* =================================================
          DESKTOP / TABLET VIEW
          Visible from sm and above
      ================================================= */}

      <div className="hidden overflow-x-auto sm:block">

        <table className="w-full text-left">

          {/* =================================================
              HEADER
          ================================================= */}

          <thead>

            <tr className="border-b border-slate-100 dark:border-white/5">

              {/* SELECT ALL */}

              <th className="w-10 px-5 py-3">

                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="
                    h-3.5
                    w-3.5
                    rounded
                    border-slate-300
                    text-accent-600
                    focus:ring-accent-500
                  "
                  aria-label="Select all candidates"
                />

              </th>


              {/* CANDIDATE */}

              <th className="px-3 py-3">

                <SortHeader field="name">
                  Candidate
                </SortHeader>

              </th>


              {/* ROLE */}

              <th
                className="
                  px-3
                  py-3
                  text-xs
                  font-semibold
                  uppercase
                  tracking-wide
                  text-slate-500
                  dark:text-slate-400
                "
              >
                Role
              </th>


              {/* JD MATCH */}

              <th className="px-3 py-3">

                <SortHeader field="jdMatchScore">
                  JD Match
                </SortHeader>

              </th>


              {/* STATUS */}

              <th
                className="
                  px-3
                  py-3
                  text-xs
                  font-semibold
                  uppercase
                  tracking-wide
                  text-slate-500
                  dark:text-slate-400
                "
              >
                Status
              </th>


              {/* RECEIVED */}

              <th className="px-3 py-3">

                <SortHeader field="receivedDate">
                  Received
                </SortHeader>

              </th>


              {/* INTERVIEW */}

              <th
                className="
                  px-3
                  py-3
                  text-xs
                  font-semibold
                  uppercase
                  tracking-wide
                  text-slate-500
                  dark:text-slate-400
                "
              >
                Interview
              </th>


              {/* ARROW */}

              <th className="w-10 px-3 py-3" />

            </tr>

          </thead>


          {/* =================================================
              CANDIDATES
          ================================================= */}

          <tbody>

            {candidates.map((candidate) => (

              <tr
                key={candidate.id}
                onClick={() =>
                  router.push(
                    `/admin/candidates/${candidate.id}`
                  )
                }
                className="
                  cursor-pointer
                  border-b
                  border-slate-50
                  transition-colors
                  hover:bg-slate-50
                  dark:border-white/5
                  dark:hover:bg-white/[0.03]
                "
              >

                {/* SELECT */}

                <td
                  className="px-5 py-3.5"
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                >

                  <input
                    type="checkbox"
                    checked={selected.has(
                      candidate.id
                    )}
                    onChange={() =>
                      onToggleSelect(
                        candidate.id
                      )
                    }
                    className="
                      h-3.5
                      w-3.5
                      rounded
                      border-slate-300
                      text-accent-600
                      focus:ring-accent-500
                    "
                    aria-label={`Select ${
                      candidate.name ||
                      "candidate"
                    }`}
                  />

                </td>


                {/* CANDIDATE */}

                <td className="px-3 py-3.5">

                  <div className="flex items-center gap-3">

                    <Avatar
                      name={
                        candidate.name ||
                        "Unknown"
                      }
                      size="sm"
                    />

                    <div>

                      <p
                        className="
                          text-sm
                          font-medium
                          text-slate-900
                          dark:text-white
                        "
                      >
                        {candidate.name ||
                          "Unknown"}
                      </p>

                      <p
                        className="
                          text-xs
                          text-slate-500
                          dark:text-slate-400
                        "
                      >
                        {candidate.email ||
                          "No email"}
                      </p>

                    </div>

                  </div>

                </td>


                {/* ROLE */}

                <td
                  className="
                    px-3
                    py-3.5
                    text-sm
                    text-slate-600
                    dark:text-slate-300
                  "
                >
                  {candidate.role || "—"}
                </td>


                {/* JD MATCH */}

                <td className="px-3 py-3.5">

                  <span
                    className={cn(
                      "text-sm font-semibold",
                      (candidate.jdMatchScore ??
                        0) >= 80
                        ? "text-success-600"
                        : (candidate.jdMatchScore ??
                            0) >= 60
                        ? "text-warning-600"
                        : "text-danger-600"
                    )}
                  >
                    {candidate.jdMatchScore ??
                      0}
                    %
                  </span>

                </td>


                {/* STATUS */}

                <td className="px-3 py-3.5">

                  <Badge
                    variant={
                      statusToBadgeVariant[
                        candidate.status
                      ] || "neutral"
                    }
                  >
                    {statusLabel(
                      candidate.status
                    )}
                  </Badge>

                </td>


                {/* RECEIVED */}

                <td
                  className="
                    px-3
                    py-3.5
                    text-sm
                    text-slate-500
                    dark:text-slate-400
                  "
                >
                  {formatDate(
                    candidate.receivedDate ||
                      candidate.createdAt
                  )}
                </td>


                {/* INTERVIEW */}

                <td className="px-3 py-3.5">

                  <Badge
                    variant={getInterviewBadgeVariant(
                      candidate.interviewStatus
                    )}
                  >
                    {statusLabel(
                      candidate.interviewStatus
                    )}
                  </Badge>

                </td>


                {/* ARROW */}

                <td
                  className="
                    px-3
                    py-3.5
                    text-slate-300
                    dark:text-slate-600
                  "
                >
                  <ChevronRight className="h-4 w-4" />
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </>
  );
}
