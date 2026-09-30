# Application-Wide Bug Fixes — Bugfix Design

## Overview

This document formalizes the design for fixing 8 confirmed bugs across the AI Interview System. The bugs collectively cause: complete failure of all AI features (invalid Groq model), 404 errors on every interview and slot API endpoint (missing routes), a scheduling module that cannot start due to empty implementation files, TypeScript compile errors in the frontend status type, a corrupted AI retry prompt, an ambiguous duplicate route, and a silently broken candidate rejection response in the frontend.

The fix strategy is targeted and minimal: each change is scoped to the precise line(s) or file(s) identified per bug, with no alteration to unrelated logic. The bug condition methodology (C(X) / P(result) / ¬C(X)) is applied across all 8 bugs in a single compound design, since they share the same codebase and test harness.

---

## Glossary

- **Bug_Condition (C)**: The input state or code path that causes a bug to manifest.
- **Property (P)**: The correct observable behavior the system must exhibit when C(X) holds after the fix.
- **Preservation (¬C)**: All inputs and code paths that do NOT trigger any of the 8 bugs — these must be completely unaffected.
- **Groq SDK**: The `groq-sdk` npm package used by `ai.service.js` to call the Groq LLM API.
- **MODEL constant**: The variable in `ai.service.js` (line 13) that determines the default Groq model name.
- **generateStructuredAI**: The retry-capable AI wrapper in `ai.service.js` that parses structured JSON from Groq.
- **retryMessages**: The message array constructed during a retry in `generateStructuredAI` — the site of Bug 6.
- **Interview model**: Mongoose model in `interview.model.js` with fields: `candidateId`, `slotId`, `meetLink`, `recordingUrl`, `transcriptUrl`, `status`, `integrityFlags`, `language`.
- **Slot model**: Mongoose model in `slot.model.js` with fields: `startTime`, `endTime`, `status` (`open`/`booked`/`cancelled`), `bookedBy`, `timezone`.
- **CandidateStatus**: TypeScript union type in `frontend/types/index.ts` used throughout the frontend to type candidate status values.
- **request\<T\>**: Generic HTTP client helper in `frontend/lib/client.ts` that parses the response body as `T`.

---

## Bug Details

### Bug Condition (Composite)

These 8 bugs have independent triggering conditions. Together they form a compound bug condition:

**Formal Specification:**

```
FUNCTION isBugCondition(input)
  INPUT: input describing a system event or code path
  OUTPUT: boolean

  RETURN (
    -- Bug 1: AI model fallback path
    (input.type == "AI_REQUEST" AND NOT env.GROQ_MODEL_SET)

    OR

    -- Bug 2: Interview HTTP request
    (input.type == "HTTP_REQUEST" AND input.path MATCHES "^/api/interviews")

    OR

    -- Bug 3 + 8: Slot HTTP request or scheduling module import
    (input.type == "HTTP_REQUEST" AND input.path MATCHES "^/api/slots")
    OR (input.type == "HTTP_REQUEST" AND input.path MATCHES "^/api/student/(slots|book)")
    OR (input.type == "MODULE_IMPORT" AND input.module IN [
          "slot.service", "slot.controller",
          "reschedule.service", "calendar.service"
        ])

    OR

    -- Bug 4: Frontend receives candidate with new status value
    (input.type == "FRONTEND_TYPE_CHECK"
      AND input.value IN ["Project Assigned", "Project Completed"])

    OR

    -- Bug 5: PUT request on projects
    (input.type == "HTTP_REQUEST" AND input.method == "PUT"
      AND input.path MATCHES "^/api/projects/[^/]+$")

    OR

    -- Bug 6: AI retry with system message
    (input.type == "AI_RETRY"
      AND input.messages CONTAINS message WHERE message.role == "system")

    OR

    -- Bug 7: rejectCandidate call on frontend
    (input.type == "API_CALL" AND input.caller == "rejectCandidate")
  )
END FUNCTION
```

### Examples

**Bug 1:**
- Input: `generateAIResponse(messages)` with `GROQ_MODEL` unset
- Current (defective): Groq API call uses `"openai/gpt-oss-20b"` → 400/404 from Groq
- Expected (correct): Groq API call uses `"llama3-70b-8192"` → valid response

**Bug 2:**
- Input: `GET /api/interviews`
- Current (defective): Returns `404 API endpoint not found`
- Expected (correct): Returns `200` with list of interviews from MongoDB

**Bug 3 + 8:**
- Input: `GET /api/slots` or `POST /api/student/book`
- Current (defective): Returns `404`; importing `slot.service.js` exports nothing
- Expected (correct): Returns slot data; all service functions are callable

**Bug 4:**
- Input: TypeScript compiler checks `candidate.status === "Project Assigned"`
- Current (defective): TS error — `"Project Assigned"` is not in `CandidateStatus`
- Expected (correct): Compiles cleanly; badge renders the label

**Bug 5:**
- Input: `PUT /api/projects/abc123`
- Current (defective): Routes to `updateProject` (partial-update semantics via PUT)
- Expected (correct): Returns `404 API endpoint not found`

**Bug 6:**
- Input: First AI attempt fails; `retryMessages` is constructed from `[{ role: "system", ... }, { role: "user", ... }]`
- Current (defective): Retry instruction appended to both the `system` and `user` messages
- Expected (correct): Retry instruction appended only to the `user` message

**Bug 7:**
- Input: `rejectCandidate("id123", "Not a fit")` → backend returns `{ success: true, candidate: { name: "Alice", ... } }`
- Current (defective): Function returns the wrapper `{ success: true, candidate: {...} }` typed as `Candidate`
- Expected (correct): Function returns `{ name: "Alice", ... }` — the unwrapped `Candidate` object

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All existing routes (`/api/candidates`, `/api/projects`, `/api/ai`, `/api/student/invite`, `/api/student/me`, `/api/auth`, `/api/verification`, `/api/whatsapp`) must continue to respond correctly after route and middleware additions.
- All existing middleware order in `app.js` (CORS → request logger → body parser → cookie parser → static uploads → routes → 404 → error handler) must be preserved.
- `generateStructuredAI` must continue to succeed on first attempt without modification when Groq returns valid JSON.
- `generateStructuredAI` retry must continue to call `generateAIResponse` and parse via `extractJson`; only the system-message exclusion changes.
- When `GROQ_MODEL` is set in the environment, all AI calls must continue to use that value.
- When Groq API key is missing, the existing `"GROQ_API_KEY is not configured"` error must still be thrown.
- `approveCandidate` in `candidate.api.ts` already correctly unwraps `result.candidate` — this must remain unchanged.
- `getCandidate` and `getCandidates` response handling must remain unchanged.
- All 7 existing project routes (GET /, GET /:id, POST /, POST /generate, POST /:id/regenerate, GET /:id/candidates, PATCH /:id/archive, POST /:id/admin-pdf, DELETE /:id) must continue to work.
- The Slot Mongoose schema validation (enum constraint on `status`, required fields) must remain enforced.
- All 7 existing `CandidateStatus` values (`received`, `under_review`, `approved`, `rejected`, `scheduled`, `completed`, `decided`) must remain valid and render correctly.

**Scope:**
All inputs that do NOT match any of the 8 bug conditions described above must be completely unaffected by these fixes.

---

## Hypothesized Root Cause

**Bug 1 — Invalid model fallback:**
The hardcoded string `"openai/gpt-oss-20b"` on line 13 of `ai.service.js` is simply the wrong model identifier. It appears to be a stale placeholder referencing an OpenAI model name format rather than a valid Groq model. Groq serves models like `llama3-70b-8192`, `llama3-8b-8192`, `mixtral-8x7b-32768`, etc.

**Bug 2 — Interview routes never registered:**
The `interview.controller.js` was never implemented (file is empty), so `interview.routes.js` was never created, so the routes were never mounted in `app.js`. The module directory contains model and service files but the HTTP layer was left incomplete.

**Bug 3 + 8 — Slot module empty:**
The scheduling module was scaffolded (directory, model file, and empty service/controller files exist) but implementation was never written. Because the files exist but export nothing, any code importing them gets `undefined` instead of functions, causing runtime `"is not a function"` errors. No routes were ever mounted in `app.js` or the student router.

**Bug 4 — CandidateStatus type mismatch:**
The backend `candidate.model.js` Mongoose enum includes `"Project Assigned"` and `"Project Completed"` but these two values were omitted when the `CandidateStatus` TypeScript union type was defined in `frontend/types/index.ts`. The frontend type was never updated to stay in sync with the backend enum.

**Bug 5 — Duplicate route registration:**
Both `router.patch("/:id", updateProject)` and `router.put("/:id", updateProject)` point to the same handler. Express registers both without error, creating an ambiguous contract. The `PUT` variant was likely added by mistake during development when REST semantics were unclear.

**Bug 6 — Retry corrupts system prompt:**
The guard condition `if (message.role !== "user" && message.role !== "system") return message` returns early (leaves unchanged) only for messages that are neither user nor system — which in practice means no messages are ever left unchanged. The correct intent is to only modify user messages, so the guard should be `if (message.role !== "user") return message`.

**Bug 7 — Wrong response shape typed:**
The `rejectCandidate` function was written using `request<Candidate>(...)` assuming the backend returns a bare `Candidate` directly, but the actual backend response is `{ success: true, candidate: {...} }`. The `approveCandidate` function in the same file already correctly uses `request<{ candidate: Candidate }>` and unwraps `.candidate` — `rejectCandidate` should follow the same pattern.

---

## Correctness Properties

Property 1: Bug Condition — AI Requests Use Valid Groq Model

_For any_ AI request where `GROQ_MODEL` is not set in the environment, the fixed `ai.service.js` SHALL use `"llama3-70b-8192"` as the model ID, resulting in a successful Groq API call instead of a 400/404 error.

**Validates: Requirements 2.1, 2.2, 2.3**

---

Property 2: Bug Condition — Interview Endpoints Are Reachable

_For any_ HTTP request to `/api/interviews` (GET list, GET by ID, POST create, PATCH update), the fixed system SHALL route the request to the correct handler and return the appropriate HTTP status code and response body from the Interview Mongoose model.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

---

Property 3: Bug Condition — Slot Endpoints Are Reachable and Service Functions Are Callable

_For any_ HTTP request to `/api/slots` or `/api/student/slots` or `/api/student/book`, the fixed system SHALL route to a real handler and return a valid response. _For any_ programmatic call to `slot.service.js`, `reschedule.service.js`, or `calendar.service.js` exported functions, the system SHALL invoke those functions without throwing `"is not a function"`.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 8.1, 8.2, 8.3, 8.4, 8.5**

---

Property 4: Bug Condition — CandidateStatus Accepts New Status Values

_For any_ TypeScript expression that assigns or compares a value of `"Project Assigned"` or `"Project Completed"` to the `CandidateStatus` type, the fixed type definition SHALL compile without type errors and status badge components SHALL render correctly.

**Validates: Requirements 4.1, 4.2, 4.3**

---

Property 5: Bug Condition — PUT /api/projects/:id Returns 404

_For any_ HTTP `PUT` request to `/api/projects/:id`, the fixed routing SHALL return `404 API endpoint not found` because the duplicate `router.put("/:id", updateProject)` registration has been removed.

**Validates: Requirements 5.1, 5.2, 5.3**

---

Property 6: Bug Condition — AI Retry Does Not Modify System Messages

_For any_ invocation of `generateStructuredAI` that triggers a retry, the fixed retry logic SHALL append the compact retry instruction only to messages where `role === "user"`, leaving all messages where `role === "system"` unmodified.

**Validates: Requirements 6.1, 6.2, 6.3**

---

Property 7: Bug Condition — rejectCandidate Returns Unwrapped Candidate

_For any_ call to `rejectCandidate(id, reason)` where the backend returns `{ success: true, candidate: {...} }`, the fixed function SHALL return the inner `candidate` object typed as `Candidate`, with all fields directly accessible to the caller.

**Validates: Requirements 7.1, 7.2, 7.3**

---

Property 8: Preservation — All Non-Buggy Inputs Behave Identically to Before

_For any_ input where none of the 8 bug conditions hold (existing routes, env-set model, first-attempt AI success, non-PUT project requests, existing candidate statuses, approveCandidate calls, getCandidate calls), the fixed system SHALL produce exactly the same result as the original system across all affected files.

**Validates: Requirements 1.3.1–3.3, 2.3.1–3.2, 3.3.1–3.2, 4.3.1–3.2, 5.3.1–3.7, 6.3.1–3.3, 7.3.1–3.3, 8.3.1–3.3**

---

## Fix Implementation

### Bug 1 — Invalid Groq Model Name

**File:** `backend/src/modules/ai/ai.service.js`

**Specific Changes:**
1. **Line 13 — MODEL constant**: Change `"openai/gpt-oss-20b"` to `"llama3-70b-8192"`.
   ```js
   // Before
   const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
   // After
   const MODEL = process.env.GROQ_MODEL || "llama3-70b-8192";
   ```

---

### Bug 2 — Interview Module Routes Never Registered

**File 1:** `backend/src/modules/interview/interview.controller.js`

**Specific Changes:**
1. **Implement `getInterviews`**: Query `Interview.find()`, return 200 with array.
2. **Implement `getInterviewById`**: Query `Interview.findById(id)`, return 200 or 404.
3. **Implement `createInterview`**: Validate required fields (`candidateId`, `slotId`), call `Interview.create(body)`, return 201.
4. **Implement `updateInterview`**: Call `Interview.findByIdAndUpdate(id, body, { new: true })`, return 200 or 404.
5. **Export all four handlers** as named exports.

**File 2:** `backend/src/modules/interview/interview.routes.js` *(new file)*

**Specific Changes:**
1. Create Express router.
2. Register `GET /` → `getInterviews`.
3. Register `GET /:id` → `getInterviewById`.
4. Register `POST /` → `createInterview`.
5. Register `PATCH /:id` → `updateInterview`.
6. Export router as default.

**File 3:** `backend/src/app.js`

**Specific Changes:**
1. Add import: `import interviewRoutes from "./modules/interview/interview.routes.js";`
2. Add mount: `app.use("/api/interviews", interviewRoutes);` — placed after the existing `/api/candidates` mount and before the 404 handler.

---

### Bug 3 + Bug 8 — Slot/Scheduling Module Empty Files

**File 1:** `backend/src/modules/scheduling/slot.service.js`

**Specific Changes:**
1. **Implement `getSlots(filter)`**: `Slot.find(filter || {})`.
2. **Implement `getSlotById(id)`**: `Slot.findById(id)`.
3. **Implement `createSlot(data)`**: `Slot.create(data)`.
4. **Implement `updateSlot(id, data)`**: `Slot.findByIdAndUpdate(id, data, { new: true })`.
5. **Implement `deleteSlot(id)`**: `Slot.findByIdAndDelete(id)`.
6. **Implement `getOpenSlots()`**: `Slot.find({ status: "open" })`.
7. **Implement `bookSlot(slotId, candidateId)`**: Find slot, assert `status === "open"`, update to `{ status: "booked", bookedBy: candidateId }`.
8. Export all functions as named exports.

**File 2:** `backend/src/modules/scheduling/slot.controller.js`

**Specific Changes:**
1. **Implement `getSlotsController`**: Calls `getSlots()`, returns 200.
2. **Implement `getSlotByIdController`**: Calls `getSlotById(id)`, returns 200 or 404.
3. **Implement `createSlotController`**: Calls `createSlot(body)`, returns 201.
4. **Implement `updateSlotController`**: Calls `updateSlot(id, body)`, returns 200 or 404.
5. **Implement `deleteSlotController`**: Calls `deleteSlot(id)`, returns 200.
6. **Implement `bookSlotController`**: Calls `bookSlot(slotId, candidateId)`, returns 200.
7. Export all functions as named exports.

**File 3:** `backend/src/modules/scheduling/slot.routes.js` *(new file)*

**Specific Changes:**
1. Register `GET /` → `getSlotsController`.
2. Register `POST /` → `createSlotController`.
3. Register `PATCH /:id` → `updateSlotController`.
4. Register `DELETE /:id` → `deleteSlotController`.

**File 4:** `backend/src/modules/scheduling/reschedule.service.js`

**Specific Changes:**
1. **Implement `rescheduleSlot(oldSlotId, newSlotId, candidateId)`**: Functional stub — frees old slot (`status: "open"`, clears `bookedBy`), books new slot via `bookSlot(newSlotId, candidateId)`.
2. Export as named export.

**File 5:** `backend/src/modules/scheduling/calendar.service.js`

**Specific Changes:**
1. **Implement `createCalendarEvent(slotData)`**: Log-only stub — `console.log("createCalendarEvent:", slotData)`, return `null`.
2. **Implement `deleteCalendarEvent(eventId)`**: Log-only stub — `console.log("deleteCalendarEvent:", eventId)`, return `null`.
3. Export both as named exports.

**File 6:** `backend/src/modules/student/student.routes.js`

**Specific Changes:**
1. Import `getSlotsController` and `bookSlotController` from the slot controller.
2. Register `GET /slots` → `getSlotsController` (returns open slots for students).
3. Register `POST /book` → `bookSlotController`.

**File 7:** `backend/src/app.js`

**Specific Changes:**
1. Add import: `import slotRoutes from "./modules/scheduling/slot.routes.js";`
2. Add mount: `app.use("/api/slots", slotRoutes);`

---

### Bug 4 — CandidateStatus Missing Values

**File:** `frontend/types/index.ts`

**Specific Changes:**
1. Add `"Project Assigned"` and `"Project Completed"` to the `CandidateStatus` union type.
   ```ts
   // Before
   export type CandidateStatus =
     | "received" | "under_review" | "approved" | "rejected"
     | "scheduled" | "completed" | "decided";

   // After
   export type CandidateStatus =
     | "received" | "under_review" | "approved" | "rejected"
     | "Project Assigned" | "Project Completed"
     | "scheduled" | "completed" | "decided";
   ```

---

### Bug 5 — Duplicate Project Route

**File:** `backend/src/modules/projects/project.route.js`

**Specific Changes:**
1. **Remove** the line `router.put("/:id", updateProject);`
2. Keep `router.patch("/:id", updateProject);` intact.

---

### Bug 6 — AI Retry Corrupts System Prompt

**File:** `backend/src/modules/ai/ai.service.js` — `generateStructuredAI` function

**Specific Changes:**
1. In the `retryMessages` `.map()` callback, change the guard condition:
   ```js
   // Before
   if (message.role !== "user" && message.role !== "system") return message;

   // After
   if (message.role !== "user") return message;
   ```
   This ensures only `user` messages receive the appended retry instruction; `system` messages are returned unchanged.

---

### Bug 7 — rejectCandidate Wrong Response Shape

**File:** `frontend/services/candidate.api.ts`

**Specific Changes:**
1. Change the `request` type parameter from `request<Candidate>` to `request<{ candidate: Candidate }>`.
2. Capture the result in a variable and return `result.candidate`.
   ```ts
   // Before
   return request<Candidate>(
     `/api/candidates/${id}/reject`,
     { method: "POST", body: JSON.stringify({ reason }) }
   );

   // After
   const result = await request<{ candidate: Candidate }>(
     `/api/candidates/${id}/reject`,
     { method: "POST", body: JSON.stringify({ reason }) }
   );
   return result.candidate;
   ```

---

## Testing Strategy

### Validation Approach

The testing strategy follows the two-phase bugfix methodology: first, surface counterexamples on the unfixed code to confirm root cause analysis; then verify the fix works and preserves all existing behavior.

---

### Exploratory Bug Condition Checking

**Goal:** Confirm or refute each root cause hypothesis by running tests against the UNFIXED code. Failures are expected and desirable here.

**Test Plan:** Write targeted tests for each bug condition that exercise the exact triggering path. Run on unfixed code to observe failures.

**Test Cases:**
1. **Bug 1 — Model fallback test**: Call `generateAIResponse` with `GROQ_MODEL` unset. Expect a Groq 400/404 error containing a reference to `"openai/gpt-oss-20b"` (will fail on unfixed code).
2. **Bug 2 — Interview route test**: Send `GET /api/interviews` to the Express app. Expect 404 (will fail — confirms route not mounted).
3. **Bug 3 — Slot route test**: Send `GET /api/slots` to the Express app. Expect 404 (will fail — confirms slot route not mounted).
4. **Bug 4 — TypeScript type check**: Run `tsc --noEmit` on the frontend with a variable typed as `CandidateStatus = "Project Assigned"`. Expect a TS error (will fail on unfixed code).
5. **Bug 5 — Duplicate route test**: Send `PUT /api/projects/abc` to Express app. Expect 404 (will fail — currently routes to `updateProject`).
6. **Bug 6 — Retry system message test**: Call `generateStructuredAI` with a system message and trigger a retry (mock the first call to fail). Assert the system message content is unmodified in `retryMessages` (will fail on unfixed code).
7. **Bug 7 — rejectCandidate type test**: Call `rejectCandidate` with a mocked backend that returns `{ success: true, candidate: { name: "Alice" } }`. Access `result.name` and expect `"Alice"` (will fail — returns `undefined` on unfixed code).
8. **Bug 8 — Service import test**: Import `slot.service.js` and call `getSlots()`. Expect `TypeError: getSlots is not a function` (will fail on unfixed code).

**Expected Counterexamples:**
- Groq API error response with `"openai/gpt-oss-20b"` in the error message.
- Express 404 responses for `/api/interviews` and `/api/slots`.
- TypeScript compiler errors for `"Project Assigned"` / `"Project Completed"` assignments.
- `undefined` returned instead of `"Alice"` for `rejectCandidate` result.
- `TypeError` when calling imported slot service functions.

---

### Fix Checking

**Goal:** Verify that for all inputs where the bug condition holds, the fixed code produces the correct behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedSystem(input)
  ASSERT expectedBehavior(result)  -- per Property 1–7
END FOR
```

**Test Cases (post-fix):**
1. `generateAIResponse` with `GROQ_MODEL` unset → Groq call succeeds with `llama3-70b-8192`.
2. `GET /api/interviews` → 200 with array body.
3. `GET /api/interviews/:id` → 200 with document or 404.
4. `POST /api/interviews` with valid body → 201.
5. `PATCH /api/interviews/:id` with update body → 200 with updated document.
6. `GET /api/slots` → 200 with slot array.
7. `POST /api/slots` → 201 with created slot.
8. `PATCH /api/slots/:id` → 200.
9. `DELETE /api/slots/:id` → 200.
10. `GET /api/student/slots` → 200 with open slots.
11. `POST /api/student/book` → 200 with booked slot.
12. `import { getSlots } from "slot.service"` → function is callable, returns array.
13. `import { rescheduleSlot } from "reschedule.service"` → function is callable.
14. `import { createCalendarEvent } from "calendar.service"` → function is callable.
15. TypeScript compiles `const s: CandidateStatus = "Project Assigned"` without error.
16. `PUT /api/projects/abc` → 404.
17. `generateStructuredAI` retry → system message content unchanged, user message has retry instruction appended.
18. `rejectCandidate("id", "reason")` with mocked backend → returns `{ name: "Alice", ... }` directly.

---

### Preservation Checking

**Goal:** Verify that for all inputs where none of the 8 bug conditions hold, the fixed system behaves identically to the original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalSystem(input) == fixedSystem(input)
END FOR
```

**Testing Approach:** Property-based testing is recommended for the AI retry path (Property 8) because the input space of message arrays is large and edge cases (e.g. messages with role `"assistant"`, `"tool"`, mixed arrays) need to be covered systematically.

**Test Cases:**
1. **Existing routes preserved**: `GET /api/candidates`, `GET /api/projects`, `POST /api/auth/login`, `GET /api/student/me` all return the same responses as before.
2. **AI with GROQ_MODEL set**: When `GROQ_MODEL=mixtral-8x7b-32768` is set, `generateAIResponse` uses that model, not `llama3-70b-8192`.
3. **AI first attempt success**: `generateStructuredAI` succeeds on first attempt — no retry logic executed, messages array unchanged.
4. **AI retry with no system messages**: Retry instruction is appended to user messages; behavior is identical to before for message arrays containing only `user` and `assistant` messages.
5. **approveCandidate unchanged**: Returns unwrapped `Candidate` as before.
6. **getCandidate unchanged**: Returns bare `Candidate` as before.
7. **Existing CandidateStatus values**: `"received"`, `"under_review"`, `"approved"`, `"rejected"`, `"scheduled"`, `"completed"`, `"decided"` all remain valid TypeScript.
8. **PATCH /api/projects/:id**: `updateProject` handler still invoked correctly.
9. **GET /api/projects**: Returns full project list unchanged.
10. **Slot schema validation**: Creating a slot with invalid `status` (e.g. `"expired"`) is rejected by Mongoose.

---

### Unit Tests

- Test `ai.service.js` MODEL constant value when `GROQ_MODEL` env is unset.
- Test `generateStructuredAI` retry: assert system messages are not modified; user messages have instruction appended.
- Test each interview controller handler (`getInterviews`, `getInterviewById`, `createInterview`, `updateInterview`) in isolation with a mocked Mongoose model.
- Test each slot service function (`getSlots`, `createSlot`, `bookSlot`, etc.) with a mocked Slot model.
- Test `bookSlot` edge case: attempting to book a slot with `status !== "open"` should throw or return an error.
- Test `rejectCandidate` in `candidate.api.ts`: mock `request` to return `{ candidate: { name: "Alice" } }` and assert the returned value is `{ name: "Alice" }`.
- Test TypeScript types: confirm `CandidateStatus` accepts all 9 values post-fix.
- Test `project.route.js` route table: assert `PUT /:id` is not registered.

### Property-Based Tests

- Generate random message arrays with varying `role` values (`"user"`, `"system"`, `"assistant"`, `"tool"`) and verify the retry `.map()` only modifies `role === "user"` messages (Property 6).
- Generate random valid slot data objects and verify `createSlot` → `getSlotById` round-trip returns matching data (Property 3).
- Generate random candidate status strings and verify only those in the `CandidateStatus` union pass TypeScript assignability, including the two new values (Property 4).
- Generate random interview payloads (with required fields present or missing) and verify `createInterview` returns 201 on valid input and 400/500 on invalid (Property 2).

### Integration Tests

- Full app startup: load `app.js` with all new route mounts and assert no errors thrown during initialization.
- End-to-end interview flow: `POST /api/interviews` → `GET /api/interviews/:id` → `PATCH /api/interviews/:id/status`.
- End-to-end slot booking flow: `POST /api/slots` (admin creates slot) → `GET /api/student/slots` (student views) → `POST /api/student/book` (student books).
- AI feature with no env variable set: call a project generation endpoint and assert a valid AI response is returned (using `llama3-70b-8192`).
- Candidate rejection UI flow: `POST /api/candidates/:id/reject` → verify the frontend `rejectCandidate` response surfaces the correct candidate name in the UI state.
