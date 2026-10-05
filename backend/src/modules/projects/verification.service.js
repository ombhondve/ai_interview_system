import { projectVerificationPrompt } from "../ai/ai.prompt.js";
import { generateStructuredAI } from "../ai/ai.service.js";
import { validateRepositoryUrl, fetchRepositoryContent } from "./repository.service.js";
import {
  buildCompactRepository,
  enforcePayloadBudget,
  estimateTokens,
  getMaxInputTokens,
  getUserPayloadBudgetChars,
  getRepositoryBudgetChars
} from "./aiPayloadBudget.js";
import logger from "../../utils/logger.js";

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
  
  // E. SUPPORTING CONTEXT FIELDS (help AI understand project scope)
  const supportingContext = {
    // Objectives provide project goals but aren't individual requirements
    objectives: project.objectives || [],
    
    // Implementation plan provides development phases
    implementationPlan: project.implementationPlan || [],
    
    // API endpoints, database design, testing plan are implementation details
    apiEndpoints: project.apiEndpoints || [],
    databaseDesign: project.databaseDesign || [],
    testingPlan: project.testingPlan || [],
    
    // Suggested folder structure is guidance, not mandatory requirements
    suggestedFolderStructure: project.suggestedFolderStructure || [],
    
    // Module names provide project structure context
    moduleNames: (project.modules || []).map(module => module.name).filter(name => name)
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
  const repoBudget = getRepositoryBudgetChars(requirementsChars, wrapperOverhead);

  logger.info(
    `Verification evidence budget: user=${getUserPayloadBudgetChars(systemPrompt.length)} ` +
      `requirements=${requirementsChars} repository=${repoBudget} chars`
  );

  // Compact evidence only - never the whole repository.
  const compact = buildCompactRepository(
    repositoryContent,
    projectRequirements,
    repoBudget
  );

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
      }
    }
  };

  // HARD cap: the serialised payload can never exceed the budget.
  const enforced = enforcePayloadBudget(userPrompt, userBudget);

  const totalChars = systemPrompt.length + enforced.content.length;
  logger.info(
    `AI verification payload: ${totalChars} characters / approximately ` +
      `${estimateTokens(systemPrompt) + estimateTokens(enforced.content)} tokens ` +
      `(repo section ${enforced.stats.finalChars} chars, budget ${userBudget}; ` +
      `files ${compact.stats.filesIncluded}/${compact.stats.filesConsidered} included)`
  );

  // SAFE DIAGNOSTICS: counts and sizes only, never file contents.
  logger.info(
    `AI input evidence: filesIncluded=${compact.stats.filesIncluded} ` +
      `filesExcluded=${compact.stats.filesExcludedByRules} ` +
      `filesDroppedForBudget=${compact.stats.filesDroppedByBudget} ` +
      `truncatedFiles=${compact.stats.truncatedFiles} ` +
      `payloadChars=${enforced.stats.finalChars}`
  );

  return [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: enforced.content
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
export async function verifyProjectSubmission(candidateId, projectId, repositoryUrl, onProgress = null) {
  const startTime = Date.now();

  const reportProgress = async (progress) => {
    try {
      if (typeof onProgress === "function") await onProgress(progress);
    } catch (progressError) {
      logger.warn("Unable to report verification progress:", progressError);
    }
  };
  
  try {
    logger.info(`Starting verification for candidate ${candidateId}, project ${projectId}`);
    
    // Step 1: Validate repository URL
    await reportProgress({
      stage: "validating",
      label: "Validating repository",
      status: "active",
      message: "Checking the submitted project URL..."
    });
    logger.debug("Validating repository URL");
    const urlValidation = validateRepositoryUrl(repositoryUrl);
    if (!urlValidation.valid) {
      logger.warn(`Invalid repository URL: ${urlValidation.error}`);
      // An invalid URL means no repository could be fetched and therefore no
      // evidence exists -> manual review, never an automatic REJECTED.
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
    
    await reportProgress({
      stage: "project_requirements",
      label: "Loading project requirements",
      status: "active",
      message: "Loading the assigned project requirements..."
    });

    // Step 2: Fetch ACTUAL project data from MongoDB
    logger.debug(`Fetching actual project ${projectId} from database`);
    let actualProject = null;
    
    try {
      // Import Project model dynamically to avoid circular dependencies
      const Project = (await import("./project.model.js")).default;
      
      // Fetch project with selected fields for verification
      actualProject = await Project.findById(projectId)
        .select("title description difficulty technologies requirements functionalRequirements nonFunctionalRequirements modules implementationPlan evaluationCriteria deliverables suggestedFolderStructure apiEndpoints databaseDesign testingPlan")
        .lean();
      
      if (!actualProject) {
        logger.warn(`Project ${projectId} not found in database`);
        // No project/evidence available -> manual review, never automatic REJECTED.
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
      
    } catch (projectError) {
      logger.error(`Failed to fetch project ${projectId}:`, projectError);
      // System/data error, not evidence of missing requirements -> manual review.
      return {
        status: VERIFICATION_STATUS.REJECTED,
        verificationStatus: VERIFICATION_STATUS.REJECTED,
        confidence: 0.3,
        summary: `Project data access failed, so automated verification could not obtain sufficient evidence: ${projectError.message}`,
        detailedAnalysis: {
          repositoryValidity: {
            isValid: false,
            issues: [`Failed to load project requirements: ${projectError.message}`],
            strengths: []
          },
          requirementsAssessment: [],
          technicalEvaluation: {
            codeQuality: "POOR",
            projectOrganization: "POOR",
            documentation: "POOR",
            issuesFound: ["Project data access error"]
          },
          overallAssessment: "Cannot verify project: System error accessing project requirements."
        },
        recommendations: {
          forStudent: ["System error occurred, please try again or contact support"],
          forReviewer: ["Database error loading project, needs investigation"]
        },
        verificationMetadata: {
          filesAnalyzed: 0,
          requirementsTotal: 0,
          requirementsMet: 0,
          requirementsPartial: 0,
          requirementsMissing: 0,
          analysisTimestamp: new Date().toISOString(),
          error: `Project fetch failed: ${projectError.message}`
        },
        rawData: null
      };
    }
    
    const projectRequirements = prepareProjectRequirements(actualProject);

    await reportProgress({
      stage: "repository",
      label: "Fetching repository",
      status: "active",
      message: "Connecting to GitHub and downloading project files..."
    });

    // Step 3: Fetch repository content safely
    logger.info("Fetching repository content for verification");
    const repoContent = await fetchRepositoryContent(repositoryUrl);
    
    if (!repoContent.success) {
      // -----------------------------------------------------------------
      // A repository FETCH FAILURE is NOT a rejection.
      //
      // A timeout, network error, GitHub API outage, 5xx, rate limit, 404,
      // empty repo, etc. means we could not obtain enough evidence to run
      // automated verification. Such failures MUST be routed to manual
      // admin review. REJECTED is reserved for the case where the repo WAS
      // fetched successfully AND the AI/static evidence actually shows the
      // required project requirements are missing or failed (see Step 5).
      //
      // The AI verification stage is intentionally NOT called here, so the
      // model is never fed empty/incomplete content produced by a failure.
      // -----------------------------------------------------------------
      const errorType = repoContent.metadata?.errorType || "repository_fetch_failure";
      const reason =
        "Repository could not be fetched, so automated verification could not obtain sufficient evidence.";

      logger.warn(
        `Failed to fetch repository (${errorType}): ${repoContent.error}`
      );

      await reportProgress({
        stage: "repository",
        label: "Fetching repository",
        status: "failed",
        failed: true,
        message: repoContent.error || "Repository could not be fetched."
      });

      return {
        status: VERIFICATION_STATUS.REJECTED,
        verificationStatus: VERIFICATION_STATUS.REJECTED,
        confidence: 0.3,
        summary: `${reason} (${repoContent.error})`,
        detailedAnalysis: {
          repositoryValidity: {
            isValid: false,
            issues: [`Repository could not be fetched: ${repoContent.error}`],
            strengths: []
          },
          requirementsAssessment: [],
          technicalEvaluation: {
            codeQuality: "UNKNOWN",
            projectOrganization: "UNKNOWN",
            documentation: "UNKNOWN",
            issuesFound: ["Repository fetch failed - insufficient evidence"]
          },
          overallAssessment: `${reason} Failure type: '${errorType}'. A human reviewer must determine whether this is a transient GitHub/network problem or a genuinely inaccessible repository.`
        },
        recommendations: {
          forStudent: ["Your repository could not be fetched. Ensure it is public and the URL is correct, then try again."],
          forReviewer: [`Automated verification skipped: repository fetch failed (${errorType}). Repository could not be fetched, so automated verification could not obtain sufficient evidence.`]
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
          error: repoContent.error
        },
        rawData: null
      };
    }
    
    await reportProgress({
      stage: "analyzing",
      label: "Analyzing code and files",
      status: "active",
      message: "Reading the downloaded project files..."
    });

    // Step 4: Structure data for AI analysis
    const structuredRepoContent = structureRepositoryContent(repoContent.data);

    await reportProgress({
      stage: "requirements",
      label: "Checking project requirements",
      status: "active",
      message: "Comparing the project evidence with the assigned requirements..."
    });

    // Step 5: Prepare and call AI for verification
    logger.debug("Preparing AI verification request");
    const messages = prepareVerificationMessages(projectRequirements, structuredRepoContent);
    
    // Check we have enough file content for meaningful analysis.
    //
    // Count files that ACTUALLY carry content, not just keys. Counting keys
    // reported "7 files" even when every one had `content: null` after a
    // failed fetch, which sent the model a payload with no evidence while the
    // log claimed content was present.
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
      logger.warn("No file content available for AI analysis - requiring admin review");
      
      // Directly return REJECTED when insufficient content for evidence-based verification
      return {
        status: VERIFICATION_STATUS.REJECTED,
        verificationStatus: VERIFICATION_STATUS.REJECTED,
        confidence: 0.4,
        summary: "Insufficient repository content available for evidence-based verification. Verification could not be completed.",
        detailedAnalysis: {
          repositoryValidity: {
            isValid: repoContent.success,
            issues: ["No actual file content available for evidence-based verification"],
            strengths: repoContent.success ? ["Repository is accessible"] : []
          },
          requirementsAssessment: [],
          technicalEvaluation: {
            codeQuality: "UNKNOWN",
            projectOrganization: "UNKNOWN",
            documentation: "UNKNOWN",
            issuesFound: ["Cannot verify requirements without actual file content"]
          },
          overallAssessment: "Repository structure exists but no actual file content could be analyzed. Filenames and metadata alone are insufficient for evidence-based verification. Manual admin review required."
        },
        recommendations: {
          forStudent: ["Your repository structure was found but actual file content could not be analyzed. Ensure your repository contains the actual project files."],
          forReviewer: ["Insufficient file content for automated verification. Requires manual review of repository structure and metadata only."]
        },
        verificationMetadata: {
          filesAnalyzed: 0,
          requirementsTotal: projectRequirements.requirements.length,
          requirementsMet: 0,
          requirementsPartial: 0,
          requirementsMissing: 0,
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
      return {
        status: VERIFICATION_STATUS.REJECTED,
        verificationStatus: VERIFICATION_STATUS.REJECTED,
        confidence: 0.3,
        summary: "Repository content was unavailable, so automated verification could not obtain sufficient evidence.",
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
          forStudent: ["Your repository content could not be analyzed. Check the repository and try again."],
          forReviewer: ["AI verification skipped: no usable repository content."]
        },
        verificationMetadata: {
          filesAnalyzed: filesWithContent,
          requirementsTotal: projectRequirements.requirements.length,
          requirementsMet: 0,
          requirementsPartial: 0,
          requirementsMissing: 0,
          analysisTimestamp: new Date().toISOString(),
          aiSkipped: true,
          reason: "no_usable_repository_content"
        },
        rawData: null
      };
    }

    await reportProgress({
      stage: "ai",
      label: "AI verification in progress",
      status: "active",
      message: "AI is evaluating the project against the requirements..."
    });

    logger.info("Calling AI for project verification");
    let aiResult;
    try {
      aiResult = await generateStructuredAI(messages);
      
      // Step 6: Validate and process AI result
      validateVerificationResult(aiResult);

      await reportProgress({
        stage: "ai",
        label: "AI verification in progress",
        status: "completed",
        completed: true,
        message: "AI analysis completed successfully."
      });
      
    } catch (aiError) {
      logger.error("AI verification failed:", aiError);

      await reportProgress({
        stage: "ai",
        label: "AI verification in progress",
        status: "failed",
        failed: true,
        message: aiError.message || "AI verification failed."
      });
      
      // Handle AI failure gracefully
      return {
        status: VERIFICATION_STATUS.REJECTED,
        verificationStatus: VERIFICATION_STATUS.REJECTED,
        confidence: 0.3,
        summary: `AI analysis failed: ${aiError.message}. Requires manual review.`,
        detailedAnalysis: {
          repositoryValidity: {
            isValid: repoContent.success,
            issues: [`AI verification failed: ${aiError.message}`],
            strengths: filesWithContent > 0 ? [`${filesWithContent} files analyzed`] : []
          },
          requirementsAssessment: [],
          technicalEvaluation: {
            codeQuality: "UNKNOWN",
            projectOrganization: "UNKNOWN",
            documentation: "UNKNOWN",
            issuesFound: ["AI verification system error"]
          },
          overallAssessment: "AI verification could not complete. Project requires manual review by administrator."
        },
        recommendations: {
          forStudent: ["Verification system encountered an error. Your project will be reviewed manually."],
          forReviewer: ["AI verification failed, requires manual review"]
        },
        verificationMetadata: {
          filesAnalyzed: filesWithContent,
          requirementsTotal: projectRequirements.requirements.length,
          requirementsMet: 0,
          requirementsPartial: 0,
          requirementsMissing: 0,
          analysisTimestamp: new Date().toISOString(),
          error: `AI verification failed: ${aiError.message}`,
          aiFailed: true
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
      if (req.evidence) {
        evidenceSummary[req.requirementId] = {
          status: req.status,
          evidence: req.evidence,
          relevantFiles: req.relevantFiles || [],
          notes: req.notes || ""
        };
      }
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
      status: evidence.status,
      evidence: evidence.evidence ? evidence.evidence.substring(0, 500) : "", // Limit evidence length
      evidenceTruncated: evidence.evidence && evidence.evidence.length > 500,
      fileCount: evidence.relevantFiles ? evidence.relevantFiles.length : 0,
      hasNotes: !!evidence.notes
    };
  });
  
  // Preserve critical evidence for admin review
  const criticalEvidence = {};
  const criticalRequirements = requirementsAssessment.filter(req => 
    req.critical !== false && (req.status === "MISSING" || req.status === "PARTIAL")
  );
  
  criticalRequirements.forEach(req => {
    if (req.evidence || req.relevantFiles) {
      criticalEvidence[req.requirementId] = {
        description: req.description || "",
        status: req.status,
        evidence: req.evidence ? req.evidence.substring(0, 1000) : "",
        relevantFiles: req.relevantFiles || [],
        notes: req.notes || ""
      };
    }
  });
  
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

export { VERIFICATION_STATUS };