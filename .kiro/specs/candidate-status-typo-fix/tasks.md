# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Correct Spelling Rejected by Unfixed Enum
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the enum rejects `"Project Completed"` and that filters return nothing against `"Project Complited"` documents
  - **Scoped PBT Approach**: The bug is deterministic — scope the property to the two concrete failing cases: (a) saving with `status: "Project Completed"` and (b) querying with `{ status: "Project Completed" }` after inserting a `"Project Complited"` document
  - Create a test file at `backend/src/modules/candidate/__tests__/candidate-status-enum.test.js`
  - Test 1 — Save rejected: `new Candidate({ name: "Test", phone: "+1000000001", status: "Project Completed" }).validate()` must throw `ValidatorError` on unfixed code
  - Test 2 — Filter miss: insert a document with `status: "Project Complited"`, then `Candidate.find({ status: "Project Completed" })` must return `[]` on unfixed code
  - Test 3 — Enum array check: read `candidateSchema.path("status").enumValues` and assert it does NOT contain `"Project Completed"` on unfixed code
  - Run test on UNFIXED code (revert the enum to `"Project Complited"` temporarily if the fix is already in place, or run against the original model)
  - **EXPECTED OUTCOME**: All three assertions FAIL (this is correct — it proves the bug exists)
  - Document counterexamples found, e.g. `"ValidatorError: Path 'status' is invalid (\"Project Completed\")"` and empty find result
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Other Enum Values Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: saving with each of the eight unaffected statuses (`"received"`, `"under_review"`, `"approved"`, `"rejected"`, `"Project Assigned"`, `"scheduled"`, `"completed"`, `"decided"`) passes validation on UNFIXED code
  - Observe: the default status is `"received"` when none is provided
  - Add preservation tests to `backend/src/modules/candidate/__tests__/candidate-status-enum.test.js`
  - Property-based test: iterate (or use a fast-check `oneof` sampler) over the eight unaffected enum values and assert `candidateSchema.path("status").enumValues` contains each one
  - Property-based test: for each unaffected status, assert `new Candidate({ name: "Test", phone: "+1000000002", status: <value> }).validateSync()` does NOT throw
  - Unit test: assert the schema default for `status` is `"received"`
  - Run tests on UNFIXED code (the enum is still `"Project Complited"`)
  - **EXPECTED OUTCOME**: All preservation tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3. Fix for candidate status typo (`"Project Complited"` → `"Project Completed"`)

  - [ ] 3.1 Verify and lock in the enum fix in `candidate.model.js`
    - Confirm `backend/src/modules/candidate/candidate.model.js` line in the `status` enum reads `"Project Completed"` (not `"Project Complited"`)
    - If not yet applied, replace the misspelled string now — this is a single-character change in the `enum` array
    - Add an inline comment on that line: `// corrected spelling — was "Project Complited"`
    - _Bug_Condition: isBugCondition(input) where input.statusValue = "Project Complited" (stored/accepted) or input.expectedStatusValue = "Project Completed" (rejected/unmatched)_
    - _Expected_Behavior: "Project Completed" is accepted and persisted without ValidatorError; Candidate.find({ status: "Project Completed" }) returns matching documents_
    - _Preservation: all eight other enum values ("received", "under_review", "approved", "rejected", "Project Assigned", "scheduled", "completed", "decided") remain valid and unaffected_
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.2 Write idempotent migration in `backend/scripts/migrate.js`
    - Open `backend/scripts/migrate.js` and add (or replace placeholder with) the following migration step:
      ```js
      // Backfill misspelled "Project Complited" → "Project Completed"
      const result = await Candidate.updateMany(
        { status: "Project Complited" },
        { $set: { status: "Project Completed" } }
      );
      console.log(`Migration: updated ${result.modifiedCount} candidate(s) from "Project Complited" to "Project Completed".`);
      ```
    - Ensure the script imports `Candidate` from the model and connects to MongoDB before running the update
    - Idempotency: the `updateMany` filter only matches documents still holding the old value; re-running after migration is safe (zero writes)
    - _Requirements: 2.1, 2.2_

  - [ ] 3.3 Audit and remove all remaining hardcoded `"Project Complited"` references
    - Search the entire codebase (JS, JSON, seed files, scripts) for the string `"Project Complited"` (case-sensitive)
    - For each occurrence found, replace with `"Project Completed"` or remove the reference if it is dead code
    - Confirm zero occurrences remain after the sweep
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Correct Spelling Accepted and Persisted
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior; when they pass, the bug is fixed
    - Run `backend/src/modules/candidate/__tests__/candidate-status-enum.test.js` (bug condition tests)
    - **EXPECTED OUTCOME**: All three bug condition tests PASS (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Other Enum Values Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run `backend/src/modules/candidate/__tests__/candidate-status-enum.test.js` (preservation tests)
    - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions in other status flows)
    - Confirm all tests still pass after the fix (no regressions)

- [ ] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite for the candidate module
  - Confirm zero occurrences of `"Project Complited"` remain in the codebase
  - Confirm `migrate.js` runs without error against a local or test database
  - Ensure all tests pass; ask the user if questions arise
