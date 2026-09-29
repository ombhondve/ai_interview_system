import mongoose from "mongoose";
import Project from "./project.model.js";
import {
  uploadAdminProjectPdf,
  uploadProjectPdfBuffer,
} from "./project.pdf.service.js";

import {
  getProjects as getProjectsService,
  getProjectById as getProjectByIdService,
  getAssignedCandidates as getAssignedCandidatesService,
  createProject as createProjectService,
  updateProject as updateProjectService,
  archiveProject as archiveProjectService,
  deleteProject as deleteProjectService,
  generateProject as generateProjectService,
  regenerateProject as regenerateProjectService,
} from "./project.service.js";

/* =========================================================
   CONSTANTS
   ========================================================= */

const validDifficulties = [
  "junior",
  "mid",
  "senior",
];

const validStatuses = [
  "active",
  "archived",
];

/* =========================================================
   HELPERS
   ========================================================= */

const cleanString = (
  value,
  fallback = ""
) => {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim();
};

const cleanArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
};

/* =========================================================
   GET ALL PROJECTS
   ========================================================= */

export const getProjects = async (
  req,
  res
) => {
  try {
    const projects =
      await getProjectsService(
        req.query
      );

    return res.status(200).json({
      success: true,
      projects,
    });
  } catch (error) {
    console.error(
      "Get projects error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch projects.",
    });
  }
};

/* =========================================================
   GET PROJECT BY ID
   ========================================================= */

export const getProjectById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    console.log(
      "================================"
    );

    console.log(
      "GET PROJECT BY ID"
    );

    console.log(
      "Received ID:",
      id
    );

    const project =
      await getProjectByIdService(
        id
      );

    console.log(
      "Project returned from service:",
      project
    );

    if (!project) {
      console.log(
        "❌ PROJECT NOT FOUND:",
        id
      );

      return res.status(404).json({
        success: false,
        message:
          "Project not found.",
      });
    }

    console.log(
      "✅ PROJECT FOUND:",
      project._id
    );

    return res.status(200).json({
      success: true,
      project,
    });
  } catch (error) {
    console.error(
      "Get project by ID error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch project.",
    });
  }
};

/* =========================================================
   GET ASSIGNED CANDIDATES
   ========================================================= */

export const getAssignedCandidates =
  async (req, res) => {
    try {
      const { id } = req.params;

      console.log(
        "================================"
      );

      console.log(
        "GET ASSIGNED CANDIDATES"
      );

      console.log(
        "Project ID:",
        id
      );

      /* -----------------------------------------
         VALIDATE PROJECT ID
      ----------------------------------------- */

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Project ID is required.",
        });
      }

      /* -----------------------------------------
         GET ASSIGNED CANDIDATES
      ----------------------------------------- */

      const candidates =
        await getAssignedCandidatesService(
          id
        );

      console.log(
        "Assigned candidates found:",
        candidates.length
      );

      /* -----------------------------------------
         RETURN CANDIDATES
      ----------------------------------------- */

      return res.status(200).json({
        success: true,
        candidates,
      });
    } catch (error) {
      console.error(
        "Get assigned candidates error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to fetch assigned candidates.",
      });
    }
  };

/* =========================================================
   CREATE PROJECT
   ========================================================= */

export const createProject = async (
  req,
  res
) => {
  try {
    const body = req.body || {};

    const title = cleanString(
      body.title
    );

    const role = cleanString(
      body.role
    );

    const description =
      cleanString(
        body.description
      );

    /* -----------------------------------------
       VALIDATION
    ----------------------------------------- */

    if (!title) {
      return res.status(400).json({
        success: false,
        message:
          "Project title is required.",
      });
    }

    if (!role) {
      return res.status(400).json({
        success: false,
        message:
          "Project role is required.",
      });
    }

    if (
      !validDifficulties.includes(
        body.difficulty
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Difficulty must be junior, mid, or senior.",
      });
    }

    if (!description) {
      return res.status(400).json({
        success: false,
        message:
          "Project description is required.",
      });
    }

    if (
      body.technologies !==
        undefined &&
      !Array.isArray(
        body.technologies
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Technologies must be an array.",
      });
    }

    if (
      body.requirements !==
        undefined &&
      !Array.isArray(
        body.requirements
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Requirements must be an array.",
      });
    }

    /* -----------------------------------------
       CREATE PROJECT
    ----------------------------------------- */

    /* -----------------------------------------
       UPLOAD GENERATED PDF ONLY AFTER CONFIRM & SAVE
    ----------------------------------------- */

    let pdfUrl = cleanString(body.pdfUrl);
    let detailedPdfUrl = cleanString(body.detailedPdfUrl);

    const pdfData =
      typeof body.pdfData === "string"
        ? body.pdfData.trim()
        : "";

    if (pdfData) {
      try {
        const base64 = pdfData.replace(
          /^data:application\/pdf;base64,/i,
          ""
        );

        const pdfBuffer =
          Buffer.from(base64, "base64");

        const uploadedPdf =
          await uploadProjectPdfBuffer(
            pdfBuffer,
            cleanString(
              body.pdfFilename,
              "project.pdf"
            ),
            title
          );

        pdfUrl = uploadedPdf.secure_url;
        detailedPdfUrl = uploadedPdf.secure_url;
      } catch (pdfError) {
        console.error(
          "Confirmed project PDF upload failed:",
          pdfError
        );

        return res.status(400).json({
          success: false,
          message:
            pdfError?.message ||
            "Failed to save the project PDF.",
        });
      }
    }

    /* -----------------------------------------
       CREATE PROJECT
    ----------------------------------------- */

    const project =
      await createProjectService({
        title,

        role,

        difficulty:
          body.difficulty,

        description,

        technologies:
          cleanArray(
            body.technologies
          ),

        briefUrl:
          cleanString(
            body.briefUrl
          ),

        pdfUrl,

        detailedPdfUrl,

        projectType:
          cleanString(
            body.projectType,
            "fullstack"
          ),

        duration:
          cleanString(
            body.duration
          ),

        focus:
          cleanString(
            body.focus,
            "general"
          ),

        requirements:
          cleanArray(
            body.requirements
          ),

        status:
          body.status ===
          "archived"
            ? "archived"
            : "active",
      });

    return res.status(201).json({
      success: true,

      message:
        "Project created successfully.",

      project,
    });
  } catch (error) {
    console.error(
      "Create project error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error?.message ||
        "Failed to create project.",
    });
  }
};

/* =========================================================
   AI GENERATE PROJECT
   ========================================================= */

export const generateProject = async (
  req,
  res
) => {
  try {
    const body = req.body || {};

    /* -----------------------------------------
       BASIC VALIDATION
    ----------------------------------------- */

    const role = cleanString(
      body.role
    );

    if (!role) {
      return res.status(400).json({
        success: false,
        message:
          "Project role is required.",
      });
    }

    if (!body.projectType) {
      return res.status(400).json({
        success: false,
        message:
          "Project type is required.",
      });
    }

    if (
      !validDifficulties.includes(
        body.difficulty
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Difficulty must be junior, mid, or senior.",
      });
    }

    if (
      body.technologies !==
        undefined &&
      !Array.isArray(
        body.technologies
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Technologies must be an array.",
      });
    }

    if (
      body.requirements !==
        undefined &&
      !Array.isArray(
        body.requirements
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Requirements must be an array.",
      });
    }

    /* -----------------------------------------
       GENERATE AI PROJECT
    ----------------------------------------- */

    const generatedProject =
      await generateProjectService({
        ...body,

        role,

        technologies:
          cleanArray(
            body.technologies
          ),

        requirements:
          cleanArray(
            body.requirements
          ),

        duration:
          cleanString(
            body.duration
          ),

        focus:
          cleanString(
            body.focus,
            "general"
          ),

        description:
          cleanString(
            body.description
          ),

        generateDetailedPdf:
          body.generateDetailedPdf !==
          false,

        pdfFormat:
          body.pdfFormat || "pdf",

        studentId:
          body.studentId
            ? String(
                body.studentId
              )
            : undefined,

        studentName:
          body.studentName
            ? String(
                body.studentName
              ).trim()
            : undefined,

        studentSkills:
          cleanArray(
            body.studentSkills
          ),

        studentEducation:
          body.studentEducation,
      });

    console.log(
      "Generated project:",
      generatedProject
    );

    if (!generatedProject) {
      return res.status(500).json({
        success: false,
        message:
          "AI project generation returned no project.",
      });
    }

    /* -----------------------------------------
       RETURN DRAFT
    ----------------------------------------- */

    return res.status(200).json({
      success: true,

      message:
        "AI project generated successfully. Project is currently a draft preview and has not been saved.",

      project:
        generatedProject,
    });
  } catch (error) {
    console.error(
      "Generate project error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error?.message ||
        "Failed to generate project.",
    });
  }
};

/* =========================================================
   REGENERATE PROJECT
   ========================================================= */

export const regenerateProject =
  async (req, res) => {
    try {
      const projectId =
        req.params.id;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          message:
            "Project ID is required.",
        });
      }

      const project =
        await regenerateProjectService(
          projectId,
          req.body || {}
        );

      if (!project) {
        return res.status(404).json({
          success: false,
          message:
            "Project not found.",
        });
      }

      return res.status(200).json({
        success: true,

        message:
          "Project regenerated successfully.",

        project,
      });
    } catch (error) {
      console.error(
        "Regenerate project error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error?.message ||
          "Failed to regenerate project.",
      });
    }
  };

/* =========================================================
   UPLOAD ADMIN PROJECT PDF
   ========================================================= */

export const uploadAdminPdf = async (req, res) => {
  try {
    const projectId = String(req.params.id || "").trim();
    const { filename, data } = req.body || {};

    if (!projectId) {
      return res.status(400).json({ success: false, message: "Project ID is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: "Invalid project ID." });
    }

    if (typeof data !== "string" || !data.trim()) {
      return res.status(400).json({ success: false, message: "PDF data is required." });
    }

    const base64 = data.replace(/^data:application\/pdf;base64,/i, "").trim();
    const pdfBuffer = Buffer.from(base64, "base64");

    const result = await uploadAdminProjectPdf(
      pdfBuffer,
      typeof filename === "string" ? filename : "admin-project.pdf"
    );

    const project = await updateProjectService(projectId, {
      briefUrl: result.secure_url,
      pdfUrl: result.secure_url,
      detailedPdfUrl: result.secure_url,
    });

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Admin PDF uploaded successfully.",
      url: result.secure_url,
      project,
    });
  } catch (error) {
    console.error("Admin PDF upload error:", error);
    return res.status(400).json({
      success: false,
      message: error?.message || "Failed to upload admin PDF.",
    });
  }
};

/* =========================================================
   UPDATE PROJECT
   ========================================================= */

export const updateProject = async (
  req,
  res
) => {
  try {
    const body = req.body || {};

    const updateData = {};

    /* -----------------------------------------
       TITLE
    ----------------------------------------- */

    if (
      body.title !== undefined
    ) {
      if (
        typeof body.title !==
          "string" ||
        !body.title.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Project title cannot be empty.",
        });
      }

      updateData.title =
        body.title.trim();
    }

    /* -----------------------------------------
       ROLE
    ----------------------------------------- */

    if (
      body.role !== undefined
    ) {
      if (
        typeof body.role !==
          "string" ||
        !body.role.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Project role cannot be empty.",
        });
      }

      updateData.role =
        body.role.trim();
    }

    /* -----------------------------------------
       DIFFICULTY
    ----------------------------------------- */

    if (
      body.difficulty !==
      undefined
    ) {
      if (
        !validDifficulties.includes(
          body.difficulty
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Difficulty must be junior, mid, or senior.",
        });
      }

      updateData.difficulty =
        body.difficulty;
    }

    /* -----------------------------------------
       DESCRIPTION
    ----------------------------------------- */

    if (
      body.description !==
      undefined
    ) {
      updateData.description =
        cleanString(
          body.description
        );
    }

    /* -----------------------------------------
       TECHNOLOGIES
    ----------------------------------------- */

    if (
      body.technologies !==
      undefined
    ) {
      if (
        !Array.isArray(
          body.technologies
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Technologies must be an array.",
        });
      }

      updateData.technologies =
        cleanArray(
          body.technologies
        );
    }

    /* -----------------------------------------
       PDF / BRIEF URL
    ----------------------------------------- */

    if (
      body.briefUrl !== undefined
    ) {
      updateData.briefUrl =
        cleanString(
          body.briefUrl
        );
    }

    if (
      body.pdfUrl !== undefined
    ) {
      updateData.pdfUrl =
        cleanString(
          body.pdfUrl
        );
    }

    if (
      body.detailedPdfUrl !==
      undefined
    ) {
      updateData.detailedPdfUrl =
        cleanString(
          body.detailedPdfUrl
        );
    }

    /* -----------------------------------------
       PROJECT METADATA
    ----------------------------------------- */

    if (
      body.projectType !==
      undefined
    ) {
      updateData.projectType =
        cleanString(
          body.projectType
        );
    }

    if (
      body.duration !==
      undefined
    ) {
      updateData.duration =
        cleanString(
          body.duration
        );
    }

    if (
      body.focus !== undefined
    ) {
      updateData.focus =
        cleanString(
          body.focus
        );
    }

    /* -----------------------------------------
       REQUIREMENTS
    ----------------------------------------- */

    if (
      body.requirements !==
      undefined
    ) {
      if (
        !Array.isArray(
          body.requirements
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Requirements must be an array.",
        });
      }

      updateData.requirements =
        cleanArray(
          body.requirements
        );
    }

    /* -----------------------------------------
       STATUS
    ----------------------------------------- */

    if (
      body.status !== undefined
    ) {
      if (
        !validStatuses.includes(
          body.status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Status must be active or archived.",
        });
      }

      updateData.status =
        body.status;
    }

    /* -----------------------------------------
       UPDATE
    ----------------------------------------- */

    const project =
      await updateProjectService(
        req.params.id,
        updateData
      );

    if (!project) {
      return res.status(404).json({
        success: false,
        message:
          "Project not found.",
      });
    }

    return res.status(200).json({
      success: true,

      message:
        "Project updated successfully.",

      project,
    });
  } catch (error) {
    console.error(
      "Update project error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error?.message ||
        "Failed to update project.",
    });
  }
};

/* =========================================================
   ARCHIVE PROJECT
   ========================================================= */

export const archiveProject =
  async (req, res) => {
    try {
      const project =
        await archiveProjectService(
          req.params.id
        );

      if (!project) {
        return res.status(404).json({
          success: false,
          message:
            "Project not found.",
        });
      }

      return res.status(200).json({
        success: true,

        message:
          "Project archived successfully.",

        project,
      });
    } catch (error) {
      console.error(
        "Archive project error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to archive project.",
      });
    }
  };

/* =========================================================
   DELETE PROJECT
   ========================================================= */

export const deleteProject =
  async (req, res) => {
    try {
      const project =
        await deleteProjectService(
          req.params.id
        );

      if (!project) {
        return res.status(404).json({
          success: false,
          message:
            "Project not found.",
        });
      }

      return res.status(200).json({
        success: true,

        message:
          "Project deleted successfully.",

        project,
      });
    } catch (error) {
      console.error(
        "Delete project error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to delete project.",
      });
    }
  };