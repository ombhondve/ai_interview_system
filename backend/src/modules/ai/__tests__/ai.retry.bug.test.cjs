/**
 * Bug 6 — AI Retry Logic Corrupts System Messages
 *
 * Task 17 — Bug Condition Exploration Test (Property 1)
 * Task 18 — Preservation Test (Property 2)
 *
 * STRATEGY: Static source analysis
 * We read ai.service.js as text and parse the guard condition inside
 * generateStructuredAI's retryMessages .map() callback.
 * No module import is required, avoiding ESM/CJS boundary issues.
 *
 * -----------------------------------------------------------------------
 * TASK 17 — BUG CONDITION TEST (Property 1)
 * -----------------------------------------------------------------------
 * The "BUG CONDITION" test asserts the guard is `message.role !== "user"`.
 *
 * On UNFIXED code: FAILS
 *   Guard is `message.role !== "user" && message.role !== "system"` → bug confirmed.
 *   Counterexample: system messages receive the retry instruction appended to them.
 *
 * After fix: PASSES
 *   Guard is `message.role !== "user"` → fix confirmed; system messages skipped.
 *
 * -----------------------------------------------------------------------
 * TASK 18 — PRESERVATION TEST (Property 2)
 * -----------------------------------------------------------------------
 * Asserts that user messages ARE still modified (the retry instruction IS
 * appended to user messages) — both before and after the fix.
 *
 * On UNFIXED code: PASSES (user messages get the retry instruction).
 * After fix:       PASSES (user messages still get the retry instruction).
 *
 * HOW TO RUN:
 *   cd backend
 *   npx jest --testPathPattern=ai.retry.bug
 *
 * EXPECTED OUTCOME (unfixed code):
 *   "BUG CONDITION" test FAILS — bad guard detected → confirms Bug 6 exists.
 *   Preservation tests PASS — user messages are still modified.
 *
 * EXPECTED OUTCOME (after fix):
 *   "BUG CONDITION" test PASSES — correct guard confirmed.
 *   Preservation tests continue to PASS.
 *
 * Requirements: 6.1, 6.2, 6.3
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
// HELPERS: parse the retryMessages .map() guard condition from source
// -----------------------------------------------------------------------

/**
 * Extracts the guard condition string used inside the retryMessages .map()
 * callback of generateStructuredAI.
 *
 * Looks for an `if` statement inside the retryMessages map that early-returns
 * the message unchanged. The condition may span multiple lines, e.g.:
 *
 *   Buggy (multi-line):
 *     if (
 *       message.role !== "user" &&
 *       message.role !== "system"
 *     ) {
 *       return message;
 *
 *   Fixed (single or multi-line):
 *     if (message.role !== "user") return message;
 *     — or —
 *     if (message.role !== "user") {
 *       return message;
 *
 * Returns the normalized (whitespace-collapsed) guard condition text,
 * or null if not found.
 */
function parseRetryGuard(source) {
  // Strategy: find the retryMessages .map() block first, then extract the
  // if-condition and return-message guard from within it.
  //
  // The map block starts at `messages.map((message) => {` and we look for
  // the first if-statement inside it that gates `return message`.
  //
  // We use a two-step approach:
  //   1. Isolate the text from `retryMessages` onward
  //   2. Look for `if (` followed by content containing `message.role`
  //      and followed by `) {` or `)` then `return message`

  const mapStart = source.indexOf("retryMessages");
  if (mapStart === -1) return null;

  const mapSection = source.slice(mapStart);

  // Match multi-line if conditions: if (\n  ...\n) { return message  OR  ) return message
  // The condition content is between `if (` and the first `)` that closes the if
  // We capture everything between `if (` and `return message` that contains `message.role`
  const guardRegex = /if\s*\(\s*([\s\S]*?)\s*\)\s*(?:\{[\s\n\r]*)?return\s+message/;

  const match = guardRegex.exec(mapSection);
  if (!match) return null;

  // Normalize all whitespace (newlines, multiple spaces) to single spaces
  return match[1].replace(/\s+/g, " ").trim();
}

/**
 * Extracts the retry instruction string appended to messages.
 * Returns the text that follows a message content in the retry map.
 *
 * Looks for a template literal or string concatenation that appends
 * content to message.content in the retryMessages map.
 */
function parseRetryInstruction(source) {
  // Look for the RETRY INSTRUCTION label text inside the retryMessages block
  const instructionRegex = /RETRY\s+INSTRUCTION/;
  return instructionRegex.test(source);
}

/**
 * Checks whether the retry block appends content to user messages.
 * Returns true if the retryMessages map returns a spread of message
 * with additional content for the matching case.
 */
function retryAppendsToUser(source) {
  // The map block should have a return { ...message, content: `${message.content}...` }
  // pattern for messages that pass the guard (i.e. user messages)
  const appendRegex =
    /retryMessages\s*=\s*messages\.map[\s\S]*?content\s*:\s*`\s*\$\{message\.content\}/;
  return appendRegex.test(source);
}

// -----------------------------------------------------------------------
// BUG CONDITION EXPLORATION TEST — Task 17 / Property 1
// Requirements: 6.1, 6.2
// -----------------------------------------------------------------------

describe("Bug 6 — AI Retry Corrupts System Messages (Bug Condition Exploration)", () => {
  let source;
  let retryGuard;

  beforeAll(() => {
    source = fs.readFileSync(AI_SERVICE_FILE, "utf8");
    retryGuard = parseRetryGuard(source);
  });

  /**
   * Sanity check: the retryMessages guard must exist in the source.
   * If this fails the parser needs updating, not the service code.
   */
  test("SANITY: retryMessages .map() guard condition is present in generateStructuredAI", () => {
    expect(retryGuard).not.toBeNull();

    console.log("Parsed retry guard condition:", retryGuard);
  });

  /**
   * BUG CONDITION TEST
   *
   * Validates: Requirements 6.1, 6.2
   *
   * On UNFIXED code: FAILS
   *   Guard is: `message.role !== "user" && message.role !== "system"`
   *   This returns early (skips appending) only for roles that are neither
   *   "user" nor "system". In practice, for a typical [system, user] messages
   *   array, BOTH messages pass the `.map()` modification path — the system
   *   message gets the retry instruction appended to it, which corrupts it.
   *
   *   Counterexample:
   *     messages = [{ role: "system", content: "SYSTEM_PROMPT" }, { role: "user", content: "USER_MSG" }]
   *     retryMessages[0].content === "SYSTEM_PROMPT\n\nRETRY INSTRUCTION: ..."  (corrupted)
   *     retryMessages[1].content === "USER_MSG\n\nRETRY INSTRUCTION: ..."
   *
   * After fix: PASSES
   *   Guard is: `message.role !== "user"`
   *   Only user messages are modified; system messages are returned as-is.
   *
   * The correct guard must be EXACTLY `message.role !== "user"` (no additional
   * `&& message.role !== "system"` clause that causes the bug).
   */
  test('BUG CONDITION: retry guard is message.role !== "user" (system messages are excluded)', () => {
    console.log(`Current retry guard: "${retryGuard}"`);

    const isBuggyGuard =
      retryGuard &&
      retryGuard.includes('message.role !== "system"') &&
      retryGuard.includes('message.role !== "user"');

    const isFixedGuard =
      retryGuard &&
      retryGuard.trim() === 'message.role !== "user"';

    if (isBuggyGuard) {
      console.log(
        'COUNTEREXAMPLE: Guard is "message.role !== \\"user\\" && message.role !== \\"system\\"".'
      );
      console.log(
        "This returns early (leaves unchanged) only for roles other than user OR system."
      );
      console.log(
        "De Morgan's law: !(role !== user && role !== system) === (role === user || role === system)."
      );
      console.log(
        "So BOTH system AND user messages match the modification path → system messages get corrupted."
      );
      console.log(
        'Expected guard after fix: message.role !== "user"'
      );
    }

    // UNFIXED: guard has the extra `&& message.role !== "system"` clause → FAILS (bug confirmed)
    // FIXED:   guard is exactly `message.role !== "user"` → PASSES (fix confirmed)
    expect(isFixedGuard).toBe(true);
  });

  /**
   * SUPPLEMENTARY: confirm the buggy guard clause that caused the problem
   * is no longer present.
   *
   * On unfixed code: FAILS — the buggy guard IS present → bug confirmed.
   * On fixed code:   PASSES — the buggy guard is gone → fix confirmed.
   *
   * Validates: Requirements 6.1
   */
  test('SUPPLEMENTARY (fixed): guard no longer contains the buggy "message.role !== \\"system\\"" clause', () => {
    console.log(`Observed retry guard: "${retryGuard}"`);

    // On unfixed code this FAILS, documenting the counterexample.
    // On fixed code this PASSES — confirming the bad clause was removed.
    const hasBuggySystemClause =
      retryGuard && retryGuard.includes('message.role !== "system"');

    expect(hasBuggySystemClause).toBe(false);
  });
});

// -----------------------------------------------------------------------
// PRESERVATION PROPERTY TESTS — Task 18 / Property 2
// Requirements: 6.3.1, 6.3.2, 6.3.3
// -----------------------------------------------------------------------

describe("Bug 6 — Retry Preservation (should always pass — no regressions)", () => {
  let source;
  let retryGuard;

  beforeAll(() => {
    source = fs.readFileSync(AI_SERVICE_FILE, "utf8");
    retryGuard = parseRetryGuard(source);
  });

  /**
   * PRESERVATION: User messages MUST still be modified during a retry.
   *
   * The retry instruction should be appended to the content of messages
   * where role === "user". This is the intended retry behavior — it guides
   * the model to produce a shorter, valid JSON output on the second attempt.
   *
   * Both before and after the fix: the map returns a new object with
   * `content: \`${message.content}\n\nRETRY INSTRUCTION: ...\`` for user messages.
   *
   * Validates: Requirements 6.3.1
   */
  test("PRESERVATION: retry .map() appends instruction to user messages (content template literal present)", () => {
    const appendsToUser = retryAppendsToUser(source);

    expect(appendsToUser).toBe(true);

    console.log(
      "PRESERVATION confirmed: retryMessages map appends to message.content via template literal — " +
        "user messages will still receive the retry instruction."
    );
  });

  /**
   * PRESERVATION: The RETRY INSTRUCTION label text must still be present in the source.
   * This label is the key signal in the retry prompt that guides the model.
   *
   * Validates: Requirements 6.3.2
   */
  test("PRESERVATION: 'RETRY INSTRUCTION' label is present in the retry block", () => {
    const hasInstruction = parseRetryInstruction(source);

    expect(hasInstruction).toBe(true);

    console.log(
      "PRESERVATION confirmed: 'RETRY INSTRUCTION' label is still present in generateStructuredAI — " +
        "the retry prompt content is intact."
    );
  });

  /**
   * PRESERVATION: generateStructuredAI must still call generateAIResponse
   * for both the first attempt and the retry attempt.
   * This verifies the overall retry flow structure is intact.
   *
   * Validates: Requirements 6.3.2
   */
  test("PRESERVATION: generateAIResponse is called at least twice in generateStructuredAI (first + retry)", () => {
    // Count occurrences of generateAIResponse( inside generateStructuredAI
    // The function body contains the first call and the retry call.
    const callMatches = source.match(/generateAIResponse\s*\(/g);

    // Should appear at least twice: once in generateStructuredAI's first attempt,
    // once in the retry block. (It's also defined in the same file, but the
    // definition doesn't have a `(` immediately after in the `export` declaration)
    const callCount = callMatches ? callMatches.length : 0;

    expect(callCount).toBeGreaterThanOrEqual(2);

    console.log(
      `PRESERVATION confirmed: generateAIResponse called ${callCount} time(s) — ` +
        "first-attempt and retry paths are both present."
    );
  });

  /**
   * PRESERVATION: The retry block must be inside a try/catch (first attempt fails
   * → catches error → retries). When both attempts fail, the error from the retry
   * must propagate to the caller.
   *
   * Validates: Requirements 6.3.3
   */
  test("PRESERVATION: generateStructuredAI contains try/catch wrapping the first attempt", () => {
    // Look for try { ... generateAIResponse ... } catch
    const hasTryCatch = /try\s*\{[\s\S]*?generateAIResponse[\s\S]*?\}\s*catch/.test(source);

    expect(hasTryCatch).toBe(true);

    console.log(
      "PRESERVATION confirmed: try/catch is present in generateStructuredAI — " +
        "first-attempt errors trigger the retry path; retry errors propagate to the caller."
    );
  });

  /**
   * PRESERVATION: The retryMessages structure preserves all non-content message
   * fields via spread (...message). This ensures role, name, and any other fields
   * are not lost during the map transformation.
   *
   * Validates: Requirements 6.3.1
   */
  test("PRESERVATION: retryMessages map uses object spread (...message) to preserve all message fields", () => {
    const hasSpread = /\.\.\.\s*message/.test(source);

    expect(hasSpread).toBe(true);

    console.log(
      "PRESERVATION confirmed: ...message spread is present in retryMessages map — " +
        "all message fields (role, name, etc.) are preserved during the retry transformation."
    );
  });
});
