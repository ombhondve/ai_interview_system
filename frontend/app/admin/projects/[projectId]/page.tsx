"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  Pencil,
  Trash2,
  UserPlus,
  ExternalLink,
  Users,
  Briefcase,
  Layers,
  CheckCircle2,
  Archive,
  Loader2,
} from "lucide-react";

import {
  projectService,
  type ProjectDetails,
  type AssignedCandidate,
} from "@/services/project.api";

import {
  ProjectEditModal,
} from "@/components/projects/ProjectEditModal";

import ProjectAssignModal from "@/components/projects/ProjectAssignModal";

/* =========================================================
   PAGE
========================================================= */

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();

  /*
   * Next.js params can sometimes be string|string[].
   */
  const projectId = useMemo(() => {
    const value = params?.projectId;

    if (Array.isArray(value)) {
      return String(value[0] || "");
    }

    return String(value || "");
  }, [params]);

  /* =======================================================
     STATE
  ======================================================= */

  const [project, setProject] =
    useState<ProjectDetails | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [editOpen, setEditOpen] =
    useState(false);

  const [assignOpen, setAssignOpen] =
    useState(false);

  const [deleteLoading, setDeleteLoading] =
    useState(false);

  /* =======================================================
     LOAD PROJECT
  ======================================================= */

  const loadProject = useCallback(
    async () => {
      if (!projectId) {
        return;
      }

      try {
        setLoading(true);
        setError("");

        const data =
          await projectService.getProjectById(
            projectId
          );

        /*
         * Keep the complete API response.
         */
        setProject(data);
      } catch (err) {
        console.error(
          "Failed to load project:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load project."
        );
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    if (!projectId) {
      return;
    }

    void loadProject();
  }, [projectId, loadProject]);

  /* =======================================================
     DELETE PROJECT
  ======================================================= */

  const handleDelete = async () => {
    if (!project) {
      return;
    }

    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${project.title}"?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeleteLoading(true);

      await projectService.deleteProject(
        project.id
      );

      router.push(
        "/admin/projects"
      );

      router.refresh();
    } catch (err) {
      console.error(
        "Failed to delete project:",
        err
      );

      window.alert(
        err instanceof Error
          ? err.message
          : "Failed to delete project."
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  /* =======================================================
     PROJECT UPDATED
  ======================================================= */

  const handleProjectUpdated =
    async () => {
      setEditOpen(false);

      await loadProject();
    };

  /* =======================================================
     PROJECT ASSIGNED
  ======================================================= */

  const handleProjectAssigned =
    async () => {
      setAssignOpen(false);

      /*
       * Important:
       *
       * After assigning a candidate, reload the
       * project from the backend so the assigned
       * candidate count/list is not stale.
       */
      await loadProject();
    };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading project...
        </div>
      </div>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (error || !project) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() =>
            router.push(
              "/admin/projects"
            )
          }
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>

        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-900">
            Unable to load project
          </h2>

          <p className="mt-2 text-sm text-red-700">
            {error ||
              "Project not found."}
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     ASSIGNED CANDIDATES
  ======================================================= */

  /*
   * The old code was:
   *
   * const assignedCandidates =
   *   project.assignedCandidates ?? [];
   *
   * That assumes that assignedCandidates is ALWAYS
   * the field returned by the backend.
   *
   * We normalize the data here instead.
   */

  const assignedCandidates =
    getAssignedCandidates(
      project
    );

  /*
   * Some APIs return a count separately.
   *
   * Example:
   *
   * assignedCandidateCount: 1
   * assignedCandidates: []
   *
   * In that situation we should not show 0.
   */
  const reportedAssignedCount =
    getAssignedCandidateCount(
      project
    );

  /*
   * Use the actual candidate array when available.
   * Otherwise use the backend-reported count.
   */
  const assignedCandidateCount =
    assignedCandidates.length > 0
      ? assignedCandidates.length
      : reportedAssignedCount;

  /*
   * If the backend says there is one assignment
   * but candidate details weren't populated, we keep
   * the count as 1.
   */
  const hasAssignedCandidates =
    assignedCandidateCount > 0;

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="space-y-6">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="flex flex-col gap-4">

        <button
          type="button"
          onClick={() =>
            router.push(
              "/admin/projects"
            )
          }
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Projects
        </button>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

          <div className="min-w-0">

            <div className="flex flex-wrap items-center gap-3">

              <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900">
                {project.title ||
                  "Untitled Project"}
              </h1>

              {project.status ===
              "active" ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Active
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  <Archive className="h-3.5 w-3.5" />
                  Archived
                </span>
              )}

            </div>

            <p className="mt-2 text-sm text-slate-500">
              {project.role ||
                "Role not specified"}
            </p>

          </div>

          {/* ACTIONS */}

          <div className="flex flex-wrap items-center gap-2">

            <button
              type="button"
              onClick={() =>
                setEditOpen(true)
              }
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>

            <button
              type="button"
              onClick={() =>
                setAssignOpen(true)
              }
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              <UserPlus className="h-4 w-4" />
              Assign
            </button>

            <button
              type="button"
              disabled={deleteLoading}
              onClick={
                handleDelete
              }
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}

              Delete
            </button>

          </div>

        </div>
      </div>

      {/* =================================================
          PROJECT OVERVIEW
      ================================================= */}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Project Overview
          </h2>
        </div>

        <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-y-0">

          <OverviewItem
            icon={
              <Briefcase className="h-5 w-5" />
            }
            label="Role"
            value={
              project.role ||
              "Not specified"
            }
          />

          <OverviewItem
            icon={
              <Layers className="h-5 w-5" />
            }
            label="Difficulty"
            value={
              project.difficulty ||
              "Not specified"
            }
          />

          <OverviewItem
            icon={
              <CheckCircle2 className="h-5 w-5" />
            }
            label="Status"
            value={
              project.status ||
              "Not specified"
            }
          />

          <OverviewItem
            icon={
              <Users className="h-5 w-5" />
            }
            label="Assigned Candidates"
            value={String(
              assignedCandidateCount
            )}
          />

        </div>
      </section>

      {/* =================================================
          DESCRIPTION
      ================================================= */}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

        <h2 className="text-base font-semibold text-slate-900">
          Description
        </h2>

        <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-slate-600">
          {project.description ||
            "No description available."}
        </p>

      </section>

      {/* =================================================
          TECHNOLOGIES
      ================================================= */}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

        <h2 className="text-base font-semibold text-slate-900">
          Technologies
        </h2>

        {Array.isArray(
          project.technologies
        ) &&
        project.technologies.length >
          0 ? (
          <div className="mt-4 flex flex-wrap gap-2">

            {project.technologies.map(
              (
                technology,
                index
              ) => (
                <span
                  key={`${technology}-${index}`}
                  className="max-w-full break-words rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700"
                >
                  {technology}
                </span>
              )
            )}

          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            No technologies specified.
          </p>
        )}

      </section>

      {/* =================================================
          PROJECT BRIEF
      ================================================= */}

      {project.briefUrl && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

          <h2 className="text-base font-semibold text-slate-900">
            Project Brief
          </h2>

          <a
            href={
              project.briefUrl
            }
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            View Project Brief

            <ExternalLink className="h-4 w-4" />
          </a>

        </section>
      )}

      {/* =================================================
          ASSIGNED CANDIDATES
      ================================================= */}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">

        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <h2 className="text-base font-semibold text-slate-900">
              Assigned Candidates
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {hasAssignedCandidates
                ? `${assignedCandidateCount} candidate${
                    assignedCandidateCount ===
                    1
                      ? ""
                      : "s"
                  } currently assigned to this project.`
                : "Candidates currently assigned to this project."}
            </p>

          </div>

          <button
            type="button"
            onClick={() =>
              setAssignOpen(true)
            }
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <UserPlus className="h-4 w-4" />
            Assign Candidate
          </button>

        </div>

        {/* =================================================
            CANDIDATE LIST
        ================================================= */}

        {assignedCandidates.length >
        0 ? (

          <div className="divide-y divide-slate-100">

            {assignedCandidates.map(
              (
                candidate,
                index
              ) => {

                /*
                 * Some APIs may not provide id.
                 * Use a stable fallback for the React key.
                 */
                const candidateId =
                  String(
                    candidate.id ||
                      candidate._id ||
                      `candidate-${index}`
                  );

                return (
                  <CandidateRow
                    key={
                      candidateId
                    }
                    candidate={
                      candidate
                    }
                    onView={() => {
                      const id =
                        String(
                          candidate.id ||
                            candidate._id ||
                            ""
                        );

                      if (!id) {
                        return;
                      }

                      router.push(
                        `/admin/candidates/${id}`
                      );
                    }}
                  />
                );
              }
            )}

          </div>

        ) : hasAssignedCandidates ? (

          /*
           * IMPORTANT:
           *
           * Backend says there are assigned candidates,
           * but candidate details were not populated.
           *
           * Do NOT show "No candidates assigned".
           */
          <div className="px-6 py-12 text-center">

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
              <Users className="h-6 w-6 text-blue-500" />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              Candidate assignment found
            </h3>

            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              {assignedCandidateCount} candidate
              {assignedCandidateCount ===
              1
                ? " is"
                : "s are"}{" "}
              assigned to this project, but
              candidate details were not returned
              by the project API.
            </p>

            <button
              type="button"
              onClick={() =>
                void loadProject()
              }
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>

          </div>

        ) : (

          <div className="px-6 py-12 text-center">

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Users className="h-6 w-6 text-slate-400" />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No candidates assigned
            </h3>

            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Assign a candidate to this project
              to start tracking their work.
            </p>

          </div>

        )}

      </section>

      {/* =================================================
          EDIT MODAL
      ================================================= */}

      {editOpen && (
        <ProjectEditModal
          open={editOpen}
          project={project}
          onClose={() =>
            setEditOpen(false)
          }
          onSaved={
            handleProjectUpdated
          }
        />
      )}

      {/* =================================================
          ASSIGN MODAL
      ================================================= */}

      {assignOpen && (
        <ProjectAssignModal
          open={assignOpen}
          project={project}
          onClose={() =>
            setAssignOpen(false)
          }
          onAssigned={
            handleProjectAssigned
          }
        />
      )}

    </div>
  );
}

/* =========================================================
   ASSIGNMENT HELPERS
========================================================= */

/**
 * Safely read an arbitrary project object.
 *
 * ProjectDetails is typed by project.api.ts, but the actual
 * backend response may contain additional fields.
 */
function asRecord(
  value: unknown
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object"
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  return {};
}

/**
 * Convert one candidate-like object into
 * the AssignedCandidate shape used by the UI.
 */
function normalizeCandidate(
  value: unknown
): AssignedCandidate | null {
  if (!value) {
    return null;
  }

  /*
   * If the API already returns the expected
   * AssignedCandidate object, preserve it.
   */
  if (
    typeof value === "object"
  ) {
    const item =
      asRecord(value);

    const id =
      item.id ??
      item._id ??
      item.candidateId ??
      item.studentId;

    if (!id) {
      return null;
    }

    return {
      ...(item as AssignedCandidate),
      id: String(id),
      name:
        typeof item.name ===
        "string"
          ? item.name
          : typeof item.fullName ===
              "string"
            ? item.fullName
            : "Unknown Candidate",
      email:
        typeof item.email ===
        "string"
          ? item.email
          : "",
      status:
        typeof item.status ===
        "string"
          ? item.status
          : "unknown",
    };
  }

  /*
   * If only an ID was returned,
   * keep it so the UI still knows that
   * an assignment exists.
   */
  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return {
      id: value,
      name: "Assigned Candidate",
      email: "",
      status: "assigned",
    } as AssignedCandidate;
  }

  return null;
}

/**
 * Find assigned candidates regardless of
 * which common field the backend used.
 */
function getAssignedCandidates(
  project: ProjectDetails
): AssignedCandidate[] {
  const source =
    asRecord(project);

  const possibleValues: unknown[] = [
    source.assignedCandidates,

    source.assignedCandidate,

    source.assignedStudents,

    source.assignedStudent,

    source.candidates,

    source.students,

    source.assignees,

    source.assignedUsers,

    source.assignedCandidateIds,

    source.assignedStudentIds,

    source.candidateIds,

    source.studentIds,
  ];

  for (const value of possibleValues) {
    if (
      !Array.isArray(value) ||
      value.length === 0
    ) {
      continue;
    }

    const candidates =
      value
        .map(
          normalizeCandidate
        )
        .filter(
          (
            candidate
          ): candidate is AssignedCandidate =>
            candidate !== null
        );

    if (
      candidates.length > 0
    ) {
      return candidates;
    }
  }

  /*
   * Some APIs return a single candidate
   * object instead of an array.
   */
  const singleCandidateValues =
    [
      source.assignedCandidate,
      source.assignedStudent,
      source.candidate,
      source.student,
    ];

  for (
    const value of singleCandidateValues
  ) {
    const candidate =
      normalizeCandidate(
        value
      );

    if (candidate) {
      return [candidate];
    }
  }

  return [];
}

/**
 * Read a separately returned assignment count.
 *
 * This fixes the specific situation where:
 *
 * assignedCandidateCount = 1
 * assignedCandidates = []
 *
 * The page should not display 0 in that case.
 */
function getAssignedCandidateCount(
  project: ProjectDetails
): number {
  const source =
    asRecord(project);

  const possibleValues = [
  source.assignedCandidateCount,
  source.assignedCandidatesCount,
  source.candidateCount,
  source.assignedStudentCount,
  source.assignedStudentsCount,
  source.assignmentCount,
  source.totalAssignedCandidates,
  source.totalAssignedStudents,

  // Project API fields
  source.assigned,
  source.assignedCount,
];

  for (const value of possibleValues) {
    if (
      typeof value ===
      "number" &&
      Number.isFinite(value) &&
      value >= 0
    ) {
      return value;
    }

    if (
      typeof value ===
      "string" &&
      value.trim()
    ) {
      const parsed =
        Number(value);

      if (
        Number.isFinite(parsed) &&
        parsed >= 0
      ) {
        return parsed;
      }
    }
  }

  return 0;
}

/* =========================================================
   OVERVIEW ITEM
========================================================= */

function OverviewItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-5">
      <div className="flex items-center gap-3">

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>

        <div className="min-w-0">

          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {label}
          </p>

          <p className="mt-1 break-words text-sm font-semibold capitalize text-slate-900">
            {value}
          </p>

        </div>

      </div>
    </div>
  );
}

/* =========================================================
   CANDIDATE ROW
========================================================= */

function CandidateRow({
  candidate,
  onView,
}: {
  candidate: AssignedCandidate;
  onView: () => void;
}) {
  const candidateName =
    candidate.name ||
    "Unknown Candidate";

  const candidateEmail =
    candidate.email ||
    "No email available";

  const candidateStatus =
    candidate.status ||
    "unknown";

  return (
    <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">

      <div className="flex min-w-0 items-center gap-4">

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
          {candidateName
            .charAt(0)
            .toUpperCase() ||
            "C"}
        </div>

        <div className="min-w-0">

          <p className="truncate text-sm font-semibold text-slate-900">
            {candidateName}
          </p>

          <p className="truncate text-sm text-slate-500">
            {candidateEmail}
          </p>

        </div>
      </div>

      <div className="flex items-center gap-4">

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-600">
          {candidateStatus}
        </span>

        <button
          type="button"
          onClick={onView}
          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          View
        </button>

      </div>

    </div>
  );
}