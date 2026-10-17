# RecruitAI — Complete Technical Requirements, Dependency & Runtime Audit

**Audit Date:** October 17, 2026  
**Audited Repository:** `d:\ai_interview_system`  
**Target Environments:** Windows 10/11 Development Workstation & Linux/Cloud Production  
**Audit Status:** Static & Non-Destructive Analysis Completed  

---

## 1. Executive Summary

RecruitAI is an end-to-end, multi-tier AI-driven technical interview and project verification platform. The application combines:
1. A **Next.js 14 App Router** frontend for candidates and recruiters.
2. An **Express 5 / Node.js** backend providing RESTful APIs, JWT authentication, Google Calendar integration, project verification, and question generation.
3. A **Python 3.11 Playwright + Kokoro + PyAudioWPatch** automation worker ("Meeting Bot") that joins Google Meet video calls, listens to candidate responses via Windows WASAPI audio loopback, transcribes speech with Deepgram Nova-2, consults the backend for adaptive questions using Groq LLMs, and synthesizes conversational speech locally through VB-Audio Virtual Cable into the meeting microphone.

### Key Audit Verdict
* **Codebase Maturity:** The business logic, state machines, and interview lifecycle (preflight validation, turn-taking, inactivity handling, time-bounded closing, and post-interview analysis) are fully implemented and backed by a comprehensive 134-test passing test suite in `meeting-bot/tests`.
* **Current Operational State:** **Not currently runnable out of the box.** Neither `backend` nor `frontend` has `node_modules` installed. In addition, `@babel/parser` is missing from `backend/package.json` dependencies, unused native packages (`canvas`) threaten Windows installation stability, and the Python Meeting Bot strictly requires Python 3.11 (system Python 3.14 is incompatible with compiled wheels).
* **Estimated Effort to Full Operation:** ~30–45 minutes of package installation, configuration validation, and Google account profile setup.

---

## 2. Application Architecture & Component Interaction Map

```mermaid
flowchart TB
    subgraph Candidate_Recruiter_Layer [Candidate & Recruiter Interface]
        FE[Frontend Next.js 14<br/>localhost:3000]
        GM_Web[Google Meet Web Call<br/>Browser Room]
    end

    subgraph Central_Backend [RecruitAI Central Backend API]
        BE[Express 5 Server<br/>localhost:5000 / Vercel]
        DB[(MongoDB Database<br/>Atlas / Local)]
        Cloudinary[Cloudinary Media<br/>PDFs & Resumes]
    end

    subgraph External_AI_APIs [External AI & Cloud Services]
        Groq[Groq Cloud LLM<br/>llama-3.3-70b / llama3-70b]
        Deepgram[Deepgram Nova-2 STT<br/>api.deepgram.com]
        GCal[Google Calendar API<br/>OAuth2 & Meet Links]
        GH[GitHub API<br/>Code Verification]
    end

    subgraph Bot_Worker_Layer [Distributed Meeting Bot Worker (Windows)]
        Worker[Bot Worker Daemon<br/>app.worker (polls every 10s)]
        Engine[Interview Bot Process<br/>app.main]
        Playwright[Playwright Chromium<br/>Persistent Profile: bot-profile/]
        Kokoro[Local Kokoro Neural TTS<br/>PyTorch CPU/GPU]
        AudioLoopback[WASAPI Loopback Capture<br/>PyAudioWPatch]
        VBCable[VB-Audio Virtual Cable<br/>CABLE Input / Output]
    end

    %% Connections
    FE -->|REST API with Cookies/JWT| BE
    BE <-->|Mongoose ODM| DB
    BE -->|Upload PDFs| Cloudinary
    BE -->|Adaptive Prompts & Evaluation| Groq
    BE -->|Schedule & Meet Links| GCal
    BE -->|Fetch Candidate Repos| GH

    Worker -->|Poll & Claim Jobs /api/bot-control| BE
    Worker -->|Spawns Subprocess| Engine
    Engine -->|Controls Browser| Playwright
    Playwright -->|Joins Meeting| GM_Web
    GM_Web -->|Speaker Audio| AudioLoopback
    AudioLoopback -->|Audio Chunks| Deepgram
    Deepgram -->|Transcripts| Engine
    Engine -->|Submit Answers & Fetch Next Question| BE
    Engine -->|Generate Speech| Kokoro
    Kokoro -->|48kHz Audio Playback| VBCable
    VBCable -->|Virtual Mic Input| Playwright
```

### Complete Interview Lifecycle Trace
1. **Scheduling & Eligibility:** Student books an interview slot via `/api/interviews/book` or `/api/student/interview/schedule`. Google Calendar API creates a Google Meet room and adds `GOOGLE_MEET_BOT_EMAIL`.
2. **Job Creation & Worker Polling:** Backend creates a `BotJob` record in MongoDB in `QUEUED` state. The daemon `app.worker` polls `/api/bot-control/worker/claim` every 10 seconds.
3. **Claim & Preflight Validation:** Worker claims the job with a 120-second lease. Immediately before launching Chromium, it calls `/api/bot-control/worker/jobs/:id/preflight` to verify start time, candidate ID, and active status.
4. **Google Meet Launch:** Worker launches `app.main` with `--interview-id`, `--meet-url`, and `--duration-minutes`. Chromium loads with `--user-data-dir=bot-profile/`.
5. **In-Call Audio Setup:** Playwright opens Meet settings and verifies audio devices (`CABLE Output` as mic, system speaker as output).
6. **Candidate Arrival:** Bot detects candidate presence via DOM participant selectors (`is_candidate_present()`) and signals `/api/ai-interviews/internal/:id/candidate-joined`.
7. **Question Delivery:** Kokoro TTS synthesizes the opening question and plays it through `CABLE Input`.
8. **Speech Capture & VAD:** `audio_capture.py` captures candidate speech via Windows WASAPI loopback on the system speaker endpoint. VAD detects speech start, tracks pause duration (1.6s silence), and cuts an audio segment.
9. **STT Transcription:** Deepgram Nova-2 HTTP endpoint transcribes audio bytes.
10. **Answer Submission & Persistence:** Transcript is posted to `/api/ai-interviews/internal/:id/answer`. Backend persists turn in `AiInterview.transcript`.
11. **Next-Question Generation:** Backend queries Groq LLM with past turns, rubric, and candidate profile to generate the next question.
12. **Duration & Termination:** At `durationMinutes - 3.5m`, the bot shifts to closing questions. When time expires, it thanks the candidate, calls `/api/ai-interviews/internal/:id/complete`, leaves the call, and uploads the master WAV recording.
13. **Evaluation:** Backend triggers `analyzeInterview()`, computing category scores, strengths, and recommendations.

---

## 3. Complete Dependency Inventory

### 3.1 Backend Dependencies (`backend/package.json`)

| Package Name | Declared Version | Ecosystem | Used By File Paths | Purpose | Status | Recommended Installation Command | Risk & Notes |
|---|---|---|---|---|---|---|---|
| `express` | `^5.1.0` | Node.js | `backend/src/app.js` | Core HTTP web framework & routing | Missing (no `node_modules`) | `npm install express@^5.1.0` | Express 5 has breaking changes in route param handling; code conforms to v5. |
| `mongoose` | `^8.18.1` | Node.js | `backend/src/config/database.js`, all `*.model.js` | MongoDB ODM, schemas, and queries | Missing | `npm install mongoose@^8.18.1` | Requires active MongoDB connection at boot. |
| `groq-sdk` | `^1.6.0` | Node.js / Cloud | `backend/src/modules/ai/ai.service.js`, `test_groq.cjs` | Groq Cloud LLM API client | Missing | `npm install groq-sdk@^1.6.0` | High reliability; model deprecation risk (see Section 5). |
| `jsonwebtoken` | `^9.0.2` | Node.js | `backend/src/modules/auth/auth.service.js` | JWT creation and verification for auth | Missing | `npm install jsonwebtoken@^9.0.2` | Standard cryptographic token library. |
| `bcrypt` | `^6.0.0` | Node.js (C++) | `backend/src/server.js`, `createAdmin.js` | Password hashing for administrator accounts | Missing | `npm install bcrypt@^6.0.0` | Native C++ module; requires Visual C++ Build Tools or prebuilt binary. |
| `googleapis` | `^182.0.0` | Node.js | `backend/src/modules/calendar/googleCalendar.connection.service.js` | Google Calendar API and OAuth2 client | Missing | `npm install googleapis@^182.0.0` | Heavy package; used for recruiter calendar synchronization. |
| `passport` | `^0.7.0` | Node.js | `backend/src/app.js`, `googleOAuth.js` | Authentication middleware | Missing | `npm install passport@^0.7.0` | Standard auth framework. |
| `passport-google-oauth20` | `^2.0.0` | Node.js | `backend/src/config/googleOAuth.js` | Google OAuth 2.0 strategy for Passport | Missing | `npm install passport-google-oauth20@^2.0.0` | Candidate Google Sign-in. |
| `dotenv` | `^17.2.2` | Node.js | `backend/src/server.js`, `validate-env.js` | Environment variable loader from `.env` | Missing | `npm install dotenv@^17.2.2` | Required for reading local configuration. |
| `cors` | `^2.8.5` | Node.js | `backend/src/app.js` | Cross-Origin Resource Sharing middleware | Missing | `npm install cors@^2.8.5` | Configured with dynamic origin whitelist. |
| `express-session` | `^1.18.0` | Node.js | `backend/src/app.js` | Session state management | Missing | `npm install express-session@^1.18.0` | Uses MemoryStore by default; non-persistent across serverless instances. |
| `connect-mongo` | `^6.0.0` | Node.js | Declared in `package.json` | MongoDB session store | **Unused in code** | Remove or wire into `app.js` | Declared but never imported; session currently uses MemoryStore. |
| `mupdf` | `^1.28.1` | Node.js (WASM) | `backend/src/modules/resume/resume.parser.js` | High-fidelity native PDF text extraction & rendering | Missing | `npm install mupdf@^1.28.1` | WASM-based; replaces fragile `pdf-parse` and `pdfjs-dist`. |
| `tesseract.js` | `^7.0.0` | Node.js (WASM) | `backend/src/modules/resume/resume.parser.js` | Client/server OCR engine for scanned PDF resumes | Missing | `npm install tesseract.js@^7.0.0` | Uses remote CDN for core WASM; local `eng.traineddata` present. |
| `cloudinary` | `^2.11.0` | Node.js / Cloud | `backend/src/config/cloudinary.js` | Cloud media storage for project assignment PDFs | Missing | `npm install cloudinary@^2.11.0` | Requires Cloudinary API credentials. |
| `nodemailer` | `^10.0.10` | Node.js | `backend/src/modules/notifications/notification.service.js` | SMTP email transport for OTP and status alerts | Missing | `npm install nodemailer@^10.0.10` | Optional if Google OAuth is used. |
| `twilio` | `^6.1.1` | Node.js / Cloud | `backend/src/modules/whatsapp/whatsapp.webhook.js` | WhatsApp Business webhook integration | Missing | `npm install twilio@^6.1.1` | Optional channel integration. |
| `uuid` | `^14.0.2` | Node.js | `backend/src/modules/interview/interview.session.answers.service.js` | UUID generator for request IDs | Missing | `npm install uuid@^14.0.2` | Standard utility. |
| `axios` | `^1.20.0` | Node.js | `backend/src/modules/projects/github.client.js` | HTTP client for external GitHub API requests | Missing | `npm install axios@^1.20.0` | Used for repository fetching and rate-limit handling. |
| `pdfkit` | `^0.20.2` | Node.js | `backend/src/modules/projects/project.pdf.service.js` | Programmatic PDF document generation | Missing | `npm install pdfkit@^0.20.2` | Generates candidate project assignment briefs. |
| `@vercel/functions` | `^3.9.11` | Node.js | `backend/api/index.js` | Vercel Serverless Function helper | Missing | `npm install @vercel/functions@^3.9.11` | Production serverless adapter. |
| `canvas` | `^3.2.3` | Native C++ | Declared in `package.json` | Cairo-backed canvas graphics library | **Unused & High Risk** | **REMOVE** (`npm uninstall canvas`) | Requires Python, C++ compiler, Cairo, Pango, and GTK on Windows. Completely unused. |
| `pdf-parse` | `^2.4.5` | Node.js | Declared in `package.json` | Legacy PDF parser | **Unused** | Remove | Superseded by `mupdf`. |
| `@babel/parser` | **Missing** | Node.js | `backend/src/modules/projects/syntaxChecker.js:17` | JavaScript & TypeScript AST parsing | **MISSING** | `npm install @babel/parser@^7.26.0` | **Runtime Failure Risk:** Required by syntax checker. Not declared in dependencies. |
| `nodemon` (dev) | `^3.1.10` | Node.js CLI | `npm run dev` | Auto-reloading development server | Missing | `npm install --save-dev nodemon@^3.1.10` | Dev-only tooling. |
| `jest` (dev) | `^30.5.2` | Node.js CLI | `npm run test` | Test runner | Missing | `npm install --save-dev jest@^30.5.2` | Dev-only tooling. |

---

### 3.2 Frontend Dependencies (`frontend/package.json`)

| Package Name | Declared Version | Ecosystem | Used By File Paths | Purpose | Status | Recommended Installation Command | Risk & Notes |
|---|---|---|---|---|---|---|---|
| `next` | `^14.2.35` | Node.js / React | `frontend/next.config.js`, `frontend/app/*` | React application framework (App Router) | Missing | `npm install next@^14.2.35` | Production-ready Next.js 14. |
| `react` | `18.3.1` | React | All components and pages | UI runtime library | Missing | `npm install react@18.3.1` | Pinned React 18. |
| `react-dom` | `18.3.1` | React | All components and pages | DOM renderer for React | Missing | `npm install react-dom@18.3.1` | Pinned React DOM 18. |
| `framer-motion` | `11.3.19` | React | `frontend/components/student/*`, `frontend/app/student/*` | Animations, modals, and transition effects | Missing | `npm install framer-motion@11.3.19` | Visual polish and smooth interactive UI. |
| `lucide-react` | `0.408.0` | React | All admin and student UI icons | SVG icon library | Missing | `npm install lucide-react@0.408.0` | Comprehensive icons. |
| `clsx` | `2.1.1` | Utility | `frontend/lib/utils.ts` | Conditional CSS class merging | Missing | `npm install clsx@2.1.1` | Lightweight utility. |
| `tailwind-merge` | `2.4.0` | Utility | `frontend/lib/utils.ts` | Conflict-free Tailwind CSS class merging | Missing | `npm install tailwind-merge@2.4.0` | Eliminates class collision bugs. |
| `axios` | `^1.20.0` | Client | `frontend/services/*` | HTTP client for backend communication | Missing | `npm install axios@^1.20.0` | Client-side data fetching. |
| `jose` | `^6.2.12` | Utility | `frontend/lib/auth.ts` | Client/Edge JWT parsing and validation | Missing | `npm install jose@^6.2.12` | Standards-compliant web crypto. |
| `tailwindcss` (dev) | `3.4.7` | CSS CLI | `frontend/tailwind.config.js` | Utility-first CSS styling engine | Missing | `npm install --save-dev tailwindcss@3.4.7` | UI styling. |
| `typescript` (dev) | `5.5.4` | Compiler | `frontend/tsconfig.json` | TypeScript type-checker | Missing | `npm install --save-dev typescript@5.5.4` | Type definitions. |

---

### 3.3 Python Meeting Bot Dependencies (`meeting-bot/requirements.txt`)

| Package Name | Declared Version | Installed Version (in `.venv`) | Used By File Paths | Purpose | Status | Risk & Notes |
|---|---|---|---|---|---|---|
| `playwright` | `>=1.40.0` | `1.63.0` | `app/bot.py`, `app/meet.py`, `app/media_monitor.py` | Headless/visible Chromium browser automation | **Installed** | Requires Chromium binaries or system Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`). |
| `fastapi` | `>=0.104.0` | `0.143.0` | `app/main.py` | Local HTTP control server (`MEETING_BOT_PORT=8001`) | **Installed** | Stable; exposes bot health and telemetry. |
| `uvicorn` | `>=0.24.0` | `0.54.0` | `app/main.py` | ASGI web server for FastAPI | **Installed** | Lightweight async server. |
| `pydantic` | `>=2.5.0` | `2.14.0` | `app/config.py`, `app/main.py` | Data validation and models | **Installed** | Emits harmless v2 deprecation warning on `class Config:`. |
| `pydantic-settings` | `>=2.1.0` | `2.15.0` | `app/config.py` | Environment variable settings management | **Installed** | Standard Pydantic settings adapter. |
| `python-dotenv` | `>=1.0.0` | `1.2.4` | `app/worker.py`, `validate_env.py` | Loads `.env` configuration | **Installed** | Standard environment loader. |
| `PyAudioWPatch` | `>=0.2.12.9` | `0.2.12.9` | `app/audio_capture.py` | Windows WASAPI loopback audio capture | **Installed** | **Windows-Exclusive:** Captures meeting output audio without echo. Incompatible with Linux/Docker. |
| `numpy` | `>=1.26.0` | `2.4.6` | `app/audio_capture.py`, `app/kokoro_tts.py` | Audio signal processing, RMS, and resampling | **Installed** | High-performance array math. |
| `soundfile` | `>=0.12.0` | `0.14.0` | `app/audio_capture.py` | WAV audio file export and formatting | **Installed** | Writes final master session recordings. |
| `requests` | `>=2.31.0` | `2.34.2` | `app/deepgram.py`, `app/recruitai_client.py`, `app/worker.py` | HTTP client for Deepgram and Backend REST APIs | **Installed** | Resilient network calls with exponential backoff. |
| `kokoro` | `>=0.8.4` | `0.9.4` | `app/kokoro_tts.py` | Local neural Text-to-Speech engine | **Installed** | Runs locally via PyTorch CPU/GPU. No cloud fees. |
| `sounddevice` | `>=0.5.0` | `0.5.6` | `app/kokoro_tts.py` | PortAudio audio stream playback to VB-Cable | **Installed** | Routes synthesized audio to virtual cable output. |
| `torch` (transitive) | N/A | `2.14.1` | Kokoro dependency | Deep learning tensor engine | **Installed** | Heavy C++ binary; pinned to Python 3.11. |
| `transformers` (transitive) | N/A | `5.19.0` | Kokoro dependency | Neural tokenization and weights | **Installed** | HuggingFace neural model runner. |

---

## 4. Missing, Incompatible & Problematic Requirements

### 4.1 Missing Dependencies That Cause Runtime Crashes
1. **`@babel/parser` missing in `backend/package.json`:**
   - **File:** `backend/src/modules/projects/syntaxChecker.js` (line 17: `import { parse as babelParse } from "@babel/parser"`)
   - **Impact:** Project submission verification relies on `syntaxChecker.js`. In production, when `devDependencies` are omitted, this causes `Cannot find module '@babel/parser'`.
   - **Resolution:** Add `"@babel/parser": "^7.26.0"` to `backend/package.json` `dependencies`.

### 4.2 Problematic Native Packages Declared But Unused
1. **`canvas` in `backend/package.json` (`^3.2.3`):**
   - **Problem:** `canvas` requires native node-gyp compilation, Python build tools, Cairo, Pango, and Visual C++ on Windows.
   - **Finding:** Code search confirms `canvas` is **never imported** anywhere in `backend/src/`. The PDF parser was refactored to use WASM `mupdf`.
   - **Resolution:** Safely remove `"canvas": "^3.2.3"` from `backend/package.json` to prevent compilation failures during `npm install`.
2. **`pdf-parse` in `backend/package.json` (`^2.4.5`):**
   - **Problem:** Deprecated in favor of `mupdf`. Never imported.
   - **Resolution:** Remove `"pdf-parse": "^2.4.5"`.
3. **`connect-mongo` in `backend/package.json` (`^6.0.0`):**
   - **Problem:** Declared but never imported. Express-session currently defaults to MemoryStore.
   - **Resolution:** Either remove or configure as the persistent session store for Express.

### 4.3 Python Version Incompatibility
- **System Version:** `Python 3.14.7`
- **Virtual Environment (`meeting-bot/.venv`):** `Python 3.11.6`
- **Issue:** Running `python` directly on this workstation uses Python 3.14, for which binary wheels for `PyAudioWPatch`, `torch`, `kokoro`, and `sounddevice` are unavailable.
- **Rule:** All bot execution must strictly use the virtual environment binary: `.\meeting-bot\.venv\Scripts\python.exe`.

### 4.4 Dockerfile / Linux Platform Incompatibility
- **File:** `meeting-bot/Dockerfile` (`FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy`)
- **Problem:** The Dockerfile installs `requirements.txt`, which includes `PyAudioWPatch`. `PyAudioWPatch` is a Windows-only library that talks to the Windows Core Audio WASAPI subsystem. On Linux, `pip install pyaudiowpatch` fails to build or crashes at runtime.
- **Resolution:** For Linux or Docker deployments, audio loopback must use PulseAudio/ALSA virtual sinks (`module-null-sink`) with standard `pyaudio` or `sounddevice`, or the worker must run directly on a Windows host.

---

## 5. AI, Speech-to-Text & Text-to-Speech Engine Audit

| Provider / Tool | Category | Implementation Files | Credentials / Config | Free Tier vs Paid | Operational Behavior & Fallbacks |
|---|---|---|---|---|---|
| **Groq Cloud** | LLM Reasoning & Questions | `backend/src/modules/ai/ai.service.js`, `interview.question.service.js` | `GROQ_API_KEY`, `GROQ_MODEL` | **Generous Free Tier** (30 RPM / 14,400 RPD) | Generates dynamic technical questions. If Groq times out or fails, `interview.question.service.js` falls back to a deterministic category-matched question pool without crashing the interview. |
| **Deepgram** | Speech-to-Text (STT) | `meeting-bot/app/deepgram.py`, `backend/src/modules/interview/providers/speech-to-text.provider.js` | `DEEPGRAM_API_KEY`, `DEEPGRAM_MODEL` (nova-2) | **$200 Free Credit** on signup | Bot sends WAV audio bytes over HTTPS to `api.deepgram.com/v1/listen`. Nova-2 model with smart formatting and punctuation. Filtered for trivial silence/noise. |
| **Kokoro TTS** | Text-to-Speech (TTS) | `meeting-bot/app/kokoro_tts.py` | Local model weights, `KOKORO_VOICE=af_heart` | **100% Free & Local** (Open Weights) | Runs locally via PyTorch. Synthesizes 24 kHz audio, resamples to 48 kHz mono/stereo float32, and streams to VB-Cable Input via `sounddevice`. |
| **ElevenLabs** | Web TTS Fallback | `backend/src/modules/interview/providers/text-to-speech.provider.js` | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Paid / 10k chars free tier | Used only if candidate conducts interview through frontend web browser instead of Google Meet. Frontend falls back to browser `window.speechSynthesis` if ElevenLabs is unconfigured. |

### Audio Routing & Acoustic Feedback Isolation
The meeting bot achieves duplex audio without acoustic feedback through virtual audio separation:
1. **Bot Speech Output:** Kokoro plays synthesized speech into `KOKORO_OUTPUT_DEVICE` (`CABLE Input (VB-Audio Virtual Cable)`).
2. **Meet Microphone Input:** Google Meet selects `CABLE Output (VB-Audio Virtual Cable)` as its microphone. The candidate in Google Meet hears the bot speaking.
3. **Candidate Voice Output:** Google Meet outputs remote participant audio to the physical laptop speakers (`Speaker (2- Realtek(R) Audio)`).
4. **Candidate Voice Capture:** `audio_capture.py` captures from `AUDIO_CAPTURE_DEVICE` (`Speaker (2- Realtek(R) Audio)`) using Windows WASAPI Loopback.
5. **Feedback Guarantee:** Because the bot TTS is routed to `CABLE Input` and NOT the system speakers, the loopback capture never captures the bot's own voice, completely preventing echo and transcription loops.

---

## 6. Google Meet Automation & Browser Profile Audit

### Google OAuth vs Persistent Chrome Profile Distinction
A critical architectural feature of this project:
- **Application API OAuth (`GOOGLE_CALENDAR_CLIENT_ID`):** Used by recruiters to authorize the backend to create Google Calendar events and generate official Google Meet links.
- **Meeting Bot Authentication:** The Meeting Bot **does not use OAuth tokens** to join meetings. It uses Playwright Chromium with a **persistent user profile** (`bot-profile/`).
- **Setup Flow:** The administrator runs `python -m app.main --auth-setup`. A visible Chrome window opens to `accounts.google.com`. The admin logs into the dedicated bot Google account (`ombhondve32@gmail.com`) once, completing 2FA. The session cookies, local storage, and profile state persist on disk in `meeting-bot/bot-profile/`.
- **Joining Behavior:** When a job starts, Playwright launches Chrome with `--user-data-dir=bot-profile/`. Because the bot is already an authenticated Google user invited to the calendar event, it joins the meeting without waiting in the admission lobby.

### Google Meet DOM & Browser Controls
- **Audio/Video Pre-join:** `meet.py` automatically dismisses Google Meet information popups ("Got it", "Dismiss"), turns off the web camera, and configures the audio dropdowns.
- **Fragile Selectors Guard:** Rather than relying on fragile CSS class names (which Google changes frequently), `meet.py` uses accessible ARIA roles, `button[aria-label*="camera" i]`, and normalized device substring scoring (`score_device_match()`).
- **Participant Detection:** `media_monitor.py` tracks active participants and camera state by observing the Meet video grid DOM elements.

---

## 7. Environment Variables & Secrets Reference

| Variable Name | Required? | Component | Purpose | Example / Format | Configuration Target |
|---|---|---|---|---|---|
| `PORT` | Optional (default: 5000) | Backend | Local HTTP listen port | `5000` | `backend/.env` |
| `NODE_ENV` | Required | Backend / Frontend | Runtime environment | `development` or `production` | `.env` |
| `FRONTEND_URL` | Required | Backend | CORS allowed origin | `http://localhost:3000` | `backend/.env` |
| `BACKEND_URL` | Required | Backend / Frontend | Public URL of backend | `http://localhost:5000` | `.env` |
| `NEXT_PUBLIC_BACKEND_URL` | Required | Frontend | Client-side API root | `http://localhost:5000` | `frontend/.env.local` |
| `STORAGE_MONGODB_URI` | Required | Backend | MongoDB connection string | `mongodb://localhost:27017/ai_interview_system` or Atlas URI | `backend/.env` |
| `JWT_SECRET` | Required (min 32 chars) | Backend / Frontend | Token signing secret | `openssl rand -hex 32` | `backend/.env`, `frontend/.env.local` |
| `DEMO_ADMIN_EMAIL` | Dev Only | Backend | Auto-seeded superadmin | `admin@recruitai.com` | `backend/.env` |
| `DEMO_ADMIN_PASSWORD` | Dev Only | Backend | Auto-seeded admin password | `SecurePassword123!` | `backend/.env` |
| `GROQ_API_KEY` | Required | Backend | Groq LLM API authorization | `gsk_...` | `backend/.env` |
| `GROQ_MODEL` | Optional | Backend | Model identifier | `llama-3.3-70b-versatile` | `backend/.env` |
| `GITHUB_TOKEN` | Recommended | Backend | GitHub API token (avoids 60/hr limit) | `ghp_...` | `backend/.env` |
| `GOOGLE_CLIENT_ID` | Optional | Backend | Candidate Google login OAuth ID | `...apps.googleusercontent.com` | `backend/.env` |
| `GOOGLE_CLIENT_SECRET` | Optional | Backend | Candidate Google login secret | `GOCSPX-...` | `backend/.env` |
| `GOOGLE_CALENDAR_CLIENT_ID`| Optional | Backend | Admin Calendar OAuth Client ID | `...apps.googleusercontent.com` | `backend/.env` |
| `GOOGLE_CALENDAR_CLIENT_SECRET`| Optional | Backend | Admin Calendar OAuth Client Secret| `GOCSPX-...` | `backend/.env` |
| `GOOGLE_TOKEN_ENCRYPTION_KEY`| Optional | Backend | AES-256-GCM 32-byte base64 key | `openssl rand -base64 32` | `backend/.env` |
| `BOT_CONTROL_API_SECRET` | Required | Backend / Worker | Master shared worker token | High-entropy random hex | `backend/.env`, `meeting-bot/.env` |
| `BOT_CONTROL_API_URL` | Required | Meeting Bot | Central worker control URL | `http://localhost:5000/api/bot-control` | `meeting-bot/.env` |
| `DEEPGRAM_API_KEY` | Required | Meeting Bot / Backend | Real-time speech transcription | Token string | `meeting-bot/.env`, `backend/.env` |
| `GOOGLE_MEET_BOT_EMAIL` | Required | Meeting Bot / Backend | Bot Google account identifier | `ombhondve32@gmail.com` | `backend/.env`, `meeting-bot/.env` |
| `AUDIO_CAPTURE_DEVICE` | Required (Win) | Meeting Bot | WASAPI loopback capture target | `Speaker (2- Realtek(R) Audio)` | `meeting-bot/.env` |
| `KOKORO_OUTPUT_DEVICE` | Required (Win) | Meeting Bot | TTS sounddevice target | `CABLE Input (VB-Audio Virtual Cable)` | `meeting-bot/.env` |
| `MEET_MIC_DEVICE` | Required (Win) | Meeting Bot | Google Meet mic target | `CABLE Output (VB-Audio Virtual Cable)` | `meeting-bot/.env` |
| `CLOUDINARY_CLOUD_NAME` | Optional | Backend | Cloud media bucket | Cloud name | `backend/.env` |
| `CLOUDINARY_API_KEY` | Optional | Backend | Cloudinary API key | Key string | `backend/.env` |
| `CLOUDINARY_API_SECRET` | Optional | Backend | Cloudinary API secret | Secret string | `backend/.env` |

---

## 8. Database & Backend Requirements

### Database Technology & Connection Architecture
- **Database:** MongoDB 6.0+ (Local Community Server or MongoDB Atlas).
- **Driver:** Mongoose 8.18.1 with connection pooling (`maxPoolSize: 10`, `serverSelectionTimeoutMS: 8000`).
- **Connection Logic:** Implemented in `backend/src/config/database.js` with singleton promise caching to prevent socket leakage in serverless/hot-reload environments.

### Schema & Index Management
- **Migration Strategy:** The project does **not use SQL migrations**. Collections, unique indexes, and TTL indexes are declared directly in Mongoose schemas:
  - `Admin`: Unique index on `email`.
  - `Candidate`: Compound indexes on `email` and verification tokens.
  - `AiInterview`: Indexed on `scheduledAt`, `status`, `candidateId`, and `botJobId`.
  - `BotJob`: Indexed on `status`, `leaseExpiresAt`, `workerId`, and `scheduledAt`.
  - `GoogleCalendarOAuthState`: TTL index for auto-expiring OAuth flow tokens.
- **Initial Data Seeding:**
  - Auto-seeding runs at startup in `backend/src/server.js` using `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD`.
  - Manual provisioning script: `node scripts/createAdmin.js <email> <password> <name> <role>`.

---

## 9. Windows Step-by-Step Setup & Run Guide

### Step 1: System Prerequisites
1. **Node.js:** Ensure Node.js 18+ or 20+ is installed (Node v24 is installed on this machine).
2. **Python:** Python 3.11.6 is already installed in `d:\ai_interview_system\meeting-bot\.venv`.
3. **Google Chrome:** Installed at `C:\Program Files\Google\Chrome\Application\chrome.exe`.
4. **VB-Audio Virtual Cable:** Installed on this workstation (`CABLE Input` and `CABLE Output` verified).

### Step 2: Clean Dependency Installation
Run these commands in PowerShell from the project root:

```powershell
# 1. Install Backend Dependencies
cd d:\ai_interview_system\backend
npm install

# 2. Install Frontend Dependencies
cd d:\ai_interview_system\frontend
npm install
```

### Step 3: Configure Environment Files
1. In `backend/.env`, ensure:
   - `STORAGE_MONGODB_URI` points to a running MongoDB instance (or Atlas cluster).
   - `GROQ_API_KEY` is set with a valid key from console.groq.com.
   - `GROQ_MODEL=llama-3.3-70b-versatile` (or `llama3-70b-8192`).
   - `BOT_CONTROL_API_SECRET` is set to a secret passphrase.
   - `DEEPGRAM_API_KEY` is configured.
2. In `frontend/.env.local`, ensure:
   - `NEXT_PUBLIC_BACKEND_URL=http://localhost:5000`
3. In `meeting-bot/.env`, ensure:
   - `BOT_CONTROL_API_SECRET` matches the backend secret.
   - `DEEPGRAM_API_KEY` matches the backend Deepgram key.
   - `AUDIO_CAPTURE_DEVICE=Speaker (2- Realtek(R) Audio)`
   - `KOKORO_OUTPUT_DEVICE=CABLE Input (VB-Audio Virtual Cable)`
   - `MEET_MIC_DEVICE=CABLE Output (VB-Audio Virtual Cable)`

### Step 4: One-Time Bot Google Account Login
Authenticate the bot's Google account so it can join meetings without prompts:

```powershell
cd d:\ai_interview_system\meeting-bot
.\.venv\Scripts\python.exe -m app.main --auth-setup
```
*A Chrome window opens. Sign in with the dedicated bot Google account (`ombhondve32@gmail.com`). Once signed in, close the browser window.*

### Step 5: Application Startup (Run in 3 Separate Terminals)

**Terminal 1 — Backend API Server:**
```powershell
cd d:\ai_interview_system\backend
node src/server.js
# Verified output: "✅ Server running on port 5000" and "✅ MongoDB connected successfully"
```

**Terminal 2 — Frontend Application:**
```powershell
cd d:\ai_interview_system\frontend
npm run dev
# Verified output: "- ready started server on 0.0.0.0:3000, url: http://localhost:3000"
```

**Terminal 3 — Background Meeting Bot Worker Daemon:**
```powershell
cd d:\ai_interview_system\meeting-bot
.\.venv\Scripts\python.exe -m app.worker
# Verified output: "[Worker] Registered worker worker-node-01 successfully. Starting polling loop (every 10s)..."
```

---

## 10. Production Deployment Checklist & Serverless Constraints

| Layer | Recommended Hosting | Compatible with Vercel Serverless? | Reason & Critical Requirements |
|---|---|---|---|
| **Frontend** | Vercel / Cloudflare Pages / AWS Amplify | **Yes (100% Compatible)** | Standard Next.js 14 SSR/SSG. Configure `NEXT_PUBLIC_BACKEND_URL` in environment settings. |
| **Backend API** | Render / Railway / AWS ECS / DigitalOcean | **Partial (Not Recommended on Serverless)** | While `backend/api/index.js` exists for Vercel, serverless lambdas **kill background `setInterval` schedulers** (`syncInterviewLifecycles`), drop websocket/long connections, and have a 60s timeout. A persistent Node.js container is required for reliable job dispatching. |
| **Meeting Bot Worker** | Dedicated Windows VM / AWS EC2 / Azure VM | **NO (Strictly Incompatible)** | Requires Chromium browser automation, WASAPI loopback audio, VB-Audio driver, and continuous meeting sessions of 15–30 minutes. Cannot run in serverless functions. |
| **Database** | MongoDB Atlas (M0 Free / Dedicated) | **Yes (100% Compatible)** | Use TLS connection string with IP access whitelist enabled. |

---

## 11. Cost & Free-Tier Feasibility Analysis

| Service / Tool | Current Application Role | Free-Tier Feasibility | Paid Threshold & Pricing | Practical Low-Cost Setup |
|---|---|---|---|---|
| **Groq Cloud** | Project generation, dynamic interview questions, answer evaluation | **100% Usable Free Tier** (No credit card strictly required initially) | Free tier: 30 requests/min, 14,400 requests/day. Paid tier is token-based ($0.05 - $0.59 / 1M tokens). | Keep on free tier; use `llama-3.3-70b-versatile` or `llama-3.1-8b-instant`. |
| **Deepgram** | Audio transcription (Nova-2) | **$200 Free Credit on Signup** | $0.0043 / audio minute (~$0.06 per 15-min interview). | 1 credit covers ~45,000 minutes (~3,000 interviews). |
| **Kokoro TTS** | Voice synthesis for interviewer | **Permanently 100% Free** | Runs locally on CPU/GPU via PyTorch. 0 cloud cost. | Uses 0 API tokens; no external subscriptions. |
| **MongoDB Atlas** | Data persistence | **Permanently Free (Shared M0)** | 512 MB storage, shared RAM. Paid from $9/mo (M2/M5). | Shared M0 easily supports thousands of interview records. |
| **Google Cloud Console** | Google Calendar & OAuth 2.0 | **Permanently Free** | Calendar and Sign-In API quotas are free for standard operational volumes. | Free tier covers all normal usage. |
| **Cloudinary** | PDF brief & media storage | **Permanently Free Tier** | 25 monthly credits (~25,000 transformations or 25 GB storage). | Ample for project PDFs. |
| **VB-Audio Virtual Cable**| Windows audio loopback routing | **Free (Donationware)** | Single virtual cable is completely free for individual/personal use. | Installed on machine. |

**Total Estimated Monthly Cost for Development & Small Scale:** **$0.00 / month.**

---

## 12. Security & Reliability Findings

1. **Missing Production JWT Secret Check in Worker:**
   - `Settings.meeting_bot_api_secret` defaults to `"recruitai-default-bot-secret"` if omitted in `meeting-bot/.env`. In production, this default must be rejected to prevent unauthorized workers from intercepting interviews.
2. **CORS Regex Matching:**
   - In `backend/src/app.js`, CORS allows `/\.vercel\.app$/`. This permits any Vercel deployment (including arbitrary third-party Vercel accounts) to send requests if credentials are used carelessly. In production, lock this down to explicit domains.
3. **Session Store In-Memory Leak:**
   - Express session currently uses default MemoryStore. MemoryStore is not meant for production (it leaks memory and drops user sessions on restart). Connect `connect-mongo` to store Express sessions in MongoDB.
4. **Rate Limiting & Lease Protection:**
   - Distributed bot claiming in `botControl.service.js` uses atomic `$set` operations and lease timestamps (`leaseExpiresAt`), which successfully prevents race conditions and double-assignment of interviews to multiple workers.
5. **No Secret Leakage in Logs:**
   - Verified that `logger.js`, `recruitai_client.py`, and `worker.py` sanitize tokens and mask URLs (`mask_meet_url`). Real secrets are not printed to logs.

---

## 13. Verification Results & Unresolved Uncertainties

| Item Checked | Verification Method | Status | Notes |
|---|---|---|---|
| Node.js Runtime | Safe command (`node -v`) | **Confirmed (v24.20.0)** | Node 24 is installed. Requires removing `canvas` from dependencies to build smoothly. |
| Python Environment | Safe command (`.\.venv\Scripts\python.exe --version`) | **Confirmed (Python 3.11.6)** | Virtualenv has all 12 bot dependencies pre-installed. |
| Audio Hardware & Drivers | Safe script (`sounddevice.query_devices()`) | **Confirmed** | Realtek speaker and VB-Audio Virtual Cable (`CABLE Input`/`CABLE Output`) are detected. |
| Google Chrome | Safe check (`Test-Path`) | **Confirmed** | Chrome exists at `C:\Program Files\Google\Chrome\Application\chrome.exe`. |
| Meeting Bot Unit Tests | Pytest execution (`pytest tests -q`) | **Confirmed (134 Passed)** | All 134 unit and integration mock tests passed in 14.38 seconds. |
| Frontend Configuration | Safe script (`node scripts/validate-env.mjs`) | **Confirmed Passed** | Zero secret leaks; valid URLs. |
| Active MongoDB Connection | Static inspection | **Requires Local Setup** | Local or Atlas URI must be provided before backend startup. |
| Bot Chrome Login Session | Inspection of `bot-profile/` | **Requires One-Time Setup** | Must run `python -m app.main --auth-setup` to save Google account credentials. |

---

## 14. Prioritized Remediation Plan

1. **Priority 1: Fix `backend/package.json` Dependencies**
   - Add `"@babel/parser": "^7.26.0"` to `dependencies`.
   - Remove `"canvas": "^3.2.3"` and `"pdf-parse": "^2.4.5"`.
2. **Priority 2: Install Node Modules**
   - Run `npm install` in `backend/`.
   - Run `npm install` in `frontend/`.
3. **Priority 3: Configure Database & Groq Model**
   - Set valid `STORAGE_MONGODB_URI` in `backend/.env`.
   - Verify `GROQ_MODEL=llama-3.3-70b-versatile` in `backend/.env`.
4. **Priority 4: Complete One-Time Bot Google Sign-In**
   - Execute `.\meeting-bot\.venv\Scripts\python.exe -m app.main --auth-setup` and sign in to Google.
5. **Priority 5: Production Architecture Hardening**
   - Wire `connect-mongo` into `backend/src/app.js` for persistent sessions.
   - Deploy backend to a long-running container service (Render, Railway, or EC2) rather than serverless functions.

---

## 15. Final Checklist to Run a Complete AI Interview

- [ ] Node.js v18+ or v20+ available.
- [ ] `backend/node_modules` installed without native build errors.
- [ ] `frontend/node_modules` installed cleanly.
- [ ] Python 3.11 virtual environment in `meeting-bot/.venv` verified.
- [ ] VB-Audio Virtual Cable driver installed and visible in Windows Sound Settings.
- [ ] MongoDB Atlas cluster or local MongoDB instance running and accessible.
- [ ] Groq Cloud API key entered in `backend/.env`.
- [ ] Deepgram API key entered in `backend/.env` and `meeting-bot/.env`.
- [ ] `BOT_CONTROL_API_SECRET` matching in `backend/.env` and `meeting-bot/.env`.
- [ ] Bot Google Account signed in via `python -m app.main --auth-setup`.
- [ ] Backend server running (`node src/server.js`) on port 5000.
- [ ] Frontend running (`npm run dev`) on port 3000.
- [ ] Meeting Bot worker running (`python -m app.worker`).
- [ ] Test interview scheduled from frontend admin panel; worker claims job and joins Google Meet call.
