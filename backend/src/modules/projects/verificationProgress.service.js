/**
 * Persisted verification progress history.
 *
 * WHY THIS EXISTS
 * ---------------
 * The student UI used to infer progress by polling the current status. Backend
 * verification moves through several stages far faster than a poll interval, so
 * the UI only ever observed the LATEST stage and appeared to jump straight from
 * the first step to "Accepted". CSS delays would only have hidden the missing
 * data; the real fix is to persist what actually happened.
 *
 * Every write is scoped to the CURRENT submissionId via buildSubmissionGuard,
 * so a slower older run can never mutate a newer submission's history.
 *
 * IMPORTANT: these writes NEVER delay verification. They are recorded alongside
 * the real work and every failure is swallowed, so tracking can never break the
 * verification pipeline.
 */

import Candidate from "../candidate/candidate.model.js";
import { buildSubmissionGuard } from "./verificationState.js";
import logger from "../../utils/logger.js";

/**
 * The real verification stages, in the order they actually execute.
 *
 * These are NOT decorative: each corresponds to a concrete step inside
 * verifyProjectSubmission().
 */
export const VERIFICATION_STAGES = [
  {
    stage: "validating",
    label: "Validating repository",
    completedMessage: "Repository URL validated."
  },
  {
    stage: "project_requirements",
    label: "Loading project requirements",
    completedMessage: "Project requirements loaded."
  },
  {
    stage: "repository",
    label: "Fetching repository",
    completedMessage: "Repository files fetched successfully."
  },
  {
    stage: "analyzing",
    label: "Analyzing code and files",
    completedMessage: "Repository files analyzed."
  },
  {
    stage: "requirements",
    label: "Checking project requirements",
    completedMessage: "Requirements compared against repository evidence."
  },
  {
    stage: "ai",
    label: "AI verification in progress",
    completedMessage: "AI verification completed."
  },
  {
    stage: "finalizing",
    label: "Finalizing results",
    completedMessage: "Verification result prepared."
  }
];

const STAGE_LABELS = new Map(
  VERIFICATION_STAGES.map((entry) => [entry.stage, entry.label])
);

/**
 * Reset progress for a brand new submission and record the first stage.
 *
 * Clearing here is what guarantees a new submission never shows the previous
 * submission's history.
 */
export async function startVerificationProgress(candidateId, submissionId) {
  const now = new Date();
  const first = VERIFICATION_STAGES[0];

  try {
    await Candidate.findByIdAndUpdate(
      buildSubmissionGuard(candidateId, submissionId),
      {
        $set: {
          "projectSubmission.verificationProgress": {
            stage: first.stage,
            label: first.label,
            status: "active",
            message: "Starting verification.",
            startedAt: now,
            updatedAt: now
          },
          "projectSubmission.verificationProgressHistory": [
            {
              stage: first.stage,
              label: first.label,
              status: "active",
              message: "Starting verification.",
              startedAt: now,
              completedAt: null,
              failed: false
            }
          ]
        }
      }
    );
  } catch (error) {
    // Progress tracking must NEVER break verification.
    logger.error("Failed to start verification progress:", error);
  }
}

/**
 * Mark a stage as active and append it to the history.
 */
export async function markStageActive(
  candidateId,
  submissionId,
  stage,
  message
) {
  const label = STAGE_LABELS.get(stage) || stage;
  const now = new Date();

  try {
    await Candidate.updateOne(
      buildSubmissionGuard(candidateId, submissionId),
      {
        $set: {
          "projectSubmission.verificationProgress": {
            stage,
            label,
            status: "active",
            message: message || null,
            startedAt: now,
            updatedAt: now
          }
        },
        $push: {
          "projectSubmission.verificationProgressHistory": {
            stage,
            label,
            status: "active",
            message: message || null,
            startedAt: now,
            completedAt: null,
            failed: false
          }
        }
      }
    );
  } catch (error) {
    logger.error(`Failed to mark stage ${stage} active:`, error);
  }
}

/**
 * Mark the stage currently recorded as active (and its latest history entry)
 * as completed, then advance the pointer.
 */
export async function markStageCompleted(candidateId, submissionId, stage) {
  const label = STAGE_LABELS.get(stage) || stage;
  const now = new Date();

  try {
    await Candidate.updateOne(
      buildSubmissionGuard(candidateId, submissionId),
      {
        $set: {
          "projectSubmission.verificationProgress": {
            stage,
            label,
            status: "completed",
            message: null,
            completedAt: now,
            updatedAt: now
          },
          "projectSubmission.verificationProgressHistory.$[entry].status":
            "completed",
          "projectSubmission.verificationProgressHistory.$[entry].completedAt":
            now
        }
      },
      {
        arrayFilters: [{ "entry.stage": stage, "entry.status": "active" }]
      }
    );
  } catch (error) {
    logger.error(`Failed to mark stage ${stage} completed:`, error);
  }
}

/**
 * Mark a stage as failed, recording the REAL error message.
 *
 * A failed verification is never presented as successful: the exact stage that
 * failed is stored as failed with its actual error.
 */
export async function markStageFailed(candidateId, submissionId, stage, message) {
  const label = STAGE_LABELS.get(stage) || stage;
  const now = new Date();

  try {
    await Candidate.updateOne(
      buildSubmissionGuard(candidateId, submissionId),
      {
        $set: {
          "projectSubmission.verificationProgress": {
            stage,
            label,
            status: "failed",
            message: message || "Verification failed.",
            failed: true,
            completedAt: now,
            updatedAt: now
          },
          "projectSubmission.verificationProgressHistory.$[entry].status":
            "failed",
          "projectSubmission.verificationProgressHistory.$[entry].message":
            message || "Verification failed.",
          "projectSubmission.verificationProgressHistory.$[entry].failed": true,
          "projectSubmission.verificationProgressHistory.$[entry].completedAt":
            now
        }
      },
      {
        arrayFilters: [{ "entry.stage": stage, "entry.status": "active" }]
      }
    );
  } catch (error) {
    logger.error(`Failed to mark stage ${stage} failed:`, error);
  }
}

/**
 * Normalise the persisted history into the shape the student UI replays.
 *
 * Stages that never actually ran are returned as "pending" so the timeline can
 * render them grey, and the frontend can animate ONLY what genuinely occurred.
 */
export function toProgressPayload(submission) {
  const history = Array.isArray(submission?.verificationProgressHistory)
    ? submission.verificationProgressHistory
    : [];

  const progress = submission?.verificationProgress || null;

  // A stage that appears more than once (retry) keeps its latest outcome.
  const byStage = new Map();
  for (const entry of history) {
    if (!entry?.stage) continue;
    byStage.set(entry.stage, entry);
  }

  const stages = VERIFICATION_STAGES.map((definition) => {
    const recorded = byStage.get(definition.stage);
    const isCurrent = progress?.stage === definition.stage;

    if (!recorded) {
      return {
        stage: definition.stage,
        label: definition.label,
        status: isCurrent ? "active" : "pending",
        message: isCurrent ? progress.message || null : null,
        startedAt: null,
        completedAt: null,
        failed: false
      };
    }

    return {
      stage: recorded.stage,
      label: recorded.label || definition.label,
      status: recorded.status || "pending",
      message: recorded.message || null,
      startedAt: recorded.startedAt || null,
      completedAt: recorded.completedAt || null,
      failed: Boolean(recorded.failed)
    };
  });

  const failedStage = stages.find((entry) => entry.status === "failed");

  return {
    progress: progress
      ? {
          stage: progress.stage,
          label: progress.label,
          status: progress.status,
          message: progress.message || null,
          failed: Boolean(progress.failed)
        }
      : null,
    stages,
    // Only stages that genuinely ran are reported as having occurred.
    occurredStages: stages
      .filter((entry) => entry.status !== "pending")
      .map((entry) => entry.stage),
    failedStage: failedStage ? failedStage.stage : null,
    failedMessage: failedStage ? failedStage.message : null
  };
}