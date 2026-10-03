import Candidate from "./candidate.model.js";
import { processVerificationForStorage, requiresAdminReview, isVerificationApproved, getVerificationStatistics } from "../projects/verification.service.js";
import logger from "../../utils/logger.js";

/**
 * Verification Storage Service
 * 
 * Handles storing and updating verification results in the Candidate model
 */

/**
 * Store verification result in candidate document
 */
export async function storeVerificationResult(candidateId, verificationResult) {
  try {
    logger.info(`Storing verification result for candidate ${candidateId}`);
    
    if (!verificationResult) {
      throw new Error("No verification result provided");
    }
    
    // Process verification for storage
    const processedData = processVerificationForStorage(verificationResult, candidateId);
    
    // Get verification statistics
    const stats = getVerificationStatistics(verificationResult);
    
    // Determine next status based on verification result
    let nextSubmissionStatus = "verification_completed";
    let nextAiVerificationStatus = verificationResult.status.toLowerCase();
    
    if (verificationResult.status === "ERROR") {
      nextSubmissionStatus = "ai_verification_failed";
      nextAiVerificationStatus = "error";
    } else if (requiresAdminReview(verificationResult)) {
      nextSubmissionStatus = "needs_admin_review";
      nextAiVerificationStatus = "needs_admin_review";
    } else if (isVerificationApproved(verificationResult)) {
      nextSubmissionStatus = "verified";
      nextAiVerificationStatus = "verified";
    } else if (verificationResult.status === "REJECTED") {
      nextSubmissionStatus = "rejected";
      nextAiVerificationStatus = "rejected";
    }
    
    // Process verification for storage (extracts evidence and key metrics)
    const processedData = processVerificationForStorage(verificationResult, candidateId);
    
    // Update candidate document with EVIDENCE PRESERVATION
    const updateData = {
      "projectSubmissionStatus": nextSubmissionStatus,
      "projectSubmission.aiVerificationStatus": nextAiVerificationStatus,
      "projectSubmission.aiVerificationResult": verificationResult, // Full result
      "projectSubmission.aiVerificationCompletedAt": new Date(),
      "projectSubmission.aiVerificationDurationMs": verificationResult.verificationMetadata?.verificationTimeMs || 0,
      "projectSubmission.verificationStats": {
        filesAnalyzed: stats?.filesAnalyzed || 0,
        requirementsTotal: stats?.requirements?.total || 0,
        requirementsMet: stats?.requirements?.met || 0,
        requirementsPartial: stats?.requirements?.partial || 0,
        requirementsMissing: stats?.requirements?.missing || 0,
        requirementsCompletionRate: stats?.requirements?.total > 0 
          ? stats.requirements.met / stats.requirements.total 
          : 0,
        codeQualityScore: mapQualityToNumericScore(stats?.qualityScores?.codeQuality),
        organizationScore: mapQualityToNumericScore(stats?.qualityScores?.organization),
        documentationScore: mapQualityToNumericScore(stats?.qualityScores?.documentation),
        // Evidence metrics
        evidenceCount: processedData.evidenceSummary ? Object.keys(processedData.evidenceSummary).length : 0,
        criticalEvidenceCount: processedData.criticalEvidence ? Object.keys(processedData.criticalEvidence).length : 0,
        filesWithContent: processedData.fileAnalysis?.filesWithContent || 0
      },
      // Store processed evidence for quick access
      "projectSubmission.verificationEvidence": {
        summary: processedData.evidenceSummary || {},
        critical: processedData.criticalEvidence || null,
        fileAnalysis: processedData.fileAnalysis || {},
        technicalEvaluation: processedData.technicalEvaluation || {}
      }
    };
    
    // If needs admin review, initialize admin review section
    if (requiresAdminReview(verificationResult)) {
      updateData["projectSubmission.adminReview"] = {
        status: "pending",
        reviewedBy: null,
        reviewedAt: null,
        reviewerNotes: "",
        finalDecision: null,
        decisionReason: null
      };
      
      // Initialize admin review workflow (async, don't await)
      initializeAdminReviewWorkflow(candidateId, verificationResult).catch(error => {
        logger.error(`Failed to initialize admin review workflow for candidate ${candidateId}:`, error);
      });
    }
    
    const updatedCandidate = await Candidate.findByIdAndUpdate(
      candidateId,
      {
        $set: updateData,
        $push: {
          activity: {
            id: `verification_${Date.now()}`,
            label: "Project Verification",
            description: `Project verification completed with status: ${verificationResult.status}`,
            timestamp: new Date(),
            state: "complete"
          }
        }
      },
      { new: true, runValidators: true }
    ).populate("assignedProjectId");
    
    if (!updatedCandidate) {
      throw new Error(`Candidate ${candidateId} not found`);
    }
    
    logger.info(`Verification result stored for candidate ${candidateId}, status: ${verificationResult.status}`);
    
    return {
      success: true,
      candidate: updatedCandidate,
      verificationStatus: verificationResult.status,
      requiresAdminReview: requiresAdminReview(verificationResult),
      stats: processedData
    };
    
  } catch (error) {
    logger.error(`Failed to store verification result for candidate ${candidateId}:`, error);
    
    // Try to update with error status
    try {
      await Candidate.findByIdAndUpdate(candidateId, {
        $set: {
          "projectSubmissionStatus": "ai_verification_failed",
          "projectSubmission.aiVerificationStatus": "error",
          "projectSubmission.aiVerificationResult.error": error.message
        }
      });
    } catch (updateError) {
      logger.error("Failed to update candidate with error status:", updateError);
    }
    
    return {
      success: false,
      error: error.message,
      candidateId
    };
  }
}

/**
 * Update verification status to processing
 */
export async function setVerificationProcessing(candidateId) {
  try {
    const updatedCandidate = await Candidate.findByIdAndUpdate(
      candidateId,
      {
        $set: {
          "projectSubmissionStatus": "verification_processing",
          "projectSubmission.aiVerificationStatus": "processing",
          "projectSubmission.aiVerificationStartedAt": new Date()
        },
        $inc: { "projectSubmission.verificationRetryCount": 1 }
      },
      { new: true }
    );
    
    if (!updatedCandidate) {
      throw new Error(`Candidate ${candidateId} not found`);
    }
    
    logger.info(`Set verification to processing for candidate ${candidateId}`);
    return { success: true, candidate: updatedCandidate };
    
  } catch (error) {
    logger.error(`Failed to set verification processing for candidate ${candidateId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Get verification result for a candidate
 */
export async function getVerificationResult(candidateId) {
  try {
    const candidate = await Candidate.findById(candidateId)
      .select("projectSubmission projectSubmissionStatus")
      .lean();
    
    if (!candidate) {
      throw new Error(`Candidate ${candidateId} not found`);
    }
    
    return {
      success: true,
      verificationResult: candidate.projectSubmission?.aiVerificationResult,
      status: candidate.projectSubmission?.aiVerificationStatus,
      submissionStatus: candidate.projectSubmissionStatus,
      stats: candidate.projectSubmission?.verificationStats,
      adminReview: candidate.projectSubmission?.adminReview
    };
    
  } catch (error) {
    logger.error(`Failed to get verification result for candidate ${candidateId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Get candidates needing admin review
 */
export async function getCandidatesNeedingAdminReview(options = {}) {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = "projectSubmission.submittedAt",
      sortOrder = "desc"
    } = options;
    
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };
    
    const query = {
      "projectSubmissionStatus": "needs_admin_review",
      "projectSubmission.adminReview.status": "pending"
    };
    
    const candidates = await Candidate.find(query)
      .select("name email phone role projectSubmission projectSubmissionStatus assignedProjectId")
      .populate("assignedProjectId", "title description difficulty")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Candidate.countDocuments(query);
    
    return {
      success: true,
      candidates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
    
  } catch (error) {
    logger.error("Failed to get candidates needing admin review:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update admin review status
 */
export async function updateAdminReview(candidateId, reviewData, adminId) {
  try {
    const {
      status,
      reviewerNotes,
      finalDecision,
      decisionReason
    } = reviewData;
    
    const updateData = {
      "projectSubmission.adminReview.status": status,
      "projectSubmission.adminReview.reviewedBy": adminId,
      "projectSubmission.adminReview.reviewedAt": new Date(),
      "projectSubmission.adminReview.reviewerNotes": reviewerNotes || ""
    };
    
    // Update final submission status based on decision
    let nextSubmissionStatus = candidate.projectSubmissionStatus;
    if (finalDecision === "approved") {
      nextSubmissionStatus = "verified";
      updateData["projectSubmissionStatus"] = "verified";
      updateData["projectSubmission.aiVerificationStatus"] = "verified";
    } else if (finalDecision === "rejected") {
      nextSubmissionStatus = "rejected";
      updateData["projectSubmissionStatus"] = "rejected";
      updateData["projectSubmission.aiVerificationStatus"] = "rejected";
    } else if (finalDecision === "needs_resubmission") {
      nextSubmissionStatus = "submitted"; // Back to submitted for resubmission
      updateData["projectSubmissionStatus"] = "submitted";
      updateData["projectSubmission.aiVerificationStatus"] = "pending";
    }
    
    if (finalDecision) {
      updateData["projectSubmission.adminReview.finalDecision"] = finalDecision;
      updateData["projectSubmission.adminReview.decisionReason"] = decisionReason || "";
    }
    
    const updatedCandidate = await Candidate.findByIdAndUpdate(
      candidateId,
      {
        $set: updateData,
        $push: {
          activity: {
            id: `admin_review_${Date.now()}`,
            label: "Admin Review",
            description: `Admin review completed with decision: ${finalDecision || status}`,
            timestamp: new Date(),
            state: "complete"
          }
        }
      },
      { new: true, runValidators: true }
    ).populate("assignedProjectId");
    
    if (!updatedCandidate) {
      throw new Error(`Candidate ${candidateId} not found`);
    }
    
    logger.info(`Admin review updated for candidate ${candidateId}, decision: ${finalDecision || status}`);
    
    return {
      success: true,
      candidate: updatedCandidate,
      newStatus: nextSubmissionStatus
    };
    
  } catch (error) {
    logger.error(`Failed to update admin review for candidate ${candidateId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Get verification statistics for reporting
 */
export async function getVerificationReport(options = {}) {
  try {
    const {
      startDate,
      endDate,
      projectId,
      verificationStatus
    } = options;
    
    const match = {};
    
    // Date filtering
    if (startDate || endDate) {
      match["projectSubmission.aiVerificationCompletedAt"] = {};
      if (startDate) {
        match["projectSubmission.aiVerificationCompletedAt"].$gte = new Date(startDate);
      }
      if (endDate) {
        match["projectSubmission.aiVerificationCompletedAt"].$lte = new Date(endDate);
      }
    }
    
    // Project filtering
    if (projectId) {
      match["assignedProjectId"] = projectId;
    }
    
    // Status filtering
    if (verificationStatus) {
      match["projectSubmission.aiVerificationStatus"] = verificationStatus;
    }
    
    // Aggregate statistics
    const stats = await Candidate.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$projectSubmission.aiVerificationStatus",
          count: { $sum: 1 },
          avgConfidence: { $avg: "$projectSubmission.aiVerificationResult.confidence" },
          avgCompletionRate: { $avg: "$projectSubmission.verificationStats.requirementsCompletionRate" },
          avgCodeQuality: { $avg: "$projectSubmission.verificationStats.codeQualityScore" },
          avgOrganization: { $avg: "$projectSubmission.verificationStats.organizationScore" },
          avgDocumentation: { $avg: "$projectSubmission.verificationStats.documentationScore" }
        }
      },
      {
        $project: {
          status: "$_id",
          count: 1,
          avgConfidence: { $round: ["$avgConfidence", 2] },
          avgCompletionRate: { $round: ["$avgCompletionRate", 2] },
          avgCodeQuality: { $round: ["$avgCodeQuality", 2] },
          avgOrganization: { $round: ["$avgOrganization", 2] },
          avgDocumentation: { $round: ["$avgDocumentation", 2] }
        }
      }
    ]);
    
    // Total counts
    const totalCandidates = await Candidate.countDocuments(match);
    const verifiedCount = await Candidate.countDocuments({
      ...match,
      "projectSubmission.aiVerificationStatus": "verified"
    });
    const reviewCount = await Candidate.countDocuments({
      ...match,
      "projectSubmission.aiVerificationStatus": "needs_admin_review"
    });
    const rejectedCount = await Candidate.countDocuments({
      ...match,
      "projectSubmission.aiVerificationStatus": "rejected"
    });
    
    return {
      success: true,
      report: {
        summary: {
          totalCandidates,
          verifiedCount,
          reviewCount,
          rejectedCount,
          verificationRate: totalCandidates > 0 ? (verifiedCount / totalCandidates) * 100 : 0,
          reviewRate: totalCandidates > 0 ? (reviewCount / totalCandidates) * 100 : 0
        },
        detailedStats: stats,
        generatedAt: new Date().toISOString()
      }
    };
    
  } catch (error) {
    logger.error("Failed to generate verification report:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize admin review workflow
 */
async function initializeAdminReviewWorkflow(candidateId, verificationResult) {
  try {
    // Call admin review initialization endpoint
    // In a production system, this would be an internal API call or direct service call
    logger.info(`Initializing admin review workflow for candidate ${candidateId}`);
    
    // For now, we'll simulate the initialization
    // In a real implementation, we would call:
    // await adminReviewWorkflow.initializeAdminReview(candidateId, verificationResult);
    
    // Add to activity log
    await Candidate.findByIdAndUpdate(candidateId, {
      $push: {
        activity: {
          id: `admin_review_init_${Date.now()}`,
          label: "Admin Review Initiated",
          description: "Project requires admin review due to AI uncertainty",
          timestamp: new Date(),
          state: "current",
          metadata: {
            verificationStatus: verificationResult.status,
            confidence: verificationResult.confidence,
            reviewReasons: verificationResult.detailedAnalysis?.reviewReasons || []
          }
        }
      }
    });
    
    logger.info(`Admin review workflow initialized for candidate ${candidateId}`);
    
  } catch (error) {
    logger.error(`Failed to initialize admin review workflow for candidate ${candidateId}:`, error);
  }
}

/**
 * Helper: Map quality text to numeric score
 */
function mapQualityToNumericScore(quality) {
  const mapping = {
    "EXCELLENT": 1.0,
    "GOOD": 0.8,
    "FAIR": 0.6,
    "POOR": 0.3,
    "UNKNOWN": 0.5
  };
  
  return mapping[quality?.toUpperCase()] || 0.5;
}