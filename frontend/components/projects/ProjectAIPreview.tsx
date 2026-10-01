"use client";

import {
  AlertCircle,
  CheckCircle2,
  Code2,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  UserRound,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

/* =========================================================
   TYPES
========================================================= */

export interface GeneratedProject extends ProjectAIPreviewData {}

export type ProjectAIPreviewData = {
  id?: string;

  title: string;
  name?: string;

  role: string;

  difficulty:
    | "junior"
    | "mid"
    | "senior"
    | string;

  description: string;

  technologies: string[];

  briefUrl?: string;

  pdfUrl?: string;
  detailedPdfUrl?: string;

  // Temporary AI PDF
  pdfData?: string;
  pdfFilename?: string;

  projectType?: string;

  duration?: string | number;

  focus?: string | string[];

  requirements?: string[] | string;

  studentId?: string;
  studentName?: string;

  studentSkills?: string[];

  studentEducation?: {
    degree?: string;
    field?: string;
    institution?: string;
    college?: string;
    university?: string;
    year?: string | number;
    graduationYear?: string | number;
  };

  status?: "active" | "archived" | string;

  assigned?: number;

  sections?: unknown[];

  generationContext?: {
    projectType?: string;
    duration?: number;
    focus?: string[];
    requirements?: string;
    studentId?: string;
  };

  [key: string]: unknown;
};

export interface ProjectAIPreviewProps {
  open: boolean;

  onClose: () => void;

  project?: ProjectAIPreviewData | null;

  onEdit?: () => void;

  /**
   * Confirms the AI-generated draft and saves it.
   * The preview itself does not save anything to MongoDB.
   */
  onUseProject?: () => void | Promise<void>;

  onRegenerate?: () => void | Promise<void>;

  regenerating?: boolean;

  saving?: boolean;

  apiBaseUrl?: string;

  /**
   * Kept for backwards compatibility with existing callers.
   * PDF preview is automatic whenever pdfData/pdfUrl is available.
   */
  autoPreviewPdf?: boolean;
}

/* =========================================================
   HELPERS
========================================================= */

function getApiBaseUrl(
  explicitBaseUrl?: string
): string {
  /*
   * Priority:
   * 1. Explicit apiBaseUrl prop
   * 2. NEXT_PUBLIC_API_URL
   * 3. Local Express backend
   *
   * IMPORTANT:
   * PDF files are served by Express, not Next.js.
   * Therefore a relative URL such as:
   *
   * /uploads/projects/project-123.pdf
   *
   * must resolve to:
   *
   * http://localhost:5000/uploads/projects/project-123.pdf
   */
  if (explicitBaseUrl?.trim()) {
    return explicitBaseUrl
      .trim()
      .replace(/\/+$/, "");
  }

  if (
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_API_URL?.trim()
  ) {
    return process.env.NEXT_PUBLIC_API_URL
      .trim()
      .replace(/\/+$/, "");
  }

  return "http://localhost:5000";
}

/* =========================================================
   PDF URL RESOLVER
========================================================= */

function resolvePdfUrl(
  value: string | null | undefined,
  apiBaseUrl?: string
): string {
  if (!value) {
    return "";
  }

  const raw = value.trim();

  if (!raw) {
    return "";
  }

  /* Blob URL */

  if (raw.startsWith("blob:")) {
    return raw;
  }

  /* Data URL */

  if (raw.startsWith("data:")) {
    return raw;
  }

  /* Absolute URL */

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://")
  ) {
    return raw;
  }

  /* Protocol-relative URL */

  if (raw.startsWith("//")) {
    if (
      typeof window !== "undefined"
    ) {
      return `${window.location.protocol}${raw}`;
    }

    return raw;
  }

  const normalized =
    raw.replace(/\\/g, "/");

  const path =
    normalized.startsWith("/")
      ? normalized
      : `/${normalized}`;

  const baseUrl =
    getApiBaseUrl(apiBaseUrl);

  /*
   * Always return an absolute backend URL for
   * server-hosted files.
   */
  return `${baseUrl}${path}`;
}

/* =========================================================
   FORMAT LABEL
========================================================= */

function formatLabel(
  value: string
): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

/* =========================================================
   DETAIL ROW
========================================================= */

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span
        className="
          text-xs
          text-slate-400
        "
      >
        {label}
      </span>

      <span
        className="
          text-right
          text-xs
          font-medium
          capitalize
          text-slate-700
          dark:text-slate-300
        "
      >
        {formatLabel(value)}
      </span>
    </div>
  );
}

/* =========================================================
   PDF UNAVAILABLE
========================================================= */

function PdfUnavailable() {
  return (
    <div
      className="
        flex
        h-full
        items-center
        justify-center
        p-6
      "
    >
      <div
        className="
          max-w-md
          text-center
        "
      >
        <div
          className="
            mx-auto
            flex
            h-16
            w-16
            items-center
            justify-center
            rounded-2xl
            bg-slate-200
            text-slate-500
            dark:bg-white/5
            dark:text-slate-400
          "
        >
          <FileText size={28} />
        </div>

        <h3
          className="
            mt-4
            text-base
            font-semibold
            text-slate-800
            dark:text-white
          "
        >
          PDF is not available
        </h3>

        <p
          className="
            mt-2
            text-sm
            leading-6
            text-slate-500
            dark:text-slate-400
          "
        >
          The project was generated, but no PDF
          preview data or PDF URL was provided.
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   PDF ERROR
========================================================= */

function PdfError({
  onRetry,
  onOpen,
}: {
  onRetry: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      className="
        flex
        h-full
        items-center
        justify-center
        p-6
      "
    >
      <div
        className="
          max-w-md
          rounded-2xl
          border
          border-red-200
          bg-white
          p-6
          text-center
          shadow-sm
          dark:border-red-500/20
          dark:bg-[#151a23]
        "
      >
        <div
          className="
            mx-auto
            flex
            h-12
            w-12
            items-center
            justify-center
            rounded-full
            bg-red-50
            text-red-600
            dark:bg-red-500/10
            dark:text-red-400
          "
        >
          <AlertCircle size={23} />
        </div>

        <h3
          className="
            mt-4
            text-sm
            font-semibold
            text-slate-800
            dark:text-white
          "
        >
          Unable to preview PDF
        </h3>

        <p
          className="
            mt-2
            text-xs
            leading-5
            text-slate-500
            dark:text-slate-400
          "
        >
          The PDF data or URL exists, but the
          browser could not load the PDF. Try
          reloading the preview or opening the PDF
          in a new tab.
        </p>

        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="
              inline-flex
              items-center
              gap-1.5
              rounded-lg
              border
              border-slate-200
              px-3
              py-2
              text-xs
              font-medium
              text-slate-700
              hover:bg-slate-50
              dark:border-white/10
              dark:text-slate-300
              dark:hover:bg-white/5
            "
          >
            <RefreshCw size={13} />
            Retry
          </button>

          <button
            type="button"
            onClick={onOpen}
            className="
              inline-flex
              items-center
              gap-1.5
              rounded-lg
              bg-indigo-600
              px-3
              py-2
              text-xs
              font-medium
              text-white
              hover:bg-indigo-700
            "
          >
            <ExternalLink size={13} />
            Open PDF
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

/*
 * PDF lifecycle:
 *
 * AI Generate
 *   -> backend creates PDF in memory
 *   -> frontend receives pdfData
 *   -> this component previews pdfData
 *   -> admin clicks Confirm & Save
 *   -> parent calls the save API
 *   -> backend uploads the PDF to Cloudinary
 *   -> MongoDB stores the Cloudinary URL
 *
 * This component intentionally performs NO Cloudinary upload.
 */
export default function ProjectAIPreview({
  open,
  onClose,
  project,
  onEdit,
  onUseProject,
  onRegenerate,
  regenerating = false,
  saving = false,
  apiBaseUrl,
}: ProjectAIPreviewProps) {
  const [pdfLoading, setPdfLoading] =
    useState(true);

  const [pdfError, setPdfError] =
    useState(false);

  const [pdfReloadKey, setPdfReloadKey] =
    useState(0);

  /* =======================================================
     PROJECT DATA
  ======================================================= */

  const projectTitle =
    project?.title ||
    project?.name ||
    "Generated Project";

  const projectRole =
    project?.role ||
    "Not specified";

  const difficulty =
    project?.difficulty ||
    "Not specified";

  const description =
    project?.description ||
    "No project description was provided.";

  const technologies =
    Array.isArray(
      project?.technologies
    )
      ? project.technologies.filter(
          (item): item is string =>
            typeof item === "string" &&
            item.trim().length > 0
        )
      : [];

  const focus =
    Array.isArray(project?.focus)
      ? project.focus.filter(
          (item): item is string =>
            typeof item === "string" &&
            item.trim().length > 0
        )
      : typeof project?.focus === "string" &&
        project.focus.trim()
      ? [project.focus.trim()]
      : [];

  const studentSkills =
    Array.isArray(
      project?.studentSkills
    )
      ? project.studentSkills.filter(
          (item): item is string =>
            typeof item === "string" &&
            item.trim().length > 0
        )
      : [];

  const requirements =
    Array.isArray(project?.requirements)
      ? project.requirements
          .filter(
            (item): item is string =>
              typeof item === "string" &&
              item.trim().length > 0
          )
          .join("\n")
      : typeof project?.requirements === "string"
        ? project.requirements.trim()
        : "";

  const studentEducation =
    project?.studentEducation;

  /* =======================================================
     PDF URL
  ======================================================= */

  const pdfUrl = useMemo(() => {
    /*
     * Preview priority:
     * 1. Temporary in-memory PDF data generated by AI.
     * 2. Existing detailed PDF URL.
     * 3. Existing PDF URL.
     *
     * IMPORTANT:
     * pdfData is only a browser preview value. This component
     * never uploads it to Cloudinary. The parent save flow sends
     * pdfData to the backend only after "Confirm & Save".
     */
    if (
      typeof project?.pdfData === "string" &&
      project.pdfData.trim()
    ) {
      const base64 = project.pdfData
        .trim()
        .replace(
          /^data:application\/pdf;base64,/i,
          ""
        );

      if (base64) {
        return `data:application/pdf;base64,${base64}`;
      }
    }

    return resolvePdfUrl(
      project?.detailedPdfUrl ||
        project?.pdfUrl,
      apiBaseUrl
    );
  }, [
    project?.pdfData,
    project?.detailedPdfUrl,
    project?.pdfUrl,
    apiBaseUrl,
  ]);

  const hasPdf = Boolean(pdfUrl);

  /* =======================================================
     RESET PDF STATE WHEN PROJECT CHANGES
  ======================================================= */

  useEffect(() => {
    if (!open) {
      return;
    }

    setPdfError(false);

    setPdfLoading(
      Boolean(pdfUrl)
    );

    setPdfReloadKey(
      (current) => current + 1
    );
  }, [
    open,
    pdfUrl,
  ]);

  /* =======================================================
     ESCAPE KEY
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
        !regenerating &&
        !saving
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
    regenerating,
    saving,
    onClose,
  ]);

  /* =======================================================
     PDF ACTIONS
  ======================================================= */

  const handleOpenPdf = () => {
    if (!pdfUrl) {
      return;
    }

    window.open(
      pdfUrl,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleDownloadPdf = () => {
    if (!pdfUrl) {
      return;
    }

    const anchor =
      document.createElement("a");

    anchor.href = pdfUrl;

    anchor.target = "_blank";

    anchor.rel =
      "noopener noreferrer";

    anchor.download =
      `${projectTitle
        .replace(
          /[^a-z0-9]+/gi,
          "-"
        )
        .replace(
          /^-+|-+$/g,
          ""
        )
        .toLowerCase() ||
        "project-guide"}.pdf`;

    document.body.appendChild(
      anchor
    );

    anchor.click();

    document.body.removeChild(
      anchor
    );
  };

  const handlePdfLoad = () => {
    setPdfLoading(false);

    setPdfError(false);
  };

  const handlePdfError = () => {
    setPdfLoading(false);

    setPdfError(true);
  };

  const handleReloadPdf = () => {
    setPdfError(false);

    setPdfLoading(true);

    setPdfReloadKey(
      (current) => current + 1
    );
  };

  /* =======================================================
     CLOSE IF NOT OPEN
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
        z-[70]
        flex
        items-center
        justify-center
        bg-slate-950/60
        p-3
        backdrop-blur-sm
        sm:p-5
      "
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !regenerating &&
          !saving
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-ai-preview-title"
        className="
          flex
          h-[95vh]
          w-full
          max-w-7xl
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
            gap-4
            border-b
            border-slate-200
            px-4
            py-3
            sm:px-5
            dark:border-white/10
          "
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-indigo-600
                text-white
              "
            >
              <Sparkles size={18} />
            </div>

            <div className="min-w-0">
              <h2
                id="project-ai-preview-title"
                className="
                  truncate
                  text-sm
                  font-semibold
                  text-slate-900
                  sm:text-base
                  dark:text-white
                "
              >
                {projectTitle}
              </h2>

              <p
                className="
                  mt-0.5
                  text-xs
                  text-slate-500
                  dark:text-slate-400
                "
              >
                AI generated project preview
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                disabled={
                  regenerating
                }
                className="
                  hidden
                  items-center
                  gap-1.5
                  rounded-lg
                  border
                  border-slate-200
                  px-3
                  py-2
                  text-xs
                  font-medium
                  text-slate-700
                  hover:bg-slate-50
                  disabled:opacity-50
                  sm:inline-flex
                  dark:border-white/10
                  dark:text-slate-300
                  dark:hover:bg-white/5
                "
              >
                {regenerating ? (
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <RefreshCw size={14} />
                )}

                Regenerate
              </button>
            )}

            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                disabled={
                  regenerating || saving
                }
                className="
                  hidden
                  rounded-lg
                  border
                  border-indigo-200
                  bg-indigo-50
                  px-3
                  py-2
                  text-xs
                  font-medium
                  text-indigo-700
                  hover:bg-indigo-100
                  disabled:opacity-50
                  sm:block
                  dark:border-indigo-500/20
                  dark:bg-indigo-500/10
                  dark:text-indigo-300
                "
              >
                Edit
              </button>
            )}

            {onUseProject && (
              <button
                type="button"
                onClick={() => onUseProject?.()}
                disabled={
                  regenerating || saving
                }
                className="
                  hidden
                  items-center
                  gap-1.5
                  rounded-lg
                  bg-emerald-600
                  px-3
                  py-2
                  text-xs
                  font-medium
                  text-white
                  hover:bg-emerald-700
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                  sm:inline-flex
                "
              >
                {saving ? (
                  <>
                    <Loader2
                      size={14}
                      className="animate-spin"
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    Confirm & Save
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={
                regenerating || saving
              }
              aria-label="Close preview"
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
        </div>

        {/* =================================================
            MAIN CONTENT
        ================================================= */}

        <div
          className="
            grid
            min-h-0
            flex-1
            grid-cols-1
            lg:grid-cols-[360px_minmax(0,1fr)]
          "
        >
          {/* =================================================
              LEFT PANEL
          ================================================= */}

          <aside
            className="
              min-h-0
              overflow-y-auto
              border-b
              border-slate-200
              bg-slate-50/70
              p-4
              lg:border-b-0
              lg:border-r
              dark:border-white/10
              dark:bg-[#0d1118]
            "
          >
            <div className="space-y-4">
              {/* -------------------------------------------
                  SUCCESS
              -------------------------------------------- */}

              <div
                className="
                  flex
                  items-center
                  gap-2
                  rounded-xl
                  border
                  border-emerald-200
                  bg-emerald-50
                  px-3
                  py-2.5
                  dark:border-emerald-500/20
                  dark:bg-emerald-500/10
                "
              >
                <CheckCircle2
                  size={16}
                  className="
                    shrink-0
                    text-emerald-600
                    dark:text-emerald-400
                  "
                />

                <span
                  className="
                    text-xs
                    font-medium
                    text-emerald-700
                    dark:text-emerald-300
                  "
                >
                  Project generated successfully
                </span>
              </div>

              {/* -------------------------------------------
                  STUDENT
              -------------------------------------------- */}

              {project?.studentName && (
                <div
                  className="
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    p-4
                    dark:border-white/10
                    dark:bg-[#151a23]
                  "
                >
                  <div className="mb-3 flex items-center gap-2">
                    <UserRound
                      size={15}
                      className="text-indigo-600"
                    />

                    <h3
                      className="
                        text-xs
                        font-semibold
                        uppercase
                        tracking-wide
                        text-slate-500
                        dark:text-slate-400
                      "
                    >
                      Student
                    </h3>
                  </div>

                  <p
                    className="
                      text-sm
                      font-semibold
                      text-slate-900
                      dark:text-white
                    "
                  >
                    {project.studentName}
                  </p>

                  {studentEducation && (
                    <div className="mt-2 flex gap-2">
                      <GraduationCap
                        size={14}
                        className="
                          mt-0.5
                          shrink-0
                          text-slate-400
                        "
                      />

                      <div>
                        <p className="text-xs text-slate-700 dark:text-slate-300">
                          {studentEducation.degree ||
                            studentEducation.field ||
                            "Education"}
                        </p>

                        {(studentEducation.college ||
                          studentEducation.institution ||
                          studentEducation.university ||
                          studentEducation.year ||
                          studentEducation.graduationYear) && (
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {studentEducation.college ||
                              studentEducation.institution ||
                              studentEducation.university ||
                              ""}

                            {(studentEducation.year ||
                              studentEducation.graduationYear) &&
                              ` • ${studentEducation.year ||
                                studentEducation.graduationYear}`}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {studentSkills.length >
                    0 && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-[11px] font-medium text-slate-400">
                        Skills
                      </p>

                      <div className="flex flex-wrap gap-1">
                        {studentSkills.map(
                          (skill) => (
                            <span
                              key={skill}
                              className="
                                rounded-md
                                bg-slate-100
                                px-2
                                py-1
                                text-[10px]
                                font-medium
                                text-slate-600
                                dark:bg-white/5
                                dark:text-slate-300
                              "
                            >
                              {skill}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* -------------------------------------------
                  PROJECT DETAILS
              -------------------------------------------- */}

              <div
                className="
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  p-4
                  dark:border-white/10
                  dark:bg-[#151a23]
                "
              >
                <h3
                  className="
                    mb-3
                    text-xs
                    font-semibold
                    uppercase
                    tracking-wide
                    text-slate-500
                    dark:text-slate-400
                  "
                >
                  Project Details
                </h3>

                <div className="space-y-3">
                  <DetailRow
                    label="Role"
                    value={projectRole}
                  />

                  <DetailRow
                    label="Difficulty"
                    value={difficulty}
                  />

                  {project?.duration !== undefined &&
                    project?.duration !== null &&
                    String(project.duration).trim() && (
                      <DetailRow
                        label="Duration"
                        value={`${project.duration}${
                          typeof project.duration === "number"
                            ? " days"
                            : ""
                        }`}
                      />
                    )}

                  {project?.status && (
                    <DetailRow
                      label="Status"
                      value={
                        project.status
                      }
                    />
                  )}
                </div>
              </div>

              {/* -------------------------------------------
                  DESCRIPTION
              -------------------------------------------- */}

              <div
                className="
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  p-4
                  dark:border-white/10
                  dark:bg-[#151a23]
                "
              >
                <h3
                  className="
                    mb-2
                    text-xs
                    font-semibold
                    uppercase
                    tracking-wide
                    text-slate-500
                    dark:text-slate-400
                  "
                >
                  Description
                </h3>

                <p
                  className="
                    whitespace-pre-wrap
                    text-xs
                    leading-5
                    text-slate-600
                    dark:text-slate-300
                  "
                >
                  {description}
                </p>
              </div>

              {/* -------------------------------------------
                  TECHNOLOGIES
              -------------------------------------------- */}

              {technologies.length >
                0 && (
                <div
                  className="
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    p-4
                    dark:border-white/10
                    dark:bg-[#151a23]
                  "
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Code2
                      size={15}
                      className="text-indigo-600"
                    />

                    <h3
                      className="
                        text-xs
                        font-semibold
                        uppercase
                        tracking-wide
                        text-slate-500
                        dark:text-slate-400
                      "
                    >
                      Technologies
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {technologies.map(
                      (technology) => (
                        <span
                          key={technology}
                          className="
                            rounded-lg
                            border
                            border-slate-200
                            bg-slate-50
                            px-2.5
                            py-1.5
                            text-[11px]
                            font-medium
                            text-slate-600
                            dark:border-white/10
                            dark:bg-white/5
                            dark:text-slate-300
                          "
                        >
                          {technology}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* -------------------------------------------
                  FOCUS
              -------------------------------------------- */}

              {focus.length > 0 && (
                <div
                  className="
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    p-4
                    dark:border-white/10
                    dark:bg-[#151a23]
                  "
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Target
                      size={15}
                      className="text-indigo-600"
                    />

                    <h3
                      className="
                        text-xs
                        font-semibold
                        uppercase
                        tracking-wide
                        text-slate-500
                        dark:text-slate-400
                      "
                    >
                      Focus Areas
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {focus.map(
                      (item) => (
                        <span
                          key={item}
                          className="
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
                          {formatLabel(
                            item
                          )}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* -------------------------------------------
                  REQUIREMENTS
              -------------------------------------------- */}

              {requirements && (
                <div
                  className="
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    p-4
                    dark:border-white/10
                    dark:bg-[#151a23]
                  "
                >
                  <h3
                    className="
                      mb-2
                      text-xs
                      font-semibold
                      uppercase
                      tracking-wide
                      text-slate-500
                      dark:text-slate-400
                    "
                  >
                    Requirements
                  </h3>

                  <p
                    className="
                      whitespace-pre-wrap
                      text-xs
                      leading-5
                      text-slate-600
                      dark:text-slate-300
                    "
                  >
                    {requirements}
                  </p>
                </div>
              )}
            </div>
          </aside>

          {/* =================================================
              RIGHT PDF PANEL
          ================================================= */}

          <section
            className="
              flex
              min-h-0
              flex-1
              flex-col
              bg-slate-100
              dark:bg-[#090c11]
            "
          >
            {/* ---------------------------------------------
                PDF HEADER
            ---------------------------------------------- */}

            <div
              className="
                flex
                shrink-0
                flex-wrap
                items-center
                justify-between
                gap-3
                border-b
                border-slate-200
                bg-white
                px-4
                py-3
                dark:border-white/10
                dark:bg-[#11151d]
              "
            >
              <div className="flex items-center gap-2">
                <FileText
                  size={17}
                  className="text-indigo-600"
                />

                <div>
                  <p
                    className="
                      text-sm
                      font-semibold
                      text-slate-800
                      dark:text-white
                    "
                  >
                    Project Guide PDF
                  </p>

                  <p
                    className="
                      text-[11px]
                      text-slate-400
                    "
                  >
                    {hasPdf
                      ? "Generated project documentation"
                      : "No PDF available"}
                  </p>
                </div>
              </div>

              {hasPdf && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={
                      handleReloadPdf
                    }
                    disabled={
                      pdfLoading
                    }
                    className="
                      inline-flex
                      items-center
                      gap-1.5
                      rounded-lg
                      border
                      border-slate-200
                      px-2.5
                      py-2
                      text-[11px]
                      font-medium
                      text-slate-600
                      hover:bg-slate-50
                      disabled:opacity-50
                      dark:border-white/10
                      dark:text-slate-300
                      dark:hover:bg-white/5
                    "
                  >
                    <RefreshCw
                      size={13}
                      className={
                        pdfLoading
                          ? "animate-spin"
                          : ""
                      }
                    />

                    Reload
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleOpenPdf
                    }
                    className="
                      inline-flex
                      items-center
                      gap-1.5
                      rounded-lg
                      border
                      border-slate-200
                      bg-white
                      px-2.5
                      py-2
                      text-[11px]
                      font-medium
                      text-slate-700
                      hover:bg-slate-50
                      dark:border-white/10
                      dark:bg-white/5
                      dark:text-slate-300
                    "
                  >
                    <ExternalLink
                      size={13}
                    />

                    Open
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleDownloadPdf
                    }
                    className="
                      inline-flex
                      items-center
                      gap-1.5
                      rounded-lg
                      bg-indigo-600
                      px-2.5
                      py-2
                      text-[11px]
                      font-medium
                      text-white
                      hover:bg-indigo-700
                    "
                  >
                    <Download
                      size={13}
                    />

                    Download
                  </button>
                </div>
              )}
            </div>

            {/* ---------------------------------------------
                PDF CONTENT
            ---------------------------------------------- */}

            <div
              className="
                relative
                min-h-0
                flex-1
                overflow-hidden
              "
            >
              {!hasPdf ? (
                <PdfUnavailable />
              ) : pdfError ? (
                <PdfError
                  onRetry={
                    handleReloadPdf
                  }
                  onOpen={
                    handleOpenPdf
                  }
                />
              ) : (
                <>
                  {pdfLoading && (
                    <div
                      className="
                        absolute
                        inset-0
                        z-10
                        flex
                        items-center
                        justify-center
                        bg-slate-100
                        dark:bg-[#090c11]
                      "
                    >
                      <div className="text-center">
                        <div
                          className="
                            mx-auto
                            flex
                            h-12
                            w-12
                            items-center
                            justify-center
                            rounded-full
                            bg-indigo-50
                            dark:bg-indigo-500/10
                          "
                        >
                          <Loader2
                            size={22}
                            className="
                              animate-spin
                              text-indigo-600
                              dark:text-indigo-400
                            "
                          />
                        </div>

                        <p
                          className="
                            mt-3
                            text-sm
                            font-medium
                            text-slate-700
                            dark:text-slate-300
                          "
                        >
                          Loading PDF...
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
                  )}

                  <iframe
                    key={pdfReloadKey}
                    src={pdfUrl}
                    title={`${projectTitle} PDF`}
                    className="
                      h-full
                      w-full
                      border-0
                      bg-white
                    "
                    onLoad={
                      handlePdfLoad
                    }
                    onError={
                      handlePdfError
                    }
                    allow="fullscreen"
                  />
                </>
              )}
            </div>
          </section>
        </div>

        {/* =================================================
            MOBILE ACTIONS
        ================================================= */}

        {(onEdit || onRegenerate || onUseProject) && (
          <div
            className="
              flex
              shrink-0
              items-center
              justify-end
              gap-2
              border-t
              border-slate-200
              px-4
              py-3
              sm:hidden
              dark:border-white/10
            "
          >
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                disabled={
                  regenerating
                }
                className="
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-lg
                  border
                  border-slate-200
                  px-3
                  py-2
                  text-xs
                  font-medium
                  text-slate-700
                  disabled:opacity-50
                  dark:border-white/10
                  dark:text-slate-300
                "
              >
                {regenerating ? (
                  <Loader2
                    size={13}
                    className="animate-spin"
                  />
                ) : (
                  <RefreshCw size={13} />
                )}

                Regenerate
              </button>
            )}

            {onUseProject && (
              <button
                type="button"
                onClick={() => onUseProject?.()}
                disabled={
                  regenerating || saving
                }
                className="
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-lg
                  bg-emerald-600
                  px-3
                  py-2
                  text-xs
                  font-medium
                  text-white
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                {saving ? (
                  <>
                    <Loader2
                      size={13}
                      className="animate-spin"
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} />
                    Confirm & Save
                  </>
                )}
              </button>
            )}

            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                disabled={
                  regenerating || saving
                }
                className="
                  rounded-lg
                  bg-indigo-600
                  px-3
                  py-2
                  text-xs
                  font-medium
                  text-white
                  disabled:opacity-50
                "
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
