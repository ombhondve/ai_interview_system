# RecruitAI Meeting Bot — Phase 1 Prototype

> **IMPORTANT:**
> **Phase 1 only implements Google Meet joining.**
> AI voice interview functionality (Deepgram, ElevenLabs, Groq, microphone/audio capture, STT/TTS, question generation, and candidate evaluation) is intentionally **not** implemented in this phase.

The Meeting Bot is an independent microservice responsible for automating the Chromium browser via **Playwright** to open a scheduled Google Meet URL, maintain an authenticated Google account session, and join the meeting as a participant.

---

## 1. What This Service Does (Phase 1)

1. Validates Google Meet URLs (`https://meet.google.com/xxx-yyyy-zzz`).
2. Launches Chromium using Playwright with a persistent user data profile (`bot-profile/`).
3. Supports an interactive setup mode to log into a dedicated Google account and persist 2FA/cookies.
4. Opens the target Google Meet link.
5. Handles the pre-join room (mutes camera/microphone for setup).
6. Identifies and clicks the "Join now" / "Ask to join" control using resilient selectors.
7. Detects whether the bot successfully transitioned into the active call.
8. Remains inside the meeting until explicitly stopped or terminated (handling SIGINT/SIGTERM cleanly).
9. Exposes a secured local HTTP API (`/bot/start`, `/bot/status`, `/bot/stop`) for programmatic orchestration.

---

## 2. Directory Structure

```
meeting-bot/
├── app/
│   ├── __init__.py
│   ├── main.py        # CLI & FastAPI entrypoint
│   ├── bot.py         # MeetingBot lifecycle controller & persistent context
│   ├── meet.py        # Google Meet selector heuristics & navigation
│   └── config.py      # Environment settings via Pydantic
├── bot-profile/       # Local persistent browser cookies & session (IGNORED FROM GIT)
├── requirements.txt   # Python dependencies
├── .env.example       # Example configuration
├── .gitignore         # Ignores bot-profile, .env, and caches
├── Dockerfile         # Container definition for future Linux deployments
└── README.md
```

---

## 3. Installation & Setup

### Prerequisites
- Python 3.10+ (tested on Python 3.14)
- Pip & Virtual Environment support

### Step 1: Install Dependencies
From the `meeting-bot/` directory:

```bash
cd meeting-bot
python -m venv .venv
# On Windows PowerShell:
.venv\Scripts\Activate.ps1
# On Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
playwright install chromium
```

### Step 2: Configure Environment
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure `MEETING_BOT_API_SECRET` with a secure passphrase for controlling the bot via API.

---

## 4. Google Account Setup (Authentication Mode)

Because Google implements automated bot and CAPTCHA detection, interactive credentials should not be automated with raw keystrokes. Instead, use the built-in **interactive authentication mode**:

```bash
python -m app.main --auth-setup
```

1. Chromium will open visibly displaying the Google Accounts login page (`https://accounts.google.com`).
2. Log into the dedicated Google account intended for the AI interviewer.
3. Complete any required Two-Factor Authentication (2FA).
4. Once you see your account dashboard, close the browser window or press `Ctrl+C` in your terminal.
5. All cookies, session tokens, and device authorizations are now safely preserved in `meeting-bot/bot-profile/` (which is excluded from Git). Subsequent runs will automatically reuse this authenticated session.

---

## 5. Usage

### Option A: Command Line Interface (CLI)

Join a specific Google Meet URL directly:

```bash
python -m app.main --meet-url "https://meet.google.com/xxx-yyyy-zzz"
```

**Expected Console Output:**
```text
[MeetingBot] Starting bot for meeting: https://meet.google.com/xxx-yyyy-zzz
[MeetingBot] Loading persistent profile from: .../bot-profile
[MeetingBot] Opening Google Meet: https://meet.google.com/xxx-yyyy-zzz
[MeetingBot] Meet page loaded
[MeetingBot] Pre-join screen detected
[MeetingBot] Camera turned off
[MeetingBot] Microphone muted for Phase 1 pre-join
[MeetingBot] Joining meeting...
[MeetingBot] Clicked join control via selector: button:has-text("Join now")
[MeetingBot] Waiting to confirm entry into meeting room...
[MeetingBot] Confirmed in-meeting via element: button[aria-label*="Leave call"]
[MeetingBot] Successfully joined Google Meet
[MeetingBot] Bot is now inside meeting
[MeetingBot] Bot joined successfully. Keeping browser open until interrupted (Ctrl+C)...
```

Press `Ctrl+C` when done. The bot will leave the call, close Chromium, and cleanly exit.

---

### Option B: Local Control API (FastAPI)

Start the API daemon:

```bash
python -m app.main --server
```

By default, the server runs on `http://127.0.0.1:8001`.

#### 1. Start / Join a Meeting
**Request:**
```http
POST /bot/start
Host: 127.0.0.1:8001
Content-Type: application/json
X-API-Secret: <your_meeting_bot_secret_here>

{
  "meetUrl": "https://meet.google.com/xxx-yyyy-zzz"
}
```

**Response:**
```json
{
  "success": true,
  "status": "STARTING",
  "meetUrl": "https://meet.google.com/xxx-yyyy-zzz"
}
```

#### 2. Query Status
**Request:**
```http
GET /bot/status
Host: 127.0.0.1:8001
X-API-Secret: <your_meeting_bot_secret_here>
```

**Response:**
```json
{
  "status": "JOINED",
  "meetUrl": "https://meet.google.com/xxx-yyyy-zzz",
  "startedAt": "2026-10-07T14:40:00Z",
  "joinedAt": "2026-10-07T14:40:15Z",
  "failureReason": null,
  "headless": false,
  "profileDir": "d:/ai_interview_system/meeting-bot/bot-profile"
}
```

#### 3. Stop Bot / Leave Meeting
**Request:**
```http
POST /bot/stop
Host: 127.0.0.1:8001
X-API-Secret: <your_meeting_bot_secret_here>
```

**Response:**
```json
{
  "success": true,
  "status": "STOPPED"
}
```

---

## 6. Verification Steps

1. In Google Calendar or Google Meet, create a test meeting from an admin account.
2. Ensure the dedicated bot Google account is invited or the meeting allows domain/public entry.
3. Launch the bot using `python -m app.main --meet-url "<your-meet-url>"`.
4. Observe the Chromium window navigate to the room, handle camera/mic, and click Join.
5. In your host browser, verify that the bot Google account appears in the participant list.
6. Verify the console logs output `[MeetingBot] Successfully joined Google Meet` and status `JOINED`.
7. Stop the bot with `Ctrl+C` or via `POST /bot/stop` and confirm the bot leaves the participant list.

---

## 7. Security Notes

- **Never Commit `bot-profile/`**: The persistent profile stores active Google login cookies and device tokens. Both `.gitignore` in `meeting-bot/` and the root `.gitignore` exclude it.
- **API Authentication**: The local API requires the `X-API-Secret` header or `Authorization: Bearer <secret>`. Never expose port 8001 directly to the public internet without an internal reverse proxy and TLS.
- **No Hardcoded Credentials**: No passwords or tokens are stored in source code.

---

## 8. Future Phases (Roadmap)
- **Phase 2 (Audio Pipeline):** Virtual audio routing (PulseAudio / VB-Audio Cable) to capture meeting audio stream and inject synthetic voice audio into Google Meet.
- **Phase 3 (AI Interview Engine Integration):** Connecting Deepgram STT, Groq dynamic questioning, and ElevenLabs TTS to the live Meet audio stream.
- **Phase 4 (Backend Orchestration):** Automatic dispatch from RecruitAI backend when `AiInterview.scheduledAt` arrives.
