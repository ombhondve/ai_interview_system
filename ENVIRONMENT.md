# RecruitAI — Complete Environment Configuration Guide

This document is the authoritative environment and configuration reference for the entire **RecruitAI** ecosystem, encompassing the **Next.js frontend**, the **Node.js/Express backend**, the **Python Google Meet interview bot**, and all actively supported integrations.

---

## 1. Architecture & Service Boundaries

RecruitAI separates concerns across three autonomous services, each with its own dedicated environment configuration:

```
recruitai/
├── frontend/             --> Next.js 14 App Router (Client Portal & Admin UI)
│   ├── .env.example      --> Frontend template (Browser-safe & Next.js server)
│   └── scripts/validate-env.mjs
├── backend/              --> Node.js / Express 5 REST API (Auth, AI, DB, Scheduling)
│   ├── .env.example      --> Complete local backend template
│   ├── .env.production.example --> Production backend template
│   ├── scripts/createAdmin.js  --> Secure admin provisioning CLI
│   └── scripts/validate-env.js
└── meeting-bot/          --> Python Autonomous Google Meet Worker (Playwright, Kokoro, Deepgram)
    ├── .env.example      --> Meeting bot worker template
    └── validate_env.py
```

### Critical Security Isolation Rules
1. **Frontend Isolation:** Client bundles in `frontend` NEVER receive database URIs, JWT secrets, bot control secrets, OAuth client secrets, or private API keys. Only variables prefixed with `NEXT_PUBLIC_` are exposed to browsers.
2. **Backend Authority:** All database persistence, Groq LLM queries, candidate evaluation, Google Calendar sync, and token encryption execute strictly server-side in `backend`.
3. **Bot Worker Perimeter:** The `meeting-bot` connects to the central backend over **outbound HTTPS only** using a shared cryptographic master secret (`BOT_CONTROL_API_SECRET`). The bot does not expose open inbound ports to the internet and uses local Kokoro TTS rather than cloud TTS.
4. **No Inactive Dependencies:** Unused or unintegrated third-party variables (such as ElevenLabs, Twilio SMS, WhatsApp, or Jalpi) are not active requirements and are excluded from core operational templates.

---

## 2. Master Environment Variable Inventory

Every active variable verified against actual repository code is cataloged below:

| Variable Name | Owning Service | Purpose | Required / Optional | Expected Format | Sensitive? | Default / Fallback |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_BACKEND_URL` | Frontend | Public backend URL called by client fetch & rewrites | **Required** (prod) | Absolute URL (`http(s)://...`) | No | `https://ai-interview-system-eewl.vercel.app` |
| `BACKEND_URL` | Frontend | Server-side rewrite target for Next.js proxy | Optional | Absolute URL | No | `process.env.NEXT_PUBLIC_BACKEND_URL` |
| `NEXT_PUBLIC_API_URL` | Frontend | Optional public API override for project preview modal | Optional | Absolute URL | No | `http://localhost:5000` |
| `JWT_SECRET` | Frontend / Backend | Secret for signing & verifying JWT authentication tokens | **Required** (prod) | String (>= 32 chars) | **YES** | Dev fallback (dev only) |
| `PORT` | Backend | Port for Express server listener | Optional | Integer (1–65535) | No | `5000` |
| `NODE_ENV` | Backend | Runtime mode (`development`, `production`, `test`) | **Required** (prod) | Enum string | No | `development` |
| `FRONTEND_URL` | Backend | Permitted CORS origin for cross-site cookie credentials | **Required** | Absolute URL | No | `http://localhost:3000` |
| `STORAGE_MONGODB_URI` | Backend | MongoDB database connection URI | **Required** | `mongodb://` or `mongodb+srv://` | **YES** | None (Startup halts if missing) |
| `MONGODB_URI` | Backend | Supported fallback alias for MongoDB connection URI | Optional | `mongodb://` or `mongodb+srv://` | **YES** | Fallback for `STORAGE_MONGODB_URI` |
| `ADMIN_JWT_SECRET` | Backend | Optional dedicated signing key for admin JWTs | Optional | String (>= 32 chars) | **YES** | Falls back to `JWT_SECRET` |
| `DEMO_ADMIN_EMAIL` | Backend | Initial administrator seed account email (dev only) | Optional (dev) | Email address | No | `admin@recruitai.com` |
| `DEMO_ADMIN_PASSWORD` | Backend | Initial administrator seed account password (dev only) | Optional (dev) | Plaintext string (hashed via bcrypt) | **YES** | None |
| `DEMO_ADMIN_NAME` | Backend | Seed administrator display name (dev only) | Optional (dev) | String | No | `System Administrator` |
| `DEMO_ADMIN_ROLE` | Backend | Seed administrator role (`superadmin` or `recruiter`) | Optional (dev) | Enum string | No | `superadmin` |
| `GROQ_API_KEY` | Backend | Groq Cloud API key for AI generation & code verification | **Required** (AI) | String (`gsk_...`) | **YES** | None |
| `GROQ_MODEL` | Backend | Groq LLM model name | Optional | String | No | `llama3-70b-8192` |
| `AI_VERIFICATION_MAX_INPUT_TOKENS` | Backend | Token ceiling for code repository analysis | Optional | Positive integer | No | `8000` |
| `GITHUB_TOKEN` | Backend | Fine-grained GitHub PAT to prevent 60 req/hr IP rate limit | **Recommended** | String (`github_pat_...` or `ghp_...`) | **YES** | None |
| `GITHUB_API_TIMEOUT_MS` | Backend | GitHub API request timeout in milliseconds | Optional | Integer | No | `10000` |
| `GITHUB_API_MAX_RETRIES` | Backend | GitHub API retry count | Optional | Integer | No | `3` |
| `GOOGLE_CLIENT_ID` | Backend | Google OAuth 2.0 Client ID for Student Sign-In | Optional | String (`...apps.googleusercontent.com`) | No | None |
| `GOOGLE_CLIENT_SECRET` | Backend | Google OAuth 2.0 Client Secret for Student Sign-In | Optional | String | **YES** | None |
| `GOOGLE_CALLBACK_URL` | Backend | Redirect URI for Student Google Sign-In | Optional | Absolute URL | No | `https://ai-interview-system-eewl.vercel.app/api/auth/google/callback` |
| `GOOGLE_CALENDAR_CLIENT_ID` | Backend | Google OAuth 2.0 Client ID for Recruiter Calendar | Optional | String (`...apps.googleusercontent.com`) | No | None |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Backend | Google OAuth 2.0 Client Secret for Recruiter Calendar | Optional | String | **YES** | None |
| `GOOGLE_CALENDAR_CALLBACK_URL` | Backend | OAuth Callback URL for Recruiter Calendar connection | Optional | Absolute URL | No | `${BACKEND_URL}/api/admin/google-calendar/callback` |
| `GOOGLE_CALENDAR_CALENDAR_ID` | Backend | Target calendar ID for interview bookings | Optional | String | No | `primary` |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | Backend | 32-byte Base64 key for AES-256-GCM token encryption | **Required** (Cal) | 32-byte Base64 string | **YES** | Derived SHA-256 fallback |
| `GOOGLE_MEET_BOT_EMAIL` | Backend / Bot | Dedicated Google Account email for the Meeting Bot | **Required** (Meet) | Email address | No | None |
| `BOT_CONTROL_API_SECRET` | Backend / Bot | Master shared secret for worker registration & leasing | **Required** (Bot) | String (>= 32 chars) | **YES** | `recruitai-default-bot-secret` (dev) |
| `BOT_CONTROL_API_URL` | Bot | Full URL to central backend bot control endpoint | **Required** (Bot) | Absolute URL (`/api/bot-control`) | No | `${RECRUITAI_API_URL}/api/bot-control` |
| `BOT_WORKER_ID` | Bot | Unique identifier for the distributed worker instance | Optional | String | No | `worker-<hostname>-<pid>` |
| `BOT_WORKER_POLL_SECONDS` | Backend / Bot | Frequency in seconds to poll for scheduled interviews | Optional | Positive integer | No | `10` |
| `BOT_WORKER_HEARTBEAT_SECONDS` | Backend / Bot | Worker heartbeat interval in seconds | Optional | Positive integer | No | `20` |
| `BOT_JOB_LEASE_MS` | Backend / Bot | Lease lock duration in ms for interview jobs | Optional | Positive integer | No | `120000` (2 minutes) |
| `BOT_WORKER_STALE_MS` | Backend | Inactivity threshold in ms before worker is deemed dead | Optional | Positive integer | No | `90000` (90 seconds) |
| `BOT_PREPARATION_WINDOW_MS` | Backend | Lead time in ms before interview when job is claimable | Optional | Positive integer | No | `900000` (15 minutes) |
| `MEETING_BOT_PORT` | Bot | Local port for FastAPI worker diagnostic server | Optional | Integer | No | `8001` |
| `MEETING_BOT_HOST` | Bot | Bind address for FastAPI worker diagnostic server | Optional | IP address | No | `127.0.0.1` |
| `MEETING_BOT_HEADLESS` | Bot | Playwright headless browser mode (`true` or `false`) | Optional | Boolean string | No | `false` |
| `MEETING_BOT_PROFILE_DIR` | Bot | Directory path for persistent Chromium Google session | Optional | Filesystem path | No | `./bot-profile` |
| `DEEPGRAM_API_KEY` | Backend / Bot | Deepgram API key for speech recognition (STT) | **Required** (STT) | String | **YES** | None |
| `DEEPGRAM_MODEL` | Backend / Bot | Deepgram transcription model | Optional | String | No | `nova-2` |
| `KOKORO_ENABLED` | Bot | Flag to enable local Kokoro neural text-to-speech | Optional | Boolean string | No | `true` |
| `KOKORO_LANG_CODE` | Bot | Kokoro language code (`a` = American English) | Optional | Single char string | No | `a` |
| `KOKORO_VOICE` | Bot | Kokoro voice model weight identifier | Optional | String | No | `af_heart` |
| `KOKORO_OUTPUT_DEVICE` | Bot | Audio device routing Kokoro audio into Meet mic | Optional | System audio device name | No | `CABLE Input (VB-Audio Virtual Cable)` |
| `KOKORO_SAMPLE_RATE` | Bot | Output audio sample rate in Hz | Optional | Integer | No | `48000` |
| `AUDIO_CAPTURE_DEVICE` | Bot | WASAPI loopback device capturing Google Meet audio | Optional | System audio device name | No | `Speaker (2- Realtek(R) Audio)` |
| `AUDIO_SAMPLE_RATE` | Bot | Audio capture sample rate in Hz | Optional | Integer | No | `16000` |
| `AUDIO_CHANNELS` | Bot | Audio capture channel count (1 = mono) | Optional | Integer | No | `1` |
| `MEET_MIC_DEVICE` | Bot | Microphone device selected in Google Meet browser UI | Optional | Audio device name | No | `CABLE Output (VB-Audio Virtual Cable)` |
| `MEET_SPEAKER_DEVICE` | Bot | Speaker device selected in Google Meet browser UI | Optional | Audio device name | No | `CABLE Input (VB-Audio Virtual Cable)` |
| `AUDIO_SPEECH_START_RMS` | Bot | Energy threshold to detect candidate speech start | Optional | Float | No | `0.012` |
| `AUDIO_SILENCE_RMS` | Bot | Energy threshold for background silence | Optional | Float | No | `0.007` |
| `AUDIO_SILENCE_DURATION_SEC`| Bot | Silence duration in seconds triggering end-of-speech | Optional | Float | No | `1.6` |
| `AUDIO_MIN_SPEECH_DURATION_SEC` | Bot | Minimum speech duration in seconds to filter clicks | Optional | Float | No | `0.4` |
| `AUDIO_MAX_UTTERANCE_SEC` | Bot | Maximum continuous speech duration before cut | Optional | Float | No | `90.0` |
| `AUDIO_PRE_ROLL_SEC` | Bot | Audio buffer preserved before speech onset in seconds | Optional | Float | No | `0.5` |
| `CLOUDINARY_CLOUD_NAME` | Backend | Cloudinary cloud account name | **Required** (PDFs) | String | No | None |
| `CLOUDINARY_API_KEY` | Backend | Cloudinary API access key | **Required** (PDFs) | String | **YES** | None |
| `CLOUDINARY_API_SECRET` | Backend | Cloudinary API access secret | **Required** (PDFs) | String | **YES** | None |
| `SMTP_HOST` | Backend | Outgoing mail server host for optional email OTP | Optional | Hostname | No | `smtp.gmail.com` |
| `SMTP_PORT` | Backend | Outgoing mail server port | Optional | Integer (`587` or `465`) | No | `587` |
| `SMTP_USER` | Backend | Outgoing mail username/email address | Optional | Email address | No | None |
| `SMTP_PASSWORD` | Backend | Outgoing mail app-specific password | Optional | String | **YES** | None |
| `SMTP_FROM` | Backend | Sender email address on outgoing messages | Optional | Email address | No | None |
| `LOG_LEVEL` | Backend / Bot | Logging verbosity (`DEBUG`, `INFO`, `WARN`, `ERROR`) | Optional | Enum string | No | `INFO` |

---

## 3. Active vs. Removed Integrations Audit

### 3.1. ElevenLabs (Removed from Active Requirements)
- **Status:** **REMOVED from active requirements and templates.**
- **Rationale:** The primary interview agent in RecruitAI is the Python Google Meet `meeting-bot`. The meeting bot explicitly uses **Kokoro Local TTS** (`app/kokoro_tts.py`) running entirely offline on CPU/GPU. The test suite (`tests/test_recruitai_client.py`) confirms that ElevenLabs is not imported or invoked by the bot. In `backend`, voice synthesis is optional and falls back gracefully to in-browser TTS if absent. ElevenLabs variables (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID`) are removed from active production templates.

### 3.2. Kokoro (Active Local Neural TTS)
- **Status:** **ACTIVE.**
- **Rationale:** Kokoro is the intended local neural speech engine for the meeting bot. It runs locally using the `kokoro>=0.8.4` Python package.
- **Key Advantage:** **NO API key or paid subscription is required.** Model weights are downloaded automatically on first run and cached in `~/.cache/huggingface`.

### 3.3. WhatsApp / Jalpi (Removed from Active Requirements)
- **Status:** **REMOVED from active requirements and templates.**
- **Rationale:** RecruitAI is a web application with Next.js candidate portals and Google Meet video interviews. WhatsApp/Jalpi was an auxiliary webhook receiver and is not part of the active web/bot recruitment pipeline. `WHATSAPP_VERIFY_TOKEN` and `JALPI_API_KEY` have been stripped from active templates and validation checks.

### 3.4. Twilio SMS (Removed from Active Requirements)
- **Status:** **REMOVED from active requirements and templates.**
- **Rationale:** Candidate verification in the web portal uses Google Sign-In or email OTP delivery via SMTP. Twilio SMS is an optional delivery channel and is not an active requirement.

---

## 4. Controlled Production Admin Provisioning

In development, setting `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD` allows quick local testing. However, hardcoding demo credentials in production is a severe security risk.

### Production Security Enforcement
1. **Fallback Login Disabled:** The in-memory credential check in `backend/src/modules/auth/auth.controller.js` is strictly guarded by `if (!isProduction)`. In production, the system only authenticates against hashed credentials in the MongoDB `Admin` collection.
2. **Auto-Seed Guarded:** In `backend/src/server.js`, `initializeDefaultAdmin()` does NOT automatically seed accounts in production unless `ALLOW_PRODUCTION_ADMIN_SEED=true` is explicitly provided.
3. **Controlled Provisioning CLI:** To safely create or update an administrator in production, run the CLI tool:
   ```bash
   cd backend
   node scripts/createAdmin.js <email> <password> [name] [role]
   ```
   *Example:*
   ```bash
   node scripts/createAdmin.js admin@mycompany.com SuperSecurePassword123! "Lead Admin" superadmin
   ```
   *This securely hashes the password with bcrypt (12 rounds) directly into MongoDB without exposing credentials in environment variables or logs.*

---

## 5. Local Development Setup Guide

### Step 1: Frontend Setup
```bash
cd frontend
cp .env.example .env.local
npm run validate-env
npm run dev
```

### Step 2: Backend Setup
```bash
cd backend
cp .env.example .env
npm run validate-env
npm run dev
```

### Step 3: Meeting Bot Setup
```bash
cd meeting-bot
# Create virtual environment
python -m venv .venv
.\.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # Linux

pip install -r requirements.txt
playwright install chromium

cp .env.example .env
python validate_env.py
```

---

## 6. Safe Validation Procedures

Run the built-in non-destructive validation tools at any time to verify configuration without leaking secrets or incurring API costs:

```bash
# 1. Validate Frontend Configuration & Check for Public Leaks
cd frontend && npm run validate-env

# 2. Validate Backend Configuration & Test Active Schemas
cd backend && npm run validate-env

# 3. Validate Meeting Bot Audio & Worker Settings
cd meeting-bot && python validate_env.py
```
