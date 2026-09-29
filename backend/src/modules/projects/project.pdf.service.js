import crypto from "node:crypto";
import PDFDocument from "pdfkit";
import cloudinary from "../../config/cloudinary.js";

/* ============================================================
   CLOUDINARY
============================================================ */

const CLOUDINARY_FOLDER = "recruitai/projects";

function getCloudinaryUploadOptions(filename, title) {
  return {
    resource_type: "raw",
    type: "upload",
    folder: CLOUDINARY_FOLDER,

    // Keep the Cloudinary public ID extension-fr
    public_id: filename.replace(/\.pdf$/i, ""),
    format: "pdf",

    overwrite: true,
    use_filename: false,
    unique_filename: false,

    context: {
      title: String(title || "AI Generated Project"),
    },
  };
}

/**
 * Stream PDFKit output directly to Cloudinary.
 * No permanent PDF is written to the deployment filesystem.
 */
function uploadPdfToCloudinary(doc, filename, title) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const resolveOnce = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    try {
      const uploadStream = cloudinary.uploader.upload_stream(
        getCloudinaryUploadOptions(filename, title),
        (error, result) => {
          if (error) {
            rejectOnce(error);
            return;
          }

          if (!result?.secure_url) {
            rejectOnce(
              new Error("Cloudinary did not return a secure PDF URL.")
            );
            return;
          }

          resolveOnce(result);
        }
      );

      uploadStream.once("error", rejectOnce);

      // PDFKit -> Cloudinary
      doc.pipe(uploadStream);
      doc.end();
    } catch (error) {
      rejectOnce(error);
    }
  });
}

/**
 * Upload a completed project PDF buffer to Cloudinary.
 * This is intentionally called only from the confirmed-save flow.
 */
export async function uploadProjectPdfBuffer(
  pdfBuffer,
  filename = "project.pdf",
  title = "AI Generated Project"
) {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new Error("Project PDF buffer is empty.");
  }

  if (pdfBuffer.length > 10 * 1024 * 1024) {
    throw new Error("Project PDF must be 10 MB or smaller.");
  }

  const signature = pdfBuffer.subarray(0, 5).toString("ascii");
  if (signature !== "%PDF-") {
    throw new Error("Only valid PDF files can be uploaded.");
  }

  const safeBase = String(filename || "project.pdf")
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120) || "project";

  const publicId = "project-" + crypto.randomUUID() + "-" + safeBase;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        type: "upload",
        folder: CLOUDINARY_FOLDER,
        public_id: publicId,
        format: "pdf",
        overwrite: false,
        use_filename: false,
        unique_filename: false,
        context: {
          title: String(title || "AI Generated Project"),
        },
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result?.secure_url) {
          reject(new Error("Cloudinary did not return a secure project PDF URL."));
          return;
        }

        resolve(result);
      }
    );

    uploadStream.once("error", reject);
    uploadStream.end(pdfBuffer);
  });
}

/* ============================================================
   ADMIN-UPLOADED PDF
============================================================ */

const ADMIN_PDF_FOLDER = "recruitai/admin-pdfs";

/**
 * Upload an administrator-supplied PDF buffer directly to Cloudinary.
 * No PDF is written to the backend filesystem.
 */
export async function uploadAdminProjectPdf(pdfBuffer, filename = "admin-project.pdf") {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new Error("Admin PDF buffer is empty.");
  }

  if (pdfBuffer.length > 10 * 1024 * 1024) {
    throw new Error("Admin PDF must be 10 MB or smaller.");
  }

  const signature = pdfBuffer.subarray(0, 5).toString("ascii");
  if (signature !== "%PDF-") {
    throw new Error("Only valid PDF files can be uploaded.");
  }

  const safeBase = String(filename || "admin-project.pdf")
    .replace(/\\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120) || "admin-project";

  const publicId = "admin-" + crypto.randomUUID() + "-" + safeBase;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        type: "upload",
        folder: ADMIN_PDF_FOLDER,
        public_id: publicId,
        format: "pdf",
        overwrite: false,
        use_filename: false,
        unique_filename: false,
        context: { source: "admin-upload" },
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result?.secure_url) {
          reject(new Error("Cloudinary did not return an admin PDF URL."));
          return;
        }

        resolve(result);
      }
    );

    uploadStream.once("error", reject);
    uploadStream.end(pdfBuffer);
  });
}

/* ============================================================
   PAGE
============================================================ */

const PAGE = Object.freeze({
  width: 595.28,
  height: 841.89,
  margin: 42,
  headerHeight: 35,
  footerHeight: 25,
});

const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const CONTENT_TOP = PAGE.margin + PAGE.headerHeight;
const CONTENT_BOTTOM = PAGE.height - PAGE.margin - PAGE.footerHeight;

/* ============================================================
   COLORS
============================================================ */

const COLORS = Object.freeze({
  navy: "#172033",
  blue: "#2563EB",
  blueDark: "#1D4ED8",
  blueSoft: "#EFF6FF",

  purple: "#7C3AED",
  purpleSoft: "#F5F3FF",

  green: "#059669",
  greenSoft: "#ECFDF5",

  cyan: "#0891B2",
  cyanSoft: "#ECFEFF",

  amber: "#D97706",
  amberSoft: "#FFFBEB",

  red: "#DC2626",
  redSoft: "#FEF2F2",

  ink: "#111827",
  text: "#374151",
  muted: "#6B7280",

  line: "#E5E7EB",
  panel: "#F8FAFC",
  white: "#FFFFFF",
});

/* ============================================================
   PDFKIT STANDARD FONTS ONLY
============================================================ */

const FONT = Object.freeze({
  regular: "Helvetica",
  bold: "Helvetica-Bold",
  italic: "Helvetica-Oblique",
  mono: "Courier",
  monoBold: "Courier-Bold",
});

function setFont(doc, type = "regular") {
  const font = FONT[type] || FONT.regular;
  try {
    doc.font(font);
  } catch (error) {
    console.warn(`Font "${font}" failed. Falling back to Helvetica.`, error?.message || error);
    doc.font("Helvetica");
  }
  return doc;
}

/* ============================================================
   FIELDS THAT MUST NEVER APPEAR IN PDF
============================================================ */

const HIDDEN_PDF_KEYS = new Set([
  "role",
  "difficulty",
  "focus",
  "studentId",
  "studentID",
  "student_id",
  "status",
]);

/* ============================================================
   INTERNAL FIELDS
============================================================ */

const INTERNAL_KEYS = new Set([
  "_id",
  "__v",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "pdfUrl",
  "pdfPath",
  "pdfFilename",
  "pdfFileName",
  "absolutePath",
  "relativeUrl",
  "filename",
  "token",
  "tokenHash",
  "revokedAt",
  "usedAt",
]);

/* ============================================================
   KNOWN PROJECT FIELDS  (already rendered by a dedicated
   section, so renderRemainingFields skips them)
============================================================ */

const KNOWN_FIELDS = new Set([
  "title", "projectTitle",
  "studentName", "candidateName", "candidate", "student",
  "description", "overview", "summary", "projectDescription", "problemStatement",
  "projectType", "type",
  "duration", "estimatedDuration",
  "technologies", "technologyStack", "techStack", "skills", "tools", "frameworks",
  "objectives", "goals", "keyObjectives",
  "functionalRequirements", "functional", "requirements",
  "nonFunctionalRequirements", "nonFunctional", "qualityRequirements",
  "modules", "features", "components",
  "architecture", "systemArchitecture", "architectureDiagram",
  "phases", "roadmap", "implementationPlan", "milestones",
  "apis", "apiEndpoints", "endpoints", "apiReference",
  "database", "databaseDesign", "collections", "tables", "models",
  "testing", "testingStrategy", "testPlan", "qualityAssurance",
  "evaluation", "evaluationCriteria", "assessmentCriteria", "gradingCriteria",
  "deliverables", "expectedDeliverables", "outputs",
  "studentFit", "candidateFit", "fitAnalysis", "studentCompatibility",
  "repositoryUrl", "githubUrl", "gitlabUrl", "demoUrl", "documentationUrl",
  "sections", "projectSpecificSections", "documentSections", "pdfSections",
]);

/* ============================================================
   BASIC HELPERS
============================================================ */

function toText(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

/*
 * Removes ASCII control characters (U+0000-U+0008, U+000B, U+000C,
 * U+000E-U+001F, U+007F) that otherwise show up as stray glyphs
 * in the rendered PDF text.
 */
function cleanText(value) {
  return toText(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\u00AD/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function cleanOneLine(value) {
  return cleanText(value).replace(/\s+/g, " ").trim();
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return cleanOneLine(value).length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (isObject(value)) return Object.keys(value).length === 0;
  return false;
}

function isHiddenKey(key) {
  return HIDDEN_PDF_KEYS.has(String(key || "").trim());
}

function isInternalKey(key) {
  return INTERNAL_KEYS.has(String(key || "").trim());
}

function humanizeKey(key) {
  return cleanOneLine(key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function truncate(value, maxLength = 200) {
  const result = cleanOneLine(value);
  if (result.length <= maxLength) return result;
  return result.slice(0, maxLength - 1).trim() + "…";
}

function objectToText(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return cleanOneLine(value);
  }

  if (Array.isArray(value)) {
    return value.map(objectToText).filter(Boolean).join(", ");
  }

  if (isObject(value)) {
    return Object.entries(value)
      .filter(([key]) => !isHiddenKey(key) && !isInternalKey(key))
      .map(([key, item]) => {
        const valueText = objectToText(item);
        return valueText ? `${humanizeKey(key)}: ${valueText}` : "";
      })
      .filter(Boolean)
      .join(" | ");
  }

  return "";
}

function isUrl(value) {
  return /^https?:\/\/\S+$/i.test(cleanOneLine(value));
}

/* ============================================================
   RENDER STATE
============================================================ */

function createState() {
  return { page: 1 };
}

function startPage(doc) {
  doc.addPage();
}

/* ============================================================
   PAGE CHROME
============================================================ */

function drawPageChrome(doc, state) {
  // Header/footer are drawn at absolute positions; the main
  // content cursor (doc.x / doc.y) is restored afterwards so
  // chrome never disturbs body-text flow.
  const previousX = doc.x;
  const previousY = doc.y;

  doc.save();

  doc.strokeColor(COLORS.line).lineWidth(0.6)
    .moveTo(PAGE.margin, 27).lineTo(PAGE.width - PAGE.margin, 27).stroke();

  setFont(doc, "bold");
  doc.fontSize(7).fillColor(COLORS.muted)
    .text("RECRUITAI • PROJECT SPECIFICATION", PAGE.margin, 12, {
      width: CONTENT_WIDTH, align: "left", lineBreak: false,
    });

  setFont(doc, "regular");
  doc.fontSize(7).fillColor(COLORS.muted)
    .text(`PAGE ${state.page}`, PAGE.margin, 12, {
      width: CONTENT_WIDTH, align: "right", lineBreak: false,
    });

  doc.strokeColor(COLORS.line).lineWidth(0.6)
    .moveTo(PAGE.margin, PAGE.height - 25)
    .lineTo(PAGE.width - PAGE.margin, PAGE.height - 25).stroke();

  setFont(doc, "regular");
  doc.fontSize(7).fillColor(COLORS.muted)
    .text("Generated by RecruitAI", PAGE.margin, PAGE.height - 18, {
      width: CONTENT_WIDTH, align: "left", lineBreak: false,
    });

  doc.restore();

  doc.x = previousX;
  doc.y = previousY;
}

/* ============================================================
   PAGE SPACE HELPERS
============================================================ */

function hasSpace(doc, requiredHeight = 40) {
  return doc.y + requiredHeight <= CONTENT_BOTTOM;
}

function ensureSpace(doc, state, height = 40) {
  if (hasSpace(doc, height)) return;

  // If we're already at the top of a fresh page, a single block taller
  // than one page would otherwise trigger an endless blank-page loop.
  const atTop = doc.y <= CONTENT_TOP + 1;
  if (atTop) return;

  startPage(doc);
}

function ensureSectionSpace(doc, state, height = 100) {
  if (doc.y > CONTENT_TOP + 1 && !hasSpace(doc, height)) {
    startPage(doc);
  }
}

/* ============================================================
   SECTION HELPERS
============================================================ */

/**
 * @param subtitleOrOptions either a plain subtitle string, or an
 *   options object: { color, background, subtitle }
 */
function sectionTitle(doc, state, title, subtitleOrOptions = {}) {
  const value = cleanOneLine(title);
  if (!value) return;

  const options = typeof subtitleOrOptions === "string"
    ? { subtitle: subtitleOrOptions }
    : (subtitleOrOptions || {});

  const color = options.color || COLORS.blue;
  const background = options.background || COLORS.blueSoft;
  const subtitle = cleanOneLine(options.subtitle || "");

  const height = subtitle ? 44 : 30;

  ensureSectionSpace(doc, state, height + 35);

  const x = PAGE.margin;
  const y = doc.y;

  doc.roundedRect(x, y, CONTENT_WIDTH, height, 7).fill(background);
  doc.rect(x, y, 4, height).fill(color);

  setFont(doc, "bold");
  doc.fontSize(13).fillColor(COLORS.navy)
    .text(value, x + 14, y + 8, { width: CONTENT_WIDTH - 28, lineBreak: false });

  if (subtitle) {
    setFont(doc, "regular");
    doc.fontSize(8).fillColor(COLORS.muted)
      .text(subtitle, x + 14, y + 25, { width: CONTENT_WIDTH - 28, lineBreak: false });
  }

  doc.y = y + height + 12;
}

function subheading(doc, state, title) {
  const value = cleanOneLine(title);
  if (!value) return;

  ensureSpace(doc, state, 35);

  setFont(doc, "bold");
  doc.fontSize(10.5).fillColor(COLORS.ink)
    .text(value, PAGE.margin, doc.y, { width: CONTENT_WIDTH });

  doc.moveDown(0.2);
}

function paragraph(doc, state, value, options = {}) {
  const text = cleanText(value);
  if (!text) return;

  ensureSpace(doc, state, options.minHeight || 35);

  setFont(doc, options.bold ? "bold" : "regular");
  doc.fontSize(options.fontSize || 9.5).fillColor(options.color || COLORS.text)
    .text(text, PAGE.margin, doc.y, {
      width: CONTENT_WIDTH,
      align: options.align || "left",
      lineGap: options.lineGap || 2,
    });

  doc.moveDown(options.spacing || 0.45);
}

function bullet(doc, state, value, options = {}) {
  const text = cleanOneLine(value);
  if (!text) return;

  ensureSpace(doc, state, 28);

  const bulletX = PAGE.margin;
  const textX = PAGE.margin + 14;
  const bulletY = doc.y + 4;

  doc.circle(bulletX + 3, bulletY, 2.2).fill(options.color || COLORS.blue);

  setFont(doc, "regular");
  doc.fontSize(options.fontSize || 9.2).fillColor(COLORS.text)
    .text(text, textX, doc.y, { width: CONTENT_WIDTH - 14, lineGap: 1.5 });

  doc.moveDown(options.spacing || 0.2);
}

function bullets(doc, state, values, options = {}) {
  const items = safeArray(values).map(objectToText).filter(Boolean);
  for (const item of items) {
    bullet(doc, state, item, options);
  }
  doc.moveDown(0.2);
}

/* ============================================================
   CARD / PILL PRIMITIVES
============================================================ */

function drawCard(doc, x, y, width, height, options = {}) {
  const fill = options.fill || COLORS.white;
  const stroke = options.stroke || COLORS.line;
  const radius = options.radius || 8;

  doc.save();
  doc.roundedRect(x, y, width, height, radius).fillColor(fill).fill();
  doc.roundedRect(x, y, width, height, radius).lineWidth(0.7).strokeColor(stroke).stroke();
  doc.restore();
}

function drawPill(doc, value, x, y, options = {}) {
  const label = cleanOneLine(value);
  if (!label) return 0;

  const fontSize = options.fontSize || 7.5;
  const padding = options.padding || 8;
  const height = options.height || 20;

  setFont(doc, "bold");
  doc.fontSize(fontSize);
  const width = doc.widthOfString(label) + padding * 2;

  doc.save();
  doc.roundedRect(x, y, width, height, height / 2).fillColor(options.fill || COLORS.blueSoft).fill();

  setFont(doc, "bold");
  doc.fontSize(fontSize).fillColor(options.color || COLORS.blueDark)
    .text(label, x + padding, y + (height - fontSize) / 2 - 1, {
      width: width - padding * 2, lineBreak: false,
    });

  doc.restore();
  return width;
}

/* ============================================================
   SAFE VALUE EXTRACTION
============================================================ */

function firstValue(source, keys) {
  for (const key of keys) {
    if (isHiddenKey(key) || isInternalKey(key)) continue;
    const value = source?.[key];
    if (!isEmpty(value)) {
      const result = objectToText(value);
      if (result) return result;
    }
  }
  return "";
}

/* ============================================================
   PROJECT DATA
============================================================ */

function projectTitle(project) {
  return (
    cleanOneLine(project?.title) ||
    cleanOneLine(project?.projectTitle) ||
    "AI Generated Project"
  );
}

function candidateName(project) {
  return (
    cleanOneLine(project?.studentName) ||
    cleanOneLine(project?.candidateName) ||
    cleanOneLine(project?.candidate?.name) ||
    cleanOneLine(project?.student?.name) ||
    ""
  );
}

function technologies(project) {
  const sources = [
    project?.technologies,
    project?.technologyStack,
    project?.techStack,
    project?.skills,
    project?.tools,
    project?.frameworks,
  ];

  for (const source of sources) {
    if (Array.isArray(source)) {
      const values = source.map(objectToText).filter(Boolean);
      if (values.length) return [...new Set(values)];
    }
    if (typeof source === "string") {
      const values = source.split(/[,|]/).map(cleanOneLine).filter(Boolean);
      if (values.length) return [...new Set(values)];
    }
  }

  return [];
}

/* ============================================================
   COVER
============================================================ */

function renderCover(doc, state, project) {
  const title = projectTitle(project);
  const candidate = candidateName(project);
  const duration = firstValue(project, ["duration", "estimatedDuration"]);
  const tech = technologies(project);

  doc.fillColor(COLORS.blue).rect(0, 0, PAGE.width, 8).fill();

  setFont(doc, "bold");
  doc.fontSize(11).fillColor(COLORS.blue).text("RECRUITAI", PAGE.margin, 58);

  setFont(doc, "regular");
  doc.fontSize(7.5).fillColor(COLORS.muted)
    .text("PROJECT SPECIFICATION & IMPLEMENTATION BLUEPRINT", PAGE.margin, 76);

  drawCard(doc, PAGE.margin, 125, CONTENT_WIDTH, 205, {
    fill: COLORS.navy, stroke: COLORS.navy, radius: 16,
  });

  setFont(doc, "bold");
  doc.fontSize(25).fillColor(COLORS.white)
    .text(title, PAGE.margin + 28, 158, { width: CONTENT_WIDTH - 56, lineGap: 3 });

  setFont(doc, "regular");
  doc.fontSize(9.2).fillColor("#CBD5E1")
    .text("Detailed project brief generated from the project record.", PAGE.margin + 28, 245, {
      width: CONTENT_WIDTH - 56, lineGap: 2,
    });

  // Candidate / Duration. Role, difficulty, focus, student ID and
  // status intentionally never appear anywhere in this document.
  let y = 365;

  const info = [["CANDIDATE", candidate], ["DURATION", duration]].filter(([, value]) => value);

  for (const [label, value] of info) {
    drawCard(doc, PAGE.margin, y, CONTENT_WIDTH, 48, { fill: COLORS.panel });

    setFont(doc, "bold");
    doc.fontSize(7).fillColor(COLORS.muted).text(label, PAGE.margin + 14, y + 9);

    setFont(doc, "bold");
    doc.fontSize(10).fillColor(COLORS.ink)
      .text(truncate(value, 100), PAGE.margin + 14, y + 23, {
        width: CONTENT_WIDTH - 28, lineBreak: false,
      });

    y += 58;
  }

  if (tech.length) {
    setFont(doc, "bold");
    doc.fontSize(7).fillColor(COLORS.muted).text("TECHNOLOGY STACK", PAGE.margin, y + 5);

    y += 22;
    let x = PAGE.margin;
    let rowY = y;

    for (const item of tech.slice(0, 18)) {
      const label = cleanOneLine(item);
      if (!label) continue;

      setFont(doc, "bold");
      doc.fontSize(7.5);
      const width = doc.widthOfString(label) + 16;

      if (x !== PAGE.margin && x + width > PAGE.width - PAGE.margin) {
        x = PAGE.margin;
        rowY += 27;
      }

      drawPill(doc, label, x, rowY, { fill: COLORS.blueSoft, color: COLORS.blueDark });
      x += width + 6;
    }
  }

  setFont(doc, "regular");
  doc.fontSize(7).fillColor(COLORS.muted)
    .text(`Generated ${new Date().toLocaleDateString("en-IN")}`, PAGE.margin, PAGE.height - 45);
}

/* ============================================================
   OVERVIEW
============================================================ */

function renderOverview(doc, state, project) {
  sectionTitle(doc, state, "Project Overview", "Summary of the problem, purpose and expected outcome.");

  const summary = firstValue(project, [
    "description", "overview", "summary", "projectDescription", "problemStatement",
  ]);

  if (summary) {
    ensureSectionSpace(doc, state, 125);
    const y = doc.y;

    drawCard(doc, PAGE.margin, y, CONTENT_WIDTH, 105, { fill: COLORS.panel });

    setFont(doc, "bold");
    doc.fontSize(7.5).fillColor(COLORS.blue).text("PROJECT SUMMARY", PAGE.margin + 14, y + 12);

    setFont(doc, "regular");
    doc.fontSize(8.8).fillColor(COLORS.text)
      .text(truncate(summary, 950), PAGE.margin + 14, y + 30, {
        width: CONTENT_WIDTH - 28, height: 65, lineGap: 2,
      });

    doc.y = y + 120;
  }

  // Only useful metadata. No Role / Difficulty / Focus / Student ID / Status.
  const metadata = [
    ["CANDIDATE", candidateName(project)],
    ["TYPE", firstValue(project, ["projectType", "type"])],
    ["DURATION", firstValue(project, ["duration", "estimatedDuration"])],
  ].filter(([, value]) => value);

  if (metadata.length) {
    ensureSectionSpace(doc, state, 100);

    const gap = 10;
    const cardWidth = (CONTENT_WIDTH - gap * (metadata.length - 1)) / metadata.length;
    const startY = doc.y;

    metadata.forEach(([label, value], index) => {
      const x = PAGE.margin + index * (cardWidth + gap);

      drawCard(doc, x, startY, cardWidth, 70, { fill: COLORS.white });

      setFont(doc, "bold");
      doc.fontSize(7).fillColor(COLORS.muted)
        .text(label, x + 12, startY + 11, { width: cardWidth - 24, lineBreak: false });

      setFont(doc, "bold");
      doc.fontSize(9.5).fillColor(COLORS.ink)
        .text(truncate(value, 80), x + 12, startY + 30, { width: cardWidth - 24, height: 30 });
    });

    doc.y = startY + 88;
  }

  const objectives = firstValue(project, ["objectives", "goals", "keyObjectives"]);

  if (objectives) {
    subheading(doc, state, "Primary Objectives");

    if (Array.isArray(project?.objectives)) {
      bullets(doc, state, project.objectives);
    } else {
      paragraph(doc, state, objectives);
    }
  }
}

/* ============================================================
   CANDIDATE DETAILS
============================================================ */

function renderCandidate(doc, state, project) {
  const candidateObj = project?.candidate || project?.student;
  const name = candidateName(project);

  if (!name && !isObject(candidateObj)) return;

  sectionTitle(doc, state, "Candidate Details");

  if (name) {
    ensureSpace(doc, state, 35);

    setFont(doc, "bold");
    doc.fontSize(8).fillColor(COLORS.muted).text("NAME", PAGE.margin, doc.y);

    setFont(doc, "bold");
    doc.fontSize(10).fillColor(COLORS.ink).text(name, PAGE.margin, doc.y + 12);

    doc.y += 30;
  }

  if (isObject(candidateObj)) {
    for (const [key, value] of Object.entries(candidateObj)) {
      if (key === "name" || isHiddenKey(key) || isInternalKey(key) || isEmpty(value)) continue;

      const valueText = objectToText(value);
      if (!valueText) continue;

      ensureSpace(doc, state, 32);

      setFont(doc, "bold");
      doc.fontSize(7.5).fillColor(COLORS.muted).text(humanizeKey(key), PAGE.margin, doc.y);

      setFont(doc, "regular");
      doc.fontSize(8.5).fillColor(COLORS.text)
        .text(truncate(valueText, 250), PAGE.margin, doc.y + 11, { width: CONTENT_WIDTH });

      doc.y += 31;
    }
  }
}

/* ============================================================
   TECHNOLOGY STACK
============================================================ */

function renderTechnologyStack(doc, state, project) {
  const tech = technologies(project);
  if (!tech.length) return;

  sectionTitle(doc, state, "Technology Stack", "Technologies, frameworks and tools expected for implementation.");
  ensureSectionSpace(doc, state, 90);

  const columns = 3;
  const gap = 10;
  const cardWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
  const cardHeight = 62;

  for (let index = 0; index < tech.length; index++) {
    const column = index % columns;

    if (column === 0) {
      ensureSectionSpace(doc, state, cardHeight + 15);
    }

    const x = PAGE.margin + column * (cardWidth + gap);
    const y = doc.y;

    drawCard(doc, x, y, cardWidth, cardHeight, { fill: COLORS.panel });

    setFont(doc, "bold");
    doc.fontSize(10).fillColor(COLORS.blueDark)
      .text(truncate(tech[index], 42), x + 12, y + 13, { width: cardWidth - 24, lineBreak: false });

    setFont(doc, "regular");
    doc.fontSize(7.5).fillColor(COLORS.muted)
      .text("Technology / Tool", x + 12, y + 34, { width: cardWidth - 24, lineBreak: false });

    if (column === columns - 1 || index === tech.length - 1) {
      doc.y = y + cardHeight + 12;
    }
  }
}

/* ============================================================
   FUNCTIONAL / NON-FUNCTIONAL REQUIREMENTS
   (one generic renderer used for both, parameterized by
   title + accent color, instead of two near-duplicate functions)
============================================================ */

function renderRequirements(doc, state, title, value, accentColor = COLORS.blue, backgroundColor = COLORS.blueSoft) {
  if (isEmpty(value)) return;

  sectionTitle(doc, state, title, { color: accentColor, background: backgroundColor });

  if (Array.isArray(value)) {
    bullets(doc, state, value);
    return;
  }

  if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (isHiddenKey(key) || isInternalKey(key)) continue;

      const text = objectToText(item);
      if (!text) continue;

      subheading(doc, state, humanizeKey(key));

      if (Array.isArray(item)) {
        bullets(doc, state, item);
      } else {
        paragraph(doc, state, text);
      }
    }
    return;
  }

  paragraph(doc, state, value);
}

/* ============================================================
   MODULES / FEATURES
============================================================ */

function renderModules(doc, state, project) {
  const value = project?.modules ?? project?.features ?? project?.components;
  if (isEmpty(value)) return;

  sectionTitle(doc, state, "Modules & Features", "Major functional areas that make up the project.");

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const title = isObject(item)
        ? firstValue(item, ["name", "title", "module", "feature"])
        : "";

      const body = isObject(item)
        ? firstValue(item, ["description", "details", "summary", "purpose"])
        : objectToText(item);

      if (!title && !body) return;

      subheading(doc, state, title || `Module ${index + 1}`);

      if (body) {
        paragraph(doc, state, body);
      }

      if (isObject(item)) {
        const features = item.features ?? item.requirements ?? item.tasks;
        if (Array.isArray(features)) {
          bullets(doc, state, features);
        }
      }
    });
    return;
  }

  if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (isHiddenKey(key) || isInternalKey(key)) continue;

      subheading(doc, state, humanizeKey(key));

      if (Array.isArray(item)) {
        bullets(doc, state, item);
      } else {
        paragraph(doc, state, item);
      }
    }
    return;
  }

  paragraph(doc, state, value);
}

/* ============================================================
   ARCHITECTURE
============================================================ */

function renderArchitecture(doc, state, project) {
  const architecture = project?.architecture || project?.systemArchitecture || project?.architectureDiagram;
  if (isEmpty(architecture)) return;

  sectionTitle(doc, state, "System Architecture", "High-level application structure.");

  let overviewText = "";
  let layers = [];

  if (typeof architecture === "string") {
    overviewText = cleanText(architecture);
  } else if (isObject(architecture)) {
    overviewText = objectToText(architecture.description ?? architecture.overview ?? "");
    layers = safeArray(architecture.layers || architecture.components || architecture.tiers);
  }

  if (overviewText) {
    paragraph(doc, state, overviewText);
  }

  if (!layers.length) {
    layers = [
      { name: "Presentation Layer", description: "Frontend user interface and interaction." },
      { name: "API Layer", description: "Routes, validation and authentication." },
      { name: "Business Layer", description: "Application services and business logic." },
      { name: "Data Layer", description: "Database and persistent storage." },
    ];
  }

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const object = isObject(layer) ? layer : {};

    const name = objectToText(object.name ?? object.title ?? object.layer ?? `Layer ${i + 1}`);
    const layerDescription = objectToText(
      object.description ?? object.responsibility ?? object.details ?? layer
    );

    const height = 54;
    ensureSpace(doc, state, height + 18);
    const y = doc.y;

    drawCard(doc, PAGE.margin + 30, y, CONTENT_WIDTH - 60, height, {
      fill: i % 2 === 0 ? COLORS.blueSoft : COLORS.panel,
    });

    setFont(doc, "bold");
    doc.fontSize(9).fillColor(COLORS.ink)
      .text(name, PAGE.margin + 44, y + 10, { width: CONTENT_WIDTH - 88 });

    setFont(doc, "regular");
    doc.fontSize(7.8).fillColor(COLORS.text)
      .text(truncate(layerDescription, 240), PAGE.margin + 44, y + 27, { width: CONTENT_WIDTH - 88 });

    doc.y = y + height;

    if (i < layers.length - 1) {
      doc.strokeColor(COLORS.blue).lineWidth(1)
        .moveTo(PAGE.width / 2, doc.y).lineTo(PAGE.width / 2, doc.y + 10).stroke();

      doc.fillColor(COLORS.blue)        .moveTo(PAGE.width / 2 - 4, doc.y + 6)
        .lineTo(PAGE.width / 2 + 4, doc.y + 6)
        .lineTo(PAGE.width / 2, doc.y + 11)
        .closePath().fill();

      doc.y += 16;
    }
  }

  doc.y += 5;
}

/* ============================================================
   ROADMAP
============================================================ */

function renderRoadmap(doc, state, project) {
  const roadmap = project?.phases || project?.roadmap || project?.implementationPlan || project?.milestones;
  if (isEmpty(roadmap)) return;

  sectionTitle(doc, state, "Implementation Roadmap", "Recommended phases and milestones for completing the project.");

  const items = Array.isArray(roadmap)
    ? roadmap
    : isObject(roadmap)
      ? Object.entries(roadmap).map(([key, value]) => ({ name: humanizeKey(key), description: value }))
      : [];

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const object = isObject(item) ? item : {};

    const name = objectToText(
      object.name ?? object.title ?? object.phase ?? object.milestone ?? `Phase ${index + 1}`
    );

    const description = objectToText(
      object.description ?? object.details ?? object.summary ?? object.tasks ?? item
    );

    const duration = objectToText(object.duration ?? object.time ?? object.estimatedTime ?? "");

    const tasks = safeArray(object.tasks ?? object.activities ?? object.steps ?? []).slice(0, 5);

    const height = 70 + Math.min(tasks.length, 5) * 14;

    ensureSpace(doc, state, height + 12);
    const y = doc.y;

    drawCard(doc, PAGE.margin, y, CONTENT_WIDTH, height, { fill: COLORS.white });

    doc.circle(PAGE.margin + 27, y + 25, 14).fill(COLORS.blue);

    setFont(doc, "bold");
    doc.fontSize(8).fillColor(COLORS.white)
      .text(String(index + 1), PAGE.margin + 22, y + 21, { width: 10, align: "center", lineBreak: false });

    setFont(doc, "bold");
    doc.fontSize(10).fillColor(COLORS.ink)
      .text(truncate(name, 100), PAGE.margin + 52, y + 12, { width: CONTENT_WIDTH - 70 });

    if (duration) {
      drawPill(doc, duration, PAGE.width - PAGE.margin - 90, y + 10, {
        fill: COLORS.blueSoft, color: COLORS.blueDark, height: 18, fontSize: 6.5,
      });
    }

    if (description) {
      setFont(doc, "regular");
      doc.fontSize(8).fillColor(COLORS.text)
        .text(truncate(description, 330), PAGE.margin + 52, y + 32, {
          width: CONTENT_WIDTH - 70, lineGap: 1.2,
        });
    }

    if (tasks.length) {
      let taskY = y + height - tasks.length * 14 - 8;

      for (const task of tasks) {
        const text = objectToText(task);
        if (!text) continue;

        doc.circle(PAGE.margin + 58, taskY + 4, 1.5).fill(COLORS.blue);

        setFont(doc, "regular");
        doc.fontSize(7.5).fillColor(COLORS.text)
          .text(truncate(text, 100), PAGE.margin + 67, taskY, {
            width: CONTENT_WIDTH - 85, lineBreak: false,
          });

        taskY += 14;
      }
    }

    doc.y = y + height + 10;
  }
}

/* ============================================================
   API DESIGN
============================================================ */

function renderApi(doc, state, project) {
  const apis = project?.apis || project?.apiEndpoints || project?.endpoints || project?.apiReference;
  if (isEmpty(apis)) return;

  sectionTitle(doc, state, "API Design", "Key API endpoints and expected responsibilities.");

  const items = Array.isArray(apis)
    ? apis
    : isObject(apis)
      ? Object.entries(apis).map(([key, value]) => ({ endpoint: key, description: value }))
      : [];

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const object = isObject(item) ? item : {};

    const method = cleanOneLine(object.method ?? object.httpMethod ?? "").toUpperCase();

    const endpoint = cleanOneLine(
      object.endpoint ?? object.path ?? object.url ?? object.route ?? ""
    );

    const description = objectToText(object.description ?? object.purpose ?? object.details ?? "");
    const request = objectToText(object.request ?? object.input ?? object.parameters ?? "");
    const response = objectToText(object.response ?? object.output ?? "");
    const fallback = objectToText(item);
    const finalEndpoint = endpoint || fallback || `Endpoint ${index + 1}`;

    ensureSpace(doc, state, 95);
    const y = doc.y;
    const height = 88;

    drawCard(doc, PAGE.margin, y, CONTENT_WIDTH, height, { fill: COLORS.panel });

    if (method) {
      let methodFill = COLORS.blueSoft;
      let methodColor = COLORS.blueDark;

      if (method === "POST") { methodFill = COLORS.greenSoft; methodColor = COLORS.green; }
      if (method === "PUT" || method === "PATCH") { methodFill = COLORS.amberSoft; methodColor = COLORS.amber; }
      if (method === "DELETE") { methodFill = COLORS.redSoft; methodColor = COLORS.red; }

      drawPill(doc, method, PAGE.margin + 13, y + 11, {
        fill: methodFill, color: methodColor, height: 19, fontSize: 6.5,
      });
    }

    setFont(doc, "monoBold");
    doc.fontSize(8).fillColor(COLORS.ink)
      .text(truncate(finalEndpoint, 95), PAGE.margin + 70, y + 14, {
        width: CONTENT_WIDTH - 84, lineBreak: false,
      });

    if (description) {
      setFont(doc, "regular");
      doc.fontSize(7.8).fillColor(COLORS.text)
        .text(truncate(description, 260), PAGE.margin + 13, y + 36, {
          width: CONTENT_WIDTH - 26, lineGap: 1.2,
        });
    }

    const metaY = y + 64;

    if (request) {
      setFont(doc, "bold");
      doc.fontSize(6.8).fillColor(COLORS.muted)
        .text(`REQUEST: ${truncate(request, 80)}`, PAGE.margin + 13, metaY, {
          width: CONTENT_WIDTH / 2 - 18, lineBreak: false,
        });
    }

    if (response) {
      setFont(doc, "bold");
      doc.fontSize(6.8).fillColor(COLORS.muted)
        .text(`RESPONSE: ${truncate(response, 80)}`, PAGE.margin + CONTENT_WIDTH / 2, metaY, {
          width: CONTENT_WIDTH / 2 - 13, lineBreak: false,
        });
    }

    doc.y = y + height + 10;
  }
}

/* ============================================================
   DATABASE DESIGN
============================================================ */

function renderDatabase(doc, state, project) {
  const database = project?.database || project?.databaseDesign || project?.collections
    || project?.tables || project?.models;

  if (isEmpty(database)) return;

  sectionTitle(doc, state, "Database Design", "Recommended data structures and persistence model.");

  if (typeof database === "string") {
    paragraph(doc, state, database);
    return;
  }

  if (Array.isArray(database)) {
    for (let index = 0; index < database.length; index++) {
      const item = database[index];
      const object = isObject(item) ? item : {};

      const name = objectToText(
        object.name ?? object.title ?? object.collection ?? object.table ?? object.model ?? `Entity ${index + 1}`
      );

      const description = objectToText(object.description ?? object.purpose ?? "");
      const fields = safeArray(object.fields ?? object.columns ?? object.attributes ?? []);
      const height = 75 + Math.min(fields.length, 5) * 13;

      ensureSpace(doc, state, height + 10);
      const y = doc.y;

      drawCard(doc, PAGE.margin, y, CONTENT_WIDTH, height, { fill: COLORS.white });

      setFont(doc, "bold");
      doc.fontSize(10).fillColor(COLORS.ink)
        .text(name, PAGE.margin + 14, y + 12, { width: CONTENT_WIDTH - 28 });

      if (description) {
        setFont(doc, "regular");
        doc.fontSize(7.8).fillColor(COLORS.text)
          .text(truncate(description, 260), PAGE.margin + 14, y + 31, { width: CONTENT_WIDTH - 28 });
      }

      if (fields.length) {
        let fieldY = y + height - Math.min(fields.length, 5) * 13 - 9;

        for (const field of fields.slice(0, 5)) {
          const fieldText = objectToText(field);
          if (!fieldText) continue;

          doc.fillColor(COLORS.blue).circle(PAGE.margin + 20, fieldY + 4, 1.5).fill();

          setFont(doc, "regular");
          doc.fontSize(7.3).fillColor(COLORS.text)
            .text(truncate(fieldText, 110), PAGE.margin + 28, fieldY, {
              width: CONTENT_WIDTH - 42, lineBreak: false,
            });

          fieldY += 13;
        }
      }

      doc.y = y + height + 10;
    }
    return;
  }

  if (isObject(database)) {
    for (const [key, value] of Object.entries(database)) {
      if (isHiddenKey(key) || isInternalKey(key) || isEmpty(value)) continue;

      subheading(doc, state, humanizeKey(key));

      if (Array.isArray(value)) {
        bullets(doc, state, value);
      } else {
        paragraph(doc, state, value);
      }
    }
  }
}

/* ============================================================
   TESTING STRATEGY
============================================================ */

function renderTesting(doc, state, project) {
  const testing = project?.testing || project?.testingStrategy || project?.testPlan || project?.qualityAssurance;
  if (isEmpty(testing)) return;

  sectionTitle(doc, state, "Testing Strategy", "Approach for validating correctness, reliability and user experience.");

  if (typeof testing === "string") {
    paragraph(doc, state, testing);
    return;
  }

  if (Array.isArray(testing)) {
    bullets(doc, state, testing);
    return;
  }

  if (isObject(testing)) {
    for (const [key, value] of Object.entries(testing)) {
      if (isHiddenKey(key) || isInternalKey(key) || isEmpty(value)) continue;

      subheading(doc, state, humanizeKey(key));

      if (Array.isArray(value)) {
        bullets(doc, state, value);
      } else {
        paragraph(doc, state, value);
      }
    }
  }
}

/* ============================================================
   EVALUATION CRITERIA
============================================================ */

function renderEvaluation(doc, state, project) {
  const evaluation = project?.evaluation || project?.evaluationCriteria
    || project?.assessmentCriteria || project?.gradingCriteria;

  if (isEmpty(evaluation)) return;

  sectionTitle(doc, state, "Evaluation Criteria", "Criteria that can be used to assess the completed project.");

  if (Array.isArray(evaluation)) {
    bullets(doc, state, evaluation);
    return;
  }

  if (isObject(evaluation)) {
    for (const [key, value] of Object.entries(evaluation)) {
      if (isHiddenKey(key) || isInternalKey(key) || isEmpty(value)) continue;

      subheading(doc, state, humanizeKey(key));

      if (Array.isArray(value)) {
        bullets(doc, state, value);
      } else {
        paragraph(doc, state, value);
      }
    }
    return;
  }

  paragraph(doc, state, evaluation);
}

/* ============================================================
   DELIVERABLES
============================================================ */

function renderDeliverables(doc, state, project) {
  const deliverables = project?.deliverables || project?.expectedDeliverables || project?.outputs;
  if (isEmpty(deliverables)) return;

  sectionTitle(doc, state, "Expected Deliverables", "Artifacts and outcomes expected at project completion.");

  if (Array.isArray(deliverables)) {
    bullets(doc, state, deliverables);
    return;
  }

  if (isObject(deliverables)) {
    for (const [key, value] of Object.entries(deliverables)) {
      if (isHiddenKey(key) || isInternalKey(key) || isEmpty(value)) continue;

      subheading(doc, state, humanizeKey(key));

      if (Array.isArray(value)) {
        bullets(doc, state, value);
      } else {
        paragraph(doc, state, value);
      }
    }
    return;
  }

  paragraph(doc, state, deliverables);
}

/* ============================================================
   STUDENT / CANDIDATE FIT
============================================================ */

function renderStudentFit(doc, state, project) {
  const fit = project?.studentFit || project?.candidateFit || project?.fitAnalysis || project?.studentCompatibility;
  if (isEmpty(fit)) return;

  sectionTitle(
    doc, state, "Candidate Alignment",
    "Project requirements compared with the candidate information available in the project record."
  );

  // Never expose internal IDs, status, role, difficulty or focus.
  if (typeof fit === "string") {
    paragraph(doc, state, fit);
    return;
  }

  if (Array.isArray(fit)) {
    bullets(doc, state, fit);
    return;
  }

  if (isObject(fit)) {
    for (const [key, value] of Object.entries(fit)) {
      if (isHiddenKey(key) || isInternalKey(key) || isEmpty(value)) continue;

      subheading(doc, state, humanizeKey(key));

      if (Array.isArray(value)) {
        bullets(doc, state, value);
      } else {
        paragraph(doc, state, objectToText(value));
      }
    }
  }
}

/* ============================================================
   PROJECT LINKS
============================================================ */

function renderLinks(doc, state, project) {
  const links = [
    ["Repository", project?.repositoryUrl || project?.githubUrl || project?.gitlabUrl],
    ["Live Demo", project?.demoUrl],
    ["Documentation", project?.documentationUrl],
  ].filter(([, value]) => isUrl(value));

  if (!links.length) return;

  sectionTitle(doc, state, "Project Links", "Useful external resources associated with the project.");

  for (const [label, url] of links) {
    ensureSpace(doc, state, 30);

    setFont(doc, "bold");
    doc.fontSize(8).fillColor(COLORS.muted)
      .text(`${label}:`, PAGE.margin, doc.y, { width: 90, continued: true });

    setFont(doc, "regular");
    doc.fontSize(8).fillColor(COLORS.blue)
      .text(cleanOneLine(url), { link: cleanOneLine(url), underline: true });

    doc.moveDown(0.35);
  }
}

/* ============================================================
   DYNAMIC / CUSTOM SECTIONS
============================================================ */

function getDynamicSections(project) {
  const result = [];
  const sources = ["sections", "projectSpecificSections", "documentSections", "pdfSections"];

  for (const key of sources) {
    const value = project?.[key];

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          result.push({ title: humanizeKey(key), content: item });
          continue;
        }

        if (isObject(item)) {
          const title = cleanOneLine(item.title || item.name || item.heading || "Project Details");
          const content = item.content ?? item.description ?? item.details ?? item.body ?? item.items ?? item.data;

          if (!isEmpty(content)) {
            result.push({ title, content });
          }
        }
      }
    }

    if (isObject(value)) {
      for (const [name, content] of Object.entries(value)) {
        if (isHiddenKey(name) || isInternalKey(name) || isEmpty(content)) continue;
        result.push({ title: humanizeKey(name), content });
      }
    }
  }

  return result;
}

function renderDynamicValue(doc, state, value, depth = 0) {
  if (depth > 4 || isEmpty(value)) return;

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    paragraph(doc, state, value);
    return;
  }

  if (Array.isArray(value)) {
    bullets(doc, state, value);
    return;
  }

  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (isHiddenKey(key) || isInternalKey(key) || isEmpty(child)) continue;

      subheading(doc, state, humanizeKey(key));
      renderDynamicValue(doc, state, child, depth + 1);
    }
  }
}

function renderDynamicSections(doc, state, project) {
  const sections = getDynamicSections(project);

  for (const section of sections) {
    sectionTitle(doc, state, section.title);
    renderDynamicValue(doc, state, section.content);
  }
}

/* ============================================================
   REMAINING FIELDS
============================================================ */

function renderRemainingFields(doc, state, project) {
  const fields = Object.entries(project).filter(([key, value]) => {
    if (KNOWN_FIELDS.has(key)) return false;
    if (isHiddenKey(key) || isInternalKey(key) || isEmpty(value)) return false;
    return true;
  });

  if (!fields.length) return;

  sectionTitle(doc, state, "Additional Project Details");

  for (const [key, value] of fields) {
    if (isHiddenKey(key) || isInternalKey(key)) continue;

    subheading(doc, state, humanizeKey(key));
    renderDynamicValue(doc, state, value);
  }
}

/* ============================================================
   FINAL NOTE
============================================================ */

function renderFinalNote(doc, state) {
  ensureSectionSpace(doc, state, 85);
  const y = doc.y;

  drawCard(doc, PAGE.margin, y, CONTENT_WIDTH, 70, { fill: COLORS.navy, stroke: COLORS.navy });

  setFont(doc, "bold");
  doc.fontSize(9).fillColor(COLORS.white).text("Implementation Note", PAGE.margin + 14, y + 12);

  setFont(doc, "regular");
  doc.fontSize(7.5).fillColor("#CBD5E1")
    .text(
      "This document is generated from the project record. AI-generated requirements should be reviewed by an administrator before implementation.",
      PAGE.margin + 14, y + 30,
      { width: CONTENT_WIDTH - 28, lineGap: 1.5 }
    );

  doc.y = y + 82;
}

/* ============================================================
   VALIDATION
============================================================ */

function validateProject(project) {
  if (!project || typeof project !== "object" || Array.isArray(project)) {
    throw new Error("Project data is required for PDF generation.");
  }
}

/* ============================================================
   MAIN PDF GENERATOR
============================================================ */

export async function generateProjectPdf(project, options = {}) {
  const upload = options.upload !== false;
  validateProject(project);

  const filename = `project-${crypto.randomUUID()}-${Date.now()}.pdf`;
  const title = projectTitle(project);

  const doc = new PDFDocument({
    size: "A4",

    // This renderer controls pagination itself.
    margins: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    },

    autoFirstPage: true,
    compress: true,

    info: {
      Title: title,
      Author: "RecruitAI",
      Subject: "AI Generated Project Specification",
      Creator: "RecruitAI",
      Producer: "PDFKit",
      Keywords: "RecruitAI, Project, Specification",
    },
  });

  setFont(doc, "regular");
  doc.fontSize(9).fillColor(COLORS.text);

  const state = createState();

  // PDFKit does not emit pageAdded for the initial page.
  state.page = 1;
  drawPageChrome(doc, state);

  doc.x = PAGE.margin;
  doc.y = CONTENT_TOP;

  // Add header/footer to every subsequent page.
  doc.on("pageAdded", () => {
    state.page += 1;

    drawPageChrome(doc, state);

    doc.x = PAGE.margin;
    doc.y = CONTENT_TOP;
  });

  try {
    // ----------------------------------------------------------
    // COVER
    // ----------------------------------------------------------

    renderCover(doc, state, project);

    // Detailed specification starts on a new page.
    startPage(doc);

    // ----------------------------------------------------------
    // PROJECT CONTENT
    // ----------------------------------------------------------

    renderOverview(doc, state, project);
    renderCandidate(doc, state, project);
    renderTechnologyStack(doc, state, project);

    renderRequirements(
      doc,
      state,
      "Functional Requirements",
      project?.functionalRequirements ||
        project?.functional ||
        project?.requirements,
      COLORS.blue,
      COLORS.blueSoft
    );

    renderRequirements(
      doc,
      state,
      "Non-Functional Requirements",
      project?.nonFunctionalRequirements ||
        project?.nonFunctional ||
        project?.qualityRequirements,
      COLORS.purple,
      COLORS.purpleSoft
    );

    renderModules(doc, state, project);
    renderArchitecture(doc, state, project);
    renderRoadmap(doc, state, project);
    renderApi(doc, state, project);
    renderDatabase(doc, state, project);
    renderTesting(doc, state, project);
    renderEvaluation(doc, state, project);
    renderDeliverables(doc, state, project);
    renderStudentFit(doc, state, project);
    renderLinks(doc, state, project);
    renderDynamicSections(doc, state, project);
    renderRemainingFields(doc, state, project);
    renderFinalNote(doc, state);

    // Preview mode: finish the PDF in memory and return the bytes.
    // Nothing is uploaded to Cloudinary in this mode.
    if (!upload) {
      const chunks = [];

      const buffer = await new Promise((resolve, reject) => {
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.once("error", reject);
        doc.once("end", () => resolve(Buffer.concat(chunks)));

        doc.end();
      });

      return {
        filename,
        buffer,
        bytes: buffer.length,
        format: "pdf",
      };
    }

    // Confirmed-save mode: upload the completed PDF to Cloudinary.
    const result = await uploadPdfToCloudinary(
      doc,
      filename,
      title
    );

    return {
      filename,
      url: result.secure_url,
      secureUrl: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      bytes: result.bytes,
      format: result.format || "pdf",
      relativeUrl: result.secure_url,
    };
  } catch (error) {
    console.error(
      "Project PDF generation/upload failed:",
      error
    );

    throw new Error(
      `Failed to generate/upload project PDF: ${
        error?.message ||
        "Unknown PDF generation/upload error"
      }`
    );
  }
}

export default { generateProjectPdf };