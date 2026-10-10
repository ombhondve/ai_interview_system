# Distributed RecruitAI Meeting Bot Management System

## 1. Architecture Overview

RecruitAI uses a distributed, secure, decoupled architecture for managing interview meeting bots across multiple independent remote servers:

```
┌─────────────────────────────────┐
│     Next.js Web Frontend        │ (Vercel / Cloud)
└────────────────┬────────────────┘
                 │ HTTPS
                 ▼
┌─────────────────────────────────┐
│     RecruitAI Central Backend   │ (Node.js/Express)
│   • Worker Registry & Health    │
│   • Persistent MongoDB Job Queue│
│   • Expiring Leases & Recovery  │
│   • Admin Control & Audit Logs  │
└────────────────┬────────────────┘
                 │
                 │ Outbound HTTPS Only (No Inbound Ports on Workers)
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│ Worker 1     │    │ Worker 2     │
│ (Windows)    │    │ (Linux)      │
│ Python Bot   │    │ Python Bot   │
└──────────────┘    └──────────────┘
```

### Key Principles
1. **Zero Inbound Ports on Worker**: Workers initiate outbound HTTPS requests only. No SSH, VNC, RDP, or remote shell execution is exposed or required.
2. **Atomic MongoDB Claiming**: Prevents double-assignment through `findOneAndUpdate` with lease expiration guards.
3. **Expiring Leases & Heartbeats**: If a worker machine reboots or crashes, its lease expires (`BOT_JOB_LEASE_MS`) and the job is automatically re-queued for recovery.
4. **Authoritative State Verification**: An exit code of `0` from the Python process does **not** mark an interview as completed. The central backend verifies the authoritative MongoDB interview record status (`COMPLETED`, `COMPLETING`, `ANALYSIS_PENDING`, `ANALYZED`, or `CANDIDATE_NO_SHOW`).
5. **Admin Controls**: Authorized administrators can inspect worker health, pause/enable workers, inspect job history, and trigger retries on failed jobs.

---

## 2. API Endpoints

All endpoints are mounted under `/api/bot-control`:

### Worker Endpoints (Outbound from Python Agent)
- `POST /api/bot-control/worker/register`: Registers worker ID, hostname, platform, version using `BOT_CONTROL_API_SECRET`. Exchanges bootstrap secret for a scoped worker session token.
- `POST /api/bot-control/worker/heartbeat`: Periodic health heartbeat (`IDLE`, `BUSY`, `PAUSED`). Receives admin pause updates.
- `GET /api/bot-control/worker/claim?workerId=<ID>`: Atomically claims the next eligible scheduled interview job.
- `POST /api/bot-control/worker/claim`: Alternative POST method for job claim.
- `POST /api/bot-control/worker/jobs/:jobId/heartbeat`: Renews execution lease while meeting is in progress.
- `POST /api/bot-control/worker/jobs/:jobId/complete`: Reports subprocess exit. Backend verifies MongoDB state.
- `POST /api/bot-control/worker/jobs/:jobId/fail`: Reports errors safely (sanitized, no secrets).

### Administrator Endpoints (Cookie or Bearer JWT)
- `GET /api/bot-control/admin/status`: Returns all workers with dynamic online/offline status, idle/busy/paused counts, and job queue metrics.
- `PATCH /api/bot-control/admin/workers/:workerId`: Enables or pauses a worker (`{ "enabled": false }`).
- `GET /api/bot-control/admin/jobs`: Lists interview execution jobs with pagination (`page`, `limit`, `status`, `workerId`).
- `POST /api/bot-control/admin/jobs/:jobId/retry`: Retries an eligible failed job (resets status to `QUEUED`).

---

## 3. Database Schema

### `BotWorker` Model
- `workerId`: Unique string identifier (e.g. `worker-win-01`).
- `tokenHash`: SHA-256 hash of active session token.
- `hostname`, `platform`, `version`: Host platform metadata.
- `status`: `"IDLE" | "BUSY" | "PAUSED" | "OFFLINE"`.
- `enabled`: Boolean (administrator control).
- `lastHeartbeatAt`: Heartbeat timestamp for dynamic online calculation.
- `currentJobId`: Active `BotJob` reference.
- `currentInterviewId`: Active `AiInterviewSession` reference.
- `lastError`: Sanitized error payload.

### `BotJob` Model
- `interviewId`: Authoritative `AiInterviewSession` reference.
- `candidateId`: Candidate reference.
- `bookingId`: `InterviewBooking` reference.
- `meetLink`: Strict Google Meet URL (`https://meet.google.com/xxx-yyyy-zzz`).
- `scheduledAt`: Scheduled start time.
- `status`: `"QUEUED" | "CLAIMED" | "RUNNING" | "COMPLETED" | "FAILED"`.
- `assignedWorkerId`: Worker holding the lease.
- `leaseExpiresAt`: Expiration timestamp for lease.
- `attemptCount`: Current execution attempt (bounded by `maxAttempts`).
- `needsAdminReview`: Flagged if process exits unexpectedly during an active interview.
- `executionHistory`: Persistent audit array of worker attempts and outcomes.

### `BotAuditLog` Model
- `action`: Audit event (`WORKER_REGISTERED`, `WORKER_PAUSED`, `JOB_CLAIMED`, `JOB_COMPLETED`, `JOB_RETRIED`, etc.).
- `performedBy`: Administrator ID, Worker ID, or `"SYSTEM"`.
- `details`: Metadata changes and timestamps.

---

## 4. Environment Variables

### Central Backend Configuration (`backend/.env`)
```bash
# Cryptographically random master secret (shared with worker nodes)
BOT_CONTROL_API_SECRET=your_high_entropy_master_secret_here

# Timeout after which a silent worker is computed as OFFLINE (default: 90000ms = 90s)
BOT_WORKER_STALE_MS=90000

# Job execution lease duration (default: 120000ms = 2m)
BOT_JOB_LEASE_MS=120000

# Maximum automatic retry attempts before marking needsAdminReview (default: 3)
BOT_JOB_MAX_ATTEMPTS=3

# Advance preparation window before scheduled interview start time (default: 900000ms = 15m)
BOT_PREPARATION_WINDOW_MS=900000
```

### Remote Worker Configuration (`meeting-bot/.env`)
```bash
# Central backend API URL (outbound connection)
BOT_CONTROL_API_URL=https://api.yourdomain.com/api/bot-control

# Must match BOT_CONTROL_API_SECRET on central backend
BOT_CONTROL_API_SECRET=your_high_entropy_master_secret_here

# Unique worker identifier for this machine
BOT_WORKER_ID=worker-win-01

# Polling interval when idle (seconds)
BOT_WORKER_POLL_SECONDS=10

# Heartbeat interval (seconds)
BOT_WORKER_HEARTBEAT_SECONDS=20

# Expected lease duration in milliseconds
BOT_JOB_LEASE_MS=120000

# Audio & Bot Profile Configuration
DEEPGRAM_API_KEY=your_deepgram_api_key_here
KOKORO_ENABLED=true
MEETING_BOT_PROFILE_DIR=./bot-profile
AUDIO_CAPTURE_DEVICE=CABLE Input (VB-Audio Virtual Cable)
KOKORO_OUTPUT_DEVICE=CABLE Input (VB-Audio Virtual Cable)
MEET_MIC_DEVICE=CABLE Output (VB-Audio Virtual Cable)
MEET_SPEAKER_DEVICE=CABLE Input (VB-Audio Virtual Cable)
```

---

## 5. Worker Deployment Guide

### Windows Worker Setup (Full Audio & Kokoro Support)
1. **Clone repository and setup Python virtual environment**:
   ```powershell
   cd d:\ai_interview_system\meeting-bot
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   playwright install chromium
   ```
2. **Install Audio Routing Tools**:
   - Install **VB-Audio Virtual Cable** (provides `CABLE Input` and `CABLE Output`).
   - Configure Windows default audio output to your physical speakers or headphones so system sounds do not loop into the bot.
3. **Configure Environment**:
   - Copy `.env.example` to `.env` in `meeting-bot/`.
   - Set `BOT_CONTROL_API_URL` to your central backend URL (e.g. `http://localhost:5000/api/bot-control` or deployed URL).
   - Set `BOT_CONTROL_API_SECRET` to match the backend secret.
   - Set `BOT_WORKER_ID=worker-win-01`.
4. **Interactive Google Sign-In (one-time setup)**:
   ```powershell
   python -m app.main --auth-setup
   ```
   Sign into the dedicated Google Account for the bot in the browser window and close the browser. The session is saved to `meeting-bot/bot-profile`.
5. **Start the Autonomous Worker**:
   ```powershell
   python -m app.worker
   ```
   The worker will register with the central backend, report heartbeats, and automatically poll for and execute eligible interviews.

---

### Linux Worker Setup & Operating System Limitations
> [!IMPORTANT]
> **Linux Audio Architecture Differences**:
> The Windows implementation relies on:
> - `PyAudioWPatch` (Windows WASAPI loopback capture).
> - VB-Audio Virtual Cable Windows drivers.
>
> On Linux, WASAPI and VB-Audio Virtual Cable do **not** exist.
> Linux worker deployments require:
> 1. Running an X server or headless display server (`Xvfb`).
> 2. Setting up PulseAudio / PipeWire virtual sink loopback devices:
>    ```bash
>    # Create virtual speaker sink on Linux PulseAudio
>    pactl load-module module-null-sink sink_name=Virtual_Sink sink_properties=device.description=Virtual_Sink
>    # Loopback monitor source to virtual microphone source
>    pactl load-module module-remap-source master=Virtual_Sink.monitor source_name=Virtual_Mic source_properties=device.description=Virtual_Mic
>    ```
> 3. Standard `pyaudio` instead of `PyAudioWPatch`.
> 4. Linux workers can run standard headless Chromium automation seamlessly using `playwright install --with-deps chromium`.

---

## 6. Verification and End-to-End Workflow

To verify that the system works end-to-end:

1. **Verify Backend Status**:
   ```bash
   curl -X GET http://localhost:5000/api/health
   ```
2. **Start Backend**:
   ```bash
   cd backend && npm start
   ```
3. **Start Worker**:
   ```bash
   cd meeting-bot && .venv\Scripts\python.exe -m app.worker --poll-once
   ```
   Inspect logs to verify that:
   - Worker connects to `POST /api/bot-control/worker/register`.
   - Worker receives valid session token.
   - Worker queries `GET /api/bot-control/worker/claim`.
4. **Check Admin API Status**:
   ```bash
   curl -H "Cookie: recruitai_admin=<TOKEN>" http://localhost:5000/api/bot-control/admin/status
   ```
   The worker `worker-win-01` will show as `online: true`, `status: IDLE`.
5. **When an Interview is Scheduled**:
   - The central API identifies interviews within the 15-minute preparation window.
   - The worker atomically claims the job and acquires a 2-minute expiring lease.
   - The worker launches `python -m app.main --meet-url ... --interview-id ... --candidate-id ...`.
   - While running, the worker sends lease renewals to `/worker/jobs/:jobId/heartbeat`.
   - When the bot completes, the backend verifies that the interview is `COMPLETED` in MongoDB and marks the execution record complete.
