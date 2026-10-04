/**
 * AI verification payload budget
 *
 * Groq rejects oversized verification requests with HTTP 413:
 *   "Request too large for model <model>. TPM Limit: 8000.
 *    Requested: 57447 tokens."
 *
 * The verification prompt embeds the fetched repository as JSON. Without a
 * budget, large repositories produced ~57k tokens and every request failed.
 *
 * This module builds a COMPACT repository representation containing only
 * useful verification evidence, then enforces a HARD character budget on the
 * serialised request so the payload can never exceed the model limit.
 *
 * The budget covers the whole request (system prompt + user payload), because
 * that is what the provider counts as input tokens.
 *
 * SAFETY: this module only reduces what is SENT to the model. It never executes
 * repository code and never reinterprets it. Files are treated as inert
 * evidence; prompt-injection scanning still happens in repository.service.js
 * before content reaches this point.
 */

// Rough conversion. Providers typically bill ~4 characters per token for
// English + JSON/code, which is a safe (slightly conservative) estimate.
const CHARS_PER_TOKEN = 4;

// Default ceiling for the whole verification request (system + user).
// Kept under the 8000 TPM limit with headroom for the completion.
const DEFAULT_MAX_INPUT_TOKENS = 6500;

// Extra room reserved for JSON scaffolding and the request wrapper.
const SAFETY_MARGIN_CHARS = 400;

const TRUNCATION_MARKER = "\n[truncated]";

// ---------------------------------------------------------------------------
// Budget helpers
// ---------------------------------------------------------------------------

/**
 * Read the configured maximum input tokens.
 * Override with AI_VERIFICATION_MAX_INPUT_TOKENS.
 */
export function getMaxInputTokens() {
  const configured = Number(process.env.AI_VERIFICATION_MAX_INPUT_TOKENS);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_MAX_INPUT_TOKENS;
}

/** Approximate token count for a string. */
export function estimateTokens(text) {
  if (typeof text !== "string" || text.length === 0) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Maximum characters allowed across the whole request. */
export function getMaxInputChars() {
  return getMaxInputTokens() * CHARS_PER_TOKEN;
}

/**
 * Characters available for the user payload once the system prompt and a
 * safety margin are reserved. Never returns less than MIN_USER_PAYLOAD_CHARS.
 */
export function getUserPayloadBudgetChars(systemPromptChars = 0) {
  const reserve = Math.max(0, Number(systemPromptChars) || 0) + SAFETY_MARGIN_CHARS;
  const remaining = getMaxInputChars() - reserve;
  return Math.max(1200, remaining);
}

// ---------------------------------------------------------------------------
// Exclusion rules - what must never be sent to the model
// ---------------------------------------------------------------------------

// Vendored / build / VCS directories (any depth).
const EXCLUDED_DIR = /(?:^|\/)(?:node_modules|\.git|dist|build|out|output|coverage|\.next|\.nuxt|nuxt|public\/build|vendor|__pycache__|\.venv|venv|env|target|bin|obj|\.cache|\.turbo|\.parcel-cache|\.vercel|\.output|storybook-static|tmp|temp|logs|site-packages|\.mypy_cache|\.pytest_cache)(?:\/|$)/i;

// Lockfiles and OS noise - only useful in rare cases and very large.
const EXCLUDED_LOCKFILE = /(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|npm-shrinkwrap\.json|poetry\.lock|Pipfile\.lock|composer\.lock|Cargo\.lock|go\.sum|Gemfile\.lock|gradle\.lockfile|mix\.lock)$/i;

// Images, fonts, media, archives, binaries, databases.
const EXCLUDED_BINARY_EXT =
  /\.(?:png|jpe?g|gif|webp|svg|ico|bmp|tiff?|avif|heic|pdf|mp3|wav|ogg|flac|m4a|mp4|avi|mov|mkv|webm|wmv|woff2?|ttf|otf|eot|zip|tar|gz|bz2|xz|7z|rar|jar|war|ear|class|pyc|pyo|pyd|so|dylib|dll|exe|bin|dat|db|sqlite3?|wasm|node|lock)$/i;

// Minified bundles, source maps, editor/OS junk.
const EXCLUDED_NOISE = /(?:^|\/)(?:\.DS_Store|Thumbs\.db|desktop\.ini|\.env|\.npmrc|\.gitignore|\.gitattributes)$|(?:\.min\.(?:js|mjs|css))$|\.map$/i;

// Oversized stylesheets - rarely relevant to requirement verification.
const CSS_FILE = /\.css$/i;
const MAX_CSS_CHARS = 1200;

// Heuristic: content that is mostly non-printable is binary in disguise.
const BINARY_SAMPLE_SIZE = 1000;
const BINARY_RATIO_THRESHOLD = 0.3;

/**
 * Whether a repository path should be excluded from the AI payload entirely.
 * @param {string} path repository-relative path
 * @returns {boolean}
 */
export function isExcludedPath(path) {
  if (typeof path !== "string" || !path.trim()) return true;
  return (
    EXCLUDED_DIR.test(path) ||
    EXCLUDED_LOCKFILE.test(path) ||
    EXCLUDED_BINARY_EXT.test(path) ||
    EXCLUDED_NOISE.test(path)
  );
}

/**
 * Cheap binary detection so binary blobs never reach the model.
 * @param {string} content
 * @returns {boolean}
 */
export function looksBinary(content) {
  if (typeof content !== "string" || content.length === 0) return false;
  const sample = content.slice(0, BINARY_SAMPLE_SIZE);
  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) nonPrintable++;
  }
  return nonPrintable / sample.length > BINARY_RATIO_THRESHOLD;
}
// ---------------------------------------------------------------------------
// Prioritisation - which files are the most useful verification evidence
// ---------------------------------------------------------------------------

// Higher score = included first when the budget is tight.
const SCORE = {
  README: 1000,
  EXPECTED: 900, // explicitly required by the assigned project
  MANIFEST: 800, // package.json, requirements.txt, ...
  ENTRY_POINT: 700, // server.js, main.py, index.ts, ...
  API_SCHEMA: 600, // routes, controllers, models, schema, migrations
  CONFIG: 500, // .env.example, docker-compose.yml, vite/webpack config
  SOURCE: 400, // ordinary application source
  TEST: 200, // tests, when relevant
  OTHER: 100
};

const README_RE = /(?:^|\/)readme(?:\.[a-z0-9]+)?$/i;
const EXPECTED_FILE_RE = /(?:^|\/)([\w.-]+\.[a-z0-9]+)$/i;
const MANIFEST_RE =
  /(?:^|\/)(?:package\.json|requirements\.txt|pom\.xml|build\.gradle(?:\.kts)?|cargo\.toml|go\.mod|composer\.json|pyproject\.toml|gemfile|pubspec\.yaml|mix\.exs)$/i;
const ENTRY_POINT_RE =
  /(?:^|\/)(?:server\.(?:js|ts|mjs|cjs)|app\.(?:js|ts|mjs|cjs)|index\.(?:js|ts|mjs|cjs|jsx|tsx)|main\.(?:js|ts|mjs|cjs|py)|app\.py|manage\.py|__main__\.py|main\.java|main\.go|main\.rs|Program\.cs|run\.py|wsgi\.py|asgi\.py)$/i;
const API_SCHEMA_RE =
  /(?:^|\/)(?:routes?|controllers?|api|endpoints?|models?|entities|schemas?|repositories?|services?|migrations?|prisma)(?:\/|$)|(?:\.controller|\.service|\.model|\.route|\.entity|\.schema)\.[a-z0-9]+$|\.sql$/i;
const CONFIG_RE =
  /(?:^|\/)(?:dockerfile|docker-compose\.ya?ml|\.env\.example|\.env\.sample|tsconfig\.json|vite\.config\.[a-z]+|webpack\.config\.[a-z]+|tailwind\.config\.[a-z]+|next\.config\.[a-z]+|nuxt\.config\.[a-z]+|angular\.json|jest\.config\.[a-z]+|pytest\.ini|tox\.ini)$/i;
const TEST_RE = /(?:^|\/)(?:tests?|__tests__|spec|e2e|cypress)(?:\/|$)|\.(?:test|spec)\.[a-z0-9]+$|_test\.(?:js|ts|py|go|java)$/i;
const SOURCE_EXT =
  /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts|py|java|kt|kts|cs|go|rs|rb|php|swift|dart|scala|vue|svelte|c|cpp|h|hpp|sql|graphql|gql|prisma|json|ya?ml|xml|toml|ini|md)$/i;

/**
 * Score a file's usefulness as verification evidence.
 *
 * @param {string} path repository-relative path
 * @param {string[]} expectedFiles files explicitly required by the project
 * @returns {number} higher is more valuable
 */
export function scoreFile(path, expectedFiles = []) {
  if (typeof path !== "string") return SCORE.OTHER;

  const lower = path.toLowerCase();

  if (README_RE.test(lower)) return SCORE.README;

  const expectedMatch = lower.match(EXPECTED_FILE_RE);
  if (
    expectedMatch &&
    expectedFiles.some((name) => String(name).toLowerCase() === expectedMatch[1])
  ) {
    return SCORE.EXPECTED;
  }

  if (MANIFEST_RE.test(lower)) return SCORE.MANIFEST;
  if (ENTRY_POINT_RE.test(lower)) return SCORE.ENTRY_POINT;
  if (API_SCHEMA_RE.test(lower)) return SCORE.API_SCHEMA;
  if (CONFIG_RE.test(lower)) return SCORE.CONFIG;
  if (TEST_RE.test(lower)) return SCORE.TEST;
  if (SOURCE_EXT.test(lower)) return SCORE.SOURCE;

  return SCORE.OTHER;
}

/**
 * Truncate a string to a maximum length, appending a clear marker.
 * @param {string} text
 * @param {number} maxChars
 * @returns {{content: string, truncated: boolean}}
 */
export function truncateText(text, maxChars) {
  const value = typeof text === "string" ? text : "";
  if (maxChars <= 0) {
    return { content: "", truncated: value.length > 0 };
  }
  if (value.length <= maxChars) {
    return { content: value, truncated: false };
  }
  // Reserve room for the marker so the result never exceeds maxChars.
  const keep = Math.max(0, maxChars - TRUNCATION_MARKER.length);
  return {
    content: value.slice(0, keep) + TRUNCATION_MARKER,
    truncated: true
  };
}
// ---------------------------------------------------------------------------
// Compact repository representation + hard budget enforcement
// ---------------------------------------------------------------------------

// Per-file caps so one large file cannot consume the whole budget.
const MAX_FILE_CHARS = 4000;
const MAX_README_CHARS = 1800;
const MIN_FILE_CHARS = 220;

// Caps for the structural overview (cheap, but still bounded).
const MAX_LISTED_FILES = 60;
const MAX_LISTED_DIRS = 30;

// Requirement fields are essential context, so they get a guaranteed slice of
// the budget even when the repository is enormous.
const REQUIREMENTS_BUDGET_RATIO = 0.3;

const serialize = (value) => JSON.stringify(value, null, 2);

/**
 * Reduce the fetched repository to a compact evidence representation.
 *
 * Shape mirrors the original repositoryContent object so the existing AI
 * prompt keeps working, but keyFiles contains only high-value, size-capped
 * files and the content is already truncated.
 *
 * @param {object} repoData repository content as returned by
 *   structureRepositoryContent()
 * @param {object} projectRequirements prepared project requirements
 * @param {number} charBudget hard cap for this section
 * @returns {{content: object, stats: object}}
 */
export function buildCompactRepository(repoData, projectRequirements = {}, charBudget = 4000) {
  const budget = Math.max(0, Math.floor(charBudget));
  const expectedFiles = Array.isArray(projectRequirements?.expectedFiles)
    ? projectRequirements.expectedFiles
    : [];

  const stats = {
    filesConsidered: 0,
    filesIncluded: 0,
    filesExcludedByRules: 0,
    filesDroppedByBudget: 0,
    truncatedFiles: 0
  };

  const structure = repoData?.structure || {};
  const metadata = repoData?.metadata || {};
  const keyFiles =
    repoData?.keyFiles && typeof repoData.keyFiles === "object" ? repoData.keyFiles : {};

  // --- Structural overview (paths only; cheap and highly informative) ---
  const listedFiles = (Array.isArray(structure.files) ? structure.files : [])
    .filter((file) => file && typeof file.path === "string")
    .filter((file) => !isExcludedPath(file.path))
    .slice(0, MAX_LISTED_FILES)
    .map((file) => ({ path: file.path, extension: file.extension }));

  const listedDirs = (Array.isArray(structure.directories) ? structure.directories : [])
    .filter((dir) => dir && typeof dir.path === "string")
    .filter((dir) => !isExcludedPath(dir.path))
    .slice(0, MAX_LISTED_DIRS)
    .map((dir) => dir.path);

  const base = {
    structure: {
      files: listedFiles,
      directories: listedDirs,
      totalFilesAnalyzed: metadata?.filesAnalyzed || listedFiles.length,
      filesWithContent: 0,
      languageBreakdown: structure?.languageBreakdown || {}
    },
    dependencies: metadata?.dependencies || [],
    buildFiles: metadata?.buildFiles || [],
    platform: metadata?.platform || "unknown",
    readme: null,
    keyFiles: {}
  };

  let remaining = budget - serialize(base).length;
  if (remaining <= 0) {
    return { content: base, stats };
  }

  // --- README is top priority but capped so source files keep their share ---
  // Falls back to keyFiles, mirroring structureRepositoryContent(), because
  // README.md is otherwise the most valuable evidence we would lose.
  const readmeContent =
    repoData?.readme?.content ||
    metadata?.readme ||
    (typeof keyFiles["README.md"]?.content === "string"
      ? keyFiles["README.md"].content
      : null);
  if (typeof readmeContent === "string" && readmeContent.trim()) {
    const cap = Math.min(
      MAX_README_CHARS,
      Math.max(MIN_FILE_CHARS, Math.floor(budget * 0.2))
    );
    const { content, truncated } = truncateText(readmeContent, cap);
    base.readme = { content, truncated };
    if (truncated) stats.truncatedFiles++;
    remaining -= serialize({ readme: base.readme }).length;
  }

  // --- Prioritised source files ---
  const candidates = Object.entries(keyFiles)
    .map(([path, data]) => ({
      path,
      content: typeof data?.content === "string" ? data.content : "",
      score: scoreFile(path, expectedFiles)
    }))
    .filter((entry) => {
      stats.filesConsidered++;
      if (!entry.content.trim()) return false;
      if (isExcludedPath(entry.path)) {
        stats.filesExcludedByRules++;
        return false;
      }
      if (looksBinary(entry.content)) {
        stats.filesExcludedByRules++;
        return false;
      }
      return true;
    })
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  const entryOverhead = serialize({ p: { c: "" } }).length;

  // Fair-share allocation: instead of letting the first (highest scored) file
  // swallow the whole budget, spread the remaining space across the top
  // candidates. This yields far more verification evidence.
  const TARGET_FILES = 12;
  const perFileShare = Math.max(
    MIN_FILE_CHARS,
    Math.floor(remaining / Math.max(1, Math.min(candidates.length, TARGET_FILES)))
  );

  for (const entry of candidates) {
    if (remaining <= 0 || remaining - entryOverhead < MIN_FILE_CHARS) {
      stats.filesDroppedByBudget++;
      continue;
    }

    const cap = Math.min(
      MAX_FILE_CHARS,
      CSS_FILE.test(entry.path) ? MAX_CSS_CHARS : MAX_FILE_CHARS,
      perFileShare,
      remaining - entryOverhead
    );

    const { content, truncated } = truncateText(entry.content, cap);
    if (!content.trim()) {
      stats.filesDroppedByBudget++;
      continue;
    }

    base.keyFiles[entry.path] = { content, truncated, size: content.length };
    base.structure.filesWithContent += 1;

    remaining -= entryOverhead + serialize({ c: content }).length;
    stats.filesIncluded++;
    if (truncated) stats.truncatedFiles++;
  }

  return { content: base, stats };
}

/**
 * Enforce a hard character budget on the final serialised user payload.
 *
 * Shrinks repository evidence first (never the requirements), then falls back
 * to the structural overview only. The returned string is guaranteed not to
 * exceed maxChars as long as the requirements themselves fit.
 *
 * @param {object} userPrompt the object that will be JSON.stringify'd
 * @param {number} maxChars hard cap
 * @returns {{content: string, stats: object}}
 */
export function enforcePayloadBudget(userPrompt, maxChars) {
  const cap = Math.max(0, Math.floor(maxChars));

  let serialised = serialize(userPrompt);
  const stats = {
    initialChars: serialised.length,
    finalChars: serialised.length,
    shrank: false
  };

  if (serialised.length <= cap) {
    return { content: serialised, stats };
  }

  stats.shrank = true;

  // 1) Rebuild repository evidence against a reduced budget.
  const repoCharBudget = Math.max(
    MIN_FILE_CHARS,
    Math.floor(cap * (1 - REQUIREMENTS_BUDGET_RATIO))
  );
  const rebuilt = buildCompactRepository(
    userPrompt.REPOSITORY_CONTENT,
    userPrompt.PROJECT_REQUIREMENTS,
    repoCharBudget
  );

  serialised = serialize({
    ...userPrompt,
    REPOSITORY_CONTENT: rebuilt.content
  });

  // 2) Progressive shrink. Repository evidence is sacrificed in order of
  //    least value until the payload provably fits, so the cap is a guarantee
  //    rather than a best-effort. Requirements are never touched.
  const evidence = rebuilt.content;
  const shrinkSteps = [
    // (a) drop all file contents, keep the structural overview
    () => ({ ...evidence, keyFiles: {}, readme: null }),
    // (b) also shorten the file listing
    () => ({
      ...evidence,
      keyFiles: {},
      readme: null,
      structure: {
        ...evidence.structure,
        files: evidence.structure.files.slice(0, 20),
        directories: evidence.structure.directories.slice(0, 10)
      }
    }),
    // (c) minimum viable evidence: counts and platform only
    () => ({
      structure: {
        files: [],
        directories: [],
        totalFilesAnalyzed: evidence.structure.totalFilesAnalyzed,
        filesWithContent: 0,
        languageBreakdown: evidence.structure.languageBreakdown
      },
      dependencies: [],
      buildFiles: [],
      platform: evidence.platform,
      readme: null,
      keyFiles: {}
    })
  ];

  for (const shrink of shrinkSteps) {
    if (serialised.length <= cap) break;
    serialised = serialize({
      ...userPrompt,
      REPOSITORY_CONTENT: shrink()
    });
  }

  stats.finalChars = serialised.length;
  stats.withinBudget = serialised.length <= cap;
  return { content: serialised, stats };
}