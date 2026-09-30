/**
 * Bug 4 — CandidateStatus Missing Values: Bug Condition Exploration Test
 *
 * Property 1: Bug Condition
 * CandidateStatus Rejects "Project Assigned" / "Project Completed"
 *
 * CRITICAL: This file is EXPECTED TO PRODUCE TypeScript compile errors on
 * unfixed code. The compile errors confirm the bug exists.
 *
 * HOW TO RUN:
 *   cd frontend
 *   npx tsc --noEmit
 *
 * EXPECTED OUTCOME (unfixed):
 *   Type '"Project Assigned"' is not assignable to type 'CandidateStatus'.
 *   Type '"Project Completed"' is not assignable to type 'CandidateStatus'.
 *
 * EXPECTED OUTCOME (after fix):
 *   Zero TypeScript errors — both assignments compile cleanly.
 *
 * Requirements: 4.1, 4.2
 */

import type { CandidateStatus } from "../types/index";

// -----------------------------------------------------------------------
// BUG CONDITION: These two assignments MUST compile without error once
// "Project Assigned" and "Project Completed" are added to CandidateStatus.
//
// On UNFIXED code, TypeScript emits:
//   TS2322: Type '"Project Assigned"' is not assignable to type 'CandidateStatus'.
//   TS2322: Type '"Project Completed"' is not assignable to type 'CandidateStatus'.
// -----------------------------------------------------------------------

const s: CandidateStatus = "Project Assigned";

const s2: CandidateStatus = "Project Completed";

// The following export prevents "unused variable" lint warnings and keeps
// this file importable so tsc includes it during --noEmit.
export { s, s2 };

// -----------------------------------------------------------------------
// PRESERVATION PROPERTY TESTS — Property 2
// Requirements: 4.3.1, 4.3.2
//
// All 7 original CandidateStatus values must remain valid TypeScript
// on both unfixed AND fixed code. None of these assignments should ever
// produce a compile error.
//
// Run: cd frontend && npx tsc --noEmit
//
// EXPECTED OUTCOME (unfixed code):  PASS — all 7 values already in the union
// EXPECTED OUTCOME (fixed code):    PASS — 7 values remain, no regressions
//
// If any of these assignments ever produce a TS2322 error it means the fix
// accidentally removed or renamed an existing member of the CandidateStatus
// union — a regression that must be corrected.
// -----------------------------------------------------------------------

/**Validates: Requirements 4.3.1, 4.3.2 */

// All 7 original union members assigned to explicit CandidateStatus variables.
// A compile error on any of these means a preservation regression.
const p1: CandidateStatus = "received";
const p2: CandidateStatus = "under_review";
const p3: CandidateStatus = "approved";
const p4: CandidateStatus = "rejected";
const p5: CandidateStatus = "scheduled";
const p6: CandidateStatus = "completed";
const p7: CandidateStatus = "decided";

// Array form — ensures the compiler checks each element individually and
// confirms the full set is still a subset of CandidateStatus.
const allOriginalValues: CandidateStatus[] = [
  "received",
  "under_review",
  "approved",
  "rejected",
  "scheduled",
  "completed",
  "decided",
];

// Export to prevent "unused variable" warnings and keep file included in tsc.
export { p1, p2, p3, p4, p5, p6, p7, allOriginalValues };
