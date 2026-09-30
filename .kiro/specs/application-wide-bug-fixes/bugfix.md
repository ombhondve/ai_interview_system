# Bugfix Requirements Document

## Introduction

This document covers 8 confirmed bugs found across a full audit of the AI Interview System codebase. The bugs span the backend Express application, the AI service layer, the scheduling module, and the frontend TypeScript type definitions. Together they cause complete failure of all AI features, 404 errors on every interview and slot API endpoint, broken candidate status handling in the frontend, a corrupted AI retry prompt, an incorrect API response shape for candidate rejection, and a scheduling module that crashes on import due to empty implementation files. Each bug is described with its current defective behavior, the expected correct behavior, and the existing behavior that must be preserved after the fix.

---

## Bug 1 — Invalid Groq Model Name

### Bug Analysis

#### Current Behavior (Defect)

1.1 WHEN `GROQ_MODEL` environment variable is not set THEN the system uses `"openai/gpt-oss-20b"` as the Groq model ID fallback, which is not a valid Groq model identifier.

1.2 WHEN any AI feature (resume analysis, project generation, WhatsApp chat, AI interview) is invoked without `GROQ_MODEL` set THEN the system sends a request to the Groq API with an invalid model ID and the Groq API returns a 400 or 404 error.

1.3 WHEN the Groq API returns an error due to the invalid model ID THEN the system throws an unhandled exception that propagates to the caller and the AI feature fails entirely.

#### Expected Behavior (Correct)

2.1 WHEN `GROQ_MODEL` environment variable is not set THEN the system SHALL use `"llama3-70b-8192"` as the default fallback model ID, which is a valid and available Groq production model.

2.2 WHEN any AI feature is invoked without `GROQ_MODEL` set THEN the system SHALL successfully send a request to the Groq API using the `"llama3-70b-8192"` model and receive a valid response.

2.3 WHEN `GROQ_MODEL` is set to a valid model ID in the environment THEN the system SHALL use the value from the environment variable, ignoring the hardcoded fallback.

#### Unchanged Behavior (Regression Prevention)

3.1 WHEN `GROQ_MODEL` is explicitly set in the environment to any valid Groq model ID THEN the system SHALL CONTINUE TO use that environment variable value for all AI requests.

3.2 WHEN the Groq API key is missing THEN the system SHALL CONTINUE TO throw the existing `"GROQ_API_KEY is not configured"` error before making any API call.

3.3 WHEN `generateStructuredAI`, `generateAIResponse`, and `generateWhatsAppChatResponse` are called with valid messages THEN the system SHALL CONTINUE TO delegate correctly to the Groq SDK with all existing parameters (temperature, max_completion_tokens, stream, response_format).

---

## Bug 2 — Interview Module Routes Never Registered

### Bug Analysis

#### Current Behavior (Defect)

2.1 WHEN a client sends any HTTP request to `/api/interviews/*` THEN the system returns a `404 API endpoint not found` response because no interview routes are mounted in `app.js`.

2.2 WHEN the admin panel navigates to `/admin/interviews/` THEN the system fails to load interview data because the backend has no registered route handler for interview endpoints.

2.3 WHEN `backend/src/modules/interview/interview.controller.js` is imported THEN the system encounters an empty file with no exported handlers, causing runtime failures for any code that depends on these exports.

2.4 WHEN `backend/src/modules/interview/index.js` is imported THEN the system encounters an empty file, providing no usable exports for the interview module.

#### Expected Behavior (Correct)

2.1 WHEN a client sends `GET /api/interviews` THEN the system SHALL return a list of interviews from the database with a 200 response.

2.2 WHEN a client sends `GET /api/interviews/:id` THEN the system SHALL return the interview document for the given ID, or a 404 if not found.

2.3 WHEN a client sends `POST /api/interviews` THEN the system SHALL create a new interview record and return it with a 201 response.

2.4 WHEN a client sends `PATCH /api/interviews/:id` THEN the system SHALL update the specified interview and return the updated document.

2.5 WHEN `interview.routes.js` is imported by `app.js` THEN the system SHALL mount the interview router at `/api/interviews` so all interview endpoints are reachable.

2.6 WHEN `interview.controller.js` is loaded THEN the system SHALL export the required handler functions (`getInterviews`, `getInterviewById`, `createInterview`, `updateInterview`) without throwing.

#### Unchanged Behavior (Regression Prevention)

3.1 WHEN requests are made to all other existing API routes (`/api/candidates`, `/api/projects`, `/api/ai`, `/api/student`, `/api/auth`, `/api/verification`, `/api/whatsapp`) THEN the system SHALL CONTINUE TO handle them correctly without disruption.

3.2 WHEN `app.js` is loaded THEN the system SHALL CONTINUE TO apply all existing middleware (CORS, body parser, cookie parser, request logger, static uploads) in the same order before route handlers.

---

## Bug 3 — Slot and Scheduling Routes Never Registered

### Bug Analysis

#### Current Behavior (Defect)

3.1 WHEN a client sends any HTTP request to `/api/slots/*` THEN the system returns a `404 API endpoint not found` response because no slot routes are mounted in `app.js`.

3.2 WHEN the student portal page `/student/book-slot` loads THEN the system fails to fetch available slots because `GET /api/student/slots` is not registered on the student router.

3.3 WHEN a student attempts to book a slot THEN the system returns 404 because `POST /api/student/book` is not registered on the student router.

3.4 WHEN the admin slots management page loads THEN the system fails to fetch, create, or cancel slots because `/api/slots` (GET, POST, PATCH, DELETE) are not registered.

#### Expected Behavior (Correct)

3.1 WHEN a client sends `GET /api/slots` THEN the system SHALL return the list of available slots with a 200 response.

3.2 WHEN a client sends `POST /api/slots` THEN the system SHALL create a new slot and return it with a 201 response.

3.3 WHEN a client sends `PATCH /api/slots/:id` THEN the system SHALL update the slot status (e.g. cancel) and return the updated slot.

3.4 WHEN a client sends `DELETE /api/slots/:id` THEN the system SHALL remove the slot and return a 200 success response.

3.5 WHEN a student client sends `GET /api/student/slots` THEN the system SHALL return the list of open slots available for booking.

3.6 WHEN a student client sends `POST /api/student/book` THEN the system SHALL book the requested slot for the authenticated student and return the booked slot.

3.7 WHEN `slot.routes.js` is imported by `app.js` THEN the system SHALL mount the slot router at `/api/slots`.

#### Unchanged Behavior (Regression Prevention)

3.1 WHEN requests are made to the existing student endpoints (`GET /api/student/invite`, `GET /api/student/me`) THEN the system SHALL CONTINUE TO handle them correctly.

3.2 WHEN the `Slot` Mongoose model is queried THEN the system SHALL CONTINUE TO enforce the existing schema fields (`startTime`, `endTime`, `status`, `bookedBy`, `timezone`) and their validation rules.

---

## Bug 4 — CandidateStatus TypeScript Type Missing Backend Enum Values

### Bug Analysis

#### Current Behavior (Defect)

4.1 WHEN the backend returns a candidate whose `status` field is `"Project Assigned"` THEN the system assigns the value to a variable typed as `CandidateStatus`, which does not include `"Project Assigned"`, causing a TypeScript type error at compile time.

4.2 WHEN the backend returns a candidate whose `status` field is `"Project Completed"` THEN the system assigns the value to a variable typed as `CandidateStatus`, which does not include `"Project Completed"`, causing a TypeScript type error at compile time.

4.3 WHEN a status badge component or filter dropdown receives a `status` value of `"Project Assigned"` or `"Project Completed"` THEN the system fails to match it against the known `CandidateStatus` values and may render the badge as undefined, empty, or visually broken.

4.4 WHEN `CandidateFilters.status` is typed as `CandidateStatus | "all"` and a filter for `"Project Assigned"` is applied THEN the system produces a TypeScript type error because `"Project Assigned"` is not assignable to `CandidateStatus`.

#### Expected Behavior (Correct)

4.1 WHEN `"Project Assigned"` is returned from the backend as a candidate status THEN the system SHALL accept it as a valid `CandidateStatus` value with no TypeScript errors.

4.2 WHEN `"Project Completed"` is returned from the backend as a candidate status THEN the system SHALL accept it as a valid `CandidateStatus` value with no TypeScript errors.

4.3 WHEN a status badge or filter component receives `"Project Assigned"` or `"Project Completed"` THEN the system SHALL render the correct display label and styling for those status values.

#### Unchanged Behavior (Regression Prevention)

3.1 WHEN the backend returns any of the existing status values (`"received"`, `"under_review"`, `"approved"`, `"rejected"`, `"scheduled"`, `"completed"`, `"decided"`) THEN the system SHALL CONTINUE TO accept and render them correctly with no type errors.

3.2 WHEN the `CandidateStatus` type is used in `CandidateFilters`, `Candidate`, `InterviewStatus`, and any other interfaces THEN the system SHALL CONTINUE TO enforce type safety for all status comparisons and assignments.

---

## Bug 5 — Project Route Registers updateProject Handler Twice (PATCH and PUT)

### Bug Analysis

#### Current Behavior (Defect)

5.1 WHEN `project.route.js` is loaded THEN the system registers both `PATCH /:id` and `PUT /:id` pointing to the identical `updateProject` handler, creating an ambiguous REST API contract.

5.2 WHEN a client sends `PUT /api/projects/:id` expecting full-resource replacement semantics THEN the system executes the same partial-update `updateProject` handler as `PATCH`, silently applying partial-update logic instead of replace semantics.

5.3 WHEN developers or API consumers reference the route table THEN the system presents two HTTP verbs for the same operation, causing maintenance confusion and inconsistent API client implementations.

#### Expected Behavior (Correct)

5.1 WHEN `project.route.js` is loaded THEN the system SHALL register only `PATCH /:id` mapped to `updateProject`, removing the duplicate `PUT /:id` registration.

5.2 WHEN a client sends `PATCH /api/projects/:id` THEN the system SHALL invoke `updateProject` for partial updates.

5.3 WHEN a client sends `PUT /api/projects/:id` THEN the system SHALL return a `404 API endpoint not found` response, clearly indicating that full-replace is not a supported operation.

#### Unchanged Behavior (Regression Prevention)

3.1 WHEN a client sends `GET /api/projects` THEN the system SHALL CONTINUE TO return the full list of projects.

3.2 WHEN a client sends `GET /api/projects/:id` THEN the system SHALL CONTINUE TO return the project by ID.

3.3 WHEN a client sends `POST /api/projects` THEN the system SHALL CONTINUE TO create a new project.

3.4 WHEN a client sends `DELETE /api/projects/:id` THEN the system SHALL CONTINUE TO delete the project.

3.5 WHEN a client sends `PATCH /api/projects/:id/archive` THEN the system SHALL CONTINUE TO archive the project.

3.6 WHEN a client sends `POST /api/projects/:id/admin-pdf` THEN the system SHALL CONTINUE TO handle the PDF upload.

3.7 WHEN a client sends `GET /api/projects/:id/candidates` THEN the system SHALL CONTINUE TO return assigned candidates.

---

## Bug 6 — AI Retry Logic Corrupts System Prompt

### Bug Analysis

#### Current Behavior (Defect)

6.1 WHEN `generateStructuredAI` retries after a failed first attempt THEN the system appends the `RETRY INSTRUCTION` block to every message where `role === "user"` OR `role === "system"`, because the guard condition is `role !== "user" && role !== "system"`.

6.2 WHEN the system message contains a carefully crafted AI prompt (e.g. the resume analysis prompt or project generation prompt) AND a retry occurs THEN the system corrupts that prompt by appending unrelated retry instructions to it, degrading AI output quality on the second attempt.

6.3 WHEN `generateStructuredAI` retries with a corrupted system message THEN the system sends a malformed prompt context to the Groq API that may produce lower-quality, inconsistent, or off-topic AI responses.

#### Expected Behavior (Correct)

6.1 WHEN `generateStructuredAI` retries after a failed first attempt THEN the system SHALL append the `RETRY INSTRUCTION` block only to messages where `role === "user"`, leaving all `system` messages unchanged.

6.2 WHEN a retry occurs and the messages array contains a system prompt THEN the system SHALL preserve the original system message content exactly as provided by the caller.

6.3 WHEN a retry occurs and the messages array contains a user message THEN the system SHALL append the compact retry instruction to that user message to guide the model toward a shorter valid JSON output.

#### Unchanged Behavior (Regression Prevention)

3.1 WHEN `generateStructuredAI` succeeds on the first attempt THEN the system SHALL CONTINUE TO return the parsed JSON object without triggering any retry logic.

3.2 WHEN `generateStructuredAI` retries THEN the system SHALL CONTINUE TO call `generateAIResponse` with the modified messages and attempt to parse the result with `extractJson`.

3.3 WHEN both the first and retry attempts fail THEN the system SHALL CONTINUE TO throw the error from the retry attempt to the caller.

---

## Bug 7 — rejectCandidate Returns Wrong Response Shape

### Bug Analysis

#### Current Behavior (Defect)

7.1 WHEN `rejectCandidate(id, reason)` is called in `candidate.api.ts` THEN the system makes a request typed as `request<Candidate>(...)`, expecting the raw response body to be a `Candidate` object.

7.2 WHEN the backend `POST /api/candidates/:id/reject` responds THEN the system returns `{ success: true, candidate: {...} }` — a wrapper object — not a bare `Candidate`.

7.3 WHEN the caller of `rejectCandidate()` accesses `.name`, `.status`, or any other `Candidate` field on the returned value THEN the system returns `undefined` because the actual candidate is nested at `.candidate`, not at the top level.

7.4 WHEN UI components use the result of `rejectCandidate()` to update local state THEN the system silently uses the wrapper object as if it were a candidate, causing the UI to display blank or incorrect candidate data after rejection.

#### Expected Behavior (Correct)

7.1 WHEN `rejectCandidate(id, reason)` is called THEN the system SHALL make a request typed as `request<{ candidate: Candidate }>` to match the actual backend response shape.

7.2 WHEN the backend returns `{ success: true, candidate: {...} }` THEN the system SHALL extract and return only the `candidate` field, so the caller receives a `Candidate` object directly.

7.3 WHEN the returned value is used to update UI state THEN the system SHALL provide a fully populated `Candidate` object with all fields correctly accessible.

#### Unchanged Behavior (Regression Prevention)

3.1 WHEN `approveCandidate(id)` is called THEN the system SHALL CONTINUE TO correctly unwrap `result.candidate` from `request<{ candidate: Candidate }>`, unchanged.

3.2 WHEN `getCandidate(id)` is called THEN the system SHALL CONTINUE TO return `request<Candidate>(...)` directly, since that endpoint returns a bare candidate.

3.3 WHEN `getCandidates(filters)` is called THEN the system SHALL CONTINUE TO return the paginated list result including `data`, `total`, `page`, and `pageSize`.

---

## Bug 8 — Scheduling Module Service Files Are Empty

### Bug Analysis

#### Current Behavior (Defect)

8.1 WHEN `slot.service.js` is imported by any module THEN the system imports an empty file that exports no functions, causing "is not a function" runtime errors for any caller that invokes slot service methods.

8.2 WHEN `slot.controller.js` is imported by a router THEN the system imports an empty file with no exported handler functions, so any attempt to register these handlers as Express middleware throws a type error at startup.

8.3 WHEN `reschedule.service.js` is imported THEN the system imports an empty file, causing "is not a function" errors for any reschedule operation.

8.4 WHEN `calendar.service.js` is imported THEN the system imports an empty file, causing "is not a function" errors for any calendar integration operation.

8.5 WHEN the scheduling module is loaded as part of the application startup THEN the system fails to initialize the scheduling feature and may crash or silently skip the module.

#### Expected Behavior (Correct)

8.1 WHEN `slot.service.js` is loaded THEN the system SHALL export at minimum the following functions: `getSlots()`, `getSlotById(id)`, `createSlot(data)`, `updateSlot(id, data)`, `deleteSlot(id)`, `bookSlot(slotId, candidateId)`.

8.2 WHEN `slot.controller.js` is loaded THEN the system SHALL export Express request handler functions: `getSlotsController`, `getSlotByIdController`, `createSlotController`, `updateSlotController`, `deleteSlotController`, `bookSlotController`.

8.3 WHEN `reschedule.service.js` is loaded THEN the system SHALL export at minimum `rescheduleSlot(slotId, newSlotData)` so the reschedule flow does not throw on invocation.

8.4 WHEN `calendar.service.js` is loaded THEN the system SHALL export at minimum `createCalendarEvent(slotData)` and `deleteCalendarEvent(eventId)` so calendar integration does not throw on invocation.

8.5 WHEN `slot.service.js` creates or books a slot THEN the system SHALL interact with the `Slot` Mongoose model using the existing schema (`startTime`, `endTime`, `status`, `bookedBy`, `timezone`).

#### Unchanged Behavior (Regression Prevention)

3.1 WHEN the `Slot` model is queried by any service function THEN the system SHALL CONTINUE TO enforce the existing schema validation rules defined in `slot.model.js`.

3.2 WHEN a slot's `status` is updated to `"booked"` THEN the system SHALL CONTINUE TO enforce the enum constraint (`"open"`, `"booked"`, `"cancelled"`) from the Slot schema.

3.3 WHEN any other module in the application is loaded THEN the system SHALL CONTINUE TO initialize correctly, unaffected by the scheduling module changes.
