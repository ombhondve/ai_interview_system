/**
 * Repository validation service
 * 
 * SAFETY FIRST: Never execute untrusted student code
 * Read-only repository access only
 */

import axios from "axios";
import { githubGet } from "./github.client.js";

/**
 * Parse and normalise a GitHub repository URL into its owner/repo pair.
 *
 * Students commonly paste the clone URL, which carries a trailing ".git"
 * (e.g. https://github.com/ombhondve/EduReg2.git). The GitHub REST API does
 * NOT accept that suffix, so requesting
 *   https://api.github.com/repos/ombhondve/EduReg2.git
 * returns 404 even though the repository exists.
 *
 * This helper is the single source of truth for owner/repo extraction so every
 * GitHub API call in this service uses the same normalised values. It handles:
 *   https://github.com/owner/repo          -> owner, repo
 *   https://github.com/owner/repo.git      -> owner, repo      (.git stripped)
 *   https://github.com/owner/repo.git/     -> owner, repo      (.git/ stripped)
 *   https://github.com/owner/repo/         -> owner, repo      (trailing slash)
 *   https://github.com/owner/repo?tab=readme-ov-ri -> owner, repo (query ignored)
 *
 * @param {string} url - repository URL (any casing of the .git suffix)
 * @returns {{owner: string, repo: string}|null} null when the URL is not a
 *   recognisable GitHub repository URL (missing owner or repo segment).
 */
export function parseGitHubRepoUrl(url) {
  let urlObj;
  try {
    urlObj = new URL(url);
  } catch {
    return null;
  }

  // pathname excludes query string and hash, and splitting on "/" plus
  // filtering empty segments transparently drops any trailing slash.
  const pathParts = urlObj.pathname.split("/").filter((part) => part.trim());

  if (pathParts.length < 2) {
    return null;
  }

  let owner = pathParts[0];
  let repo = pathParts[1];

  // Safely decode percent-encoded segments; fall back to the raw value.
  try {
    owner = decodeURIComponent(owner);
    repo = decodeURIComponent(repo);
  } catch {
    // keep raw values
  }

  // Strip the clone-URL ".git" suffix (case-insensitive, only at the end).
  // A trailing slash may leave the suffix as ".git/" only if the URL was not
  // split on "/" - filter() above handles that, so a final slash strip is
  // applied defensively anyway.
  repo = repo.replace(/\/+$/, "").replace(/\.git$/i, "");

  if (!owner || !repo) {
    return null;
  }

  return { owner, repo };
}

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
    const parsed = parseGitHubRepoUrl(url);

    if (!parsed) {
      return {
        accessible: false,
        error: "Invalid GitHub repository URL format"
      };
    }

    const { owner, repo } = parsed;

    // GitHub API endpoint
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
    
    // Shared GitHub client: optional auth, configurable timeout + retry
    const response = await githubGet(apiUrl);
    
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
    
    const parsed = parseGitHubRepoUrl(url);

    if (!parsed) {
      return {
        available: false,
        reason: 'Invalid GitHub repository URL'
      };
    }

    const { owner, repo } = parsed;

    // Try to get README via GitHub API
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;
    
    // Shared GitHub client: optional auth, configurable timeout + retry
    const response = await githubGet(apiUrl);
    
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
    const parsed = parseGitHubRepoUrl(url);

    if (!parsed) {
      throw new Error('Invalid GitHub repository URL');
    }

    const { owner, repo } = parsed;

    // Get repository info
    const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
    const repoResponse = await githubGet(repoUrl);
    
    if (repoResponse.status !== 200) {
      throw new Error(`GitHub API returned status ${repoResponse.status}`);
    }
    
    const repoData = repoResponse.data;
    
    // Get repository languages
    const languagesUrl = `https://api.github.com/repos/${owner}/${repo}/languages`;
    let languages = {};
    
    try {
      const languagesResponse = await githubGet(languagesUrl);
      
      if (languagesResponse.status === 200) {
        languages = languagesResponse.data;
      }
    } catch (langError) {
      // Languages API might fail, but that's okay
      console.warn('Failed to fetch repository languages:', langError.message);
    }
    
    // Get repository tree with RECURSIVE traversal to discover nested files
    // Using recursive=true to get complete file structure
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${repoData.default_branch || 'main'}?recursive=true`;
    let tree = { files: [], directories: [] };
    
    try {
      const treeResponse = await githubGet(treeUrl);
      
      if (treeResponse.status === 200) {
        const treeData = treeResponse.data;
        
        // Safety check: limit total files to prevent overwhelming data
        const MAX_TREE_ITEMS = 1000;
        
        if (treeData.tree && Array.isArray(treeData.tree)) {
          // Filter and categorize tree items
          const allItems = treeData.tree.slice(0, MAX_TREE_ITEMS);
          
          allItems.forEach(item => {
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
          
          // Warn if we hit the limit
          if (treeData.tree.length > MAX_TREE_ITEMS) {
            console.warn(`Repository has ${treeData.tree.length} items, limiting to ${MAX_TREE_ITEMS} for analysis`);
          }
        }
      }
    } catch (treeError) {
      // If recursive fails, fall back to non-recursive
      console.warn('Recursive tree fetch failed, falling back to non-recursive:', treeError.message);
      
      try {
        // Fallback to non-recursive tree
        const fallbackTreeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${repoData.default_branch || 'main'}?recursive=false`;
        const fallbackResponse = await githubGet(fallbackTreeUrl);
        
        if (fallbackResponse.status === 200) {
          const treeData = fallbackResponse.data;
          
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
      } catch (fallbackError) {
        console.warn('Failed to fetch repository tree (both recursive and non-recursive):', fallbackError.message);
      }
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
 * Comprehensive security validation for repository files
 */
function validateFileSecurity(path, content = null) {
  const securityIssues = [];
  const warnings = [];
  
  // 1. Check for dangerous file types
  const dangerousExtensions = [
    '.exe', '.dll', '.so', '.dylib', '.bin', '.o', '.obj', '.msi', '.app',
    '.com', '.bat', '.cmd', '.ps1', '.sh', '.bash', '.vbs', '.wsf',
    '.jar', '.war', '.ear', '.class', '.pyc', '.pyo', '.pyd',
    '.zip', '.rar', '.tar', '.gz', '.7z', '.bz2', '.xz', '.iso', '.img',
    '.dmg', '.pkg', '.deb', '.rpm', '.apk', '.msix', '.appx'
  ];
  
  const ext = getFileExtension(path).toLowerCase();
  if (dangerousExtensions.includes(`.${ext}`)) {
    securityIssues.push(`Dangerous file extension: .${ext}`);
  }
  
  // 2. Check for sensitive file patterns
  const sensitivePatterns = [
    /\.env\b/i,
    /\.secret/i,
    /\.private/i,
    /secret/i,
    /password/i,
    /token/i,
    /key/i,
    /credential/i,
    /\.pem$/i,
    /\.key$/i,
    /\.cert$/i,
    /\.pfx$/i,
    /\.jks$/i,
    /\.keystore$/i,
    /aws[_-]?access/i,
    /aws[_-]?secret/i,
    /azure[_-]?key/i,
    /gcp[_-]?key/i,
    /database[_-]?url/i,
    /connection[_-]?string/i
  ];
  
  for (const pattern of sensitivePatterns) {
    if (pattern.test(path)) {
      securityIssues.push(`Sensitive file pattern: ${path}`);
      break;
    }
  }
  
  // 3. Check for suspicious content if provided
  if (content && typeof content === 'string') {
    // Check for prompt injection attempts
    const injectionPatterns = [
      /ignore.*previous.*instructions/i,
      /system.*prompt/i,
      /internal.*instructions/i,
      /hidden.*prompt/i,
      /you.*are.*now/i,
      /role.*play/i,
      /act.*as/i,
      /pretend.*to.*be/i,
      /disregard.*previous/i,
      /forget.*everything/i,
      /your.*creators/i,
      /your.*developers/i,
      /api.*key/i,
      /bearer.*token/i,
      /basic.*auth/i
    ];
    
    for (const pattern of injectionPatterns) {
      if (pattern.test(content)) {
        warnings.push(`Potential prompt injection detected in ${path}`);
        // Log but don't block - content is evidence, not instructions
        break;
      }
    }
    
    // Check for extremely large content
    if (content.length > 100000) { // 100KB
      warnings.push(`Large file content: ${content.length} bytes in ${path}`);
    }
  }
  
  // 4. Check for path traversal attempts
  if (path.includes('..') || path.includes('~') || path.includes('//')) {
    securityIssues.push(`Potential path traversal: ${path}`);
  }
  
  // 5. Check for binary content indicators
  if (content) {
    const binaryThreshold = 0.3; // 30% non-printable characters
    let nonPrintableCount = 0;
    const sampleSize = Math.min(content.length, 1000);
    
    for (let i = 0; i < sampleSize; i++) {
      const charCode = content.charCodeAt(i);
      if (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13) {
        nonPrintableCount++;
      }
    }
    
    const binaryRatio = nonPrintableCount / sampleSize;
    if (binaryRatio > binaryThreshold) {
      securityIssues.push(`Binary content detected in ${path} (${Math.round(binaryRatio * 100)}% non-printable)`);
    }
  }
  
  return {
    safe: securityIssues.length === 0,
    securityIssues,
    warnings,
    extension: ext
  };
}

/**
 * SAFELY fetch actual file content from GitHub with security limits
 */
async function fetchFileContentSafely(owner, repo, path, branch = 'main') {
  try {
    // Perform comprehensive security validation
    const securityCheck = validateFileSecurity(path);
    
    if (!securityCheck.safe) {
      return {
        available: false,
        reason: `Security issue: ${securityCheck.securityIssues[0]}`,
        content: null,
        size: 0,
        securityIssues: securityCheck.securityIssues
      };
    }
    
    // Skip large files (> 1MB)
    const MAX_FILE_SIZE = 1024 * 1024; // 1MB
    const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB total across all files
    // Size check will be done by parent function
    
    // Skip binary/text files detection
    const textExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cc',
      '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.kts', '.scala',
      '.html', '.htm', '.css', '.scss', '.sass', '.less', '.json', '.yml',
      '.yaml', '.xml', '.md', '.txt', '.rst', '.ini', '.cfg', '.conf',
      '.env', '.gitignore', '.dockerignore', '.editorconfig', '.prettierrc',
      '.eslintrc', '.babelrc', '.npmrc', '.tsconfig', '.jsconfig', '.csv',
      '.sql', '.graphql', '.gql', '.proto', '.thrift', '.sh', '.bash',
      '.ps1', '.bat', '.cmd', '.Makefile', 'Dockerfile', '.dockerfile'
    ];
    
    const isTextFile = textExtensions.includes(`.${securityCheck.extension}`) || 
                      path.toLowerCase().includes('dockerfile') ||
                      path.toLowerCase().includes('makefile');
    
    if (!isTextFile) {
      return {
        available: false,
        reason: 'Non-text file type',
        content: null,
        size: 0,
        extension: securityCheck.extension
      };
    }
    
    // Fetch file content from GitHub API
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
    
    const response = await githubGet(apiUrl);
    
    if (response.status === 200) {
      const fileData = response.data;
      
      // The Contents API returns base64 in `content`, EXCEPT for files above
      // 1MB where it returns an empty string and requires the raw/blob
      // endpoint instead. Treating that empty string as "decoded fine" would
      // silently yield an empty file that looks like a successful fetch.
      if (typeof fileData?.content !== "string" || !fileData.content) {
        return {
          available: false,
          reason: 'GitHub returned no content field (file may exceed 1MB)',
          content: null,
          size: fileData?.size || 0
        };
      }
      
      // Check size
      if (fileData.size > MAX_FILE_SIZE) {
        return {
          available: false,
          reason: `File too large (${fileData.size} bytes > ${MAX_FILE_SIZE} limit)`,
          content: null,
          size: fileData.size
        };
      }
      
      // Decode base64 content
      let content = '';
      try {
        content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      } catch (decodeError) {
        return {
          available: false,
          reason: 'Failed to decode file content',
          content: null,
          size: fileData.size
        };
      }
      
      // Perform content security validation
      const contentSecurityCheck = validateFileSecurity(path, content);
      
      // Log warnings but don't block for content issues (they're evidence, not instructions)
      if (contentSecurityCheck.warnings.length > 0) {
        console.warn(`Security warnings for ${path}:`, contentSecurityCheck.warnings);
      }
      
      // Truncate very large text files
      const MAX_CONTENT_LENGTH = 50000; // 50KB max content
      const truncated = content.length > MAX_CONTENT_LENGTH;
      if (truncated) {
        content = content.substring(0, MAX_CONTENT_LENGTH) + '\n...[truncated]';
      }
      
      // Sanitize content (remove null bytes and control characters except standard whitespace)
      content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      
      return {
        available: true,
        content,
        size: fileData.size,
        truncated,
        sha: fileData.sha,
        path: fileData.path,
        encoding: fileData.encoding,
        security: {
          warnings: contentSecurityCheck.warnings,
          issues: contentSecurityCheck.securityIssues,
          safe: contentSecurityCheck.safe
        }
      };
    }
    
    return {
      available: false,
      reason: `GitHub API returned status ${response.status}`,
      content: null,
      size: 0
    };
    
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return {
        available: false,
        reason: 'File not found',
        content: null,
        size: 0
      };
    }
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return {
        available: false,
        reason: 'GitHub API timeout',
        content: null,
        size: 0
      };
    }
    
    return {
      available: false,
      reason: `Failed to fetch file: ${error.message}`,
      content: null,
      size: 0
    };
  }
}

/**
 * Get key files from repository
 * 
 * Identifies important files for project analysis:
 * - Package.json, requirements.txt, etc.
 * - Source code files
 * - Configuration files
 */
/**
 * Get key repository files WITH ACTUAL CONTENT for AI verification
 * 
 * IMPORTANT SECURITY: Never execute untrusted code
 */
export async function getKeyRepositoryFiles(url, preloadedStructure = null) {
  try {
    // Reuse the already-fetched repository structure when the caller has it.
    // The previous implementation fetched the entire repository metadata/tree
    // a second time, multiplying GitHub API calls and rate-limit/timeout risk.
    const structure = preloadedStructure || await getRepositoryStructure(url);
    
    if (!structure.accessible || !structure.structure) {
      return {
        available: false,
        error: structure.error || 'Repository structure not available'
      };
    }
    
    const keyFilePatterns = [
      // Package management (HIGH PRIORITY - essential for analysis)
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
      /yarn\.lock$/i,
      
      // Configuration (HIGH PRIORITY)
      /dockerfile/i,
      /docker-compose\.yml$/i,
      /docker-compose\.yaml$/i,
      /\.config\./i,
      /webpack\.config\./i,
      /vite\.config\./i,
      /rollup\.config\./i,
      /babel\.config\./i,
      /tsconfig\.json$/i,
      /jsconfig\.json$/i,
      /\.prettierrc/i,
      /\.eslintrc/i,
      /\.babelrc/i,
      
      // Source code (MEDIUM PRIORITY)
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
      /\.(html|htm)$/i,
      /\.(css|scss|sass|less)$/i,
      
      // Project documentation (LOW PRIORITY)
      /README\./i,
      /CONTRIBUTING\./i,
      /LICENSE$/i,
      /\.gitignore$/i,
      /\.gitattributes$/i,
      
      // Test files (MEDIUM PRIORITY)
      /test\./i,
      /spec\./i,
      /\.test\./i,
      /\.spec\./i,
      
      // Build/CI files (MEDIUM PRIORITY)
      /\.github\/workflows\//i,
      /\.gitlab-ci\.yml$/i,
      /\.travis\.yml$/i,
      /jenkinsfile/i,
      /Makefile$/i,
      /CMakeLists\.txt$/i
    ];
    
    const keyFiles = [];
    const MAX_FILES_TO_FETCH = 20;
    const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB total
    let totalSize = 0;
    
    // Parse GitHub URL to get owner and repo (normalised: strips ".git")
    const parsed = parseGitHubRepoUrl(url);
    if (!parsed) {
      return {
        available: false,
        error: 'Invalid GitHub repository URL',
        files: [],
        filesFetched: 0,
        filesSkipped: 0,
        totalSize: 0
      };
    }
    const { owner, repo } = parsed;

    // CANONICAL BRANCH PROPERTY
    //
    // getRepositoryStructure() normalises GitHub's `default_branch` into
    // `defaultBranch`. Reading `default_branch` here always yielded undefined,
    // so every content fetch silently fell back to 'main'. That fallback only
    // happens to work for repositories whose default branch is literally
    // `main`; for any repository using `master` or another name, every single
    // file-content request 404s and verification degrades to "no content
    // available".
    const branch =
      structure.repository?.defaultBranch ||
      'main';
    
    // First pass: identify key files
    if (structure.structure.files && Array.isArray(structure.structure.files)) {
      structure.structure.files.forEach(file => {
        for (const pattern of keyFilePatterns) {
          if (pattern.test(file.path)) {
            keyFiles.push({
              path: file.path,
              extension: file.extension,
              size: file.size || 0,
              type: categorizeFile(file.path),
              priority: getFilePriority(file.path),
              content: null // Will be fetched later
            });
            break; // Found a match, move to next file
          }
        }
      });
    }
    
    // Sort by priority (package files first, then source, then docs)
    keyFiles.sort((a, b) => a.priority - b.priority);
    
    // Fetch content for top files only.
    //
    // IMPORTANT: Fetch in small concurrent batches instead of sequentially.
    // The old implementation could spend 10-30 seconds on EACH file, so a
    // seven-file repository could consume most/all of the overall timeout and
    // end up with a structure but zero usable content.
    const filesToFetch = keyFiles.slice(0, MAX_FILES_TO_FETCH);
    const filesWithContent = [];
    const MAX_CONCURRENT_CONTENT_FETCHES = 5;

    const fetchOneFile = async (file) => {
      // Skip dangerous/sensitive files before making a GitHub request.
      const dangerousExtensions = ['.exe', '.dll', '.so', '.dylib', '.bin', '.o', '.obj'];
      const ext = (file.extension || '').toLowerCase();

      if (dangerousExtensions.includes(`.${ext}`)) {
        return { ...file, content: null, fetchStatus: 'skipped', reason: 'Dangerous file type' };
      }

      if (
        file.path.toLowerCase().includes('.env') ||
        file.path.toLowerCase().includes('secret') ||
        file.path.toLowerCase().includes('key') ||
        file.path.toLowerCase().includes('credential')
      ) {
        return { ...file, content: null, fetchStatus: 'skipped', reason: 'Sensitive file type' };
      }

      const textExtensions = [
        '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.html', '.css',
        '.json', '.yml', '.yaml', '.md', '.txt', '.xml'
      ];
      const isTextFile =
        textExtensions.includes(`.${ext}`) ||
        file.path.toLowerCase().includes('dockerfile') ||
        file.path.toLowerCase().includes('makefile');

      if (!isTextFile) {
        return { ...file, content: null, fetchStatus: 'skipped', reason: 'Non-text file type' };
      }

      try {
        const contentResult = await fetchFileContentSafely(
          owner,
          repo,
          file.path,
          branch
        );

        if (contentResult.available && typeof contentResult.content === 'string') {
          return {
            ...file,
            content: contentResult.content,
            truncated: contentResult.truncated || false,
            fetchStatus: 'fetched',
            size: contentResult.size || file.size
          };
        }

        return {
          ...file,
          content: null,
          fetchStatus: 'failed',
          reason: contentResult.reason || 'Unknown error'
        };
      } catch (fetchError) {
        return {
          ...file,
          content: null,
          fetchStatus: 'error',
          reason: fetchError.message
        };
      }
    };

    for (let i = 0; i < filesToFetch.length; i += MAX_CONCURRENT_CONTENT_FETCHES) {
      const batch = filesToFetch.slice(i, i + MAX_CONCURRENT_CONTENT_FETCHES);
      const batchResults = await Promise.all(batch.map(fetchOneFile));

      for (const result of batchResults) {
        if (result.fetchStatus === 'fetched') {
          const nextSize = totalSize + (result.size || 0);

          if (nextSize > MAX_TOTAL_SIZE) {
            filesWithContent.push({
              ...result,
              content: null,
              fetchStatus: 'skipped',
              reason: 'Total size limit reached'
            });
            continue;
          }

          totalSize = nextSize;
        }

        filesWithContent.push(result);
      }
    }
    
    const fetched = filesWithContent.filter(f => f.fetchStatus === 'fetched');
    const failed = filesWithContent.filter(f => f.fetchStatus === 'failed');
    const errored = filesWithContent.filter(f => f.fetchStatus === 'error');

    // SAFE DIAGNOSTICS
    //
    // Counts only - never file contents, tokens or secrets. Without this, a
    // repository whose branch resolution silently defaulted to the wrong ref
    // produced an identical "no content" symptom with no way to tell it apart
    // from a genuinely empty repository.
    console.log(
      `[repository] repositoryContentFetched=${fetched.length > 0} ` +
        `branch=${branch} filesFound=${keyFiles.length} ` +
        `filesWithContent=${fetched.length} ` +
        `filesFailed=${failed.length} filesErrored=${errored.length} ` +
        `filesSkipped=${filesWithContent.filter(f => f.fetchStatus === 'skipped').length} ` +
        `totalBytes=${totalSize}`
    );

    if (failed.length > 0 || errored.length > 0) {
      console.warn(
        `[repository] file content fetch problems: ` +
          [...failed, ...errored]
            .slice(0, 10)
            .map(f => `${f.path} (${f.fetchStatus}: ${f.reason || 'unknown'})`)
            .join(', ')
      );
    }

    return {
      available: true,
      files: filesWithContent,
      totalKeyFiles: keyFiles.length,
      filesFetched: fetched.length,
      filesFailed: failed.length + errored.length,
      filesSkipped: filesWithContent.filter(f => f.fetchStatus === 'skipped').length,
      totalSize,
      branch,
      repositoryInfo: structure.repository || null,
      securityNote: 'Only text files fetched via GitHub API. No code execution.'
    };
  } catch (error) {
    return {
      available: false,
      error: `Failed to get key repository files: ${error.message}`
    };
  }
}

/**
 * Get file priority for sorting (lower = higher priority)
 */
function getFilePriority(filepath) {
  const filename = filepath.toLowerCase();
  
  // Package files are highest priority
  if (filename.includes('package.json') || 
      filename.includes('requirements.txt') ||
      filename.includes('pom.xml') ||
      filename.includes('build.gradle') ||
      filename.includes('cargo.toml') ||
      filename.includes('go.mod')) {
    return 1;
  }
  
  // Configuration files
  if (filename.includes('dockerfile') ||
      filename.includes('webpack.config') ||
      filename.includes('tsconfig.json') ||
      filename.includes('.config.')) {
    return 2;
  }
  
  // Main source files (likely entry points)
  if (filename.includes('index.') ||
      filename.includes('app.') ||
      filename.includes('main.') ||
      filename.includes('server.') ||
      filename.includes('src/index.')) {
    return 3;
  }
  
  // Other source files
  const sourceExtensions = [
    '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cc',
    '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.kts', '.scala',
    '.html', '.css', '.scss', '.sass', '.less'
  ];
  
  for (const ext of sourceExtensions) {
    if (filename.endsWith(ext)) {
      return 4;
    }
  }
  
  // Documentation
  if (filename.includes('readme')) {
    return 5;
  }
  
  // Test files
  if (filename.includes('test') || filename.includes('spec')) {
    return 6;
  }
  
  // Other files
  return 7;
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


/**
 * Fetch repository content WITH ACTUAL FILE CONTENT for AI verification
 * 
 * This function maintains compatibility with the verification service
 * which expects a { success, error, data } format
 * 
 * EDGE CASE HANDLING:
 * - GitHub API rate limits
 * - Timeouts
 * - Empty repositories
 * - Large repositories
 * - Private repositories
 * - Invalid URLs
 */
export async function fetchRepositoryContent(url) {
  const startTime = Date.now();
  
  try {
    // Validate URL first
    const urlValidation = validateRepositoryUrl(url);
    if (!urlValidation.valid) {
      return {
        success: false,
        error: urlValidation.error || "Invalid repository URL",
        data: null,
        metadata: {
          validationFailed: true,
          validationError: urlValidation.error
        }
      };
    }
    
    // Safety-net timeout for the entire fetch operation. Configurable via
    // REPO_FETCH_TIMEOUT_MS; leaves headroom for the per-request GitHub
    // timeout (GITHUB_API_TIMEOUT_MS) plus its retries.
    const operationTimeoutMs =
      Number(process.env.REPO_FETCH_TIMEOUT_MS) > 0
        ? Math.floor(Number(process.env.REPO_FETCH_TIMEOUT_MS))
        : 90000;

    let operationTimeoutHandle = null;
    const timeoutPromise = new Promise((_, reject) => {
      operationTimeoutHandle = setTimeout(
        () => reject(new Error(`Repository fetch timeout (${operationTimeoutMs}ms)`)),
        operationTimeoutMs
      );
    });
    
    // Variables to share data between fetch operation and outer scope
    let fileCount = 0;
    let keyFilesResultRef = null;
    
    // Execute repository fetching with timeout
    const fetchOperation = async () => {
      // Fetch repository structure ONCE and reuse it for key-file selection.
      // Previously getKeyRepositoryFiles() fetched the same structure again,
      // multiplying GitHub API calls and making rate limits/timeouts much more
      // likely on Vercel.
      const repoStructure = await getRepositoryStructure(url);

      if (!repoStructure.accessible) {
        return {
          success: false,
          error: repoStructure.error || "Repository not accessible",
          data: null,
          metadata: {
            accessible: false,
            error: repoStructure.error
          }
        };
      }

      const [keyFilesResult, readmeInfo] = await Promise.all([
        getKeyRepositoryFiles(url, repoStructure),
        getReadmeContent(url)
      ]);
      
      // Store references for use in outer scope
      keyFilesResultRef = keyFilesResult;
      
      // Handle empty repository (no files)
      if (repoStructure.structure && 
          repoStructure.structure.files && 
          repoStructure.structure.files.length === 0) {
        return {
          success: false,
          error: "Repository appears to be empty",
          data: null,
          metadata: {
            accessible: true,
            empty: true,
            filesCount: 0
          }
        };
      }
      
      // Handle very large repositories (warning but continue)
      fileCount = repoStructure.structure?.files?.length || 0;
      if (fileCount > 1000) {
        console.warn(`Large repository detected: ${fileCount} files, analysis may be limited`);
      }
    
      // Extract actual file content for AI analysis
      const keyFilesWithContent = {};
      if (keyFilesResult.available && keyFilesResult.files) {
        keyFilesResult.files.forEach(file => {
          if (file.content && file.fetchStatus === 'fetched') {
            keyFilesWithContent[file.path] = {
              content: file.content,
              size: file.size,
              truncated: file.truncated || false,
              type: file.type
            };
          }
        });
      }
      
      // Extract README content if available
      let readmeContent = null;
      if (readmeInfo.available && readmeInfo.content) {
        readmeContent = {
          content: readmeInfo.content,
          size: readmeInfo.size,
          truncated: readmeInfo.truncated || false
        };
        // Add to key files as well
        keyFilesWithContent['README.md'] = {
          content: readmeInfo.content.substring(0, 5000), // Limit README to 5000 chars
          size: Math.min(readmeInfo.size || 0, 5000),
          truncated: readmeInfo.truncated || readmeInfo.content.length > 5000,
          type: 'readme'
        };
      }
      
      // Calculate statistics
      const statistics = {
        totalCommits: repoStructure.repository?.commits || 0,
        lastCommit: repoStructure.repository?.updatedAt || "unknown",
        languages: repoStructure.repository?.languages || {},
        size: repoStructure.repository?.size || 0
      };
      
      // Build metadata
      const metadata = {
        platform: repoStructure.platform,
        url: repoStructure.url,
        accessible: repoStructure.accessible,
        repository: repoStructure.repository || {},
        dependencies: extractDependencies(keyFilesWithContent),
        buildFiles: extractBuildFiles(keyFilesWithContent),
        filesAnalyzed: keyFilesResult.filesFetched || 0,
        filesSkipped: keyFilesResult.filesSkipped || 0,
        totalSize: keyFilesResult.totalSize || 0
      };
      
      return {
        success: true,
        error: null,
        data: {
          structure: repoStructure.structure,
          keyFiles: keyFilesWithContent,
          metadata,
          statistics,
          readme: readmeContent,
          security: {
            codeExecution: false,
            fileDownload: false,
            onlyMetadata: false,
            actualContentFetched: true,
            unsafeFilesSkipped: keyFilesResult.filesSkipped || 0
          }
        }
      };
    };
    
    // Execute with timeout protection (clear the timer so a settled race
    // never leaves a dangling timer / rejected promise behind)
    let result;
    try {
      result = await Promise.race([fetchOperation(), timeoutPromise]);
    } finally {
      if (operationTimeoutHandle) clearTimeout(operationTimeoutHandle);
    }
    const fetchTime = Date.now() - startTime;
    
    // Add timing metadata
    if (result.success && result.data) {
      result.data.metadata.fetchTimeMs = fetchTime;
      result.data.metadata.timestamp = new Date().toISOString();
      
      // Add edge case warnings
      const warnings = [];
      if (fileCount > 1000) {
        warnings.push(`Large repository: ${fileCount} files (analysis limited to key files)`);
      }
      
      if (keyFilesResultRef?.filesSkipped > 10) {
        warnings.push(`Many files skipped: ${keyFilesResultRef.filesSkipped} files not analyzed due to security/size limits`);
      }
      
      if (warnings.length > 0) {
        result.data.metadata.warnings = warnings;
      }
    }
    
    return result;
    
  } catch (error) {
    const fetchTime = Date.now() - startTime;
    
    // Handle specific error types with user-friendly messages
    let errorMessage = error.message || "Failed to fetch repository content";
    let errorType = "unknown";
    
    if (error.message.includes("timeout") || error.message.includes("Timeout")) {
      errorMessage = "Repository analysis timed out (30 second limit exceeded)";
      errorType = "timeout";
    } else if (error.message.includes("rate limit") || error.message.includes("API rate limit") || error.message.includes("403")) {
      errorMessage = "GitHub API rate limit exceeded. Please try again in a few minutes.";
      errorType = "rate_limit";
    } else if (error.message.includes("Not Found") || error.message.includes("404")) {
      errorMessage = "Repository not found. Please check if the repository exists and is publicly accessible.";
      errorType = "not_found";
    } else if (error.message.includes("network") || error.message.includes("ECONN") || error.message.includes("ENOTFOUND")) {
      errorMessage = "Network error accessing repository. Please check your internet connection and try again.";
      errorType = "network_error";
    } else if (error.message.includes("Invalid URL")) {
      errorMessage = "Invalid repository URL. Please provide a valid GitHub repository URL.";
      errorType = "invalid_url";
    } else if (error.message.includes("empty")) {
      errorMessage = "Repository appears to be empty or contains no project files.";
      errorType = "empty_repository";
    }
    
    return {
      success: false,
      error: errorMessage,
      data: null,
      metadata: {
        fetchTimeMs: fetchTime,
        errorType,
        originalError: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    };
  }
}

/**
 * Extract dependencies from package files
 */
function extractDependencies(keyFiles) {
  const dependencies = [];
  
  // Check for package.json
  if (keyFiles['package.json'] && keyFiles['package.json'].content) {
    try {
      const packageJson = JSON.parse(keyFiles['package.json'].content);
      if (packageJson.dependencies) {
        dependencies.push(...Object.keys(packageJson.dependencies));
      }
      if (packageJson.devDependencies) {
        dependencies.push(...Object.keys(packageJson.devDependencies));
      }
    } catch (error) {
      // Invalid JSON, skip
    }
  }
  
  // Check for requirements.txt
  if (keyFiles['requirements.txt'] && keyFiles['requirements.txt'].content) {
    const lines = keyFiles['requirements.txt'].content.split('\n');
    lines.forEach(line => {
      const match = line.match(/^([a-zA-Z0-9_-]+)/);
      if (match) {
        dependencies.push(match[1]);
      }
    });
  }
  
  return [...new Set(dependencies)]; // Remove duplicates
}

/**
 * Extract build files from repository
 */
function extractBuildFiles(keyFiles) {
  const buildFiles = [];
  
  const buildFilePatterns = [
    'package.json',
    'Dockerfile',
    'docker-compose.yml',
    'docker-compose.yaml',
    'webpack.config.js',
    'webpack.config.ts',
    'vite.config.js',
    'vite.config.ts',
    'rollup.config.js',
    'rollup.config.ts',
    'tsconfig.json',
    'jsconfig.json',
    'Makefile',
    'CMakeLists.txt',
    '.github/workflows/'
  ];
  
  Object.keys(keyFiles).forEach(path => {
    for (const pattern of buildFilePatterns) {
      if (path.includes(pattern)) {
        buildFiles.push(path);
        break;
      }
    }
  });
  
  return buildFiles;
}