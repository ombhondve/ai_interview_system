# Bugfix Requirements Document

## Introduction

The `status` field enum in the `Candidate` model contains a misspelled value: `"Project Complited"` instead of `"Project Completed"`. Because Mongoose enforces the enum at the database level, any code that sets or compares the status using the correctly-spelled string `"Project Completed"` silently fails — the value is never stored and filters never match. Frontend status badges and dropdowns that render the correctly-spelled label are also affected.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a candidate's status is set to `"Project Completed"` (correct spelling) THEN the system rejects the value because the enum only accepts `"Project Complited"` (misspelled), leaving the status unchanged or throwing a validation error.

1.2 WHEN application code or a frontend component filters or compares `candidate.status === "Project Completed"` THEN the system returns no match because the stored value is `"Project Complited"`, causing silent data mismatch.

1.3 WHEN a frontend dropdown or status badge renders the list of valid status values THEN the system displays the misspelled label `"Project Complited"` instead of the correct English spelling.

### Expected Behavior (Correct)

2.1 WHEN a candidate's status is set to `"Project Completed"` (correct spelling) THEN the system SHALL accept and persist the value without a validation error.

2.2 WHEN application code or a frontend component filters or compares `candidate.status === "Project Completed"` THEN the system SHALL return the matching candidates correctly.

2.3 WHEN a frontend dropdown or status badge renders the list of valid status values THEN the system SHALL display `"Project Completed"` with correct English spelling.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a candidate's status is set to any other valid enum value (`"received"`, `"under_review"`, `"approved"`, `"rejected"`, `"Project Assigned"`, `"scheduled"`, `"completed"`, `"decided"`) THEN the system SHALL CONTINUE TO accept and persist those values without error.

3.2 WHEN application code filters candidates by any status other than `"Project Completed"` THEN the system SHALL CONTINUE TO return correct results unaffected by this change.

3.3 WHEN the candidate approval, rejection, or project-assignment flows execute THEN the system SHALL CONTINUE TO update candidate status as before.
