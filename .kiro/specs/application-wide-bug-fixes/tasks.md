# Implementation Plan

---

## Bug 4 — CandidateStatus Missing Values

- [x] 1. Write bug condition exploration test (Bug 4)
  - **Property 1: Bug Condition** - CandidateStatus Rejects "Project Assigned" / "Project Completed"
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface TypeScript compile errors that demonstrate the type gap
  - **Scoped PBT Approach**: Scope the property to the two concrete failing values `"Project Assigned"` and `"Project Completed"`
  - Run `tsc --noEmit` (or a `ts-node` snippet) that assigns `const s: CandidateStatus = "Project Assigned"` and `const s2: CandidateStatus = "Project Completed"`
  - Assert both assignments produce zero TypeScript errors after the fix
  - Run on UNFIXED code: **EXPECTED OUTCOME** — TypeScript emits type errors (confirms the bug)
  - Document counterexamples: e.g. `Type '"Project Assigned"' is not assignable to type 'CandidateStatus'`
  - Mark task complete when test is written, run, and failures are documented
  - _Requirements: 4.1, 4.2_

- [x] 2. Write preservation property tests — existing CandidateStatus values (Bug 4)
  - **Property 2: Preservation** - All Original CandidateStatus Values Remain Valid
  - **IMPORTANT**: Follow observation-first methodology — observe behavior on UNFIXED code first
  - Observe: `tsc --noEmit` accepts all 7 existing values (`"received"`, `"under_review"`, `"approved"`, `"rejected"`, `"scheduled"`, `"completed"`, `"decided"`) without error on unfixed code
  - Write property-based test: for every value in the original union, a `CandidateStatus` assignment compiles cleanly
  - Run on UNFIXED code — **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 4.3.1, 4.3.2_

- [x] 3. Fix Bug 4 — Add "Project Assigned" and "Project Completed" to CandidateStatus

  - [x] 3.1 Implement the fix
    - Open `frontend/types/index.ts`
    - Add `"Project Assigned"` and `"Project Completed"` to the `CandidateStatus` union, placed between `"rejected"` and `"scheduled"` to maintain grouping clarity
    - _Bug_Condition: input.type == "FRONTEND_TYPE_CHECK" AND input.value IN ["Project Assigned", "Project Completed"]_
    - _Expected_Behavior: TypeScript compiles `const s: CandidateStatus = "Project Assigned"` without error_
    - _Preservation: All 7 original CandidateStatus values remain valid and type-safe_
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - CandidateStatus Accepts New Values
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - Run `tsc --noEmit` with `"Project Assigned"` and `"Project Completed"` assignments
    - **EXPECTED OUTCOME**: Test PASSES (confirms the type now includes both new values)
    - _Requirements: 4.1, 4.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Original Status Values Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation type-check for all 7 original values
    - **EXPECTED OUTCOME**: Tests PASS (no regressions in existing status types)

- [x] 4. Checkpoint — Bug 4 complete
  - Confirm all TypeScript checks pass, ask the user if questions arise

---

## Bug 5 — Duplicate PUT Route in project.route.js

- [x] 5. Write bug condition exploration test (Bug 5)
  - **Property 1: Bug Condition** - PUT /api/projects/:id Returns 200 Instead of 404
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the duplicate route exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Demonstrate that `PUT /api/projects/abc123` incorrectly resolves to the `updateProject` handler
  - **Scoped PBT Approach**: Scope the property to a concrete `PUT /api/projects/abc123` request
  - Send `PUT /api/projects/abc123` to the Express app (use `supertest` or equivalent)
  - Assert the response status is `404`
  - Run on UNFIXED code — **EXPECTED OUTCOME**: Test FAILS (receives a non-404 status, confirming the duplicate route)
  - Document counterexample: e.g. `PUT /api/projects/abc123` returns `200` via `updateProject`
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 5.2, 5.3_

- [x] 6. Write preservation property tests — other project routes unaffected (Bug 5)
  - **Property 2: Preservation** - All Other Project Routes Still Resolve Correctly
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `PATCH /api/projects/:id`, `GET /api/projects`, `GET /api/projects/:id`, `POST /api/projects`, `DELETE /api/projects/:id`, `PATCH /api/projects/:id/archive`, `POST /api/projects/:id/admin-pdf`, `GET /api/projects/:id/candidates` all resolve to their correct handlers on unfixed code
  - Write property-based test: for every existing project route verb+path, the handler remains the same after the fix
  - Run on UNFIXED code — **EXPECTED OUTCOME**: Tests PASS (confirms baseline route table to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 5.3.1–5.3.7_

- [x] 7. Fix Bug 5 — Remove duplicate router.put("/:id") from project.route.js

  - [x] 7.1 Implement the fix
    - Open `backend/src/modules/projects/project.route.js`
    - Remove the line `router.put("/:id", updateProject);`
    - Keep `router.patch("/:id", updateProject);` intact
    - _Bug_Condition: input.method == "PUT" AND input.path MATCHES "^/api/projects/[^/]+$"_
    - _Expected_Behavior: PUT /api/projects/:id returns 404 (route not registered)_
    - _Preservation: PATCH /api/projects/:id and all other project routes unchanged_
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 7.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - PUT /api/projects/:id Returns 404
    - **IMPORTANT**: Re-run the SAME test from task 5 — do NOT write a new test
    - Send `PUT /api/projects/abc123` — assert 404
    - **EXPECTED OUTCOME**: Test PASSES (confirms the duplicate route is gone)
    - _Requirements: 5.2, 5.3_

  - [x] 7.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Other Project Routes Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 6 — do NOT write new tests
    - Verify all remaining project routes still resolve correctly
    - **EXPECTED OUTCOME**: Tests PASS (no regressions)

- [x] 8. Checkpoint — Bug 5 complete
  - Confirm all project route tests pass, ask the user if questions arise

---

## Bug 7 — rejectCandidate Returns Wrong Response Shape

- [x] 9. Write bug condition exploration test (Bug 7)
  - **Property 1: Bug Condition** - rejectCandidate Returns Wrapper Object Instead of Candidate
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the unwrapping bug
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Show that `result.name` is `undefined` when it should be `"Alice"`
  - **Scoped PBT Approach**: Mock `request` to return `{ candidate: { name: "Alice", id: "id123" } }` and call `rejectCandidate("id123", "Not a fit")`
  - Assert `result.name === "Alice"` (direct field access on the returned value)
  - Run on UNFIXED code — **EXPECTED OUTCOME**: Test FAILS (`result.name` is `undefined` because the wrapper object is returned)
  - Document counterexample: `rejectCandidate` returns `{ candidate: { name: "Alice" } }` instead of `{ name: "Alice" }`
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 10. Write preservation property tests — other candidateService methods unaffected (Bug 7)
  - **Property 2: Preservation** - approveCandidate, getCandidate, getCandidates Behave Identically
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `approveCandidate` already correctly returns unwrapped `Candidate` via `result.candidate` on unfixed code
  - Observe: `getCandidate` returns a bare `Candidate` directly on unfixed code
  - Observe: `getCandidates` returns `{ data, total, page, pageSize }` on unfixed code
  - Write property-based test: for each of the three methods, the return shape is unchanged after the fix
  - Run on UNFIXED code — **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 7.3.1, 7.3.2, 7.3.3_

- [x] 11. Fix Bug 7 — Unwrap { candidate } from rejectCandidate response

  - [x] 11.1 Implement the fix
    - Open `frontend/services/candidate.api.ts`
    - In `rejectCandidate`, change the return type from `request<Candidate>(...)` to `request<{ candidate: Candidate }>(...)`
    - Capture the result in a const and return `result.candidate`
    - Follow the same pattern already used in `approveCandidate`
    - _Bug_Condition: input.type == "API_CALL" AND input.caller == "rejectCandidate"_
    - _Expected_Behavior: rejectCandidate returns the inner Candidate object with all fields directly accessible_
    - _Preservation: approveCandidate, getCandidate, getCandidates response handling unchanged_
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 11.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - rejectCandidate Returns Unwrapped Candidate
    - **IMPORTANT**: Re-run the SAME test from task 9 — do NOT write a new test
    - Assert `result.name === "Alice"` on the return value
    - **EXPECTED OUTCOME**: Test PASSES (confirms candidate is properly unwrapped)
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 11.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Other candidateService Methods Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 10 — do NOT write new tests
    - Run preservation tests for `approveCandidate`, `getCandidate`, `getCandidates`
    - **EXPECTED OUTCOME**: Tests PASS (no regressions)

- [x] 12. Checkpoint — Bug 7 complete
  - Confirm all candidate API tests pass, ask the user if questions arise

---

## Bug 1 — Invalid Groq Model Fallback

- [x] 13. Write bug condition exploration test (Bug 1)
  - **Property 1: Bug Condition** - AI Requests Fail When GROQ_MODEL Is Unset
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bad model name is used
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Confirm the MODEL constant reads `"openai/gpt-oss-20b"` when `GROQ_MODEL` env is unset
  - **Scoped PBT Approach**: Unset `process.env.GROQ_MODEL`, then read the `MODEL` constant from `ai.service.js` (or mock `groq.chat.completions.create` to capture the model argument)
  - Assert that the model used is `"llama3-70b-8192"`
  - Run on UNFIXED code — **EXPECTED OUTCOME**: Test FAILS (model is `"openai/gpt-oss-20b"`)
  - Document counterexample: `MODEL === "openai/gpt-oss-20b"` when `GROQ_MODEL` is not set
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2_

- [x] 14. Write preservation property tests — model env var and existing AI behavior (Bug 1)
  - **Property 2: Preservation** - GROQ_MODEL Env and Existing AI Calls Unaffected
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: when `GROQ_MODEL=mixtral-8x7b-32768` is set, the MODEL constant uses that value on unfixed code
  - Observe: when API key is missing, `"GROQ_API_KEY is not configured"` is thrown on unfixed code
  - Write property-based test: for any non-empty `GROQ_MODEL` env value, the model constant equals that value after the fix
  - Run on UNFIXED code — **EXPECTED OUTCOME**: Tests PASS (confirms baseline env-override behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 1.3.1, 1.3.2, 1.3.3_

- [x] 15. Fix Bug 1 — Change invalid model fallback to "llama3-70b-8192"

  - [x] 15.1 Implement the fix
    - Open `backend/src/modules/ai/ai.service.js`
    - On line 13, change the fallback from `"openai/gpt-oss-20b"` to `"llama3-70b-8192"`
    - ```js
      // Before
      const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
      // After
      const MODEL = process.env.GROQ_MODEL || "llama3-70b-8192";
      ```
    - _Bug_Condition: input.type == "AI_REQUEST" AND NOT env.GROQ_MODEL_SET_
    - _Expected_Behavior: Groq API call uses "llama3-70b-8192" and receives a valid response_
    - _Preservation: When GROQ_MODEL is set, that env value is still used; GROQ_API_KEY guard unchanged_
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 15.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - MODEL Constant Is "llama3-70b-8192" When GROQ_MODEL Unset
    - **IMPORTANT**: Re-run the SAME test from task 13 — do NOT write a new test
    - Assert the model argument passed to Groq SDK equals `"llama3-70b-8192"`
    - **EXPECTED OUTCOME**: Test PASSES (confirms fallback is now a valid Groq model)
    - _Requirements: 1.1, 1.2_

  - [x] 15.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Env Override and API Key Guard Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 14 — do NOT write new tests
    - Verify that `GROQ_MODEL` env override still takes precedence, and missing key error still throws
    - **EXPECTED OUTCOME**: Tests PASS (no regressions)

- [x] 16. Checkpoint — Bug 1 complete
  - Confirm AI model constant tests pass, ask the user if questions arise

---

## Bug 6 — AI Retry Logic Corrupts System Messages

- [ ] 17. Write bug condition exploration test (Bug 6)
  - **Property 1: Bug Condition** - Retry Appends Instruction to System Messages
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms system messages are being mutated
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Show that the system message content is changed by the retry `.map()` on unfixed code
  - **Scoped PBT Approach**: Use a fixed messages array `[{ role: "system", content: "SYSTEM_PROMPT" }, { role: "user", content: "USER_MSG" }]`, mock `generateAIResponse` to fail on the first call and succeed on the second, invoke `generateStructuredAI`, then capture the `retryMessages` argument passed to the second `generateAIResponse` call
  - Assert that `retryMessages[0].content === "SYSTEM_PROMPT"` (system message is unchanged)
  - Run on UNFIXED code — **EXPECTED OUTCOME**: Test FAILS (system message content contains the appended retry instruction)
  - Document counterexample: `retryMessages[0].content` contains `"RETRY INSTRUCTION"` appended to `"SYSTEM_PROMPT"`
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 6.1, 6.2_

- [~] 18. Write preservation property tests — retry still modifies user messages and first-attempt path (Bug 6)
  - **Property 2: Preservation** - User Messages Still Get Retry Instruction; First-Attempt Path Untouched
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: on unfixed code, user messages DO get the retry instruction appended (the broken guard still reaches them)
  - Observe: when `generateStructuredAI` succeeds on first attempt, no retry occurs and messages are untouched on unfixed code
  - Write property-based test: for any messages array with only `"user"` and `"assistant"` roles (no `"system"`), the retry behavior is the same before and after the fix
  - Generate random message arrays with roles from `["user", "assistant", "tool"]` and verify only `"user"` messages are modified
  - Run on UNFIXED code — **EXPECTED OUTCOME**: Tests PASS (user messages are modified; first-attempt path is unchanged)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 6.3.1, 6.3.2, 6.3.3_

- [ ] 19. Fix Bug 6 — Fix retry guard to skip system messages only

  - [~] 19.1 Implement the fix
    - Open `backend/src/modules/ai/ai.service.js`, inside `generateStructuredAI`
    - In the `retryMessages` `.map()` callback, change the guard:
      ```js
      // Before
      if (message.role !== "user" && message.role !== "system") return message;
      // After
      if (message.role !== "user") return message;
      ```
    - This ensures only messages with `role === "user"` receive the appended retry instruction; all other roles (system, assistant, tool) are returned unchanged
    - _Bug_Condition: input.type == "AI_RETRY" AND input.messages CONTAINS message WHERE message.role == "system"_
    - _Expected_Behavior: retryMessages system message content is identical to original; only user message gets retry instruction_
    - _Preservation: First-attempt path unaffected; retry still appends to user messages; both-fail error propagation unchanged_
    - _Requirements: 6.1, 6.2, 6.3_

  - [~] 19.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - System Messages Unchanged During Retry
    - **IMPORTANT**: Re-run the SAME test from task 17 — do NOT write a new test
    - Assert `retryMessages[0].content === "SYSTEM_PROMPT"` (system message intact)
    - Assert `retryMessages[1].content` contains the retry instruction (user message still modified)
    - **EXPECTED OUTCOME**: Test PASSES (confirms system messages are no longer corrupted)
    - _Requirements: 6.1, 6.2_

  - [~] 19.3 Verify preservation tests still pass
    - **Property 2: Preservation** - User Message Retry and First-Attempt Path Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 18 — do NOT write new tests
    - Run property tests with arrays of mixed non-system roles
    - **EXPECTED OUTCOME**: Tests PASS (no regressions in retry behavior)

- [~] 20. Checkpoint — Bug 6 complete
  - Confirm all retry logic tests pass, ask the user if questions arise

---

## Bug 2 — Interview Module Routes Never Registered

- [~] 21. Write bug condition exploration test (Bug 2)
  - **Property 1: Bug Condition** - Interview Endpoints Return 404
  - **CRITICAL**: This test MUST FAIL on unfixed code — 404 confirms routes are not mounted
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Show that all four interview endpoints return 404 on the unfixed app
  - **Scoped PBT Approach**: Scope to `GET /api/interviews` and `POST /api/interviews` as the two most representative cases
  - Send `GET /api/interviews` to the Express app (via `supertest` or equivalent) — assert response status `200`
  - Send `POST /api/interviews` with valid body — assert response status `201`
  - Run on UNFIXED code — **EXPECTED OUTCOME**: Both assertions FAIL (both return 404)
  - Document counterexample: `GET /api/interviews` → 404 `"API endpoint not found"`
  - Mark task complete when test is written, run, and failures are documented
  - _Requirements: 2.1, 2.3_

- [~] 22. Write preservation property tests — existing routes still respond after app.js changes (Bug 2)
  - **Property 2: Preservation** - All Existing Routes Remain Reachable After Route Mount Addition
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `GET /api/candidates`, `GET /api/projects`, `GET /api/student/me`, `POST /api/auth/login` all return non-404 on unfixed code
  - Write property-based test: for each existing route, the response status is the same before and after adding the interview route mount to `app.js`
  - Run on UNFIXED code — **EXPECTED OUTCOME**: Tests PASS (confirms existing routes are stable baseline)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 2.3.1, 2.3.2_

- [ ] 23. Fix Bug 2 — Implement interview controller, routes, and mount in app.js

  - [~] 23.1 Implement interview.controller.js
    - Open `backend/src/modules/interview/interview.controller.js`
    - Import the `Interview` Mongoose model from `./interview.model.js`
    - Implement `getInterviews`: call `Interview.find()`, return 200 with the array
    - Implement `getInterviewById`: call `Interview.findById(req.params.id)`, return 200 or 404 if null
    - Implement `createInterview`: validate `candidateId` and `slotId` are present, call `Interview.create(req.body)`, return 201
    - Implement `updateInterview`: call `Interview.findByIdAndUpdate(req.params.id, req.body, { new: true })`, return 200 or 404 if null
    - Export all four handlers as named exports
    - _Bug_Condition: input.type == "HTTP_REQUEST" AND input.path MATCHES "^/api/interviews"_
    - _Expected_Behavior: each handler returns the correct HTTP status and Interview document(s) from MongoDB_
    - _Preservation: No changes to existing controller files or middleware_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [~] 23.2 Create interview.routes.js
    - Create new file `backend/src/modules/interview/interview.routes.js`
    - Create an Express router
    - Register `GET /` → `getInterviews`
    - Register `GET /:id` → `getInterviewById`
    - Register `POST /` → `createInterview`
    - Register `PATCH /:id` → `updateInterview`
    - Export router as default
    - _Requirements: 2.5_

  - [~] 23.3 Mount interview routes in app.js
    - Open `backend/src/app.js`
    - Add import: `import interviewRoutes from "./modules/interview/interview.routes.js";`
    - Add mount after the `/api/candidates` block: `app.use("/api/interviews", interviewRoutes);`
    - Preserve the existing middleware order: CORS → logger → body parser → cookie parser → static → routes → 404 → error handler
    - _Requirements: 2.5_

  - [~] 23.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Interview Endpoints Are Reachable
    - **IMPORTANT**: Re-run the SAME test from task 21 — do NOT write a new test
    - Assert `GET /api/interviews` → 200, `POST /api/interviews` with valid body → 201
    - **EXPECTED OUTCOME**: Test PASSES (confirms routes are now mounted and controllers respond)
    - _Requirements: 2.1, 2.3_

  - [~] 23.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Routes Unaffected by New Mount
    - **IMPORTANT**: Re-run the SAME tests from task 22 — do NOT write new tests
    - Verify all pre-existing routes still respond correctly
    - **EXPECTED OUTCOME**: Tests PASS (no regressions in routing)

- [~] 24. Checkpoint — Bug 2 complete
  - Confirm all interview endpoint tests pass, ask the user if questions arise

---

## Bug 3 + Bug 8 — Slot/Scheduling Module Empty Files

- [~] 25. Write bug condition exploration test (Bug 3 + Bug 8)
  - **Property 1: Bug Condition** - Slot Endpoints Return 404 and Service Functions Are Not Callable
  - **CRITICAL**: This test MUST FAIL on unfixed code — confirms routes are missing and files are empty
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Demonstrate all four failure modes: 404 on `/api/slots`, 404 on `/api/student/slots`, 404 on `POST /api/student/book`, and `TypeError` on `getSlots()` import
  - **Scoped PBT Approach**: Cover all four concrete failing cases:
    1. Send `GET /api/slots` — assert 200
    2. Send `GET /api/student/slots` — assert 200
    3. Send `POST /api/student/book` with valid body — assert 200
    4. `import { getSlots } from "slot.service.js"` and call `getSlots()` — assert it returns an array without throwing
  - Run on UNFIXED code — **EXPECTED OUTCOME**: All four assertions FAIL (404s and TypeError)
  - Document counterexamples:
    - `GET /api/slots` → 404
    - `GET /api/student/slots` → 404
    - `POST /api/student/book` → 404
    - `getSlots()` → `TypeError: getSlots is not a function`
  - Mark task complete when test is written, run, and failures are documented
  - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 8.1, 8.2_

- [~] 26. Write preservation property tests — student invite/me routes and Slot schema unchanged (Bug 3 + 8)
  - **Property 2: Preservation** - Existing Student Routes and Slot Schema Validation Unaffected
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `GET /api/student/invite` and `GET /api/student/me` respond correctly on unfixed code
  - Observe: creating a Slot via Mongoose with an invalid `status` value (e.g. `"expired"`) throws a ValidationError on unfixed code
  - Observe: creating a Slot with a missing required field (`startTime`) throws a ValidationError on unfixed code
  - Write property-based test: for any slot creation attempt with `status` outside `["open", "booked", "cancelled"]`, Mongoose rejects with a ValidationError — both before and after the fix
  - Run on UNFIXED code — **EXPECTED OUTCOME**: Tests PASS (confirms baseline to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.3.1, 3.3.2, 8.3.1, 8.3.2_

- [ ] 27. Fix Bug 3 + Bug 8 — Implement scheduling module and mount all slot routes

  - [~] 27.1 Implement slot.service.js
    - Open `backend/src/modules/scheduling/slot.service.js`
    - Import the `Slot` Mongoose model from `./slot.model.js` (use `import` or `require` matching the existing module syntax in this file)
    - Implement `getSlots(filter)`: `Slot.find(filter || {})`
    - Implement `getSlotById(id)`: `Slot.findById(id)`
    - Implement `createSlot(data)`: `Slot.create(data)`
    - Implement `updateSlot(id, data)`: `Slot.findByIdAndUpdate(id, data, { new: true })`
    - Implement `deleteSlot(id)`: `Slot.findByIdAndDelete(id)`
    - Implement `getOpenSlots()`: `Slot.find({ status: "open" })`
    - Implement `bookSlot(slotId, candidateId)`: find the slot, throw if `status !== "open"`, then update to `{ status: "booked", bookedBy: candidateId }`
    - Export all 7 functions as named exports
    - _Bug_Condition: input.type == "MODULE_IMPORT" AND input.module == "slot.service"_
    - _Expected_Behavior: all exported functions are callable and interact with the Slot Mongoose model_
    - _Preservation: Slot schema validation rules (enum, required fields) are enforced by Mongoose and remain unchanged_
    - _Requirements: 8.1, 8.5, 3.3.2_

  - [~] 27.2 Implement slot.controller.js
    - Open `backend/src/modules/scheduling/slot.controller.js`
    - Import slot service functions
    - Implement `getSlotsController`: calls `getSlots()`, returns 200 with result
    - Implement `getSlotByIdController`: calls `getSlotById(req.params.id)`, returns 200 or 404 if null
    - Implement `createSlotController`: calls `createSlot(req.body)`, returns 201 with created slot
    - Implement `updateSlotController`: calls `updateSlot(req.params.id, req.body)`, returns 200 or 404 if null
    - Implement `deleteSlotController`: calls `deleteSlot(req.params.id)`, returns 200
    - Implement `bookSlotController`: calls `bookSlot(req.body.slotId, req.body.candidateId)`, returns 200 with booked slot
    - Export all 6 handlers as named exports
    - _Requirements: 8.2_

  - [~] 27.3 Create slot.routes.js
    - Create new file `backend/src/modules/scheduling/slot.routes.js`
    - Create an Express router
    - Register `GET /` → `getSlotsController`
    - Register `POST /` → `createSlotController`
    - Register `GET /:id` → `getSlotByIdController`
    - Register `PATCH /:id` → `updateSlotController`
    - Register `DELETE /:id` → `deleteSlotController`
    - Export router as default
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7_

  - [~] 27.4 Implement reschedule.service.js
    - Open `backend/src/modules/scheduling/reschedule.service.js`
    - Import `updateSlot` and `bookSlot` from `./slot.service.js`
    - Implement `rescheduleSlot(oldSlotId, newSlotId, candidateId)`:
      - Free old slot: call `updateSlot(oldSlotId, { status: "open", bookedBy: null })`
      - Book new slot: call `bookSlot(newSlotId, candidateId)`
      - Return the newly booked slot
    - Export `rescheduleSlot` as a named export
    - _Requirements: 8.3_

  - [~] 27.5 Implement calendar.service.js
    - Open `backend/src/modules/scheduling/calendar.service.js`
    - Implement `createCalendarEvent(slotData)`: `console.log("createCalendarEvent:", slotData); return null;`
    - Implement `deleteCalendarEvent(eventId)`: `console.log("deleteCalendarEvent:", eventId); return null;`
    - Export both as named exports
    - _Requirements: 8.4_

  - [~] 27.6 Add student slot routes to student.routes.js
    - Open `backend/src/modules/student/student.routes.js`
    - Import `getSlotsController` and `bookSlotController` from `../scheduling/slot.controller.js`
    - In `getSlotsController` route, use `getOpenSlots` semantics — forward to `getSlotsController` which calls `getSlots({ status: "open" })` (or add an `getOpenSlotsController` alias if needed)
    - Register `GET /slots` → `getSlotsController` (returns open slots for students)
    - Register `POST /book` → `bookSlotController`
    - Preserve existing routes (`GET /invite`, `GET /me`) unchanged
    - _Bug_Condition: input.type == "HTTP_REQUEST" AND input.path MATCHES "^/api/student/(slots|book)"_
    - _Expected_Behavior: student can list open slots and book a slot_
    - _Preservation: /api/student/invite and /api/student/me are unaffected_
    - _Requirements: 3.2, 3.3, 3.5, 3.6_

  - [~] 27.7 Mount slot routes in app.js
    - Open `backend/src/app.js`
    - Add import: `import slotRoutes from "./modules/scheduling/slot.routes.js";`
    - Add mount after the `/api/interviews` block: `app.use("/api/slots", slotRoutes);`
    - Preserve the existing middleware order
    - _Requirements: 3.7_

  - [~] 27.8 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Slot Endpoints Are Reachable and Service Functions Are Callable
    - **IMPORTANT**: Re-run the SAME test from task 25 — do NOT write a new test
    - Assert all four cases now pass:
      1. `GET /api/slots` → 200
      2. `GET /api/student/slots` → 200
      3. `POST /api/student/book` → 200
      4. `getSlots()` call → returns array without throwing
    - **EXPECTED OUTCOME**: Test PASSES (confirms all slot/scheduling functionality is wired up)
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 8.1, 8.2_

  - [~] 27.9 Verify preservation tests still pass
    - **Property 2: Preservation** - Student Routes and Slot Schema Validation Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 26 — do NOT write new tests
    - Verify `GET /api/student/invite` and `GET /api/student/me` still respond correctly
    - Verify Slot schema still rejects invalid `status` values and missing required fields
    - **EXPECTED OUTCOME**: Tests PASS (no regressions)

- [~] 28. Checkpoint — Bug 3 + Bug 8 complete
  - Ensure all tests pass across all 8 bugs, ask the user if questions arise
