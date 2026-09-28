"use client";

import {
  useEffect,
  useState,
  useCallback,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import { Candidate } from "@/types";

import {
  candidateService,
} from "@/services/candidate.api";

import {
  projectService,
  type Project,
  type ProjectDifficulty,
  type ProjectStatus,
} from "@/services/project.api";

import ProjectForm, {
  type ProjectFormData,
} from "@/components/projects/ProjectForm";

import ProjectAIGeneratorModal, {
  type ProjectAIGeneratorData,
} from "@/components/projects/ProjectAIGeneratorModal";

import ProjectAIPreview, {
  type GeneratedProject,
} from "@/components/projects/ProjectAIPreview";

import {
  useToast,
} from "@/components/ui/Toast";

import {
  Card,
  CardContent,
} from "@/components/ui/Card";

import {
  Skeleton,
} from "@/components/ui/Skeleton";

import {
  ErrorState,
} from "@/components/ui/ErrorState";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/Tabs";

import {
  CandidateHeader,
} from "@/components/candidates/CandidateHeader";

import {
  CandidateOverview,
} from "@/components/candidates/CandidateOverview";

import {
  CandidateResumeTab,
} from "@/components/candidates/CandidateResumeTab";

import {
  CandidateEducationTab,
} from "@/components/candidates/CandidateEducationTab";

import {
  CandidateSkillsTab,
} from "@/components/candidates/CandidateSkillsTab";

import {
  CandidateInterviewTab,
} from "@/components/candidates/CandidateInterviewTab";

import {
  CandidateProjectTab,
} from "@/components/candidates/CandidateProjectTab";

import {
  CandidateTimeline,
} from "@/components/candidates/CandidateTimeline";

import {
  ApproveCandidateModal,
} from "@/components/candidates/ApproveCandidateModal";

import {
  RejectCandidateModal,
} from "@/components/candidates/RejectCandidateModal";

import {
  ArrowLeft,
  CheckCircle2,
  FolderPlus,
  Loader2,
  UserPlus,
  X,
} from "lucide-react";


// =====================================================
// PAGE
// =====================================================

export default function CandidateDetailPage() {

  const params =
    useParams<{
      candidateId: string;
    }>();

  const router =
    useRouter();

  const { toast } =
    useToast();


  // ===================================================
  // STATE
  // ===================================================

  const [
    candidate,
    setCandidate,
  ] =
    useState<Candidate | null>(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    error,
    setError,
  ] =
    useState(false);


  // ---------------------------------------------------
  // APPROVAL
  // ---------------------------------------------------

  const [
    approveOpen,
    setApproveOpen,
  ] =
    useState(false);


  const [
    actionLoading,
    setActionLoading,
  ] =
    useState(false);


  // ---------------------------------------------------
  // REJECTION
  // ---------------------------------------------------

  const [
    rejectOpen,
    setRejectOpen,
  ] =
    useState(false);


  // ---------------------------------------------------
  // CREATE PROJECT
  // ---------------------------------------------------

  const [
    createProjectOpen,
    setCreateProjectOpen,
  ] = useState(false);

  const [
    createProjectLoading,
    setCreateProjectLoading,
  ] = useState(false);

  const [
    createProjectError,
    setCreateProjectError,
  ] = useState("");

  // ---------------------------------------------------
  // AI PROJECT GENERATOR
  // ---------------------------------------------------

  const [
    showAIGenerator,
    setShowAIGenerator,
  ] = useState(false);

  const [
    showAIPreview,
    setShowAIPreview,
  ] = useState(false);

  const [
    generatedProject,
    setGeneratedProject,
  ] = useState<GeneratedProject | null>(null);

  const [
    aiLoading,
    setAiLoading,
  ] = useState(false);

  // ---------------------------------------------------
  // ASSIGN EXISTING PROJECT
  // ---------------------------------------------------

  const [
    assignProjectOpen,
    setAssignProjectOpen,
  ] =
    useState(false);


  const [
    projects,
    setProjects,
  ] =
    useState<Project[]>(
      []
    );


  const [
    projectsLoading,
    setProjectsLoading,
  ] =
    useState(false);


  const [
    selectedProjectId,
    setSelectedProjectId,
  ] =
    useState("");


  const [
    assignProjectLoading,
    setAssignProjectLoading,
  ] =
    useState(false);


  const [
    assignProjectError,
    setAssignProjectError,
  ] =
    useState("");


  // ===================================================
  // LOAD CANDIDATE
  // ===================================================

  const load =
    useCallback(
      async () => {

        setLoading(true);

        setError(false);


        try {

          const data =
            await candidateService.getCandidate(
              params.candidateId
            );


          if (!data) {

            setError(true);

          } else {

            setCandidate(data);

          }

        } catch (error) {

          console.error(
            "Failed to load candidate:",
            error
          );

          setError(true);

        } finally {

          setLoading(false);

        }

      },
      [
        params.candidateId,
      ]
    );


  // ===================================================
  // INITIAL LOAD
  // ===================================================

  useEffect(() => {

    load();

  }, [load]);


  // ===================================================
  // APPROVE WITHOUT PROJECT
  // ===================================================

  const handleApproveWithoutProject =
    async () => {

      if (!candidate) {
        return;
      }


      setActionLoading(true);


      try {

        const updated =
          await candidateService.approveCandidate(
            candidate.id
          );


        if (updated) {

          setCandidate(
            updated
          );

          setApproveOpen(
            false
          );


          toast({
            type: "success",

            title:
              "Candidate approved",

            description:
              `${updated.name} has been approved without a project. A project can be assigned later.`,
          });

        }

      } catch (error) {

        console.error(
          "Approve candidate failed:",
          error
        );


        toast({
          type: "error",

          title:
            "Approval failed",

          description:
            "Could not approve the candidate.",
        });

      } finally {

        setActionLoading(
          false
        );

      }
    };


  // ===================================================
  // OPEN CREATE PROJECT
  // ===================================================

  const handleCreateProject = () => {

    if (!candidate) {
      return;
    }

    setApproveOpen(false);
    setCreateProjectError("");
    setGeneratedProject(null);
    setCreateProjectOpen(true);
  };


  // ===================================================
  // CREATE PROJECT + ASSIGN + APPROVE
  // ===================================================

  const handleCreateAndAssignProject = async (
    data: ProjectFormData
  ) => {

    if (!candidate) {
      return;
    }

    setCreateProjectError("");
    setCreateProjectLoading(true);

    try {

      const draft = generatedProject;

      const project = await projectService.createProject({
        title: data.title,
        role: data.role,
        difficulty: data.difficulty,
        description: data.description,
        technologies: data.technologies,
        briefUrl: data.briefUrl || draft?.briefUrl || "",
        status: data.status ?? "active",
        pdfUrl: data.pdfUrl || draft?.pdfUrl || undefined,
        detailedPdfUrl:
          data.detailedPdfUrl ||
          draft?.detailedPdfUrl ||
          undefined,
        projectType:
          data.projectType ||
          draft?.projectType ||
          undefined,
        duration:
          data.duration ||
          (draft?.duration != null
            ? String(draft.duration)
            : undefined),
        focus:
          data.focus ||
          (draft?.focus != null
            ? Array.isArray(draft.focus)
              ? draft.focus.join(", ")
              : String(draft.focus)
            : undefined),
        requirements:
          Array.isArray(data.requirements)
            ? data.requirements
            : Array.isArray(draft?.requirements)
              ? draft.requirements
              : [],
        studentId: candidate.id,
        studentName: candidate.name,
      });

      if (!project?.id) {
        throw new Error(
          "Project was created but no project ID was returned."
        );
      }

      // APPROVE FIRST. The approval activity is written before project assignment.
      const updated =
        await candidateService.approveCandidate(
          candidate.id
        );

      if (updated) {
        setCandidate(updated);
      }

      // ASSIGN ONLY AFTER APPROVAL SUCCEEDS.
      await projectService.assignProjectToCandidate(
        project.id,
        candidate.id
      );

      setCreateProjectOpen(false);
      setShowAIPreview(false);
      setShowAIGenerator(false);
      setGeneratedProject(null);

      toast({
        type: "success",
        title: "Candidate approved",
        description:
          `${candidate.name} was approved and assigned to "${project.title}".`,
      });

      await load();

    } catch (error) {

      console.error(
        "Create project and approve failed:",
        error
      );

      setCreateProjectError(
        error instanceof Error
          ? error.message
          : "Failed to create project and approve candidate."
      );

    } finally {

      setCreateProjectLoading(false);
    }
  };


  // ===================================================
  // AI PROJECT GENERATION
  // ===================================================

  const handleGenerateAI = async (
    data: ProjectAIGeneratorData
  ) => {

    try {

      setAiLoading(true);

      setCreateProjectError("");

      // The generator modal uses UI-friendly values:
      // duration is a number, focus is an array, and requirements is a
      // free-form string. Convert them to the backend service contract here.
      const generated =
        await projectService.generateProject({
          ...data,
          duration: String(data.duration),
          focus: data.focus.join(", "),
          requirements: data.requirements
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          studentEducation: data.studentEducation
            ? {
                degree: data.studentEducation.degree,
                college: data.studentEducation.college,
                year: data.studentEducation.year,
              }
            : undefined,
        });

      setGeneratedProject(
        generated as unknown as GeneratedProject
      );

      setShowAIGenerator(false);
      setShowAIPreview(true);

    } catch (error) {

      console.error(
        "AI project generation failed:",
        error
      );

      setCreateProjectError(
        error instanceof Error
          ? error.message
          : "Failed to generate project with AI."
      );

    } finally {

      setAiLoading(false);
    }
  };


  const handleUseGeneratedProject = async (
    projectFromPreview?: GeneratedProject
  ) => {
    if (!candidate) {
      return;
    }

    setActionLoading(true);
    setCreateProjectError("");

    try {
      /*
       * ProjectAIPreview may call onUseProject() without passing
       * the project object. Therefore always use generatedProject
       * from this page as the fallback/source of truth.
       */
      const project =
        projectFromPreview ?? generatedProject;

      if (!project) {
        throw new Error(
          "No generated project is available to save. Generate the project again."
        );
      }

      /*
       * Some generated responses can use `name` instead of `title`.
       * Keep the preview object as the source, but normalize all
       * required fields before saving.
       */
      const projectData =
        project as GeneratedProject & {
          name?: string;
          studentId?: string;
          studentName?: string;
          generationContext?: {
            projectType?: string;
            duration?: number | string;
            focus?: string[];
            requirements?: string;
            studentId?: string;
          };
        };

      const generationContext =
        projectData.generationContext;

      const title =
        typeof projectData.title === "string" &&
        projectData.title.trim()
          ? projectData.title.trim()
          : typeof projectData.name === "string" &&
              projectData.name.trim()
            ? projectData.name.trim()
            : "";

      const role =
        typeof projectData.role === "string"
          ? projectData.role.trim()
          : "";

      /*
       * AI normally returns description.
       * If it is missing, use generated requirements as
       * the project description instead of failing.
       */
      const description =
        typeof projectData.description === "string" &&
        projectData.description.trim()
          ? projectData.description.trim()
          : Array.isArray(projectData.requirements)
            ? projectData.requirements
                .map((item) => String(item).trim())
                .filter(Boolean)
                .join("\n")
            : typeof projectData.requirements === "string"
              ? projectData.requirements.trim()
              : "";

      if (!title) {
        console.error(
          "Generated project data before save:",
          projectData
        );

        throw new Error(
          "Generated project title is missing. Please regenerate the project."
        );
      }

      if (!role) {
        throw new Error(
          "Generated project role is missing. Please regenerate the project."
        );
      }

      if (!description) {
        throw new Error(
          "Generated project description is missing. Please regenerate the project."
        );
      }

      const technologies =
        Array.isArray(projectData.technologies)
          ? projectData.technologies
              .map((item) => String(item).trim())
              .filter(Boolean)
          : [];

      const requirements =
        Array.isArray(projectData.requirements)
          ? projectData.requirements
              .map((item) => String(item).trim())
              .filter(Boolean)
          : typeof projectData.requirements === "string"
            ? projectData.requirements
                .split("\n")
                .map((item) => item.trim())
                .filter(Boolean)
            : [];

      const duration =
        projectData.duration != null
          ? String(projectData.duration).trim()
          : generationContext?.duration != null
            ? String(generationContext.duration).trim()
            : undefined;

      const difficulty: ProjectDifficulty =
        projectData.difficulty === "mid" ||
        projectData.difficulty === "senior"
          ? projectData.difficulty
          : "junior";

      const status: ProjectStatus =
        projectData.status === "archived"
          ? "archived"
          : "active";

      const focus =
        Array.isArray(projectData.focus)
          ? projectData.focus
              .map((item) => String(item).trim())
              .filter(Boolean)
              .join(", ")
          : typeof projectData.focus === "string"
            ? projectData.focus.trim()
            : Array.isArray(generationContext?.focus)
              ? generationContext.focus
                  .map((item) => String(item).trim())
                  .filter(Boolean)
                  .join(", ")
              : undefined;

      console.log(
        "CONFIRM & SAVE - project data:",
        {
          title,
          role,
          difficulty: projectData.difficulty,
          duration,
          focus,
          studentId:
            projectData.studentId ||
            generationContext?.studentId ||
            candidate.id,
        }
      );

      /*
       * ===================================================
       * 1. CREATE PROJECT IN MONGODB
       * ===================================================
       */
      const savedProject =
        await projectService.createProject({
          title,
          role,
          difficulty,
          description,
          technologies,
          briefUrl:
            projectData.briefUrl || "",
          status,
          pdfUrl:
            projectData.pdfUrl || undefined,
          detailedPdfUrl:
            projectData.detailedPdfUrl ||
            projectData.pdfUrl ||
            undefined,
          projectType:
            projectData.projectType ||
            generationContext?.projectType ||
            undefined,
          duration,
          focus,
          requirements,
          studentId:
            projectData.studentId ||
            generationContext?.studentId ||
            candidate.id,
          studentName:
            projectData.studentName ||
            candidate.name,
        });

      console.log(
        "CONFIRM & SAVE - project created:",
        savedProject
      );

      if (!savedProject?.id) {
        throw new Error(
          "Project was created but the backend did not return the project ID."
        );
      }

      /*
       * ===================================================
       * 2. APPROVE THE CANDIDATE FIRST
       * ===================================================
       */
      console.log(
        "CONFIRM & SAVE - approving candidate FIRST:",
        candidate.id
      );

      const updatedCandidate =
        await candidateService.approveCandidate(
          candidate.id
        );

      console.log(
        "CONFIRM & SAVE - candidate approved:",
        updatedCandidate
      );

      if (updatedCandidate) {
        setCandidate(updatedCandidate);
      }

      /*
       * ===================================================
       * 3. ASSIGN THE NEW PROJECT AFTER APPROVAL
       * ===================================================
       */
      console.log(
        "CONFIRM & SAVE - assigning project AFTER approval:",
        {
          projectId: savedProject.id,
          candidateId: candidate.id,
        }
      );

      const assignment =
        await projectService.assignProjectToCandidate(
          savedProject.id,
          candidate.id
        );

      console.log(
        "CONFIRM & SAVE - project assigned:",
        assignment
      );

      /*
       * ===================================================
       * 4. CLOSE MODALS
       * ===================================================
       */
      setShowAIPreview(false);
      setShowAIGenerator(false);
      setCreateProjectOpen(false);
      setGeneratedProject(null);
      setCreateProjectError("");

      /*
       * ===================================================
       * 5. RELOAD CANDIDATE FROM BACKEND
       * ===================================================
       */
      await load();

      /*
       * ===================================================
       * 6. SUCCESS
       * ===================================================
       */
      toast({
        type: "success",
        title: "Candidate approved",
        description:
          `${candidate.name} was approved and assigned to "${savedProject.title}".`,
      });

    } catch (error) {
      console.error(
        "Confirm & Save project failed:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Failed to save project, assign it, and approve the candidate.";

      setCreateProjectError(message);

      toast({
        type: "error",
        title: "Save failed",
        description: message,
      });

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
    setCreateProjectOpen(true);
  };


  // ===================================================
  // OPEN EXISTING PROJECT ASSIGNMENT
  // ===================================================

  const handleAssignExistingProject =
    async () => {

      if (!candidate) {
        return;
      }


      setApproveOpen(
        false
      );


      setAssignProjectError(
        ""
      );


      setSelectedProjectId(
        candidate.assignedProject?.id ??
          ""
      );


      setAssignProjectOpen(
        true
      );


      setProjectsLoading(
        true
      );


      try {

        const data =
          await projectService.getProjects();


        setProjects(
          data.filter(
            (project) =>
              project.status ===
              "active"
          )
        );

      } catch (error) {

        console.error(
          "Failed to load projects:",
          error
        );


        setAssignProjectError(
          error instanceof Error
            ? error.message
            : "Failed to load projects."
        );

      } finally {

        setProjectsLoading(
          false
        );

      }
    };


  // ===================================================
  // ASSIGN EXISTING PROJECT + APPROVE
  // ===================================================

  const handleAssignAndApprove =
    async () => {

      if (!candidate) {
        return;
      }


      if (!selectedProjectId) {

        setAssignProjectError(
          "Please select a project."
        );

        return;
      }


      setAssignProjectError(
        ""
      );


      setAssignProjectLoading(
        true
      );


      try {

        // ------------------------------------------------
        // APPROVE CANDIDATE FIRST
        // ------------------------------------------------

        const updated =
          await candidateService.approveCandidate(
            candidate.id
          );

        if (updated) {
          setCandidate(updated);
        }

        // ------------------------------------------------
        // ASSIGN PROJECT AFTER APPROVAL
        // ------------------------------------------------

        const result =
          await projectService.assignProjectToCandidate(
            selectedProjectId,
            candidate.id
          );

        // ------------------------------------------------
        // CLOSE
        // ------------------------------------------------

        setAssignProjectOpen(
          false
        );


        toast({
          type: "success",

          title:
            "Candidate approved",

          description:
            `${candidate.name} was assigned to "${result.project.title}" and approved.`,
        });


        await load();

      } catch (error) {

        console.error(
          "Assign project and approve failed:",
          error
        );


        setAssignProjectError(
          error instanceof Error
            ? error.message
            : "Failed to assign project and approve candidate."
        );

      } finally {

        setAssignProjectLoading(
          false
        );

      }
    };


  // ===================================================
  // REJECT CANDIDATE
  // ===================================================

  const handleReject =
    async (
      reason: string
    ) => {

      if (!candidate) {
        return;
      }


      setActionLoading(
        true
      );


      try {

        const updated =
          await candidateService.rejectCandidate(
            candidate.id,
            reason
          );


        if (updated) {

          setCandidate(
            updated
          );

          setRejectOpen(
            false
          );


          toast({
            type: "success",

            title:
              "Candidate rejected",

            description:
              `${updated.name} has been notified.`,
          });

        }

      } catch (error) {

        console.error(
          "Reject candidate failed:",
          error
        );


        toast({
          type: "error",

          title:
            "Rejection failed",

          description:
            "Could not reject the candidate.",
        });

      } finally {

        setActionLoading(
          false
        );

      }
    };


  // ===================================================
  // LOADING STATE
  // ===================================================

  if (loading) {

    return (
      <div className="space-y-5">

        <Card className="p-6">

          <div className="flex items-center gap-4">

            <Skeleton
              className="h-14 w-14 rounded-full"
            />

            <div className="flex-1 space-y-2">

              <Skeleton
                className="h-4 w-40"
              />

              <Skeleton
                className="h-3 w-64"
              />

            </div>

          </div>

        </Card>


        <div className="grid gap-5 lg:grid-cols-3">

          <Skeleton
            className="h-48 lg:col-span-2"
          />

          <Skeleton
            className="h-48"
          />

        </div>

      </div>
    );
  }


  // ===================================================
  // ERROR STATE
  // ===================================================

  if (
    error ||
    !candidate
  ) {

    return (
      <Card>

        <ErrorState
          title="Candidate not found"

          description="This candidate may have been removed, or the link is incorrect."

          onRetry={() =>
            router.push(
              "/admin/candidates"
            )
          }
        />

      </Card>
    );
  }


  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => router.push("/admin/candidates")}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Candidates
      </button>

      <CandidateHeader
        candidate={candidate}
        onApprove={() => setApproveOpen(true)}
        onReject={() => setRejectOpen(true)}
      />

      {candidate.assignedProject && (
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Assigned Project
                </p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {candidate.assignedProject.title}
                </p>
                <p className="mt-1 text-sm capitalize text-slate-500">
                  {candidate.assignedProject.difficulty} difficulty
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/admin/projects/${candidate.assignedProject?.id}`
                  )
                }
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                View Project
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {candidate.rejectionReason && (
        <Card className="border-danger-100 bg-danger-50/50 dark:border-danger-500/20 dark:bg-danger-500/5">
          <CardContent className="text-sm text-danger-700 dark:text-danger-400">
            <span className="font-medium">Rejection reason:</span>{" "}
            {candidate.rejectionReason}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="education">Education</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="interview">Interview</TabsTrigger>
          <TabsTrigger value="project">Project</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <CandidateOverview candidate={candidate} />
        </TabsContent>

        <TabsContent value="resume">
          <CandidateResumeTab candidate={candidate} />
        </TabsContent>

        <TabsContent value="education">
          <CandidateEducationTab candidate={candidate} />
        </TabsContent>

        <TabsContent value="skills">
          <CandidateSkillsTab candidate={candidate} />
        </TabsContent>

        <TabsContent value="interview">
          <CandidateInterviewTab candidate={candidate} />
        </TabsContent>

        <TabsContent value="project">
          <CandidateProjectTab candidate={candidate} />
        </TabsContent>

        <TabsContent value="activity">
          <CandidateTimeline candidate={candidate} />
        </TabsContent>
      </Tabs>

      <ApproveCandidateModal
        open={approveOpen}
        candidateName={candidate.name}
        loading={actionLoading}
        onClose={() => setApproveOpen(false)}
        onApproveWithoutProject={handleApproveWithoutProject}
        onCreateProject={handleCreateProject}
        onAssignExistingProject={handleAssignExistingProject}
      />

      {createProjectOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !createProjectLoading &&
              !aiLoading
            ) {
              setCreateProjectOpen(false);
            }
          }}
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#151922]">
            <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-white/10">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">
                  Create Project
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Add a new project to the project bank.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (createProjectLoading) return;
                  setCreateProjectOpen(false);
                  setGeneratedProject(null);
                  setCreateProjectError("");
                }}
                disabled={createProjectLoading}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <span className="sr-only">Close</span>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-5">
              {createProjectError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                  {createProjectError}
                </div>
              )}

              <ProjectForm
                initialData={
                  generatedProject
                    ? {
                        title: generatedProject.title,
                        role: generatedProject.role,
                        difficulty:
                          generatedProject.difficulty === "mid" ||
                          generatedProject.difficulty === "senior"
                            ? generatedProject.difficulty
                            : "junior",
                        description: generatedProject.description,
                        technologies: generatedProject.technologies,
                        briefUrl: generatedProject.briefUrl ?? undefined,
                        status:
                          generatedProject.status === "archived"
                            ? "archived"
                            : "active",
                        pdfUrl: generatedProject.pdfUrl ?? undefined,
                        detailedPdfUrl:
                          generatedProject.detailedPdfUrl ?? undefined,
                        projectType: generatedProject.projectType,
                        duration:
                          generatedProject.duration != null
                            ? String(generatedProject.duration)
                            : undefined,
                        focus:
                          Array.isArray(generatedProject.focus)
                            ? generatedProject.focus.join(", ")
                            : generatedProject.focus,
                        requirements:
                          Array.isArray(generatedProject.requirements)
                            ? generatedProject.requirements
                            : typeof generatedProject.requirements === "string"
                              ? generatedProject.requirements
                                  .split("\n")
                                  .map((item) => item.trim())
                                  .filter(Boolean)
                              : undefined,
                        studentId: candidate.id,
                        studentName: candidate.name,
                        generatedByAI: true,
                      }
                    : {
                        role: candidate.role || "",
                        status: "active",
                      }
                }
                submitLabel="Create & Assign"
                showStatus={false}
                loading={createProjectLoading}
                onGenerateAI={() => {
                  if (createProjectLoading) return;
                  setCreateProjectOpen(false);
                  setShowAIGenerator(true);
                }}
                onCancel={() => {
                  if (createProjectLoading) return;
                  setCreateProjectOpen(false);
                  setGeneratedProject(null);
                  setCreateProjectError("");
                }}
                onSubmit={handleCreateAndAssignProject}
              />
            </div>
          </div>
        </div>
      )}

      <ProjectAIGeneratorModal
        open={showAIGenerator}
        loading={aiLoading}
        mode="student"
        student={candidate}
        onClose={() => {
          if (!aiLoading) {
            setShowAIGenerator(false);
            setCreateProjectOpen(true);
          }
        }}
        onGenerate={handleGenerateAI}
      />

      <ProjectAIPreview
        open={showAIPreview}
        project={generatedProject}
        loading={aiLoading}
        onClose={() => setShowAIPreview(false)}
        onRegenerate={handleRegenerateProject}
        onEdit={handleEditGeneratedProject}
        onUseProject={handleUseGeneratedProject}
      />

      {assignProjectOpen && (
        <AssignProjectModal
          projects={projects}
          selectedProjectId={selectedProjectId}
          loading={projectsLoading || assignProjectLoading}
          error={assignProjectError}
          onSelect={setSelectedProjectId}
          onClose={() => setAssignProjectOpen(false)}
          onSubmit={handleAssignAndApprove}
        />
      )}

      <RejectCandidateModal
        open={rejectOpen}
        candidateName={candidate.name}
        loading={actionLoading}
        onClose={() => setRejectOpen(false)}
        onConfirm={handleReject}
      />
    </div>
  );
}

// =====================================================
// ASSIGN PROJECT MODAL
// =====================================================

function AssignProjectModal({
  projects,
  selectedProjectId,
  loading,
  error,
  onSelect,
  onClose,
  onSubmit,
}: {
  projects: Project[];
  selectedProjectId: string;
  loading: boolean;
  error: string;

  onSelect: (
    projectId: string
  ) => void;

  onClose: () => void;

  onSubmit: () => void;
}) {

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">

        {/* Header */}

        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">

          <div>

            <h2 className="text-lg font-semibold text-slate-900">
              Assign Existing Project
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Select an active project for this candidate.
            </p>

          </div>


          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              loading
            }
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >

            <X
              className="h-5 w-5"
            />

          </button>

        </div>


        {/* Body */}

        <div className="space-y-4 p-6">

          {error && (

            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>

          )}


          {loading &&
          projects.length === 0 ? (

            <div className="flex items-center justify-center py-10 text-sm text-slate-500">

              <Loader2
                className="mr-2 h-5 w-5 animate-spin"
              />

              Loading projects...

            </div>

          ) : projects.length ===
            0 ? (

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center">

              <p className="text-sm font-medium text-slate-700">
                No active projects available.
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Create a new project instead.
              </p>

            </div>

          ) : (

            <div className="space-y-3">

              {projects.map(
                (project) => (

                  <button
                    key={
                      project.id
                    }
                    type="button"
                    disabled={
                      loading
                    }
                    onClick={() =>
                      onSelect(
                        project.id
                      )
                    }
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      selectedProjectId ===
                      project.id
                        ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                        : "border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                    }`}
                  >

                    <div className="flex items-start justify-between gap-4">

                      <div>

                        <p className="font-semibold text-slate-900">
                          {
                            project.title
                          }
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {
                            project.role
                          }
                        </p>

                      </div>


                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">
                        {
                          project.difficulty
                        }
                      </span>

                    </div>


                    <p className="mt-3 line-clamp-2 text-sm text-slate-500">
                      {
                        project.description
                      }
                    </p>


                    <div className="mt-3 flex items-center justify-between">

                      <span className="text-xs text-slate-400">
                        {
                          project.assigned
                        }{" "}
                        assigned
                      </span>


                      {selectedProjectId ===
                        project.id && (

                        <CheckCircle2
                          className="h-5 w-5 text-slate-900"
                        />

                      )}

                    </div>

                  </button>

                )
              )}

            </div>

          )}

        </div>


        {/* Footer */}

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">

          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              loading
            }
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>


          <button
            type="button"
            onClick={
              onSubmit
            }
            disabled={
              loading ||
              !selectedProjectId
            }
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >

            {loading ? (
              <Loader2
                className="h-4 w-4 animate-spin"
              />
            ) : (
              <UserPlus
                className="h-4 w-4"
              />
            )}

            {loading
              ? "Assigning..."
              : "Assign & Approve"}

          </button>

        </div>

      </div>

    </div>
  );
}


// =====================================================
// FORM FIELD
// =====================================================

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {

  return (
    <div>

      <div className="mb-1.5 flex items-center justify-between">

        <label className="text-sm font-medium text-slate-700">

          {label}

          {required && (
            <span className="ml-1 text-red-500">
              *
            </span>
          )}

        </label>


        {hint && (
          <span className="text-xs text-slate-400">
            {hint}
          </span>
        )}

      </div>


      {children}

    </div>
  );
}