import mongoose from "mongoose";

// =====================================================
// MODULE SCHEMA
// =====================================================

const moduleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    features: {
      type: [String],
      default: [],
    },
  },
  {
    _id: false,
  }
);

// =====================================================
// IMPLEMENTATION PHASE SCHEMA
// =====================================================

const implementationPhaseSchema = new mongoose.Schema(
  {
    phase: {
      type: String,
      trim: true,
      default: "",
    },

    tasks: {
      type: [String],
      default: [],
    },
  },
  {
    _id: false,
  }
);

// =====================================================
// EVALUATION CRITERIA SCHEMA
// =====================================================

const evaluationSchema = new mongoose.Schema(
  {
    criterion: {
      type: String,
      trim: true,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    weight: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

// =====================================================
// API ENDPOINT SCHEMA
// =====================================================

const apiEndpointSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      trim: true,
      default: "GET",
    },

    path: {
      type: String,
      trim: true,
      default: "",
    },

    purpose: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  }
);

// =====================================================
// DATABASE DESIGN SCHEMA
// =====================================================
//
// IMPORTANT:
// Do not use "collection" as a schema pathname.
// Mongoose reserves "collection" internally.
//
// We use "collectionName" instead.
// =====================================================

const databaseDesignSchema = new mongoose.Schema(
  {
    collectionName: {
      type: String,
      trim: true,
      default: "",
    },

    purpose: {
      type: String,
      trim: true,
      default: "",
    },

    fields: {
      type: [String],
      default: [],
    },
  },
  {
    _id: false,
  }
);

// =====================================================
// PROJECT SCHEMA
// =====================================================

const projectSchema = new mongoose.Schema(
  {
    // ---------------------------------------------------
    // BASIC PROJECT INFORMATION
    // ---------------------------------------------------

    title: {
      type: String,
      required: true,
      trim: true,
    },

    role: {
      type: String,
      required: true,
      trim: true,
    },

    difficulty: {
      type: String,
      enum: ["junior", "mid", "senior"],
      required: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    // ---------------------------------------------------
    // TECHNOLOGIES
    // ---------------------------------------------------

    technologies: {
      type: [String],
      default: [],
    },

    // ---------------------------------------------------
    // PDF / FILE URLS
    // ---------------------------------------------------

    briefUrl: {
      type: String,
      default: "",
      trim: true,
    },

    pdfUrl: {
      type: String,
      default: "",
      trim: true,
    },

    detailedPdfUrl: {
      type: String,
      default: "",
      trim: true,
    },

    // ---------------------------------------------------
    // PROJECT CONFIGURATION
    // ---------------------------------------------------

    projectType: {
      type: String,
      default: "fullstack",
      trim: true,
    },

    duration: {
      type: String,
      default: "",
      trim: true,
    },

    focus: {
      type: String,
      default: "general",
      trim: true,
    },

    requirements: {
      type: [String],
      default: [],
    },

    // ---------------------------------------------------
    // PROJECT DETAILS
    // ---------------------------------------------------

    objectives: {
      type: [String],
      default: [],
    },

    functionalRequirements: {
      type: [String],
      default: [],
    },

    nonFunctionalRequirements: {
      type: [String],
      default: [],
    },

    // ---------------------------------------------------
    // MODULES
    // ---------------------------------------------------

    modules: {
      type: [moduleSchema],
      default: [],
    },

    // ---------------------------------------------------
    // IMPLEMENTATION PLAN
    // ---------------------------------------------------

    implementationPlan: {
      type: [implementationPhaseSchema],
      default: [],
    },

    // ---------------------------------------------------
    // EVALUATION
    // ---------------------------------------------------

    evaluationCriteria: {
      type: [evaluationSchema],
      default: [],
    },

    // ---------------------------------------------------
    // DELIVERABLES
    // ---------------------------------------------------

    deliverables: {
      type: [String],
      default: [],
    },

    // ---------------------------------------------------
    // SUGGESTED FOLDER STRUCTURE
    // ---------------------------------------------------

    suggestedFolderStructure: {
      type: [String],
      default: [],
    },

    // ---------------------------------------------------
    // API ENDPOINTS
    // ---------------------------------------------------

    apiEndpoints: {
      type: [apiEndpointSchema],
      default: [],
    },

    // ---------------------------------------------------
    // DATABASE DESIGN
    // ---------------------------------------------------

    databaseDesign: {
      type: [databaseDesignSchema],
      default: [],
    },

    // ---------------------------------------------------
    // TESTING
    // ---------------------------------------------------

    testingPlan: {
      type: [String],
      default: [],
    },

    // ---------------------------------------------------
    // STUDENT FIT
    // ---------------------------------------------------

    studentFit: {
      type: String,
      default: "",
      trim: true,
    },

    // ---------------------------------------------------
    // STUDENT
    // ---------------------------------------------------

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    studentName: {
      type: String,
      default: "",
      trim: true,
    },

    // ---------------------------------------------------
    // PROJECT STATUS
    // ---------------------------------------------------

    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
    },
  },

  // =====================================================
  // TIMESTAMPS
  // =====================================================

  {
    timestamps: true,
  }
);

// =====================================================
// MODEL
// =====================================================

const Project =
  mongoose.models.Project ||
  mongoose.model("Project", projectSchema);

export default Project;