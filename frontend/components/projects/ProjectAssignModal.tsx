"use client";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Loader2,
  Search,
  UserRound,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { candidateService } from "@/services/candidate.api";
import {projectService} from "@/services/project.api";

/* =========================================================
   TYPES
========================================================= */

interface EducationItem {
  degree?: string;
  college?: string;
  university?: string;
  year?: string | number;
}

interface AssignCandidate {
  id: string;
  _id?: string;

  name?: string;

  email?: string;

  phone?: string;

  location?: string;

  role?: string;

  status?: string;

  skills?: string[];

  education?:
    | EducationItem
    | EducationItem[];

  jdMatchScore?: number;

  verificationStatus?: string;
}

interface AssignProject {
  id?: string;

  _id?: string;

  title?: string;

  name?: string;

  role?: string;

  status?: string;
}

interface CandidateResponse {
  candidates?: AssignCandidate[];

  data?:
    | AssignCandidate[]
    | {
        candidates?: AssignCandidate[];
        data?: AssignCandidate[];
        items?: AssignCandidate[];
        results?: AssignCandidate[];
      };

  items?: AssignCandidate[];

  results?: AssignCandidate[];

  total?: number;

  pagination?: {
    total?: number;
  };
}

export interface ProjectAssignModalProps {
  open: boolean;

  project: AssignProject | null;

  onClose: () => void;

  /**
   * Called after successful assignment.
   */
  onAssigned?: (
    candidate: AssignCandidate
  ) => void | Promise<void>;

  /**
   * Optional callback when project assignment
   * should be refreshed in parent.
   */
  onSuccess?: () => void | Promise<void>;

  /**
   * Optional initial candidate.
   */
  initialCandidateId?: string | null;
}

/* =========================================================
   HELPERS
========================================================= */

function getCandidateId(
  candidate: AssignCandidate
): string {
  return String(
    candidate.id ||
      candidate._id ||
      ""
  );
}

function getProjectId(
  project: AssignProject | null
): string {
  if (!project) {
    return "";
  }

  return String(
    project.id ||
      project._id ||
      ""
  );
}

function getEducation(
  candidate: AssignCandidate
): EducationItem | null {
  if (!candidate.education) {
    return null;
  }

  if (Array.isArray(candidate.education)) {
    return (
      candidate.education[0] ||
      null
    );
  }

  return candidate.education;
}

function getEducationText(
  candidate: AssignCandidate
): string {
  const education =
    getEducation(candidate);

  if (!education) {
    return "";
  }

  return (
    education.degree ||
    education.college ||
    education.university ||
    ""
  );
}

function getEducationSecondaryText(
  candidate: AssignCandidate
): string {
  const education =
    getEducation(candidate);

  if (!education) {
    return "";
  }

  const college =
    education.college ||
    education.university ||
    "";

  const year = education.year
    ? String(education.year)
    : "";

  if (college && year) {
    return `${college} • ${year}`;
  }

  return college || year;
}

function normalizeCandidates(
  response: unknown
): AssignCandidate[] {
  if (!response) {
    return [];
  }

  const result =
    response as CandidateResponse;

  /*
   * Direct:
   *
   * Candidate[]
   */
  if (Array.isArray(response)) {
    return response
      .map(normalizeCandidate)
      .filter(Boolean) as AssignCandidate[];
  }

  /*
   * response.candidates
   */
  if (
    Array.isArray(result.candidates)
  ) {
    return result.candidates
      .map(normalizeCandidate)
      .filter(Boolean) as AssignCandidate[];
  }

  /*
   * response.items
   */
  if (
    Array.isArray(result.items)
  ) {
    return result.items
      .map(normalizeCandidate)
      .filter(Boolean) as AssignCandidate[];
  }

  /*
   * response.results
   */
  if (
    Array.isArray(result.results)
  ) {
    return result.results
      .map(normalizeCandidate)
      .filter(Boolean) as AssignCandidate[];
  }

  /*
   * response.data
   */
  if (Array.isArray(result.data)) {
    return result.data
      .map(normalizeCandidate)
      .filter(Boolean) as AssignCandidate[];
  }

  /*
   * response.data.candidates
   */
  if (
    result.data &&
    !Array.isArray(result.data) &&
    Array.isArray(
      result.data.candidates
    )
  ) {
    return result.data.candidates
      .map(normalizeCandidate)
      .filter(Boolean) as AssignCandidate[];
  }

  /*
   * response.data.items
   */
  if (
    result.data &&
    !Array.isArray(result.data) &&
    Array.isArray(
      result.data.items
    )
  ) {
    return result.data.items
      .map(normalizeCandidate)
      .filter(Boolean) as AssignCandidate[];
  }

  /*
   * response.data.results
   */
  if (
    result.data &&
    !Array.isArray(result.data) &&
    Array.isArray(
      result.data.results
    )
  ) {
    return result.data.results
      .map(normalizeCandidate)
      .filter(Boolean) as AssignCandidate[];
  }

  /*
   * response.data.data
   */
  if (
    result.data &&
    !Array.isArray(result.data) &&
    Array.isArray(
      result.data.data
    )
  ) {
    return result.data.data
      .map(normalizeCandidate)
      .filter(Boolean) as AssignCandidate[];
  }

  return [];
}

function normalizeCandidate(
  candidate: unknown
): AssignCandidate | null {
  if (!candidate) {
    return null;
  }

  const value =
    candidate as Record<
      string,
      unknown
    >;

  const id =
    value.id ||
    value._id;

  if (!id) {
    return null;
  }

  return {
    ...(value as unknown as AssignCandidate),

    id: String(id),

    _id: value._id
      ? String(value._id)
      : undefined,

    name:
      typeof value.name ===
      "string"
        ? value.name
        : "Unnamed Candidate",

    email:
      typeof value.email ===
      "string"
        ? value.email
        : "",

    phone:
      typeof value.phone ===
      "string"
        ? value.phone
        : "",

    location:
      typeof value.location ===
      "string"
        ? value.location
        : "",

    role:
      typeof value.role ===
      "string"
        ? value.role
        : "",

    skills: Array.isArray(
      value.skills
    )
      ? value.skills.filter(
          (skill): skill is string =>
            typeof skill === "string"
        )
      : [],
  };
}

/* =========================================================
   COMPONENT
========================================================= */

export default function ProjectAssignModal({
  open,
  project,
  onClose,
  onAssigned,
  onSuccess,
  initialCandidateId = null,
}: ProjectAssignModalProps) {
  /* =======================================================
     STATE
  ======================================================= */

  const [candidates, setCandidates] =
    useState<AssignCandidate[]>([]);

  const [selectedCandidateId, setSelectedCandidateId] =
    useState<string>(
      initialCandidateId || ""
    );

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [assigning, setAssigning] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /* =======================================================
     PROJECT ID
  ======================================================= */

  const projectId =
    getProjectId(project);

  /* =======================================================
     SELECTED CANDIDATE
  ======================================================= */

  const selectedCandidate =
    useMemo(
      () =>
        candidates.find(
          (candidate) =>
            getCandidateId(
              candidate
            ) ===
            selectedCandidateId
        ) || null,
      [
        candidates,
        selectedCandidateId,
      ]
    );

  /* =======================================================
     FILTER CANDIDATES
  ======================================================= */

  const filteredCandidates =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return candidates;
      }

      return candidates.filter(
        (candidate) => {
          const name =
            candidate.name ||
            "";

          const email =
            candidate.email ||
            "";

          const phone =
            candidate.phone ||
            "";

          const role =
            candidate.role ||
            "";

          const location =
            candidate.location ||
            "";

          const skills =
            candidate.skills?.join(
              " "
            ) || "";

          const education =
            getEducationText(
              candidate
            );

          const searchable =
            [
              name,
              email,
              phone,
              role,
              location,
              skills,
              education,
            ]
              .join(" ")
              .toLowerCase();

          return searchable.includes(
            query
          );
        }
      );
    }, [candidates, search]);

  /* =======================================================
     LOAD CANDIDATES
  ======================================================= */

  const loadCandidates =
    useCallback(async () => {
      if (!open) {
        return;
      }

      setLoading(true);

      setError("");

      setSuccess("");

      try {
        /*
         * Approved candidates only.
         *
         * The service can internally map this
         * to your backend query.
         */
        const response =
          await candidateService.getCandidates(
            {
              status: "approved",
              page: 1,
              pageSize: 100,
            }
          );

        const normalized =
          normalizeCandidates(
            response
          );

        /*
         * Only approved candidates should
         * be available for assignment.
         *
         * If the backend already filters them,
         * this is harmless.
         */
        const approved =
          normalized.filter(
            (candidate) => {
              if (
                !candidate.status
              ) {
                return true;
              }

              return (
                candidate.status.toLowerCase() ===
                  "approved" ||
                candidate.status.toLowerCase() ===
                  "scheduled" ||
                candidate.status.toLowerCase() ===
                  "under_review"
              );
            }
          );

        setCandidates(
          approved
        );

        /*
         * Restore initial candidate if
         * supplied and available.
         */
        if (
          initialCandidateId &&
          approved.some(
            (candidate) =>
              getCandidateId(
                candidate
              ) ===
              initialCandidateId
          )
        ) {
          setSelectedCandidateId(
            initialCandidateId
          );
        } else {
          setSelectedCandidateId(
            ""
          );
        }
      } catch (err) {
        console.error(
          "Failed to load candidates:",
          err
        );

        setCandidates([]);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load approved candidates."
        );
      } finally {
        setLoading(false);
      }
    }, [
      open,
      initialCandidateId,
    ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSearch("");

    setError("");

    setSuccess("");

    loadCandidates();
  }, [
    open,
    loadCandidates,
  ]);

  /* =======================================================
     ESCAPE
  ======================================================= */

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key === "Escape" &&
        !assigning
      ) {
        onClose();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    open,
    assigning,
    onClose,
  ]);

  /* =======================================================
     ASSIGN PROJECT
  ======================================================= */

  const handleAssign = async () => {
    if (assigning) {
      return;
    }

    setError("");

    setSuccess("");

    /* -----------------------------------------------------
       VALIDATE PROJECT
    ----------------------------------------------------- */

    if (!projectId) {
      setError(
        "Project ID is missing. Please close this window and try again."
      );

      return;
    }

    /* -----------------------------------------------------
       VALIDATE CANDIDATE
    ----------------------------------------------------- */

    if (
      !selectedCandidateId
    ) {
      setError(
        "Please select a student before assigning the project."
      );

      return;
    }

    /* -----------------------------------------------------
       ASSIGN
    ----------------------------------------------------- */

    setAssigning(true);

    try {
      await projectService.assignProjectToCandidate(
        projectId,
        selectedCandidateId
      );

      setSuccess(
        `Project assigned successfully to ${
          selectedCandidate?.name ||
          "the selected student"
        }.`
      );

      /*
       * Notify parent.
       */
      if (selectedCandidate) {
        await onAssigned?.(
          selectedCandidate
        );
      }

      await onSuccess?.();

      /*
       * Keep success visible briefly
       * before closing.
       */
      window.setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      console.error(
        "Failed to assign project:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to assign project. Please try again."
      );
    } finally {
      setAssigning(false);
    }
  };

  /* =======================================================
     DON'T RENDER
  ======================================================= */

  if (!open) {
    return null;
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div
      className="
        fixed
        inset-0
        z-[65]
        flex
        items-center
        justify-center
        bg-slate-950/60
        p-4
        backdrop-blur-sm
      "
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !assigning
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-project-title"
        className="
          flex
          max-h-[90vh]
          w-full
          max-w-2xl
          flex-col
          overflow-hidden
          rounded-2xl
          bg-white
          shadow-2xl
          dark:bg-[#11151d]
        "
      >
        {/* =================================================
            HEADER
        ================================================= */}

        <div
          className="
            flex
            shrink-0
            items-center
            justify-between
            border-b
            border-slate-200
            px-5
            py-4
            dark:border-white/10
          "
        >
          <div>
            <div className="flex items-center gap-2">
              <div
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-lg
                  bg-indigo-600
                  text-white
                "
              >
                <GraduationCap
                  size={18}
                />
              </div>

              <div>
                <h2
                  id="assign-project-title"
                  className="
                    text-sm
                    font-semibold
                    text-slate-900
                    dark:text-white
                  "
                >
                  Assign Project
                </h2>

                <p
                  className="
                    mt-0.5
                    text-xs
                    text-slate-500
                    dark:text-slate-400
                  "
                >
                  Select an approved student
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={assigning}
            aria-label="Close"
            className="
              rounded-lg
              p-2
              text-slate-400
              hover:bg-slate-100
              hover:text-slate-700
              disabled:opacity-50
              dark:hover:bg-white/5
              dark:hover:text-white
            "
          >
            <X size={18} />
          </button>
        </div>

        {/* =================================================
            PROJECT INFORMATION
        ================================================= */}

        <div
          className="
            shrink-0
            border-b
            border-slate-200
            bg-slate-50/70
            px-5
            py-3
            dark:border-white/10
            dark:bg-[#0d1118]
          "
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p
                className="
                  text-[11px]
                  font-medium
                  uppercase
                  tracking-wide
                  text-slate-400
                "
              >
                Project
              </p>

              <p
                className="
                  mt-1
                  truncate
                  text-sm
                  font-semibold
                  text-slate-800
                  dark:text-white
                "
              >
                {project?.title ||
                  project?.name ||
                  "Selected Project"}
              </p>
            </div>

            {project?.role && (
              <span
                className="
                  shrink-0
                  rounded-full
                  bg-indigo-50
                  px-2.5
                  py-1
                  text-[11px]
                  font-medium
                  text-indigo-700
                  dark:bg-indigo-500/10
                  dark:text-indigo-300
                "
              >
                {project.role}
              </span>
            )}
          </div>
        </div>

        {/* =================================================
            CONTENT
        ================================================= */}

        <div
          className="
            min-h-0
            flex-1
            overflow-y-auto
            p-5
          "
        >
          <div className="space-y-4">
            {/* ---------------------------------------------
                SEARCH
            ---------------------------------------------- */}

            <div className="relative">
              <Search
                size={17}
                className="
                  pointer-events-none
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  text-slate-400
                "
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search student by name, email, phone, skill..."
                disabled={
                  loading ||
                  assigning
                }
                className="
                  w-full
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  py-3
                  pl-10
                  pr-3
                  text-sm
                  outline-none
                  focus:border-indigo-500
                  focus:ring-2
                  focus:ring-indigo-500/10
                  disabled:opacity-50
                  dark:border-white/10
                  dark:bg-[#151a23]
                  dark:text-white
                "
              />
            </div>

            {/* ---------------------------------------------
                ERROR
            ---------------------------------------------- */}

            {error && (
              <div
                role="alert"
                className="
                  flex
                  items-start
                  gap-2
                  rounded-xl
                  border
                  border-red-200
                  bg-red-50
                  px-3
                  py-3
                  text-sm
                  text-red-700
                  dark:border-red-500/20
                  dark:bg-red-500/10
                  dark:text-red-400
                "
              >
                <AlertCircle
                  size={16}
                  className="mt-0.5 shrink-0"
                />

                <span>
                  {error}
                </span>
              </div>
            )}

            {/* ---------------------------------------------
                SUCCESS
            ---------------------------------------------- */}

            {success && (
              <div
                role="status"
                className="
                  flex
                  items-start
                  gap-2
                  rounded-xl
                  border
                  border-emerald-200
                  bg-emerald-50
                  px-3
                  py-3
                  text-sm
                  text-emerald-700
                  dark:border-emerald-500/20
                  dark:bg-emerald-500/10
                  dark:text-emerald-400
                "
              >
                <CheckCircle2
                  size={16}
                  className="mt-0.5 shrink-0"
                />

                <span>
                  {success}
                </span>
              </div>
            )}

            {/* ---------------------------------------------
                LOADING
            ---------------------------------------------- */}

            {loading ? (
              <div
                className="
                  flex
                  min-h-[280px]
                  items-center
                  justify-center
                "
              >
                <div className="text-center">
                  <Loader2
                    size={28}
                    className="
                      mx-auto
                      animate-spin
                      text-indigo-600
                    "
                  />

                  <p
                    className="
                      mt-3
                      text-sm
                      font-medium
                      text-slate-700
                      dark:text-slate-300
                    "
                  >
                    Loading approved students...
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-slate-400
                    "
                  >
                    Please wait
                  </p>
                </div>
              </div>
            ) : filteredCandidates.length ===
              0 ? (
              /* -------------------------------------------
                  EMPTY
              -------------------------------------------- */

              <div
                className="
                  flex
                  min-h-[280px]
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-dashed
                  border-slate-300
                  bg-slate-50
                  p-6
                  dark:border-white/10
                  dark:bg-white/[0.02]
                "
              >
                <div className="max-w-sm text-center">
                  <div
                    className="
                      mx-auto
                      flex
                      h-12
                      w-12
                      items-center
                      justify-center
                      rounded-full
                      bg-slate-200
                      text-slate-500
                      dark:bg-white/5
                      dark:text-slate-400
                    "
                  >
                    <UserRound
                      size={21}
                    />
                  </div>

                  <h3
                    className="
                      mt-3
                      text-sm
                      font-semibold
                      text-slate-800
                      dark:text-white
                    "
                  >
                    {search
                      ? "No students found"
                      : "No approved students available"}
                  </h3>

                  <p
                    className="
                      mt-1
                      text-xs
                      leading-5
                      text-slate-500
                      dark:text-slate-400
                    "
                  >
                    {search
                      ? "Try a different name, email, phone number or skill."
                      : "Only approved candidates are available for project assignment."}
                  </p>

                  {search && (
                    <button
                      type="button"
                      onClick={() =>
                        setSearch("")
                      }
                      className="
                        mt-3
                        text-xs
                        font-medium
                        text-indigo-600
                        hover:text-indigo-700
                        dark:text-indigo-400
                      "
                    >
                      Clear search
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* -------------------------------------------
                  CANDIDATE LIST
              -------------------------------------------- */

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p
                    className="
                      text-xs
                      font-medium
                      text-slate-500
                      dark:text-slate-400
                    "
                  >
                    {filteredCandidates.length}{" "}
                    student
                    {filteredCandidates.length !==
                    1
                      ? "s"
                      : ""}{" "}
                    available
                  </p>

                  {selectedCandidate && (
                    <p
                      className="
                        text-xs
                        font-medium
                        text-indigo-600
                        dark:text-indigo-400
                      "
                    >
                      1 selected
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  {filteredCandidates.map(
                    (candidate) => {
                      const candidateId =
                        getCandidateId(
                          candidate
                        );

                      const selected =
                        candidateId ===
                        selectedCandidateId;

                      const education =
                        getEducationText(
                          candidate
                        );

                      const educationSecondary =
                        getEducationSecondaryText(
                          candidate
                        );

                      return (
                        <button
                          key={candidateId}
                          type="button"
                          onClick={() =>
                            setSelectedCandidateId(
                              candidateId
                            )
                          }
                          disabled={
                            assigning
                          }
                          className={`
                            w-full
                            rounded-xl
                            border
                            p-3
                            text-left
                            transition
                            ${
                              selected
                                ? "border-indigo-300 bg-indigo-50/70 ring-2 ring-indigo-500/10 dark:border-indigo-500/40 dark:bg-indigo-500/10"
                                : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50 dark:border-white/10 dark:bg-[#151a23] dark:hover:border-indigo-500/20 dark:hover:bg-white/[0.03]"
                            }
                            disabled:cursor-not-allowed
                            disabled:opacity-60
                          `}
                        >
                          <div className="flex items-start gap-3">
                            {/* AVATAR */}

                            <div
                              className={`
                                flex
                                h-10
                                w-10
                                shrink-0
                                items-center
                                justify-center
                                rounded-xl
                                ${
                                  selected
                                    ? "bg-indigo-600 text-white"
                                    : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400"
                                }
                              `}
                            >
                              {selected ? (
                                <Check
                                  size={18}
                                />
                              ) : (
                                <UserRound
                                  size={18}
                                />
                              )}
                            </div>

                            {/* INFO */}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p
                                    className="
                                      truncate
                                      text-sm
                                      font-semibold
                                      text-slate-800
                                      dark:text-white
                                    "
                                  >
                                    {candidate.name ||
                                      "Unnamed Candidate"}
                                  </p>

                                  {candidate.role && (
                                    <p
                                      className="
                                        mt-0.5
                                        truncate
                                        text-xs
                                        text-slate-500
                                        dark:text-slate-400
                                      "
                                    >
                                      {
                                        candidate.role
                                      }
                                    </p>
                                  )}
                                </div>

                                {typeof candidate.jdMatchScore ===
                                  "number" && (
                                  <span
                                    className="
                                      shrink-0
                                      rounded-full
                                      bg-emerald-50
                                      px-2
                                      py-1
                                      text-[10px]
                                      font-semibold
                                      text-emerald-700
                                      dark:bg-emerald-500/10
                                      dark:text-emerald-400
                                    "
                                  >
                                    {
                                      candidate.jdMatchScore
                                    }
                                    % match
                                  </span>
                                )}
                              </div>

                              {/* CONTACT */}

                              <div
                                className="
                                  mt-2
                                  grid
                                  grid-cols-1
                                  gap-1
                                  sm:grid-cols-2
                                "
                              >
                                {candidate.email && (
                                  <p
                                    className="
                                      truncate
                                      text-[11px]
                                      text-slate-500
                                      dark:text-slate-400
                                    "
                                  >
                                    {
                                      candidate.email
                                    }
                                  </p>
                                )}

                                {candidate.phone && (
                                  <p
                                    className="
                                      truncate
                                      text-[11px]
                                      text-slate-500
                                      dark:text-slate-400
                                    "
                                  >
                                    {
                                      candidate.phone
                                    }
                                  </p>
                                )}
                              </div>

                              {/* EDUCATION */}

                              {(education ||
                                educationSecondary) && (
                                <div className="mt-2 flex items-start gap-1.5">
                                  <GraduationCap
                                    size={13}
                                    className="
                                      mt-0.5
                                      shrink-0
                                      text-slate-400
                                    "
                                  />

                                  <div className="min-w-0">
                                    {education && (
                                      <p
                                        className="
                                          truncate
                                          text-[11px]
                                          font-medium
                                          text-slate-600
                                          dark:text-slate-300
                                        "
                                      >
                                        {
                                          education
                                        }
                                      </p>
                                    )}

                                    {educationSecondary &&
                                      educationSecondary !==
                                        education && (
                                        <p
                                          className="
                                            truncate
                                            text-[10px]
                                            text-slate-400
                                          "
                                        >
                                          {
                                            educationSecondary
                                          }
                                        </p>
                                      )}
                                  </div>
                                </div>
                              )}

                              {/* SKILLS */}

                              {candidate.skills &&
                                candidate.skills.length >
                                  0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {candidate.skills
                                      .slice(
                                        0,
                                        5
                                      )
                                      .map(
                                        (
                                          skill
                                        ) => (
                                          <span
                                            key={
                                              skill
                                            }
                                            className="
                                              rounded-md
                                              bg-slate-100
                                              px-1.5
                                              py-0.5
                                              text-[10px]
                                              text-slate-500
                                              dark:bg-white/5
                                              dark:text-slate-400
                                            "
                                          >
                                            {
                                              skill
                                            }
                                          </span>
                                        )
                                      )}

                                    {candidate
                                      .skills
                                      .length >
                                      5 && (
                                      <span
                                        className="
                                          rounded-md
                                          bg-slate-100
                                          px-1.5
                                          py-0.5
                                          text-[10px]
                                          text-slate-400
                                          dark:bg-white/5
                                        "
                                      >
                                        +
                                        {candidate
                                          .skills
                                          .length -
                                          5}
                                      </span>
                                    )}
                                  </div>
                                )}
                            </div>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <div
          className="
            flex
            shrink-0
            items-center
            justify-between
            gap-3
            border-t
            border-slate-200
            px-5
            py-4
            dark:border-white/10
          "
        >
          <div className="min-w-0">
            {selectedCandidate ? (
              <p
                className="
                  truncate
                  text-xs
                  text-slate-500
                  dark:text-slate-400
                "
              >
                Selected:{" "}
                <span
                  className="
                    font-medium
                    text-slate-700
                    dark:text-slate-200
                  "
                >
                  {
                    selectedCandidate.name
                  }
                </span>
              </p>
            ) : (
              <p
                className="
                  text-xs
                  text-slate-400
                "
              >
                Select a student to continue
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={assigning}
              className="
                rounded-xl
                border
                border-slate-200
                px-4
                py-2.5
                text-sm
                font-medium
                text-slate-700
                hover:bg-slate-50
                disabled:opacity-50
                dark:border-white/10
                dark:text-slate-300
                dark:hover:bg-white/5
              "
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={
                handleAssign
              }
              disabled={
                assigning ||
                loading ||
                !selectedCandidateId ||
                !projectId
              }
              className="
                inline-flex
                items-center
                gap-2
                rounded-xl
                bg-indigo-600
                px-4
                py-2.5
                text-sm
                font-medium
                text-white
                hover:bg-indigo-700
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              {assigning ? (
                <>
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Assigning...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Assign Project
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}