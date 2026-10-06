/**
 * Interview Context Service
 *
 * Loads EVERYTHING the AI interviewer needs for one interview:
 *   1. Candidate information (name, role, skills)
 *   2. Resume information (parsed resumeData, when available)
 *   3. Assigned project information
 *   4. Project requirements
 *   5. GitHub project verification result
 *
 * All reads are server-side. Nothing here is ever supplied by the browser.
 */

import Candidate from "../candidate/candidate.model.js";
import Project from "../projects/project.model.js";
import InterviewBooking from "../scheduling/interviewBooking.model.js";
import logger from "../../utils/logger.js";

/**
 * Flatten resumeData into a short plain-text summary for the prompt.
 * Resume structures vary (they are AI-generated Mixed), so extraction is
 * defensive: missing pieces simply reduce the prompt, never crash it.
 */
function buildResumeText(candidate) {
  const resume = candidate?.resumeData || {};
  const parts = [];

  const raw =
    typeof resume.raw === "string" ? resume.raw : "";
  if (raw) parts.push(raw.slice(0, 1500));

  const parsed = resume.candidate || resume.parsed || resume;
  if (parsed && typeof parsed === "object") {
    const experience = parsed.experience || parsed.workExperience;
    if (Array.isArray(experience)) {
      parts.push(
        `Experience: ${experience
          .slice(0, 3)
          .map((e) => `${e?.title || e?.role || ""} at ${e?.company || ""}`.trim())
          .filter(Boolean)
          .join("; ")}`
      );
    }
    const education = parsed.education;
    if (Array.isArray(education) && education.length) {
      parts.push(
        `Education: ${education
          .slice(0, 2)
          .map((e) => e?.degree || e?.field || "")
          .filter(Boolean)
          .join("; ")}`
      );
    }
  }

  return parts.join("\n").trim().slice(0, 2000);
}

function extractSkills(candidate) {
  if (Array.isArray(candidate?.skills) && candidate.skills.length) {
    return candidate.skills;
  }
  const parsed =
    candidate?.resumeData?.candidate ||
    candidate?.resumeData?.parsed ||
    candidate?.resumeData ||
    {};
  const skills = parsed?.skills || parsed?.technicalSkills;
  if (Array.isArray(skills)) return skills;
  if (typeof skills === "string" && skills.trim()) {
    return skills.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Build the full interview context for a session.
 *
 * @param {object} params
 * @param {string} params.candidateId
 * @param {string|null} params.projectId
 * @param {string} params.bookingId
 * @returns {Promise<{candidate, project, verification, booking}>}
 */
export async function buildInterviewContext({ candidateId, projectId, bookingId }) {
  const [candidate, booking] = await Promise.all([
    Candidate.findById(candidateId),
    InterviewBooking.findById(bookingId),
  ]);

  if (!candidate) {
    throw new Error("Candidate not found for interview context.");
  }

  let project = null;
  if (projectId) {
    project = await Project.findById(projectId);
  }

  const submission = candidate.projectSubmission || {};
  const verificationResult = submission.aiVerificationResult || null;
  const requirementSummary = (value) => {
    if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? item : item?.description || item?.name || JSON.stringify(item)).filter(Boolean);
    if (typeof value === "string") return [value];
    if (value && typeof value === "object") return Object.entries(value).map(([key, entry]) => `${key}: ${typeof entry === "string" ? entry : JSON.stringify(entry)}`);
    return [];
  };

  return {
    candidate: {
      id: candidate._id,
      name: candidate.name || "Candidate",
      email: candidate.email || "",
      role: candidate.role || project?.role || "",
      skills: extractSkills(candidate),
      resumeText: buildResumeText(candidate),
    },
    project: project
      ? {
          id: project._id,
          title: project.title || "",
          role: project.role || "",
          technologies: project.technologies || project.techStack || [],
          requirements: requirementSummary(
            project.requirements || project.functionalRequirements || project.deliverables || project.description || []
          ),
        }
      : null,
    verification: {
      verificationStatus:
        verificationResult?.verificationStatus ||
        verificationResult?.status ||
        candidate.projectSubmissionStatus ||
        "unknown",
      summary:
        verificationResult?.summary ||
        verificationResult?.detailedAnalysis?.overallAssessment ||
        "",
      repositoryUrl: submission.url || "",
      verifiedFeatures:
        verificationResult?.verifiedFeatures ||
        verificationResult?.detailedAnalysis?.verifiedFeatures ||
        [],
      missingRequirements:
        verificationResult?.missingRequirements ||
        verificationResult?.detailedAnalysis?.requirementsAssessment
          ?.filter((r) => r.status === "missing")
          ?.map((r) => r.description) ||
        [],
    },
    booking: booking
      ? {
          id: booking._id,
          scheduledAt: booking.startAt,
          endAt: booking.endAt,
          durationMinutes: booking.durationMinutes,
          timezone: booking.timezone,
          meetLink: booking.meetLink || null,
        }
      : null,
  };
}

/**
 * Safe context projection for the student/admin API. Never exposes prompt
 * internals.
 */
export function publicSessionContext(context) {
  return {
    candidateName: context.candidate?.name || "",
    role: context.candidate?.role || "",
    projectTitle: context.project?.title || "",
    repositoryUrl: context.verification?.repositoryUrl || "",
    verificationStatus: context.verification?.verificationStatus || "unknown",
  };
}

export async function loadInterviewContext(candidateId, projectId, bookingId) {
  return buildInterviewContext({ candidateId, projectId, bookingId });
}

export default { buildInterviewContext, loadInterviewContext, publicSessionContext };