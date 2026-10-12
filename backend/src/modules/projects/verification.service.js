import { projectVerificationPrompt } from "../ai/ai.prompt.js";
import { generateStructuredAI } from "../ai/ai.service.js";
import { validateRepositoryUrl, fetchRepositoryContent } from "./repository.service.js";
import { checkRepositorySyntax } from "./syntaxChecker.js";
import {
  buildCompactRepository,
  enforcePayloadBudget,
  estimateTokens,
  getMaxInputTokens,
  getUserPayloadBudgetChars,
  getRepositoryBudgetChars
} from "./aiPayloadBudget.js";
import logger from "../../utils/logger.js";
import {
  markStageActive,
  markStageCompleted,
  markStageFailed
} from "./verificationProgress.service.js";

/**
 * Project Verification Service
 *
 * Handles AI-powered verification of student project submissions
 * against project requirements with safety-first approach.
 */

const VERIFICATION_STATUS = {
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
  PENDING: "PENDING",
  ERROR: "ERROR"
};

/**
 * Run a verification stage, recording its REAL start/completion.
 *
 * The stage writer is fire-and-forget and never throws, so this cannot fail a
 * verification. It does NOT add any artificial delay to the backend.
 *
 * @param {string} candidateId
 * @param {string} submissionId
 * @param {string} stage
 * @param {Function} work
 */
async function runStage(candidateId, submissionId, stage, work) {
  await markStageActive(candidateId, submissionId, stage);

  try {
    const result = await work();

    // A stage that returns an early-exit verdict is NOT a successful stage:
    // it failed, and the persisted message carries the real reason.
    if (result && result.__earlyExit) {
      await markStageFailed(
        candidateId,
        submissionId,
        stage,
        result.summary || "Verification could not continue."
      );
      return result;
    }

    await markStageCompleted(candidateId, submissionId, stage);
    return result;
  } catch (error) {
    await markStageFailed(
      candidateId,
      submissionId,
      stage,
      error?.message || "Stage failed."
    );
    throw error;
  }
}

/**
 * Structure repository content for AI analysis
 * 
 * IMPORTANT: Now includes ACTUAL FILE CONTENT for evidence-based verification
 */
function structureRepositoryContent(repoData) {
  const { structure, keyFiles, metadata, statistics, readme, security } = repoData;
  
  // Format file structure with actual content
  const formattedKeyFiles = {};
  if (keyFiles && typeof keyFiles === 'object') {
    Object.entries(keyFiles).forEach(([path, fileData]) => {
      formattedKeyFiles[path] = {
        content: fileData.content || null,
        size: fileData.size || 0,
        truncated: fileData.truncated || false,
        type: fileData.type || 'unknown'
      };
    });
  }
  
  // Extract README content separately
  const readmeContent = readme?.content || 
                       (keyFiles && keyFiles['README.md']?.content) ||
                       (keyFiles && keyFiles['README.txt']?.content) ||
                       (keyFiles && keyFiles['readme.md']?.content);
  
  return {
    structure: {
      files: structure?.files || [],
      directories: structure?.directories || [],
      size: structure?.size || "unknown",
      languageBreakdown: statistics?.languages || {},
      totalFilesAnalyzed: metadata?.filesAnalyzed || 0,
      filesWithContent: Object.keys(formattedKeyFiles).length
    },
    keyFiles: formattedKeyFiles,
    metadata: {
      totalCommits: statistics?.totalCommits || 0,
      recentActivity: statistics?.lastCommit || "unknown",
      dependencies: metadata?.dependencies || [],
      buildFiles: metadata?.buildFiles || [],
      platform: metadata?.platform || "unknown",
      repositorySize: metadata?.totalSize || 0,
      readmeAvailable: !!readmeContent,
      security: security || {
        codeExecution: false,
        fileDownload: false,
        onlyMetadata: false
      }
    },
    readme: readmeContent ? {
      content: readmeContent.substring(0, 5000), // Limit to 5000 chars for AI
      truncated: readmeContent.length > 5000
    } : null
  };
}

/**
 * Prepare ACTUAL project requirements for verification
 * 
 * Converts MongoDB Project model to AI verification format
 * Distinguishes between REQUIRED/MUST VERIFY items and SUPPORTING CONTEXT
 */
function prepareProjectRequirements(project) {
  // Extract requirements from various project fields
  const allRequirements = [];
  
  // A. REQUIRED / MUST VERIFY items (explicit mandatory requirements)
  
  // 1. Core requirements array - explicitly required functionality
  if (project.requirements && Array.isArray(project.requirements)) {
    project.requirements.forEach((req, index) => {
      if (req && typeof req === 'string') {
        allRequirements.push({
          id: `core-req-${index + 1}`,
          description: req,
          type: "feature",
          critical: true,
          source: "requirements"
        });
      }
    });
  }
  
  // 2. Functional requirements - explicitly required functionality
  if (project.functionalRequirements && Array.isArray(project.functionalRequirements)) {
    project.functionalRequirements.forEach((req, index) => {
      if (req && typeof req === 'string') {
        allRequirements.push({
          id: `func-req-${index + 1}`,
          description: req,
          type: "feature",
          critical: true,
          source: "functionalRequirements"
        });
      }
    });
  }
  
  // 3. Deliverables - explicitly required deliverables
  if (project.deliverables && Array.isArray(project.deliverables)) {
    project.deliverables.forEach((deliverable, index) => {
      if (deliverable && typeof deliverable === 'string') {
        allRequirements.push({
          id: `deliverable-${index + 1}`,
          description: deliverable,
          type: "deliverable",
          critical: true,
          source: "deliverables"
        });
      }
    });
  }
  
  // 4. Module features - only if explicitly described as required functionality
  if (project.modules && Array.isArray(project.modules)) {
    project.modules.forEach((module, moduleIndex) => {
      if (module && module.name) {
        // Module name itself is supporting context, not a requirement
        // Only module.features if they explicitly describe required functionality
        if (module.features && Array.isArray(module.features)) {
          module.features.forEach((feature, featureIndex) => {
            if (feature && typeof feature === 'string') {
              // Features should be explicitly required functionality
              allRequirements.push({
                id: `module-${moduleIndex + 1}-feature-${featureIndex + 1}`,
                description: feature,
                type: "feature",
                critical: true,
                source: `modules[${moduleIndex}].features`
              });
            }
          });
        }
      }
    });
  }
  
  // B. NON-FUNCTIONAL REQUIREMENTS (supporting quality criteria, not mandatory features)
  const nonFunctionalRequirements = [];
  if (project.nonFunctionalRequirements && Array.isArray(project.nonFunctionalRequirements)) {
    project.nonFunctionalRequirements.forEach((req, index) => {
      if (req && typeof req === 'string') {
        nonFunctionalRequirements.push({
          id: `nonfunc-req-${index + 1}`,
          description: req,
          type: "quality",
          critical: false,
          source: "nonFunctionalRequirements"
        });
      }
    });
  }
  
  // C. SUPPORTING CONTEXT (help AI understand project, not mandatory requirements)
  
  // Extract expected files - only from explicitly required files, not suggested structure
  const expectedFiles = [];
  
  // Only include files explicitly mentioned in requirements/deliverables
  // Suggested folder structure is guidance, not mandatory
  const allText = [
    ...(project.requirements || []),
    ...(project.functionalRequirements || []),
    ...(project.deliverables || [])
  ].join(' ').toLowerCase();
  
  // Look for explicit file mentions in requirements
  const filePatterns = [
    /(?:create|implement|build|write|submit)\s+(?:a\s+)?([a-zA-Z0-9_-]+\.(?:js|ts|jsx|tsx|py|java|html|css|md|json|yml|yaml|xml))/gi,
    /(?:file|called|named)\s+["']?([a-zA-Z0-9_-]+\.[a-z]+)["']?/gi,
    /(?:package\.json|readme\.md|dockerfile)/gi
  ];
  
  filePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(allText)) !== null) {
      if (match[1]) {
        const fileName = match[1].toLowerCase();
        if (!expectedFiles.includes(fileName)) {
          expectedFiles.push(fileName);
        }
      }
    }
  });
  
  // Only add package.json and README.md if explicitly required by project type
  // Not automatically mandatory for every project
  const projectType = project.projectType || "fullstack";
  const requiresPackageJson = ["backend", "fullstack", "mobile", "ai_ml", "devops"].includes(projectType.toLowerCase());
  const requiresReadme = true; // README is generally expected but not critical
  
  if (requiresPackageJson && !expectedFiles.includes('package.json')) {
    expectedFiles.push('package.json');
  }
  
  if (requiresReadme && !expectedFiles.includes('readme.md')) {
    expectedFiles.push('README.md');
  }
  
  // D. EVALUATION CRITERIA (supporting context for AI assessment)
  const evaluationCriteria = {};
  if (project.evaluationCriteria && Array.isArray(project.evaluationCriteria)) {
    // Convert array to weighted object if needed
    project.evaluationCriteria.forEach(criterion => {
      if (criterion && criterion.criterion) {
        const key = criterion.criterion.toLowerCase().replace(/\s+/g, '_');
        evaluationCriteria[key] = criterion.weight / 100 || 0.25; // Default weight if not specified
      }
    });
  }
  
  // Fallback to default weights if no evaluation criteria
  if (Object.keys(evaluationCriteria).length === 0) {
    evaluationCriteria.functionality = 0.4;
    evaluationCriteria.code_quality = 0.3;
    evaluationCriteria.documentation = 0.2;
    evaluationCriteria.completeness = 0.1;
  }
  
  // E. SUPPORTING CONTEXT FIELDS (compact representation to preserve evidence budget)
  const supportingContext = {
    objectives: Array.isArray(project.objectives) ? project.objectives.slice(0, 5) : [],
    implementationPlan: Array.isArray(project.implementationPlan)
      ? project.implementationPlan.slice(0, 5).map(p => ({ phase: p.phase || p.name || "", tasks: Array.isArray(p.tasks) ? p.tasks.slice(0, 4) : [] }))
      : [],
    apiEndpoints: Array.isArray(project.apiEndpoints)
      ? project.apiEndpoints.slice(0, 10).map(e => ({ method: e.method || "", path: e.path || "" }))
      : [],
    databaseDesign: Array.isArray(project.databaseDesign)
      ? project.databaseDesign.slice(0, 5).map(d => ({ collectionName: d.collectionName || d.table || "", purpose: d.purpose || "" }))
      : [],
    testingPlan: Array.isArray(project.testingPlan) ? project.testingPlan.slice(0, 5) : [],
    suggestedFolderStructure: Array.isArray(project.suggestedFolderStructure) ? project.suggestedFolderStructure.slice(0, 10) : [],
    moduleNames: (project.modules || []).map(module => module.name).filter(Boolean)
  };

  
  return {
    title: project.title || "Untitled Project",
    description: project.description || "",
    difficulty: project.difficulty || "intermediate",
    
    // REQUIRED ITEMS: Explicit mandatory requirements
    requirements: allRequirements,
    
    // SUPPORTING QUALITY CRITERIA: Non-functional aspects
    nonFunctionalRequirements: nonFunctionalRequirements,
    
    // SUPPORTING CONTEXT: Help AI understand project scope
    supportingContext: supportingContext,
    
    // Technology stack and expected files
    technologyStack: project.technologies || [],
    expectedFiles: [...new Set(expectedFiles)], // Remove duplicates
    
    // Evaluation criteria for AI assessment
    evaluationCriteria: evaluationCriteria,
    
    // Project type for context
    projectType: project.projectType || "fullstack",
    
    // Additional context notes for AI
    contextNotes: {
      totalRequirements: allRequirements.length,
      totalNonFunctional: nonFunctionalRequirements.length,
      hasExplicitFileRequirements: expectedFiles.length > 0,
      requirementSources: [...new Set(allRequirements.map(req => req.source))]
    }
  };
}

/**
 * Prepare AI messages for verification
 *
 * The repository evidence is compacted and the serialised user payload is
 * hard-capped so the request can never exceed the model's TPM limit (which
 * previously produced HTTP 413 on large repositories). The system prompt and
 * the VERIFIED / REJECTED / REJECTED rules are unchanged.
 */
function prepareVerificationMessages(projectRequirements, repositoryContent) {
  const systemPrompt = projectVerificationPrompt;

  // The budget covers the whole request (system + user), because that is what
  // the provider counts as input tokens.
  const userBudget = getUserPayloadBudgetChars(systemPrompt.length);

  // Requirements are essential evidence and are never trimmed, so their size
  // is measured first and subtracted before the repository gets a share.
  // Otherwise a large requirement list would squeeze out all source evidence.
  const wrapperOverhead = JSON.stringify(
    { PROJECT_REQUIREMENTS: {}, REPOSITORY_CONTENT: {}, METADATA: {} },
    null,
    2
  ).length;
  const requirementsChars = JSON.stringify(projectRequirements, null, 2).length;
  const repoBudget = getRepositoryBudgetChars(requirementsChars, wrapperOverhead, systemPrompt.length);

  logger.info(
    `Verification evidence budget: user=${userBudget} ` +
      `requirements=${requirementsChars} repository=${repoBudget} chars`
  );


  // Compact evidence only - never the whole repository.
  const compact = buildCompactRepository(
    repositoryContent,
    projectRequirements,
    repoBudget
  );

  // Run deterministic static syntax parsing on retrieved files before AI analysis
  const syntaxCheck = checkRepositorySyntax(compact.content.keyFiles);

  const userPrompt = {
    PROJECT_REQUIREMENTS: projectRequirements,
    REPOSITORY_CONTENT: compact.content,
    METADATA: {
      analysisTimestamp: new Date().toISOString(),
      safetyNote: "NO_CODE_EXECUTION - Analysis based on static content only",
      evidenceScope: {
        note: "Repository content is trimmed to fit the model token budget. Files marked [truncated] are partial.",
        filesIncluded: compact.stats.filesIncluded,
        filesExcluded: compact.stats.filesExcludedByRules,
        filesDroppedForBudget: compact.stats.filesDroppedByBudget,
        truncatedFiles: compact.stats.truncatedFiles
      },
      DETERMINISTIC_CHECKS: {
        syntaxAnalysis: {
          performed: true,
          summary: syntaxCheck.summary,
          filesChecked: syntaxCheck.filesChecked,
          filesValid: syntaxCheck.filesValid,
          filesWithSyntaxErrors: syntaxCheck.filesWithSyntaxErrors,
          filesSkippedTruncated: syntaxCheck.filesSkippedTruncated,
          hasFatalSyntaxErrors: syntaxCheck.hasFatalSyntaxErrors,
          results: syntaxCheck.results
        }
      }
    }
  };

  // HARD cap: the serialised payload can never exceed the budget.
  const enforced = enforcePayloadBudget(userPrompt, userBudget);

  const totalChars = systemPrompt.length + enforced.content.length;
  const estimatedInputTokens = estimateTokens(systemPrompt) + estimateTokens(enforced.content);
  logger.info(
    `AI verification payload: ${totalChars} characters / approximately ` +
      `${estimatedInputTokens} tokens ` +
      `(repo section ${enforced.stats.finalChars} chars, budget ${userBudget}; ` +
      `files ${compact.stats.filesIncluded}/${compact.stats.filesConsidered} included, ` +
      `withinBudget=${enforced.stats.withinBudget}, configError=${!!enforced.stats.configurationError})`
  );

  // SAFE DIAGNOSTICS: counts, syntax results and sizes only, never file contents.
  logger.info(
    `AI input evidence: filesIncluded=${compact.stats.filesIncluded} ` +
      `filesExcluded=${compact.stats.filesExcludedByRules} ` +
      `filesDroppedForBudget=${compact.stats.filesDroppedByBudget} ` +
      `truncatedFiles=${compact.stats.truncatedFiles} ` +
      `syntaxErrors=${syntaxCheck.filesWithSyntaxErrors} ` +
      `payloadChars=${enforced.stats.finalChars}`
  );

  return {
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: enforced.content
      }
    ],
    payloadStats: {
      systemPromptChars: systemPrompt.length,
      userPayloadChars: enforced.content.length,
      totalChars,
      estimatedInputTokens,
      userBudget,
      enforcedStats: enforced.stats,
      compactStats: compact.stats,
      syntaxCheck
    }
  };
}


/**
 * Validate verification result structure
 */
function validateVerificationResult(result) {
  if (!result) {
    throw new Error("Empty verification result");
  }
  
  const validStatuses = ["VERIFIED", "REJECTED"];
  
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
export async function verifyProjectSubmission(candidateId, projectId, repositoryUrl, submissionId) {
  const startTime = Date.now();

  // Progress tracking is scoped to this submission and never throws, so a
  // legacy caller without a submissionId simply records nothing extra.
  const track = (stage, work) =>
    submissionId ? runStage(candidateId, submissionId, stage, work) : work();


  try {
    logger.info(`Starting verification for candidate ${candidateId}, project ${projectId}`);

    // Step 1: Validate repository URL
    logger.debug("Validating repository URL");
    const urlValidation = await track("validating", async () =>
      validateRepositoryUrl(repositoryUrl)
    );
    if (!urlValidation.valid) {
      logger.warn(`Invalid repository URL: ${urlValidation.error}`);
      // An invalid URL means no repository could be fetched and therefore no
      // evidence exists -> the validating stage is recorded as FAILED.
      if (submissionId) {
        await markStageFailed(
          candidateId,
          submissionId,
          "validating",
          `Invalid repository URL: ${urlValidation.error}`
        );
      }
      // An invalid URL means no repository could be fetched and therefore no
      // evidence exists -> REJECTED (verified-or-rejected; no admin-review state).
      return {
        status: VERIFICATION_STATUS.REJECTED,
        verificationStatus: VERIFICATION_STATUS.REJECTED,
        confidence: 0.3,
        summary: `Invalid repository URL, so automated verification could not obtain sufficient evidence: ${urlValidation.error}`,
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
    
    // Step 2: Fetch ACTUAL project data from MongoDB
    logger.debug(`Fetching actual project ${projectId} from database`);
    let actualProject = null;

    if (submissionId) {
      await markStageActive(candidateId, submissionId, "project_requirements");
    }

    try {
      // Import Project model dynamically to avoid circular dependencies
      const Project = (await import("./project.model.js")).default;
      
      // Fetch project with selected fields for verification
      actualProject = await Project.findById(projectId)
        .select("title description difficulty technologies requirements functionalRequirements nonFunctionalRequirements modules implementationPlan evaluationCriteria deliverables suggestedFolderStructure apiEndpoints databaseDesign testingPlan")
        .lean();
      
      if (!actualProject) {
        logger.warn(`Project ${projectId} not found in database`);
        if (submissionId) {
          await markStageFailed(
            candidateId,
            submissionId,
            "project_requirements",
            "Assigned project not found in database."
          );
        }
        // No project/evidence available -> REJECTED (verified-or-rejected contract).
        return {
          status: VERIFICATION_STATUS.REJECTED,
          verificationStatus: VERIFICATION_STATUS.REJECTED,
          confidence: 0.3,
          summary: `Project not found, so automated verification could not obtain sufficient evidence: invalid project ID`,
          detailedAnalysis: {
            repositoryValidity: {
              isValid: false,
              issues: [`Assigned project not found in database`],
              strengths: []
            },
            requirementsAssessment: [],
            technicalEvaluation: {
              codeQuality: "POOR",
              projectOrganization: "POOR",
              documentation: "POOR",
              issuesFound: ["Invalid project assignment"]
            },
            overallAssessment: "Cannot verify project: Assigned project does not exist in system."
          },
          recommendations: {
            forStudent: ["Please contact support: Your assigned project is invalid"],
            forReviewer: ["Project ID not found in database, candidate assignment issue"]
          },
          verificationMetadata: {
            filesAnalyzed: 0,
            requirementsTotal: 0,
            requirementsMet: 0,
            requirementsPartial: 0,
            requirementsMissing: 0,
            analysisTimestamp: new Date().toISOString(),
            error: `Project ${projectId} not found`
          },
          rawData: null
        };
      }
      
      logger.info(`Loaded actual project: ${actualProject.title} (${actualProject.difficulty})`);
      if (submissionId) {
        await markStageCompleted(
          candidateId,
          submissionId,
          "project_requirements"
        );
      }
      
    } catch (projectError) {
      logger.error(`Failed to fetch project ${projectId}:`, projectError);
      if (submissionId) {
        await markStageFailed(
          candidateId,
          submissionId,
          "project_requirements",
          `Project data access failed: ${projectError.message}`
        );
      }
      // System/data error accessing requirements -> technical ERROR
      return {
        status: VERIFICATION_STATUS.ERROR,
        verificationStatus: VERIFICATION_STATUS.ERROR,
        confidence: 0,
        summary: `Project data access failed: ${projectError.message}`,
        detailedAnalysis: {
          repositoryValidity: {
            isValid: false,
            issues: [`Failed to load project requirements: ${projectError.message}`],
            strengths: []
          },
          requirementsAssessment: [],
          technicalEvaluation: {
            codeQuality: "UNKNOWN",
            projectOrganization: "UNKNOWN",
            documentation: "UNKNOWN",
            issuesFound: ["Project data access error"]
          },
          overallAssessment: "Cannot verify project: System error accessing project requirements."
        },
        recommendations: {
          forStudent: ["System error occurred, please try again or contact support"],
          forReviewer: []
        },
        verificationMetadata: {
          filesAnalyzed: 0,
          requirementsTotal: 0,
          requirementsMet: 0,
          requirementsPartial: 0,
          requirementsMissing: 0,
          analysisTimestamp: new Date().toISOString(),
          error: `Project fetch failed: ${projectError.message}`,
          retryable: true
        },
        rawData: null
      };
    }
    
    const projectRequirements = prepareProjectRequirements(actualProject);

    // Step 3: Fetch repository content safely
    logger.info("Fetching repository content for verification");
    if (submissionId) {
      await markStageActive(candidateId, submissionId, "repository");
    }
    const repoContent = await fetchRepositoryContent(repositoryUrl, {
      expectedFiles: projectRequirements?.expectedFiles
    });
    
    if (!repoContent.success) {
      // -----------------------------------------------------------------
      // A repository FETCH FAILURE yields REJECTED under the
      // verified-or-rejected contract (there is no admin-review state).
      //
      // A timeout, network error, GitHub API outage, 5xx, rate limit, 404,
      // empty repo, etc. means we could not obtain enough evidence to run
      // automated verification, so the outcome is REJECTED with a summary
      // that records the real cause for the student.
      //
      // The AI verification stage is intentionally NOT called here, so the
      // model is never fed empty/incomplete content produced by a failure.
      // -----------------------------------------------------------------
      const errorType = repoContent.metadata?.errorType || "repository_fetch_failure";

      logger.warn(
        `Failed to fetch repository (${errorType}): ${repoContent.error}`
      );

      if (submissionId) {
        await markStageFailed(
          candidateId,
          submissionId,
          "repository",
          repoContent.error || "Unable to access repository."
        );
      }

      // If repository is confirmed empty: demonstrably fails feature implementation -> REJECTED
      if (errorType === "empty_repository") {
        return {
          status: VERIFICATION_STATUS.REJECTED,
          verificationStatus: VERIFICATION_STATUS.REJECTED,
          confidence: 0.1,
          summary: "The submitted repository appears to be empty or contains no project files.",
          detailedAnalysis: {
            repositoryValidity: {
              isValid: false,
              issues: ["Repository is empty"],
              strengths: []
            },
            requirementsAssessment: [],
            technicalEvaluation: {
              codeQuality: "POOR",
              projectOrganization: "POOR",
              documentation: "POOR",
              issuesFound: ["Empty repository"]
            },
            overallAssessment: "Repository contains no project implementation files. Mandatory requirements could not be met."
          },
          recommendations: {
            forStudent: ["Please commit and push your project implementation files, then submit again."],
            forReviewer: []
          },
          verificationMetadata: {
            filesAnalyzed: 0,
            requirementsTotal: projectRequirements.requirements.length,
            requirementsMet: 0,
            requirementsPartial: 0,
            requirementsMissing: projectRequirements.requirements.length,
            analysisTimestamp: new Date().toISOString(),
            repositoryFetchFailed: true,
            errorType,
            error: repoContent.error
          },
          rawData: null
        };
      }

      // For network errors, timeouts, rate limits, 404s, or temporary retrieval failures:
      // Report a technical verification ERROR so the candidate can retry without being falsely rejected.
      const isRateLimit = errorType === "rate_limit";
      const isTimeout = errorType === "timeout";
      const userMessage = isRateLimit
        ? "GitHub API rate limit reached. Verification could not retrieve the repository. Please try again shortly."
        : isTimeout
          ? "Repository analysis timed out. Please verify repository access and try again."
          : `Repository retrieval could not be completed (${repoContent.error}). Please verify repository access and try again.`;

      return {
        status: VERIFICATION_STATUS.ERROR,
        verificationStatus: VERIFICATION_STATUS.ERROR,
        confidence: 0,
        summary: userMessage,
        detailedAnalysis: {
          repositoryValidity: {
            isValid: false,
            issues: [`Repository retrieval failed: ${repoContent.error}`],
            strengths: []
          },
          requirementsAssessment: [],
          technicalEvaluation: {
            codeQuality: "UNKNOWN",
            projectOrganization: "UNKNOWN",
            documentation: "UNKNOWN",
            issuesFound: [`Repository fetch failure (${errorType})`]
          },
          overallAssessment: `Automated verification could not run because the repository could not be retrieved (${repoContent.error}). The submission has not been rejected.`
        },
        recommendations: {
          forStudent: ["Ensure your repository is publicly accessible and try verification again."],
          forReviewer: []
        },
        verificationMetadata: {
          filesAnalyzed: 0,
          requirementsTotal: projectRequirements.requirements.length,
          requirementsMet: 0,
          requirementsPartial: 0,
          requirementsMissing: 0,
          analysisTimestamp: new Date().toISOString(),
          repositoryFetchFailed: true,
          errorType,
          error: repoContent.error,
          retryable: true
        },
        rawData: null
      };
    }
    
    // Step 4: Structure data for AI analysis
    if (submissionId) {
      await markStageCompleted(candidateId, submissionId, "repository");
      await markStageActive(candidateId, submissionId, "analyzing");
    }
    const structuredRepoContent = structureRepositoryContent(repoContent.data);


    // Step 5: Prepare and call AI for verification
    const correlationId = `verify_${candidateId || 'anon'}_${submissionId || Date.now()}`;
    logger.debug(`[verification] Preparing AI verification request correlationId=${correlationId}`);
    if (submissionId) {
      await markStageCompleted(candidateId, submissionId, "analyzing");
      await markStageActive(candidateId, submissionId, "requirements");
    }

    const { messages, payloadStats } = prepareVerificationMessages(projectRequirements, structuredRepoContent);

    // Validate the EXACT final serialized payload transmitted to AI (messages[1].content)
    let parsedFinalUserPayload;
    try {
      parsedFinalUserPayload = JSON.parse(messages[1].content);
    } catch (parseError) {
      logger.error(`[verification] Failed to parse final enforced user payload correlationId=${correlationId}:`, parseError);
    }

    const finalKeyFiles = parsedFinalUserPayload?.REPOSITORY_CONTENT?.keyFiles || {};
    const finalFilesWithContent = Object.entries(finalKeyFiles).filter(
      ([path, file]) => file && typeof file.content === "string" && (file.content.trim().length > 0 || path.endsWith("__init__.py"))
    );

    // Record Stage B Diagnostics
    logger.info(
      `[verification-diagnostics] Stage B: Final AI Payload correlationId=${correlationId} submissionId=${submissionId} ` +
      `systemPromptChars=${payloadStats.systemPromptChars} userPayloadChars=${payloadStats.userPayloadChars} ` +
      `estimatedTokens=${payloadStats.estimatedInputTokens} inputBudget=${payloadStats.userBudget} ` +
      `filesInFinalPayload=${Object.keys(finalKeyFiles).length} filesWithSourceInFinal=${finalFilesWithContent.length} ` +
      `truncatedFiles=${payloadStats.enforcedStats.truncatedFiles} droppedFiles=${payloadStats.enforcedStats.filesDroppedByBudget} ` +
      `withinBudget=${payloadStats.enforcedStats.withinBudget} configError=${!!payloadStats.enforcedStats.configurationError}`
    );

    // SAFEGUARD: If payload compaction suffered a configuration error or dropped all source files
    // even though the repo has content, this is a technical/configuration error, NOT a student rejection!
    if (payloadStats.enforcedStats.configurationError || (finalFilesWithContent.length === 0 && structuredRepoContent.structure?.filesWithContent > 0)) {
      logger.error(
        `[verification] Payload compaction error: repository evidence could not fit within token budget correlationId=${correlationId}`
      );

      if (submissionId) {
        await markStageFailed(
          candidateId,
          submissionId,
          "requirements",
          "Verification payload compaction error: prompt and requirements exceeded context budget."
        );
      }

      return {
        status: VERIFICATION_STATUS.ERROR,
        verificationStatus: VERIFICATION_STATUS.ERROR,
        confidence: 0,
        summary: "Verification could not proceed because project requirements exceeded the model context budget. Please try again or contact support.",
        detailedAnalysis: {
          repositoryValidity: {
            isValid: true,
            issues: ["Verification payload configuration error: insufficient budget for repository evidence"],
            strengths: [`${structuredRepoContent.structure?.filesWithContent || 0} source files fetched`]
          },
          requirementsAssessment: [],
          technicalEvaluation: {
            codeQuality: "UNKNOWN",
            projectOrganization: "UNKNOWN",
            documentation: "UNKNOWN",
            issuesFound: ["Payload budget configuration error"]
          },
          overallAssessment: "Automated verification encountered a configuration error while packing repository evidence. The submission has not been rejected."
        },
        recommendations: {
          forStudent: ["A temporary verification engine error occurred. Please retry verification."],
          forReviewer: []
        },
        verificationMetadata: {
          filesAnalyzed: finalFilesWithContent.length,
          requirementsTotal: projectRequirements.requirements.length,
          requirementsMet: 0,
          requirementsPartial: 0,
          requirementsMissing: 0,
          analysisTimestamp: new Date().toISOString(),
          configurationError: true,
          aiSkipped: true,
          retryable: true
        },
        rawData: null
      };
    }

    // Check we have enough file content for meaningful analysis.
    const keyFiles = structuredRepoContent.keyFiles || {};
    const filesWithContent = Object.values(keyFiles).filter(
      (file) =>
        file &&
        typeof file.content === "string" &&
        file.content.trim().length > 0
    ).length;

    logger.info(
      `Repository evidence: keyFiles=${Object.keys(keyFiles).length} ` +
        `filesWithActualContent=${filesWithContent}`
    );

    if (filesWithContent === 0) {
      logger.warn(
        "No file content available for AI analysis - classifying as REJECTED"
      );

      if (submissionId) {
        await markStageFailed(
          candidateId,
          submissionId,
          "requirements",
          "No actual file content was available to analyse."
        );
      }
      
      // Directly return REJECTED when insufficient content for evidence-based verification
      return {
        status: VERIFICATION_STATUS.REJECTED,
        verificationStatus: VERIFICATION_STATUS.REJECTED,
        confidence: 0.1,
        summary: "Insufficient repository content available for evidence-based verification. Verification could not be completed.",
        detailedAnalysis: {
          repositoryValidity: {
            isValid: repoContent.success,
            issues: ["No actual file content available for evidence-based verification"],
            strengths: repoContent.success ? ["Repository is accessible"] : []
          },
          requirementsAssessment: [],
          technicalEvaluation: {
            codeQuality: "POOR",
            projectOrganization: "POOR",
            documentation: "POOR",
            issuesFound: ["Cannot verify requirements without actual file content"]
          },
          overallAssessment: "Repository structure exists but no actual file content could be analyzed. Filenames and metadata alone are insufficient for evidence-based verification."
        },
        recommendations: {
          forStudent: ["Your repository structure was found but actual file content was missing. Ensure your repository contains the actual project implementation files."],
          forReviewer: []
        },
        verificationMetadata: {
          filesAnalyzed: 0,
          requirementsTotal: projectRequirements.requirements.length,
          requirementsMet: 0,
          requirementsPartial: 0,
          requirementsMissing: projectRequirements.requirements.length,
          analysisTimestamp: new Date().toISOString(),
          insufficientContent: true,
          note: "No actual file content available - filenames/metadata only"
        },
        rawData: {
          projectRequirements,
          repositoryContent: structuredRepoContent,
          repoMetadata: repoContent.data?.metadata
        }
      };
    }
    
    // Defensive guard: NEVER call the AI stage with content produced by a
    // failed/empty fetch. The checks above already guarantee this, but we
    // re-assert it so a future refactor cannot feed the model empty or
    // incomplete content caused by a repository fetch failure.
    if (!repoContent.success || filesWithContent === 0) {
      logger.warn("Skipping AI verification - repository content unavailable/insufficient");
      if (submissionId) {
        await markStageFailed(
          candidateId,
          submissionId,
          "requirements",
          "Repository content was unavailable at the AI verification stage."
        );
      }
      if (!repoContent.success) {
        return {
          status: VERIFICATION_STATUS.ERROR,
          verificationStatus: VERIFICATION_STATUS.ERROR,
          confidence: 0,
          summary: "Repository content was unavailable. Verification could not be completed.",
          detailedAnalysis: {
            repositoryValidity: {
              isValid: false,
              issues: ["Repository content unavailable at AI verification stage"],
              strengths: []
            },
            requirementsAssessment: [],
            technicalEvaluation: {
              codeQuality: "UNKNOWN",
              projectOrganization: "UNKNOWN",
              documentation: "UNKNOWN",
              issuesFound: ["No usable repository content for AI verification"]
            },
            overallAssessment: "Automated verification could not run because repository content was unavailable."
          },
          recommendations: {
            forStudent: ["Your repository content could not be retrieved. Please check the repository and try again."],
            forReviewer: []
          },
          verificationMetadata: {
            filesAnalyzed: filesWithContent,
            requirementsTotal: projectRequirements.requirements.length,
            requirementsMet: 0,
            requirementsPartial: 0,
            requirementsMissing: 0,
            analysisTimestamp: new Date().toISOString(),
            aiSkipped: true,
            reason: "no_usable_repository_content",
            retryable: true
          },
          rawData: null
        };
      }

      return {
        status: VERIFICATION_STATUS.REJECTED,
        verificationStatus: VERIFICATION_STATUS.REJECTED,
        confidence: 0.1,
        summary: "Repository content was insufficient for verification. Implementation files are missing.",
        detailedAnalysis: {
          repositoryValidity: {
            isValid: true,
            issues: ["No implementation files found in repository"],
            strengths: []
          },
          requirementsAssessment: [],
          technicalEvaluation: {
            codeQuality: "POOR",
            projectOrganization: "POOR",
            documentation: "POOR",
            issuesFound: ["No usable repository implementation files"]
          },
          overallAssessment: "Automated verification could not verify features because implementation code is missing from repository."
        },
        recommendations: {
          forStudent: ["Please ensure your project code files are committed and pushed to the repository."],
          forReviewer: []
        },
        verificationMetadata: {
          filesAnalyzed: filesWithContent,
          requirementsTotal: projectRequirements.requirements.length,
          requirementsMet: 0,
          requirementsPartial: 0,
          requirementsMissing: projectRequirements.requirements.length,
          analysisTimestamp: new Date().toISOString(),
          aiSkipped: true,
          reason: "no_usable_repository_content"
        },
        rawData: null
      };
    }

    logger.info(`[verification] Calling AI for project verification correlationId=${correlationId}`);
    let aiResult;
    try {
      if (submissionId) {
        await markStageCompleted(candidateId, submissionId, "requirements");
        await markStageActive(candidateId, submissionId, "ai");
      }

      aiResult = await generateStructuredAI(messages, { correlationId });

      // Step 6: Validate and process AI result
      validateVerificationResult(aiResult);

      if (submissionId) {
        await markStageCompleted(candidateId, submissionId, "ai");
        await markStageActive(candidateId, submissionId, "finalizing");
      }

    } catch (aiError) {
      logger.error(`[verification] AI verification failed correlationId=${correlationId}:`, aiError);

      if (submissionId) {
        await markStageFailed(
          candidateId,
          submissionId,
          "ai",
          aiError.message || "AI verification failed."
        );
      }
      
      // Handle AI failure gracefully as a technical error (NOT false rejection)
      return {
        status: VERIFICATION_STATUS.ERROR,

        verificationStatus: VERIFICATION_STATUS.ERROR,
        confidence: 0,
        summary: `AI verification service encountered a processing error: ${aiError.message}. Verification could not be completed.`,
        detailedAnalysis: {
          repositoryValidity: {
            isValid: repoContent.success,
            issues: [`AI verification provider error: ${aiError.message}`],
            strengths: filesWithContent > 0 ? [`${filesWithContent} files analyzed`] : []
          },
          requirementsAssessment: [],
          technicalEvaluation: {
            codeQuality: "UNKNOWN",
            projectOrganization: "UNKNOWN",
            documentation: "UNKNOWN",
            issuesFound: ["AI provider processing error"]
          },
          overallAssessment: "Automated AI verification could not complete due to a technical error with the AI service. The submission has not been rejected."
        },
        recommendations: {
          forStudent: ["The verification engine encountered a temporary technical error. Please retry verification."],
          forReviewer: []
        },
        verificationMetadata: {
          filesAnalyzed: filesWithContent,
          requirementsTotal: projectRequirements.requirements.length,
          requirementsMet: 0,
          requirementsPartial: 0,
          requirementsMissing: 0,
          analysisTimestamp: new Date().toISOString(),
          error: `AI verification failed: ${aiError.message}`,
          aiFailed: true,
          retryable: true
        },
        rawData: {
          projectRequirements,
          repositoryContent: structuredRepoContent,
          repoMetadata: repoContent.data?.metadata
        }
      };
    }
    
    const verificationTime = Date.now() - startTime;
    logger.info(`Verification completed in ${verificationTime}ms with status: ${aiResult.verificationStatus}`);
    
    // Step 7: Add metadata to result
    const finalResult = {
      ...aiResult,
      // Normalise the decision key: the AI returns `verificationStatus`, while
      // downstream consumers (storage / reporting) read `status`. Expose both
      // so the result is classified consistently on every code path.
      status: aiResult.verificationStatus ?? aiResult.status,
      verificationStatus: aiResult.verificationStatus ?? aiResult.status,
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

    if (submissionId) {
      await markStageCompleted(candidateId, submissionId, "finalizing");
    }

    return finalResult;

  } catch (error) {
    const verificationTime = Date.now() - startTime;
    logger.error(`Verification failed after ${verificationTime}ms:`, error);

    if (submissionId) {
      await markStageFailed(
        candidateId,
        submissionId,
        "finalizing",
        error.message || "Verification failed."
      );
    }
    
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
 * Process verification result for database storage with EVIDENCE PRESERVATION
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
  
  // Extract evidence from requirements assessment
  const evidenceSummary = {};
  if (requirementsAssessment && Array.isArray(requirementsAssessment)) {
    requirementsAssessment.forEach(req => {
      evidenceSummary[req.requirementId] = {
        description: req.description || "",
        status: req.status || "MISSING",
        evidence: req.evidence || "",
        relevantFiles: Array.isArray(req.relevantFiles) ? req.relevantFiles : [],
        notes: req.notes || ""
      };
    });
  }
  
  // Extract file analysis statistics
  const fileAnalysisStats = {
    filesWithContent: rawData?.repositoryContent?.structure?.filesWithContent || 0,
    totalFilesAnalyzed: verificationMetadata?.filesAnalyzed || 0,
    repositorySize: rawData?.repositoryContent?.structure?.size || "unknown",
    languages: rawData?.repositoryContent?.structure?.languageBreakdown || {},
    security: rawData?.repositoryContent?.metadata?.security || {}
  };
  
  // Compress evidence for storage (keep key information only)
  const compressedEvidence = {};
  Object.entries(evidenceSummary).forEach(([reqId, evidence]) => {
    compressedEvidence[reqId] = {
      description: evidence.description,
      status: evidence.status,
      evidence: evidence.evidence ? evidence.evidence.substring(0, 500) : "", // Limit evidence length
      evidenceTruncated: evidence.evidence && evidence.evidence.length > 500,
      fileCount: evidence.relevantFiles ? evidence.relevantFiles.length : 0,
      hasNotes: !!evidence.notes,
      notes: evidence.notes ? evidence.notes.substring(0, 500) : ""
    };
  });
  
  // Preserve critical evidence for candidate feedback and detailed reporting
  const criticalEvidence = {};
  const criticalRequirements = requirementsAssessment.filter(req => 
    req.critical !== false && (req.status === "MISSING" || req.status === "PARTIAL")
  );
  
  criticalRequirements.forEach(req => {
    criticalEvidence[req.requirementId] = {
      description: req.description || "",
      status: req.status || "MISSING",
      evidence: req.evidence ? req.evidence.substring(0, 1000) : "No implementation evidence found in analyzed repository files.",
      relevantFiles: Array.isArray(req.relevantFiles) ? req.relevantFiles : [],
      notes: req.notes || "Requirement not satisfied in submitted files"
    };
  });
  
  const rejectionReason = verificationStatus === VERIFICATION_STATUS.REJECTED
    ? (summary ||
       (Object.keys(criticalEvidence).length > 0
         ? Object.values(criticalEvidence).map(c => `${c.description}: ${c.notes}`).join("; ")
         : "Critical project requirements were not satisfied."))
    : null;

  return {
    candidateId,
    projectId,
    status: verificationStatus,
    confidence,
    summary,
    rejectionReason,
    
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
    
    // Evidence and file analysis
    evidenceSummary: compressedEvidence,
    criticalEvidence: Object.keys(criticalEvidence).length > 0 ? criticalEvidence : null,
    fileAnalysis: fileAnalysisStats,
    technicalEvaluation: detailedAnalysis?.technicalEvaluation || {},
    
    // Recommendations
    studentRecommendations: recommendations?.forStudent || [],
    reviewerNotes: recommendations?.forReviewer || [],
    
    // Metadata
    verificationTimestamp: verificationMetadata?.analysisTimestamp || new Date().toISOString(),
    verificationDurationMs: verificationMetadata?.verificationTimeMs || 0,
    aiModel: verificationMetadata?.aiModel,
    repositoryUrl: verificationMetadata?.repositoryUrl,
    projectTitle: rawData?.projectRequirements?.title || "Unknown Project",
    
    // Full data (can be stored separately or in compressed form)
    fullAnalysis: {
      detailedAnalysis,
      evidenceCount: Object.keys(evidenceSummary).length,
      criticalEvidenceCount: Object.keys(criticalEvidence).length,
      rawDataPreview: rawData ? {
        projectTitle: rawData.projectRequirements?.title,
        repoSize: rawData.repositoryContent?.structure?.size,
        filesAnalyzed: rawData.repositoryContent?.structure?.files?.length,
        filesWithContent: rawData.repositoryContent?.structure?.filesWithContent || 0,
        languages: Object.keys(rawData.repositoryContent?.structure?.languageBreakdown || {}),
        dependencies: rawData.repositoryContent?.metadata?.dependencies || []
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

export {
  VERIFICATION_STATUS,
  prepareVerificationMessages,
  prepareProjectRequirements
};