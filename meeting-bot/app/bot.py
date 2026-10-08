"""
Core MeetingBot manager.
Launches Chromium with persistent user profile, coordinates Google Meet navigation,
maintains meeting presence, and provides status telemetry.
"""

import os
import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

from playwright.async_api import async_playwright, BrowserContext, Page, Playwright

from app.config import settings
from app.meet import validate_meet_url, MeetNavigator

logger = logging.getLogger("MeetingBot")


class BotStatus:
    IDLE = "IDLE"
    STARTING = "STARTING"
    OPENING_MEET = "OPENING_MEET"
    PRE_JOIN = "PRE_JOIN"
    JOINING = "JOINING"
    WAITING_FOR_ADMISSION = "WAITING_FOR_ADMISSION"
    JOINED = "JOINED"
    AI_SPEAKING = "AI_SPEAKING"
    FAILED = "FAILED"
    STOPPED = "STOPPED"


class MeetingBot:
    """Manages the persistent Chromium context and Google Meet session."""

    def __init__(self):
        self.status: str = BotStatus.IDLE
        self.meet_url: Optional[str] = None
        self.started_at: Optional[str] = None
        self.joined_at: Optional[str] = None
        self.failure_reason: Optional[str] = None
        self.ai_speaking: bool = False

        self._playwright: Optional[Playwright] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None
        self._navigator: Optional[MeetNavigator] = None
        self._lock = asyncio.Lock()
        self._speak_lock = asyncio.Lock()

    def is_ai_speaking(self) -> bool:
        """Check if AI is currently speaking."""
        return self.ai_speaking or self.status == BotStatus.AI_SPEAKING

    def get_status_info(self) -> Dict[str, Any]:
        """Return the current status snapshot."""
        return {
            "status": self.status,
            "aiSpeaking": self.is_ai_speaking(),
            "meetUrl": self.meet_url,
            "startedAt": self.started_at,
            "joinedAt": self.joined_at,
            "failureReason": self.failure_reason,
            "headless": settings.meeting_bot_headless,
            "profileDir": settings.meeting_bot_profile_dir,
        }


    async def open_auth_session(self) -> None:
        """
        Setup/Authentication Mode:
        Launches visible Chromium using the persistent profile and navigates to Google Accounts.
        Allows the user to sign in manually, handle 2FA, and store credentials in bot-profile.
        """
        logger.info("[MeetingBot] Starting interactive authentication / setup mode...")
        profile_path = Path(settings.meeting_bot_profile_dir).resolve()
        profile_path.mkdir(parents=True, exist_ok=True)

        playwright = await async_playwright().start()
        # Prefer system Google Chrome if available, otherwise default Chromium
        chrome_path = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        launch_kwargs = {
            "user_data_dir": str(profile_path),
            "headless": False,
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--use-fake-ui-for-media-stream",
            ],
            "viewport": {"width": 1280, "height": 720},
        }
        if os.path.exists(chrome_path):
            launch_kwargs["channel"] = "chrome"

        # Launch persistent context visibly for user interaction
        context = await playwright.chromium.launch_persistent_context(**launch_kwargs)
        page = context.pages[0] if context.pages else await context.new_page()

        logger.info("[MeetingBot] Opening Google Accounts login page...")
        await page.goto("https://accounts.google.com", wait_until="networkidle")
        logger.info(
            "[MeetingBot] Browser is open. Please sign in to the dedicated Google account in the browser window.\n"
            "Once signed in, close the browser or press Ctrl+C in this terminal. "
            "Your profile session will remain saved in bot-profile/."
        )

        try:
            # Wait until user closes the window or context disconnects
            while context.browser and context.browser.is_connected():
                await asyncio.sleep(1)
        except Exception:
            pass
        finally:
            try:
                await context.close()
            except Exception:
                pass
            await playwright.stop()
            logger.info("[MeetingBot] Authentication session saved to profile directory.")

    async def start(self, meet_url: str) -> bool:
        """
        Start the bot, launch Chromium with persistent profile, and join the specified Google Meet.
        """
        async with self._lock:
            if self.status in [BotStatus.STARTING, BotStatus.JOINING, BotStatus.JOINED]:
                logger.warning(f"[MeetingBot] Cannot start: bot is already in status {self.status}")
                return False

            if not validate_meet_url(meet_url):
                self.status = BotStatus.FAILED
                self.failure_reason = f"Invalid Google Meet URL: {meet_url}"
                logger.error(f"[MeetingBot] FAILED: {self.failure_reason}")
                return False

            self.meet_url = meet_url.strip()
            self.started_at = datetime.utcnow().isoformat() + "Z"
            self.joined_at = None
            self.failure_reason = None
            self.status = BotStatus.STARTING
            logger.info(f"[MeetingBot] Starting bot for meeting: {self.meet_url}")

            try:
                profile_path = Path(settings.meeting_bot_profile_dir).resolve()
                profile_path.mkdir(parents=True, exist_ok=True)

                # Safe Startup Diagnostics (Phase 4.5)
                configured_bot_email = (getattr(settings, "google_meet_bot_email", None) or os.getenv("GOOGLE_MEET_BOT_EMAIL") or "").strip().lower()
                logger.info(f"[MEET] Bot email configured: {configured_bot_email or 'not configured'}")
                logger.info(f"[MEET] Meet URL: {self.meet_url}")
                logger.info(f"[MEET] Persistent profile: {profile_path}")
                logger.info("[MEET] Calendar invitation expected: true")

                # Verify profile account matches configured bot email
                try:
                    prefs_path = profile_path / "Default" / "Preferences"
                    if prefs_path.exists():
                        import json
                        with open(prefs_path, "r", encoding="utf-8", errors="ignore") as pf:
                            prefs_data = json.load(pf)
                        account_infos = prefs_data.get("account_info", [])
                        logged_in_email = account_infos[0].get("email", "").strip().lower() if account_infos else ""
                        if logged_in_email:
                            logger.info(f"[MEET] Authenticated Chrome account in profile: {logged_in_email}")
                            if configured_bot_email and logged_in_email != configured_bot_email:
                                logger.warning(
                                    f"[MEET] WARNING: Configured bot email ({configured_bot_email}) does not match "
                                    f"authenticated Chrome account ({logged_in_email})."
                                )
                except Exception as pref_err:
                    logger.debug(f"[MEET] Profile account validation note: {pref_err}")

                logger.info(f"[MeetingBot] Loading persistent profile from: {profile_path}")
                self._playwright = await async_playwright().start()

                chrome_path = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
                launch_kwargs = {
                    "user_data_dir": str(profile_path),
                    "headless": settings.meeting_bot_headless,
                    "permissions": ["microphone", "camera"],
                    "args": [
                        "--disable-blink-features=AutomationControlled",
                        "--no-sandbox",
                        "--use-fake-ui-for-media-stream",  # Auto-grants media stream dialogs
                        "--enable-features=NetworkService,NetworkServiceInProcess",
                    ],
                    "viewport": {"width": 1280, "height": 720},
                }
                if os.path.exists(chrome_path):
                    launch_kwargs["channel"] = "chrome"

                # Launch Chromium persistent context
                self._context = await self._playwright.chromium.launch_persistent_context(**launch_kwargs)

                self._page = self._context.pages[0] if self._context.pages else await self._context.new_page()
                self._navigator = MeetNavigator(self._page)

                self.status = BotStatus.OPENING_MEET
                logger.info("[MEET] Opening Google Meet")
                logger.info(f"[MeetingBot] Opening Google Meet: {self.meet_url}")
                await self._page.goto(self.meet_url, wait_until="networkidle", timeout=45000)
                logger.info("[MeetingBot] Meet page loaded")

                self.status = BotStatus.PRE_JOIN
                logger.info("[MEET] Prejoin detected")
                logger.info("[MeetingBot] Pre-join screen detected")
                await self._page.wait_for_timeout(3000)

                # Prepare pre-join controls (turn off camera / configure mic)
                await self._navigator.prepare_prejoin()
                await self._page.wait_for_timeout(2000)

                # Check and attempt to click Join with a retry window (Google Meet often takes 3-10s to enable join controls)
                self.status = BotStatus.JOINING
                logger.info("[MeetingBot] Inspecting join options on pre-join page...")
                action = None
                for attempt in range(5):
                    action = await self._navigator.click_join()
                    if action:
                        break
                    logger.info(f"[MeetingBot] Join control not ready yet (attempt {attempt + 1}/5). Waiting 2s...")
                    await self._page.wait_for_timeout(2000)

                if not action:
                    self.status = BotStatus.FAILED
                    self.failure_reason = "Failed to find 'Join now' or 'Ask to join' control on Google Meet pre-join page."
                    logger.error(f"[MeetingBot] FAILED: {self.failure_reason}")
                    return False

                if action == "ASK_TO_JOIN":
                    self.status = BotStatus.WAITING_FOR_ADMISSION
                    logger.info("[MEET] Bot is waiting for host admission")
                    logger.info("[MEET] Automatic admission was not granted by Google Meet")
                    logger.warning("[MeetingBot] 'Ask to join' was clicked. Bot is NOT directly admitted.")
                    logger.warning("[MeetingBot] State changed to: WAITING_FOR_ADMISSION. Waiting for meeting host to admit...")

                    # Poll admission status for up to 45 seconds (checking every 2 seconds)
                    admitted = False
                    for poll_idx in range(22):
                        await self._page.wait_for_timeout(2000)
                        admission_check = await self._navigator.verify_meeting_admission()

                        if admission_check["waiting_detected"]:
                            logger.info(f"[MeetingBot] Still on waiting screen ({poll_idx + 1}/22). State remains: WAITING_FOR_ADMISSION")
                            continue

                        if admission_check["is_inside"]:
                            admitted = True
                            logger.info(
                                f"[MeetingBot] Admission confirmed! Evidence: {', '.join(admission_check['evidence'])}"
                            )
                            break

                    if not admitted:
                        # Check if still on waiting screen
                        if await self._navigator.is_waiting_for_admission():
                            logger.info("[MeetingBot] Admission timeout reached. Bot remains on waiting screen. State: WAITING_FOR_ADMISSION")
                            # Bot did NOT enter meeting
                            return True
                        self.status = BotStatus.FAILED
                        self.failure_reason = "Admission was rejected, canceled, or host closed the meeting."
                        logger.error(f"[MeetingBot] FAILED: {self.failure_reason}")
                        return False

                elif action == "JOIN_NOW":
                    logger.info("[MEET] Direct join available. Joining meeting...")
                    logger.info("[MeetingBot] Direct 'Join now' clicked. Waiting to confirm entry into meeting room...")
                    is_inside = await self._navigator.is_inside_meeting(timeout_ms=25000)
                    if not is_inside:
                        self.status = BotStatus.FAILED
                        self.failure_reason = "Direct 'Join now' was clicked but failed to detect in-meeting controls within timeout."
                        logger.error(f"[MeetingBot] FAILED: {self.failure_reason}")
                        return False
                    logger.info("[MEET] Bot automatically admitted")

                # At this point, in-meeting controls are strictly confirmed with multi-signal evidence
                self.status = BotStatus.JOINED
                self.joined_at = datetime.utcnow().isoformat() + "Z"
                logger.info("[MEET] Bot admitted")
                logger.info("[MEET] Confirmed inside meeting")
                logger.info("[MeetingBot] Successfully joined Google Meet")
                logger.info("[MeetingBot] In-meeting controls verified. Bot is now inside meeting.")

                # Ensure microphone is muted upon entering
                if self._navigator:
                    await self._navigator.mute_microphone()
                    logger.info("[MEET] Microphone muted")

                return True

            except Exception as e:
                self.status = BotStatus.FAILED
                self.failure_reason = f"Exception during meeting join: {str(e)}"
                logger.exception(f"[MeetingBot] FAILED: {self.failure_reason}")
                return False

    async def speak_text(self, text: str) -> bool:
        """
        Speak text into Google Meet using Kokoro TTS and VB-CABLE with safe sequencing:
        1. Ensure the bot is genuinely inside the meeting
        2. Set AI_SPEAKING state and pause candidate transcript ingestion
        3. Unmute Google Meet microphone
        4. Play Kokoro audio through VB-CABLE Input (which routes to Meet microphone CABLE Output)
        5. Wait until playback finishes
        6. Mute Google Meet microphone again
        7. Clear AI_SPEAKING state and resume candidate listening
        """
        if not text or not text.strip():
            logger.warning("[MeetingBot] speak_text called with empty text.")
            return False

        from app.kokoro_tts import kokoro_tts

        async with self._speak_lock:
            if not self._navigator or not self._page:
                logger.warning("[MeetingBot] Cannot speak: browser or meeting navigator is not active.")
                return False

            # Verify bot is actually inside the meeting
            is_inside = await self._navigator.is_inside_meeting(timeout_ms=3000)
            if not is_inside:
                logger.warning("[MeetingBot] Cannot speak: bot is not confirmed inside the meeting room.")
                return False

            previous_status = self.status
            self.ai_speaking = True
            self.status = BotStatus.AI_SPEAKING

            logger.info("[VOICE] AI speaking started")
            playback_success = False
            try:
                # Unmute microphone
                unmuted = await self._navigator.unmute_microphone()
                if not unmuted:
                    logger.warning("[MEET] Microphone could not be unmuted; proceeding with playback caution.")

                # Small settling delay before audio playback starts
                await asyncio.sleep(0.3)

                # Run blocking audio playback in thread pool to avoid blocking the asyncio event loop
                loop = asyncio.get_running_loop()
                result = await loop.run_in_executor(None, kokoro_tts.speak, text.strip())

                # Result is a dict with status and duration
                if isinstance(result, dict):
                    playback_success = result.get("success", False)
                    if not playback_success:
                        logger.error(f"[VOICE] Kokoro TTS playback failed: {result.get('error')}")
                else:
                    playback_success = bool(result)

                # Small settling delay before muting microphone
                await asyncio.sleep(0.4)

                # Mute microphone again immediately after playback completes
                await self._navigator.mute_microphone()

                return playback_success

            except Exception as e:
                logger.exception(f"[MeetingBot] Error during AI speech execution: {e}")
                if self._navigator:
                    try:
                        await self._navigator.mute_microphone()
                    except Exception:
                        pass
                return False
            finally:
                self.ai_speaking = False
                self.status = BotStatus.JOINED if previous_status != BotStatus.STOPPED else BotStatus.STOPPED
                if playback_success:
                    logger.info("[VOICE] AI speaking finished successfully")
                else:
                    logger.warning("[VOICE] AI speaking finished with failure / incomplete")

    async def stop(self) -> None:
        """Leave the meeting gracefully, close browser, and clean up resources."""
        async with self._lock:
            logger.info("[MeetingBot] Stopping MeetingBot...")
            self.ai_speaking = False
            from app.kokoro_tts import kokoro_tts
            kokoro_tts.stop()

            if self._navigator and self._page:
                try:
                    await self._navigator.leave_meeting()
                except Exception as e:
                    logger.debug(f"[MeetingBot] Error during leave_meeting: {e}")


            if self._context:
                try:
                    await self._context.close()
                except Exception as e:
                    logger.debug(f"[MeetingBot] Error closing context: {e}")
                self._context = None
                self._page = None
                self._navigator = None

            if self._playwright:
                try:
                    await self._playwright.stop()
                except Exception as e:
                    logger.debug(f"[MeetingBot] Error stopping playwright: {e}")
                self._playwright = None

            self.status = BotStatus.STOPPED
            logger.info("[MeetingBot] MeetingBot stopped cleanly.")


# Global singleton instance for local control
bot_instance = MeetingBot()
