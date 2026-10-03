import { request } from "@/lib/client";

/* =========================================================
   TYPES
========================================================= */

export type ProjectDifficulty =
  | "junior"
  | "mid"
  | "senior";

export type ProjectStatus =
  | "active"
  | "archived";

/* =========================================================
   PROJECT
========================================================= */

export interface Project {
  id: string;
  title: string;
  role: string;
  difficulty: ProjectDifficulty;
  description: string;
  technologies: string[];

  briefUrl: string;

  pdfUrl?: string;
  detailedPdfUrl?: string;

  /*
   * Temporary AI-generated PDF.
   *
   * This exists only during:
   *
   * Generate → Preview → Confirm Save
   *
   * It is NOT stored in MongoDB.
   */
  pdfData?: string;
  pdfFilename?: string;

  projectType?: string;
  duration?: string;
  focus?: string;
  requirements?: string[];

  assigned: number;
  assignedCount: number;

  status: ProjectStatus;

  studentId?: string;
  studentName?: string;

  createdAt?: string;
  updatedAt?: string;
}

/* =========================================================
   CREATE PROJECT
========================================================= */

export interface CreateProjectData {
  title: string;
  role: string;
  difficulty: ProjectDifficulty;
  description: string;
  technologies: string[];

  briefUrl?: string;

  /*
   * Existing/saved PDF URLs.
   */
  pdfUrl?: string;
  detailedPdfUrl?: string;

  /*
   * Temporary AI-generated PDF.
   *
   * Sent to backend only when the admin confirms
   * the project save.
   */
  pdfData?: string;
  pdfFilename?: string;

  projectType?: string;
  duration?: string;
  focus?: string;
  requirements?: string[];

  status?: ProjectStatus;

  studentId?: string;
  studentName?: string;
}

/* =========================================================
   UPDATE PROJECT
========================================================= */

export interface UpdateProjectData {
  title?: string;
  role?: string;
  difficulty?: ProjectDifficulty;
  description?: string;
  technologies?: string[];

  briefUrl?: string;

  pdfUrl?: string;
  detailedPdfUrl?: string;

  // Transient generated PDF data. Uploaded only on confirmed save.
  pdfData?: string;
  pdfFilename?: string;

  projectType?: string;
  duration?: string;
  focus?: string;
  requirements?: string[];

  status?: ProjectStatus;
}

/* =========================================================
   AI PROJECT GENERATION
========================================================= */

export type ProjectType =
  | "backend"
  | "frontend"
  | "fullstack"
  | "mobile"
  | "ai_ml"
  | "data_science"
  | "devops";

export type ProjectFocus =
  | "api_development"
  | "web_application"
  | "mobile_application"
  | "ai_ml"
  | "data_science"
  | "database"
  | "authentication"
  | "system_design"
  | "automation"
  | "cloud"
  | "devops"
  | "testing"
  | "performance"
  | "security"
  | "general";

export interface StudentEducation {
  degree?: string;
  field?: string;
  institution?: string;
  university?: string;
  graduationYear?: string | number;
  percentage?: number | string;
  cgpa?: number | string;

  [key: string]: unknown;
}

export interface GenerateProjectData {
  role: string;

  projectType: ProjectType;

  difficulty: ProjectDifficulty;

  duration: string;

  technologies: string[];

  focus: ProjectFocus | string;

  requirements: string[];

  /*
   * Whether backend should generate
   * the detailed project PDF.
   */
  generateDetailedPdf: boolean;

  /*
   * Currently PDF is the supported format.
   */
  pdfFormat?: "pdf";

  /*
   * Optional student information.
   */
  studentId?: string;
  studentName?: string;

  studentSkills?: string[];

  studentEducation?:
    | StudentEducation
    | StudentEducation[];

  /*
   * Optional extra information.
   */
  description?: string;
}

/* =========================================================
   REGENERATE PROJECT
========================================================= */

export interface RegenerateProjectData
  extends Partial<GenerateProjectData> {
  /*
   * Optional instruction to tell AI
   * what should be changed.
   */
  regenerationPrompt?: string;
}

/* =========================================================
   ASSIGNED CANDIDATE
========================================================= */

export interface AssignedCandidate {
  id: string;
  name: string;
  email: string;
  phone: string;

  role?: string;
  status?: string;

  assignedProjectId?: string;

  assignedProject?: {
    id: string;
    title: string;
    difficulty: ProjectDifficulty;
  };
}

/* =========================================================
   PROJECT DETAILS
========================================================= */

export interface ProjectDetails
  extends Project {
  assignedCandidates?: AssignedCandidate[];
}

/* =========================================================
   RAW BACKEND TYPES
========================================================= */

interface RawProject {
  _id?: string;
  id?: string;

  title?: string;
  role?: string;

  difficulty?:
    | ProjectDifficulty
    | string;

  description?: string;

  technologies?: unknown;

  briefUrl?: string;

  /*
   * =========================================================
   * PDF FIELDS
   * =========================================================
   *
   * pdfUrl / detailedPdfUrl:
   * - Cloudinary URL after the project is saved
   * - temporary data URL during frontend preview
   *
   * pdfData / pdfFilename:
   * - temporary AI-generated PDF data
   * - used only between Generate → Preview → Save
   * - NOT stored directly in MongoDB
   */
  pdfUrl?: string;
  detailedPdfUrl?: string;

  pdfData?: string;
  pdfFilename?: string;

  /*
   * =========================================================
   * PROJECT METADATA
   * =========================================================
   */
  projectType?: string;
  duration?: string;
  focus?: string;

  requirements?: unknown;

  /*
   * =========================================================
   * ASSIGNMENT COUNTS
   * =========================================================
   */
  assigned?: number;
  assignedCount?: number;

  /*
   * Some backend implementations may
   * return the assignment count under
   * other names.
   */
  assignedCandidateCount?: number;
  assignedCandidatesCount?: number;
  candidateCount?: number;
  assignedStudentCount?: number;
  assignedStudentsCount?: number;

  /*
   * =========================================================
   * PROJECT STATUS
   * =========================================================
   */
  status?:
    | ProjectStatus
    | string;

  /*
   * =========================================================
   * STUDENT / CANDIDATE
   * =========================================================
   */
  studentId?: string;
  studentName?: string;

  /*
   * =========================================================
   * ASSIGNED CANDIDATES
   * =========================================================
   *
   * Backend may return candidates in different formats.
   */
  assignedCandidates?: unknown[];

  /*
   * Alternative assignment fields.
   */
  assignedCandidate?: unknown;

  assignedStudents?: unknown[];

  assignedStudent?: unknown;

  candidates?: unknown[];

  students?: unknown[];

  assignees?: unknown[];

  assignedUsers?: unknown[];

  /*
   * =========================================================
   * ASSIGNMENT ID ARRAYS
   * =========================================================
   */
  assignedCandidateIds?: unknown[];

  assignedStudentIds?: unknown[];

  candidateIds?: unknown[];

  studentIds?: unknown[];

  /*
   * =========================================================
   * TIMESTAMPS
   * =========================================================
   */
  createdAt?: string;
  updatedAt?: string;

  /*
   * =========================================================
   * FORWARD COMPATIBILITY
   * =========================================================
   *
   * Allows the backend to return additional fields
   * without breaking this frontend type.
   */
  [key: string]: unknown;
}

interface RawCandidate {
  _id?: string;
  id?: string;

  name?: string;
  email?: string;
  phone?: string;

  role?: string;
  status?: string;

  assignedProjectId?: string;

  assignedProject?: {
    _id?: string;
    id?: string;

    title?: string;

    difficulty?:
      | ProjectDifficulty
      | string;
  };

  [key: string]: unknown;
}

/* =========================================================
   API RESPONSE TYPES
========================================================= */

interface ProjectsResponse {
  success: boolean;

  projects?: RawProject[];

  message?: string;
}

interface ProjectResponse {
  success: boolean;

  project?: RawProject;

  message?: string;
}

/*
 * AI generation response.
 */
interface GenerateProjectResponse {
  success: boolean;

  project?: RawProject;

  message?: string;
}

interface AssignedCandidatesResponse {
  success?: boolean;

  candidates?: RawCandidate[];

  data?: RawCandidate[];

  total?: number;

  message?: string;
}

interface AssignProjectResponse {
  success?: boolean;

  candidate: RawCandidate;

  project: RawProject;

  message?: string;
}

interface UnassignProjectResponse {
  success?: boolean;

  candidate: RawCandidate;

  message?: string;
}

/* =========================================================
   HELPERS
========================================================= */

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

/* =========================================================
   NORMALIZE PROJECT
========================================================= */

function normalizeProject(
  project: RawProject
): Project {
  const rawId =
    project.id ??
    project._id ??
    "";

  /*
   * Backend may return either:
   *
   * assigned
   * assignedCount
   * assignedCandidateCount
   * candidateCount
   *
   * Prefer an explicitly supplied value.
   */
  const possibleAssignedValues: unknown[] = [
    project.assigned,
    project.assignedCount,
    project.assignedCandidateCount,
    project.assignedCandidatesCount,
    project.assignedStudentCount,
    project.assignedStudentsCount,
    project.candidateCount,
  ];

  let safeAssignedNumber = 0;

  for (
    const value of possibleAssignedValues
  ) {
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0
    ) {
      safeAssignedNumber = value;
      break;
    }

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      const parsed =
        Number(value);

      if (
        Number.isFinite(parsed) &&
        parsed >= 0
      ) {
        safeAssignedNumber =
          parsed;
        break;
      }
    }
  }

  const difficulty =
    project.difficulty;

  const status =
    project.status;

  const technologies =
    Array.isArray(
      project.technologies
    )
      ? project.technologies
          .map((technology) =>
            String(technology)
          )
          .filter(Boolean)
      : [];

  const requirements =
    Array.isArray(
      project.requirements
    )
      ? project.requirements
          .map((requirement) =>
            String(requirement)
          )
          .filter(Boolean)
      : [];

  return {
    id: String(rawId),

    title:
      project.title ?? "",

    role:
      project.role ?? "",

    difficulty:
      difficulty === "mid" ||
      difficulty === "senior"
        ? difficulty
        : "junior",

    description:
      project.description ?? "",

    technologies,

    briefUrl:
      project.briefUrl ?? "",

    pdfUrl:
      project.pdfUrl ||
      undefined,

    detailedPdfUrl:
      project.detailedPdfUrl ||
      undefined,

    /*
     * Temporary AI-generated PDF.
     *
     * These fields are preserved so the frontend can carry
     * the in-memory PDF from Generate -> Preview -> Confirm Save.
     * The backend uploads the PDF to Cloudinary only when the
     * confirmed create/save request is made.
     */
    pdfData:
      project.pdfData ||
      undefined,

    pdfFilename:
      project.pdfFilename ||
      undefined,

    projectType:
      project.projectType ||
      undefined,

    duration:
      project.duration ||
      undefined,

    focus:
      project.focus ||
      undefined,

    requirements,

    assigned:
      safeAssignedNumber,

    assignedCount:
      safeAssignedNumber,

    status:
      status === "archived"
        ? "archived"
        : "active",

    studentId:
      project.studentId
        ? String(
            project.studentId
          )
        : undefined,

    studentName:
      project.studentName ||
      undefined,

    createdAt:
      project.createdAt,

    updatedAt:
      project.updatedAt,
  };
}

/* =========================================================
   NORMALIZE CANDIDATE
========================================================= */

function normalizeCandidate(
  candidate: RawCandidate
): AssignedCandidate {
  const assignedProject =
    candidate.assignedProject;

  const assignedProjectId =
    candidate.assignedProjectId ??
    assignedProject?.id ??
    assignedProject?._id;

  return {
    id: String(
      candidate.id ??
        candidate._id ??
        ""
    ),

    name:
      candidate.name ?? "",

    email:
      candidate.email ?? "",

    phone:
      candidate.phone ?? "",

    role:
      candidate.role ?? "",

    status:
      candidate.status ?? "",

    assignedProjectId:
      assignedProjectId
        ? String(
            assignedProjectId
          )
        : undefined,

    assignedProject:
      assignedProject
        ? {
            id: String(
              assignedProject.id ??
                assignedProject._id ??
                ""
            ),

            title:
              assignedProject.title ??
              "",

            difficulty:
              assignedProject.difficulty ===
                "mid" ||
              assignedProject.difficulty ===
                "senior"
                ? assignedProject.difficulty
                : "junior",
          }
        : undefined,
  };
}

/* =========================================================
   NORMALIZE GENERATE DATA
========================================================= */

function normalizeGenerateData(
  data: GenerateProjectData
): GenerateProjectData {
  return {
    role:
      data.role == null
        ? ""
        : String(data.role).trim(),

    projectType:
      data.projectType,

    difficulty:
      data.difficulty,

    duration:
      data.duration == null
        ? ""
        : String(
            data.duration
          ).trim(),

    technologies:
      Array.isArray(
        data.technologies
      )
        ? data.technologies
            .map((technology) =>
              String(
                technology
              ).trim()
            )
            .filter(Boolean)
        : [],

    focus:
      Array.isArray(
        data.focus
      )
        ? data.focus
            .map((item) =>
              String(item).trim()
            )
            .filter(Boolean)
            .join(", ")
        : data.focus == null
          ? "general"
          : String(
              data.focus
            ).trim() ||
            "general",

    requirements:
      Array.isArray(
        data.requirements
      )
        ? data.requirements
            .map((requirement) =>
              String(
                requirement
              ).trim()
            )
            .filter(Boolean)
        : [],

    generateDetailedPdf:
      data.generateDetailedPdf !==
      false,

    pdfFormat:
      data.pdfFormat ?? "pdf",

    studentId:
      data.studentId,

    studentName:
      data.studentName,

    studentSkills:
      Array.isArray(
        data.studentSkills
      )
        ? data.studentSkills
            .map((skill) =>
              String(
                skill
              ).trim()
            )
            .filter(Boolean)
        : undefined,

    studentEducation:
      data.studentEducation,

    description:
      data.description == null
        ? undefined
        : String(
            data.description
          ).trim() ||
          undefined,
  };
}

/* =========================================================
   EXTRACT CANDIDATES FROM PROJECT
========================================================= */

function extractCandidatesFromProject(
  project: RawProject
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

  for (
    const value of possibleValues
  ) {
    if (
      !Array.isArray(value) ||
      value.length === 0
    ) {
      continue;
    }

    const candidates =
      value
        .map((item) => {
          /*
           * Some APIs return just candidate IDs.
           *
           * Keep those as minimal candidate objects
           * so the UI still knows an assignment exists.
           */
          if (
            typeof item ===
              "string" &&
            item.trim()
          ) {
            return {
              id: item.trim(),
              name:
                "Assigned Candidate",
              email: "",
              phone: "",
              status:
                "assigned",
            };
          }

          if (
            item &&
            typeof item ===
              "object"
          ) {
            return normalizeCandidate(
              item as RawCandidate
            );
          }

          return null;
        })
        .filter(
          (
            candidate
          ): candidate is AssignedCandidate =>
            Boolean(
              candidate?.id
            )
        );

    if (
      candidates.length > 0
    ) {
      return candidates;
    }
  }

  /*
   * Single candidate object.
   */
  const singleValues = [
    source.assignedCandidate,
    source.assignedStudent,
    source.candidate,
    source.student,
  ];

  for (
    const value of singleValues
  ) {
    if (
      value &&
      typeof value ===
        "object"
    ) {
      const candidate =
        normalizeCandidate(
          value as RawCandidate
        );

      if (candidate.id) {
        return [candidate];
      }
    }
  }

  return [];
}

/* =========================================================
   GET ASSIGNED COUNT
========================================================= */

function getAssignedCountFromProject(
  project: RawProject
): number {
  const source =
    asRecord(project);

  const values = [
    source.assigned,
    source.assignedCount,
    source.assignedCandidateCount,
    source.assignedCandidatesCount,
    source.candidateCount,
    source.assignedStudentCount,
    source.assignedStudentsCount,
    source.totalAssignedCandidates,
    source.totalAssignedStudents,
  ];

  for (
    const value of values
  ) {
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0
    ) {
      return value;
    }

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      const number =
        Number(value);

      if (
        Number.isFinite(
          number
        ) &&
        number >= 0
      ) {
        return number;
      }
    }
  }

  return 0;
}

/* =========================================================
   PROJECT SERVICE
========================================================= */

export const projectService = {
  /* =======================================================
     GET ALL PROJECTS

     Backend:
     GET /api/projects
  ======================================================= */

  async getProjects(): Promise<
    Project[]
  > {
    const result =
      await request<ProjectsResponse>(
        "/api/projects"
      );

    if (
      !Array.isArray(
        result.projects
      )
    ) {
      return [];
    }

    return result.projects.map(
      normalizeProject
    );
  },

  /* =======================================================
     GET SINGLE PROJECT

     Backend:
     GET /api/projects/:projectId

     IMPORTANT:
     Also loads:
     GET /api/projects/:projectId/candidates

     This fixes the situation where the main project
     endpoint returns assignedCount = 1 but does not
     populate assignedCandidates.
  ======================================================= */

  async getProjectById(
  projectId: string
): Promise<ProjectDetails> {
  if (!projectId) {
    throw new Error("Project ID is required.");
  }

  // 1. Get the project itself
  const result = await request<ProjectResponse>(
    `/api/projects/${encodeURIComponent(projectId)}`
  );

  if (!result.project) {
    throw new Error(
      result.message || "Project not found."
    );
  }

  const project = normalizeProject(result.project);

  // 2. Try candidates embedded in the project response
  let assignedCandidates: AssignedCandidate[] = [];

  if (
    Array.isArray(
      result.project.assignedCandidates
    )
  ) {
    assignedCandidates =
      result.project.assignedCandidates
        .map((candidate) =>
          normalizeCandidate(
            candidate as RawCandidate
          )
        )
        .filter(
          (candidate) => Boolean(candidate.id)
        );
  }

  // 3. IMPORTANT:
  // If the project response did not contain candidates,
  // fetch them from the dedicated endpoint.
  if (assignedCandidates.length === 0) {
    try {
      assignedCandidates =
        await projectService.getAssignedCandidates(
          projectId
        );
    } catch (error) {
      console.error(
        "Failed to load assigned candidates:",
        error
      );

      // Do not fail the whole project page
      assignedCandidates = [];
    }
  }

  // 4. Return project + actual candidates
  return {
    ...project,
    assignedCandidates,
  };
},
  /* =======================================================
     CREATE PROJECT

     Backend:
     POST /api/projects
  ======================================================= */

  async createProject(
    data: CreateProjectData
  ): Promise<Project> {
    if (!data.title?.trim()) {
      throw new Error(
        "Project title is required."
      );
    }

    if (!data.role?.trim()) {
      throw new Error(
        "Project role is required."
      );
    }

    if (
      !data.difficulty ||
      ![
        "junior",
        "mid",
        "senior",
      ].includes(
        data.difficulty
      )
    ) {
      throw new Error(
        "Valid project difficulty is required."
      );
    }

    if (
      !data.description?.trim()
    ) {
      throw new Error(
        "Project description is required."
      );
    }

    if (
      !Array.isArray(
        data.technologies
      )
    ) {
      throw new Error(
        "Project technologies must be an array."
      );
    }

    const result =
      await request<ProjectResponse>(
        "/api/projects",
        {
          method: "POST",

          body: JSON.stringify({
            title:
              data.title.trim(),

            role:
              data.role.trim(),

            difficulty:
              data.difficulty,

            description:
              data.description.trim(),

            technologies:
              data.technologies
                .map(
                  (technology) =>
                    String(
                      technology
                    ).trim()
                )
                .filter(Boolean),

            briefUrl:
              data.briefUrl?.trim() ||
              "",

            pdfUrl:
              data.pdfUrl ||
              undefined,

            detailedPdfUrl:
              data.detailedPdfUrl ||
              undefined,

            pdfData:
              data.pdfData ||
              undefined,

            pdfFilename:
              data.pdfFilename ||
              undefined,

            projectType:
              data.projectType ||
              undefined,

            duration:
              data.duration ||
              undefined,

            focus:
              data.focus ||
              undefined,

            requirements:
              Array.isArray(
                data.requirements
              )
                ? data.requirements
                : [],

            status:
              data.status ??
              "active",

            studentId:
              data.studentId ||
              undefined,

            studentName:
              data.studentName ||
              undefined,
          }),
        }
      );

    if (!result.project) {
      throw new Error(
        result.message ||
          "Project creation failed."
      );
    }

    return normalizeProject(
      result.project
    );
  },

  /* =======================================================
     AI GENERATE PROJECT

     Backend:
     POST /api/projects/generate
  ======================================================= */

  async generateProject(
    data: GenerateProjectData
  ): Promise<Project> {
    const payload =
      normalizeGenerateData(
        data
      );

    if (!payload.role) {
      throw new Error(
        "Project role is required."
      );
    }

    if (!payload.projectType) {
      throw new Error(
        "Project type is required."
      );
    }

    if (!payload.difficulty) {
      throw new Error(
        "Project difficulty is required."
      );
    }

    if (
      !Array.isArray(
        payload.technologies
      )
    ) {
      throw new Error(
        "Project technologies are required."
      );
    }

    const result =
      await request<GenerateProjectResponse>(
        "/api/projects/generate",
        {
          method: "POST",

          body: JSON.stringify(
            payload
          ),
        }
      );

    if (!result.project) {
      throw new Error(
        result.message ||
          "AI project generation failed."
      );
    }

    /*
     * IMPORTANT:
     * normalizeProject() preserves pdfData/pdfFilename so the
     * generated PDF remains available to the preview component.
     * No Cloudinary upload happens in this client method.
     */
    return normalizeProject(
      result.project
    );
  },

  /* =======================================================
     REGENERATE SAVED AI PROJECT

     Backend:
     POST /api/projects/:projectId/regenerate
  ======================================================= */

  async regenerateProject(
    projectId: string,
    data: RegenerateProjectData
  ): Promise<Project> {
    if (!projectId) {
      throw new Error(
        "Project ID is required."
      );
    }

    const payload:
      RegenerateProjectData = {
      ...data,

      role:
        data.role?.trim() ||
        undefined,

      duration:
        data.duration?.trim() ||
        undefined,

      technologies:
        Array.isArray(
          data.technologies
        )
          ? data.technologies
              .map(
                (technology) =>
                  String(
                    technology
                  ).trim()
              )
              .filter(Boolean)
          : undefined,

      requirements:
        Array.isArray(
          data.requirements
        )
          ? data.requirements
              .map(
                (requirement) =>
                  String(
                    requirement
                  ).trim()
              )
              .filter(Boolean)
          : undefined,

      regenerationPrompt:
        data.regenerationPrompt
          ?.trim() ||
        undefined,

      generateDetailedPdf:
        data.generateDetailedPdf !==
        false,

      pdfFormat:
        data.pdfFormat ??
        "pdf",
    };

    const result =
      await request<GenerateProjectResponse>(
        `/api/projects/${encodeURIComponent(
          projectId
        )}/regenerate`,
        {
          method: "POST",

          body: JSON.stringify(
            payload
          ),
        }
      );

    if (!result.project) {
      throw new Error(
        result.message ||
          "Project regeneration failed."
      );
    }

    return normalizeProject(
      result.project
    );
  },

  /* =======================================================
     UPDATE PROJECT

     Backend:
     PATCH /api/projects/:projectId
  ======================================================= */

  async updateProject(
    projectId: string,
    data: UpdateProjectData
  ): Promise<Project> {
    if (!projectId) {
      throw new Error(
        "Project ID is required."
      );
    }

    const body:
      UpdateProjectData = {};

    if (
      data.title !==
      undefined
    ) {
      const title =
        data.title.trim();

      if (!title) {
        throw new Error(
          "Project title cannot be empty."
        );
      }

      body.title = title;
    }

    if (
      data.role !==
      undefined
    ) {
      const role =
        data.role.trim();

      if (!role) {
        throw new Error(
          "Project role cannot be empty."
        );
      }

      body.role = role;
    }

    if (
      data.difficulty !==
      undefined
    ) {
      if (
        ![
          "junior",
          "mid",
          "senior",
        ].includes(
          data.difficulty
        )
      ) {
        throw new Error(
          "Invalid project difficulty."
        );
      }

      body.difficulty =
        data.difficulty;
    }

    if (
      data.description !==
      undefined
    ) {
      body.description =
        data.description.trim();
    }

    if (
      data.technologies !==
      undefined
    ) {
      if (
        !Array.isArray(
          data.technologies
        )
      ) {
        throw new Error(
          "Project technologies must be an array."
        );
      }

      body.technologies =
        data.technologies
          .map(
            (technology) =>
              String(
                technology
              ).trim()
          )
          .filter(Boolean);
    }

    if (
      data.briefUrl !==
      undefined
    ) {
      body.briefUrl =
        data.briefUrl.trim();
    }

    if (
      data.pdfUrl !==
      undefined
    ) {
      body.pdfUrl =
        data.pdfUrl.trim();
    }

    if (
      data.detailedPdfUrl !==
      undefined
    ) {
      body.detailedPdfUrl =
        data.detailedPdfUrl.trim();
    }

    /*
     * Temporary AI-generated PDF.
     *
     * These values are sent only when explicitly provided.
     * The backend is responsible for validating the PDF,
     * uploading it to Cloudinary, and saving the final URL.
     */
    if (
      data.pdfData !==
      undefined
    ) {
      body.pdfData =
        data.pdfData;
    }

    if (
      data.pdfFilename !==
      undefined
    ) {
      body.pdfFilename =
        data.pdfFilename.trim();
    }

    if (
      data.projectType !==
      undefined
    ) {
      body.projectType =
        data.projectType.trim();
    }

    if (
      data.duration !==
      undefined
    ) {
      body.duration =
        data.duration.trim();
    }

    if (
      data.focus !==
      undefined
    ) {
      body.focus =
        data.focus.trim();
    }

    if (
      data.requirements !==
      undefined
    ) {
      if (
        !Array.isArray(
          data.requirements
        )
      ) {
        throw new Error(
          "Project requirements must be an array."
        );
      }

      body.requirements =
        data.requirements
          .map(
            (requirement) =>
              String(
                requirement
              ).trim()
          )
          .filter(Boolean);
    }

    if (
      data.status !==
      undefined
    ) {
      if (
        ![
          "active",
          "archived",
        ].includes(
          data.status
        )
      ) {
        throw new Error(
          "Invalid project status."
        );
      }

      body.status =
        data.status;
    }

    const result =
      await request<ProjectResponse>(
        `/api/projects/${encodeURIComponent(
          projectId
        )}`,
        {
          method: "PATCH",

          body:
            JSON.stringify(body),
        }
      );

    if (!result.project) {
      throw new Error(
        result.message ||
          "Project update failed."
      );
    }

    return normalizeProject(
      result.project
    );
  },

  /* =======================================================
     ARCHIVE PROJECT

     Backend:
     PATCH /api/projects/:projectId/archive
  ======================================================= */

  async archiveProject(
    projectId: string
  ): Promise<Project> {
    if (!projectId) {
      throw new Error(
        "Project ID is required."
      );
    }

    const result =
      await request<ProjectResponse>(
        `/api/projects/${encodeURIComponent(
          projectId
        )}/archive`,
        {
          method: "PATCH",
        }
      );

    if (!result.project) {
      throw new Error(
        result.message ||
          "Project archive failed."
      );
    }

    return normalizeProject(
      result.project
    );
  },

  /* =======================================================
     DELETE PROJECT

     Backend:
     DELETE /api/projects/:projectId
  ======================================================= */

  async deleteProject(
    projectId: string
  ): Promise<Project> {
    if (!projectId) {
      throw new Error(
        "Project ID is required."
      );
    }

    const result =
      await request<ProjectResponse>(
        `/api/projects/${encodeURIComponent(
          projectId
        )}`,
        {
          method: "DELETE",
        }
      );

    if (!result.project) {
      throw new Error(
        result.message ||
          "Project deletion failed."
      );
    }

    return normalizeProject(
      result.project
    );
  },

  /* =======================================================
     ASSIGN PROJECT TO CANDIDATE

     Backend:
     POST /api/candidates/:candidateId/project
  ======================================================= */

  async assignProjectToCandidate(
    projectId: string,
    candidateId: string
  ): Promise<{
    candidate: AssignedCandidate;
  }> {
    if (!projectId) {
      throw new Error(
        "Project ID is required."
      );
    }

    if (!candidateId) {
      throw new Error(
        "Candidate ID is required."
      );
    }

    const result =
      await request<AssignProjectResponse>(
        `/api/candidates/${encodeURIComponent(
          candidateId
        )}/project`,
        {
          method: "POST",

          body: JSON.stringify({
            projectId,
          }),
        }
      );

    if (!result.candidate) {
      throw new Error(
        result.message ||
          "Project assignment failed."
      );
    }

    return {
      candidate:
        normalizeCandidate(
          result.candidate
        ),
    };
  },

  /* =======================================================
     UNASSIGN PROJECT FROM CANDIDATE

     Backend:
     DELETE /api/candidates/:candidateId/project
  ======================================================= */

  async unassignProjectFromCandidate(
    candidateId: string
  ): Promise<{
    candidate: AssignedCandidate;
  }> {
    if (!candidateId) {
      throw new Error(
        "Candidate ID is required."
      );
    }

    const result =
      await request<UnassignProjectResponse>(
        `/api/candidates/${encodeURIComponent(
          candidateId
        )}/project`,
        {
          method: "DELETE",
        }
      );

    if (!result.candidate) {
      throw new Error(
        result.message ||
          "Project unassignment failed."
      );
    }

    return {
      candidate:
        normalizeCandidate(
          result.candidate
        ),
    };
  },

  /* =======================================================
     GET ASSIGNED CANDIDATES

     Backend:
     GET /api/projects/:projectId/candidates
  ======================================================= */

  async getAssignedCandidates(
    projectId: string
  ): Promise<
    AssignedCandidate[]
  > {
    if (!projectId) {
      throw new Error(
        "Project ID is required."
      );
    }

    const result =
      await request<AssignedCandidatesResponse>(
        `/api/projects/${encodeURIComponent(
          projectId
        )}/candidates`
      );

    if (
      Array.isArray(
        result.candidates
      )
    ) {
      return result.candidates
        .map(
          normalizeCandidate
        )
        .filter(
          (candidate) =>
            Boolean(candidate.id)
        );
    }

    if (
      Array.isArray(
        result.data
      )
    ) {
      return result.data
        .map(
          normalizeCandidate
        )
        .filter(
          (candidate) =>
            Boolean(candidate.id)
        );
    }

    return [];
  },

  /* =======================================================
     GET PROJECT PDF URL

     Priority:
       1. detailedPdfUrl
       2. pdfUrl
       3. briefUrl
  ======================================================= */

  async getProjectPdfUrl(
    projectId: string
  ): Promise<string> {
    if (!projectId) {
      throw new Error(
        "Project ID is required."
      );
    }

    const project =
      await this.getProjectById(
        projectId
      );

    const pdfUrl =
      project.detailedPdfUrl ||
      project.pdfUrl ||
      project.briefUrl ||
      "";

    if (!pdfUrl) {
      throw new Error(
        "No PDF URL is available for this project."
      );
    }

    return pdfUrl;
  },

  /* =======================================================
     UPLOAD ADMIN PROJECT PDF
     
     Backend:
     POST /api/projects/:projectId/admin-pdf
     
     Uploads a PDF to Cloudinary and saves the URL to:
     pdfUrl, detailedPdfUrl, briefUrl
  ======================================================= */

  async uploadAdminProjectPdf(
      projectId: string,
      pdfData: string,
      filename: string
    ): Promise<{ url: string; project: Project }> {
      if (!projectId) {
        throw new Error("Project ID is required.");
      }

      if (!pdfData || typeof pdfData !== "string") {
        throw new Error("PDF data is required.");
      }

      if (!filename || typeof filename !== "string") {
        throw new Error("PDF filename is required.");
      }

      const result = await request<{
        success: boolean;
        message?: string;
        url?: string;
        project?: RawProject;
      }>(
        `/api/projects/${encodeURIComponent(projectId)}/admin-pdf`,
        {
          method: "POST",
          body: JSON.stringify({
            filename,
            data: pdfData,
          }),
        }
      );

      if (!result.success) {
        throw new Error(
          result.message || "Failed to upload admin PDF."
        );
      }

      if (!result.url) {
        throw new Error(
          "PDF upload completed but no Cloudinary URL was returned."
        );
      }

      if (!result.project) {
        throw new Error(
          "PDF upload completed but updated project was not returned."
        );
      }

      const project = normalizeProject(result.project);

      if (
        !project.pdfUrl &&
        !project.detailedPdfUrl &&
        !project.briefUrl
      ) {
        throw new Error(
          "PDF upload completed but the project PDF URL was not saved."
        );
      }

      return {
        url: result.url,
        project,
      };
    }
  }