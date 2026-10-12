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
  LayoutList,
  LayoutGrid,
  X,
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
import { publishAdminSync, subscribeAdminSync } from "@/lib/adminDataSync";

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
  junior: "bg-emerald-50 text-[#16A34A] border border-emerald-200",
  mid: "bg-amber-50 text-[#D97706] border border-amber-200",
  senior: "bg-red-50 text-[#DC2626] border border-red-200",
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

  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

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

  useEffect(() => {
    return subscribeAdminSync("admin:project:updated", () => {
      void loadProjects();
    });
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
        (student.name || "").toLowerCase().includes(value) ||
        (student.email || "").toLowerCase().includes(value) ||
        (student.role || "").toLowerCase().includes(value) ||
        (Array.isArray(student.skills) &&
          student.skills.some((skill) =>
            String(skill).toLowerCase().includes(value)
          ))
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

      publishAdminSync("admin:project:updated", savedProject);
      if (studentId) {
        publishAdminSync("admin:candidate:updated");
      }
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111F33]">
            Projects
          </h1>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Manage project bank, technical assignments, and AI-tailored briefs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAIGenerationChoice(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#111F33] shadow-xs transition hover:bg-[#F5F7FA]"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#1976D2]" />
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
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#1976D2] px-3.5 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-[#1565C0]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Project
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<FolderKanban size={18} />}
          label="Total Projects"
          value={projects.length}
        />

        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="Active Projects"
          value={activeProjects}
        />

        <StatCard
          icon={<Users size={18} />}
          label="Total Assignments"
          value={totalAssigned}
        />
      </div>

      {/* Filters & View Switch Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-[#E2E8F0] bg-white p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects, roles, tech…"
              className="h-8.5 w-full rounded-md border border-[#E2E8F0] bg-white pl-8 pr-3 text-xs text-[#111F33] placeholder:text-[#64748B] outline-none transition focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]"
            />
          </div>

          {/* Difficulty filter */}
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as "all" | Difficulty)}
            className="h-8.5 rounded-md border border-[#E2E8F0] bg-white px-3 text-xs text-[#111F33] outline-none focus:border-[#1976D2]"
          >
            <option value="all">All Difficulties</option>
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
          </select>

          {/* Status filter */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "all" | ProjectStatus)}
            className="h-8.5 rounded-md border border-[#E2E8F0] bg-white px-3 text-xs text-[#111F33] outline-none focus:border-[#1976D2]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 rounded-md border border-[#E2E8F0] p-0.5 bg-[#F5F7FA]">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors ${
              viewMode === "table"
                ? "bg-white text-[#111F33] shadow-xs"
                : "text-[#64748B] hover:text-[#111F33]"
            }`}
            aria-label="Table view"
          >
            <LayoutList className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Table</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors ${
              viewMode === "grid"
                ? "bg-white text-[#111F33] shadow-xs"
                : "text-[#64748B] hover:text-[#111F33]"
            }`}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Grid</span>
          </button>
        </div>
      </div>

      {/* Content: Table or Grid */}
      {filteredProjects.length === 0 ? (
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-12 text-center shadow-xs">
          <FolderKanban className="mx-auto text-[#64748B]" size={36} />
          <h3 className="mt-3 text-sm font-semibold text-[#111F33]">
            No projects found
          </h3>
          <p className="mt-1 text-xs text-[#64748B]">
            {search || difficulty !== "all" || status !== "all"
              ? "Try adjusting your search criteria or active filters."
              : "Create a project or generate one with AI to get started."}
          </p>
          {(search || difficulty !== "all" || status !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDifficulty("all");
                setStatus("all");
              }}
              className="mt-3 text-xs font-medium text-[#1976D2] hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : viewMode === "table" ? (
        /* TABLE VIEW */
        <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F5F7FA]/70 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                <th className="px-5 py-3">Project Title & Description</th>
                <th className="px-4 py-3">Track / Role</th>
                <th className="px-4 py-3">Difficulty</th>
                <th className="px-4 py-3">Tech Stack</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filteredProjects.map((project) => (
                <tr
                  key={project.id}
                  onClick={() => handleOpenProject(project.id)}
                  className="hover:bg-[#F5F7FA]/75 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3.5 max-w-sm">
                    <div className="font-semibold text-[#111F33] hover:text-[#1976D2] transition-colors">
                      {project.title}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-[#64748B]">
                      {project.description || "No description provided."}
                    </p>
                  </td>

                  <td className="px-4 py-3.5 font-medium text-[#111F33]">
                    {project.role}
                  </td>

                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${difficultyStyles[project.difficulty]}`}
                    >
                      {formatDifficulty(project.difficulty)}
                    </span>
                  </td>

                  <td className="px-4 py-3.5 max-w-xs">
                    <div className="flex flex-wrap gap-1">
                      {project.technologies?.slice(0, 3).map((tech) => (
                        <span
                          key={tech}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-[#64748B] border border-[#E2E8F0]"
                        >
                          {tech}
                        </span>
                      ))}
                      {project.technologies?.length > 3 && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-[#64748B]">
                          +{project.technologies.length - 3}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3.5 text-[#111F33]">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-[#111F33] border border-[#E2E8F0]">
                      <Users size={12} className="text-[#64748B]" />
                      {project.assigned}
                    </span>
                  </td>

                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${
                        project.status === "active"
                          ? "bg-emerald-50 text-[#16A34A] border border-emerald-200"
                          : "bg-slate-100 text-[#64748B] border border-[#E2E8F0]"
                      }`}
                    >
                      {formatStatus(project.status)}
                    </span>
                  </td>

                  <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenProject(project.id)}
                        className="rounded-md border border-[#E2E8F0] p-1.5 text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#111F33] transition-colors"
                        title="View Project"
                        aria-label="View Project"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditProject(project)}
                        className="rounded-md border border-[#E2E8F0] p-1.5 text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#111F33] transition-colors"
                        title="Edit Project"
                        aria-label="Edit Project"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAssignProject(project)}
                        disabled={project.status === "archived"}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-[#1976D2] border border-blue-200 hover:bg-blue-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        title="Assign to Candidate"
                        aria-label="Assign to Candidate"
                      >
                        <UserPlus size={12} />
                        Assign
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => handleOpenProject(project.id)}
              className="flex flex-col rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-xs transition hover:border-blue-300 hover:shadow-sm cursor-pointer"
            >
              {/* Card top */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-[#1976D2] border border-blue-200">
                    <FolderKanban size={16} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-[#111F33]">
                      {project.title}
                    </h3>
                    <p className="text-[11px] font-medium text-[#1976D2]">
                      {project.role}
                    </p>
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium ${difficultyStyles[project.difficulty]}`}
                >
                  {formatDifficulty(project.difficulty)}
                </span>
              </div>

              {/* Description */}
              <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[#64748B]">
                {project.description || "No description available."}
              </p>

              {/* Technologies */}
              {project.technologies?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {project.technologies.slice(0, 4).map((tech) => (
                    <span
                      key={tech}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-[#64748B] border border-[#E2E8F0]"
                    >
                      {tech}
                    </span>
                  ))}
                  {project.technologies.length > 4 && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-[#64748B]">
                      +{project.technologies.length - 4}
                    </span>
                  )}
                </div>
              )}

              {/* Footer */}
              <div
                className="mt-4 flex items-center justify-between border-t border-[#E2E8F0] pt-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                  <Users size={13} />
                  <span>{project.assigned} assigned</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleEditProject(project)}
                    className="rounded-md border border-[#E2E8F0] px-2 py-1 text-[11px] font-medium text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#111F33]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAssignProject(project)}
                    disabled={project.status === "archived"}
                    className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-[#1976D2] border border-blue-200 hover:bg-blue-100 disabled:opacity-40"
                  >
                    Assign
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===================================================
          CREATE PROJECT MODAL
      =================================================== */}

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#111F33]/60 p-3 sm:p-6 backdrop-blur-xs"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !actionLoading
            ) {
              handleCloseCreateModal();
            }
          }}
        >
          <div className="w-full max-w-2xl max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-xl">
            {/* HEADER */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-[#111F33]">
                  {generatedProject ? "Save AI Project" : "Create Project"}
                </h2>
                <p className="mt-0.5 text-xs text-[#64748B]">
                  {generatedProject
                    ? "Review the generated project, make changes, then save it to the project bank."
                    : "Add a new project to the project bank."}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseCreateModal}
                disabled={actionLoading}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#64748B] transition hover:bg-[#F5F7FA] hover:text-[#111F33] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="sr-only">Close</span>
                <X className="h-4 w-4" />
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
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#111F33]/60 p-4 backdrop-blur-xs"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !aiLoading
            ) {
              setShowAIGenerationChoice(false);
            }
          }}
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-xl">
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-[#1976D2] border border-blue-200">
                  <Sparkles size={18} />
                </div>

                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[#111F33]">
                    Generate Project with AI
                  </h2>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Choose how you want AI to generate the technical brief.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAIGenerationChoice(false)}
                disabled={aiLoading}
                aria-label="Close"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#64748B] transition hover:bg-[#F5F7FA] hover:text-[#111F33] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* OPTIONS */}
            <div className="grid gap-3.5 p-5 sm:grid-cols-2">
              {/* STUDENT PROJECT */}
              <div className="flex flex-col justify-between rounded-lg border border-[#E2E8F0] bg-white p-4 transition-all hover:border-blue-300 hover:shadow-xs">
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-[#1976D2] border border-blue-200">
                      <UserRound size={18} />
                    </div>

                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#1976D2] border border-blue-200">
                      Personalized
                    </span>
                  </div>

                  <div className="mt-3">
                    <h3 className="text-sm font-semibold text-[#111F33]">
                      For a Specific Student
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
                      Create a project tailored to a candidate&apos;s verified skills, education, and target role.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAiGenerationMode("student");
                    setStudentSearch("");
                    setShowAIGenerationChoice(false);
                    setShowStudentSelector(true);
                  }}
                  className="mt-4 flex h-9 w-full items-center justify-center rounded-md bg-[#1976D2] px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-[#1565C0]"
                >
                  Select Student →
                </button>
              </div>

              {/* GENERAL PROJECT */}
              <div className="flex flex-col justify-between rounded-lg border border-[#E2E8F0] bg-white p-4 transition-all hover:border-slate-300 hover:shadow-xs">
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-[#64748B] border border-[#E2E8F0]">
                      <GraduationCap size={18} />
                    </div>

                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-[#64748B] border border-[#E2E8F0]">
                      Reusable
                    </span>
                  </div>

                  <div className="mt-3">
                    <h3 className="text-sm font-semibold text-[#111F33]">
                      General Project
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
                      Create a reusable project template for a track without linking to a specific candidate.
                    </p>
                  </div>
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
                  className="mt-4 flex h-9 w-full items-center justify-center rounded-md border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#111F33] transition hover:bg-[#F5F7FA]"
                >
                  Create General Project →
                </button>
              </div>
            </div>

            {/* FOOTER */}
            <div className="flex justify-end border-t border-[#E2E8F0] bg-[#F5F7FA]/60 px-5 py-3">
              <button
                type="button"
                onClick={() => setShowAIGenerationChoice(false)}
                disabled={aiLoading}
                className="h-8.5 rounded-md border border-[#E2E8F0] bg-white px-4 text-xs font-medium text-[#64748B] transition hover:bg-[#F5F7FA] hover:text-[#111F33] disabled:cursor-not-allowed disabled:opacity-50"
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
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#111F33]/60 p-3 backdrop-blur-xs sm:p-5"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !studentsLoading
            ) {
              setShowStudentSelector(false);
            }
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-xl">
            {/* HEADER */}
            <div className="shrink-0 border-b border-[#E2E8F0] bg-white px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-[#1976D2] border border-blue-200">
                    <UserRound size={18} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold tracking-tight text-[#111F33]">
                        Select Student
                      </h2>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-[#16A34A] border border-emerald-200">
                        Approved only
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      Choose an approved candidate to personalize the AI-generated project.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowStudentSelector(false)}
                  disabled={studentsLoading}
                  aria-label="Close"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#64748B] transition hover:bg-[#F5F7FA] hover:text-[#111F33] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* SEARCH */}
              <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"
                  />
                  <input
                    value={studentSearch}
                    onChange={(event) =>
                      setStudentSearch(event.target.value)
                    }
                    placeholder="Search by name, email, role or skill…"
                    className="h-9 w-full rounded-md border border-[#E2E8F0] bg-white pl-9 pr-3 text-xs text-[#111F33] outline-none transition placeholder:text-[#64748B] focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]"
                  />
                </div>

                <div className="flex h-9 shrink-0 items-center rounded-md border border-[#E2E8F0] bg-[#F5F7FA] px-3 text-xs text-[#64748B]">
                  <Users size={14} className="mr-1.5" />
                  <span>
                    {studentsLoading
                      ? "Loading…"
                      : `${filteredStudents.length} candidate${filteredStudents.length === 1 ? "" : "s"}`}
                  </span>
                </div>
              </div>
            </div>

            {/* STUDENT LIST */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#F5F7FA]/50 p-4 sm:p-5">
              {studentsLoading ? (
                <div className="flex min-h-[220px] items-center justify-center">
                  <div className="flex flex-col items-center text-center">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#1976D2] border-t-transparent" />
                    <p className="mt-2 text-xs font-medium text-[#64748B]">
                      Loading approved candidates…
                    </p>
                  </div>
                </div>
              ) : filteredStudents.length > 0 ? (
                <div className="grid gap-2.5">
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
                      className="group w-full rounded-lg border border-[#E2E8F0] bg-white p-3.5 text-left shadow-xs transition-all hover:border-blue-300 hover:shadow-sm focus:outline-none focus:ring-1 focus:ring-[#1976D2]"
                    >
                      <div className="flex items-start gap-3">
                        {/* AVATAR */}
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-blue-50 text-xs font-bold text-[#1976D2] border border-blue-200">
                          {student.avatarUrl ? (
                            <Image
                              src={student.avatarUrl}
                              alt=""
                              width={40}
                              height={40}
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
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold text-[#111F33]">
                                {student.name}
                              </h3>

                              <p className="truncate text-xs text-[#64748B]">
                                {student.role || "Role not specified"}
                                {student.batch ? ` · ${student.batch}` : ""}
                              </p>
                            </div>

                            <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#1976D2] border border-blue-200">
                              <CheckCircle2 size={12} />
                              JD Match {student.jdMatchScore ?? 0}%
                            </span>
                          </div>

                          <div className="mt-2.5 grid gap-2 text-xs sm:grid-cols-2">
                            <div className="min-w-0 rounded bg-[#F5F7FA] px-2.5 py-1.5 border border-[#E2E8F0]">
                              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                                Education
                              </span>
                              <span className="block truncate text-xs font-medium text-[#111F33]">
                                {student.education?.degree || "Not specified"}
                              </span>
                            </div>

                            <div className="min-w-0 rounded bg-[#F5F7FA] px-2.5 py-1.5 border border-[#E2E8F0]">
                              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                                College
                              </span>
                              <span className="block truncate text-xs font-medium text-[#111F33]">
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
                          <span className="flex h-8 items-center gap-1 rounded-md bg-[#1976D2] px-3 text-xs font-semibold text-white transition group-hover:bg-[#1565C0]">
                            Select
                            <span aria-hidden="true">→</span>
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex sm:hidden">
                        <span className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-[#1976D2] text-xs font-semibold text-white shadow-xs transition group-hover:bg-[#1565C0]">
                          Select Student
                          <span aria-hidden="true">→</span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-[#E2E8F0] bg-white px-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#F5F7FA] text-[#64748B]">
                    <Search size={20} />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-[#111F33]">
                    No students found
                  </h3>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-[#64748B]">
                    {studentSearch
                      ? "Try a different name, email, role, or skill."
                      : "There are no approved students available for project generation."}
                  </p>
                  {studentSearch && (
                    <button
                      type="button"
                      onClick={() => setStudentSearch("")}
                      className="mt-3 h-8 rounded-md border border-[#E2E8F0] bg-white px-3.5 text-xs font-medium text-[#111F33] transition hover:bg-[#F5F7FA]"
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="shrink-0 border-t border-[#E2E8F0] bg-[#F5F7FA]/60 px-5 py-3">
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
                    className="inline-flex h-8.5 w-full items-center justify-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-3.5 text-xs font-medium text-[#64748B] transition hover:bg-[#F5F7FA] hover:text-[#111F33] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowStudentSelector(false)}
                    disabled={studentsLoading}
                    className="h-8.5 w-full rounded-md border border-[#E2E8F0] bg-white px-4 text-xs font-medium text-[#64748B] transition hover:bg-[#F5F7FA] hover:text-[#111F33] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    Cancel
                  </button>
                </div>

                <p className="hidden text-xs text-[#64748B] sm:block">
                  Select an approved student to customize project requirements.
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

    </div>
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
    <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#64748B]">{label}</span>
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-[#1976D2] border border-blue-200">
          {icon}
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-[#111F33]">
        {value}
      </div>
    </div>
  );
}
