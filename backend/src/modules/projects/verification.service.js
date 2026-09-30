import { projectVerificationPrompt } from "../ai/ai.prompt.js";
import { generateStructuredAI } from "../ai/ai.service.js";
import { validateRepositoryUrl, fetchRepositoryContent } from "./repository.service.js";
import logger from "../../utils/logger.js";

/**
 * Project Verification Service
 * 
 * Handles AI-powered verification of student project submissions
 * against project requirements with safety-first approach.
 */

const VERIFICATION_STATUS = {
  VERIFIED: "VERIFIED",
  NEEDS_ADMIN_REVIEW: "NEEDS_ADMIN_REVIEW",
  REJECTED: "REJECTED",
  PENDING: "PENDING",
  ERROR: "ERROR"
};

/**
 * Structure repository content for AI analysis
 */
function structureRepositoryContent(repoData) {
  const { structure, keyFiles, metadata, statistics } = repoData;
  
  return {
    structure: {
      files: structure?.files || [],
      directories: structure?.directories || [],
      size: structure?.size || "unknown",
      languageBreakdown: statistics?.languages || {}
    },
    keyFiles: keyFiles || {},
    metadata: {
      totalCommits: statistics?.totalCommits || 0,
      recentActivity: statistics?.lastCommit || "unknown",
      dependencies: metadata?.dependencies || [],
      buildFiles: metadata?.buildFiles || []
    }
  };
}

/**
 * Prepare project requirements for verification
 */
function prepareProjectRequirements(project) {
  return {
    title: project.title || "Untitled Project",
    description: project.description || "",
    difficulty: project.difficulty || "intermediate",
    requirements: project.requirements || [],
    technologyStack: project.technologyStack || [],
    expectedFiles: project.expectedFiles || [],
    minimalFeatures: project.minimalFeatures || [],
    evaluationCriteria: project.evaluationCriteria || {
      functionality: 0.4,
      codeQuality: 0.3,
      documentation: 0.2,
      creativity: 0.1
    },
    deadline: project.deadline,
    maxSizeMB: project.maxSizeMB || 50
  };
}

/**
 * Prepare AI messages for verification
 */
function prepareVerificationMessages(projectRequirements, repositoryContent) {
  const systemPrompt = projectVerificationPrompt;
  
  const userPrompt = {
    PROJECT_REQUIREMENTS: projectRequirements,
    REPOSITORY_CONTENT: repositoryContent,
    METADATA: {
      analysisTimestamp: new Date().toISOString(),
      safetyNote: "NO_CODE_EXECUTION - Analysis based on static content only"
    }
  };
  
  return [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: JSON.stringify(userPrompt, null, 2)
    }
  ];
}

/**
 * Validate verification result structure
 */
function validateVerificationResult(result) {
  if (!result) {
    throw new Error("Empty verification result");
  }
  
  const validStatuses = ["VERIFIED", "NEEDS_ADMIN_REVIEW", "REJECTED"];
  
  if (!validStatuses.includes(result.verificationStatus)) {
    throw new Error(`Invalid verification status: ${result.verificationStatus}`);
  }
  
  if (typeof result.confidence !== "number" || result.confidence < 0 || result.confidence > 1) {
    throw new Error(`Invalid confidence value: ${result.confidence}`);
  }
  
  if (!result.summary || typeof result.summary !== "string") {
    throw new Error("Missing or invalid summary");
  }
  
  // Basic structure validation
  const requiredSections = ["detailedAnalysis", "recommendations", "verificationMetadata"];
  for (const section of requiredSections) {
    if (!result[section] || typeof result[section] !== "object") {
      throw new Error(`Missing or invalid section: ${section}`);
    }
  }
  
  return true;
}

/**
 * Main verification function
 */
export async function verifyProjectSubmission(candidateId, projectId, repositoryUrl) {
  const startTime = Date.now();
  
  try {
    logger.info(`Starting verification for candidate ${candidateId}, project ${projectId}`);
    
    // Step 1: Validate repository URL
    logger.debug("Validating repository URL");
    const urlValidation = validateRepositoryUrl(repositoryUrl);
    if (!urlValidation.isValid) {
      logger.warn(`Invalid repository URL: ${urlValidation.error}`);
      return {
        status: VERIFICATION_STATUS.REJECTED,
        confidence: 0.1,
        summary: `Invalid repository URL: ${urlValidation.error}`,
        detailedAnalysis: {
          repositoryValidity: {
            isValid: false,
            issues: [`URL validation failed: ${urlValidation.error}`],
            strengths: []
          },
          requirementsAssessment: [],
          technicalEvaluation: {
            codeQuality: "POOR",
            projectOrganization: "POOR",
            documentation: "POOR",
            issuesFound: ["Invalid repository URL"]
          },
          overallAssessment: "Repository URL is invalid or inaccessible."
        },
        recommendations: {
          forStudent: ["Please provide a valid GitHub repository URL"],
          forReviewer: []
        },
        verificationMetadata: {
          filesAnalyzed: 0,
          requirementsTotal: 0,
          requirementsMet: 0,
          requirementsPartial: 0,
          requirementsMissing: 0,
          analysisTimestamp: new Date().toISOString(),
          error: urlValidation.error
        },
        rawData: null
      };
    }
    
    // Step 2: Fetch project data (in real implementation, this would come from database)
    // For now, using mock project data structure
    const mockProject = {
      id: projectId,
      title: "Sample Project",
      description: "A sample project for verification",
      difficulty: "intermediate",
      requirements: [
        {
          id: "req-1",
          description: "Implement core functionality",
          type: "feature",
          critical: true
        },
        {
          id: "req-2",
          description: "Include README documentation",
          type: "documentation",
          critical: false
        }
      ],
      technologyStack: ["JavaScript", "Node.js"],
      expectedFiles: ["package.json", "README.md"],
      minimalFeatures: ["API endpoints", "Database integration"],
      evaluationCriteria: {
        functionality: 0.4,
        codeQuality: 0.3,
        documentation: 0.2,
        creativity: 0.1
      }
    };
    
    const projectRequirements = prepareProjectRequirements(mockProject);
    
    // Step 3: Fetch repository content safely
    logger.debug("Fetching repository content");
    const repoContent = await fetchRepositoryContent(repositoryUrl);
    
    if (!repoContent.success) {
      logger.warn(`Failed to fetch repository: ${repoContent.error}`);
      return {
        status: VERIFICATION_STATUS.REJECTED,
        confidence: 0.2,
        summary: `Repository access failed: ${repoContent.error}`,
        detailedAnalysis: {
          repositoryValidity: {
            isValid: false,
            issues: [`Repository access failed: ${repoContent.error}`],
            strengths: []
          },
          requirementsAssessment: [],
          technicalEvaluation: {
            codeQuality: "POOR",
            projectOrganization: "POOR",
            documentation: "POOR",
            issuesFound: ["Repository inaccessible"]
          },
          overallAssessment: "Could not access repository content for verification."
        },
        recommendations: {
          forStudent: ["Please ensure the repository is publicly accessible"],
          forReviewer: []
        },
        verificationMetadata: {
          filesAnalyzed: 0,
          requirementsTotal: projectRequirements.requirements.length,
          requirementsMet: 0,
          requirementsPartial: 0,
          requirementsMissing: projectRequirements.requirements.length,
          analysisTimestamp: new Date().toISOString(),
          error: repoContent.error
        },
        rawData: null
      };
    }
    
    // Step 4: Structure data for AI analysis
    const structuredRepoContent = structureRepositoryContent(repoContent.data);
    
    // Step 5: Prepare and call AI for verification
    logger.debug("Preparing AI verification request");
    const messages = prepareVerificationMessages(projectRequirements, structuredRepoContent);
    
    logger.info("Calling AI for project verification");
    const aiResult = await generateStructuredAI(messages);
    
    // Step 6: Validate and process AI result
    validateVerificationResult(aiResult);
    
    const verificationTime = Date.now() - startTime;
    logger.info(`Verification completed in ${verificationTime}ms with status: ${aiResult.verificationStatus}`);
    
    // Step 7: Add metadata to result
    const finalResult = {
      ...aiResult,
      verificationMetadata: {
        ...aiResult.verificationMetadata,
        candidateId,
        projectId,
        repositoryUrl,
        verificationTimeMs: verificationTime,
        aiModel: process.env.GROQ_MODEL || "llama3-70b-8192",
        rawDataSize: JSON.stringify(structuredRepoContent).length
      },
      rawData: {
        projectRequirements,
        repositoryContent: structuredRepoContent,
        repoMetadata: repoContent.data.metadata
      }
    };
    
    return finalResult;
    
  } catch (error) {
    const verificationTime = Date.now() - startTime;
    logger.error(`Verification failed after ${verificationTime}ms:`, error);
    
    return {
      status: VERIFICATION_STATUS.ERROR,
      confidence: 0,
      summary: `Verification error: ${error.message}`,
      detailedAnalysis: {
        repositoryValidity: {
          isValid: false,
          issues: [`Verification process error: ${error.message}`],
          strengths: []
        },
        requirementsAssessment: [],
        technicalEvaluation: {
          codeQuality: "UNKNOWN",
          projectOrganization: "UNKNOWN",
          documentation: "UNKNOWN",
          issuesFound: ["Verification process failed"]
        },
        overallAssessment: "An error occurred during the verification process."
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
        error: error.message,
        verificationTimeMs: verificationTime,
        candidateId,
        projectId,
        repositoryUrl
      },
      rawData: null
    };
  }
}

/**
 * Process verification result for database storage
 */
export function processVerificationForStorage(verificationResult, candidateId, projectId) {
  if (!verificationResult) {
    throw new Error("No verification result to process");
  }
  
  const {
    verificationStatus,
    confidence,
    summary,
    detailedAnalysis,
    recommendations,
    verificationMetadata,
    rawData
  } = verificationResult;
  
  // Extract key metrics for quick querying
  const requirementsAssessment = detailedAnalysis?.requirementsAssessment || [];
  const requirementsTotal = verificationMetadata?.requirementsTotal || requirementsAssessment.length;
  const requirementsMet = requirementsAssessment.filter(req => req.status === "MET").length;
  const requirementsPartial = requirementsAssessment.filter(req => req.status === "PARTIAL").length;
  const requirementsMissing = requirementsAssessment.filter(req => req.status === "MISSING").length;
  
  return {
    candidateId,
    projectId,
    status: verificationStatus,
    confidence,
    summary,
    
    // Key metrics
    requirementsTotal,
    requirementsMet,
    requirementsPartial,
    requirementsMissing,
    requirementsCompletionRate: requirementsTotal > 0 ? requirementsMet / requirementsTotal : 0,
    
    // Technical evaluation scores
    codeQualityScore: mapQualityToScore(detailedAnalysis?.technicalEvaluation?.codeQuality),
    organizationScore: mapQualityToScore(detailedAnalysis?.technicalEvaluation?.projectOrganization),
    documentationScore: mapQualityToScore(detailedAnalysis?.technicalEvaluation?.documentation),
    
    // Recommendations
    studentRecommendations: recommendations?.forStudent || [],
    reviewerNotes: recommendations?.forReviewer || [],
    
    // Metadata
    verificationTimestamp: verificationMetadata?.analysisTimestamp || new Date().toISOString(),
    verificationDurationMs: verificationMetadata?.verificationTimeMs || 0,
    aiModel: verificationMetadata?.aiModel,
    repositoryUrl: verificationMetadata?.repositoryUrl,
    
    // Full data (can be stored separately or in compressed form)
    fullAnalysis: {
      detailedAnalysis,
      rawDataPreview: rawData ? {
        projectTitle: rawData.projectRequirements?.title,
        repoSize: rawData.repositoryContent?.structure?.size,
        filesAnalyzed: rawData.repositoryContent?.structure?.files?.length
      } : null
    }
  };
}

/**
 * Map quality text to numeric score
 */
function mapQualityToScore(quality) {
  const mapping = {
    "EXCELLENT": 1.0,
    "GOOD": 0.8,
    "FAIR": 0.6,
    "POOR": 0.3,
    "UNKNOWN": 0.5
  };
  
  return mapping[quality?.toUpperCase()] || 0.5;
}

/**
 * Check if verification result indicates admin review needed
 */
export function requiresAdminReview(verificationResult) {
  if (!verificationResult) return false;
  
  return verificationResult.verificationStatus === VERIFICATION_STATUS.NEEDS_ADMIN_REVIEW;
}

/**
 * Check if verification result is approved
 */
export function isVerificationApproved(verificationResult) {
  if (!verificationResult) return false;
  
  return verificationResult.verificationStatus === VERIFICATION_STATUS.VERIFIED;
}

/**
 * Get verification statistics for reporting
 */
export function getVerificationStatistics(verificationResult) {
  if (!verificationResult) return null;
  
  const { verificationMetadata, detailedAnalysis } = verificationResult;
  
  return {
    status: verificationResult.verificationStatus,
    confidence: verificationResult.confidence,
    filesAnalyzed: verificationMetadata?.filesAnalyzed || 0,
    requirements: {
      total: verificationMetadata?.requirementsTotal || 0,
      met: verificationMetadata?.requirementsMet || 0,
      partial: verificationMetadata?.requirementsPartial || 0,
      missing: verificationMetadata?.requirementsMissing || 0
    },
    qualityScores: {
      codeQuality: detailedAnalysis?.technicalEvaluation?.codeQuality,
      organization: detailedAnalysis?.technicalEvaluation?.projectOrganization,
      documentation: detailedAnalysis?.technicalEvaluation?.documentation
    },
    timestamp: verificationMetadata?.analysisTimestamp
  };
}

export { VERIFICATION_STATUS };