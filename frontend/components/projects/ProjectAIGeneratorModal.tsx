"use client";

import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";

import {
  Sparkles,
  X,
  Wand2,
  Loader2,
  Code2,
  Clock3,
  Target,
  Layers3,
  UserRound,
  Search,
  ArrowLeft,
  Check,
  Plus,
  ChevronDown,
} from "lucide-react";

import type { Candidate } from "@/types";
import type {
  ProjectDifficulty,
  ProjectType,
  StudentEducation,
} from "@/services/project.api";

/* =========================================================
   TYPES
========================================================= */

export type { ProjectDifficulty, ProjectType, StudentEducation } from "@/services/project.api";

export type ProjectFocus =
  | "authentication"
  | "api_development"
  | "database"
  | "frontend"
  | "fullstack"
  | "ai_integration"
  | "problem_solving"
  | "system_design"
  | "testing"
  | "performance"
  | "security"
  | "cloud"
  | "microservices"
  | "real_time"
  | "payments"
  | "file_processing"
  | "notifications"
  | "analytics"
  | "search"
  | "automation"
  | "deployment"
  | "scalability"
  | "data_visualization"
  | "recommendation_system";

export interface ProjectAIGeneratorData {
  role: string;
  projectType: ProjectType;
  difficulty: ProjectDifficulty;
  duration: number;
  technologies: string[];
  focus: ProjectFocus[];
  requirements: string;

  generateDetailedPdf: boolean;
  pdfFormat: "pdf";

  studentId?: string;
  studentName?: string;
  studentSkills?: string[];
  studentEducation?: StudentEducation;
}

export interface ProjectAIGeneratorModalProps {
  open: boolean;

  onClose: () => void;

  onBack?: () => void;

  student?: Candidate | null;

  mode?: "general" | "student";

  onGenerate?: (
    data: ProjectAIGeneratorData
  ) => void | Promise<void>;

  /**
   * Kept for compatibility with the existing parent flow.
   * The generation result is normally handled by onGenerate.
   */
  onGenerated?: (project: unknown) => void;

  initialData?: Partial<ProjectAIGeneratorData>;

  loading?: boolean;
}

/* =========================================================
   OPTIONS
========================================================= */

const PROJECT_TYPES: {
  value: ProjectType;
  label: string;
}[] = [
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

const DIFFICULTIES: {
  value: ProjectDifficulty;
  label: string;
}[] = [
  {
    value: "junior",
    label: "Junior",
  },
  {
    value: "mid",
    label: "Intermediate",
  },
  {
    value: "senior",
    label: "Advanced",
  },
];

const DURATION_PRESETS = [
  1,
  3,
  5,
  7,
  10,
  14,
  21,
  30,
  45,
  60,
  90,
  120,
  180,
  365,
];

const FOCUS_OPTIONS: {
  value: ProjectFocus;
  label: string;
}[] = [
  {
    value: "authentication",
    label: "Authentication",
  },
  {
    value: "api_development",
    label: "API Development",
  },
  {
    value: "database",
    label: "Database Design",
  },
  {
    value: "frontend",
    label: "Frontend Development",
  },
  {
    value: "fullstack",
    label: "Full Stack Development",
  },
  {
    value: "ai_integration",
    label: "AI Integration",
  },
  {
    value: "problem_solving",
    label: "Problem Solving",
  },
  {
    value: "system_design",
    label: "System Design",
  },
  {
    value: "testing",
    label: "Testing & QA",
  },
  {
    value: "performance",
    label: "Performance Optimization",
  },
  {
    value: "security",
    label: "Security",
  },
  {
    value: "cloud",
    label: "Cloud Integration",
  },
  {
    value: "microservices",
    label: "Microservices",
  },
  {
    value: "real_time",
    label: "Real-Time Systems",
  },
  {
    value: "payments",
    label: "Payments",
  },
  {
    value: "file_processing",
    label: "File Processing",
  },
  {
    value: "notifications",
    label: "Notifications",
  },
  {
    value: "analytics",
    label: "Analytics",
  },
  {
    value: "search",
    label: "Search",
  },
  {
    value: "automation",
    label: "Automation",
  },
  {
    value: "deployment",
    label: "Deployment",
  },
  {
    value: "scalability",
    label: "Scalability",
  },
  {
    value: "data_visualization",
    label: "Data Visualization",
  },
  {
    value: "recommendation_system",
    label: "Recommendation Systems",
  },
];

/* =========================================================
   TECHNOLOGY CATALOG
========================================================= */

const TECHNOLOGY_CATALOG = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "C",
  "C++",
  "C#",
  "Go",
  "Rust",
  "PHP",
  "Ruby",
  "Kotlin",
  "Swift",
  "Dart",

  "React",
  "Next.js",
  "Vue.js",
  "Nuxt.js",
  "Angular",
  "Svelte",
  "SvelteKit",
  "HTML",
  "CSS",
  "Tailwind CSS",
  "Bootstrap",

  "Node.js",
  "Express.js",
  "NestJS",
  "Fastify",
  "Django",
  "Flask",
  "FastAPI",
  "Spring Boot",
  "Laravel",
  "ASP.NET Core",
  "Ruby on Rails",

  "MongoDB",
  "MySQL",
  "PostgreSQL",
  "SQLite",
  "Redis",
  "MariaDB",
  "Oracle",
  "SQL Server",
  "Firebase",
  "Supabase",
  "DynamoDB",
  "Cassandra",
  "Elasticsearch",

  "Prisma",
  "Mongoose",
  "Sequelize",
  "TypeORM",
  "Drizzle ORM",
  "GraphQL",
  "REST API",
  "WebSockets",
  "Socket.IO",
  "gRPC",

  "Flutter",
  "React Native",
  "Android",
  "Android Studio",
  "Jetpack Compose",
  "SwiftUI",
  "iOS",

  "TensorFlow",
  "PyTorch",
  "scikit-learn",
  "Pandas",
  "NumPy",
  "OpenCV",
  "Hugging Face",
  "LangChain",
  "LangGraph",
  "OpenAI API",
  "Google Gemini API",
  "Groq API",

  "AWS",
  "Azure",
  "Google Cloud",
  "Docker",
  "Kubernetes",
  "Terraform",
  "GitHub Actions",
  "Jenkins",
  "GitLab CI",
  "Prometheus",
  "Grafana",
  "Nginx",

  "Kafka",
  "RabbitMQ",
  "Apache Spark",
  "Airflow",
  "Power BI",
  "Tableau",
  "Jupyter",
  "Postman",
  "Swagger / OpenAPI",
  "Git",
  "GitHub",
];

/* =========================================================
   HELPERS
========================================================= */

function getStudentTechnologies(
  student?: Candidate | null
): string[] {
  if (!student?.skills) {
    return [];
  }

  return Array.from(
    new Set(
      student.skills
        .filter(
          (skill): skill is string =>
            typeof skill === "string" &&
            skill.trim().length > 0
        )
        .map((skill) => skill.trim())
    )
  ).slice(0, 8);
}

function getStudentEducation(
  student?: Candidate | null
): StudentEducation | undefined {
  const education = student?.education;

  if (!education) {
    return undefined;
  }

  /*
   * Supports both:
   *
   * education: {
   *   degree,
   *   college,
   *   year
   * }
   *
   * and:
   *
   * education: [
   *   {
   *     degree,
   *     college,
   *     year
   *   }
   * ]
   */

  if (Array.isArray(education)) {
    const first = education[0];

    if (!first) {
      return undefined;
    }

    return {
      degree: String(first.degree ?? ""),
      college: String(first.college ?? ""),
      year: String(first.year ?? ""),
    };
  }

  return {
    degree: String(
      (education as { degree?: unknown }).degree ?? ""
    ),
    college: String(
      (education as { college?: unknown }).college ?? ""
    ),
    year: String(
      (education as { year?: unknown }).year ?? ""
    ),
  };
}

function getStudentRole(
  student?: Candidate | null
): string {
  const candidate = student as
    | (Candidate & {
        role?: string;
      })
    | null
    | undefined;

  return (
    candidate?.role?.trim() ||
    "Software Developer"
  );
}

function getDefaultProjectType(
  student?: Candidate | null
): ProjectType {
  const role = getStudentRole(student).toLowerCase();

  if (
    role.includes("frontend") ||
    role.includes("front end") ||
    role.includes("react") ||
    role.includes("ui")
  ) {
    return "frontend";
  }

  if (
    role.includes("full") ||
    role.includes("mern") ||
    role.includes("software")
  ) {
    return "fullstack";
  }

  if (
    role.includes("mobile") ||
    role.includes("flutter") ||
    role.includes("android") ||
    role.includes("ios")
  ) {
    return "mobile";
  }

  if (
    role.includes("ai") ||
    role.includes("machine learning") ||
    role.includes("ml")
  ) {
    return "ai_ml";
  }

  if (
    role.includes("data") ||
    role.includes("analyst")
  ) {
    return "data_science";
  }

  if (
    role.includes("devops") ||
    role.includes("cloud")
  ) {
    return "devops";
  }

  return "backend";
}

function getDefaultDifficulty(
  student?: Candidate | null
): ProjectDifficulty {
  if (!student) {
    return "junior";
  }

  const score = Number(
    (student as Candidate & {
      jdMatchScore?: number;
    }).jdMatchScore ?? 0
  );

  if (score >= 85) {
    return "senior";
  }

  if (score >= 70) {
    return "mid";
  }

  return "junior";
}

function getDefaultTechnologies(
  student?: Candidate | null
): string[] {
  const studentTechnologies =
    getStudentTechnologies(student);

  if (studentTechnologies.length > 0) {
    return studentTechnologies;
  }

  return [
    "JavaScript",
    "Node.js",
    "Express.js",
    "MongoDB",
  ];
}

/* =========================================================
   COMPONENT
========================================================= */

export default function ProjectAIGeneratorModal({
  open,
  onClose,
  onBack,
  student = null,
  mode = "general",
  onGenerate,
  initialData,
  loading = false,
}: ProjectAIGeneratorModalProps) {
  const studentMode =
    mode === "student" || Boolean(student);

  /* =======================================================
     STATE
  ======================================================= */

  const [role, setRole] =
    useState("Backend Developer");

  const [projectType, setProjectType] =
    useState<ProjectType>("backend");

  const [difficulty, setDifficulty] =
    useState<ProjectDifficulty>("junior");

  const [duration, setDuration] =
    useState(14);

  const [selectedTechnologies, setSelectedTechnologies] =
    useState<string[]>([
      "Node.js",
      "Express.js",
      "MongoDB",
    ]);

  const [focus, setFocus] =
    useState<ProjectFocus[]>([
      "api_development",
    ]);

  const [technologySearch, setTechnologySearch] =
    useState("");

  const [focusSearch, setFocusSearch] =
    useState("");

  const [requirements, setRequirements] =
    useState("");

  const [generateDetailedPdf, setGenerateDetailedPdf] =
    useState(true);

  const [error, setError] =
    useState("");

  /* =======================================================
     DERIVED STUDENT DATA
  ======================================================= */

  const studentTechnologies = useMemo(
    () => getStudentTechnologies(student),
    [student]
  );

  const studentEducation = useMemo(
    () => getStudentEducation(student),
    [student]
  );

  /* =======================================================
     FILTERED OPTIONS
  ======================================================= */

  const filteredTechnologies = useMemo(() => {
    const query =
      technologySearch.trim().toLowerCase();

    if (!query) {
      return TECHNOLOGY_CATALOG;
    }

    return TECHNOLOGY_CATALOG.filter(
      (technology) =>
        technology
          .toLowerCase()
          .includes(query)
    );
  }, [technologySearch]);

  const filteredFocusOptions = useMemo(() => {
    const query =
      focusSearch.trim().toLowerCase();

    if (!query) {
      return FOCUS_OPTIONS;
    }

    return FOCUS_OPTIONS.filter((item) =>
      item.label
        .toLowerCase()
        .includes(query)
    );
  }, [focusSearch]);

  /* =======================================================
     INITIALIZE FORM
  ======================================================= */

  useEffect(() => {
    if (!open) {
      return;
    }

    setError("");

    /*
     * If the parent supplied initialData, restore it.
     */
    if (initialData) {
      setRole(
        initialData.role ??
          (student
            ? getStudentRole(student)
            : "Backend Developer")
      );

      setProjectType(
        initialData.projectType ??
          (student
            ? getDefaultProjectType(student)
            : "backend")
      );

      setDifficulty(
        initialData.difficulty ??
          (student
            ? getDefaultDifficulty(student)
            : "junior")
      );

      setDuration(
        initialData.duration ?? 14
      );

      setSelectedTechnologies(
        initialData.technologies?.length
          ? initialData.technologies
          : getDefaultTechnologies(student)
      );

      setFocus(
        initialData.focus?.length
          ? initialData.focus
          : ["api_development"]
      );

      setRequirements(
        initialData.requirements ?? ""
      );

      setGenerateDetailedPdf(
        initialData.generateDetailedPdf ??
          true
      );

      return;
    }

    /*
     * Student mode defaults.
     */
    if (studentMode && student) {
      setRole(getStudentRole(student));

      setProjectType(
        getDefaultProjectType(student)
      );

      setDifficulty(
        getDefaultDifficulty(student)
      );

      setDuration(14);

      setSelectedTechnologies(
        getDefaultTechnologies(student)
      );

      setFocus([
        "api_development",
      ]);

      setRequirements(
        "Build a practical, measurable project that matches the student's current skills and education. " +
          "Use the student's existing skills where appropriate while introducing a reasonable amount of new learning. " +
          "The project should be suitable for evaluating implementation and problem-solving ability."
      );

      setGenerateDetailedPdf(true);

      return;
    }

    /*
     * General mode defaults.
     */
    setRole("Backend Developer");

    setProjectType("backend");

    setDifficulty("junior");

    setDuration(14);

    setSelectedTechnologies([
      "Node.js",
      "Express.js",
      "MongoDB",
    ]);

    setFocus([
      "api_development",
    ]);

    setRequirements("");

    setGenerateDetailedPdf(true);
  }, [
    open,
    studentMode,
    student,
    initialData,
  ]);

  /* =======================================================
     ESCAPE KEY
  ======================================================= */

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !loading
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
    loading,
    onClose,
  ]);

  /* =======================================================
     TECHNOLOGY TOGGLE
  ======================================================= */

  const toggleTechnology = (
    technology: string
  ) => {
    setSelectedTechnologies(
      (current) => {
        if (
          current.includes(technology)
        ) {
          return current.filter(
            (item) =>
              item !== technology
          );
        }

        return [
          ...current,
          technology,
        ];
      }
    );
  };

  /* =======================================================
     CUSTOM TECHNOLOGY
  ======================================================= */

  const addCustomTechnology = () => {
    const value =
      technologySearch.trim();

    if (!value) {
      return;
    }

    setSelectedTechnologies(
      (current) => {
        const exists =
          current.some(
            (item) =>
              item.toLowerCase() ===
              value.toLowerCase()
          );

        if (exists) {
          return current;
        }

        return [
          ...current,
          value,
        ];
      }
    );

    setTechnologySearch("");
  };

  /* =======================================================
     FOCUS TOGGLE
  ======================================================= */

  const toggleFocus = (
    value: ProjectFocus
  ) => {
    setFocus((current) =>
      current.includes(value)
        ? current.filter(
            (item) =>
              item !== value
          )
        : [
            ...current,
            value,
          ]
    );
  };

  /* =======================================================
     GENERATE
  ======================================================= */

  const handleGenerate = async () => {
    if (loading) {
      return;
    }

    setError("");

    /* -----------------------------------------------------
       VALIDATION
    ----------------------------------------------------- */

    const cleanRole =
      role.trim();

    if (!cleanRole) {
      setError(
        "Please enter a project role."
      );
      return;
    }

    if (
      selectedTechnologies.length === 0
    ) {
      setError(
        "Please select at least one technology."
      );
      return;
    }

    if (focus.length === 0) {
      setError(
        "Please select at least one project focus."
      );
      return;
    }

    if (
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration > 365
    ) {
      setError(
        "Project duration must be between 1 and 365 days."
      );
      return;
    }

    if (
      studentMode &&
      !student?.id
    ) {
      setError(
        "Please select a student before generating a student-specific project."
      );
      return;
    }

    if (!onGenerate) {
      setError(
        "Project generation is not connected. Please check the parent page."
      );
      return;
    }

    /* -----------------------------------------------------
       DATA
    ----------------------------------------------------- */

    const data: ProjectAIGeneratorData = {
      role: cleanRole,

      projectType,

      difficulty,

      duration,

      technologies:
        selectedTechnologies.map(
          (technology) =>
            technology.trim()
        ),

      focus,

      requirements:
        requirements.trim(),

      generateDetailedPdf,

      pdfFormat: "pdf",

      ...(student
        ? {
            studentId:
              String(student.id),

            studentName:
              student.name ?? "",

            studentSkills:
              getStudentTechnologies(
                student
              ),

            studentEducation,
          }
        : {}),
    };

    /* -----------------------------------------------------
       SEND TO PARENT
    ----------------------------------------------------- */

    try {
      await onGenerate(data);
    } catch (err) {
      console.error(
        "AI project generation failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate project. Please try again."
      );
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
        z-[60]
        flex
        items-center
        justify-center
        bg-slate-950/50
        p-4
        backdrop-blur-sm
      "
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !loading
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-project-generator-title"
        className="
          flex
          max-h-[90vh]
          w-full
          max-w-3xl
          flex-col
          overflow-hidden
          rounded-2xl
          bg-white
          shadow-2xl
          dark:bg-[#151922]
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
          <div className="flex items-center gap-3">
            <div
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-xl
                bg-indigo-600
                text-white
              "
            >
              <Sparkles size={19} />
            </div>

            <div>
              <h2
                id="ai-project-generator-title"
                className="
                  font-semibold
                  text-slate-900
                  dark:text-white
                "
              >
                {studentMode
                  ? "Generate Project for Student"
                  : "Generate Project with AI"}
              </h2>

              <p
                className="
                  mt-0.5
                  text-xs
                  text-slate-500
                  dark:text-slate-400
                "
              >
                {studentMode
                  ? "Create a project based on the student's profile and skills."
                  : "Define requirements and let AI create the project."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
            className="
              rounded-lg
              p-2
              text-slate-400
              transition
              hover:bg-slate-100
              hover:text-slate-700
              disabled:cursor-not-allowed
              disabled:opacity-50
              dark:hover:bg-white/5
              dark:hover:text-white
            "
          >
            <X size={19} />
          </button>
        </div>

        {/* =================================================
            CONTENT
        ================================================= */}

        <div
          className="
            flex-1
            overflow-y-auto
            p-5
          "
        >
          <div className="space-y-5">
            {/* =============================================
                STUDENT
            ============================================== */}

            {studentMode && student && (
              <div
                className="
                  rounded-xl
                  border
                  border-indigo-100
                  bg-indigo-50/70
                  p-4
                  dark:border-indigo-500/20
                  dark:bg-indigo-500/5
                "
              >
                <div className="flex gap-3">
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
                    <UserRound size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className="
                            truncate
                            text-sm
                            font-semibold
                            text-indigo-900
                            dark:text-indigo-200
                          "
                        >
                          {student.name}
                        </p>

                        <p
                          className="
                            mt-0.5
                            truncate
                            text-xs
                            text-indigo-700/80
                            dark:text-indigo-300/70
                          "
                        >
                          {getStudentRole(
                            student
                          )}
                        </p>
                      </div>

                      <span
                        className="
                          shrink-0
                          rounded-full
                          bg-white
                          px-2
                          py-1
                          text-[11px]
                          font-medium
                          text-indigo-700
                          dark:bg-white/5
                          dark:text-indigo-300
                        "
                      >
                        JD Match{" "}
                        {Number(
                          (
                            student as Candidate & {
                              jdMatchScore?: number;
                            }
                          ).jdMatchScore ?? 0
                        )}
                        %
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {/* EDUCATION */}

                      <div>
                        <p
                          className="
                            text-[11px]
                            font-medium
                            text-indigo-600/70
                            dark:text-indigo-300/60
                          "
                        >
                          Education
                        </p>

                        {studentEducation ? (
                          <>
                            <p
                              className="
                                mt-0.5
                                text-xs
                                text-indigo-900
                                dark:text-indigo-200
                              "
                            >
                              {studentEducation.degree ||
                                "Not specified"}
                            </p>

                            <p
                              className="
                                text-[11px]
                                text-indigo-700/70
                                dark:text-indigo-300/60
                              "
                            >
                              {String(
                                studentEducation.college ??
                                  "College not specified"
                              )}

                              {studentEducation.year
                                ? ` • ${studentEducation.year}`
                                : ""}
                            </p>
                          </>
                        ) : (
                          <p className="mt-1 text-xs text-indigo-700/70">
                            Education not available
                          </p>
                        )}
                      </div>

                      {/* SKILLS */}

                      <div>
                        <p
                          className="
                            text-[11px]
                            font-medium
                            text-indigo-600/70
                            dark:text-indigo-300/60
                          "
                        >
                          Current Skills
                        </p>

                        {studentTechnologies.length >
                        0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {studentTechnologies
                              .slice(0, 6)
                              .map(
                                (skill) => (
                                  <span
                                    key={skill}
                                    className="
                                      rounded-md
                                      bg-white
                                      px-1.5
                                      py-0.5
                                      text-[10px]
                                      font-medium
                                      text-indigo-700
                                      dark:bg-white/5
                                      dark:text-indigo-300
                                    "
                                  >
                                    {skill}
                                  </span>
                                )
                              )}

                            {studentTechnologies.length >
                              6 && (
                              <span
                                className="
                                  rounded-md
                                  bg-white
                                  px-1.5
                                  py-0.5
                                  text-[10px]
                                  text-indigo-600
                                  dark:bg-white/5
                                  dark:text-indigo-300
                                "
                              >
                                +
                                {studentTechnologies.length -
                                  6}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-indigo-700/70">
                            Skills not available
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =============================================
                AI INFORMATION
            ============================================== */}

            <div
              className="
                rounded-xl
                border
                border-indigo-100
                bg-indigo-50/70
                px-4
                py-3
                dark:border-indigo-500/20
                dark:bg-indigo-500/5
              "
            >
              <div className="flex gap-3">
                <Wand2
                  size={18}
                  className="
                    mt-0.5
                    shrink-0
                    text-indigo-600
                    dark:text-indigo-400
                  "
                />

                <div>
                  <p
                    className="
                      text-sm
                      font-medium
                      text-indigo-800
                      dark:text-indigo-300
                    "
                  >
                    {studentMode
                      ? "Student-Aware AI Generation"
                      : "AI Project Generator"}
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      leading-5
                      text-indigo-700/80
                      dark:text-indigo-300/70
                    "
                  >
                    {studentMode
                      ? "AI will use the student's role, skills, education and your requirements."
                      : "AI will use your requirements to create a practical project."}
                  </p>
                </div>
              </div>
            </div>

            {/* =============================================
                ROLE
            ============================================== */}

            <div>
              <label
                htmlFor="ai-project-role"
                className="
                  mb-1.5
                  block
                  text-sm
                  font-medium
                  text-slate-700
                  dark:text-slate-300
                "
              >
                Role
              </label>

              <input
                id="ai-project-role"
                type="text"
                value={role}
                onChange={(event) =>
                  setRole(
                    event.target.value
                  )
                }
                placeholder="Backend Developer"
                disabled={loading}
                className="
                  w-full
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  px-3
                  py-2.5
                  text-sm
                  outline-none
                  transition
                  focus:border-indigo-500
                  focus:ring-2
                  focus:ring-indigo-500/10
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                  dark:border-white/10
                  dark:bg-[#10141d]
                  dark:text-white
                "
              />
            </div>

            {/* =============================================
                TYPE + DIFFICULTY
            ============================================== */}

            <div
              className="
                grid
                grid-cols-1
                gap-4
                sm:grid-cols-2
              "
            >
              <div>
                <label
                  htmlFor="ai-project-type"
                  className="
                    mb-1.5
                    block
                    text-sm
                    font-medium
                    text-slate-700
                    dark:text-slate-300
                  "
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Layers3 size={14} />
                    Project Type
                  </span>
                </label>

                <div className="relative">
                  <select
                    id="ai-project-type"
                    value={projectType}
                    onChange={(event) =>
                      setProjectType(
                        event.target
                          .value as ProjectType
                      )
                    }
                    disabled={loading}
                    className="
                      w-full
                      appearance-none
                      rounded-xl
                      border
                      border-slate-200
                      bg-white
                      px-3
                      py-2.5
                      pr-9
                      text-sm
                      outline-none
                      focus:border-indigo-500
                      dark:border-white/10
                      dark:bg-[#10141d]
                      dark:text-white
                    "
                  >
                    {PROJECT_TYPES.map(
                      (item) => (
                        <option
                          key={item.value}
                          value={item.value}
                        >
                          {item.label}
                        </option>
                      )
                    )}
                  </select>

                  <ChevronDown
                    size={16}
                    className="
                      pointer-events-none
                      absolute
                      right-3
                      top-1/2
                      -translate-y-1/2
                      text-slate-400
                    "
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="ai-project-difficulty"
                  className="
                    mb-1.5
                    block
                    text-sm
                    font-medium
                    text-slate-700
                    dark:text-slate-300
                  "
                >
                  Difficulty
                </label>

                <div className="relative">
                  <select
                    id="ai-project-difficulty"
                    value={difficulty}
                    onChange={(event) =>
                      setDifficulty(
                        event.target
                          .value as ProjectDifficulty
                      )
                    }
                    disabled={loading}
                    className="
                      w-full
                      appearance-none
                      rounded-xl
                      border
                      border-slate-200
                      bg-white
                      px-3
                      py-2.5
                      pr-9
                      text-sm
                      outline-none
                      focus:border-indigo-500
                      dark:border-white/10
                      dark:bg-[#10141d]
                      dark:text-white
                    "
                  >
                    {DIFFICULTIES.map(
                      (item) => (
                        <option
                          key={item.value}
                          value={item.value}
                        >
                          {item.label}
                        </option>
                      )
                    )}
                  </select>

                  <ChevronDown
                    size={16}
                    className="
                      pointer-events-none
                      absolute
                      right-3
                      top-1/2
                      -translate-y-1/2
                      text-slate-400
                    "
                  />
                </div>
              </div>
            </div>

            {/* =============================================
                DURATION
            ============================================== */}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 size={14} />
                    Project Duration
                  </span>
                </label>

                <span className="text-sm font-semibold text-indigo-600">
                  {duration} days
                </span>
              </div>

              <input
                type="number"
                min={1}
                max={365}
                value={duration}
                onChange={(event) => {
                  const value =
                    Number(
                      event.target.value
                    );

                  if (
                    Number.isFinite(value)
                  ) {
                    setDuration(
                      Math.min(
                        365,
                        Math.max(
                          1,
                          value
                        )
                      )
                    );
                  }
                }}
                disabled={loading}
                className="
                  w-full
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  px-3
                  py-2.5
                  text-sm
                  outline-none
                  focus:border-indigo-500
                  dark:border-white/10
                  dark:bg-[#10141d]
                  dark:text-white
                "
              />

              <div className="mt-2 flex flex-wrap gap-1.5">
                {DURATION_PRESETS.map(
                  (days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() =>
                        setDuration(days)
                      }
                      disabled={loading}
                      className={`
                        rounded-lg
                        border
                        px-2.5
                        py-1.5
                        text-[11px]
                        font-medium
                        transition
                        ${
                          duration === days
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
                            : "border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                        }
                      `}
                    >
                      {days}d
                    </button>
                  )
                )}
              </div>
            </div>

            {/* =============================================
                FOCUS
            ============================================== */}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Target size={14} />
                    Project Focus
                  </span>
                </label>

                <span className="text-xs text-slate-400">
                  {focus.length} selected
                </span>
              </div>

              <div
                className="
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  p-3
                  dark:border-white/10
                  dark:bg-[#10141d]
                "
              >
                <div className="relative">
                  <Search
                    size={15}
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
                    value={focusSearch}
                    onChange={(event) =>
                      setFocusSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search focus areas..."
                    disabled={loading}
                    className="
                      w-full
                      rounded-lg
                      border
                      border-slate-200
                      bg-slate-50
                      py-2
                      pl-9
                      pr-3
                      text-xs
                      outline-none
                      focus:border-indigo-400
                      dark:border-white/10
                      dark:bg-white/5
                      dark:text-white
                    "
                  />
                </div>

                {focus.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {focus.map(
                      (value) => {
                        const item =
                          FOCUS_OPTIONS.find(
                            (option) =>
                              option.value ===
                              value
                          );

                        if (!item) {
                          return null;
                        }

                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              toggleFocus(
                                value
                              )
                            }
                            disabled={loading}
                            className="
                              inline-flex
                              items-center
                              gap-1
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
                            {item.label}
                            <X size={12} />
                          </button>
                        );
                      }
                    )}
                  </div>
                )}

                <div className="mt-3 max-h-40 overflow-y-auto">
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {filteredFocusOptions.map(
                      (item) => {
                        const selected =
                          focus.includes(
                            item.value
                          );

                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() =>
                              toggleFocus(
                                item.value
                              )
                            }
                            disabled={loading}
                            className={`
                              flex
                              items-center
                              justify-between
                              rounded-lg
                              px-2.5
                              py-2
                              text-left
                              text-xs
                              transition
                              ${
                                selected
                                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                              }
                            `}
                          >
                            <span>
                              {item.label}
                            </span>

                            {selected && (
                              <Check
                                size={14}
                              />
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* =============================================
                TECHNOLOGIES
            ============================================== */}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Code2 size={14} />
                    Technologies
                  </span>
                </label>

                <span className="text-xs text-slate-400">
                  {selectedTechnologies.length} selected
                </span>
              </div>

              <div
                className="
                  rounded-xl
                  border
                  border-slate-200
                  bg-slate-50
                  p-3
                  dark:border-white/10
                  dark:bg-[#10141d]
                "
              >
                <div className="relative">
                  <Search
                    size={16}
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
                    value={technologySearch}
                    onChange={(event) =>
                      setTechnologySearch(
                        event.target.value
                      )
                    }
                    onKeyDown={(
                      event: KeyboardEvent<HTMLInputElement>
                    ) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        event.preventDefault();
                        addCustomTechnology();
                      }
                    }}
                    placeholder="Search technologies or type your own..."
                    disabled={loading}
                    className="
                      w-full
                      rounded-lg
                      border
                      border-slate-200
                      bg-white
                      py-2.5
                      pl-9
                      pr-3
                      text-sm
                      outline-none
                      focus:border-indigo-400
                      dark:border-white/10
                      dark:bg-white/5
                      dark:text-white
                    "
                  />
                </div>

                {selectedTechnologies.length >
                  0 && (
                  <div className="mt-3">
                    <p
                      className="
                        mb-1.5
                        text-[11px]
                        font-medium
                        uppercase
                        tracking-wide
                        text-slate-400
                      "
                    >
                      Selected
                    </p>

                    <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                      {selectedTechnologies.map(
                        (technology) => (
                          <button
                            key={technology}
                            type="button"
                            onClick={() =>
                              toggleTechnology(
                                technology
                              )
                            }
                            disabled={loading}
                            className="
                              inline-flex
                              items-center
                              gap-1
                              rounded-full
                              border
                              border-indigo-200
                              bg-indigo-50
                              px-2.5
                              py-1
                              text-[11px]
                              font-medium
                              text-indigo-700
                              dark:border-indigo-500/30
                              dark:bg-indigo-500/10
                              dark:text-indigo-300
                            "
                          >
                            {technology}
                            <X size={12} />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}

                <div
                  className="
                    mt-3
                    border-t
                    border-slate-200
                    pt-3
                    dark:border-white/10
                  "
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p
                      className="
                        text-[11px]
                        font-medium
                        uppercase
                        tracking-wide
                        text-slate-400
                      "
                    >
                      Technology Library
                    </p>

                    {technologySearch.trim() && (
                      <button
                        type="button"
                        onClick={
                          addCustomTechnology
                        }
                        disabled={loading}
                        className="
                          inline-flex
                          items-center
                          gap-1
                          text-[11px]
                          font-semibold
                          text-indigo-600
                          hover:text-indigo-700
                          dark:text-indigo-400
                        "
                      >
                        <Plus size={12} />
                        Add custom
                      </button>
                    )}
                  </div>

                  <div className="max-h-48 overflow-y-auto">
                    <div className="flex flex-wrap gap-1.5">
                      {filteredTechnologies.map(
                        (technology) => {
                          const selected =
                            selectedTechnologies.includes(
                              technology
                            );

                          return (
                            <button
                              key={technology}
                              type="button"
                              onClick={() =>
                                toggleTechnology(
                                  technology
                                )
                              }
                              disabled={loading}
                              className={`
                                inline-flex
                                items-center
                                gap-1.5
                                rounded-lg
                                border
                                px-2.5
                                py-1.5
                                text-xs
                                font-medium
                                transition
                                ${
                                  selected
                                    ? "border-indigo-200 bg-indigo-100 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                                }
                              `}
                            >
                              {selected && (
                                <Check
                                  size={12}
                                />
                              )}

                              {technology}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {filteredTechnologies.length ===
                    0 &&
                    technologySearch.trim() && (
                      <div
                        className="
                          mt-2
                          rounded-lg
                          bg-white
                          px-3
                          py-2.5
                          text-xs
                          text-slate-500
                          dark:bg-white/5
                          dark:text-slate-400
                        "
                      >
                        No matching technology.
                        Press Enter to add it.
                      </div>
                    )}
                </div>
              </div>
            </div>

            {/* =============================================
                PDF GENERATION
            ============================================== */}

            <div
              className="
                rounded-xl
                border
                border-indigo-100
                bg-indigo-50/60
                p-4
                dark:border-indigo-500/20
                dark:bg-indigo-500/5
              "
            >
              <div className="flex items-start gap-3">
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
                  <span className="text-xs font-bold">
                    PDF
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p
                        className="
                          text-sm
                          font-semibold
                          text-indigo-900
                          dark:text-indigo-200
                        "
                      >
                        Detailed Project Guide PDF
                      </p>

                      <p
                        className="
                          mt-1
                          text-xs
                          leading-5
                          text-indigo-700/80
                          dark:text-indigo-300/70
                        "
                      >
                        Generate a complete student-readable
                        project guide along with the project.
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={
                        generateDetailedPdf
                      }
                      onClick={() =>
                        setGenerateDetailedPdf(
                          (current) =>
                            !current
                        )
                      }
                      disabled={loading}
                      className={`
                        relative
                        h-6
                        w-11
                        shrink-0
                        rounded-full
                        transition
                        ${
                          generateDetailedPdf
                            ? "bg-indigo-600"
                            : "bg-slate-300 dark:bg-white/20"
                        }
                      `}
                    >
                      <span
                        className={`
                          absolute
                          top-1
                          h-4
                          w-4
                          rounded-full
                          bg-white
                          shadow-sm
                          transition
                          ${
                            generateDetailedPdf
                              ? "left-6"
                              : "left-1"
                          }
                        `}
                      />
                    </button>
                  </div>

                  {generateDetailedPdf && (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {[
                        "Project overview and objectives",
                        "Prerequisites and software",
                        "Architecture and folder structure",
                        "Database schema and API details",
                        "Step-by-step implementation",
                        "Testing and validation",
                        "Deployment instructions",
                        "Deliverables and evaluation criteria",
                      ].map(
                        (item) => (
                          <div
                            key={item}
                            className="
                              flex
                              items-start
                              gap-2
                              text-[11px]
                              text-indigo-800/80
                              dark:text-indigo-300/80
                            "
                          >
                            <Check
                              size={13}
                              className="
                                mt-0.5
                                shrink-0
                                text-indigo-600
                                dark:text-indigo-400
                              "
                            />

                            <span>
                              {item}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* =============================================
                REQUIREMENTS
            ============================================== */}

            <div>
              <label
                htmlFor="ai-project-requirements"
                className="
                  mb-1.5
                  block
                  text-sm
                  font-medium
                  text-slate-700
                  dark:text-slate-300
                "
              >
                Additional Requirements
                <span className="ml-1 font-normal text-slate-400">
                  (Optional)
                </span>
              </label>

              <textarea
                id="ai-project-requirements"
                value={requirements}
                onChange={(event) =>
                  setRequirements(
                    event.target.value
                  )
                }
                rows={4}
                disabled={loading}
                placeholder={
                  studentMode
                    ? "Add anything specific you want the project to test for this student."
                    : "Example: JWT authentication, role-based access control, pagination and proper error handling."
                }
                className="
                  w-full
                  resize-none
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  px-3
                  py-2.5
                  text-sm
                  outline-none
                  focus:border-indigo-500
                  focus:ring-2
                  focus:ring-indigo-500/10
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                  dark:border-white/10
                  dark:bg-[#10141d]
                  dark:text-white
                "
              />
            </div>

            {/* =============================================
                ERROR
            ============================================== */}

            {error && (
              <div
                role="alert"
                className="
                  rounded-xl
                  border
                  border-red-200
                  bg-red-50
                  px-4
                  py-3
                  text-sm
                  text-red-700
                  dark:border-red-500/20
                  dark:bg-red-500/10
                  dark:text-red-400
                "
              >
                {error}
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
          <button
            type="button"
            onClick={
              onBack ?? onClose
            }
            disabled={loading}
            className="
              inline-flex
              items-center
              gap-2
              rounded-xl
              border
              border-slate-200
              bg-white
              px-4
              py-2.5
              text-sm
              font-medium
              text-slate-700
              transition
              hover:bg-slate-50
              disabled:cursor-not-allowed
              disabled:opacity-50
              dark:border-white/10
              dark:bg-[#151922]
              dark:text-slate-300
              dark:hover:bg-white/5
            "
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="
                rounded-xl
                border
                border-slate-200
                px-4
                py-2.5
                text-sm
                font-medium
                text-slate-700
                transition
                hover:bg-slate-50
                disabled:cursor-not-allowed
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
              onClick={handleGenerate}
              disabled={loading}
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-indigo-600
                px-5
                py-2.5
                text-sm
                font-medium
                text-white
                shadow-sm
                transition
                hover:bg-indigo-700
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              {loading ? (
                <>
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  {studentMode
                    ? "Generate for Student"
                    : "Generate Project"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}