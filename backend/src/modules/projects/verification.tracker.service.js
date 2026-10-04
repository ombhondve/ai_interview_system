import { verifyProjectSubmission, VERIFICATION_STATUS } from "./verification.service.js";
import { 
  storeVerificationResult, 
  setVerificationProcessing, 
  getVerificationResult,
  getCandidatesNeedingAdminReview,
  updateAdminReview,
  getVerificationReport
} from "../candidate/verification.storage.service.js";
import logger from "../../utils/logger.js";

/**
 * Verification Tracker Service
 * 
 * Manages the complete verification workflow with status tracking,
 * retry logic, and monitoring.
 */

class VerificationTracker {
  constructor() {
    this.activeVerifications = new Map(); // candidateId -> verification data
    this.statusListeners = new Set(); // Callbacks for status updates
    this.retryConfig = {
      maxRetries: 3,
      retryDelayMs: 5000,
      backoffFactor: 2
    };
  }

  /**
   * Register status listener
   */
  addStatusListener(listener) {
    this.statusListeners.add(listener);
  }

  /**
   * Remove status listener
   */
  removeStatusListener(listener) {
    this.statusListeners.delete(listener);
  }

  /**
   * Notify all listeners of status change
   */
  notifyStatusChange(candidateId, status, data) {
    const event = {
      candidateId,
      timestamp: new Date().toISOString(),
      status,
      data
    };

    this.statusListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        logger.error(`Error in status listener:`, error);
      }
    });
  }

  /**
   * Get verification status for a candidate
   */
  async getVerificationStatus(candidateId) {
    try {
      const result = await getVerificationResult(candidateId);
      
      if (!result.success) {
        return {
          status: "ERROR",
          message: result.error,
          lastUpdated: new Date().toISOString()
        };
      }

      const isActive = this.activeVerifications.has(candidateId);
      const activeInfo = isActive ? this.activeVerifications.get(candidateId) : null;

      return {
        status: result.status || "unknown",
        submissionStatus: result.submissionStatus || "unknown",
        verificationResult: result.verificationResult,
        stats: result.stats,
        adminReview: result.adminReview,
        isActive,
        activeInfo: activeInfo ? {
          startedAt: activeInfo.startedAt,
          attempts: activeInfo.attempts,
          lastAttempt: activeInfo.lastAttempt
        } : null,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Failed to get verification status for candidate ${candidateId}:`, error);
      return {
        status: "ERROR",
        message: error.message,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Start verification process for a candidate
   */
  async startVerification(candidateId, projectId, repositoryUrl, submissionId) {
    try {
      // Check if already being verified.
      // When a new submission arrives it gets a NEW submissionId, so a
      // previous in-flight verification must not block the new one.
      if (this.activeVerifications.has(candidateId)) {
        const active = this.activeVerifications.get(candidateId);

        if (active.submissionId === submissionId) {
          return {
            success: false,
            message: "Verification already in progress",
            candidateId,
            startedAt: active.startedAt,
            attempts: active.attempts
          };
        }
      }

      // Set status to processing in database (guarded by submissionId so a
      // stale job can never move the NEW submission into "processing").
      const processingResult = await setVerificationProcessing(candidateId, submissionId);
      if (!processingResult.success) {
        return {
          success: false,
          message: `Failed to set processing status: ${processingResult.error}`,
          candidateId
        };
      }

      // Track verification
      const verificationData = {
        candidateId,
        projectId,
        repositoryUrl,
        // Identifies the submission this verification belongs to. Used to
        // discard results from a superseded submission.
        submissionId,
        startedAt: new Date().toISOString(),
        attempts: 0,
        lastAttempt: null,
        completed: false,
        result: null
      };

      this.activeVerifications.set(candidateId, verificationData);

      // Notify status change
      this.notifyStatusChange(candidateId, "PROCESSING_STARTED", {
        candidateId,
        projectId,
        repositoryUrl
      });

      // Start async verification.
      //
      // The promise is returned to the caller so the HTTP layer can register it
      // with the platform's background-execution primitive (Vercel waitUntil)
      // and keep the invocation alive until verification has actually
      // finished. Without this the returned promise would settle immediately
      // and the invocation could be terminated mid-verification.
      const verificationPromise = this.executeVerification(
        candidateId,
        projectId,
        repositoryUrl,
        submissionId
      );

      // Defensive: executeVerification handles its own errors internally, but
      // never leave an unhandled rejection attached to the returned promise.
      verificationPromise.catch((error) => {
        logger.error(
          `Unhandled error during verification for candidate ${candidateId}:`,
          error
        );
      });

      return {
        success: true,
        message: "Verification started",
        candidateId,
        startedAt: verificationData.startedAt,
        trackingId: `verify_${candidateId}_${Date.now()}`,
        // Full verification lifecycle (GitHub -> AI -> storage).
        verificationPromise
      };

    } catch (error) {
      logger.error(`Failed to start verification for candidate ${candidateId}:`, error);
      
      // Clean up tracking if error
      this.activeVerifications.delete(candidateId);
      
      return {
        success: false,
        message: `Failed to start verification: ${error.message}`,
        candidateId
      };
    }
  }

  /**
   * Execute verification with retry logic
   */
  async executeVerification(candidateId, projectId, repositoryUrl, submissionId) {
    const verificationData = this.activeVerifications.get(candidateId);
    if (!verificationData) {
      logger.warn(`No verification data found for candidate ${candidateId}`);
      return;
    }

    let attempt = 1;
    let lastError = null;

    while (attempt <= this.retryConfig.maxRetries) {
      try {
        verificationData.attempts = attempt;
        verificationData.lastAttempt = new Date().toISOString();

        // Notify attempt start
        this.notifyStatusChange(candidateId, "VERIFICATION_ATTEMPT", {
          attempt,
          totalAttempts: this.retryConfig.maxRetries
        });

        logger.info(`Verification attempt ${attempt} for candidate ${candidateId}`);

        // Execute verification
        const result = await verifyProjectSubmission(candidateId, projectId, repositoryUrl);

        // Store result
        const storageResult = await storeVerificationResult(
          candidateId,
          result,
          submissionId
        );

        if (!storageResult.success) {
          throw new Error(`Failed to store verification result: ${storageResult.error}`);
        }

        // Update tracking data
        verificationData.completed = true;
        verificationData.result = result;
        verificationData.completedAt = new Date().toISOString();
        verificationData.storageResult = storageResult;

        // Notify completion
        this.notifyStatusChange(candidateId, "VERIFICATION_COMPLETED", {
          status: result.status,
          confidence: result.confidence,
          requiresAdminReview: storageResult.requiresAdminReview,
          attempt,
          totalTimeMs: Date.now() - new Date(verificationData.startedAt).getTime()
        });

        logger.info(`Verification completed for candidate ${candidateId}, status: ${result.status}`);

        // Remove from active verifications after delay
        setTimeout(() => {
          this.activeVerifications.delete(candidateId);
        }, 30000); // Keep in memory for 30 seconds for status queries

        return;

      } catch (error) {
        lastError = error;
        logger.error(`Verification attempt ${attempt} failed for candidate ${candidateId}:`, error);

        // Notify failure
        this.notifyStatusChange(candidateId, "VERIFICATION_FAILED", {
          attempt,
          error: error.message,
          retryable: attempt < this.retryConfig.maxRetries
        });

        // Check if should retry
        if (attempt < this.retryConfig.maxRetries) {
          const delay = this.retryConfig.retryDelayMs * Math.pow(this.retryConfig.backoffFactor, attempt - 1);
          
          // Notify retry delay
          this.notifyStatusChange(candidateId, "VERIFICATION_RETRY_DELAY", {
            attempt,
            nextAttempt: attempt + 1,
            delayMs: delay
          });

          await this.delay(delay);
          attempt++;
        } else {
          break;
        }
      }
    }

    // All attempts failed
    verificationData.completed = true;
    verificationData.failed = true;
    verificationData.error = lastError?.message;
    verificationData.completedAt = new Date().toISOString();

    // Update database with error status
    try {
      await storeVerificationResult(candidateId, {
        status: VERIFICATION_STATUS.ERROR,
        confidence: 0,
        summary: `Verification failed after ${this.retryConfig.maxRetries} attempts`,
        detailedAnalysis: {
          repositoryValidity: {
            isValid: false,
            issues: [`Verification process failed: ${lastError?.message}`],
            strengths: []
          },
          requirementsAssessment: [],
          technicalEvaluation: {
            codeQuality: "UNKNOWN",
            projectOrganization: "UNKNOWN",
            documentation: "UNKNOWN",
            issuesFound: ["Verification process error"]
          },
          overallAssessment: "Verification could not be completed due to system error."
        },
        recommendations: {
          forStudent: ["System error occurred, please try again or contact support"],
          forReviewer: ["Verification system error needs investigation"]
        },
        verificationMetadata: {
          filesAnalyzed: 0,
          requirementsTotal: 0,
          requirementsMet: 0,
          requirementsPartial: 0,
          requirementsMissing: 0,
          analysisTimestamp: new Date().toISOString(),
          error: lastError?.message,
          attempts: this.retryConfig.maxRetries
        }
      });
    } catch (storageError) {
      logger.error(`Failed to store error result for candidate ${candidateId}:`, storageError);
    }

    // Notify final failure
    this.notifyStatusChange(candidateId, "VERIFICATION_FINAL_FAILURE", {
      attempts: this.retryConfig.maxRetries,
      error: lastError?.message,
      finalStatus: "ERROR"
    });

    // Remove from active verifications after delay
    setTimeout(() => {
      this.activeVerifications.delete(candidateId);
    }, 30000);

    logger.error(`Verification failed for candidate ${candidateId} after ${this.retryConfig.maxRetries} attempts`);
  }

  /**
   * Get active verifications
   */
  getActiveVerifications() {
    const active = [];
    
    for (const [candidateId, data] of this.activeVerifications.entries()) {
      active.push({
        candidateId,
        projectId: data.projectId,
        repositoryUrl: data.repositoryUrl,
        startedAt: data.startedAt,
        attempts: data.attempts,
        lastAttempt: data.lastAttempt,
        completed: data.completed,
        status: data.completed ? (data.failed ? "FAILED" : "COMPLETED") : "IN_PROGRESS"
      });
    }
    
    return active;
  }

  /**
   * Get verification statistics
   */
  async getStatistics(options = {}) {
    try {
      const report = await getVerificationReport(options);
      
      if (!report.success) {
        return {
          success: false,
          error: report.error
        };
      }

      // Add active verification stats
      const activeVerifications = this.getActiveVerifications();
      const inProgress = activeVerifications.filter(v => !v.completed).length;
      const completedRecently = activeVerifications.filter(v => 
        v.completed && !v.failed && 
        Date.now() - new Date(v.startedAt).getTime() < 300000 // Last 5 minutes
      ).length;

      const enhancedReport = {
        ...report.report,
        active: {
          inProgress,
          completedRecently,
          totalActive: activeVerifications.length
        },
        tracking: {
          totalTracked: this.activeVerifications.size,
          listeners: this.statusListeners.size
        }
      };

      return {
        success: true,
        report: enhancedReport,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error("Failed to get verification statistics:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get candidates needing admin review (with enhanced info)
   */
  async getAdminReviewCandidates(options = {}) {
    try {
      const result = await getCandidatesNeedingAdminReview(options);
      
      if (!result.success) {
        return result;
      }

      // Enhance with verification details
      const enhancedCandidates = await Promise.all(
        result.candidates.map(async candidate => {
          const status = await this.getVerificationStatus(candidate._id);
          return {
            ...candidate,
            verificationStatus: status
          };
        })
      );

      return {
        success: true,
        candidates: enhancedCandidates,
        pagination: result.pagination
      };

    } catch (error) {
      logger.error("Failed to get admin review candidates:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process admin review decision
   */
  async processAdminReview(candidateId, reviewData, adminId) {
    try {
      const result = await updateAdminReview(candidateId, reviewData, adminId);
      
      if (!result.success) {
        return result;
      }

      // Notify admin review decision
      this.notifyStatusChange(candidateId, "ADMIN_REVIEW_DECISION", {
        decision: reviewData.finalDecision || reviewData.status,
        adminId,
        candidateId,
        newStatus: result.newStatus
      });

      return result;

    } catch (error) {
      logger.error(`Failed to process admin review for candidate ${candidateId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cancel active verification
   */
  async cancelVerification(candidateId, reason = "Cancelled by user") {
    try {
      const verificationData = this.activeVerifications.get(candidateId);
      
      if (!verificationData) {
        return {
          success: false,
          message: "No active verification found",
          candidateId
        };
      }

      // Update database with cancelled status
      await storeVerificationResult(candidateId, {
        status: VERIFICATION_STATUS.ERROR,
        confidence: 0,
        summary: `Verification cancelled: ${reason}`,
        detailedAnalysis: {
          repositoryValidity: {
            isValid: false,
            issues: [`Verification cancelled: ${reason}`],
            strengths: []
          },
          requirementsAssessment: [],
          technicalEvaluation: {
            codeQuality: "UNKNOWN",
            projectOrganization: "UNKNOWN",
            documentation: "UNKNOWN",
            issuesFound: ["Verification cancelled"]
          },
          overallAssessment: "Verification was cancelled before completion."
        },
        recommendations: {
          forStudent: ["Verification was cancelled. You can submit again if needed."],
          forReviewer: []
        },
        verificationMetadata: {
          filesAnalyzed: 0,
          requirementsTotal: 0,
          requirementsMet: 0,
          requirementsPartial: 0,
          requirementsMissing: 0,
          analysisTimestamp: new Date().toISOString(),
          cancelled: true,
          reason,
          attempts: verificationData.attempts
        }
      });

      // Remove from active verifications
      this.activeVerifications.delete(candidateId);

      // Notify cancellation
      this.notifyStatusChange(candidateId, "VERIFICATION_CANCELLED", {
        reason,
        attempts: verificationData.attempts,
        candidateId
      });

      logger.info(`Verification cancelled for candidate ${candidateId}: ${reason}`);

      return {
        success: true,
        message: "Verification cancelled",
        candidateId,
        reason
      };

    } catch (error) {
      logger.error(`Failed to cancel verification for candidate ${candidateId}:`, error);
      return {
        success: false,
        message: `Failed to cancel verification: ${error.message}`,
        candidateId
      };
    }
  }

  /**
   * Reset verification for retry
   */
  async resetVerification(candidateId) {
    try {
      // Get current candidate data
      const candidate = await getVerificationResult(candidateId);
      
      if (!candidate.success) {
        return {
          success: false,
          message: `Failed to get candidate data: ${candidate.error}`,
          candidateId
        };
      }

      // Clear any active verification
      this.activeVerifications.delete(candidateId);

      // Reset database status
      // This would require updating the candidate model to reset verification status
      // For now, return instructions
      
      return {
        success: true,
        message: "Verification reset initiated. Candidate needs to resubmit project URL.",
        candidateId,
        currentStatus: candidate.status
      };

    } catch (error) {
      logger.error(`Failed to reset verification for candidate ${candidateId}:`, error);
      return {
        success: false,
        message: `Failed to reset verification: ${error.message}`,
        candidateId
      };
    }
  }

  /**
   * Helper: Delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
const verificationTracker = new VerificationTracker();

export default verificationTracker;

// Export individual functions for convenience
export {
  VerificationTracker,
  verificationTracker
};