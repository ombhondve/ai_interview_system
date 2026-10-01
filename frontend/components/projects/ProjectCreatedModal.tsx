"use client";

import React, { useEffect } from "react";
import {
  CheckCircle2,
  Eye,
  FileText,
  Pencil,
  UserPlus,
  X,
} from "lucide-react";

export interface CreatedProject {
  _id?: string;
  id?: string;

  title?: string;
  role?: string;
  difficulty?: string;
  description?: string;

  technologies?: string[];
  techStack?: string[];

  duration?: string;
  projectType?: string;
  focus?: string;

  requirements?: string[];

  status?: string;

  briefUrl?: string;
  pdfUrl?: string;
  detailedPdfUrl?: string;

  studentId?: string;
  studentName?: string;

  createdAt?: string;
  updatedAt?: string;

  [key: string]: unknown;
}

interface ProjectCreatedModalProps {
  open: boolean;

  project: CreatedProject | null;

  onClose: () => void;

  /**
   * Open project details.
   */
  onView?: (project: CreatedProject) => void;

  /**
   * Open project edit modal.
   */
  onEdit?: (project: CreatedProject) => void;

  /**
   * Open project assignment modal.
   */
  onAssign?: (project: CreatedProject) => void;

  /**
   * Optional callback after the modal is closed.
   */
  onDone?: () => void;
}

function getProjectId(project: CreatedProject): string {
  return String(project._id || project.id || "");
}

function getTechnologies(project: CreatedProject): string[] {
  if (Array.isArray(project.technologies)) {
    return project.technologies.filter(
      (item): item is string => typeof item === "string"
    );
  }

  if (Array.isArray(project.techStack)) {
    return project.techStack.filter(
      (item): item is string => typeof item === "string"
    );
  }

  return [];
}

function formatDifficulty(value?: string): string {
  if (!value) return "Not specified";

  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatProjectType(value?: string): string {
  if (!value) return "Not specified";

  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value?: string): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ProjectCreatedModal({
  open,
  project,
  onClose,
  onView,
  onEdit,
  onAssign,
  onDone,
}: ProjectCreatedModalProps) {
  /*
   * Close modal with Escape key.
   */
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  /*
   * Prevent background scrolling while modal is open.
   */
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !project) {
    return null;
  }

  const projectId = getProjectId(project);
  const technologies = getTechnologies(project);

  const hasPdf =
    Boolean(project.detailedPdfUrl) ||
    Boolean(project.pdfUrl) ||
    Boolean(project.briefUrl);

  const createdDate = formatDate(project.createdAt);

  const handleView = () => {
    if (onView) {
      onView(project);
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(project);
    }
  };

  const handleAssign = () => {
    if (onAssign) {
      onAssign(project);
    }
  };

  const handleDone = () => {
    if (onDone) {
      onDone();
    } else {
      onClose();
    }
  };

  const handleBackdropClick = (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm"
      onMouseDown={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-created-title"
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-start gap-4 pr-10">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>

            <div>
              <h2
                id="project-created-title"
                className="text-xl font-semibold text-slate-900 dark:text-white"
              >
                Project Created Successfully
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                The project has been generated and is ready for review.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-6">
          {/* Project title */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Project
                </p>

                <h3 className="break-words text-lg font-semibold text-slate-900 dark:text-white">
                  {project.title || "Untitled Project"}
                </h3>

                {project.role && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Role: {project.role}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Project information */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoCard
              label="Difficulty"
              value={formatDifficulty(project.difficulty)}
            />

            <InfoCard
              label="Project Type"
              value={formatProjectType(project.projectType)}
            />

            <InfoCard
              label="Duration"
              value={project.duration || "Not specified"}
            />

            <InfoCard
              label="Status"
              value={project.status || "Created"}
            />
          </div>

          {/* Student */}
          {project.studentName && (
            <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                  <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
                    Student
                  </p>

                  <p className="mt-0.5 font-medium text-slate-900 dark:text-white">
                    {project.studentName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Technologies */}
          {technologies.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
                Technologies
              </p>

              <div className="flex flex-wrap gap-2">
                {technologies.map((technology, index) => (
                  <span
                    key={`${technology}-${index}`}
                    className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                  >
                    {technology}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Focus */}
          {project.focus && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
                Focus
              </p>

              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                {project.focus}
              </p>
            </div>
          )}

          {/* Description */}
          {project.description && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
                Description
              </p>

              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {project.description}
                </p>
              </div>
            </div>
          )}

          {/* Requirements */}
          {Array.isArray(project.requirements) &&
            project.requirements.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
                  Requirements
                </p>

                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <ul className="space-y-2">
                    {project.requirements.map((requirement, index) => (
                      <li
                        key={`${requirement}-${index}`}
                        className="flex gap-2 text-sm text-slate-600 dark:text-slate-300"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />

                        <span>{requirement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

          {/* PDF */}
          {hasPdf && (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                  <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>

                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white">
                    Project PDF Available
                  </p>

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    The detailed project document has been generated.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Created date */}
          {createdDate && (
            <p className="mt-5 text-xs text-slate-400 dark:text-slate-500">
              Created on {createdDate}
            </p>
          )}

          {/* No project ID warning */}
          {!projectId && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
              Project ID was not returned by the server. View, edit, and
              assignment actions may not be available.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Left actions */}
            <div className="flex flex-wrap gap-2">
              {onView && (
                <button
                  type="button"
                  onClick={handleView}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Eye className="h-4 w-4" />
                  View Project
                </button>
              )}

              {onEdit && (
                <button
                  type="button"
                  onClick={handleEdit}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
              )}
            </div>

            {/* Right actions */}
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {onAssign && projectId && (
                <button
                  type="button"
                  onClick={handleAssign}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Assign Student
                </button>
              )}

              <button
                type="button"
                onClick={handleDone}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helper component                                                           */
/* -------------------------------------------------------------------------- */

interface InfoCardProps {
  label: string;
  value: string;
}

function InfoCard({ label, value }: InfoCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}
