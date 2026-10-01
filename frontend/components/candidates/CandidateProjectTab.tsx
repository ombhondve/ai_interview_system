"use client";

import { useEffect, useMemo, useState } from "react";

import {
  FolderKanban,
  FileText,
  ExternalLink,
  Loader2,
  AlertCircle,
  Clock,
  UserRound,
  Layers3,
  Target,
} from "lucide-react";

import { Candidate } from "@/types";

import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/ui/Card";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";


// =====================================================
// PROJECT TYPE
// =====================================================

type Project = {
  _id?: string;
  id?: string;

  title?: string;
  name?: string;

  role?: string;

  difficulty?:
    | string;

  focus?: string;

  description?: string;

  duration?: string | number;

  status?: string;

  technologies?: string[];
  techStack?: string[];

  requirements?: string[];

  pdfUrl?: string;
  detailedPdfUrl?: string;

  projectPdfUrl?: string;
};


// =====================================================
// DIFFICULTY BADGE
// =====================================================

const difficultyVariant = {
  junior: "info",
  mid: "warning",
  senior: "accent",
} as const;


// =====================================================
// HELPER
// =====================================================

function normalizeDifficulty(
  difficulty?: string
) {
  if (!difficulty) {
    return "info";
  }

  const value = difficulty.toLowerCase();

  if (
    value.includes("junior") ||
    value.includes("beginner") ||
    value.includes("easy")
  ) {
    return "info";
  }

  if (
    value.includes("mid") ||
    value.includes("intermediate") ||
    value.includes("medium")
  ) {
    return "warning";
  }

  if (
    value.includes("senior") ||
    value.includes("advanced") ||
    value.includes("hard")
  ) {
    return "accent";
  }

  return "info";
}


// =====================================================
// TEXT HELPER
// =====================================================

function displayValue(
  value?: string | number | null
) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return "Not specified";
  }

  return String(value);
}


// =====================================================
// PROJECT INFO ITEM
// =====================================================

function ProjectInfo({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value?: string | number | null;
}) {
  return (
    <div
      className="
        rounded-lg
        border
        border-slate-200
        bg-slate-50
        p-4
        dark:border-slate-800
        dark:bg-slate-900/50
      "
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />

        <p
          className="
            text-xs
            font-medium
            text-slate-500
            dark:text-slate-400
          "
        >
          {label}
        </p>
      </div>

      <p
        className="
          mt-2
          text-sm
          font-semibold
          text-slate-900
          dark:text-white
        "
      >
        {displayValue(value)}
      </p>
    </div>
  );
}


// =====================================================
// PROJECT TAB
// =====================================================

export function CandidateProjectTab({
  candidate,
}: {
  candidate: Candidate;
}) {
  const [project, setProject] =
    useState<Project | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string>("");


  // =====================================================
  // PROJECT ID
  // =====================================================

  const projectId =
    candidate.assignedProjectId
      ? String(candidate.assignedProjectId)
      : "";


  // =====================================================
  // FETCH PROJECT
  // =====================================================

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";


    useEffect(() => {
    let cancelled = false;

    async function fetchProject() {
      if (!projectId) {
        setProject(null);
        setLoading(false);
        setError("");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const backendUrl =
          process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

        const response = await fetch(
          `${backendUrl}/api/projects/${encodeURIComponent(projectId)}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ||
              `Failed to fetch project (${response.status})`
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.message || "Failed to fetch project."
          );
        }

        if (!data?.project) {
          throw new Error(
            "Project was not returned by the server."
          );
        }

        if (!cancelled) {
          setProject(data.project);
        }
      } catch (err) {
        console.error(
          "CandidateProjectTab - fetch project error:",
          err
        );

        if (!cancelled) {
          setProject(null);

          setError(
            err instanceof Error
              ? err.message
              : "Failed to load project details."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchProject();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // =====================================================
  // PDF URL
  // =====================================================

  const pdfUrl = useMemo(() => {
    if (!project) {
      return "";
    }

    const rawUrl =
      project.detailedPdfUrl ||
      project.pdfUrl ||
      project.projectPdfUrl ||
      "";

    if (!rawUrl) {
      return "";
    }

    // If backend already returned an absolute URL,
    // use it directly.
    if (
      rawUrl.startsWith("http://") ||
      rawUrl.startsWith("https://")
    ) {
      return rawUrl;
    }

    // Resolve relative PDF URL against the current site.
    if (typeof window !== "undefined") {
      return new URL(
        rawUrl,
        window.location.origin
      ).toString();
    }

    return rawUrl;
  }, [project]);


  // =====================================================
  // NO PROJECT
  // =====================================================

  if (!projectId) {
    return (
      <Card>
        <EmptyState
          icon={FolderKanban}
          title="No project assigned yet"
          description="A demo project will be auto-assigned once the candidate is approved."
        />
      </Card>
    );
  }


  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div
            className="
              flex
              min-h-[220px]
              items-center
              justify-center
            "
          >
            <div className="flex items-center gap-3">
              <Loader2
                className="
                  h-5
                  w-5
                  animate-spin
                  text-accent-600
                "
              />

              <span
                className="
                  text-sm
                  text-slate-500
                  dark:text-slate-400
                "
              >
                Loading project details...
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }


  // =====================================================
  // ERROR
  // =====================================================

  if (error) {
    return (
      <Card>
        <CardContent>
          <div
            className="
              flex
              items-start
              gap-3
              rounded-lg
              border
              border-red-200
              bg-red-50
              p-4
              dark:border-red-900/50
              dark:bg-red-950/20
            "
          >
            <AlertCircle
              className="
                mt-0.5
                h-5
                w-5
                shrink-0
                text-red-500
              "
            />

            <div>
              <p
                className="
                  text-sm
                  font-semibold
                  text-red-700
                  dark:text-red-400
                "
              >
                Unable to load project
              </p>

              <p
                className="
                  mt-1
                  text-sm
                  text-red-600
                  dark:text-red-400
                "
              >
                {error}
              </p>

              <p
                className="
                  mt-2
                  text-xs
                  text-red-500
                  dark:text-red-500
                "
              >
                Project ID: {projectId}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }


  // =====================================================
  // PROJECT NOT FOUND
  // =====================================================

  if (!project) {
    return (
      <Card>
        <CardContent>
          <div className="py-8 text-center">
            <FolderKanban
              className="
                mx-auto
                h-10
                w-10
                text-slate-400
              "
            />

            <p
              className="
                mt-3
                text-sm
                font-semibold
                text-slate-900
                dark:text-white
              "
            >
              Project not found
            </p>

            <p
              className="
                mt-1
                text-xs
                text-slate-500
                dark:text-slate-400
              "
            >
              Project ID: {projectId}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }


  // =====================================================
  // PROJECT VALUES
  // =====================================================

  const projectTitle =
    project.title ||
    project.name ||
    "Untitled Project";

  const technologies =
    Array.isArray(project.technologies)
      ? project.technologies
      : Array.isArray(project.techStack)
        ? project.techStack
        : [];

  const requirements =
    Array.isArray(project.requirements)
      ? project.requirements
      : [];

  const difficulty =
    project.difficulty
      ? String(project.difficulty)
      : "";

  const difficultyKey =
    normalizeDifficulty(difficulty);

  const difficultyBadge =
    difficultyVariant[
      difficultyKey as keyof typeof difficultyVariant
    ] || "info";


  // =====================================================
  // PROJECT DETAILS
  // =====================================================

  return (
    <Card>

      {/* =================================================
          ACTUAL PROJECT HEADER
          ================================================= */}

      <CardHeader
        title={projectTitle}
      />


      <CardContent className="space-y-6">

        {/* =================================================
            PROJECT TOP SECTION
            ================================================= */}

        <div
          className="
            flex
            items-start
            gap-4
          "
        >

          {/* Project Icon */}

          <div
            className="
              flex
              h-12
              w-12
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-accent-50
              text-accent-600
              dark:bg-accent-500/10
            "
          >
            <FolderKanban className="h-6 w-6" />
          </div>


          {/* Title + Description */}

          <div className="min-w-0 flex-1">

            <div
              className="
                flex
                flex-wrap
                items-center
                gap-2
              "
            >
              <h2
                className="
                  text-lg
                  font-semibold
                  text-slate-900
                  dark:text-white
                "
              >
                {projectTitle}
              </h2>

              {difficulty && (
                <Badge variant={difficultyBadge}>
                  {difficulty}
                </Badge>
              )}
            </div>


            {project.description && (
              <p
                className="
                  mt-2
                  text-sm
                  leading-6
                  text-slate-600
                  dark:text-slate-300
                "
              >
                {project.description}
              </p>
            )}

          </div>

        </div>


        {/* =================================================
            PROJECT INFORMATION
            ================================================= */}

        <div
          className="
            grid
            grid-cols-1
            gap-4
            sm:grid-cols-2
            lg:grid-cols-3
          "
        >

          <ProjectInfo
            icon={UserRound}
            label="Role"
            value={project.role}
          />

          <ProjectInfo
            icon={Layers3}
            label="Difficulty"
            value={project.difficulty}
          />

          <ProjectInfo
            icon={Target}
            label="Focus"
            value={project.focus}
          />

          <ProjectInfo
            icon={Clock}
            label="Duration"
            value={project.duration}
          />

          <ProjectInfo
            icon={FolderKanban}
            label="Status"
            value={project.status}
          />

          <ProjectInfo
            icon={FileText}
            label="Project ID"
            value={project._id || project.id || projectId}
          />

        </div>


        {/* =================================================
            TECHNOLOGIES
            ================================================= */}

        {technologies.length > 0 && (
          <section>

            <h3
              className="
                mb-3
                text-sm
                font-semibold
                text-slate-900
                dark:text-white
              "
            >
              Technologies
            </h3>

            <div className="flex flex-wrap gap-2">

              {technologies.map(
                (technology, index) => (
                  <span
                    key={`${technology}-${index}`}
                    className="
                      rounded-full
                      border
                      border-blue-200
                      bg-blue-50
                      px-3
                      py-1.5
                      text-xs
                      font-medium
                      text-blue-700
                      dark:border-blue-900
                      dark:bg-blue-500/10
                      dark:text-blue-400
                    "
                  >
                    {technology}
                  </span>
                )
              )}

            </div>

          </section>
        )}


        {/* =================================================
            FOCUS
            ================================================= */}

        {project.focus && (
          <section>

            <h3
              className="
                mb-2
                text-sm
                font-semibold
                text-slate-900
                dark:text-white
              "
            >
              Project Focus
            </h3>

            <p
              className="
                text-sm
                leading-6
                text-slate-600
                dark:text-slate-300
              "
            >
              {project.focus}
            </p>

          </section>
        )}


        {/* =================================================
            REQUIREMENTS
            ================================================= */}

        {requirements.length > 0 && (
          <section>

            <h3
              className="
                mb-3
                text-sm
                font-semibold
                text-slate-900
                dark:text-white
              "
            >
              Requirements
            </h3>

            <ul
              className="
                space-y-2
                text-sm
                text-slate-600
                dark:text-slate-300
              "
            >

              {requirements.map(
                (requirement, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2"
                  >
                    <span
                      className="
                        mt-2
                        h-1.5
                        w-1.5
                        shrink-0
                        rounded-full
                        bg-accent-500
                      "
                    />

                    <span>
                      {requirement}
                    </span>
                  </li>
                )
              )}

            </ul>

          </section>
        )}


        {/* =================================================
            PDF SECTION
            ================================================= */}

        <section
          className="
            border-t
            border-slate-200
            pt-6
            dark:border-slate-800
          "
        >

          <div
            className="
              mb-4
              flex
              flex-col
              gap-3
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >

            <div className="flex items-center gap-3">

              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-lg
                  bg-red-50
                  text-red-600
                  dark:bg-red-500/10
                  dark:text-red-400
                "
              >
                <FileText className="h-5 w-5" />
              </div>

              <div>
                <h3
                  className="
                    text-sm
                    font-semibold
                    text-slate-900
                    dark:text-white
                  "
                >
                  Project Document
                </h3>

                <p
                  className="
                    text-xs
                    text-slate-500
                    dark:text-slate-400
                  "
                >
                  Complete project requirements and details
                </p>
              </div>

            </div>


            {/* Open PDF */}

            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  rounded-lg
                  border
                  border-slate-200
                  bg-white
                  px-4
                  py-2
                  text-sm
                  font-medium
                  text-slate-700
                  shadow-sm
                  transition
                  hover:bg-slate-50
                  dark:border-slate-700
                  dark:bg-slate-900
                  dark:text-slate-200
                  dark:hover:bg-slate-800
                "
              >
                <ExternalLink className="h-4 w-4" />
                Open PDF
              </a>
            )}

          </div>


          {/* =================================================
              PDF VIEWER
              ================================================= */}

          {pdfUrl ? (
            <div
              className="
                overflow-hidden
                rounded-xl
                border
                border-slate-200
                bg-slate-100
                dark:border-slate-700
                dark:bg-slate-900
              "
            >

              <iframe
                src={pdfUrl}
                title={`${projectTitle} PDF`}
                className="
                  h-[700px]
                  w-full
                "
              />

            </div>
          ) : (
            <div
              className="
                flex
                min-h-[180px]
                flex-col
                items-center
                justify-center
                rounded-xl
                border
                border-dashed
                border-slate-300
                bg-slate-50
                px-6
                text-center
                dark:border-slate-700
                dark:bg-slate-900/50
              "
            >

              <FileText
                className="
                  h-10
                  w-10
                  text-slate-400
                "
              />

              <p
                className="
                  mt-3
                  text-sm
                  font-semibold
                  text-slate-700
                  dark:text-slate-300
                "
              >
                No project PDF available
              </p>

              <p
                className="
                  mt-1
                  max-w-md
                  text-xs
                  text-slate-500
                  dark:text-slate-400
                "
              >
                This project does not currently have a PDF
                document attached.
              </p>

            </div>
          )}

        </section>


      </CardContent>

    </Card>
  );
}
