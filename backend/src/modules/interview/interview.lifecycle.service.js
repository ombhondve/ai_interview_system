/**
 * Interview Lifecycle & Auto-Scheduler Service
 *
 * Implements the required lifecycle state machine and candidate presence detection:
 * SCHEDULED -> WAITING_FOR_CANDIDATE -> IN_PROGRESS -> COMPLETING -> COMPLETED
 *                                    -> CANDIDATE_NO_SHOW
 *
 * Designed for serverless & long-running deployments with idempotency guarantees.
 */

import AiInterview from "./interview.model.js";
import InterviewBooking from "../scheduling/interviewBooking.model.js";
import logger from "../../utils/logger.js";
import { startInterview } from "./interview.session.service.js";

// Default grace period: 10 minutes past scheduled time before marking no-show
export const DEFAULT_NO_SHOW_GRACE_MINUTES = 10;

/**
 * Check and advance all due interviews.
 * Safe to be executed periodically (e.g. by cron, background runner, or on-demand check).
 */
export async function syncInterviewLifecycles(now = new Date()) {
  const currentTime = new Date(now).getTime();
  const gracePeriodMs = DEFAULT_NO_SHOW_GRACE_MINUTES * 60 * 1000;

  // 1. Advance SCHEDULED interviews whose scheduled time has arrived -> WAITING_FOR_CANDIDATE
  const dueInterviews = await AiInterview.find({
    status: { $in: ["SCHEDULED", "READY"] },
    scheduledAt: { $lte: new Date(currentTime) },
  });

  for (const interview of dueInterviews) {
    interview.status = "WAITING_FOR_CANDIDATE";
    interview.aiSessionId = interview.aiSessionId || `ai-session-${interview._id}-${Date.now()}`;
    await interview.save();
    logger.info("AI_SESSION_STARTING", { interviewId: String(interview._id) });
    logger.info("CANDIDATE_WAITING", { interviewId: String(interview._id) });
  }

  // 2. Mark interviews as CANDIDATE_NO_SHOW if candidate did not join within grace period
  const noShowCutoff = new Date(currentTime - gracePeriodMs);
  const potentialNoShows = await AiInterview.find({
    status: "WAITING_FOR_CANDIDATE",
    scheduledAt: { $lte: noShowCutoff },
    candidateJoinedAt: null,
  });

  for (const interview of potentialNoShows) {
    interview.status = "CANDIDATE_NO_SHOW";
    interview.noShowAt = new Date();
    interview.noShowReason = `Candidate did not join within the ${DEFAULT_NO_SHOW_GRACE_MINUTES}-minute grace period.`;
    await interview.save();

    // Update the booking status as well so slots reflect properly
    await InterviewBooking.findByIdAndUpdate(interview.bookingId, {
      $set: { status: "no_show" },
    });

    logger.info("CANDIDATE_NO_SHOW", {
      interviewId: String(interview._id),
      scheduledAt: interview.scheduledAt,
      reason: interview.noShowReason,
    });
  }

  return {
    advancedToWaiting: dueInterviews.length,
    markedNoShow: potentialNoShows.length,
  };
}

/**
 * Handle candidate presence signal (when candidate enters the interview room or joins).
 * Transitions from WAITING_FOR_CANDIDATE / SCHEDULED to IN_PROGRESS.
 */
export async function recordCandidatePresence(interviewId, candidateId) {
  const interview = await AiInterview.findById(interviewId);
  if (!interview) {
    const error = new Error("Interview not found");
    error.status = 404;
    throw error;
  }
  if (String(interview.candidateId) !== String(candidateId)) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }

  // If already completed or no-show, cannot join
  if (["COMPLETED", "CANDIDATE_NO_SHOW", "CANCELLED"].includes(interview.status)) {
    return { interview, started: false };
  }

  // Record join timestamp
  if (!interview.candidateJoinedAt) {
    interview.candidateJoinedAt = new Date();
    logger.info("CANDIDATE_JOINED", {
      interviewId: String(interview._id),
      candidateId: String(candidateId),
      joinedAt: interview.candidateJoinedAt,
    });
  }

  // If currently waiting or scheduled, transition and start the interview session
  if (["SCHEDULED", "READY", "WAITING_FOR_CANDIDATE"].includes(interview.status)) {
    const started = await startInterview(interview._id, candidateId);
    logger.info("INTERVIEW_STARTED", {
      interviewId: String(interview._id),
      candidateId: String(candidateId),
    });
    return { interview: started, started: true };
  }

  await interview.save();
  return { interview, started: interview.status === "IN_PROGRESS" };
}

export default {
  syncInterviewLifecycles,
  recordCandidatePresence,
  DEFAULT_NO_SHOW_GRACE_MINUTES,
};
