import mongoose from "mongoose";
import Project from "./project.model.js";
import Candidate from "../candidate/candidate.model.js";
import { generateStructuredAI } from "../ai/ai.service.js";
import { projectGenerationPrompt } from "../ai/ai.prompt.js";
import { generateProjectPdf } from "./project.pdf.service.js";

/* =========================================================
   HELPERS
   ========================================================= */

const cleanString = (value, fallback = "") =>
  typeof value === "string" ? value.trim() : fallback;

const cleanArray = (value) =>
  Array.isArray(value)
    ? value
        .map((item) => String(item).trim())
        .filter(Boolean)
    : [];

/* =========================================================
   DYNAMIC PROJECT SECTIONS
   ========================================================= */

function cleanDynamicSections(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((section) => {
      if (!section || typeof section !== "object") {
        return null;
      }

      const title = cleanString(
        section.title ??
          section.heading ??
          section.name
      );

      const content = cleanString(
        section.content ??
          section.description ??
          section.text
      );

      const items = cleanArray(
        section.items ??
          section.points ??
          section.bullets
      );

      if (!title && !content && items.length === 0) {
        return null;
      }

      return {
        title: title || "Project Details",
        content,
        items,
      };
    })
    .filter(Boolean);
}

/* =========================================================
   NORMALIZE AI INPUT
   ========================================================= */

function normalizeProjectAIData(data = {}) {
  return {
    role: cleanString(data.role),

    projectType: cleanString(
      data.projectType,
      "fullstack"
    ),

    difficulty: cleanString(
      data.difficulty,
      "junior"
    ),

    duration: cleanString(
      data.duration,
      "2 weeks"
    ),

    technologies: cleanArray(
      data.technologies
    ),

    focus: cleanString(
      data.focus,
      "general"
    ),

    requirements: cleanArray(
      data.requirements
    ),

    generateDetailedPdf:
      data.generateDetailedPdf !== false,

    studentId: data.studentId
      ? String(data.studentId)
      : undefined,

    studentName: cleanString(
      data.studentName
    ),

    studentSkills: cleanArray(
      data.studentSkills
    ),

    studentEducation:
      data.studentEducation ?? null,

    description: cleanString(
      data.description
    ),

    sections: cleanDynamicSections(
      data.sections ??
        data.documentSections ??
        data.pdfSections
    ),
  };
}

/* =========================================================
   NORMALIZE AI RESULT
   ========================================================= */

function normalizeAIResult(result, input) {
  const safeResult =
    result && typeof result === "object"
      ? result
      : {};

  const difficulty = [
    "junior",
    "mid",
    "senior",
  ].includes(safeResult.difficulty)
    ? safeResult.difficulty
    : input.difficulty;

  const technologies =
    cleanArray(
      safeResult.technologies
    ).length
      ? cleanArray(
          safeResult.technologies
        )
      : input.technologies;

  const aiSections =
    cleanDynamicSections(
      safeResult.sections ??
        safeResult.documentSections ??
        safeResult.pdfSections
    );

  return {
    title: cleanString(
      safeResult.title,
      `${input.role} Project`
    ),

    role: cleanString(
      safeResult.role,
      input.role
    ),

    difficulty,

    description: cleanString(
      safeResult.description,
      input.description
    ),

    technologies,

    projectType: cleanString(
      safeResult.projectType,
      input.projectType
    ),

    duration: cleanString(
      safeResult.duration,
      input.duration
    ),

    focus: cleanString(
      safeResult.focus,
      input.focus
    ),

    requirements:
      cleanArray(
        safeResult.requirements
      ).length
        ? cleanArray(
            safeResult.requirements
          )
        : input.requirements,

    objectives: cleanArray(
      safeResult.objectives
    ),

    functionalRequirements:
      cleanArray(
        safeResult.functionalRequirements
      ),

    nonFunctionalRequirements:
      cleanArray(
        safeResult.nonFunctionalRequirements
      ),

    modules: Array.isArray(
      safeResult.modules
    )
      ? safeResult.modules
      : [],

    implementationPlan:
      Array.isArray(
        safeResult.implementationPlan
      )
        ? safeResult.implementationPlan
        : [],

    evaluationCriteria:
      Array.isArray(
        safeResult.evaluationCriteria
      )
        ? safeResult.evaluationCriteria
        : [],

    deliverables: cleanArray(
      safeResult.deliverables
    ),

    suggestedFolderStructure:
      cleanArray(
        safeResult.suggestedFolderStructure
      ),

    apiEndpoints:
      Array.isArray(
        safeResult.apiEndpoints
      )
        ? safeResult.apiEndpoints
        : [],

    databaseDesign:
      Array.isArray(
        safeResult.databaseDesign
      )
        ? safeResult.databaseDesign
        : [],

    testingPlan: cleanArray(
      safeResult.testingPlan
    ),

    studentFit: cleanString(
      safeResult.studentFit
    ),

    sections:
      aiSections.length
        ? aiSections
        : input.sections,
  };
}

/* =========================================================
   VALIDATE STUDENT ID
   ========================================================= */

function ensureValidStudentId(studentId) {
  if (!studentId) {
    return null;
  }

  if (
    !mongoose.Types.ObjectId.isValid(
      studentId
    )
  ) {
    throw new Error(
      "Invalid studentId."
    );
  }

  return new mongoose.Types.ObjectId(
    studentId
  );
}

/* =========================================================
   GET PROJECTS
   ========================================================= */

export async function getProjects(
  filters = {}
) {
  const query = {};

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.role) {
    query.role = filters.role;
  }

  if (filters.difficulty) {
    query.difficulty =
      filters.difficulty;
  }

  if (filters.search?.trim()) {
    const escaped =
      filters.search
        .trim()
        .replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

    const regex = new RegExp(
      escaped,
      "i"
    );

    query.$or = [
      {
        title: regex,
      },
      {
        role: regex,
      },
      {
        description: regex,
      },
    ];
  }

  const projects = await Project.find(
    query
  )
    .sort({
      createdAt: -1,
    })
    .lean();

  /*
   * Candidate-to-project relationship lives on:
   *
   * Candidate.assignedProjectId
   *
   * NOT on Project.
   */

  if (projects.length === 0) {
    return projects;
  }

  const projectIds = projects.map(
    (project) => project._id
  );

  let assignmentCounts = [];

  try {
    assignmentCounts =
      await Candidate.aggregate([
        {
          $match: {
            assignedProjectId: {
              $in: projectIds,
            },
          },
        },

        {
          $group: {
            _id:
              "$assignedProjectId",

            count: {
              $sum: 1,
            },
          },
        },
      ]);
  } catch (error) {
    console.error(
      "Failed to compute assigned candidate counts:",
      error
    );
  }

  const countMap = new Map();

  for (const entry of assignmentCounts) {
    if (!entry?._id) {
      continue;
    }

    countMap.set(
      String(entry._id),
      entry.count
    );
  }

  return projects.map(
    (project) => {
      const count =
        countMap.get(
          String(project._id)
        ) || 0;

      return {
        ...project,

        assigned: count,

        assignedCount: count,
      };
    }
  );
}

/* =========================================================
   GET PROJECT BY ID
   ========================================================= */

export const getProjectById =
  async (projectId) => {
    try {
      console.log(
        "GET PROJECT BY ID - SERVICE"
      );

      console.log(
        "Project ID:",
        projectId
      );

      if (
        !mongoose.Types.ObjectId.isValid(
          projectId
        )
      ) {
        throw new Error(
          "Invalid project ID."
        );
      }

      const project =
        await Project.findById(
          projectId
        ).lean();

      console.log(
        "Project found:",
        project
      );

      return project;
    } catch (error) {
      console.error(
        "Get project by ID service error:",
        error
      );

      throw error;
    }
  };

/* =========================================================
   GET ASSIGNED CANDIDATES FOR PROJECT
   ========================================================= */

export async function getAssignedCandidates(
  projectId
) {
  try {
    console.log(
      "GET ASSIGNED CANDIDATES - PROJECT ID:",
      projectId
    );

    if (
      !mongoose.Types.ObjectId.isValid(
        projectId
      )
    ) {
      throw new Error(
        "Invalid project ID."
      );
    }

    /*
     * IMPORTANT:
     *
     * Assignment is stored on Candidate:
     *
     * candidate.assignedProjectId
     *
     * Therefore we query Candidate,
     * not Project.
     */

    const candidates =
      await Candidate.find({
        assignedProjectId:
          new mongoose.Types.ObjectId(
            projectId
          ),
      })
        .sort({
          createdAt: -1,
        })
        .lean();

    console.log(
      "Assigned candidates found:",
      candidates.length
    );

    return candidates;
  } catch (error) {
    console.error(
      "Get assigned candidates service error:",
      error
    );

    throw error;
  }
}

/* =========================================================
   CREATE PROJECT
   ========================================================= */

export async function createProject(
  data
) {
  return Project.create(data);
}

/* =========================================================
   UPDATE PROJECT
   ========================================================= */

export async function updateProject(
  id,
  updateData
) {
  if (
    !mongoose.Types.ObjectId.isValid(
      id
    )
  ) {
    return null;
  }

  return Project.findByIdAndUpdate(
    id,
    {
      $set: updateData,
    },
    {
      new: true,
      runValidators: true,
    }
  );
}

/* =========================================================
   ARCHIVE PROJECT
   ========================================================= */

export async function archiveProject(
  id
) {
  return updateProject(
    id,
    {
      status: "archived",
    }
  );
}

/* =========================================================
   DELETE PROJECT
   ========================================================= */

export async function deleteProject(
  id
) {
  if (
    !mongoose.Types.ObjectId.isValid(
      id
    )
  ) {
    return null;
  }

  return Project.findByIdAndDelete(
    id
  );
}

/* =========================================================
   PROJECT SCOPE
   ========================================================= */

function getProjectScope(
  durationDays
) {
  const days =
    Number(durationDays) || 1;

  if (days <= 2) {
    return {
      level: "micro",
      modules: 2,
      features: 4,
      phases: 3,
      dynamicSections: 2,
      itemsPerSection: 4,
    };
  }

  if (days <= 5) {
    return {
      level: "small",
      modules: 3,
      features: 6,
      phases: 4,
      dynamicSections: 3,
      itemsPerSection: 5,
    };
  }

  if (days <= 14) {
    return {
      level: "medium",
      modules: 4,
      features: 8,
      phases: 5,
      dynamicSections: 4,
      itemsPerSection: 6,
    };
  }

  if (days <= 30) {
    return {
      level: "large",
      modules: 5,
      features: 10,
      phases: 6,
      dynamicSections: 5,
      itemsPerSection: 7,
    };
  }

  if (days <= 60) {
    return {
      level: "advanced",
      modules: 6,
      features: 12,
      phases: 8,
      dynamicSections: 6,
      itemsPerSection: 8,
    };
  }

  if (days <= 90) {
    return {
      level: "major",
      modules: 7,
      features: 15,
      phases: 10,
      dynamicSections: 7,
      itemsPerSection: 8,
    };
  }

  if (days <= 180) {
    return {
      level: "extended",
      modules: 8,
      features: 18,
      phases: 12,
      dynamicSections: 8,
      itemsPerSection: 8,
    };
  }

  if (days <= 270) {
    return {
      level: "long_term",
      modules: 9,
      features: 22,
      phases: 14,
      dynamicSections: 9,
      itemsPerSection: 8,
    };
  }

  return {
    level: "year_long",
    modules: 10,
    features: 25,
    phases: 18,
    dynamicSections: 10,
    itemsPerSection: 8,
  };
}

/* =========================================================
   PARSE DURATION
   ========================================================= */

function parseDuration(
  duration
) {
  if (duration == null) {
    return 0;
  }

  const value =
    String(duration)
      .trim()
      .toLowerCase();

  // Just a number: "30"
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  // Days
  const dayMatch =
    value.match(
      /(\d+(?:\.\d+)?)\s*days?/
    );

  if (dayMatch) {
    return Number(
      dayMatch[1]
    );
  }

  // Weeks
  const weekMatch =
    value.match(
      /(\d+(?:\.\d+)?)\s*weeks?/
    );

  if (weekMatch) {
    return (
      Number(weekMatch[1]) * 7
    );
  }

  // Months
  const monthMatch =
    value.match(
      /(\d+(?:\.\d+)?)\s*months?/
    );

  if (monthMatch) {
    return (
      Number(monthMatch[1]) * 30
    );
  }

  // Years
  const yearMatch =
    value.match(
      /(\d+(?:\.\d+)?)\s*years?/
    );

  if (yearMatch) {
    return (
      Number(yearMatch[1]) * 365
    );
  }

  throw new Error(
    `Invalid project duration: "${duration}". ` +
      `Use values such as "2 days", "30 days", "6 months", or "1 year".`
  );
}

/* =========================================================
   GENERATE AI PROJECT DRAFT
   ========================================================= */

export async function generateProject(
  data,
  options = {}
) {
  const input =
    normalizeProjectAIData(
      data
    );

  /* =======================================================
     VALIDATION
     ======================================================= */

  if (!input.role) {
    throw new Error(
      "Project role is required."
    );
  }

  if (
    ![
      "junior",
      "mid",
      "senior",
    ].includes(
      input.difficulty
    )
  ) {
    throw new Error(
      "Difficulty must be junior, mid, or senior."
    );
  }

  if (!input.projectType) {
    throw new Error(
      "Project type is required."
    );
  }

  const durationDays =
    parseDuration(
      input.duration
    );

  const scope =
    getProjectScope(
      durationDays
    );

  /* =======================================================
     AI GENERATION
     ======================================================= */

  const aiInput = {
    role: input.role,

    projectType:
      input.projectType,

    difficulty:
      input.difficulty,

    duration:
      input.duration,

    technologies:
      input.technologies,

    focus: input.focus,

    requirements:
      input.requirements,

    description:
      input.description,

    scope,

    outputInstructions: {
      concise: true,

      maxFunctionalRequirements: 6,

      maxNonFunctionalRequirements: 5,

      maxImplementationSteps: 6,

      maxEvaluationCriteria: 6,

      maxDeliverables: 6,

      maxDatabaseEntities: 6,

      maxTestingItems: 6,

      maxDynamicSections:
        scope.dynamicSections,

      maxItemsPerSection:
        scope.itemsPerSection,

      avoidRepeatedContent: true,

      keepEachTextFieldShort: true,
    },

    student: {
      id:
        input.studentId ||
        null,

      name:
        input.studentName ||
        null,

      skills:
        input.studentSkills,

      education:
        input.studentEducation,
    },
  };

  let aiResult;

  try {
    aiResult =
      await generateStructuredAI([
        {
          role: "system",

          content:
            projectGenerationPrompt,
        },

        {
          role: "user",

          content:
            JSON.stringify(
              aiInput,
              null,
              2
            ),
        },
      ]);

    console.log(
      "AI response after generation in project.service.js",
      aiResult
    );
  } catch (error) {
    const message =
      error?.message ||
      "AI project generation failed.";

    console.error(
      "AI project generation failed:",
      error
    );

    throw new Error(
      message
    );
  }

  /* =======================================================
     NORMALIZE AI RESPONSE
     ======================================================= */

  const normalized =
    normalizeAIResult(
      aiResult,
      input
    );

  console.log(
    "After normalization:",
    normalized
  );

  /* =======================================================
     CREATE TEMPORARY DRAFT
     ======================================================= */

  const draft = {
    ...normalized,

    sections:
      normalized.sections || [],

    briefUrl: "",

    pdfUrl: "",

    detailedPdfUrl: "",

    studentId:
      input.studentId
        ? String(
            ensureValidStudentId(
              input.studentId
            )
          )
        : undefined,

    studentName:
      input.studentName ||
      undefined,

    status: "active",
  };

  /* =======================================================
     GENERATE PDF
     ======================================================= */

  if (
    input.generateDetailedPdf
  ) {
    try {
      const pdf =
        await generateProjectPdf(
          draft
        );

      if (!pdf) {
        throw new Error(
          "PDF generation returned no result."
        );
      }

      const relativeUrl =
        pdf.relativeUrl ||
        pdf.url ||
        "";

      if (!relativeUrl) {
        throw new Error(
          "PDF generation returned no URL."
        );
      }

      draft.pdfUrl =
        relativeUrl;

      draft.detailedPdfUrl =
        relativeUrl;
    } catch (pdfError) {
      console.error(
        "Project PDF generation failed:",
        pdfError
      );

      throw new Error(
        `Project was generated but PDF creation failed: ${
          pdfError?.message ||
          "Unknown PDF error."
        }`
      );
    }
  }

  /* =======================================================
     RETURN DRAFT
     ======================================================= */

  return draft;
}

/* =========================================================
   REGENERATE EXISTING PROJECT
   ========================================================= */

export async function regenerateProject(
  id,
  data
) {
  const existing =
    await getProjectById(
      id
    );

  if (!existing) {
    return null;
  }

  const merged = {
    role:
      data.role ??
      existing.role,

    projectType:
      data.projectType ??
      existing.projectType,

    difficulty:
      data.difficulty ??
      existing.difficulty,

    duration:
      data.duration ??
      existing.duration,

    technologies:
      data.technologies ??
      existing.technologies,

    focus:
      data.focus ??
      existing.focus,

    requirements:
      data.requirements ??
      existing.requirements,

    generateDetailedPdf:
      data.generateDetailedPdf !==
      false,

    studentId:
      data.studentId ??
      existing.studentId?.toString(),

    studentName:
      data.studentName ??
      existing.studentName,

    studentSkills:
      data.studentSkills ??
      [],

    studentEducation:
      data.studentEducation ??
      null,

    description:
      data.description ??
      existing.description,

    sections:
      data.sections ??
      existing.sections ??
      [],
  };

  const result =
    await generateProject(
      merged
    );

  /*
   * Update existing MongoDB project.
   */

  const updateData = {
    ...result,
  };

  /*
   * Never replace existing MongoDB _id.
   */

  delete updateData._id;

  const updated =
    await Project.findByIdAndUpdate(
      id,
      {
        $set: updateData,
      },
      {
        new: true,
        runValidators: true,
      }
    ).lean();

  return updated;
}