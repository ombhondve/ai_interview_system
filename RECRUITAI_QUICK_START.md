# RecruitAI — Windows Quick Start Guide

This guide contains the verified prerequisites, configuration steps, exact startup commands, and troubleshooting instructions to run RecruitAI on your Windows workstation.

---

## 1. Verified Prerequisites on This Machine

| Prerequisite | Status | Details |
|---|---|---|
| **Operating System** | Ready | Windows 10/11 64-bit |
| **Node.js** | Ready | Node.js `v24.20.0` & npm `11.19.0` installed |
| **Python** | Ready | Dedicated Python `3.11.6` virtualenv at `meeting-bot\.venv` |
| **Google Chrome** | Ready | Installed at `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| **VB-Audio Cable** | Ready | Virtual Audio Cable installed (`CABLE Input` & `CABLE Output`) |
| **Audio Hardware** | Ready | 33 host audio devices detected via WASAPI & DirectSound |
| **Meeting Bot Tests**| Ready | All 134 unit and integration tests verified passing |

---

## 2. One-Time Setup Steps

### Step 2.1: Install Backend & Frontend Dependencies

Open PowerShell in the repository root (`d:\ai_interview_system`):

```powershell
# 1. Install Backend Dependencies
cd d:\ai_interview_system\backend
npm install

# 2. Install Frontend Dependencies
cd d:\ai_interview_system\frontend
npm install
```

> **Note on `canvas`:** If npm errors on building `canvas`, edit `backend/package.json` to remove `"canvas": "^3.2.3"` (it is completely unused in the codebase) and re-run `npm install`.

---

### Step 2.2: Configure Environment Variables

#### 1. Backend Configuration (`backend/.env`)
Ensure these key variables are set in `backend/.env`:
```ini
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000

# MongoDB URI (Atlas or Local)
STORAGE_MONGODB_URI=mongodb://localhost:27017/ai_interview_system

# JWT & Security Secrets (generate random 32-char string)
JWT_SECRET=recruitai-super-secret-jwt-key-min-32-chars

# AI Provider (Groq Cloud)
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# Speech-to-Text (Deepgram)
DEEPGRAM_API_KEY=your_deepgram_api_key_here
DEEPGRAM_MODEL=nova-2

# Bot Shared Control Secret (MUST match meeting-bot/.env)
BOT_CONTROL_API_SECRET=recruitai-high-entropy-bot-control-secret-2026

# Google Meet Bot Account
GOOGLE_MEET_BOT_EMAIL=ombhondve32@gmail.com
```

#### 2. Frontend Configuration (`frontend/.env.local`)
Create or edit `frontend/.env.local`:
```ini
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
BACKEND_URL=http://localhost:5000
JWT_SECRET=recruitai-super-secret-jwt-key-min-32-chars
```

#### 3. Meeting Bot Configuration (`meeting-bot/.env`)
Ensure `meeting-bot/.env` contains:
```ini
MEETING_BOT_PORT=8001
BOT_CONTROL_API_URL=http://localhost:5000/api/bot-control
BOT_CONTROL_API_SECRET=recruitai-high-entropy-bot-control-secret-2026
RECRUITAI_API_URL=http://localhost:5000

DEEPGRAM_API_KEY=your_deepgram_api_key_here
DEEPGRAM_MODEL=nova-2

GOOGLE_MEET_BOT_EMAIL=ombhondve32@gmail.com
MEETING_BOT_HEADLESS=false
MEETING_BOT_PROFILE_DIR=./bot-profile

# Audio & VB-Cable Configuration (Verified on this laptop)
AUDIO_CAPTURE_DEVICE=Speaker (2- Realtek(R) Audio)
KOKORO_OUTPUT_DEVICE=CABLE Input (VB-Audio Virtual Cable)
MEET_MIC_DEVICE=CABLE Output (VB-Audio Virtual Cable)
MEET_SPEAKER_DEVICE=Speaker (2- Realtek(R) Audio)
```

---

### Step 2.3: One-Time Bot Google Sign-In

Run the following command to sign in the dedicated bot Google account so it can join Google Meet calls without prompting:

```powershell
cd d:\ai_interview_system\meeting-bot
.\.venv\Scripts\python.exe -m app.main --auth-setup
```

1. A visible Chrome window will open to `accounts.google.com`.
2. Sign in with the bot's Google account (`ombhondve32@gmail.com`).
3. Complete 2-Step Verification if prompted.
4. Once signed in to Google, **close the browser window**.
5. Your login session is now saved in `meeting-bot/bot-profile/`.

---

## 3. Application Startup Instructions

To run the complete system, open **three separate PowerShell terminals** and run them in this order:

### Terminal 1: Central Backend API Server
```powershell
cd d:\ai_interview_system\backend
node src/server.js
```
*Expected output:*
```
✅ MongoDB connected successfully
Configured admin account initialized in database.
✅ Server running on port 5000
```

### Terminal 2: Frontend Web Application
```powershell
cd d:\ai_interview_system\frontend
npm run dev
```
*Expected output:*
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
```

### Terminal 3: Meeting Bot Background Worker
```powershell
cd d:\ai_interview_system\meeting-bot
.\.venv\Scripts\python.exe -m app.worker
```
*Expected output:*
```
[Worker] Registered worker worker-node-01 successfully.
[Worker] Starting polling loop (every 10s)...
```

---

## 4. Verifying the Full End-to-End Flow

1. Open your browser and go to `http://localhost:3000/login`.
2. Log in with your admin credentials:
   - Email: `admin@recruitai.com` (or your configured `DEMO_ADMIN_EMAIL`)
   - Password: `SecurePassword123!` (or your `DEMO_ADMIN_PASSWORD`)
3. Navigate to **Schedule** / **Interviews** to view or create an interview session.
4. When an interview's scheduled start time arrives:
   - The backend marks the interview job as `QUEUED`.
   - Terminal 3 (Bot Worker) automatically claims the job.
   - Chrome launches and joins the Google Meet room.
   - The candidate speaks into Google Meet; the bot transcribes speech, evaluates it via Groq, and responds through Kokoro TTS.
5. When the interview ends, the bot uploads the transcript and WAV recording, and the admin dashboard displays the AI performance evaluation.

---

## 5. Troubleshooting Common Issues

| Issue / Error | Root Cause | Solution |
|---|---|---|
| `Cannot find package 'dotenv'` or `Cannot find module '@babel/parser'` | `node_modules` not installed or missing package. | Run `npm install` in `backend/`. Ensure `@babel/parser` is in `dependencies`. |
| `pyaudiowpatch` or `torch` import error when running `python -m app.worker` | Running with system Python 3.14 instead of the virtualenv. | Always run with `.\.venv\Scripts\python.exe` inside `meeting-bot/`. |
| `AUDIO_CAPTURE_DEVICE_NOT_FOUND` | Configured speaker name does not match Windows device name. | Run `.\.venv\Scripts\python.exe -c "import sounddevice as sd; print(sd.query_devices())"` to verify speaker name. Set `AUDIO_CAPTURE_DEVICE=Speaker (2- Realtek(R) Audio)`. |
| Bot stuck in Google Meet waiting room / lobby | Bot account not invited to calendar event or session expired. | Ensure `GOOGLE_MEET_BOT_EMAIL` is an invited attendee, or re-run `python -m app.main --auth-setup` to refresh Chrome cookies. |
| Candidate cannot hear the AI interviewer in Google Meet | VB-Cable routing misconfigured in Chrome or Meet. | Inside Google Meet settings, ensure Microphone is set to `CABLE Output (VB-Audio Virtual Cable)`. |
| Groq returns 404/400 `model_decommissioned` | `GROQ_MODEL` points to deprecated model name. | Update `GROQ_MODEL=llama-3.3-70b-versatile` in `backend/.env`. |
