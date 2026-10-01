import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import passport from "passport";

import candidateRoutes from "./modules/candidate/candidate.routes.js";
import projectRoutes from "./modules/projects/project.route.js";
import whatsappWebhook from "./modules/whatsapp/whatsapp.webhook.js";
import aiRoutes from "./modules/ai/ai.routes.js";
import studentRoutes from "./modules/student/student.routes.js";
import verificationRoutes from "./modules/verification/verification.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import calendarRoutes from "./modules/calendar/calendar.routes.js";
import cookieParser from "./middleware/cookieParser.middleware.js";
import { initializeGoogleOAuth } from "./config/googleOAuth.js";
import connectDatabase from "./config/database.js";

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
  "https://ai-interview-system-eewl.vercel.app", // Backend URL itself
  "https://ai-interview-system-dqc9.vercel.app", // Your frontend deployment
  // Vercel preview and production domains
  /\.vercel\.app$/,
  /\.vercel\.dev$/,
  /localhost:\d+$/,
].filter(Boolean);

console.log("Allowed CORS origins:", allowedOrigins);

// Use cors package with proper configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://ai-interview-system-dqc9.vercel.app',
      'https://ai-interview-system-eewl.vercel.app',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cookie', 'Set-Cookie'],
  exposedHeaders: ['Set-Cookie', 'Authorization'],
  maxAge: 86400,
  optionsSuccessStatus: 204
}));

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
    limit: "15mb",
  })
);
app.use(cookieParser);

// =====================================================
// PASSPORT / SESSION INITIALIZATION
// =====================================================

// Session configuration
app.use(
  session({
    secret: process.env.JWT_SECRET || "your-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
  })
);

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Initialize Google OAuth
initializeGoogleOAuth();
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
  async (req, res) => {
    // Add CORS headers for health check
    const allowedOrigins = [
      'https://ai-interview-system-dqc9.vercel.app',
      'https://ai-interview-system-eewl.vercel.app',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    // Try to check database connection but don't fail if it's down
    let dbStatus = 'unknown';
    try {
      const mongoose = await import('mongoose');
      dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    } catch (error) {
      dbStatus = 'error';
    }
    
    res.status(200).json({
      success: true,
      message: "RecruitAI backend is running",
      timestamp: new Date().toISOString(),
      database: dbStatus,
      environment: process.env.NODE_ENV || 'development'
    });
  }
);

// =====================================================
// DATABASE CONNECTION MIDDLEWARE
// =====================================================

app.use(async (req, res, next) => {
  try {
    // Ensure database is connected before handling API routes
    // Skip for health check and static files
    if (req.path === '/api/health' || req.path === '/' || req.path.startsWith('/uploads/')) {
      return next();
    }
    
    await connectDatabase();
    next();
  } catch (error) {
    console.error('Database connection error in middleware:', error.message);
    
    // Add CORS headers even for database errors
    const allowedOrigins = [
      'https://ai-interview-system-dqc9.vercel.app',
      'https://ai-interview-system-eewl.vercel.app',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

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
// SCHEDULING / SLOTS
// =====================================================

import slotRoutes from "./modules/scheduling/slot.routes.js";
import enhancedSlotRoutes from "./modules/scheduling/enhancedSlot.routes.js";
import enhancedBookingRoutes from "./modules/interview/enhancedBooking.routes.js";

app.use(
  "/api",
  slotRoutes
);

app.use(
  "/api",
  enhancedSlotRoutes
);

app.use(
  "/api/interviews",
  enhancedBookingRoutes
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
// CALENDAR INTEGRATION
// =====================================================

app.use(
  "/api/calendar",
  calendarRoutes
);

// =====================================================
// 404 HANDLER
// =====================================================

app.use(
  (req, res) => {
    // Add CORS headers to 404 responses
    const allowedOrigins = [
      'https://ai-interview-system-dqc9.vercel.app',
      'https://ai-interview-system-eewl.vercel.app',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

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
      // Add CORS headers to CORS error responses too
      const allowedOrigins = [
        'https://ai-interview-system-dqc9.vercel.app',
        'https://ai-interview-system-eewl.vercel.app',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
      ];
      
      const origin = req.headers.origin;
      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      return res.status(403).json({
        success: false,
        message:
          "CORS policy blocked this request.",
      });
    }

    // -------------------------------------------------
    // GENERAL ERROR
    // -------------------------------------------------

    // Add CORS headers to error responses
    const allowedOrigins = [
      'https://ai-interview-system-dqc9.vercel.app',
      'https://ai-interview-system-eewl.vercel.app',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

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