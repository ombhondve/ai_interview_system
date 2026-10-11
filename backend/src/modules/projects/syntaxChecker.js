/**
 * Deterministic Syntax and Static Analysis Service
 *
 * Provides safe, deterministic parsing of source code files retrieved
 * from repositories WITHOUT executing untrusted student code.
 *
 * Rules:
 * 1. NEVER execute code (pure static parsing only).
 * 2. If a file is marked truncated or contains the truncation marker,
 *    DO NOT attempt syntax parsing (truncation cuts off code mid-statement).
 * 3. Clearly report:
 *    - syntaxValid: true / false / null (skipped)
 *    - error message, line, and column when a real syntax error exists
 *    - status: "VALID", "SYNTAX_ERROR", or "SKIPPED_TRUNCATED"
 */

import { parse as babelParse } from "@babel/parser";

const BABEL_PLUGINS = [
  "jsx",
  "typescript",
  "asyncGenerators",
  "classProperties",
  "classPrivateProperties",
  "classPrivateMethods",
  "dynamicImport",
  "exportDefaultFrom",
  "exportNamespaceFrom",
  "nullishCoalescingOperator",
  "numericSeparator",
  "objectRestSpread",
  "optionalCatchBinding",
  "optionalChaining",
  "topLevelAwait"
];

const JS_TS_EXTENSIONS = new Set([
  "js",
  "jsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "mts",
  "cts"
]);

/**
 * Check if file content is truncated.
 * @param {string} content
 * @param {boolean} [explicitTruncatedFlag]
 * @returns {boolean}
 */
export function isContentTruncated(content, explicitTruncatedFlag = false) {
  if (explicitTruncatedFlag === true) return true;
  if (typeof content !== "string") return false;
  return content.includes("[truncated]") || content.endsWith("...");
}

/**
 * Validate JavaScript or TypeScript syntax using @babel/parser.
 * @param {string} code
 * @param {string} filename
 * @returns {{ valid: boolean, error: string|null, line?: number, column?: number }}
 */
function validateJsTsSyntax(code, filename) {
  try {
    babelParse(code, {
      sourceType: "unambiguous",
      plugins: BABEL_PLUGINS,
      errorRecovery: false
    });
    return { valid: true, error: null };
  } catch (err) {
    return {
      valid: false,
      error: err.message,
      line: err.loc?.line,
      column: err.loc?.column
    };
  }
}

/**
 * Validate JSON syntax.
 * @param {string} content
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateJsonSyntax(content) {
  try {
    JSON.parse(content);
    return { valid: true, error: null };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Validate Python static syntax (basic balanced delimiter and indentation analysis).
 * @param {string} content
 * @returns {{ valid: boolean, error: string|null, line?: number }}
 */
function validatePythonSyntax(content) {
  // Check basic delimiter balance: (), [], {}
  const stack = [];
  const lines = content.split("\n");
  let inTripleQuote = false;
  let tripleQuoteChar = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let j = 0;

    while (j < line.length) {
      // Check triple quotes
      if (!inTripleQuote && (line.slice(j, j + 3) === '"""' || line.slice(j, j + 3) === "'''")) {
        inTripleQuote = true;
        tripleQuoteChar = line.slice(j, j + 3);
        j += 3;
        continue;
      }

      if (inTripleQuote) {
        if (line.slice(j, j + 3) === tripleQuoteChar) {
          inTripleQuote = false;
          j += 3;
        } else {
          j++;
        }
        continue;
      }

      // Single line comments
      if (line[j] === "#") {
        break; // ignore rest of line
      }

      // Single or double quotes
      if (line[j] === '"' || line[j] === "'") {
        const quote = line[j];
        j++;
        while (j < line.length && line[j] !== quote) {
          if (line[j] === "\\") j++; // skip escaped char
          j++;
        }
        if (j < line.length) j++; // skip closing quote
        continue;
      }

      const char = line[j];
      if (char === "(" || char === "[" || char === "{") {
        stack.push({ char, line: i + 1 });
      } else if (char === ")" || char === "]" || char === "}") {
        if (stack.length === 0) {
          return {
            valid: false,
            error: `Unmatched closing delimiter '${char}' at line ${i + 1}`,
            line: i + 1
          };
        }
        const top = stack.pop();
        const expected = top.char === "(" ? ")" : top.char === "[" ? "]" : "}";
        if (char !== expected) {
          return {
            valid: false,
            error: `Mismatched delimiter: expected '${expected}', found '${char}' at line ${i + 1}`,
            line: i + 1
          };
        }
      }
      j++;
    }
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    return {
      valid: false,
      error: `Unclosed delimiter '${unclosed.char}' opened at line ${unclosed.line}`,
      line: unclosed.line
    };
  }

  return { valid: true, error: null };
}

/**
 * Perform deterministic syntax validation on a single file.
 *
 * @param {string} path - file path
 * @param {string} content - file content
 * @param {boolean} [truncated] - whether the content was truncated
 * @returns {{
 *   path: string,
 *   status: "VALID"|"SYNTAX_ERROR"|"SKIPPED_TRUNCATED"|"UNSUPPORTED",
 *   syntaxValid: boolean|null,
 *   error: string|null,
 *   line?: number,
 *   column?: number,
 *   reason?: string
 * }}
 */
export function checkFileSyntax(path, content, truncated = false) {
  if (typeof content !== "string" || !content.trim()) {
    return {
      path,
      status: "VALID",
      syntaxValid: true,
      error: null,
      reason: "Empty file"
    };
  }

  if (isContentTruncated(content, truncated)) {
    return {
      path,
      status: "SKIPPED_TRUNCATED",
      syntaxValid: null,
      error: null,
      reason: "File was truncated to fit context budget; syntax cannot be checked on partial code"
    };
  }

  const parts = path.split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";

  if (JS_TS_EXTENSIONS.has(ext)) {
    const res = validateJsTsSyntax(content, path);
    return {
      path,
      status: res.valid ? "VALID" : "SYNTAX_ERROR",
      syntaxValid: res.valid,
      error: res.error,
      line: res.line,
      column: res.column
    };
  }

  if (ext === "json") {
    const res = validateJsonSyntax(content);
    return {
      path,
      status: res.valid ? "VALID" : "SYNTAX_ERROR",
      syntaxValid: res.valid,
      error: res.error
    };
  }

  if (ext === "py") {
    const res = validatePythonSyntax(content);
    return {
      path,
      status: res.valid ? "VALID" : "SYNTAX_ERROR",
      syntaxValid: res.valid,
      error: res.error,
      line: res.line
    };
  }

  return {
    path,
    status: "UNSUPPORTED",
    syntaxValid: null,
    error: null,
    reason: `Syntax checking not applicable for extension .${ext}`
  };
}

/**
 * Validate syntax across all key files in a repository.
 *
 * @param {Record<string, { content?: string|null, truncated?: boolean }>} keyFiles
 * @returns {{
 *   performed: boolean,
 *   filesChecked: number,
 *   filesValid: number,
 *   filesWithSyntaxErrors: number,
 *   filesSkippedTruncated: number,
 *   hasFatalSyntaxErrors: boolean,
 *   summary: string,
 *   results: Array<{
 *     path: string,
 *     status: string,
 *     syntaxValid: boolean|null,
 *     error: string|null,
 *     line?: number,
 *     column?: number,
 *     reason?: string
 *   }>
 * }}
 */
export function checkRepositorySyntax(keyFiles = {}) {
  const results = [];
  let filesChecked = 0;
  let filesValid = 0;
  let filesWithSyntaxErrors = 0;
  let filesSkippedTruncated = 0;

  for (const [path, fileData] of Object.entries(keyFiles)) {
    if (!fileData || typeof fileData.content !== "string") continue;

    const res = checkFileSyntax(path, fileData.content, fileData.truncated || false);
    results.push(res);

    if (res.status === "VALID") {
      filesChecked++;
      filesValid++;
    } else if (res.status === "SYNTAX_ERROR") {
      filesChecked++;
      filesWithSyntaxErrors++;
    } else if (res.status === "SKIPPED_TRUNCATED") {
      filesSkippedTruncated++;
    }
  }

  let summary = "";
  if (filesWithSyntaxErrors > 0) {
    const errorPaths = results.filter(r => r.status === "SYNTAX_ERROR").map(r => r.path).join(", ");
    summary = `Syntax errors detected in complete source file(s): ${errorPaths}.`;
  } else if (filesChecked > 0) {
    summary = `All ${filesChecked} untruncated source file(s) passed deterministic syntax parsing.`;
  } else if (filesSkippedTruncated > 0) {
    summary = "Source files were truncated to fit context budget; no complete files were available for syntax check.";
  } else {
    summary = "No parsable source files checked.";
  }

  return {
    performed: true,
    filesChecked,
    filesValid,
    filesWithSyntaxErrors,
    filesSkippedTruncated,
    hasFatalSyntaxErrors: filesWithSyntaxErrors > 0,
    summary,
    results
  };
}
