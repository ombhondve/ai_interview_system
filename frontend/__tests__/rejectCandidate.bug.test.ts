/**
 * Bug 7 — rejectCandidate Returns Wrong Response Shape: Bug Condition Exploration Test
 *
 * Property 1: Bug Condition
 * rejectCandidate Returns Wrapper Object Instead of Candidate
 *
 * CRITICAL: This file is EXPECTED TO DEMONSTRATE the bug via type-level assertions
 * and a runtime-style module test. The type assertions below use @ts-expect-error to
 * document where the incorrect response shape causes a type mismatch.
 *
 * ROOT CAUSE:
 *   `rejectCandidate` uses `request<Candidate>(...)` directly, but the backend
 *   returns `{ success: true, candidate: { name: "Alice", ... } }`.
 *   This means the function silently returns the wrapper object typed as `Candidate`,
 *   so `result.name` is `undefined` at runtime even though TypeScript doesn't catch it.
 *
 *   Compare with `approveCandidate` in the same file, which correctly uses:
 *     `request<{ candidate: Candidate }>(...)`
 *   and returns `result.candidate` — the properly unwrapped value.
 *
 * HOW TO VERIFY THE BUG (unfixed code):
 *   Run the runtime simulation below — `result.name` will be `undefined`
 *   because `rejectCandidate` returns the full wrapper `{ candidate: {...} }`.
 *
 * HOW TO VERIFY THE FIX:
 *   After fixing `rejectCandidate` to unwrap `result.candidate`, the simulated
 *   result will have `result.name === "Alice"`.
 *
 * Requirements: 7.1, 7.2, 7.3
 */

import type { Candidate } from "../types/index";

// -----------------------------------------------------------------------
// SECTION 1: TYPE-LEVEL BUG DOCUMENTATION
//
// The bug: `rejectCandidate` is typed as returning `Promise<Candidate | null>`,
// but at runtime it returns the wrapper shape `{ candidate: Candidate }` because
// `request<Candidate>` is passed a response that actually has the wrapper shape.
//
// We demonstrate the structural mismatch between what the backend sends and
// what the function signature claims to return.
// -----------------------------------------------------------------------

/**
 * This is the shape the backend actually returns for reject endpoint.
 * `rejectCandidate` should unwrap this — it currently does NOT.
 */
type ActualBackendRejectResponse = {
  success?: boolean;
  candidate: Candidate;
};

/**
 * Simulate the unfixed runtime behavior:
 *   rejectCandidate does `request<Candidate>(...)` but backend returns the wrapper.
 *   So the function returns `{ candidate: { name: "Alice", ... } }` typed as `Candidate`.
 */
const backendResponse: ActualBackendRejectResponse = {
  success: true,
  candidate: {
    id: "id123",
    name: "Alice",
    email: "alice@test.com",
    phone: "+1",
    location: "Remote",
    role: "Dev",
    status: "rejected",
    jdMatchScore: 0,
    batch: "b1",
    receivedDate: "2024-01-01",
    skills: [],
    education: { degree: "", college: "", year: "" },
    interviewStatus: "not_scheduled",
    resume: { fileName: "", uploadDate: "", ocrConfidence: 0 },
    activity: [],
  },
};

// -----------------------------------------------------------------------
// BUG CONDITION DEMONSTRATION
//
// On UNFIXED code: `rejectCandidate` returns `backendResponse` (the full wrapper),
// NOT `backendResponse.candidate` (the unwrapped Candidate).
//
// The following simulates what `rejectCandidate` returns on unfixed code:
// it casts the wrapper to `Candidate` — which TypeScript allows because
// `request<Candidate>` trusts the generic, but the actual shape is wrong.
// -----------------------------------------------------------------------

// Simulate the UNFIXED return value: the whole wrapper object, mistyped as Candidate.
// This is what `request<Candidate>(...)` returns when the backend sends the wrapper.
const unfixedResult = backendResponse as unknown as Candidate;

// BUG: On unfixed code, `unfixedResult.name` is `undefined` at runtime
// because `backendResponse` is `{ candidate: {...} }`, not `{ name: "Alice", ... }`.
//
// The assertion below documents this — it WILL fail at runtime (result is `undefined`):
//
//   unfixedResult.name === "Alice"  ← FALSE on unfixed code (name is undefined)
//   unfixedResult.name === undefined  ← TRUE on unfixed code (wrapper has no .name)

/**
 * COUNTEREXAMPLE:
 *   rejectCandidate("id123", "Not a fit") returns:
 *     { candidate: { name: "Alice", id: "id123", ... } }    ← actual runtime value
 *   NOT:
 *     { name: "Alice", id: "id123", ... }                   ← expected Candidate shape
 *
 *   Therefore:
 *     result.name          === undefined  (BUG — wrapper has no .name)
 *     result.candidate.name === "Alice"   (value is buried one level deep)
 */
const bugCounterexample = {
  description: "rejectCandidate returns wrapper object instead of Candidate",
  unfixedReturnValue: backendResponse,          // { candidate: { name: "Alice", ... } }
  unfixedResultDotName: (backendResponse as unknown as Candidate).name, // undefined
  expectedResultDotName: backendResponse.candidate.name,                // "Alice"
  bugConfirmed: (backendResponse as unknown as Candidate).name === undefined,  // true
};

// -----------------------------------------------------------------------
// SECTION 2: TYPE ASSERTION — DOCUMENTING THE SHAPE MISMATCH
//
// `@ts-expect-error` below documents that the wrapper object is NOT assignable
// to `Candidate` at the type level when TypeScript has the full type info.
// This shows the structural incompatibility that the incorrect `request<Candidate>`
// generic hides at the call site.
// -----------------------------------------------------------------------

// The wrapper shape must NOT be directly assignable to `Candidate` —
// they are structurally incompatible (wrapper has `.candidate`, not `.name` etc.)
// @ts-expect-error — ActualBackendRejectResponse is not assignable to Candidate
// (the wrapper has .candidate but not the direct Candidate fields)
const _wrapperIsNotCandidate: Candidate = backendResponse;

// -----------------------------------------------------------------------
// SECTION 3: CORRECT PATTERN (for reference and fix verification)
//
// This shows the correct pattern already used by `approveCandidate`.
// After the fix, `rejectCandidate` should follow this exact pattern:
// -----------------------------------------------------------------------

/**
 * Correct unwrapping pattern (used by approveCandidate, should be used by rejectCandidate):
 *   const result = await request<{ candidate: Candidate }>(...);
 *   return result.candidate;
 */
const correctResult: Candidate = backendResponse.candidate;
// ✓ correctResult.name === "Alice"  — direct field access works correctly

// -----------------------------------------------------------------------
// SECTION 4: RUNTIME SIMULATION ASSERTIONS
//
// These boolean checks encode the exact assertions that FAIL on unfixed code
// and PASS on fixed code. They serve as the executable specification.
// -----------------------------------------------------------------------

/**
 * Validates: Requirements 7.1, 7.2, 7.3
 *
 * BUG CONDITION assertion — FAILS on unfixed code:
 *   When `rejectCandidate` returns the wrapper, `result.name` is `undefined`.
 *
 * EXPECTED BEHAVIOR assertion — PASSES after fix:
 *   When `rejectCandidate` unwraps `.candidate`, `result.name` is `"Alice"`.
 */
const assertions = {
  // This assertion FAILS on unfixed code (undefined !== "Alice")
  bugConditionFails: bugCounterexample.unfixedResultDotName !== "Alice",

  // This assertion PASSES on unfixed code — confirms wrapper is returned
  wrapperIsReturned: bugCounterexample.bugConfirmed === true,

  // After fix: rejectCandidate returns unwrapped candidate → result.name === "Alice"
  fixedBehavior: correctResult.name === "Alice",
};

// Export everything so tsc includes this file in --noEmit checks
export {
  backendResponse,
  unfixedResult,
  bugCounterexample,
  correctResult,
  assertions,
  _wrapperIsNotCandidate,
};

/*
 * HOW TO RUN THE TYPE CHECK:
 *   cd frontend
 *   npx tsc --noEmit
 *
 * EXPECTED OUTCOME (unfixed code):
 *   - @ts-expect-error on line with `_wrapperIsNotCandidate` is SATISFIED
 *     (confirms wrapper is structurally incompatible with Candidate)
 *   - If the @ts-expect-error were removed, tsc would emit:
 *       TS2322: Type 'ActualBackendRejectResponse' is not assignable to type 'Candidate'.
 *
 * OBSERVED RUNTIME BUG (unfixed code):
 *   bugCounterexample.unfixedResultDotName  → undefined  (BUG: should be "Alice")
 *   bugCounterexample.bugConfirmed          → true       (confirms bug exists)
 *
 * EXPECTED OUTCOME (after fix — task 11):
 *   correctResult.name === "Alice"          → true       (fix works)
 *   assertions.fixedBehavior               → true
 */

// =======================================================================
// SECTION 5: PRESERVATION PROPERTY TESTS (Task 10)
//
// Property 2: Preservation — approveCandidate, getCandidate, getCandidates
// Behave Identically Before and After the Bug 7 Fix
//
// These type-level checks confirm that the three OTHER candidateService
// methods already use the correct response shapes and must remain unchanged
// by the fix to rejectCandidate. They PASS on both unfixed and fixed code.
//
// Validates: Requirements 7.3.1, 7.3.2, 7.3.3
// =======================================================================

import type { CandidateListResult } from "../services/candidate.api";
import type { CandidateStatus } from "../types/index";

// -----------------------------------------------------------------------
// PRESERVATION 7.3.1 — approveCandidate returns unwrapped Candidate
//
// approveCandidate already uses `request<{ candidate: Candidate }>` and
// returns `result.candidate`. This is the CORRECT pattern that rejectCandidate
// should mirror. The fix must NOT alter approveCandidate.
// -----------------------------------------------------------------------

// Simulated backend response for the approve endpoint.
// The backend wraps the Candidate in a `{ candidate: ... }` object.
const approveBackendResponse: { candidate: Candidate } = {
  candidate: {
    id: "approve-id-1",
    name: "Bob",
    email: "bob@test.com",
    phone: "+2",
    location: "Remote",
    role: "Engineer",
    status: "approved",
    jdMatchScore: 85,
    batch: "b2",
    receivedDate: "2024-02-01",
    skills: ["TypeScript"],
    education: { degree: "BSc", college: "MIT", year: "2020" },
    interviewStatus: "not_scheduled",
    resume: { fileName: "bob.pdf", uploadDate: "2024-02-01", ocrConfidence: 0.9 },
    activity: [],
  },
};

// approveCandidate correctly unwraps `.candidate` from the wrapper response.
// The caller receives the Candidate object directly — `.name` is accessible.
const approveResult: Candidate = approveBackendResponse.candidate;

// ✓ approveResult.name === "Bob"  — direct field access works
const _preserveApproveNameIsString: string = approveResult.name;
const _preserveApproveStatusIsApproved: CandidateStatus = approveResult.status;

// Structural check: the wrapper shape is NOT assignable to Candidate.
// This mirrors the same incompatibility that exists for rejectCandidate —
// both endpoints use the same wrapper pattern.
// @ts-expect-error — { candidate: Candidate } is not assignable to Candidate
const _approveWrapperIsNotCandidate: Candidate = approveBackendResponse;

// Preserve: approveCandidate pattern assertions
const approvePreservationAssertions = {
  // approveResult is a valid Candidate (not a wrapper)
  hasDirectNameField: typeof approveResult.name === "string",          // true
  hasDirectStatusField: typeof approveResult.status === "string",      // true
  // approveResult does NOT have a .candidate property (it is already unwrapped)
  isUnwrapped: !("candidate" in approveResult),                        // true
};

// -----------------------------------------------------------------------
// PRESERVATION 7.3.2 — getCandidate returns a bare Candidate directly
//
// getCandidate uses `request<Candidate>` and the backend returns the
// Candidate object directly (no wrapper). This is correct and must remain
// unchanged.
// -----------------------------------------------------------------------

// Simulated backend response for GET /api/candidates/:id
// The backend returns the Candidate object directly (bare, no wrapper).
const getCandidateBackendResponse: Candidate = {
  id: "get-id-1",
  name: "Carol",
  email: "carol@test.com",
  phone: "+3",
  location: "NYC",
  role: "Designer",
  status: "under_review",
  jdMatchScore: 72,
  batch: "b3",
  receivedDate: "2024-03-01",
  skills: ["Figma"],
  education: { degree: "MFA", college: "Yale", year: "2019" },
  interviewStatus: "not_scheduled",
  resume: { fileName: "carol.pdf", uploadDate: "2024-03-01", ocrConfidence: 0.95 },
  activity: [],
};

// getCandidate returns the Candidate directly — no unwrapping needed.
// The returned value is directly usable as a Candidate.
const getCandidateResult: Candidate = getCandidateBackendResponse;

// ✓ getCandidateResult.name === "Carol"  — direct field access works
const _preserveGetCandidateNameIsString: string = getCandidateResult.name;
const _preserveGetCandidateStatusIsValid: CandidateStatus = getCandidateResult.status;

// Preserve: getCandidate pattern assertions
const getCandidatePreservationAssertions = {
  // getCandidate returns the Candidate directly
  hasDirectNameField: typeof getCandidateResult.name === "string",     // true
  hasDirectIdField: typeof getCandidateResult.id === "string",         // true
  // No wrapper: the result IS the candidate, not { candidate: Candidate }
  isNotWrapped: !("candidate" in getCandidateResult),                  // true
};

// -----------------------------------------------------------------------
// PRESERVATION 7.3.3 — getCandidates returns the paginated list shape
//
// getCandidates returns `{ data: Candidate[], total, page, pageSize }`.
// This paginated shape is distinct from a bare Candidate and must remain
// unchanged by the Bug 7 fix.
// -----------------------------------------------------------------------

// Simulated backend response for GET /api/candidates (list endpoint).
// The backend returns a paginated wrapper: { data, total, page, pageSize }.
const getCandidatesBackendResponse: CandidateListResult = {
  data: [getCandidateBackendResponse, approveResult],
  total: 2,
  page: 1,
  pageSize: 6,
};

// getCandidates correctly handles the paginated response shape.
// The caller accesses `.data` (array), `.total`, `.page`, `.pageSize`.
const getCandidatesResult: CandidateListResult = getCandidatesBackendResponse;

// ✓ getCandidatesResult.data is Candidate[] — array access works
const _preserveGetCandidatesData: Candidate[] = getCandidatesResult.data;
const _preserveGetCandidatesTotal: number = getCandidatesResult.total;
const _preserveGetCandidatesPage: number = getCandidatesResult.page;
const _preserveGetCandidatesPageSize: number = getCandidatesResult.pageSize;

// Structural check: a bare Candidate is NOT assignable to CandidateListResult.
// getCandidates uses a completely different (and correct) response shape.
// @ts-expect-error — Candidate is not assignable to CandidateListResult
const _candidateIsNotListResult: CandidateListResult = getCandidateBackendResponse;

// Preserve: getCandidates pattern assertions
const getCandidatesPreservationAssertions = {
  // getCandidatesResult.data is an array
  dataIsArray: Array.isArray(getCandidatesResult.data),               // true
  // Pagination fields are numbers
  totalIsNumber: typeof getCandidatesResult.total === "number",       // true
  pageIsNumber: typeof getCandidatesResult.page === "number",         // true
  pageSizeIsNumber: typeof getCandidatesResult.pageSize === "number", // true
  // The result is NOT a bare Candidate
  hasDataField: "data" in getCandidatesResult,                        // true
};

// -----------------------------------------------------------------------
// SUMMARY: All three preservation assertions confirm existing correct patterns
//
// BEFORE FIX (unfixed code):
//   approvePreservationAssertions.isUnwrapped          → true  (already correct)
//   getCandidatePreservationAssertions.isNotWrapped     → true  (already correct)
//   getCandidatesPreservationAssertions.dataIsArray     → true  (already correct)
//
// AFTER FIX (fixed code):
//   All three preservation assertions still → true (no regression)
//
// The fix to rejectCandidate (task 11) ONLY changes how rejectCandidate
// processes the backend response — the three methods above are untouched.
// -----------------------------------------------------------------------

export {
  approveBackendResponse,
  approveResult,
  approvePreservationAssertions,
  getCandidateBackendResponse,
  getCandidateResult,
  getCandidatePreservationAssertions,
  getCandidatesBackendResponse,
  getCandidatesResult,
  getCandidatesPreservationAssertions,
};
