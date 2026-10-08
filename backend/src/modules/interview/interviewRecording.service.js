/**
 * Interview Recording Service
 * Manages uploading local recording artifacts to Cloudinary and persisting metadata.
 */
import AiInterview from "../interview/interview.model.js";
import cloudinary from "../../config/cloudinary.js";
import logger from "../../utils/logger.js";
import fs from "fs";

export async function startRecordingSession(interviewId) {
  const doc = await AiInterview.findById(interviewId);
  if (!doc) throw new Error("Interview not found");
  doc.recordingStatus = "RECORDING";
  doc.recordingStartedAt = new Date();
  doc.recordingError = null;
  await doc.save();
  logger.info(`Recording session started for interview ${interviewId}`);
  return doc;
}

export async function uploadInterviewRecording(interviewId, filePath, options = {}) {
  const doc = await AiInterview.findById(interviewId);
  if (!doc) throw new Error("Interview not found");

  if (!filePath || !fs.existsSync(filePath)) {
    const errorMsg = `Recording file not found on disk: ${filePath}`;
    logger.warn(`[RECORDING] ${errorMsg}`);
    doc.recordingStatus = "UPLOAD_FAILED";
    doc.recordingError = errorMsg;
    await doc.save();
    return { success: false, error: errorMsg };
  }

  doc.recordingStatus = "UPLOADING";
  doc.recordingEndedAt = new Date();
  await doc.save();

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      const errorMsg = "Cloudinary credentials not configured; local recording preserved.";
      logger.warn(`[RECORDING] ${errorMsg}`);
      doc.recordingStatus = "UPLOAD_FAILED";
      doc.recordingError = errorMsg;
      await doc.save();
      return { success: false, error: errorMsg, preservedPath: filePath };
    }

    const publicId = `interview_recording_${interviewId}_${Date.now()}`;
    logger.info(`[RECORDING] Uploading interview recording to Cloudinary (publicId: ${publicId})...`);

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "auto",
          public_id: publicId,
          folder: "interview_recordings",
          overwrite: true,
        },
        (error, uploadResult) => {
          if (error) return reject(error);
          resolve(uploadResult);
        }
      );
      fs.createReadStream(filePath).pipe(uploadStream);
    });

    doc.recordingStatus = "UPLOADED";
    doc.recordingUrl = result.secure_url || result.url;
    doc.recordingPublicId = result.public_id;
    doc.recordingDuration = result.duration ? Math.round(result.duration) : options.duration || 0;
    doc.recordingError = null;
    await doc.save();

    logger.info(`[RECORDING] Uploaded recording successfully for interview ${interviewId}: ${doc.recordingUrl}`);
    return {
      success: true,
      recordingUrl: doc.recordingUrl,
      recordingPublicId: doc.recordingPublicId,
      duration: doc.recordingDuration,
    };
  } catch (error) {
    logger.error(`[RECORDING] Cloudinary upload failed for ${interviewId}: ${error.message}`);
    doc.recordingStatus = "UPLOAD_FAILED";
    doc.recordingError = error.message;
    await doc.save();
    return { success: false, error: error.message, preservedPath: filePath };
  }
}

export default { startRecordingSession, uploadInterviewRecording };
