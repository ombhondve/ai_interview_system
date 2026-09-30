/**
 * Repository validation service
 * 
 * SAFETY FIRST: Never execute untrusted student code
 * Read-only repository access only
 */

import axios from "axios";

/**
 * Validate repository URL format
 * 
 * Supported platforms:
 * - GitHub (github.com)
 * - GitLab (gitlab.com)
 * - Bitbucket (bitbucket.org)
 * - General git repositories
 * - Deployed project URLs
 */
export function validateRepositoryUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Check protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        valid: false,
        error: "URL must use HTTP or HTTPS protocol"
      };
    }
    
    // Check for common repository patterns
    const hostname = urlObj.hostname.toLowerCase();
    
    // Common repository hosts
    const supportedHosts = [
      'github.com',
      'gitlab.com',
      'bitbucket.org',
      'gitea.com',
      'sourceforge.net'
    ];
    
    // Check if it's a known repository host
    const isRepoHost = supportedHosts.some(host => hostname.includes(host));
    
    // Check for common deployment platforms
    const isDeployment = [
      'vercel.app',
      'netlify.app',
      'herokuapp.com',
      'aws.amazon.com',
      'azurewebsites.net',
      'firebaseapp.com',
      'render.com'
    ].some(host => hostname.includes(host));
    
    if (!isRepoHost && !isDeployment) {
      // Warning but not error - could be custom deployment
      console.warn(`Repository URL from non-standard host: ${hostname}`);
    }
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.exe$/i,
      /\.zip$/i,
      /\.rar$/i,
      /\.tar\.gz$/i,
      /\.dmg$/i,
      /\.msi$/i,
      /\.sh$/i,
      /\.bat$/i,
      /\.cmd$/i,
      /\.ps1$/i
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(urlObj.pathname)) {
        return {
          valid: false,
          error: "URL appears to be a downloadable file, not a repository or deployment"
        };
      }
    }
    
    return {
      valid: true,
      isRepoHost,
      isDeployment,
      hostname,
      protocol: urlObj.protocol
    };
  } catch (error) {
    return {
      valid: false,
      error: "Invalid URL format"
    };
  }
}

/**
 * Check repository accessibility
 * 
 * Makes a HEAD request to check if repository is accessible
 * WITHOUT fetching full content
 */
export async function checkRepositoryAccessibility(url) {
  try {
    // First validate URL format
    const validation = validateRepositoryUrl(url);
    
    if (!validation.valid) {
      return {
        accessible: false,
        error: validation.error
      };
    }
    
    // For GitHub repositories, use API to check existence
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    if (hostname.includes('github.com')) {
      return await checkGitHubRepository(url);
    }
    
    if (hostname.includes('gitlab.com')) {
      return await checkGitLabRepository(url);
    }
    
    // For other URLs, do a simple HEAD request
    // Use timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await axios.head(url, {
        signal: controller.signal,
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 400; // Accept 2xx and 3xx status codes
        }
      });
      
      clearTimeout(timeoutId);
      
      // Check if we got a reasonable response
      if (response.status >= 200 && response.status < 400) {
        return {
          accessible: true,
          status: response.status,
          contentType: response.headers['content-type'] || 'unknown'
        };
      } else {
        return {
          accessible: false,
          error: `Repository returned status ${response.status}`,
          status: response.status
        };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        return {
          accessible: false,
          error: "Repository check timed out"
        };
      }
      
      if (error.response) {
        // Got response but with error status
        return {
          accessible: false,
          error: `Repository returned status ${error.response.status}`,
          status: error.response.status
        };
      }
      
      return {
        accessible: false,
        error: `Cannot access repository: ${error.message}`
      };
    }
  } catch (error) {
    return {
      accessible: false,
      error: `Repository validation failed: ${error.message}`
    };
  }
}

/**
 * Check GitHub repository specifically
 */
async function checkGitHubRepository(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p.trim());
    
    if (pathParts.length < 2) {
      return {
        accessible: false,
        error: "Invalid GitHub repository URL format"
      };
    }
    
    const owner = pathParts[0];
    const repo = pathParts[1];
    
    // GitHub API endpoint
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
    
    const response = await axios.get(apiUrl, {
      timeout: 10000,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'RecruitAI-Backend'
      },
      validateStatus: function (status) {
        return status >= 200 && status < 400;
      }
    });
    
    if (response.status === 200) {
      const repoData = response.data;
      
      return {
        accessible: true,
        status: response.status,
        repository: {
          name: repoData.name,
          fullName: repoData.full_name,
          description: repoData.description,
          private: repoData.private,
          language: repoData.language,
          stars: repoData.stargazers_count,
          forks: repoData.forks_count,
          updatedAt: repoData.updated_at,
          createdAt: repoData.created_at
        }
      };
    } else {
      return {
        accessible: false,
        error: `GitHub API returned status ${response.status}`,
        status: response.status
      };
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return {
        accessible: false,
        error: "GitHub repository not found"
      };
    }
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return {
        accessible: false,
        error: "GitHub API check timed out"
      };
    }
    
    return {
      accessible: false,
      error: `GitHub repository check failed: ${error.message}`
    };
  }
}

/**
 * Check GitLab repository specifically
 */
async function checkGitLabRepository(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p.trim());
    
    if (pathParts.length < 2) {
      return {
        accessible: false,
        error: "Invalid GitLab repository URL format"
      };
    }
    
    // GitLab API endpoint (simplified)
    // Note: GitLab API requires authentication for private repos
    // We'll just check if the project page is accessible
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await axios.head(url, {
        signal: controller.signal,
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 400;
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.status >= 200 && response.status < 400) {
        return {
          accessible: true,
          status: response.status
        };
      } else {
        return {
          accessible: false,
          error: `GitLab repository returned status ${response.status}`,
          status: response.status
        };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.response && error.response.status === 404) {
        return {
          accessible: false,
          error: "GitLab repository not found"
        };
      }
      
      return {
        accessible: false,
        error: `GitLab repository check failed: ${error.message}`
      };
    }
  } catch (error) {
    return {
      accessible: false,
      error: `GitLab repository validation failed: ${error.message}`
    };
  }
}

/**
 * Extract repository information for analysis
 * 
 * SAFETY: Only extracts metadata, never clones or executes code
 */
export async function extractRepositoryInfo(url) {
  try {
    // First check accessibility
    const accessibility = await checkRepositoryAccessibility(url);
    
    if (!accessibility.accessible) {
      throw new Error(`Repository not accessible: ${accessibility.error}`);
    }
    
    // For GitHub, we already have repo info
    if (accessibility.repository) {
      return {
        url,
        accessible: true,
        platform: 'github',
        repositoryInfo: accessibility.repository,
        extractedAt: new Date()
      };
    }
    
    // For other URLs, we can extract basic info
    const urlObj = new URL(url);
    
    return {
      url,
      accessible: true,
      platform: 'generic',
      hostname: urlObj.hostname,
      pathname: urlObj.pathname,
      extractedAt: new Date(),
      note: 'Repository accessible but detailed info not extracted'
    };
  } catch (error) {
    return {
      url,
      accessible: false,
      error: error.message,
      extractedAt: new Date()
    };
  }
}

/**
 * Get README content if available (for GitHub)
 */
export async function getReadmeContent(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    if (!hostname.includes('github.com')) {
      return {
        available: false,
        reason: 'Only GitHub repositories support README extraction via API'
      };
    }
    
    const pathParts = urlObj.pathname.split('/').filter(p => p.trim());
    
    if (pathParts.length < 2) {
      return {
        available: false,
        reason: 'Invalid GitHub repository URL'
      };
    }
    
    const owner = pathParts[0];
    const repo = pathParts[1];
    
    // Try to get README via GitHub API
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;
    
    const response = await axios.get(apiUrl, {
      timeout: 10000,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'RecruitAI-Backend'
      },
      validateStatus: function (status) {
        return status >= 200 && status < 400;
      }
    });
    
    if (response.status === 200) {
      const readmeData = response.data;
      
      // Decode base64 content
      let content = '';
      try {
        content = Buffer.from(readmeData.content, 'base64').toString('utf-8');
      } catch (decodeError) {
        content = '[Error decoding README content]';
      }
      
      return {
        available: true,
        content: content.substring(0, 5000), // Limit to 5000 chars
        encoding: readmeData.encoding,
        size: readmeData.size,
        truncated: content.length > 5000
      };
    } else {
      return {
        available: false,
        reason: `GitHub API returned status ${response.status}`
      };
    }
  } catch (error) {
    return {
      available: false,
      reason: `README extraction failed: ${error.message}`
    };
  }
}

/**
 * Validate submission requirements
 * 
 * Checks if the submission meets basic requirements
 */
export async function validateSubmissionRequirements(candidate, project, repositoryInfo) {
  const requirements = {
    passed: true,
    checks: [],
    warnings: [],
    errors: []
  };
  
  // Check 1: Repository is accessible
  if (!repositoryInfo.accessible) {
    requirements.passed = false;
    requirements.errors.push({
      check: 'repository_accessibility',
      message: 'Repository is not accessible',
      details: repositoryInfo.error
    });
  } else {
    requirements.checks.push({
      check: 'repository_accessibility',
      passed: true,
      message: 'Repository is accessible'
    });
  }
  
  // Check 2: Repository is public (if GitHub)
  if (repositoryInfo.platform === 'github' && repositoryInfo.repositoryInfo) {
    if (repositoryInfo.repositoryInfo.private) {
      requirements.passed = false;
      requirements.errors.push({
        check: 'repository_privacy',
        message: 'Repository must be public for verification',
        details: 'Private repositories cannot be accessed for verification'
      });
    } else {
      requirements.checks.push({
        check: 'repository_privacy',
        passed: true,
        message: 'Repository is public'
      });
    }
  }
  
  // Check 3: Repository has been updated recently (optional)
  if (repositoryInfo.repositoryInfo && repositoryInfo.repositoryInfo.updatedAt) {
    const updatedAt = new Date(repositoryInfo.repositoryInfo.updatedAt);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    if (updatedAt < oneYearAgo) {
      requirements.warnings.push({
        check: 'repository_recency',
        message: 'Repository was last updated over a year ago',
        details: `Last update: ${updatedAt.toISOString().split('T')[0]}`
      });
    } else {
      requirements.checks.push({
        check: 'repository_recency',
        passed: true,
        message: 'Repository has been updated within the last year'
      });
    }
  }
  
  // Check 4: Deadline not expired (should already be checked by canSubmit)
  const now = new Date();
  if (candidate.bufferDeadline && now > candidate.bufferDeadline) {
    requirements.passed = false;
    requirements.errors.push({
      check: 'deadline',
      message: 'Submission deadline has expired',
      details: `Buffer deadline: ${candidate.bufferDeadline.toISOString()}`
    });
  } else {
    requirements.checks.push({
      check: 'deadline',
      passed: true,
      message: 'Submission is within deadline'
    });
  }
  
  return requirements;
}

/**
 * SAFE repository content fetching
 * 
 * IMPORTANT SAFETY RULES:
 * 1. NEVER execute student code
 * 2. NEVER clone repositories to server filesystem
 * 3. ONLY fetch metadata and file listings via APIs
 * 4. Use timeouts and size limits
 * 5. Validate all inputs
 */

/**
 * Get repository file structure
 * 
 * For GitHub: Uses GitHub API to get tree
 * For others: Limited to README and basic info
 */
export async function getRepositoryStructure(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    if (hostname.includes('github.com')) {
      return await getGitHubRepositoryStructure(url);
    }
    
    // For non-GitHub repositories, we can only get limited info
    const repositoryInfo = await extractRepositoryInfo(url);
    
    if (!repositoryInfo.accessible) {
      throw new Error(`Repository not accessible: ${repositoryInfo.error}`);
    }
    
    // Try to get README as a basic structure indicator
    const readmeInfo = await getReadmeContent(url);
    
    return {
      platform: 'generic',
      url,
      accessible: true,
      structure: {
        readmeAvailable: readmeInfo.available,
        fileCount: 'unknown',
        languages: 'unknown',
        lastUpdated: repositoryInfo.extractedAt
      },
      note: 'Detailed structure only available for GitHub repositories via API'
    };
  } catch (error) {
    return {
      url,
      accessible: false,
      error: error.message,
      structure: null
    };
  }
}

/**
 * Get GitHub repository structure via API
 */
async function getGitHubRepositoryStructure(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p.trim());
    
    if (pathParts.length < 2) {
      throw new Error('Invalid GitHub repository URL');
    }
    
    const owner = pathParts[0];
    const repo = pathParts[1];
    
    // Get repository info
    const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
    const repoResponse = await axios.get(repoUrl, {
      timeout: 10000,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'RecruitAI-Backend'
      }
    });
    
    if (repoResponse.status !== 200) {
      throw new Error(`GitHub API returned status ${repoResponse.status}`);
    }
    
    const repoData = repoResponse.data;
    
    // Get repository languages
    const languagesUrl = `https://api.github.com/repos/${owner}/${repo}/languages`;
    let languages = {};
    
    try {
      const languagesResponse = await axios.get(languagesUrl, {
        timeout: 5000,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'RecruitAI-Backend'
        }
      });
      
      if (languagesResponse.status === 200) {
        languages = languagesResponse.data;
      }
    } catch (langError) {
      // Languages API might fail, but that's okay
      console.warn('Failed to fetch repository languages:', langError.message);
    }
    
    // Get repository tree (top-level files and directories)
    // Using recursive=false to limit data and prevent deep traversal
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${repoData.default_branch || 'main'}?recursive=false`;
    let tree = { files: [], directories: [] };
    
    try {
      const treeResponse = await axios.get(treeUrl, {
        timeout: 5000,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'RecruitAI-Backend'
        }
      });
      
      if (treeResponse.status === 200) {
        const treeData = treeResponse.data;
        
        // Categorize tree items
        if (treeData.tree && Array.isArray(treeData.tree)) {
          treeData.tree.forEach(item => {
            if (item.type === 'blob') {
              tree.files.push({
                path: item.path,
                size: item.size || 0,
                extension: getFileExtension(item.path)
              });
            } else if (item.type === 'tree') {
              tree.directories.push({
                path: item.path,
                type: 'directory'
              });
            }
          });
        }
      }
    } catch (treeError) {
      // Tree API might fail, but that's okay
      console.warn('Failed to fetch repository tree:', treeError.message);
    }
    
    // Get README content
    const readmeInfo = await getReadmeContent(url);
    
    return {
      platform: 'github',
      url,
      accessible: true,
      repository: {
        name: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description,
        defaultBranch: repoData.default_branch,
        size: repoData.size, // in KB
        language: repoData.language,
        languages: languages,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        createdAt: repoData.created_at,
        updatedAt: repoData.updated_at
      },
      structure: {
        files: tree.files.slice(0, 50), // Limit to 50 files
        directories: tree.directories.slice(0, 20), // Limit to 20 directories
        totalFiles: tree.files.length,
        totalDirectories: tree.directories.length,
        languages: Object.keys(languages),
        readme: readmeInfo.available ? {
          available: true,
          size: readmeInfo.size,
          truncated: readmeInfo.truncated
        } : { available: false }
      },
      safetyNote: 'Only metadata fetched via GitHub API. No code execution.'
    };
  } catch (error) {
    return {
      platform: 'github',
      url,
      accessible: false,
      error: `GitHub repository structure fetch failed: ${error.message}`,
      structure: null
    };
  }
}

/**
 * Get file extension from path
 */
function getFileExtension(filename) {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Get key files from repository
 * 
 * Identifies important files for project analysis:
 * - Package.json, requirements.txt, etc.
 * - Source code files
 * - Configuration files
 */
export async function getKeyRepositoryFiles(url) {
  try {
    const structure = await getRepositoryStructure(url);
    
    if (!structure.accessible || !structure.structure) {
      return {
        available: false,
        error: structure.error || 'Repository structure not available'
      };
    }
    
    const keyFilePatterns = [
      // Package management
      /package\.json$/i,
      /requirements\.txt$/i,
      /Pipfile$/i,
      /poetry\.lock$/i,
      /Gemfile$/i,
      /Cargo\.toml$/i,
      /go\.mod$/i,
      /composer\.json$/i,
      /pom\.xml$/i,
      /build\.gradle$/i,
      
      // Configuration
      /\.env\./i,
      /config\./i,
      /settings\./i,
      /webpack\.config\./i,
      /dockerfile/i,
      /docker-compose\.yml$/i,
      
      // Source code (common extensions)
      /\.(js|ts|jsx|tsx)$/i,
      /\.(py)$/i,
      /\.(java)$/i,
      /\.(cpp|c|cc)$/i,
      /\.(cs)$/i,
      /\.(php)$/i,
      /\.(rb)$/i,
      /\.(go)$/i,
      /\.(rs)$/i,
      /\.(swift)$/i,
      /\.(kt|kts)$/i,
      /\.(scala)$/i,
      
      // Project files
      /README\./i,
      /CONTRIBUTING\./i,
      /LICENSE$/i,
      /\.gitignore$/i,
      
      // Test files
      /test\./i,
      /spec\./i,
      /\.test\./i,
      /\.spec\./i
    ];
    
    const keyFiles = [];
    
    if (structure.structure.files && Array.isArray(structure.structure.files)) {
      structure.structure.files.forEach(file => {
        for (const pattern of keyFilePatterns) {
          if (pattern.test(file.path)) {
            keyFiles.push({
              path: file.path,
              extension: file.extension,
              size: file.size,
              type: categorizeFile(file.path)
            });
            break; // Found a match, move to next file
          }
        }
      });
    }
    
    // Sort by importance
    keyFiles.sort((a, b) => {
      const importanceOrder = {
        'package': 1,
        'config': 2,
        'readme': 3,
        'source': 4,
        'test': 5,
        'other': 6
      };
      
      return (importanceOrder[a.type] || 6) - (importanceOrder[b.type] || 6);
    });
    
    return {
      available: true,
      files: keyFiles.slice(0, 30), // Limit to 30 key files
      totalKeyFiles: keyFiles.length,
      repositoryInfo: structure.repository || null
    };
  } catch (error) {
    return {
      available: false,
      error: `Failed to get key repository files: ${error.message}`
    };
  }
}

/**
 * Categorize file by type
 */
function categorizeFile(filepath) {
  const filename = filepath.toLowerCase();
  
  if (filename.includes('package.json') || 
      filename.includes('requirements.txt') ||
      filename.includes('pom.xml') ||
      filename.includes('build.gradle') ||
      filename.includes('cargo.toml') ||
      filename.includes('go.mod')) {
    return 'package';
  }
  
  if (filename.includes('dockerfile') ||
      filename.includes('.env') ||
      filename.includes('config.') ||
      filename.includes('settings.') ||
      filename.includes('webpack.config')) {
    return 'config';
  }
  
  if (filename.includes('readme')) {
    return 'readme';
  }
  
  if (filename.includes('test') || filename.includes('spec')) {
    return 'test';
  }
  
  // Check for source code extensions
  const sourceExtensions = [
    '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cc',
    '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.kts', '.scala'
  ];
  
  for (const ext of sourceExtensions) {
    if (filename.endsWith(ext)) {
      return 'source';
    }
  }
  
  return 'other';
}

/**
 * Get repository summary for AI analysis
 * 
 * Creates a structured summary of the repository
 * for feeding to AI verification
 */
export async function getRepositorySummary(url) {
  try {
    const [repositoryInfo, keyFiles, readmeInfo] = await Promise.all([
      extractRepositoryInfo(url),
      getKeyRepositoryFiles(url),
      getReadmeContent(url)
    ]);
    
    if (!repositoryInfo.accessible) {
      throw new Error(`Repository not accessible: ${repositoryInfo.error}`);
    }
    
    const summary = {
      url,
      platform: repositoryInfo.platform,
      accessible: true,
      
      // Basic repository info
      repository: repositoryInfo.repositoryInfo || {
        hostname: repositoryInfo.hostname,
        accessible: true
      },
      
      // File structure
      keyFiles: keyFiles.available ? {
        count: keyFiles.totalKeyFiles,
        files: keyFiles.files.map(f => ({
          path: f.path,
          type: f.type,
          extension: f.extension
        }))
      } : null,
      
      // README content (limited)
      readme: readmeInfo.available ? {
        available: true,
        size: readmeInfo.size,
        preview: readmeInfo.content ? 
          readmeInfo.content.substring(0, 2000) : // Limit to 2000 chars
          null,
        truncated: readmeInfo.truncated || (readmeInfo.content && readmeInfo.content.length > 2000)
      } : { available: false },
      
      // Languages (if available)
      languages: repositoryInfo.repositoryInfo?.languages || 
                (repositoryInfo.repositoryInfo?.language ? [repositoryInfo.repositoryInfo.language] : []),
      
      // Timestamps
      extractedAt: repositoryInfo.extractedAt,
      repositoryUpdatedAt: repositoryInfo.repositoryInfo?.updatedAt,
      
      // Safety assurance
      safety: {
        codeExecution: false,
        fileDownload: false,
        onlyMetadata: true,
        apiCallsOnly: true
      }
    };
    
    return summary;
  } catch (error) {
    return {
      url,
      accessible: false,
      error: error.message,
      extractedAt: new Date()
    };
  }
}

/**
 * Validate repository against project requirements
 * 
 * Basic validation before AI verification
 */
export async function validateRepositoryForProject(repositorySummary, project) {
  const validations = {
    passed: true,
    checks: [],
    warnings: [],
    issues: []
  };
  
  // Check 1: Repository is accessible
  if (!repositorySummary.accessible) {
    validations.passed = false;
    validations.issues.push({
      check: 'accessibility',
      severity: 'error',
      message: 'Repository is not accessible',
      details: repositorySummary.error
    });
    return validations;
  }
  
  validations.checks.push({
    check: 'accessibility',
    passed: true,
    message: 'Repository is accessible'
  });
  
  // Check 2: Has source code files
  if (repositorySummary.keyFiles && repositorySummary.keyFiles.count > 0) {
    const sourceFiles = repositorySummary.keyFiles.files.filter(f => f.type === 'source');
    
    if (sourceFiles.length > 0) {
      validations.checks.push({
        check: 'source_code',
        passed: true,
        message: `Repository contains ${sourceFiles.length} source code files`
      });
    } else {
      validations.warnings.push({
        check: 'source_code',
        severity: 'warning',
        message: 'No source code files detected in key files',
        details: 'This might be a documentation-only repository'
      });
    }
  } else {
    validations.warnings.push({
      check: 'source_code',
      severity: 'warning',
      message: 'Could not analyze repository file structure',
      details: 'Key files analysis unavailable'
    });
  }
  
  // Check 3: Has README (recommended but not required)
  if (repositorySummary.readme.available) {
    validations.checks.push({
      check: 'readme',
      passed: true,
      message: 'Repository has README documentation'
    });
  } else {
    validations.warnings.push({
      check: 'readme',
      severity: 'warning',
      message: 'No README file detected',
      details: 'README helps with project understanding'
    });
  }
  
  // Check 4: Repository activity (if data available)
  if (repositorySummary.repositoryUpdatedAt) {
    const updatedAt = new Date(repositorySummary.repositoryUpdatedAt);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    if (updatedAt < sixMonthsAgo) {
      validations.warnings.push({
        check: 'activity',
        severity: 'warning',
        message: 'Repository has not been updated in over 6 months',
        details: `Last update: ${updatedAt.toISOString().split('T')[0]}`
      });
    } else {
      validations.checks.push({
        check: 'activity',
        passed: true,
        message: 'Repository has recent activity'
      });
    }
  }
  
  // Check 5: Project-specific technology match (basic)
  if (project.technologies && project.technologies.length > 0 && repositorySummary.languages.length > 0) {
    const projectTechs = project.technologies.map(t => t.toLowerCase());
    const repoLanguages = repositorySummary.languages.map(l => l.toLowerCase());
    
    // Check for any language match
    const matches = repoLanguages.filter(lang => 
      projectTechs.some(tech => lang.includes(tech) || tech.includes(lang))
    );
    
    if (matches.length > 0) {
      validations.checks.push({
        check: 'technology_match',
        passed: true,
        message: `Repository uses ${matches.length} matching technology(ies): ${matches.join(', ')}`
      });
    } else {
      validations.warnings.push({
        check: 'technology_match',
        severity: 'warning',
        message: 'No obvious technology match found',
        details: `Project requires: ${project.technologies.join(', ')}. Repository has: ${repositorySummary.languages.join(', ')}`
      });
    }
  }
  
  return validations;
}