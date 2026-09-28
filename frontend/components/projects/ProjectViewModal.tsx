
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  FileText,
  GraduationCap,
  Pencil,
  UserPlus,
  X,
} from "lucide-react";

/* ==========================================================================
   TYPES
   ========================================================================== */

export interface ViewProject {
  _id?: string;
  id?: string;

  title?: string;
  name?: string;

  role?: string;
  difficulty?: string;

  description?: string;
  projectDescription?: string;

  projectType?: string;
  type?: string;

  duration?: string | number;
  durationDays?: string | number;

  focus?: string;
  projectFocus?: string;

  technologies?: unknown;
  techStack?: unknown;
  technology?: unknown;

  requirements?: unknown;
  functionalRequirements?: unknown;

  status?: string;

  briefUrl?: string;
  pdfUrl?: string;
  detailedPdfUrl?: string;
  generatedPdfUrl?: string;
  documentUrl?: string;
  projectPdfUrl?: string;
  pdf?: unknown;
  document?: unknown;

  studentId?: string;
  studentName?: string;

  assignedCandidateId?: string;
  assignedStudentId?: string;

  student?: unknown;
  candidate?: unknown;
  assignedStudent?: unknown;
  assignedCandidate?: unknown;
  assignedTo?: unknown;

  createdAt?: string;
  updatedAt?: string;

  [key: string]: unknown;
}

interface ProjectViewModalProps {
  open: boolean;
  project: ViewProject | null;

  onClose: () => void;

  onEdit?: (project: ViewProject) => void;

  onAssign?: (project: ViewProject) => void;

  onPreviewPdf?: (project: ViewProject) => void;
}

/* ==========================================================================
   NORMALIZED DATA
   ========================================================================== */

interface NormalizedProject {
  id: string;

  title: string;
  role: string;
  difficulty: string;

  description: string;

  projectType: string;
  duration: string;

  focus: string;

  technologies: string[];
  requirements: string[];

  status: string;

  pdfUrl: string;

  studentId: string;
  studentName: string;

  createdAt: string;
  updatedAt: string;
}

/* ==========================================================================
   BASIC HELPERS
   ========================================================================== */

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return String(value);
    }
  }

  return "";
}

function getNestedValue(
  source: unknown,
  keys: string[]
): unknown {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  let current: unknown = source;

  for (const key of keys) {
    if (
      !current ||
      typeof current !== "object" ||
      !(key in current)
    ) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/* ==========================================================================
   ID
   ========================================================================== */

function getProjectId(project: ViewProject): string {
  return firstString(
    project._id,
    project.id,
    project.projectId
  );
}

/* ==========================================================================
   STRING ARRAY NORMALIZATION
   ========================================================================== */

function normalizeStringArray(
  value: unknown
): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    const result: string[] = [];

    for (const item of value) {
      if (
        typeof item === "string" &&
        item.trim()
      ) {
        result.push(item.trim());
        continue;
      }

      if (
        typeof item === "number" &&
        Number.isFinite(item)
      ) {
        result.push(String(item));
        continue;
      }

      if (
        item &&
        typeof item === "object"
      ) {
        const object = item as Record<
          string,
          unknown
        >;

        const text = firstString(
          object.name,
          object.title,
          object.label,
          object.value,
          object.technology,
          object.tech,
          object.description
        );

        if (text) {
          result.push(text);
        }
      }
    }

    return Array.from(
      new Set(result)
    );
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    /*
     * Support JSON arrays stored as strings.
     */
    if (
      trimmed.startsWith("[") &&
      trimmed.endsWith("]")
    ) {
      try {
        const parsed = JSON.parse(trimmed);

        if (Array.isArray(parsed)) {
          return normalizeStringArray(parsed);
        }
      } catch {
        // Continue with comma splitting.
      }
    }

    /*
     * Support comma-separated values.
     */
    return Array.from(
      new Set(
        trimmed
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  }

  return [];
}

/* ==========================================================================
   TECHNOLOGIES
   ========================================================================== */

function getTechnologies(
  project: ViewProject
): string[] {
  const possibleValues = [
    project.technologies,
    project.techStack,
    project.technology,

    project.technologiesList,

    getNestedValue(
      project,
      ["data", "technologies"]
    ),

    getNestedValue(
      project,
      ["data", "techStack"]
    ),
  ];

  for (const value of possibleValues) {
    const normalized =
      normalizeStringArray(value);

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
}

/* ==========================================================================
   REQUIREMENTS
   ========================================================================== */

function getRequirements(
  project: ViewProject
): string[] {
  const possibleValues = [
    project.requirements,
    project.functionalRequirements,

    project.requirement,

    getNestedValue(
      project,
      ["data", "requirements"]
    ),

    getNestedValue(
      project,
      ["output", "requirements"]
    ),
  ];

  for (const value of possibleValues) {
    const normalized =
      normalizeStringArray(value);

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
}

/* ==========================================================================
   STUDENT INFORMATION
   ========================================================================== */

function extractPerson(
  value: unknown
): {
  id: string;
  name: string;
} {
  if (!value) {
    return {
      id: "",
      name: "",
    };
  }

  if (typeof value === "string") {
    return {
      id: value,
      name: "",
    };
  }

  if (
    typeof value !== "object"
  ) {
    return {
      id: "",
      name: "",
    };
  }

  const object =
    value as Record<string, unknown>;

  const id = firstString(
    object._id,
    object.id,
    object.studentId,
    object.candidateId,
    object.userId
  );

  const name = firstString(
    object.name,
    object.fullName,
    object.studentName,
    object.candidateName,
    object.displayName
  );

  return {
    id,
    name,
  };
}

function getStudentInfo(
  project: ViewProject
): {
  id: string;
  name: string;
} {
  /*
   * First check direct fields.
   */
  let id = firstString(
    project.studentId,
    project.assignedStudentId,
    project.assignedCandidateId
  );

  let name = firstString(
    project.studentName,
    project.assignedStudentName,
    project.candidateName
  );

  /*
   * Then check nested objects.
   */
  const possiblePeople = [
    project.student,
    project.candidate,
    project.assignedStudent,
    project.assignedCandidate,
    project.assignedTo,

    getNestedValue(
      project,
      ["assignment", "student"]
    ),

    getNestedValue(
      project,
      ["assignment", "candidate"]
    ),

    getNestedValue(
      project,
      ["assignedTo", "student"]
    ),

    getNestedValue(
      project,
      ["data", "student"]
    ),
  ];

  for (const person of possiblePeople) {
    const extracted =
      extractPerson(person);

    if (!id && extracted.id) {
      id = extracted.id;
    }

    if (!name && extracted.name) {
      name = extracted.name;
    }

    if (id && name) {
      break;
    }
  }

  return {
    id,
    name,
  };
}

/* ==========================================================================
   PDF URL
   ========================================================================== */

function extractPdfUrl(
  value: unknown
): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (
    typeof value !== "object"
  ) {
    return "";
  }

  const object =
    value as Record<string, unknown>;

  return firstString(
    object.url,
    object.href,
    object.path,
    object.fileUrl,
    object.filePath,
    object.pdfUrl,
    object.downloadUrl
  );
}

function getPdfSource(
  project: ViewProject
): string {
  const possibleValues = [
    project.detailedPdfUrl,
    project.generatedPdfUrl,
    project.projectPdfUrl,
    project.pdfUrl,
    project.briefUrl,
    project.documentUrl,

    extractPdfUrl(project.pdf),
    extractPdfUrl(project.document),

    extractPdfUrl(
      getNestedValue(
        project,
        ["pdf", "file"]
      )
    ),

    extractPdfUrl(
      getNestedValue(
        project,
        ["document", "file"]
      )
    ),

    extractPdfUrl(
      getNestedValue(
        project,
        ["data", "pdf"]
      )
    ),
  ];

  for (const value of possibleValues) {
    const url = extractPdfUrl(value);

    if (url) {
      return url;
    }
  }

  return "";
}

function resolvePdfUrl(
  value?: string
): string {
  if (!value) {
    return "";
  }

  let url = value.trim();

  if (!url) {
    return "";
  }

  /*
   * Remove accidental surrounding quotes.
   */
  url = url.replace(
    /^["']|["']$/g,
    ""
  );

  /*
   * Already absolute.
   */
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  ) {
    return url;
  }

  /*
   * Protocol-relative URL.
   */
  if (url.startsWith("//")) {
    return `${window.location.protocol}${url}`;
  }

  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_URL
      ?.replace(/\/+$/, "") || "";

  /*
   * Backend configured.
   */
  if (apiBaseUrl) {
    if (url.startsWith("/")) {
      return `${apiBaseUrl}${url}`;
    }

    return `${apiBaseUrl}/${url}`;
  }

  /*
   * Same-origin fallback.
   */
  if (url.startsWith("/")) {
    return url;
  }

  return `/${url}`;
}

/* ==========================================================================
   DURATION
   ========================================================================== */

function getDuration(
  project: ViewProject
): string {
  const direct = firstString(
    project.duration,
    project.durationDays
  );

  if (direct) {
    return direct;
  }

  const nested = firstString(
    getNestedValue(
      project,
      ["data", "duration"]
    ),
    getNestedValue(
      project,
      ["data", "durationDays"]
    )
  );

  if (nested) {
    return nested;
  }

  return "";
}

/* ==========================================================================
   NORMALIZE PROJECT
   ========================================================================== */

function normalizeProject(
  project: ViewProject
): NormalizedProject {
  const student =
    getStudentInfo(project);

  return {
    id: getProjectId(project),

    title: firstString(
      project.title,
      project.name,
      getNestedValue(
        project,
        ["data", "title"]
      ),
      getNestedValue(
        project,
        ["data", "name"]
      )
    ),

    role: firstString(
      project.role,
      getNestedValue(
        project,
        ["data", "role"]
      )
    ),

    difficulty: firstString(
      project.difficulty,
      getNestedValue(
        project,
        ["data", "difficulty"]
      )
    ),

    description: firstString(
      project.description,
      project.projectDescription,
      getNestedValue(
        project,
        ["data", "description"]
      )
    ),

    projectType: firstString(
      project.projectType,
      project.type,
      getNestedValue(
        project,
        ["data", "projectType"]
      ),
      getNestedValue(
        project,
        ["data", "type"]
      )
    ),

    duration: getDuration(project),

    focus: firstString(
      project.focus,
      project.projectFocus,
      getNestedValue(
        project,
        ["data", "focus"]
      ),
      getNestedValue(
        project,
        ["data", "projectFocus"]
      )
    ),

    technologies:
      getTechnologies(project),

    requirements:
      getRequirements(project),

    status: firstString(
      project.status,
      getNestedValue(
        project,
        ["data", "status"]
      ),
      "created"
    ),

    pdfUrl: resolvePdfUrl(
      getPdfSource(project)
    ),

    studentId: student.id,
    studentName: student.name,

    createdAt: firstString(
      project.createdAt,
      getNestedValue(
        project,
        ["data", "createdAt"]
      )
    ),

    updatedAt: firstString(
      project.updatedAt,
      getNestedValue(
        project,
        ["data", "updatedAt"]
      )
    ),
  };
}

/* ==========================================================================
   FORMATTING
   ========================================================================== */

function formatValue(
  value?: string
): string {
  if (!value) {
    return "Not specified";
  }

  return value
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /\b\w/g,
      (char) => char.toUpperCase()
    );
}

function formatDateTime(
  value?: string
): string {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not available";
  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

/* ==========================================================================
   STATUS
   ========================================================================== */

function getStatusClasses(
  status?: string
): string {
  const normalized =
    (status || "")
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");

  if (
    normalized === "completed" ||
    normalized === "active" ||
    normalized === "assigned"
  ) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  }

  if (
    normalized === "in_progress" ||
    normalized === "ongoing" ||
    normalized === "started"
  ) {
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  }

  if (
    normalized === "archived" ||
    normalized === "cancelled" ||
    normalized === "canceled"
  ) {
    return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
  }

  return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
}

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export default function ProjectViewModal({
  open,
  project,
  onClose,
  onEdit,
  onAssign,
  onPreviewPdf,
}: ProjectViewModalProps) {
  const [pdfLoading, setPdfLoading] =
    useState(false);

  const [pdfError, setPdfError] =
    useState(false);

  /*
   * Normalize the project ONCE whenever
   * the project object changes.
   */
  const normalizedProject =
    useMemo(() => {
      if (!project) {
        return null;
      }

      return normalizeProject(project);
    }, [project]);

  /*
   * Reset PDF state.
   */
  useEffect(() => {
    if (!open) {
      setPdfLoading(false);
      setPdfError(false);
      return;
    }

    setPdfError(false);

    setPdfLoading(
      Boolean(
        normalizedProject?.pdfUrl
      )
    );
  }, [
    open,
    normalizedProject?.pdfUrl,
  ]);

  /*
   * Escape key.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [open, onClose]);

  /*
   * Prevent background scrolling.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [open]);

  if (
    !open ||
    !project ||
    !normalizedProject
  ) {
    return null;
  }

  const data =
    normalizedProject;

  const isAssigned =
    Boolean(data.studentId) ||
    Boolean(data.studentName);

  const handleBackdropClick = (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (
      event.target ===
      event.currentTarget
    ) {
      onClose();
    }
  };

  const handleOpenPdf = () => {
    if (!data.pdfUrl) {
      return;
    }

    window.open(
      data.pdfUrl,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleDownloadPdf = () => {
    if (!data.pdfUrl) {
      return;
    }

    const link =
      document.createElement("a");

    link.href = data.pdfUrl;
    link.target = "_blank";
    link.rel =
      "noopener noreferrer";

    const safeTitle =
      data.title
        .replace(
          /[^a-z0-9]+/gi,
          "-"
        )
        .replace(
          /^-+|-+$/g,
          ""
        ) || "project";

    link.download =
      `${safeTitle}-details.pdf`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center bg-black/60 px-4 py-5 backdrop-blur-sm"
      onMouseDown={
        handleBackdropClick
      }
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-view-title"
    >
      <div
        className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        {/* ================================================================
            HEADER
        ================================================================= */}

        <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-700">
          <div className="min-w-0 pr-8">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                  data.status
                )}`}
              >
                {formatValue(
                  data.status
                )}
              </span>

              {isAssigned && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  <UserPlus className="h-3.5 w-3.5" />
                  Assigned
                </span>
              )}
            </div>

            <h2
              id="project-view-title"
              className="break-words text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl"
            >
              {data.title ||
                "Untitled Project"}
            </h2>

            {data.role && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {data.role}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close project details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ================================================================
            CONTENT
        ================================================================= */}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-5">

            {/* ============================================================
                LEFT
            ============================================================= */}

            <div className="space-y-6 lg:col-span-3">

              {/* OVERVIEW */}

              <section>
                <SectionHeading
                  icon={
                    <FileText className="h-4 w-4" />
                  }
                  title="Project Overview"
                />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoCard
                    label="Project Type"
                    value={
                      formatValue(
                        data.projectType
                      )
                    }
                  />

                  <InfoCard
                    label="Difficulty"
                    value={
                      formatValue(
                        data.difficulty
                      )
                    }
                  />

                  <InfoCard
                    label="Duration"
                    value={
                      data.duration ||
                      "Not specified"
                    }
                  />

                  <InfoCard
                    label="Role"
                    value={
                      data.role ||
                      "Not specified"
                    }
                  />
                </div>
              </section>

              {/* DESCRIPTION */}

              <section>
                <SectionHeading
                  icon={
                    <FileText className="h-4 w-4" />
                  }
                  title="Description"
                />

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                  {data.description ? (
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {data.description}
                    </p>
                  ) : (
                    <EmptyText text="No description available." />
                  )}
                </div>
              </section>

              {/* FOCUS */}

              {data.focus && (
                <section>
                  <SectionHeading
                    icon={
                      <Eye className="h-4 w-4" />
                    }
                    title="Project Focus"
                  />

                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {data.focus}
                    </p>
                  </div>
                </section>
              )}

              {/* TECHNOLOGIES */}

              <section>
                <SectionHeading
                  icon={
                    <CheckCircle2 className="h-4 w-4" />
                  }
                  title="Technologies"
                />

                {data.technologies.length >
                0 ? (
                  <div className="flex flex-wrap gap-2">
                    {data.technologies.map(
                      (
                        technology,
                        index
                      ) => (
                        <span
                          key={`${technology}-${index}`}
                          className="max-w-full break-words rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                        >
                          {technology}
                        </span>
                      )
                    )}
                  </div>
                ) : (
                  <EmptyText text="No technologies specified." />
                )}
              </section>

              {/* REQUIREMENTS */}

              <section>
                <SectionHeading
                  icon={
                    <CheckCircle2 className="h-4 w-4" />
                  }
                  title="Requirements"
                />

                {data.requirements.length >
                0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                    <ul className="space-y-3">
                      {data.requirements.map(
                        (
                          requirement,
                          index
                        ) => (
                          <li
                            key={`${requirement}-${index}`}
                            className="flex items-start gap-3 text-sm leading-6 text-slate-600 dark:text-slate-300"
                          >
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />

                            <span className="min-w-0 break-words">
                              {
                                requirement
                              }
                            </span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                ) : (
                  <EmptyText text="No requirements specified." />
                )}
              </section>
            </div>

            {/* ============================================================
                RIGHT
            ============================================================= */}

            <div className="space-y-6 lg:col-span-2">

              {/* STUDENT */}

              <section>
                <SectionHeading
                  icon={
                    <GraduationCap className="h-4 w-4" />
                  }
                  title="Student Assignment"
                />

                {isAssigned ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                    <div className="flex items-start gap-3">

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
                        <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
                          Assigned Student
                        </p>

                        <p className="mt-1 break-words font-medium text-slate-900 dark:text-white">
                          {data.studentName ||
                            "Student assigned"}
                        </p>

                        {data.studentId && (
                          <p className="mt-1 break-all font-mono text-xs text-slate-500 dark:text-slate-400">
                            ID:{" "}
                            {
                              data.studentId
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <div className="flex items-start gap-3">
                      <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />

                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-300">
                          Not assigned
                        </p>

                        <p className="mt-1 text-sm leading-5 text-amber-700 dark:text-amber-400">
                          This project has not been assigned to a student yet.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* PDF */}

              <section>
                <SectionHeading
                  icon={
                    <FileText className="h-4 w-4" />
                  }
                  title="Project Document"
                />

                {data.pdfUrl ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">

                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Project PDF
                      </span>

                      <div className="flex flex-wrap items-center gap-1">

                        {onPreviewPdf && (
                          <button
                            type="button"
                            onClick={() =>
                              onPreviewPdf(
                                project
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Full Preview
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={
                            handleOpenPdf
                          }
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </button>

                        <button
                          type="button"
                          onClick={
                            handleDownloadPdf
                          }
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </button>
                      </div>
                    </div>

                    <div className="relative h-[420px] bg-slate-100 dark:bg-slate-950">

                      {pdfLoading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100 dark:bg-slate-950">
                          <div className="text-center">
                            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400" />

                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Loading PDF...
                            </p>
                          </div>
                        </div>
                      )}

                      {pdfError ? (
                        <div className="flex h-full items-center justify-center p-6">
                          <div className="max-w-sm text-center">

                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                            </div>

                            <h4 className="mt-4 font-medium text-slate-900 dark:text-white">
                              PDF preview unavailable
                            </h4>

                            <p className="mt-2 break-words text-sm leading-5 text-slate-500 dark:text-slate-400">
                              The PDF could not be displayed inside this window. You can open it in a new browser tab.
                            </p>

                            <button
                              type="button"
                              onClick={
                                handleOpenPdf
                              }
                              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Open PDF
                            </button>
                          </div>
                        </div>
                      ) : (
                        <iframe
                          key={
                            data.pdfUrl
                          }
                          src={
                            data.pdfUrl
                          }
                          title={`PDF for ${
                            data.title ||
                            "project"
                          }`}
                          className="h-full w-full border-0"
                          onLoad={() =>
                            setPdfLoading(
                              false
                            )
                          }
                          onError={() => {
                            setPdfLoading(
                              false
                            );
                            setPdfError(
                              true
                            );
                          }}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800/40">
                    <FileText className="mx-auto h-8 w-8 text-slate-400" />

                    <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                      No project PDF available
                    </p>

                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      A project document has not been generated or uploaded.
                    </p>
                  </div>
                )}
              </section>

              {/* METADATA */}

              <section>
                <SectionHeading
                  icon={
                    <CalendarDays className="h-4 w-4" />
                  }
                  title="Project Information"
                />

                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">

                  <MetadataRow
                    label="Project ID"
                    value={
                      data.id ||
                      "Not available"
                    }
                    mono
                  />

                  <MetadataRow
                    label="Created"
                    value={
                      formatDateTime(
                        data.createdAt
                      )
                    }
                  />

                  <MetadataRow
                    label="Last Updated"
                    value={
                      formatDateTime(
                        data.updatedAt
                      )
                    }
                    last
                  />
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* ================================================================
            FOOTER
        ================================================================= */}

        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Close
          </button>

          <div className="flex flex-col gap-2 sm:flex-row">

            {onEdit && (
              <button
                type="button"
                onClick={() =>
                  onEdit(project)
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Pencil className="h-4 w-4" />
                Edit Project
              </button>
            )}

            {onAssign &&
              !isAssigned && (
                <button
                  type="button"
                  onClick={() =>
                    onAssign(project)
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Assign Student
                </button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   UI COMPONENTS
   ========================================================================== */

function SectionHeading({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
        {icon}
      </div>

      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {title}
      </h3>
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function MetadataRow({
  label,
  value,
  mono = false,
  last = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 px-4 py-3 ${
        !last
          ? "border-b border-slate-200 dark:border-slate-700"
          : ""
      }`}
    >
      <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>

      <span
        className={`min-w-0 max-w-[70%] break-all text-right text-xs text-slate-700 dark:text-slate-300 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyText({
  text,
}: {
  text: string;
}) {
  return (
    <p className="text-sm text-slate-400 dark:text-slate-500">
      {text}
    </p>
  );
}
