import AiInterview from "./interview.model.js";
import { buildInterviewContext } from "./interview.context.service.js";
import { analyzeInterview } from "./interview.analysis.service.js";
import logger from "../../utils/logger.js";

export async function analyzeAndPersist(interviewId) {
  const interview = await AiInterview.findById(interviewId);
  if (!interview) {
    const err = new Error("Interview not found");
    err.status = 404;
    throw err;
  }

  if (!["COMPLETING", "COMPLETED", "ANALYSIS_PENDING", "FAILED", "ANALYZED", "IN_PROGRESS"].includes(interview.status)) {
    const err = new Error(`Interviews in ${interview.status} status cannot be analyzed.`);
    err.status = 409;
    throw err;
  }

  const candidateTurns = (interview.transcript || []).filter(
    (t) => t.speaker === "CANDIDATE" && typeof t.text === "string" && t.text.trim().length > 0
  );

  if (candidateTurns.length === 0) {
    const errorMsg = "Interview transcript contains insufficient candidate responses to generate an evaluation.";
    interview.analysisError = errorMsg;
    interview.analysisAttempts = (interview.analysisAttempts || 0) + 1;
    interview.analysisUpdatedAt = new Date();
    if (!interview.analysis) {
      interview.status = "FAILED";
    }
    await interview.save();
    logger.warn(`[ANALYSIS] Insufficient candidate transcript turns for interview ${interview._id}`);
    const err = new Error(errorMsg);
    err.status = 400;
    throw err;
  }

  const previousAnalysis = interview.analysis;
  interview.status = "ANALYSIS_PENDING";
  interview.analysisError = null;
  interview.endedAt = interview.endedAt || new Date();
  await interview.save();

  try {
    logger.info(`[ANALYSIS] Building interview context for interview ${interview._id} (candidate: ${interview.candidateId})`);
    const context = await buildInterviewContext({
      candidateId: interview.candidateId,
      projectId: interview.projectId,
      bookingId: interview.bookingId,
    });

    interview.analysisAttempts = (interview.analysisAttempts || 0) + 1;
    interview.analysisUpdatedAt = new Date();
    interview.analysisError = null;

    logger.info(`[ANALYSIS] Requesting AI evaluation for interview ${interview._id} (${candidateTurns.length} candidate turns)`);
    const evaluated = await analyzeInterview({
      context,
      questions: interview.questions,
      transcript: interview.transcript,
    });

    if (!evaluated || typeof evaluated !== "object") {
      throw new Error("AI provider produced empty or invalid evaluation output.");
    }

    interview.analysis = evaluated;
    interview.status = "ANALYZED";
    interview.analysisError = null;
    interview.analysisUpdatedAt = new Date();
    await interview.save();
    logger.info(`[ANALYSIS] Interview analysis completed and persisted successfully for interview ${interview._id}`);
    return interview;
  } catch (error) {
    // Preserve previously generated report if available
    if (previousAnalysis) {
      interview.analysis = previousAnalysis;
      interview.status = "ANALYZED";
    } else {
      interview.status = "FAILED";
    }
    interview.analysisError = error.message || "Analysis could not be completed. An administrator can retry it.";
    interview.analysisAttempts = (interview.analysisAttempts || 0) + 1;
    interview.analysisUpdatedAt = new Date();
    await interview.save().catch((saveError) =>
      logger.error(`[ANALYSIS] Unable to persist analysis failure for interview ${interview._id}: ${saveError.message}`)
    );
    logger.error(`[ANALYSIS] Interview analysis persistence failed for interview ${interview._id}: ${error.message}`);
    throw error;
  }
}

export default { analyzeAndPersist };
