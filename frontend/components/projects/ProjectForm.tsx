"use client";

import {
  useEffect,
  useState,
  type FormEvent,
  type ChangeEvent,
} from "react";

/* =====================================================
   TYPES
===================================================== */

import type { ProjectDifficulty } from "@/services/project.api";

export type { ProjectDifficulty } from "@/services/project.api";

export type ProjectStatus =
  | "active"
  | "archived";

/* =====================================================
   AI GENERATED SECTION
===================================================== */

export interface ProjectSection {
  title: string;
  content?: string;
  items?: string[];
}

/* =====================================================
   STUDENT EDUCATION
===================================================== */

import type { StudentEducation } from "@/services/project.api";

export type { StudentEducation } from "@/services/project.api";

/* =====================================================
   PROJECT FORM DATA
===================================================== */

export interface ProjectFormData {
  title: string;

  role: string;

  difficulty: ProjectDifficulty;

  description: string;

  technologies: string[];

  briefUrl: string;

  status: ProjectStatus;

  /* AI / GENERATED DATA */

  pdfUrl?: string;

  /**
   * Optional PDF selected from the user's computer.
   * The parent component uploads this file before saving.
   */
  pdfFile?: File;

  /** Complete PDF data URL used by the parent upload handler. */
  pdfData?: string;

  detailedPdfUrl?: string;

  projectType?: string;

  duration?: string;

  focus?: string;

  requirements?: string[];

  /* STUDENT */

  studentId?: string;

  studentName?: string;

  studentSkills?: string[];

  studentEducation?: StudentEducation;

  /* AI */

  generatedByAI?: boolean;

  /* DYNAMIC PDF STRUCTURE */

  sections?: ProjectSection[];
}

/* =====================================================
   INITIAL DATA
===================================================== */

export interface ProjectFormInitialData {
  title?: string;

  role?: string;

  difficulty?: ProjectDifficulty;

  description?: string;

  technologies?: string[];

  briefUrl?: string;

  status?: ProjectStatus;

  /* AI / PDF */

  pdfUrl?: string;

  detailedPdfUrl?: string;

  projectType?: string;

  duration?: string;

  focus?: string;

  requirements?: string[];

  /* STUDENT */

  studentId?: string;

  studentName?: string;

  studentSkills?: string[];

  studentEducation?: StudentEducation;

  /* AI */

  generatedByAI?: boolean;

  /* DYNAMIC SECTIONS */

  sections?: ProjectSection[];
}

/* =====================================================
   PROPS
===================================================== */

interface ProjectFormProps {
  initialData?: ProjectFormInitialData;

  submitLabel?: string;

  loading?: boolean;

  showStatus?: boolean;

  onSubmit: (
    data: ProjectFormData
  ) => void | Promise<void>;

  onCancel?: () => void;

  onGenerateAI?: () => void;
}

/* =====================================================
   DEFAULT VALUES
===================================================== */

const defaultFormData: ProjectFormData = {
  title: "",
  role: "",
  difficulty: "junior",
  description: "",
  technologies: [],
  briefUrl: "",
  status: "active",
};

/* =====================================================
   HELPERS
===================================================== */

/**
 * Convert any incoming value into a safe string.
 */
function safeString(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

/**
 * Convert an unknown value into a string array.
 *
 * Supports:
 * - ["React", "Node.js"]
 * - "React, Node.js"
 * - undefined
 * - null
 */
function normalizeStringArray(
  value: unknown
): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        safeString(item)
      )
      .filter(Boolean);
  }

  if (
    typeof value === "string"
  ) {
    return value
      .split(",")
      .map((item) =>
        item.trim()
      )
      .filter(Boolean);
  }

  return [];
}

/**
 * Resolve backend PDF paths.
 *
 * Examples:
 *
 * /uploads/projects/project.pdf
 * ->
 * http://localhost:5000/uploads/projects/project.pdf
 *
 * https://example.com/file.pdf
 * ->
 * unchanged
 */
function resolvePdfUrl(
  value?: string | null
): string {
  if (!value) {
    return "";
  }

  const raw = String(value).trim();

  if (!raw) {
    return "";
  }

  /* Already absolute */

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://")
  ) {
    return raw;
  }

  /* Browser generated URLs */

  if (
    raw.startsWith("blob:") ||
    raw.startsWith("data:")
  ) {
    return raw;
  }

  /* Protocol relative URL */

  if (
    raw.startsWith("//")
  ) {
    if (
      typeof window !==
      "undefined"
    ) {
      return `${window.location.protocol}${raw}`;
    }

    return raw;
  }

  /**
   * IMPORTANT:
   *
   * The frontend should normally have:
   *
   * NEXT_PUBLIC_API_URL=http://localhost:5000
   *
   * If it is not present, localhost:5000
   * is used as the development backend.
   */

  const configuredBaseUrl =
    typeof process !==
      "undefined" &&
    process.env
      .NEXT_PUBLIC_API_URL
      ? process.env
          .NEXT_PUBLIC_API_URL
          .trim()
      : "";

  const baseUrl =
    (
      configuredBaseUrl ||
      "http://localhost:5000"
    ).replace(
      /\/+$/,
      ""
    );

  const normalized =
    raw.replace(
      /\\/g,
      "/"
    );

  const path =
    normalized.startsWith("/")
      ? normalized
      : `/${normalized}`;

  return `${baseUrl}${path}`;
}

/**
 * Normalize generated section data.
 */
function normalizeSections(value: unknown): ProjectSection[] {
  if (!Array.isArray(value)) return [];

  const result: ProjectSection[] = [];

  for (const section of value) {
    if (!section || typeof section !== "object") continue;

    const source = section as Record<string, unknown>;
    const title = safeString(source.title);
    const content = safeString(source.content);
    const items = normalizeStringArray(source.items);

    if (!title && !content && items.length === 0) continue;

    result.push({
      title: title || "Project Section",
      content,
      items,
    });
  }

  return result;
}

/* =====================================================
   COMPONENT
===================================================== */

export default function ProjectForm({
  initialData,

  submitLabel =
    "Save Project",

  loading = false,

  showStatus = true,

  onSubmit,

  onCancel,

  onGenerateAI,
}: ProjectFormProps) {
  /* ===================================================
     BASIC FORM STATE
  =================================================== */

  const [
    title,
    setTitle,
  ] = useState(
    defaultFormData.title
  );

  const [
    role,
    setRole,
  ] = useState(
    defaultFormData.role
  );

  const [
    difficulty,
    setDifficulty,
  ] =
    useState<ProjectDifficulty>(
      defaultFormData.difficulty
    );

  const [
    description,
    setDescription,
  ] = useState(
    defaultFormData.description
  );

  const [
    technologies,
    setTechnologies,
  ] = useState("");

  const [
    briefUrl,
    setBriefUrl,
  ] = useState("");

  const [
    status,
    setStatus,
  ] =
    useState<ProjectStatus>(
      defaultFormData.status
    );

  /* ===================================================
     GENERATED / AI DATA
  =================================================== */

  const [
    pdfUrl,
    setPdfUrl,
  ] = useState("");

  const [
    detailedPdfUrl,
    setDetailedPdfUrl,
  ] = useState("");

  /* USER SELECTED PDF */
  const [
    pdfFile,
    setPdfFile,
  ] = useState<File | null>(null);

  const [
    pdfData,
    setPdfData,
  ] = useState<string>("");

  const [
    pdfFilePreviewUrl,
    setPdfFilePreviewUrl,
  ] = useState("");

  const [
    projectType,
    setProjectType,
  ] = useState("");

  const [
    duration,
    setDuration,
  ] = useState("");

  const [
    focus,
    setFocus,
  ] = useState("");

  const [
    requirements,
    setRequirements,
  ] = useState("");

  /* ===================================================
     STUDENT
  =================================================== */

  const [
    studentId,
    setStudentId,
  ] = useState("");

  const [
    studentName,
    setStudentName,
  ] = useState("");

  const [
    studentSkills,
    setStudentSkills,
  ] = useState("");

  const [
    studentEducation,
    setStudentEducation,
  ] =
    useState<StudentEducation>();

  /* ===================================================
     AI
  =================================================== */

  const [
    generatedByAI,
    setGeneratedByAI,
  ] = useState(false);

  /* ===================================================
     DYNAMIC SECTIONS
  =================================================== */

  const [
    sections,
    setSections,
  ] =
    useState<ProjectSection[]>(
      []
    );

  /* ===================================================
     ERROR
  =================================================== */

  const [
    error,
    setError,
  ] = useState("");

  /* ===================================================
     LOAD INITIAL DATA
  =================================================== */

  useEffect(() => {
    /**
     * No initial data means:
     *
     * normal empty Create Project form.
     */

    if (!initialData) {
      setPdfFile(null);
      setPdfData("");
      setTitle("");
      setRole("");
      setDifficulty("junior");
      setDescription("");
      setTechnologies("");
      setBriefUrl("");
      setStatus("active");

      setPdfUrl("");
      setDetailedPdfUrl("");

      setProjectType("");
      setDuration("");
      setFocus("");
      setRequirements("");

      setStudentId("");
      setStudentName("");
      setStudentSkills("");
      setStudentEducation(
        undefined
      );

      setGeneratedByAI(false);

      setSections([]);

      setError("");

      return;
    }

    /* ===============================================
       BASIC PROJECT
    =============================================== */

    setPdfFile(null);
    setPdfData("");

    setTitle(
      safeString(
        initialData.title
      )
    );

    setRole(
      safeString(
        initialData.role
      )
    );

    setDifficulty(
      initialData.difficulty ??
        "junior"
    );

    setDescription(
      safeString(
        initialData.description
      )
    );

    setTechnologies(
      normalizeStringArray(
        initialData.technologies
      ).join(", ")
    );

    setBriefUrl(
      safeString(
        initialData.briefUrl
      )
    );

    setStatus(
      initialData.status ??
        "active"
    );

    /* ===============================================
       PDF
    =============================================== */

    setPdfUrl(
      resolvePdfUrl(
        initialData.pdfUrl
      )
    );

    setDetailedPdfUrl(
      resolvePdfUrl(
        initialData.detailedPdfUrl
      )
    );

    /* ===============================================
       AI DATA
    =============================================== */

    setProjectType(
      safeString(
        initialData.projectType
      )
    );

    setDuration(
      safeString(
        initialData.duration
      )
    );

    /**
     * Focus is expected to be a string,
     * but this is runtime-safe if the AI
     * accidentally returns an array.
     */

    if (
      Array.isArray(
        initialData.focus
      )
    ) {
      setFocus(
        normalizeStringArray(
          initialData.focus
        ).join(", ")
      );
    } else {
      setFocus(
        safeString(
          initialData.focus
        )
      );
    }

    /**
     * Requirements normally arrive as array.
     * Runtime-safe for string as well.
     */

    setRequirements(
      normalizeStringArray(
        initialData.requirements
      ).join(", ")
    );

    /* ===============================================
       STUDENT
    =============================================== */

    setStudentId(
      safeString(
        initialData.studentId
      )
    );

    setStudentName(
      safeString(
        initialData.studentName
      )
    );

    setStudentSkills(
      normalizeStringArray(
        initialData.studentSkills
      ).join(", ")
    );

    setStudentEducation(
      initialData.studentEducation
    );

    /* ===============================================
       AI FLAG
    =============================================== */

    setGeneratedByAI(
      Boolean(
        initialData.generatedByAI
      )
    );

    /* ===============================================
       DYNAMIC PDF SECTIONS
    =============================================== */

    setSections(
      normalizeSections(
        initialData.sections
      )
    );

    setError("");
  }, [
    initialData,
  ]);

  /* ===================================================
     SELECTED PDF PREVIEW
  =================================================== */

  useEffect(() => {
    if (!pdfFile) {
      setPdfFilePreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(pdfFile);
    setPdfFilePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [pdfFile]);

  /* ===================================================
     PDF UPLOAD
  =================================================== */

  const handlePdfChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setError("Only PDF files are allowed.");
      event.target.value = "";
      setPdfFile(null);
      setPdfData("");
      return;
    }

    const MAX_PDF_SIZE = 10 * 1024 * 1024;

    if (file.size > MAX_PDF_SIZE) {
      setError("PDF file size must be 10 MB or less.");
      event.target.value = "";
      setPdfFile(null);
      setPdfData("");
      return;
    }

    setError("");
    setPdfFile(file);
    setPdfData("");

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("Failed to read PDF file.");
        setPdfFile(null);
        setPdfData("");
        return;
      }

      setPdfData(reader.result);
    };

    reader.onerror = () => {
      setError("Failed to read PDF file.");
      setPdfFile(null);
      setPdfData("");
    };

    reader.readAsDataURL(file);
  };

  const handleRemovePdfFile = () => {
    setPdfFile(null);
    setPdfData("");
    setError("");

    const input = document.getElementById(
      "project-pdf-upload"
    ) as HTMLInputElement | null;

    if (input) {
      input.value = "";
    }
  };

  /* ===================================================
     DYNAMIC AI SECTIONS
  =================================================== */

  const updateSection = (
    index: number,
    field: "title" | "content",
    value: string
  ) => {
    setSections((current) =>
      current.map((section, sectionIndex) =>
        sectionIndex === index
          ? { ...section, [field]: value }
          : section
      )
    );
  };

  const updateSectionItems = (
    index: number,
    value: string
  ) => {
    setSections((current) =>
      current.map((section, sectionIndex) =>
        sectionIndex === index
          ? {
              ...section,
              items: normalizeStringArray(value),
            }
          : section
      )
    );
  };

  const addSection = () => {
    setSections((current) => [
      ...current,
      {
        title: "New Section",
        content: "",
        items: [],
      },
    ]);
  };

  const removeSection = (index: number) => {
    setSections((current) =>
      current.filter(
        (_, sectionIndex) => sectionIndex !== index
      )
    );
  };

  /* ===================================================
     SUBMIT
  =================================================== */

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");

    /* ===============================================
       VALIDATION
    =============================================== */

    if (!title.trim()) {
      setError(
        "Project title is required."
      );
      return;
    }

    if (!role.trim()) {
      setError(
        "Project role is required."
      );
      return;
    }

    if (!description.trim()) {
      setError(
        "Project description is required."
      );
      return;
    }

    /* ===============================================
       TECHNOLOGIES
    =============================================== */

    const technologyList =
      normalizeStringArray(
        technologies
      );

    /* ===============================================
       REQUIREMENTS
    =============================================== */

    const requirementList =
      normalizeStringArray(
        requirements
      );

    /* ===============================================
       STUDENT SKILLS
    =============================================== */

    const studentSkillList =
      normalizeStringArray(
        studentSkills
      );

    /* ===============================================
       FORM DATA
    =============================================== */

    const formData: ProjectFormData = {
      /* =========================================
         BASIC
      ========================================= */

      title:
        title.trim(),

      role:
        role.trim(),

      difficulty,

      description:
        description.trim(),

      technologies:
        technologyList,

      briefUrl:
        briefUrl.trim(),

      status,

      /* =========================================
         PDF
      ========================================= */

      pdfUrl:
        pdfUrl.trim() ||
        undefined,

      detailedPdfUrl:
        detailedPdfUrl.trim() ||
        undefined,

      pdfFile:
        pdfFile || undefined,

      pdfData:
        pdfData || undefined,

      /* =========================================
         PROJECT METADATA
      ========================================= */

      projectType:
        projectType.trim() ||
        undefined,

      duration:
        duration.trim() ||
        undefined,

      focus:
        focus.trim() ||
        undefined,

      requirements:
        requirementList,

      /* =========================================
         STUDENT
      ========================================= */

      studentId:
        studentId.trim() ||
        undefined,

      studentName:
        studentName.trim() ||
        undefined,

      studentSkills:
        studentSkillList,

      studentEducation,

      /* =========================================
         AI
      ========================================= */

      generatedByAI,

      /* =========================================
         IMPORTANT:
         KEEP AI PDF STRUCTURE
      ========================================= */

      sections:
        sections.map(
          (section) => ({
            title:
              section.title,

            content:
              section.content,

            items:
              section.items,
          })
        ),
    };

    /* ===============================================
       SEND TO PARENT
    =============================================== */

    try {
      await onSubmit(
        formData
      );
    } catch (err) {
      console.error(
        "Project form submission failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to save project."
      );
    }
  };

  /* ===================================================
     UI
  =================================================== */

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="space-y-5"
    >
      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div
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

      {/* =================================================
          AI GENERATOR
      ================================================= */}

      {onGenerateAI && (
        <button
          type="button"
          onClick={
            onGenerateAI
          }
          disabled={
            loading
          }
          className="
            group
            w-full
            rounded-xl
            border
            border-indigo-200
            bg-gradient-to-r
            from-indigo-50
            to-purple-50
            px-4
            py-3
            text-left
            transition
            hover:border-indigo-300
            hover:from-indigo-100
            hover:to-purple-100
            disabled:cursor-not-allowed
            disabled:opacity-50
            dark:border-indigo-500/20
            dark:from-indigo-500/10
            dark:to-purple-500/10
          "
        >
          <div
            className="
              flex
              items-center
              gap-3
            "
          >
            <div
              className="
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-lg
                bg-indigo-600
                text-lg
                text-white
              "
            >
              ✨
            </div>

            <div
              className="
                min-w-0
                flex-1
              "
            >
              <p
                className="
                  text-sm
                  font-semibold
                  text-indigo-700
                  dark:text-indigo-400
                "
              >
                Generate Project with AI
              </p>

              <p
                className="
                  mt-0.5
                  text-xs
                  text-slate-500
                  dark:text-slate-400
                "
              >
                Let AI create a complete
                project based on your
                requirements.
              </p>
            </div>

            <span
              className="
                text-lg
                text-indigo-400
              "
            >
              →
            </span>
          </div>
        </button>
      )}

      {/* =================================================
          STUDENT
      ================================================= */}

      {(studentName ||
        studentId) && (
        <div
          className="
            rounded-xl
            border
            border-indigo-200
            bg-indigo-50/70
            p-4
            dark:border-indigo-500/20
            dark:bg-indigo-500/10
          "
        >
          <p
            className="
              mb-3
              text-sm
              font-semibold
              text-indigo-700
              dark:text-indigo-300
            "
          >
            Student
          </p>

          {studentName && (
            <div>
              <label
                className="
                  mb-1
                  block
                  text-xs
                  font-medium
                  text-slate-500
                "
              >
                Student Name
              </label>

              <input
                value={
                  studentName
                }
                onChange={(
                  event
                ) =>
                  setStudentName(
                    event.target.value
                  )
                }
                disabled={
                  loading
                }
                className="
                  w-full
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  px-3
                  py-2.5
                  text-sm
                  dark:border-white/10
                  dark:bg-[#10141d]
                  dark:text-white
                "
              />
            </div>
          )}

          {studentId && (
            <p
              className="
                mt-2
                text-xs
                text-slate-500
                dark:text-slate-400
              "
            >
              Student ID:{" "}
              {studentId}
            </p>
          )}
        </div>
      )}

      {/* =================================================
          TITLE
      ================================================= */}

      <div>
        <label
          htmlFor="project-title"
          className="
            mb-1.5
            block
            text-sm
            font-medium
            text-slate-700
            dark:text-slate-300
          "
        >
          Project Title
        </label>

        <input
          id="project-title"
          type="text"
          value={
            title
          }
          onChange={(
            event
          ) =>
            setTitle(
              event.target.value
            )
          }
          placeholder="E-commerce REST API"
          disabled={
            loading
          }
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
            focus:ring-2
            focus:ring-indigo-500/10
            disabled:opacity-60
            dark:border-white/10
            dark:bg-[#10141d]
            dark:text-white
          "
        />
      </div>

      {/* =================================================
          ROLE + DIFFICULTY
      ================================================= */}

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
            htmlFor="project-role"
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
            id="project-role"
            type="text"
            value={
              role
            }
            onChange={(
              event
            ) =>
              setRole(
                event.target.value
              )
            }
            placeholder="Backend Developer"
            disabled={
              loading
            }
            className="
              w-full
              rounded-xl
              border
              border-slate-200
              bg-white
              px-3
              py-2.5
              text-sm
              dark:border-white/10
              dark:bg-[#10141d]
              dark:text-white
            "
          />
        </div>

        <div>
          <label
            htmlFor="project-difficulty"
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

          <select
            id="project-difficulty"
            value={
              difficulty
            }
            onChange={(
              event
            ) =>
              setDifficulty(
                event.target.value as
                  ProjectDifficulty
              )
            }
            disabled={
              loading
            }
            className="
              w-full
              rounded-xl
              border
              border-slate-200
              bg-white
              px-3
              py-2.5
              text-sm
              dark:border-white/10
              dark:bg-[#10141d]
              dark:text-white
            "
          >
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
        </div>
      </div>

      {/* =================================================
          DURATION + PROJECT TYPE
      ================================================= */}

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
            htmlFor="project-duration"
            className="
              mb-1.5
              block
              text-sm
              font-medium
              text-slate-700
              dark:text-slate-300
            "
          >
            Duration
          </label>

          <input
            id="project-duration"
            value={
              duration
            }
            onChange={(
              event
            ) =>
              setDuration(
                event.target.value
              )
            }
            placeholder="14 Days"
            disabled={
              loading
            }
            className="
              w-full
              rounded-xl
              border
              border-slate-200
              bg-white
              px-3
              py-2.5
              text-sm
              dark:border-white/10
              dark:bg-[#10141d]
              dark:text-white
            "
          />
        </div>

        <div>
          <label
            htmlFor="project-type"
            className="
              mb-1.5
              block
              text-sm
              font-medium
              text-slate-700
              dark:text-slate-300
            "
          >
            Project Type
          </label>

          <input
            id="project-type"
            value={
              projectType
            }
            onChange={(
              event
            ) =>
              setProjectType(
                event.target.value
              )
            }
            placeholder="Full Stack"
            disabled={
              loading
            }
            className="
              w-full
              rounded-xl
              border
              border-slate-200
              bg-white
              px-3
              py-2.5
              text-sm
              dark:border-white/10
              dark:bg-[#10141d]
              dark:text-white
            "
          />
        </div>
      </div>

      {/* =================================================
          DESCRIPTION
      ================================================= */}

      <div>
        <label
          htmlFor="project-description"
          className="
            mb-1.5
            block
            text-sm
            font-medium
            text-slate-700
            dark:text-slate-300
          "
        >
          Description
        </label>

        <textarea
          id="project-description"
          value={
            description
          }
          onChange={(
            event
          ) =>
            setDescription(
              event.target.value
            )
          }
          rows={5}
          placeholder="Describe the project requirements..."
          disabled={
            loading
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
            dark:border-white/10
            dark:bg-[#10141d]
            dark:text-white
          "
        />
      </div>

      {/* =================================================
          TECHNOLOGIES
      ================================================= */}

      <div>
        <label
          htmlFor="project-technologies"
          className="
            mb-1.5
            block
            text-sm
            font-medium
            text-slate-700
            dark:text-slate-300
          "
        >
          Technologies
        </label>

        <input
          id="project-technologies"
          type="text"
          value={
            technologies
          }
          onChange={(
            event
          ) =>
            setTechnologies(
              event.target.value
            )
          }
          placeholder="React, Node.js, MongoDB"
          disabled={
            loading
          }
          className="
            w-full
            rounded-xl
            border
            border-slate-200
            bg-white
            px-3
            py-2.5
            text-sm
            dark:border-white/10
            dark:bg-[#10141d]
            dark:text-white
          "
        />

        <p
          className="
            mt-1.5
            text-xs
            text-slate-400
          "
        >
          Separate technologies
          with commas.
        </p>
      </div>

      {/* =================================================
          FOCUS
      ================================================= */}

      <div>
        <label
          htmlFor="project-focus"
          className="
            mb-1.5
            block
            text-sm
            font-medium
            text-slate-700
            dark:text-slate-300
          "
        >
          Focus Areas
        </label>

        <input
          id="project-focus"
          value={
            focus
          }
          onChange={(
            event
          ) =>
            setFocus(
              event.target.value
            )
          }
          placeholder="API Development"
          disabled={
            loading
          }
          className="
            w-full
            rounded-xl
            border
            border-slate-200
            bg-white
            px-3
            py-2.5
            text-sm
            dark:border-white/10
            dark:bg-[#10141d]
            dark:text-white
          "
        />
      </div>

      {/* =================================================
          REQUIREMENTS
      ================================================= */}

      <div>
        <label
          htmlFor="project-requirements"
          className="
            mb-1.5
            block
            text-sm
            font-medium
            text-slate-700
            dark:text-slate-300
          "
        >
          Requirements
        </label>

        <textarea
          id="project-requirements"
          value={
            requirements
          }
          onChange={(
            event
          ) =>
            setRequirements(
              event.target.value
            )
          }
          rows={4}
          placeholder="Use existing skills, add new learning, measurable outcome"
          disabled={
            loading
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
            dark:border-white/10
            dark:bg-[#10141d]
            dark:text-white
          "
        />

        <p
          className="
            mt-1.5
            text-xs
            text-slate-400
          "
        >
          Separate requirements
          with commas.
        </p>
      </div>

      {/* =================================================
          STUDENT SKILLS
      ================================================= */}

      {(studentId ||
        studentName) && (
        <div>
          <label
            htmlFor="student-skills"
            className="
              mb-1.5
              block
              text-sm
              font-medium
              text-slate-700
              dark:text-slate-300
            "
          >
            Student Skills
          </label>

          <input
            id="student-skills"
            value={
              studentSkills
            }
            onChange={(
              event
            ) =>
              setStudentSkills(
                event.target.value
              )
            }
            placeholder="Python, React, MongoDB"
            disabled={
              loading
            }
            className="
              w-full
              rounded-xl
              border
              border-slate-200
              bg-white
              px-3
              py-2.5
              text-sm
              dark:border-white/10
              dark:bg-[#10141d]
              dark:text-white
            "
          />
        </div>
      )}

      {/* =================================================
          PROJECT DOCUMENT / PDF
      ================================================= */}

      <div
        className="
          rounded-xl border border-slate-200 bg-slate-50/70 p-4
          dark:border-white/10 dark:bg-white/[0.03]
        "
      >
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Project Document
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Upload a PDF or use the AI-generated PDF. Maximum file size: 10 MB.
          </p>
        </div>

        {(detailedPdfUrl || pdfUrl) && (
          <div className="mb-4 space-y-2">
            {detailedPdfUrl && (
              <a
                href={detailedPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="
                  flex items-center justify-between rounded-lg border
                  border-indigo-200 bg-white px-3 py-3 text-sm font-medium
                  text-indigo-700 hover:bg-indigo-50
                  dark:border-white/10 dark:bg-[#10141d] dark:text-indigo-300
                "
              >
                <span>📄 Open Generated Detailed PDF</span>
                <span>↗</span>
              </a>
            )}

            {pdfUrl && pdfUrl !== detailedPdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="
                  flex items-center justify-between rounded-lg border
                  border-slate-200 bg-white px-3 py-3 text-sm font-medium
                  text-slate-700 hover:bg-slate-50
                  dark:border-white/10 dark:bg-[#10141d] dark:text-slate-200
                "
              >
                <span>📄 Open Project PDF</span>
                <span>↗</span>
              </a>
            )}
          </div>
        )}

        <label
          htmlFor="project-pdf-upload"
          className="
            flex cursor-pointer flex-col items-center justify-center
            rounded-xl border-2 border-dashed border-slate-300 bg-white
            px-5 py-7 text-center transition hover:border-indigo-400
            hover:bg-indigo-50/40 dark:border-white/10 dark:bg-[#10141d]
            dark:hover:border-indigo-500/50
          "
        >
          <span className="text-3xl">📄</span>
          <span className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {pdfFile ? "Replace Project PDF" : "Upload Project PDF"}
          </span>
          <span className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Click to browse • PDF only • up to 10 MB
          </span>

          <input
            id="project-pdf-upload"
            type="file"
            accept="application/pdf,.pdf"
            onChange={handlePdfChange}
            disabled={loading}
            className="hidden"
          />
        </label>

        {pdfFile && (
          <div
            className="
              mt-3 flex flex-col gap-3 rounded-lg border
              border-emerald-200 bg-emerald-50 p-3
              sm:flex-row sm:items-center sm:justify-between
              dark:border-emerald-500/20 dark:bg-emerald-500/10
            "
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-emerald-800 dark:text-emerald-300">
                ✓ {pdfFile.name}
              </p>
              <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                {(pdfFile.size / 1024 / 1024).toFixed(2)} MB • New PDF selected
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              {pdfFilePreviewUrl && (
                <a
                  href={pdfFilePreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    rounded-lg border border-emerald-300 bg-white px-3 py-2
                    text-xs font-medium text-emerald-700 hover:bg-emerald-50
                    dark:border-emerald-500/30 dark:bg-[#10141d]
                    dark:text-emerald-300
                  "
                >
                  Preview
                </a>
              )}

              <button
                type="button"
                onClick={handleRemovePdfFile}
                disabled={loading}
                className="
                  rounded-lg border border-red-200 bg-white px-3 py-2
                  text-xs font-medium text-red-600 hover:bg-red-50
                  disabled:opacity-50 dark:border-red-500/20
                  dark:bg-[#10141d] dark:text-red-400
                "
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {!pdfFile && !detailedPdfUrl && !pdfUrl && (
          <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
            No project PDF selected yet.
          </p>
        )}
      </div>

      {/* =================================================
          PROJECT CONTENT / AI SECTIONS
      ================================================= */}

      <div
        className="
          rounded-xl border border-slate-200 bg-slate-50/70 p-4
          dark:border-white/10 dark:bg-white/[0.03]
        "
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Project Content
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Edit AI-generated sections before saving. Changes are preserved in the project PDF structure.
            </p>
          </div>

          <button
            type="button"
            onClick={addSection}
            disabled={loading}
            className="
              inline-flex items-center justify-center rounded-lg bg-indigo-600
              px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700
              disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            + Add Section
          </button>
        </div>

        {sections.length === 0 ? (
          <div
            className="
              rounded-lg border border-dashed border-slate-300 bg-white
              px-4 py-8 text-center dark:border-white/10 dark:bg-[#10141d]
            "
          >
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No additional project sections.
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Click “Add Section” to add detailed project content.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sections.map((section, index) => (
              <div
                key={`${section.title}-${index}`}
                className="
                  rounded-xl border border-slate-200 bg-white p-4
                  dark:border-white/10 dark:bg-[#10141d]
                "
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Section {index + 1}
                  </p>

                  <button
                    type="button"
                    onClick={() => removeSection(index)}
                    disabled={loading}
                    className="
                      rounded-lg px-2.5 py-1.5 text-xs font-medium
                      text-red-600 hover:bg-red-50 disabled:opacity-50
                      dark:text-red-400 dark:hover:bg-red-500/10
                    "
                  >
                    Remove
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                      Section Title
                    </label>
                    <input
                      value={section.title}
                      onChange={(event) =>
                        updateSection(index, "title", event.target.value)
                      }
                      disabled={loading}
                      placeholder="Project Overview"
                      className="
                        w-full rounded-xl border border-slate-200 bg-white
                        px-3 py-2.5 text-sm outline-none focus:border-indigo-500
                        focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-60
                        dark:border-white/10 dark:bg-[#10141d] dark:text-white
                      "
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                      Section Content
                    </label>
                    <textarea
                      value={section.content || ""}
                      onChange={(event) =>
                        updateSection(index, "content", event.target.value)
                      }
                      disabled={loading}
                      rows={4}
                      placeholder="Describe this part of the project..."
                      className="
                        w-full resize-none rounded-xl border border-slate-200
                        bg-white px-3 py-2.5 text-sm outline-none
                        focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10
                        disabled:opacity-60 dark:border-white/10
                        dark:bg-[#10141d] dark:text-white
                      "
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                      Section Items
                    </label>
                    <textarea
                      value={(section.items || []).join(", ")}
                      onChange={(event) =>
                        updateSectionItems(index, event.target.value)
                      }
                      disabled={loading}
                      rows={3}
                      placeholder="Requirement 1, Requirement 2, Requirement 3"
                      className="
                        w-full resize-none rounded-xl border border-slate-200
                        bg-white px-3 py-2.5 text-sm outline-none
                        focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10
                        disabled:opacity-60 dark:border-white/10
                        dark:bg-[#10141d] dark:text-white
                      "
                    />
                    <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                      Separate items with commas.
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =================================================
          STATUS
      ================================================= */}

      {showStatus && (
        <div>
          <label
            htmlFor="project-status"
            className="
              mb-1.5
              block
              text-sm
              font-medium
              text-slate-700
              dark:text-slate-300
            "
          >
            Status
          </label>

          <select
            id="project-status"
            value={
              status
            }
            onChange={(
              event
            ) =>
              setStatus(
                event.target.value as
                  ProjectStatus
              )
            }
            disabled={
              loading
            }
            className="
              w-full
              rounded-xl
              border
              border-slate-200
              bg-white
              px-3
              py-2.5
              text-sm
              dark:border-white/10
              dark:bg-[#10141d]
              dark:text-white
            "
          >
            <option value="active">
              Active
            </option>

            <option value="archived">
              Archived
            </option>
          </select>
        </div>
      )}

      {/* =================================================
          STUDENT EDUCATION
      ================================================= */}

      {studentEducation && (
        <div
          className="
            rounded-xl
            border
            border-slate-200
            p-4
            dark:border-white/10
          "
        >
          <p
            className="
              mb-3
              text-sm
              font-semibold
              text-slate-700
              dark:text-slate-200
            "
          >
            Student Education
          </p>

          <div
            className="
              grid
              grid-cols-1
              gap-3
              sm:grid-cols-2
            "
          >
            {studentEducation.degree && (
              <div>
                <p
                  className="
                    text-xs
                    text-slate-400
                  "
                >
                  Degree
                </p>

                <p
                  className="
                    text-sm
                    font-medium
                    text-slate-700
                    dark:text-slate-200
                  "
                >
                  {
                    studentEducation.degree
                  }
                </p>
              </div>
            )}

            {studentEducation.field && (
              <div>
                <p
                  className="
                    text-xs
                    text-slate-400
                  "
                >
                  Field
                </p>

                <p
                  className="
                    text-sm
                    font-medium
                    text-slate-700
                    dark:text-slate-200
                  "
                >
                  {
                    studentEducation.field
                  }
                </p>
              </div>
            )}

            {(studentEducation.college ||
              studentEducation.institution ||
              studentEducation.university) && (
              <div
                className="
                  sm:col-span-2
                "
              >
                <p
                  className="
                    text-xs
                    text-slate-400
                  "
                >
                  Institution
                </p>

                <p
                  className="
                    text-sm
                    font-medium
                    text-slate-700
                    dark:text-slate-200
                  "
                >
                  {String(
                    studentEducation.college ??
                      studentEducation.institution ??
                      studentEducation.university ??
                      ""
                  )}
                </p>
              </div>
            )}

            {Boolean(studentEducation.year) && (
              <div>
                <p
                  className="
                    text-xs
                    text-slate-400
                  "
                >
                  Year
                </p>

                <p
                  className="
                    text-sm
                    font-medium
                    text-slate-700
                    dark:text-slate-200
                  "
                >
                  {String(studentEducation.year ?? "")}
                </p>
              </div>
            )}

            {studentEducation.graduationYear && (
              <div>
                <p
                  className="
                    text-xs
                    text-slate-400
                  "
                >
                  Graduation Year
                </p>

                <p
                  className="
                    text-sm
                    font-medium
                    text-slate-700
                    dark:text-slate-200
                  "
                >
                  {String(studentEducation.graduationYear ?? "")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================
          AI GENERATED INDICATOR
      ================================================= */}

      {generatedByAI && (
        <div
          className="
            flex
            items-center
            gap-2
            rounded-xl
            border
            border-purple-200
            bg-purple-50
            px-4
            py-3
            text-sm
            text-purple-700
            dark:border-purple-500/20
            dark:bg-purple-500/10
            dark:text-purple-300
          "
        >
          <span>
            ✨
          </span>

          <span>
            This project was
            generated with AI.
          </span>
        </div>
      )}

      {/* =================================================
          BUTTONS
      ================================================= */}

      <div
        className="
          flex
          justify-end
          gap-3
          border-t
          border-slate-200
          pt-5
          dark:border-white/10
        "
      >
        {onCancel && (
          <button
            type="button"
            onClick={
              onCancel
            }
            disabled={
              loading
            }
            className="
              rounded-xl
              border
              border-slate-200
              px-4
              py-2.5
              text-sm
              font-medium
              text-slate-700
              hover:bg-slate-50
              disabled:opacity-50
              dark:border-white/10
              dark:text-slate-300
            "
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          disabled={
            loading
          }
          className="
            rounded-xl
            bg-indigo-600
            px-5
            py-2.5
            text-sm
            font-medium
            text-white
            transition
            hover:bg-indigo-700
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          {loading
            ? "Saving..."
            : submitLabel}
        </button>
      </div>
    </form>
  );
}
