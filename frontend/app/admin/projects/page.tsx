"use client";

import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Pencil,
  Eye,
  UserPlus,
  FolderKanban,
  Users,
  CheckCircle2,
  Sparkles,
  UserRound,
  GraduationCap,
  ArrowLeft,
} from "lucide-react";

import { projectService } from "@/services/project.api";
import { candidateService } from "@/services/candidate.api";
import type { Candidate } from "@/types";

import ProjectForm, {
  ProjectFormData,
} from "@/components/projects/ProjectForm";

import ProjectEditModal from "@/components/projects/ProjectEditModal";
import ProjectAssignModal from "@/components/projects/ProjectAssignModal";
import ProjectAIGeneratorModal, {
  ProjectAIGeneratorData,
} from "@/components/projects/ProjectAIGeneratorModal";
import ProjectAIPreview, {
  ProjectAIPreviewData as GeneratedProject,
} from "@/components/projects/ProjectAIPreview";

type FormInitial = ComponentProps<typeof ProjectForm>["initialData"];

/* =========================================================
   TYPES
========================================================= */

type Difficulty = "junior" | "mid" | "senior";

type ProjectStatus = "active" | "archived";

type Project = {
  id: string;
  title: string;
  role: string;
  difficulty: Difficulty;
  description: string;
  technologies: string[];

  briefUrl: string;

  pdfUrl?: string;
  detailedPdfUrl?: string;

  // Temporary PDF data used during AI preview.
  // This is uploaded to Cloudinary only after Save/Confirm.
  pdfData?: string;
  pdfFilename?: string;

  projectType?: string;
  duration?: string;
  focus?: string;
  requirements?: string[];

  assigned: number;
  status: ProjectStatus;

  studentId?: string;
  studentName?: string;
};

/* =========================================================
   HELPERS
========================================================= */

const difficultyStyles: Record<Difficulty, string> = {
  junior:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",

  mid:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",

  senior:
    "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

function formatDifficulty(value: Difficulty) {
  switch (value) {
    case "junior":
      return "Junior";

    case "mid":
      return "Mid";

    case "senior":
      return "Senior";

    default:
      return value;
  }
}

function formatStatus(value: ProjectStatus) {
  switch (value) {
    case "active":
      return "Active";

    case "archived":
      return "Archived";

    default:
      return value;
  }
}

/* =========================================================
   PAGE
========================================================= */

export default function ProjectsPage() {
  const router = useRouter();

  /* -------------------------------------------------------
     PROJECT DATA
  ------------------------------------------------------- */

  const [projects, setProjects] = useState<Project[]>([]);

  const [loading, setLoading] = useState(true);

  const [actionLoading, setActionLoading] = useState(false);

  /* -------------------------------------------------------
     FILTERS
  ------------------------------------------------------- */

  const [search, setSearch] = useState("");

  const [difficulty, setDifficulty] = useState<
    "all" | Difficulty
  >("all");

  const [status, setStatus] = useState<
    "all" | ProjectStatus
  >("all");

  /* -------------------------------------------------------
     CREATE PROJECT
  ------------------------------------------------------- */

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  /* -------------------------------------------------------
     AI PROJECT GENERATOR
  ------------------------------------------------------- */

  const [showAIGenerator, setShowAIGenerator] =
    useState(false);

  const [showAIGenerationChoice, setShowAIGenerationChoice] =
    useState(false);

  const [showStudentSelector, setShowStudentSelector] =
    useState(false);

  const [selectedStudent, setSelectedStudent] =
    useState<Candidate | null>(null);

  const [aiGenerationMode, setAiGenerationMode] =
    useState<"general" | "student">("general");

  const [students, setStudents] = useState<Candidate[]>([]);

  const [studentSearch, setStudentSearch] = useState("");

  const [studentsLoading, setStudentsLoading] = useState(false);

  const [showAIPreview, setShowAIPreview] =
    useState(false);

  const [generatedProject, setGeneratedProject] =
    useState<GeneratedProject | null>(null);

  const [aiLoading, setAiLoading] = useState(false);

  // Keeps AI requirements intact when moving between Generator, Preview, and Edit.
  const [aiDraft, setAiDraft] = useState<ProjectAIGeneratorData | null>(null);

  /* -------------------------------------------------------
     SELECTED PROJECT
  ------------------------------------------------------- */

  const [selectedProject, setSelectedProject] =
    useState<Project | null>(null);

  /* -------------------------------------------------------
     EDIT / ASSIGN MODALS
  ------------------------------------------------------- */

  const [editOpen, setEditOpen] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);

  /* =======================================================
     LOAD PROJECTS
  ======================================================= */

  const loadProjects = async () => {
    try {
      setLoading(true);

      const result = await projectService.getProjects();

      setProjects(result);
    } catch (error) {
      console.error(
        "Failed to load projects:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadProjects();
  }, []);

  /* =======================================================
     LOAD STUDENTS FOR AI PROJECT GENERATION
  ======================================================= */

  useEffect(() => {
    if (!showStudentSelector) return;

    let cancelled = false;

    const loadStudents = async () => {
      try {
        setStudentsLoading(true);

        const result = await candidateService.getCandidates({
          status: "approved",
          page: 1,
          pageSize: 100,
          sortBy: "name",
          sortDir: "asc",
        });

        if (!cancelled) {
          setStudents(result.data);
        }
      } catch (error) {
        console.error("Failed to load students:", error);

        if (!cancelled) {
          setStudents([]);
        }
      } finally {
        if (!cancelled) {
          setStudentsLoading(false);
        }
      }
    };

    loadStudents();

    return () => {
      cancelled = true;
    };
  }, [showStudentSelector]);

  /* =======================================================
     FILTER PROJECTS
  ======================================================= */

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const searchValue = search
        .trim()
        .toLowerCase();

      const matchesSearch =
        !searchValue ||
        project.title
          .toLowerCase()
          .includes(searchValue) ||
        project.role
          .toLowerCase()
          .includes(searchValue) ||
        project.description
          .toLowerCase()
          .includes(searchValue) ||
        project.technologies.some((technology) =>
          technology
            .toLowerCase()
            .includes(searchValue)
        );

      const matchesDifficulty =
        difficulty === "all" ||
        project.difficulty === difficulty;

      const matchesStatus =
        status === "all" ||
        project.status === status;

      return (
        matchesSearch &&
        matchesDifficulty &&
        matchesStatus
      );
    });
  }, [
    projects,
    search,
    difficulty,
    status,
  ]);

  /* =======================================================
     STATISTICS
  ======================================================= */

  const filteredStudents = useMemo(() => {
    const value = studentSearch.trim().toLowerCase();

    if (!value) return students;

    return students.filter((student) => {
      return (
        student.name.toLowerCase().includes(value) ||
        student.email.toLowerCase().includes(value) ||
        student.role.toLowerCase().includes(value) ||
        student.skills.some((skill) =>
          skill.toLowerCase().includes(value)
        )
      );
    });
  }, [students, studentSearch]);

  const activeProjects = projects.filter(
    (project) => project.status === "active"
  ).length;

  const totalAssigned = projects.reduce(
    (total, project) =>
      total + project.assigned,
    0
  );

  /* =======================================================
     CREATE PROJECT
  ======================================================= */

  const handleCreateProject = async (
  data: ProjectFormData
) => {
  try {
    setActionLoading(true);

    /*
     * If this form was opened from the AI preview, preserve
     * the generated PDF and AI metadata when saving.
     *
     * IMPORTANT:
     * AI generation is draft-only. This POST is the point where
     * the project is actually created in MongoDB.
     */
    const draft = generatedProject;

    const generationContext =
      draft &&
      "generationContext" in draft
        ? (draft as GeneratedProject & {
            generationContext?: {
              projectType?: string;
              duration?: number;
              focus?: string[];
              requirements?: string;
              studentId?: string;
            };
          }).generationContext
        : undefined;

    const savedProject =
      await projectService.createProject({
        title: data.title,
        role: data.role,
        difficulty: data.difficulty,
        description: data.description,
        technologies: data.technologies,

        briefUrl:
          data.briefUrl ||
          draft?.briefUrl ||
          "",

        status:
          data.status ?? "active",

        /*
         * =====================================================
         * PDF SAVE FLOW
         * =====================================================
         *
         * AI-generated PDF stays in memory/base64 until
         * the admin confirms the save.
         *
         * The backend receives pdfData and uploads it
         * to Cloudinary.
         */

        pdfData:
          typeof draft?.pdfData === "string"
            ? draft.pdfData
            : undefined,

        pdfFilename:
          typeof draft?.pdfFilename === "string"
            ? draft.pdfFilename
            : undefined,

        /*
         * Do NOT send the temporary preview data URL.
         *
         * If pdfData exists, backend must upload that PDF
         * to Cloudinary and generate the real URL.
         */
        pdfUrl:
          typeof draft?.pdfData === "string"
            ? undefined
            : data.pdfUrl || undefined,

        detailedPdfUrl:
          typeof draft?.pdfData === "string"
            ? undefined
            : data.detailedPdfUrl || undefined,

        /*
         * =====================================================
         * PROJECT METADATA
         * =====================================================
         */

        projectType:
          data.projectType ||
          draft?.projectType ||
          generationContext?.projectType ||
          undefined,

        duration:
          data.duration ||
          (draft?.duration != null
            ? String(draft.duration)
            : undefined) ||
          (generationContext?.duration != null
            ? formatGeneratorDuration(
                generationContext.duration
              )
            : undefined),

        focus:
          data.focus ||
          (Array.isArray(draft?.focus)
            ? draft.focus.join(", ")
            : draft?.focus) ||
          (generationContext?.focus?.length
            ? generationContext.focus.join(", ")
            : undefined),

        requirements:
          Array.isArray(data.requirements)
            ? data.requirements
            : Array.isArray(draft?.requirements)
              ? draft.requirements
              : [],

        /*
         * =====================================================
         * STUDENT
         * =====================================================
         */

        studentId:
          data.studentId ||
          draft?.studentId ||
          generationContext?.studentId ||
          selectedStudent?.id ||
          undefined,

        studentName:
          data.studentName ||
          draft?.studentName ||
          selectedStudent?.name ||
          undefined,
      });

      /*
       * Assignment happens ONLY after MongoDB has returned the
       * newly created project ID.
       */
      const studentId =
        data.studentId ||
        draft?.studentId ||
        generationContext?.studentId ||
        selectedStudent?.id ||
        undefined;

      if (studentId) {
        await projectService.assignProjectToCandidate(
          savedProject.id,
          studentId
        );
      }

      setProjects((current) => [
        savedProject,
        ...current.filter(
          (project) => project.id !== savedProject.id
        ),
      ]);

      setShowCreateModal(false);
      setShowAIPreview(false);
      setGeneratedProject(null);
      setAiDraft(null);
      setSelectedStudent(null);
    } catch (error) {
      console.error(
        "Create project failed:",
        error
      );

      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  /* =======================================================
     AI PROJECT GENERATION
  ======================================================= */

  const handleGenerateAI = async (
    data: ProjectAIGeneratorData
  ) => {
    try {
      setAiDraft(data);
      setAiLoading(true);

      /*
       * IMPORTANT:
       *
       * Do NOT create a fake project on the frontend.
       *
       * The real project must be generated by the backend:
       *
       * Frontend
       *    ↓
       * projectService.generateProject()
       *    ↓
       * POST /api/projects/generate
       *    ↓
       * AI generation
       * PDF generation in memory
       *    ↓
       * Draft project + transient PDF base64
       *
       * IMPORTANT: generation is draft-only.
       * MongoDB save happens only after confirmation.
       */

      const requirements = data.requirements
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const technologies = (
        Array.isArray(data.technologies)
          ? data.technologies
          : []
      )
        .map((technology) => String(technology).trim())
        .filter(Boolean);

      const duration = formatGeneratorDuration(
        data.duration
      );

      const focus = data.focus?.length
        ? data.focus.join(", ")
        : "general";

      /*
       * Candidate education can differ slightly between
       * frontend Candidate types and backend AI types.
       *
       * Pass only the common education fields.
       */
      const studentEducation =
        selectedStudent?.education
          ? {
              degree:
                selectedStudent.education.degree,
              institution:
                selectedStudent.education.college,
            }
          : undefined;

      /*
       * Call the REAL backend generation API.
       *
       * projectService.generateProject() already calls:
       *
       * POST /api/projects/generate
       *
       * and normalizes:
       * - pdfData
       * - pdfFilename
       */
      const generated = await projectService.generateProject({
        role: data.role.trim(),

        projectType: data.projectType,

        difficulty: data.difficulty,

        duration,

        technologies,

        focus,

        requirements,

        /*
         * This is critical.
         * It tells the backend to create the PDF.
         */
        generateDetailedPdf: true,

        pdfFormat: "pdf",

        studentId:
          data.studentId ||
          selectedStudent?.id ||
          undefined,

        studentName:
          selectedStudent?.name ||
          undefined,

        studentSkills:
          selectedStudent?.skills || [],

        studentEducation,

        description:
          data.requirements.trim() ||
          undefined,
      });

      /*
       * Generation returns the PDF as transient base64 data.
       * It is NOT uploaded to Cloudinary yet.
       * Cloudinary upload happens only inside the confirmed-save API request.
       */
      const pdfData =
        typeof generated.pdfData === "string"
          ? generated.pdfData
          : "";

      const pdfFilename =
        typeof generated.pdfFilename === "string" &&
        generated.pdfFilename.trim()
          ? generated.pdfFilename
          : "project-preview.pdf";


      if (!pdfData) {
        throw new Error(
          "The project was generated, but no PDF preview data was returned."
        );
      }

      const pdfPreviewUrl =
        `data:application/pdf;base64,${pdfData}`;

      console.log(
        "AI project generated successfully. PDF is still transient and has not been uploaded.",
        generated
      );

      /*
       * ProjectAIPreview has a richer GeneratedProject type.
       *
       * The backend Project already contains the important
       * project/PDF fields, so preserve the backend object
       * and attach the generation context used by the UI.
       */
      const previewProject =
        {
          ...generated,

          // Preview-only browser data URL. It is NEVER stored in MongoDB.
          // The backend uploads pdfData to Cloudinary only on confirmed save.
          pdfUrl: pdfPreviewUrl,

          detailedPdfUrl: pdfPreviewUrl,

          pdfData,

          pdfFilename,

          generationContext: {
            projectType:
              data.projectType,

            duration:
              data.duration,

            focus:
              data.focus,

            requirements:
              data.requirements,

            studentId:
              data.studentId ||
              selectedStudent?.id,
          },
        } as GeneratedProject & {
          id?: string;

          pdfUrl?: string;
          detailedPdfUrl?: string;

          pdfData?: string;
          pdfFilename?: string;

          generationContext: {
            projectType: string;
            duration: number;
            focus: string[];
            requirements: string;
            studentId?: string;
          };
        };

      /*
       * Store the REAL backend-generated project.
       */
      setGeneratedProject(previewProject);

      /*
       * Close generator and show the real preview.
       */
      setShowAIGenerator(false);
      setShowAIPreview(true);
    } catch (error) {
      console.error(
        "AI project generation failed:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Failed to generate the project.";

      alert(message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleUseGeneratedProject = async (
    projectFromPreview?: GeneratedProject
  ) => {
    try {
      setActionLoading(true);

      /*
       * ProjectAIPreview calls onUseProject without arguments.
       * Therefore the source of truth is the generatedProject state
       * stored by this page. projectFromPreview is only for compatibility
       * with older preview components that passed the project back.
       */
      const project =
        projectFromPreview ?? generatedProject;

      if (!project) {
        throw new Error(
          "No generated project is available to save. Generate the project again."
        );
      }

      const generationContext =
        "generationContext" in project
          ? (project as GeneratedProject & {
              generationContext?: {
                projectType?: string;
                duration?: number;
                focus?: string[];
                requirements?: string;
                studentId?: string;
              };
            }).generationContext
          : undefined;

      /*
       * Normalize the generated response before saving.
       * Some AI/backend responses may use `name` instead of `title`,
       * or omit a top-level description while requirements contain
       * the generated project brief.
       */
      const normalizedTitle =
        typeof project.title === "string" &&
        project.title.trim()
          ? project.title.trim()
          : typeof project.name === "string" &&
              project.name.trim()
            ? project.name.trim()
            : "";

      const normalizedRole =
        typeof project.role === "string" &&
        project.role.trim()
          ? project.role.trim()
          : "";

      const normalizedDescription =
        typeof project.description === "string" &&
        project.description.trim()
          ? project.description.trim()
          : Array.isArray(project.requirements)
            ? project.requirements
                .map((item) => String(item).trim())
                .filter(Boolean)
                .join("\n")
            : typeof project.requirements === "string"
              ? project.requirements.trim()
              : "";

      /*
       * THIS is the save point.
       *
       * Generate with AI -> preview only.
       * Confirm & Save -> POST /api/projects -> MongoDB.
       */
      if (!normalizedTitle || !normalizedRole || !normalizedDescription) {
        console.error("Generated project data before save:", project);

        throw new Error(
          "Generated project is missing required title, role, or description. Please regenerate the project."
        );
      }

      const savedProject =
        await projectService.createProject({
          title: normalizedTitle,
          role: normalizedRole,
          difficulty:
            (project.difficulty as Difficulty) || "junior",
          description:
            normalizedDescription,
          technologies: Array.isArray(project.technologies)
            ? project.technologies
            : [],
          briefUrl: project.briefUrl || "",
          status:
            (project.status as ProjectStatus) || "active",

          // Keep the preview PDF transient until this confirmed-save request.
          pdfData:
            typeof project.pdfData === "string"
              ? project.pdfData
              : undefined,

          pdfFilename:
            typeof project.pdfFilename === "string"
              ? project.pdfFilename
              : undefined,

          pdfUrl:
            typeof project.pdfData === "string"
              ? undefined
              : project.pdfUrl || undefined,

          detailedPdfUrl:
            typeof project.pdfData === "string"
              ? undefined
              : project.detailedPdfUrl || undefined,

          projectType:
            project.projectType ||
            generationContext?.projectType ||
            undefined,

          duration:
            project.duration != null
              ? String(project.duration)
              : generationContext?.duration != null
                ? formatGeneratorDuration(
                    generationContext.duration
                  )
                : undefined,

          focus:
            Array.isArray(project.focus)
              ? project.focus.join(", ")
              : project.focus ||
                (generationContext?.focus?.length
                  ? generationContext.focus.join(", ")
                  : undefined),

          requirements:
            Array.isArray(project.requirements)
              ? project.requirements
              : generationContext?.requirements
                ? generationContext.requirements
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                : [],

          studentId:
            project.studentId ||
            generationContext?.studentId ||
            selectedStudent?.id ||
            undefined,

          studentName:
            project.studentName ||
            selectedStudent?.name ||
            undefined,
        });

      /*
       * Assign only after the project has been created and has
       * a real MongoDB ID.
       */
      const studentId =
        project.studentId ||
        generationContext?.studentId ||
        selectedStudent?.id ||
        undefined;

      if (studentId) {
        await projectService.assignProjectToCandidate(
          savedProject.id,
          studentId
        );
      }

      setProjects((current) => [
        savedProject,
        ...current.filter(
          (item) => item.id !== savedProject.id
        ),
      ]);

      setShowAIPreview(false);
      setGeneratedProject(null);
      setAiDraft(null);
      setSelectedStudent(null);
    } catch (error) {
      console.error(
        "Saving generated project failed:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Failed to save the generated project.";

      alert(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerateProject = () => {
    setShowAIPreview(false);
    setShowAIGenerator(true);
  };

  const handleEditGeneratedProject = () => {
    setShowAIPreview(false);
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    if (actionLoading) return;

    setShowCreateModal(false);
    setGeneratedProject(null);
    setSelectedStudent(null);
    setAiDraft(null);
  };

  /* =======================================================
     OPEN PROJECT DETAILS
  ======================================================= */


  const handleOpenProject = (
    projectId: string
  ) => {
    router.push(
      `/admin/projects/${projectId}`
    );
  };

  /* =======================================================
     EDIT PROJECT
  ======================================================= */

  const handleEditProject = (
    project: Project
  ) => {
    setSelectedProject(project);
    setEditOpen(true);
  };

  /* =======================================================
     ASSIGN PROJECT
  ======================================================= */

  const handleAssignProject = (
    project: Project
  ) => {
    if (project.status === "archived") {
      return;
    }

    setSelectedProject(project);
    setAssignOpen(true);
  };

  /* =======================================================
     PROJECT UPDATED
  ======================================================= */

  const handleProjectUpdated = (
    updatedRaw: Parameters<
      NonNullable<ComponentProps<typeof ProjectEditModal>["onUpdated"]>
    >[0]
  ) => {
    const updated = updatedRaw as unknown as Partial<Project>;

    if (!updated.id) return;

    const id = updated.id;

    setProjects((current) =>
      current.map((project) =>
        project.id === id ? { ...project, ...updated } : project
      )
    );

    setSelectedProject((current) =>
      current ? { ...current, ...updated } : current
    );

    setEditOpen(false);
  };

  /* =======================================================
     PROJECT ASSIGNED
  ======================================================= */

  const handleProjectAssigned = async () => {
    setAssignOpen(false);

    setSelectedProject(null);

    await loadProjects();
  };

  /* =======================================================
     CLOSE EDIT
  ======================================================= */

  const closeEdit = () => {
    setEditOpen(false);

    setSelectedProject(null);
  };

  /* =======================================================
     CLOSE ASSIGN
  ======================================================= */

  const closeAssign = () => {
    setAssignOpen(false);

    setSelectedProject(null);
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-sm text-slate-500">
              Loading projects...
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <FolderKanban size={16} />
              Recruitment
            </div>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Projects
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage projects assigned to candidates.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setShowAIGenerationChoice(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 active:scale-[0.98] dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20"
            >
              <span aria-hidden="true">✨</span>
              Generate with AI
            </button>

            <button
              type="button"
              onClick={() => {
                setGeneratedProject(null);
                setSelectedStudent(null);
                setAiDraft(null);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
            >
              <Plus size={18} />
              Add Project
            </button>
          </div>

        </div>

        {/* =================================================
            STATS
        ================================================= */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

          <StatCard
            icon={<FolderKanban size={19} />}
            label="Total Projects"
            value={projects.length}
          />

          <StatCard
            icon={<CheckCircle2 size={19} />}
            label="Active Projects"
            value={activeProjects}
          />

          <StatCard
            icon={<Users size={19} />}
            label="Total Assignments"
            value={totalAssigned}
          />

        </div>

        {/* =================================================
            FILTERS
        ================================================= */}

        <section className="surface rounded-2xl border p-4 shadow-sm">

          <div className="flex flex-col gap-3 lg:flex-row">

            {/* SEARCH */}

            <div className="relative flex-1">

              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search projects..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-[#10141d]"
              />

            </div>

            {/* DIFFICULTY */}

            <select
              value={difficulty}
              onChange={(event) =>
                setDifficulty(
                  event.target.value as
                    | "all"
                    | Difficulty
                )
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#10141d]"
            >
              <option value="all">
                All Difficulty
              </option>

              <option value="junior">
                Junior
              </option>

              <option value="mid">
                Mid
              </option>

              <option value="senior">
                Senior
              </option>
            </select>

            {/* STATUS */}

            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as
                    | "all"
                    | ProjectStatus
                )
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#10141d]"
            >
              <option value="all">
                All Status
              </option>

              <option value="active">
                Active
              </option>

              <option value="archived">
                Archived
              </option>
            </select>

          </div>

        </section>

        {/* =================================================
            PROJECT GRID
        ================================================= */}

        {filteredProjects.length > 0 ? (

          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">

            {filteredProjects.map((project) => (

              <article
                key={project.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  handleOpenProject(project.id)
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    event.preventDefault();

                    handleOpenProject(
                      project.id
                    );
                  }
                }}
                className="
                  surface
                  group
                  flex
                  h-[400px]
                  cursor-pointer
                  flex-col
                  rounded-2xl
                  border
                  p-4
                  shadow-sm
                  transition
                  duration-200
                  hover:-translate-y-0.5
                  hover:border-indigo-200
                  hover:shadow-md
                  focus:outline-none
                  focus:ring-2
                  focus:ring-indigo-500/30
                  dark:hover:border-indigo-500/30
                "
              >

                {/* =========================================
                    PROJECT ICON + STATUS
                ========================================= */}

                <div className="flex shrink-0 items-start justify-between gap-3">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    <FolderKanban size={19} />
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      project.status === "active"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400"
                    }`}
                  >
                    {formatStatus(
                      project.status
                    )}
                  </span>

                </div>

                {/* =========================================
                    PROJECT INFORMATION
                ========================================= */}

                <div className="mt-3 shrink-0 space-y-1">

                  <div className="flex items-center gap-2">

                    <h2 className="min-w-0 flex-1 truncate font-semibold text-slate-900 dark:text-white">
                      {project.title}
                    </h2>

                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${difficultyStyles[project.difficulty]}`}
                    >
                      {formatDifficulty(
                        project.difficulty
                      )}
                    </span>

                  </div>

                  <p className="truncate text-sm font-medium text-indigo-600 dark:text-indigo-400">
                    {project.role}
                  </p>

                  {/*
                    IMPORTANT:
                    No fixed h-[42px]/overflow-hidden here.
                    line-clamp-2 already caps this at two lines —
                    a fixed height on top of that just reserves
                    blank space when the text is shorter.
                  */}
                  <p className="line-clamp-2 text-sm leading-5 text-slate-500 dark:text-slate-400">
                    {project.description ||
                      "No description available."}
                  </p>

                </div>

                {/* =========================================
                    TECHNOLOGIES

                    IMPORTANT:
                    - Only rendered when technologies exist —
                      no reserved blank block otherwise.
                    - No fixed height, no max-height, no
                      overflow-hidden — tags (including the
                      trailing +N tag) wrap naturally and are
                      never clipped.
                ========================================= */}

                {project.technologies?.length > 0 && (

                  <div className="mt-3 flex flex-wrap gap-2 shrink-0">

                    {project.technologies
                      .slice(0, 5)
                      .map((technology) => (

                        <span
                          key={technology}
                          className="
                            rounded-lg
                            bg-slate-100
                            px-2
                            py-1
                            text-[11px]
                            font-medium
                            text-slate-600
                            dark:bg-white/5
                            dark:text-slate-300
                          "
                        >
                          {technology}
                        </span>

                      ))}

                    {project.technologies.length > 5 && (

                      <span
                        className="
                          rounded-lg
                          bg-slate-100
                          px-2
                          py-1
                          text-[11px]
                          font-medium
                          text-slate-500
                          dark:bg-white/5
                          dark:text-slate-400
                        "
                      >
                        +{project.technologies.length - 5}
                      </span>

                    )}

                  </div>

                )}

                {/* =========================================
                    BOTTOM SECTION

                    mt-auto pushes this to the bottom of the
                    card using ONLY the actual remaining
                    space — nothing above it reserves space
                    artificially anymore, so this no longer
                    creates an oversized gap.
                ========================================= */}

                <div className="mt-auto shrink-0">

                  {/* ASSIGNED CANDIDATES */}

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/10">

                    <div>

                      <p className="text-xs text-slate-400">
                        Assigned candidates
                      </p>

                      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-white">
                        <Users size={14} />
                        {project.assigned}
                      </p>

                    </div>

                    <span className="text-xs text-slate-400 transition group-hover:text-indigo-500">
                      Click to view details →
                    </span>

                  </div>

                  {/* ACTION BUTTONS */}

                  <div className="mt-3 grid grid-cols-3 gap-2">

                    {/* VIEW */}

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();

                        handleOpenProject(
                          project.id
                        );
                      }}
                      className="
                        flex
                        items-center
                        justify-center
                        gap-1.5
                        rounded-lg
                        border
                        border-slate-200
                        py-1.5
                        text-xs
                        font-medium
                        text-slate-600
                        transition
                        hover:bg-slate-50
                        dark:border-white/10
                        dark:text-slate-300
                        dark:hover:bg-white/5
                      "
                    >
                      <Eye size={14} />
                      View
                    </button>

                    {/* EDIT */}

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();

                        handleEditProject(
                          project
                        );
                      }}
                      className="
                        flex
                        items-center
                        justify-center
                        gap-1.5
                        rounded-lg
                        border
                        border-slate-200
                        py-1.5
                        text-xs
                        font-medium
                        text-slate-600
                        transition
                        hover:bg-slate-50
                        dark:border-white/10
                        dark:text-slate-300
                        dark:hover:bg-white/5
                      "
                    >
                      <Pencil size={14} />
                      Edit
                    </button>

                    {/* ASSIGN */}

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();

                        handleAssignProject(
                          project
                        );
                      }}
                      disabled={
                        project.status ===
                        "archived"
                      }
                      className="
                        flex
                        items-center
                        justify-center
                        gap-1.5
                        rounded-lg
                        bg-indigo-50
                        py-1.5
                        text-xs
                        font-medium
                        text-indigo-600
                        transition
                        hover:bg-indigo-100
                        disabled:cursor-not-allowed
                        disabled:opacity-50
                        dark:bg-indigo-500/10
                        dark:text-indigo-400
                        dark:hover:bg-indigo-500/20
                      "
                    >
                      <UserPlus size={14} />
                      Assign
                    </button>

                  </div>

                </div>

              </article>

            ))}

          </section>

        ) : (

          /* =================================================
             NO PROJECTS
          ================================================= */

          <div className="surface rounded-2xl border p-12 text-center">

            <FolderKanban
              className="mx-auto text-slate-400"
              size={35}
            />

            <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">
              No projects found
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Try changing your filters or search query.
            </p>

          </div>

        )}

      </div>

      {/* ===================================================
          CREATE PROJECT MODAL
      =================================================== */}

      {showCreateModal && (

        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {

            if (
              event.target ===
                event.currentTarget &&
              !actionLoading
            ) {
              handleCloseCreateModal();
            }

          }}
        >

          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#151922]">

            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-white/10">

              <div>

                <h2 className="font-semibold text-slate-900 dark:text-white">
                  {generatedProject ? "Save AI Project" : "Create Project"}
                </h2>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {generatedProject
                    ? "Review the generated project, make changes, then save it to the project bank."
                    : "Add a new project to the project bank."}
                </p>

              </div>

              <button
                type="button"
                onClick={handleCloseCreateModal}
                disabled={actionLoading}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <span className="sr-only">
                  Close
                </span>

                ×
              </button>

            </div>

            {/* FORM */}

            <div className="max-h-[75vh] overflow-y-auto p-5">

              <ProjectForm
                initialData={
                  generatedProject
                    ? {
                        title: generatedProject.title || "",
                        role: generatedProject.role || "",
                        difficulty:
                          (generatedProject.difficulty as Difficulty) ||
                          "junior",
                        description:
                          generatedProject.description || "",
                        technologies:
                          Array.isArray(generatedProject.technologies)
                            ? generatedProject.technologies
                            : [],
                        briefUrl:
                          generatedProject.briefUrl || "",
                        status:
                          (generatedProject.status as ProjectStatus) ||
                          "active",

                        /* AI-generated project data */
                        pdfUrl:
                          generatedProject.pdfUrl || "",
                        detailedPdfUrl:
                          generatedProject.detailedPdfUrl || "",
                        projectType:
                          generatedProject.projectType || "",
                        duration:
                          generatedProject.duration != null
                            ? String(generatedProject.duration)
                            : "",
                        focus:
                          Array.isArray(generatedProject.focus)
                            ? generatedProject.focus.join(", ")
                            : generatedProject.focus || "",
                        requirements:
                          Array.isArray(generatedProject.requirements)
                            ? generatedProject.requirements
                            : typeof generatedProject.requirements === "string"
                              ? generatedProject.requirements
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean)
                              : [],
                        studentId:
                          generatedProject.studentId || undefined,
                        studentName:
                          generatedProject.studentName || undefined,
                        studentSkills:
                          Array.isArray(generatedProject.studentSkills)
                            ? generatedProject.studentSkills
                            : [],
                        studentEducation:
                          generatedProject.studentEducation || undefined,
                        generatedByAI: true,

                        /* Preserve dynamic AI PDF sections. */
                        sections:
                          Array.isArray(
                            (generatedProject as GeneratedProject & { sections?: unknown[] }).sections
                          )
                            ? ((generatedProject as GeneratedProject & { sections?: unknown[] })
                                .sections as NonNullable<FormInitial>["sections"])
                            : [],
                      }
                    : undefined
                }
                submitLabel={generatedProject ? "Save Project" : "Create Project"}
                showStatus={false}
                loading={actionLoading}
                onGenerateAI={() => {
                  setShowCreateModal(false);
                  setShowAIGenerationChoice(false);
                  setShowAIGenerator(true);
                }}
                onCancel={handleCloseCreateModal}
                onSubmit={handleCreateProject}
              />

            </div>

          </div>

        </div>

      )}

      {/* ===================================================
          AI GENERATION CHOICE
      =================================================== */}

      {showAIGenerationChoice && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !aiLoading
            ) {
              setShowAIGenerationChoice(false);
            }
          }}
        >
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#151922]">
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                  <Sparkles size={20} />
                </div>

                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Generate Project with AI
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    Choose how you want AI to create the project.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAIGenerationChoice(false)}
                disabled={aiLoading}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/5 dark:hover:text-white"
              >
                ×
              </button>
            </div>

            {/* OPTIONS */}
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              {/* STUDENT PROJECT */}
              <div className="group flex min-h-[265px] flex-col rounded-xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg dark:border-white/10 dark:bg-[#11151d] dark:hover:border-indigo-500/40">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    <UserRound size={20} />
                  </div>

                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                    Personalized
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">
                    For a Specific Student
                  </h3>
                  <p className="mt-2 text-sm leading-5 text-slate-500 dark:text-slate-400">
                    Create a project tailored to a student&apos;s skills,
                    education, role, and JD match.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAiGenerationMode("student");
                    setStudentSearch("");
                    setShowAIGenerationChoice(false);
                    setShowStudentSelector(true);
                  }}
                  className="mt-auto flex h-10 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99]"
                >
                  Select Student
                  <span className="ml-1.5">→</span>
                </button>
              </div>

              {/* GENERAL PROJECT */}
              <div className="group flex min-h-[265px] flex-col rounded-xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg dark:border-white/10 dark:bg-[#11151d] dark:hover:border-white/20">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300">
                    <GraduationCap size={20} />
                  </div>

                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-white/5 dark:text-slate-300">
                    Reusable
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">
                    General Project
                  </h3>
                  <p className="mt-2 text-sm leading-5 text-slate-500 dark:text-slate-400">
                    Create a reusable project for a role without linking it
                    to a particular student.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAiGenerationMode("general");
                    setSelectedStudent(null);
                    setAiDraft(null);
                    setShowAIGenerationChoice(false);
                    setShowAIGenerator(true);
                  }}
                  className="mt-auto flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99] dark:border-white/10 dark:bg-[#151922] dark:text-slate-200 dark:hover:bg-white/5"
                >
                  Create General Project
                  <span className="ml-1.5">→</span>
                </button>
              </div>
            </div>

            {/* FOOTER */}
            <div className="flex justify-end border-t border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-white/10 dark:bg-white/[0.02]">
              <button
                type="button"
                onClick={() => setShowAIGenerationChoice(false)}
                disabled={aiLoading}
                className="h-10 rounded-lg border border-slate-200 bg-white px-5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[#151922] dark:text-slate-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ===================================================
          STUDENT SELECTOR
      =================================================== */}

      {showStudentSelector && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-md sm:p-5"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !studentsLoading
            ) {
              setShowStudentSelector(false);
            }
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-[#151922]">
            {/* HEADER */}
            <div className="shrink-0 border-b border-slate-200/80 bg-white px-5 py-5 sm:px-7 dark:border-white/10 dark:bg-[#151922]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20">
                    <UserRound size={22} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white sm:text-xl">
                        Select Student
                      </h2>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                        Approved only
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Choose a student to personalize the AI-generated project.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowStudentSelector(false)}
                  disabled={studentsLoading}
                  aria-label="Close"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  ×
                </button>
              </div>

              {/* SEARCH */}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={studentSearch}
                    onChange={(event) =>
                      setStudentSearch(event.target.value)
                    }
                    placeholder="Search by name, email, role or skill..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-[#10141d] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-indigo-500"
                  />
                </div>

                <div className="flex h-11 shrink-0 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                  <Users size={16} className="mr-2" />
                  <span>
                    {studentsLoading
                      ? "Loading..."
                      : `${filteredStudents.length} student${filteredStudents.length === 1 ? "" : "s"}`}
                  </span>
                </div>
              </div>
            </div>

            {/* STUDENT LIST */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4 sm:px-7 sm:py-5 dark:bg-[#10141d]/60">
              {studentsLoading ? (
                <div className="flex min-h-[300px] items-center justify-center">
                  <div className="flex flex-col items-center text-center">
                    <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600 dark:border-white/10 dark:border-t-indigo-400" />
                    <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                      Loading approved students...
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Please wait a moment.
                    </p>
                  </div>
                </div>
              ) : filteredStudents.length > 0 ? (
                <div className="grid gap-3">
                  {filteredStudents.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => {
                        setSelectedStudent(student);
                        setAiGenerationMode("student");
                        setAiDraft(null);
                        setShowStudentSelector(false);
                        setShowAIGenerator(true);
                      }}
                      className="group w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-[#151922] dark:hover:border-indigo-500/40"
                    >
                      <div className="flex items-start gap-3.5">
                        {/* AVATAR */}
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-indigo-50 text-sm font-bold text-indigo-600 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20">
                          {student.avatarUrl ? (
                            <Image
                              src={student.avatarUrl}
                              alt=""
                              width={48}
                              height={48}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            student.name
                              .split(" ")
                              .map((part) => part[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()
                          )}
                        </div>

                        {/* MAIN CONTENT */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <h3 className="truncate text-[15px] font-semibold text-slate-900 dark:text-white sm:text-base">
                                {student.name}
                              </h3>

                              <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
                                {student.role || "Role not specified"}
                                {student.batch ? ` • ${student.batch}` : ""}
                              </p>
                            </div>

                            <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                              <CheckCircle2 size={13} />
                              JD Match {student.jdMatchScore ?? 0}%
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                            <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/[0.03]">
                              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                Education
                              </span>
                              <span className="mt-0.5 block truncate font-medium text-slate-600 dark:text-slate-300">
                                {student.education?.degree || "Not specified"}
                              </span>
                            </div>

                            <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/[0.03]">
                              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                College
                              </span>
                              <span className="mt-0.5 block truncate font-medium text-slate-600 dark:text-slate-300">
                                {student.education?.college || "Not specified"}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            <span className="shrink-0 text-[11px] font-medium text-slate-400">
                              Skills
                            </span>
                            <div className="flex min-w-0 flex-wrap gap-1.5">
                              {student.skills.slice(0, 6).map((skill) => (
                                <span
                                  key={skill}
                                  className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-white/5 dark:text-slate-300"
                                >
                                  {skill}
                                </span>
                              ))}

                              {student.skills.length > 6 && (
                                <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500 dark:bg-white/5 dark:text-slate-400">
                                  +{student.skills.length - 6}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* ACTION */}
                        <div className="hidden shrink-0 items-center self-center sm:flex">
                          <span className="flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition group-hover:bg-indigo-600 group-hover:text-white dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:group-hover:bg-indigo-600 dark:group-hover:text-white">
                            Select
                            <span aria-hidden="true">→</span>
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex sm:hidden">
                        <span className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white shadow-sm transition group-hover:bg-indigo-700">
                          Select Student
                          <span aria-hidden="true">→</span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center dark:border-white/10 dark:bg-[#151922]">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
                    <Search size={24} />
                  </div>
                  <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">
                    No students found
                  </h3>
                  <p className="mt-1 max-w-sm text-sm leading-5 text-slate-500 dark:text-slate-400">
                    {studentSearch
                      ? "Try a different name, email, role, or skill."
                      : "There are no approved students available for project generation."}
                  </p>
                  {studentSearch && (
                    <button
                      type="button"
                      onClick={() => setStudentSearch("")}
                      className="mt-4 h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-[#151922] dark:text-slate-300 dark:hover:bg-white/5"
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 sm:px-7 dark:border-white/10 dark:bg-[#151922]">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      if (studentsLoading) return;
                      setShowStudentSelector(false);
                      setStudentSearch("");
                      setShowAIGenerationChoice(true);
                    }}
                    disabled={studentsLoading}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:border-white/10 dark:bg-[#151922] dark:text-slate-200 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowStudentSelector(false)}
                    disabled={studentsLoading}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:border-white/10 dark:bg-[#151922] dark:text-slate-300 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>

                <p className="hidden text-xs text-slate-400 sm:block">
                  Select a student to continue to the AI project generator.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          AI PROJECT GENERATOR
      =================================================== */}

      <ProjectAIGeneratorModal
        open={showAIGenerator}
        loading={aiLoading}
        student={selectedStudent}
        mode={aiGenerationMode}
        initialData={aiDraft ?? undefined}
        onClose={() => {
          if (!aiLoading) {
            setShowAIGenerator(false);
          }
        }}
        onBack={() => {
          if (!aiLoading) {
            setShowAIGenerator(false);
            setShowAIGenerationChoice(true);
          }
        }}
        onGenerate={handleGenerateAI}
      />

      {/* ===================================================
          AI PROJECT PREVIEW
      =================================================== */}

      <ProjectAIPreview
        open={showAIPreview}
        project={generatedProject}
        onClose={() => setShowAIPreview(false)}
        onRegenerate={handleRegenerateProject}
        onEdit={handleEditGeneratedProject}
        onUseProject={() =>
          handleUseGeneratedProject(generatedProject ?? undefined)
        }
        saving={actionLoading}
      />

      {/* ===================================================
          EDIT PROJECT
      =================================================== */}

      {selectedProject && (

        <ProjectEditModal
          open={editOpen}
          project={selectedProject}
          onClose={closeEdit}
          onUpdated={
            handleProjectUpdated
          }
        />

      )}

      {/* ===================================================
          ASSIGN PROJECT
      =================================================== */}

      {selectedProject && (

        <ProjectAssignModal
          open={assignOpen}
          project={selectedProject}
          onClose={closeAssign}
          onAssigned={
            handleProjectAssigned
          }
        />

      )}

    </main>
  );
}

function formatGeneratorType(value: string) {
  const labels: Record<string, string> = {
    backend: "Backend",
    frontend: "Frontend",
    fullstack: "Full-Stack",
    mobile: "Mobile",
    ai_ml: "AI/ML",
    data_science: "Data Science",
    devops: "DevOps",
  };

  return labels[value] ?? value;
}

function formatGeneratorFocus(value: string[]) {
  const labels: Record<string, string> = {
    authentication: "Authentication",
    api_development: "API Development",
    database: "Database Design",
    frontend: "Frontend Development",
    fullstack: "Full-Stack Development",
    ai_integration: "AI Integration",
    problem_solving: "Problem Solving",
    system_design: "System Design",
    testing: "Testing & QA",
    performance: "Performance Optimization",
    security: "Security",
    cloud: "Cloud Integration",
    microservices: "Microservices",
    real_time: "Real-Time Systems",
    payments: "Payments",
    file_processing: "File Processing",
    notifications: "Notifications",
    analytics: "Analytics",
    search: "Search",
    automation: "Automation",
    deployment: "Deployment",
    scalability: "Scalability",
    data_visualization: "Data Visualization",
    recommendation_system: "Recommendation Systems",
  };

  if (!value?.length) return "Project";
  return value.map((item) => labels[item] ?? item).join(" + ");
}

function formatGeneratorDuration(value: number) {
  return `${value} ${value === 1 ? "day" : "days"}`;
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (

    <div className="surface rounded-2xl border p-5 shadow-sm">

      <div className="flex items-center justify-between">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
          {icon}
        </div>

        <span className="text-2xl font-semibold text-slate-900 dark:text-white">
          {value}
        </span>

      </div>

      <p className="mt-4 text-sm text-slate-500">
        {label}
      </p>

    </div>

  );
}
