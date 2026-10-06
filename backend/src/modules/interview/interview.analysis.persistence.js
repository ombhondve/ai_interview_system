import AiInterview from "./interview.model.js";
import { buildInterviewContext } from "./interview.context.service.js";
import { analyzeInterview } from "./interview.analysis.service.js";
import logger from "../../utils/logger.js";

export async function analyzeAndPersist(interviewId) {
  const interview = await AiInterview.findById(interviewId);
  if (!interview) throw new Error("Interview not found");
  if (!["COMPLETED", "ANALYSIS_PENDING"].includes(interview.status)) {
    throw new Error("Only completed interviews can be analyzed");
  }
  interview.status = "ANALYSIS_PENDING";
  await interview.save();
  try {
    const context = await buildInterviewContext({
      candidateId: interview.candidateId,
      projectId: interview.projectId,
      bookingId: interview.bookingId,
    });
    interview.analysis = await analyzeInterview({
      context,
      questions: interview.questions,
      transcript: interview.transcript,
    });
    interview.status = "ANALYZED";
    await interview.save();
    logger.info(`Interview analysis completed ${interview._id}`);
    return interview;
  } catch (error) {
    logger.error(`Interview analysis persistence failed ${interview._id}`, error.message);
    throw error;
  }
}

export default { analyzeAndPersist };
