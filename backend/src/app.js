import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import candidateRoutes from "./modules/candidate/candidate.routes.js";
import projectRoutes from "./modules/projects/project.route.js";
import whatsappWebhook from "./modules/whatsapp/whatsapp.webhook.js";
import aiRoutes from "./modules/ai/ai.routes.js";
import studentRoutes from "./modules/student/student.routes.js";
import verificationRoutes from "./modules/verification/verification.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import cookieParser from "./middleware/cookieParser.middleware.js";
const app = express();

// =====================================================
// DIRECTORY CONFIGURATION
// =====================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================================
// CORS CONFIGURATION
// =====================================================

// Frontend URLs allowed to call this backend.
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

console.log("Allowed CORS origins:", allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header.
      // Examples: Postman, server-to-server requests.
      if (!origin) {
        return callback(null, true);
      }

      // Allow configured frontend origins.
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("CORS blocked origin:", origin);

      return callback(
        new Error("Not allowed by CORS")
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

// =====================================================
// REQUEST LOGGER
// =====================================================

app.use((req, res, next) => {
  console.log(
    `${req.method} ${req.originalUrl}`
  );

  if (req.headers.origin) {
    console.log(
      "Origin:",
      req.headers.origin
    );
  }

  next();
});

// =====================================================
// BODY PARSER
// =====================================================

app.use(
  express.json({
    limit: "10mb",
  })
);
app.use(cookieParser);
// =====================================================
// STATIC UPLOADS
// =====================================================
//
// Physical folder:
//
// backend/
// └── uploads/
//     ├── projects/
//     ├── recordings/
//     └── resumes/
//
// URL:
//
// http://localhost:5000/uploads/...
// =====================================================

app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "../uploads")
  )
);

// =====================================================
// ROOT
// =====================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message:
      "RecruitAI backend is running",
  });
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
  "/api/health",
  (req, res) => {
    res.status(200).json({
      success: true,
      message:
        "RecruitAI backend is running",
      timestamp:
        new Date().toISOString(),
    });
  }
);

// =====================================================
// WHATSAPP
// =====================================================

app.use(
  "/api/whatsapp",
  whatsappWebhook
);

// =====================================================
// AI
// =====================================================

app.use(
  "/api/ai",
  aiRoutes
);

// =====================================================
// CANDIDATES
// =====================================================

app.use(
  "/api/candidates",
  candidateRoutes
);

// =====================================================
// PROJECTS
// =====================================================

app.use(
  "/api/projects",
  projectRoutes
);

// =====================================================
// STUDENTS
// =====================================================

app.use(
  "/api/student",
  studentRoutes
);

// =====================================================
// VERIFICATION
// =====================================================

app.use(
  "/api/verification",
  verificationRoutes
);

// =====================================================
// AUTHENTICATION
// =====================================================

app.use(
  "/api/auth",
  authRoutes
);

// =====================================================
// 404 HANDLER
// =====================================================

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,
      message:
        "API endpoint not found",
      path: req.originalUrl,
    });
  }
);

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================

app.use(
  (err, req, res, next) => {
    console.error(
      "Backend error:",
      err
    );

    // -------------------------------------------------
    // CORS ERROR
    // -------------------------------------------------

    if (
      err.message ===
      "Not allowed by CORS"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "CORS policy blocked this request.",
      });
    }

    // -------------------------------------------------
    // GENERAL ERROR
    // -------------------------------------------------

    return res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV ===
        "production"
          ? "Internal server error"
          : err.message ||
            "Internal server error",
    });
  }
);

export default app;