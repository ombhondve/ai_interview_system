import AiInterview from "./interview.model.js";
import { buildInterviewContext } from "./interview.context.service.js";
import { analyzeInterview } from "./interview.analysis.service.js";
import logger from "../../utils/logger.js";

export async function analyzeAndPersist(interviewId) {
  const interview = await AiInterview.findById(interviewId);
  if (!interview) throw new Error("Interview not found");
  if (!["COMPLETING", "COMPLETED", "ANALYSIS_PENDING", "FAILED"].includes(interview.status)) {
    throw new Error("Only completed interviews can be analyzed");
  }
  interview.status = "ANALYSIS_PENDING";
  interview.analysisError = null;
  await interview.save();
  try {
    const context = await buildInterviewContext({
      candidateId: interview.candidateId,
      projectId: interview.projectId,
      bookingId: interview.bookingId,
    });
    interview.analysisAttempts = (interview.analysisAttempts || 0) + 1;
    interview.analysisUpdatedAt = new Date();
    interview.analysisError = null;
    interview.analysis = await analyzeInterview({
      context,
      questions: interview.questions,
      transcript: interview.transcript,
    });
    interview.status = "ANALYZED";
    interview.analysisError = null;
    interview.analysisUpdatedAt = new Date();
    await interview.save();
    logger.info(`Interview analysis completed ${interview._id}`);
    return interview;
  } catch (error) {
    interview.status = "FAILED";
    interview.analysisError = "Analysis could not be completed. An administrator can retry it.";
    interview.analysisAttempts = (interview.analysisAttempts || 0) + 1;
    interview.analysisUpdatedAt = new Date();
    await interview.save().catch((saveError) => logger.error(`Unable to persist analysis failure ${interview._id}`, saveError.message));
    logger.error(`Interview analysis persistence failed ${interview._id}`, error.message);
    throw error;
  }
}

export default { analyzeAndPersist };
