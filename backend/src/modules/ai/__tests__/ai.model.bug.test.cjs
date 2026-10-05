/**
 * Bug 1 — Invalid Groq Model Fallback
 *
 * Task 13 — Bug Condition Exploration Test (Property 1)
 * Task 14 — Preservation Test (Property 2)
 *
 * STRATEGY: Static source analysis
 * We read ai.service.js as text and parse the MODEL constant declaration.
 * No module import is required, which avoids ESM/CJS boundary issues and
 * means the test can run without any environment setup.
 *
 * -----------------------------------------------------------------------
 * TASK 13 — BUG CONDITION TEST (Property 1)
 * -----------------------------------------------------------------------
 * The "BUG CONDITION" test asserts the fallback value is "llama3-70b-8192".
 *
 * On UNFIXED code: FAILS — fallback is "openai/gpt-oss-20b" → bug confirmed.
 *   Counterexample: MODEL constant reads `"openai/gpt-oss-20b"` when GROQ_MODEL unset.
 *
 * After fix (fallback changed): PASSES — fix confirmed.
 *
 * HOW TO RUN:
 *   cd backend
 *   npx jest --testPathPattern=ai.model.bug
 *
 * EXPECTED OUTCOME (unfixed code):
 *   "BUG CONDITION" test FAILS — fallback is "openai/gpt-oss-20b" → confirms bug.
 *   Preservation tests PASS — env override pattern is present.
 *
 * EXPECTED OUTCOME (after fix):
 *   "BUG CONDITION" test PASSES — fallback is "llama3-70b-8192" → fix confirmed.
 *   Preservation tests continue to PASS.
 *
 * Requirements: 1.1, 1.2, 1.3
 */

"use strict";

const fs = require("fs");
const path = require("path");

// Resolve the AI service source file path
const AI_SERVICE_FILE = path.resolve(
  __dirname,
  "../ai.service.js"
);

// -----------------------------------------------------------------------
// HELPER: extract the MODEL constant declaration from the source
// -----------------------------------------------------------------------

/**
 * Parses the MODEL resolution line from ai.service.js source text.
 *
 * Matches either the original module-level constant:
 *   const MODEL = process.env.GROQ_MODEL || "some-model-name";
 * or the current lazy initialisation inside getGroqClient():
 *   model = process.env.GROQ_MODEL || "some-model-name";
 *
 * Returns an object:
 *   {
 *     raw: the full matched line text,
 *     envVar: the environment variable name used (e.g. "GROQ_MODEL"),
 *     fallback: the fallback model string (e.g. "llama3-70b-8192")
 *   }
 *
 * Returns null if no MODEL resolution is found.
 */
function parseModelConstant(source) {
  // Matches: [const|let|var] model = process.env.SOME_VAR || "fallback-value";
  // Case-insensitive on `model` and tolerant of single quotes / no declaration
  // keyword (the lazy-init pattern assigns without `const`).
  const modelRegex =
    /\bmodel\s*=\s*process\.env\.(\w+)\s*\|\|\s*["'`]([^"'`]+)["'`]/i;

  const match = modelRegex.exec(source);
  if (!match) return null;

  return {
    raw: match[0],
    envVar: match[1],
    fallback: match[2],
  };
}

// -----------------------------------------------------------------------
// BUG CONDITION EXPLORATION TEST — Task 13 / Property 1
// Requirements: 1.1, 1.2
// -----------------------------------------------------------------------

describe("Bug 1 — Invalid Groq Model Fallback (Bug Condition Exploration)", () => {
  let source;
  let modelConstant;

  beforeAll(() => {
    source = fs.readFileSync(AI_SERVICE_FILE, "utf8");
    modelConstant = parseModelConstant(source);
  });

  /**
   * Sanity check: the MODEL constant must exist in the source.
   * If this fails the parser needs updating, not the service code.
   */
  test("SANITY: MODEL constant declaration is present in ai.service.js", () => {
    expect(modelConstant).not.toBeNull();

    console.log("Parsed MODEL declaration:", modelConstant && modelConstant.raw);
  });

  /**
   * BUG CONDITION TEST
   *
   * Validates: Requirements 1.1, 1.2
   *
   * On UNFIXED code: FAILS
   *   modelConstant.fallback === "openai/gpt-oss-20b"  →  assertion fails
   *   Counterexample: `MODEL === "openai/gpt-oss-20b"` when GROQ_MODEL is not set.
   *   This is not a valid Groq model ID and causes Groq API 400/404 errors.
   *
   * After fix: PASSES
   *   modelConstant.fallback === "llama3-70b-8192"  →  assertion passes
   */
  test("BUG CONDITION: MODEL fallback is 'llama3-70b-8192' (valid Groq model)", () => {
    // Document the current state before asserting
    console.log(
      `Current MODEL fallback: "${modelConstant && modelConstant.fallback}"`
    );

    if (modelConstant && modelConstant.fallback === "openai/gpt-oss-20b") {
      console.log(
        "COUNTEREXAMPLE: MODEL fallback is \"openai/gpt-oss-20b\" — this is NOT a valid Groq model."
      );
      console.log(
        "When GROQ_MODEL env var is unset, all Groq API calls will fail with a 400/404 error."
      );
    }

    // UNFIXED: "openai/gpt-oss-20b" !== "llama3-70b-8192" → FAILS (bug confirmed)
    // FIXED:   "llama3-70b-8192"   === "llama3-70b-8192"  → PASSES (fix confirmed)
    expect(modelConstant.fallback).toBe("llama3-70b-8192");
  });

  /**
   * SUPPLEMENTARY: confirm the known-bad fallback that caused the bug is gone.
   *
   * On unfixed code: FAILS (the bad fallback IS present — root cause documented).
   * On fixed code: PASSES (the bad fallback is gone — fix confirmed).
   *
   * Validates: Requirements 1.1
   */
  test("SUPPLEMENTARY (fixed): MODEL fallback is NOT the known-bad value 'openai/gpt-oss-20b'", () => {
    console.log(
      `MODEL fallback observed: "${modelConstant && modelConstant.fallback}"`
    );

    // On unfixed code this FAILS, documenting the counterexample.
    // On fixed code this PASSES — confirming the bad value was removed.
    expect(modelConstant.fallback).not.toBe("openai/gpt-oss-20b");
    expect(modelConstant.fallback).toBe("llama3-70b-8192");
  });
});

// -----------------------------------------------------------------------
// PRESERVATION PROPERTY TESTS — Task 14 / Property 2
// Requirements: 1.3.1, 1.3.2, 1.3.3
// -----------------------------------------------------------------------

describe("Bug 1 — Model Env Override Preservation (should always pass — no regressions)", () => {
  let source;
  let modelConstant;

  beforeAll(() => {
    source = fs.readFileSync(AI_SERVICE_FILE, "utf8");
    modelConstant = parseModelConstant(source);
  });

  /**
   * PRESERVATION: The MODEL constant MUST use process.env.GROQ_MODEL as its
   * primary source (the env variable takes precedence over the fallback).
   *
   * This tests the structural pattern `process.env.GROQ_MODEL || "<fallback>"`.
   * If this pattern is present, any set GROQ_MODEL value will always be used —
   * no matter what the fallback string is.
   *
   * Validates: Requirements 1.3.1
   */
  test("PRESERVATION: MODEL constant uses GROQ_MODEL env variable (env override takes precedence)", () => {
    expect(modelConstant).not.toBeNull();

    // The env variable referenced must be GROQ_MODEL
    expect(modelConstant.envVar).toBe("GROQ_MODEL");

    console.log(
      `PRESERVATION confirmed: MODEL = process.env.${modelConstant.envVar} || "${modelConstant.fallback}"`
    );
    console.log(
      "When GROQ_MODEL is set to any value (e.g. 'mixtral-8x7b-32768'), that value is used instead of the fallback."
    );
  });

  /**
   * PRESERVATION: The MODEL constant pattern uses `||` (logical OR / nullish coalescing
   * equivalent for falsy values) to fall back only when the env var is unset/empty.
   * This ensures the override semantics are correct: non-empty env value → use it;
   * unset/empty → use fallback.
   *
   * Validates: Requirements 1.3.1
   */
  test("PRESERVATION: MODEL constant is a logical-OR env fallback pattern (correct override semantics)", () => {
    // The raw declaration must contain both `process.env.` and `||`
    expect(modelConstant.raw).toMatch(/process\.env\.\w+\s*\|\|/);

    console.log(
      "PRESERVATION confirmed: env override pattern is intact — " +
        "any set GROQ_MODEL value will be preferred over the fallback."
    );
  });

  /**
   * PRESERVATION: The GROQ_API_KEY guard must still exist in the source.
   * This guard throws "GROQ_API_KEY is not configured" when the key is absent.
   *
   * Validates: Requirements 1.3.2
   */
  test("PRESERVATION: GROQ_API_KEY guard is present in ai.service.js", () => {
    // Check the source for the API key guard pattern used in service functions
    const hasApiKeyGuard = /GROQ_API_KEY is not configured/.test(source);

    expect(hasApiKeyGuard).toBe(true);

    console.log(
      "PRESERVATION confirmed: GROQ_API_KEY guard is intact — " +
        "missing API key still throws the expected error."
    );
  });

  /**
   * PRESERVATION: The Groq SDK is still instantiated and the MODEL constant
   * is passed to groq.chat.completions.create() calls.
   *
   * Validates: Requirements 1.3.3
   */
  test("PRESERVATION: MODEL value is used in groq.chat.completions.create calls", () => {
    // Source must pass the model into a groq SDK call. The refactor passes the
    // local `model` via object shorthand (`{ model, ... }`), but we also accept
    // the older explicit forms (`model: MODEL` / `model: model`).
    const hasModelUsage = /chat\.completions\.create\(\s*\{[^}]*\bmodel\b/.test(
      source
    );

    expect(hasModelUsage).toBe(true);

    console.log(
      "PRESERVATION confirmed: model value is passed to groq.chat.completions.create — " +
        "all AI calls use the resolved model value."
    );
  });
});
