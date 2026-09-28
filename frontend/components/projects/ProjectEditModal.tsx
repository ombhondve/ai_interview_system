"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Loader2,
  Plus,
  Save,
  X,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface EditableProject {
  _id?: string;
  id?: string;

  title?: string;
  role?: string;
  difficulty?: string;
  description?: string;

  projectType?: string;
  duration?: string;
  focus?: string;

  technologies?: string[];
  techStack?: string[];

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

export interface ProjectEditData {
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
  briefUrl: string;
}

interface ProjectEditModalProps {
  open: boolean;

  project: EditableProject | null;

  onClose: () => void;

  /**
   * Called after a successful update.
   * The returned project is the updated project from the form.
   */
  onSave?: (
    project: EditableProject,
    data: ProjectEditData
  ) => Promise<EditableProject | void> | EditableProject | void;

  /**
   * Alternative callback name if the parent uses onUpdated.
   */
  onUpdated?: (project: EditableProject) => void;

  loading?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const DIFFICULTY_OPTIONS = [
  {
    value: "junior",
    label: "Junior",
  },
  {
    value: "mid",
    label: "Mid",
  },
  {
    value: "senior",
    label: "Senior",
  },
];

const PROJECT_TYPE_OPTIONS = [
  {
    value: "backend",
    label: "Backend",
  },
  {
    value: "frontend",
    label: "Frontend",
  },
  {
    value: "fullstack",
    label: "Full Stack",
  },
  {
    value: "mobile",
    label: "Mobile",
  },
  {
    value: "ai_ml",
    label: "AI / ML",
  },
  {
    value: "data_science",
    label: "Data Science",
  },
  {
    value: "devops",
    label: "DevOps",
  },
];

const STATUS_OPTIONS = [
  {
    value: "draft",
    label: "Draft",
  },
  {
    value: "active",
    label: "Active",
  },
  {
    value: "assigned",
    label: "Assigned",
  },
  {
    value: "in_progress",
    label: "In Progress",
  },
  {
    value: "completed",
    label: "Completed",
  },
  {
    value: "archived",
    label: "Archived",
  },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function getProjectId(project: EditableProject | null): string {
  if (!project) return "";

  return String(project._id || project.id || "");
}

function getTechnologies(project: EditableProject): string[] {
  if (Array.isArray(project.technologies)) {
    return project.technologies.filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0
    );
  }

  if (Array.isArray(project.techStack)) {
    return project.techStack.filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0
    );
  }

  return [];
}

function getRequirements(project: EditableProject): string[] {
  if (!Array.isArray(project.requirements)) {
    return [];
  }

  return project.requirements.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0
  );
}

function normalizeDifficulty(value?: string): string {
  if (!value) return "junior";

  const normalized = value.toLowerCase().trim();

  if (normalized === "beginner") return "junior";
  if (normalized === "intermediate") return "mid";
  if (normalized === "medium") return "mid";
  if (normalized === "advanced") return "senior";
  if (normalized === "expert") return "senior";

  if (
    DIFFICULTY_OPTIONS.some(
      (option) => option.value === normalized
    )
  ) {
    return normalized;
  }

  return "junior";
}

function normalizeProjectType(value?: string): string {
  if (!value) return "fullstack";

  const normalized = value.toLowerCase().trim().replace(/[\s-]+/g, "_");

  const aliases: Record<string, string> = {
    full_stack: "fullstack",
    fullstack: "fullstack",
    "full stack": "fullstack",

    ai: "ai_ml",
    ml: "ai_ml",
    aiml: "ai_ml",
    ai_ml: "ai_ml",

    datasci: "data_science",
    data_science: "data_science",
    "data science": "data_science",
  };

  const resolved = aliases[normalized] || normalized;

  if (
    PROJECT_TYPE_OPTIONS.some(
      (option) => option.value === resolved
    )
  ) {
    return resolved;
  }

  return "fullstack";
}

function normalizeStatus(value?: string): string {
  if (!value) return "draft";

  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  if (
    STATUS_OPTIONS.some(
      (option) => option.value === normalized
    )
  ) {
    return normalized;
  }

  return "draft";
}

function createFormData(
  project: EditableProject
): ProjectEditData {
  return {
    title: project.title || "",
    role: project.role || "",
    difficulty: normalizeDifficulty(project.difficulty),
    description: project.description || "",
    projectType: normalizeProjectType(project.projectType),
    duration: project.duration || "",
    focus: project.focus || "",
    technologies: getTechnologies(project),
    requirements: getRequirements(project),
    status: normalizeStatus(project.status),
    briefUrl:
      project.briefUrl ||
      project.detailedPdfUrl ||
      project.pdfUrl ||
      "",
  };
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export function ProjectEditModal({
  open,
  project,
  onClose,
  onSave,
  onUpdated,
  loading = false,
}: ProjectEditModalProps) {
  const [formData, setFormData] = useState<ProjectEditData>({
    title: "",
    role: "",
    difficulty: "junior",
    description: "",
    projectType: "fullstack",
    duration: "",
    focus: "",
    technologies: [],
    requirements: [],
    status: "draft",
    briefUrl: "",
  });

  const [technologyInput, setTechnologyInput] = useState("");
  const [requirementInput, setRequirementInput] = useState("");

  const [errors, setErrors] = useState<
    Record<string, string>
  >({});

  const [submitError, setSubmitError] = useState("");

  const [savedProject, setSavedProject] =
    useState<EditableProject | null>(null);

  /* ------------------------------------------------------------------------ */
  /* Initialize form                                                          */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!open || !project) {
      return;
    }

    setFormData(createFormData(project));
    setTechnologyInput("");
    setRequirementInput("");
    setErrors({});
    setSubmitError("");
    setSavedProject(null);
  }, [open, project]);

  /* ------------------------------------------------------------------------ */
  /* Escape key                                                               */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, loading, onClose]);

  /* ------------------------------------------------------------------------ */
  /* Body scroll                                                               */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  /* ------------------------------------------------------------------------ */
  /* Derived values                                                           */
  /* ------------------------------------------------------------------------ */

  const projectId = useMemo(
    () => getProjectId(project),
    [project]
  );

  const isSaving = loading;

  /* ------------------------------------------------------------------------ */
  /* Field updates                                                            */
  /* ------------------------------------------------------------------------ */

  const updateField = <K extends keyof ProjectEditData>(
    field: K,
    value: ProjectEditData[K]
  ) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));

    setErrors((previous) => {
      if (!previous[field as string]) {
        return previous;
      }

      const next = { ...previous };
      delete next[field as string];

      return next;
    });

    setSubmitError("");
  };

  /* ------------------------------------------------------------------------ */
  /* Technology                                                               */
  /* ------------------------------------------------------------------------ */

  const addTechnology = () => {
    const value = technologyInput.trim();

    if (!value) return;

    const alreadyExists = formData.technologies.some(
      (technology) =>
        technology.toLowerCase() === value.toLowerCase()
    );

    if (alreadyExists) {
      setTechnologyInput("");
      return;
    }

    updateField("technologies", [
      ...formData.technologies,
      value,
    ]);

    setTechnologyInput("");
  };

  const removeTechnology = (index: number) => {
    updateField(
      "technologies",
      formData.technologies.filter(
        (_, itemIndex) => itemIndex !== index
      )
    );
  };

  const handleTechnologyKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTechnology();
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Requirements                                                             */
  /* ------------------------------------------------------------------------ */

  const addRequirement = () => {
    const value = requirementInput.trim();

    if (!value) return;

    updateField("requirements", [
      ...formData.requirements,
      value,
    ]);

    setRequirementInput("");
  };

  const removeRequirement = (index: number) => {
    updateField(
      "requirements",
      formData.requirements.filter(
        (_, itemIndex) => itemIndex !== index
      )
    );
  };

  const handleRequirementKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addRequirement();
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Validation                                                               */
  /* ------------------------------------------------------------------------ */

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      nextErrors.title = "Project title is required.";
    }

    if (!formData.role.trim()) {
      nextErrors.role = "Role is required.";
    }

    if (!formData.description.trim()) {
      nextErrors.description =
        "Project description is required.";
    }

    if (!formData.projectType) {
      nextErrors.projectType =
        "Project type is required.";
    }

    if (!formData.difficulty) {
      nextErrors.difficulty =
        "Difficulty is required.";
    }

    if (formData.briefUrl.trim()) {
      try {
        const url = new URL(formData.briefUrl.trim());

        if (!["http:", "https:"].includes(url.protocol)) {
          nextErrors.briefUrl =
            "Please enter a valid HTTP or HTTPS URL.";
        }
      } catch {
        nextErrors.briefUrl =
          "Please enter a valid URL.";
      }
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  /* ------------------------------------------------------------------------ */
  /* Submit                                                                   */
  /* ------------------------------------------------------------------------ */

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (isSaving) return;

    setSubmitError("");

    if (!project) {
      setSubmitError("Project data is missing.");
      return;
    }

    if (!projectId) {
      setSubmitError(
        "Project ID is missing. The project cannot be updated."
      );
      return;
    }

    if (!validate()) {
      return;
    }

    const cleanedData: ProjectEditData = {
      title: formData.title.trim(),
      role: formData.role.trim(),
      difficulty: formData.difficulty,
      description: formData.description.trim(),
      projectType: formData.projectType,
      duration: formData.duration.trim(),
      focus: formData.focus.trim(),
      technologies: formData.technologies
        .map((item) => item.trim())
        .filter(Boolean),
      requirements: formData.requirements
        .map((item) => item.trim())
        .filter(Boolean),
      status: formData.status,
      briefUrl: formData.briefUrl.trim(),
    };

    try {
      let updatedProject: EditableProject = {
        ...project,
        title: cleanedData.title,
        role: cleanedData.role,
        difficulty: cleanedData.difficulty,
        description: cleanedData.description,
        projectType: cleanedData.projectType,
        duration: cleanedData.duration,
        focus: cleanedData.focus,
        technologies: cleanedData.technologies,
        requirements: cleanedData.requirements,
        status: cleanedData.status,
        briefUrl: cleanedData.briefUrl,
        updatedAt: new Date().toISOString(),
      };

      if (onSave) {
        const result = await onSave(
          project,
          cleanedData
        );

        if (result) {
          updatedProject = result;
        }
      }

      setSavedProject(updatedProject);

      if (onUpdated) {
        onUpdated(updatedProject);
      }
    } catch (error) {
      console.error(
        "Project update failed:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Failed to update project. Please try again.";

      setSubmitError(message);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Close                                                                    */
  /* ------------------------------------------------------------------------ */

  const handleClose = () => {
    if (isSaving) return;

    onClose();
  };

  /* ------------------------------------------------------------------------ */
  /* Backdrop                                                                 */
  /* ------------------------------------------------------------------------ */

  const handleBackdropMouseDown = (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (
      event.target === event.currentTarget &&
      !isSaving
    ) {
      onClose();
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Closed state                                                             */
  /* ------------------------------------------------------------------------ */

  if (!open || !project) {
    return null;
  }

  /* ------------------------------------------------------------------------ */
  /* Success state                                                            */
  /* ------------------------------------------------------------------------ */

  if (savedProject) {
    return (
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
          <div className="px-6 py-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>

            <h2 className="mt-5 text-xl font-semibold text-slate-900 dark:text-white">
              Project Updated
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              The project has been updated successfully.
            </p>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Project
              </p>

              <p className="mt-1 font-medium text-slate-900 dark:text-white">
                {savedProject.title ||
                  "Untitled Project"}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Main modal                                                               */
  /* ------------------------------------------------------------------------ */

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm"
      onMouseDown={handleBackdropMouseDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-edit-title"
    >
      <div
        className="relative flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        {/* ---------------------------------------------------------------- */}
        {/* Header                                                           */}
        {/* ---------------------------------------------------------------- */}

        <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-700">
          <div className="pr-8">
            <h2
              id="project-edit-title"
              className="text-xl font-semibold text-slate-900 dark:text-white"
            >
              Edit Project
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Update the project details below.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close edit project modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Form                                                             */}
        {/* ---------------------------------------------------------------- */}

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* Error */}
            {submitError && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />

                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">
                    Unable to update project
                  </p>

                  <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                    {submitError}
                  </p>
                </div>
              </div>
            )}

            {/* Project ID */}
            <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Project ID
                </span>

                <span className="max-w-[70%] truncate font-mono text-xs text-slate-600 dark:text-slate-300">
                  {projectId || "Not available"}
                </span>
              </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* Basic information                                            */}
            {/* ------------------------------------------------------------ */}

            <section>
              <SectionTitle title="Basic Information" />

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {/* Title */}
                <div className="md:col-span-2">
                  <label
                    htmlFor="project-title"
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    Project Title
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    id="project-title"
                    type="text"
                    value={formData.title}
                    onChange={(event) =>
                      updateField(
                        "title",
                        event.target.value
                      )
                    }
                    placeholder="Enter project title"
                    disabled={isSaving}
                    className={inputClass(
                      Boolean(errors.title)
                    )}
                  />

                  {errors.title && (
                    <FieldError
                      message={errors.title}
                    />
                  )}
                </div>

                {/* Role */}
                <div>
                  <label
                    htmlFor="project-role"
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    Role
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    id="project-role"
                    type="text"
                    value={formData.role}
                    onChange={(event) =>
                      updateField(
                        "role",
                        event.target.value
                      )
                    }
                    placeholder="e.g. Backend Developer"
                    disabled={isSaving}
                    className={inputClass(
                      Boolean(errors.role)
                    )}
                  />

                  {errors.role && (
                    <FieldError
                      message={errors.role}
                    />
                  )}
                </div>

                {/* Project type */}
                <div>
                  <label
                    htmlFor="project-type"
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    Project Type
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <select
                    id="project-type"
                    value={formData.projectType}
                    onChange={(event) =>
                      updateField(
                        "projectType",
                        event.target.value
                      )
                    }
                    disabled={isSaving}
                    className={inputClass(
                      Boolean(errors.projectType)
                    )}
                  >
                    {PROJECT_TYPE_OPTIONS.map(
                      (option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      )
                    )}
                  </select>

                  {errors.projectType && (
                    <FieldError
                      message={errors.projectType}
                    />
                  )}
                </div>

                {/* Difficulty */}
                <div>
                  <label
                    htmlFor="project-difficulty"
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    Difficulty
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <select
                    id="project-difficulty"
                    value={formData.difficulty}
                    onChange={(event) =>
                      updateField(
                        "difficulty",
                        event.target.value
                      )
                    }
                    disabled={isSaving}
                    className={inputClass(
                      Boolean(errors.difficulty)
                    )}
                  >
                    {DIFFICULTY_OPTIONS.map(
                      (option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      )
                    )}
                  </select>

                  {errors.difficulty && (
                    <FieldError
                      message={errors.difficulty}
                    />
                  )}
                </div>

                {/* Duration */}
                <div>
                  <label
                    htmlFor="project-duration"
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    Duration
                  </label>

                  <input
                    id="project-duration"
                    type="text"
                    value={formData.duration}
                    onChange={(event) =>
                      updateField(
                        "duration",
                        event.target.value
                      )
                    }
                    placeholder="e.g. 2 weeks"
                    disabled={isSaving}
                    className={inputClass(false)}
                  />
                </div>

                {/* Status */}
                <div>
                  <label
                    htmlFor="project-status"
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    Status
                  </label>

                  <select
                    id="project-status"
                    value={formData.status}
                    onChange={(event) =>
                      updateField(
                        "status",
                        event.target.value
                      )
                    }
                    disabled={isSaving}
                    className={inputClass(false)}
                  >
                    {STATUS_OPTIONS.map(
                      (option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Description                                                   */}
            {/* ------------------------------------------------------------ */}

            <section className="mt-8">
              <SectionTitle title="Project Description" />

              <label
                htmlFor="project-description"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Description
                <span className="ml-1 text-red-500">
                  *
                </span>
              </label>

              <textarea
                id="project-description"
                value={formData.description}
                onChange={(event) =>
                  updateField(
                    "description",
                    event.target.value
                  )
                }
                placeholder="Describe what the student needs to build..."
                rows={6}
                disabled={isSaving}
                className={`${inputClass(
                  Boolean(errors.description)
                )} resize-y`}
              />

              <div className="mt-1 flex items-center justify-between">
                {errors.description ? (
                  <FieldError
                    message={errors.description}
                  />
                ) : (
                  <span />
                )}

                <span className="text-xs text-slate-400">
                  {formData.description.length} characters
                </span>
              </div>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Focus                                                         */}
            {/* ------------------------------------------------------------ */}

            <section className="mt-8">
              <SectionTitle title="Project Focus" />

              <label
                htmlFor="project-focus"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Focus
              </label>

              <textarea
                id="project-focus"
                value={formData.focus}
                onChange={(event) =>
                  updateField(
                    "focus",
                    event.target.value
                  )
                }
                placeholder="What skills or concepts should this project focus on?"
                rows={3}
                disabled={isSaving}
                className={`${inputClass(
                  false
                )} resize-y`}
              />
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Technologies                                                  */}
            {/* ------------------------------------------------------------ */}

            <section className="mt-8">
              <SectionTitle title="Technologies" />

              <div className="flex gap-2">
                <input
                  type="text"
                  value={technologyInput}
                  onChange={(event) =>
                    setTechnologyInput(
                      event.target.value
                    )
                  }
                  onKeyDown={
                    handleTechnologyKeyDown
                  }
                  placeholder="e.g. React, Node.js, MongoDB"
                  disabled={isSaving}
                  className={`${inputClass(
                    false
                  )} flex-1`}
                />

                <button
                  type="button"
                  onClick={addTechnology}
                  disabled={
                    isSaving ||
                    !technologyInput.trim()
                  }
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>

              {formData.technologies.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {formData.technologies.map(
                    (technology, index) => (
                      <span
                        key={`${technology}-${index}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                      >
                        {technology}

                        <button
                          type="button"
                          onClick={() =>
                            removeTechnology(
                              index
                            )
                          }
                          disabled={isSaving}
                          className="rounded-full p-0.5 transition hover:bg-indigo-100 disabled:cursor-not-allowed dark:hover:bg-indigo-900/50"
                          aria-label={`Remove ${technology}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    )
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  No technologies added yet.
                </p>
              )}
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Requirements                                                  */}
            {/* ------------------------------------------------------------ */}

            <section className="mt-8">
              <SectionTitle title="Requirements" />

              <div className="flex gap-2">
                <input
                  type="text"
                  value={requirementInput}
                  onChange={(event) =>
                    setRequirementInput(
                      event.target.value
                    )
                  }
                  onKeyDown={
                    handleRequirementKeyDown
                  }
                  placeholder="Add a project requirement"
                  disabled={isSaving}
                  className={`${inputClass(
                    false
                  )} flex-1`}
                />

                <button
                  type="button"
                  onClick={addRequirement}
                  disabled={
                    isSaving ||
                    !requirementInput.trim()
                  }
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>

              {formData.requirements.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {formData.requirements.map(
                    (requirement, index) => (
                      <div
                        key={`${requirement}-${index}`}
                        className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />

                        <span className="min-w-0 flex-1 text-sm leading-5 text-slate-700 dark:text-slate-300">
                          {requirement}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            removeRequirement(
                              index
                            )
                          }
                          disabled={isSaving}
                          className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-200 hover:text-red-600 disabled:cursor-not-allowed dark:hover:bg-slate-700"
                          aria-label="Remove requirement"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  No requirements added yet.
                </p>
              )}
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Brief / PDF URL                                               */}
            {/* ------------------------------------------------------------ */}

            <section className="mt-8">
              <SectionTitle title="Project Document" />

              <label
                htmlFor="project-brief-url"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Brief / PDF URL
              </label>

              <input
                id="project-brief-url"
                type="url"
                value={formData.briefUrl}
                onChange={(event) =>
                  updateField(
                    "briefUrl",
                    event.target.value
                  )
                }
                placeholder="https://example.com/project.pdf"
                disabled={isSaving}
                className={inputClass(
                  Boolean(errors.briefUrl)
                )}
              />

              {errors.briefUrl ? (
                <FieldError
                  message={errors.briefUrl}
                />
              ) : (
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Leave this empty if the project does
                  not have a document URL.
                </p>
              )}
            </section>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Footer                                                           */}
          {/* ---------------------------------------------------------------- */}

          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-end dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* UI Helpers                                                                 */
/* -------------------------------------------------------------------------- */

function SectionTitle({
  title,
}: {
  title: string;
}) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
        {title}
      </h3>

      <div className="mt-2 h-px bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}

function FieldError({
  message,
}: {
  message: string;
}) {
  return (
    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
      {message}
    </p>
  );
}

function inputClass(hasError: boolean): string {
  return [
    "w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition",
    "bg-white text-slate-900 placeholder:text-slate-400",
    "dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500",
    "focus:ring-2",
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500"
      : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20 dark:border-slate-600",
    "disabled:cursor-not-allowed disabled:opacity-60",
  ].join(" ");
}

// Support both named and default imports.
export default ProjectEditModal;
