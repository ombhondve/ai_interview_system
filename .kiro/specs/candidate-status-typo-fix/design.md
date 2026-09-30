# Candidate Status Typo Fix — Bugfix Design

## Overview

The `status` field enum in `candidate.model.js` contained the misspelled value `"Project Complited"` instead of `"Project Completed"`. Because Mongoose validates enum membership at write time, any code that writes or filters with the correctly-spelled string silently failed — values were rejected, filters returned no results, and the UI displayed the wrong label.

The fix is a single-line enum correction in `candidate.model.js`. A companion migration script is required to backfill existing MongoDB documents that were persisted under the misspelled value, because Mongoose does not automatically migrate stored strings when the enum definition changes.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — a candidate status value is the misspelled string `"Project Complited"`.
- **Property (P)**: The desired behavior once the fix is applied — `"Project Completed"` (correct spelling) is accepted, stored, matched, and displayed correctly.
- **Preservation**: All other valid enum values and their associated flows must remain completely unaffected by the change.
- **`Candidate.status`**: The `status` field in `candidate.model.js`, constrained by a Mongoose `enum` array.
- **`updateMany` migration**: A MongoDB operation that rewrites existing documents whose `status` equals `"Project Complited"` to `"Project Completed"`.

## Bug Details

### Bug Condition

The bug manifests whenever the application attempts to write the status `"Project Completed"` (correct spelling) to a `Candidate` document, or reads/filters on that value. Mongoose rejects writes not in the enum, and filters against a value that was never stored find nothing.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input — a candidate status string or a filter predicate involving candidate.status
  OUTPUT: boolean

  RETURN input.statusValue = "Project Complited"   // misspelled value stored/accepted
         OR input.expectedStatusValue = "Project Completed"  // correct value rejected or unmatched
END FUNCTION
```

### Examples

- **Write rejected**: Setting `candidate.status = "Project Completed"` triggers a Mongoose `ValidatorError` (or is silently dropped), leaving the status unchanged.
- **Filter miss**: `Candidate.find({ status: "Project Completed" })` returns an empty array even when documents with `"Project Complited"` exist.
- **UI label wrong**: A status dropdown populated from the enum displays `"Project Complited"`, confusing recruiters.
- **Edge case — other statuses unaffected**: Setting `candidate.status = "approved"` succeeds exactly as before; this fix does not touch those values.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Setting any of the other eight valid statuses (`"received"`, `"under_review"`, `"approved"`, `"rejected"`, `"Project Assigned"`, `"scheduled"`, `"completed"`, `"decided"`) must continue to work without error.
- Filtering candidates by any status other than `"Project Completed"` must continue to return correct results.
- The approval, rejection, and project-assignment flows (`approveCandidate`, `rejectCandidate`, `assignProjectToCandidate`) must continue to update status as before.

**Scope:**
All inputs that do NOT involve the string `"Project Complited"` or `"Project Completed"` are entirely unaffected by this fix. This includes:
- All other enum status values.
- All candidate fields other than `status`.
- All API routes unrelated to status transitions.

## Hypothesized Root Cause

1. **Typographical error in enum definition**: The string `"Project Complited"` was typed instead of `"Project Completed"` when the enum was first authored in `candidate.model.js`. No automated spell-check or string-literal lint rule caught it.

2. **No runtime enforcement of the correct spelling elsewhere**: Because the misspelled value was the only accepted form, application code that used the correct spelling was silently rejected or never matched. There was no test asserting the correct value was accepted.

3. **No database migration awareness**: Mongoose enum changes are schema-only; documents already written with the misspelled value remain in MongoDB unchanged and become invalid under the corrected schema.

## Correctness Properties

Property 1: Bug Condition — Correct Spelling Accepted and Persisted

_For any_ candidate document write or status transition where the intended value is `"Project Completed"`, the fixed model SHALL accept, validate, and persist the value `"Project Completed"` without a validation error, and subsequent queries filtering on `"Project Completed"` SHALL return those documents.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation — Other Enum Values Unchanged

_For any_ candidate document write or status transition involving a status value other than `"Project Completed"` or `"Project Complited"`, the fixed model SHALL produce exactly the same validation and persistence behavior as the original model, preserving all existing status flows.

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `backend/src/modules/candidate/candidate.model.js`

**Location**: `candidateSchema` → `status` field → `enum` array

**Specific Changes**:

1. **Correct the enum spelling**: Replace `"Project Complited"` with `"Project Completed"` in the `enum` array.
   - Before: `"Project Complited"`
   - After:  `"Project Completed"`
   - This is a single string replacement; no other logic changes.

2. **No logic changes required**: The controller, service, and route files do not reference the misspelled string, so no other JS file needs editing.

---

**File**: `backend/scripts/migrate.js` *(new or updated)*

**Specific Changes**:

3. **Add migration step**: Insert (or append) a `updateMany` call that rewrites existing MongoDB documents:
   ```js
   await Candidate.updateMany(
     { status: "Project Complited" },
     { $set: { status: "Project Completed" } }
   );
   ```
   This must run **after** the enum fix is deployed so Mongoose accepts the corrected value on subsequent operations.

4. **Idempotency**: The `updateMany` filter matches only documents still holding the old misspelled value; re-running the script after migration completes is safe (matches zero documents, performs no writes).

5. **No other migration steps needed**: The audit confirmed the misspelled string appears only in `candidate.model.js`; no seed files, other models, or service files hardcode the old value.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, confirm the bug exists on the unfixed model by writing tests that demonstrate the rejection/mismatch, then verify the fix eliminates those failures while leaving all other enum behavior intact.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug on unfixed code. Confirm the enum rejection and filter-miss root causes.

**Test Plan**: Create unit tests against the Mongoose model that attempt to save and query a candidate with `status: "Project Completed"`. Run them against the **original** (misspelled) model to observe the `ValidatorError` and empty result set.

**Test Cases**:
1. **Save with correct spelling**: Attempt `new Candidate({ ..., status: "Project Completed" }).save()` — will throw `ValidatorError` on unfixed code.
2. **Filter with correct spelling**: Attempt `Candidate.find({ status: "Project Completed" })` after inserting a document with `"Project Complited"` — will return `[]` on unfixed code.
3. **Display enum values**: Read the enum array from the schema and assert it contains `"Project Completed"` — will fail on unfixed code.

**Expected Counterexamples**:
- `ValidatorError: Path 'status' is invalid ("Project Completed")` when saving.
- Empty array from `find({ status: "Project Completed" })` despite matching documents existing.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed model produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := candidateModel_fixed.save(input)
  ASSERT expectedBehavior(result)       // no ValidatorError, value persisted
  
  queryResult := candidateModel_fixed.find({ status: "Project Completed" })
  ASSERT queryResult.length > 0         // filter now matches
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed model produces the same result as the original model.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT candidateModel_original.validate(input) = candidateModel_fixed.validate(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many random enum values from the remaining eight valid statuses automatically.
- It catches unexpected cross-contamination of the enum change.
- It provides strong guarantees across all non-buggy inputs.

**Test Plan**: For each of the eight unaffected statuses, assert that validation and persistence behavior is identical before and after the fix.

**Test Cases**:
1. **Other enum values accepted**: Iterate over `["received", "under_review", "approved", "rejected", "Project Assigned", "scheduled", "completed", "decided"]` and assert each saves without error.
2. **Approval flow preservation**: Call `approveCandidate` and assert the resulting status is `"approved"` (unchanged).
3. **Rejection flow preservation**: Call `rejectCandidate` and assert the resulting status is `"rejected"` (unchanged).
4. **Project assignment flow preservation**: Call `assignProjectToCandidate` and assert the status transitions remain consistent.

### Unit Tests

- Assert the `status` enum array in the schema contains `"Project Completed"` and does NOT contain `"Project Complited"`.
- Assert saving a candidate with `status: "Project Completed"` succeeds (no error thrown).
- Assert saving a candidate with `status: "Project Complited"` now fails validation.
- Assert `Candidate.find({ status: "Project Completed" })` returns documents correctly.

### Property-Based Tests

- Generate random selections from the eight unaffected enum values and assert each validates successfully against the fixed schema.
- Generate random candidate objects (excluding the `status` field entirely) and assert they receive the default `"received"` status unchanged.
- Assert that for every valid status other than `"Project Completed"`, the fixed model's validation result equals the original model's validation result.

### Integration Tests

- Run the migration script against a seeded test database containing documents with `status: "Project Complited"` and assert all are updated to `"Project Completed"`.
- Assert the migration script is idempotent: running it twice leaves the database in the same state as running it once.
- Test the full project-completion flow end-to-end: set status → save → query → assert correct value returned and displayed.
