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
from app.meet import validate_meet_url, mask_meet_url, MeetNavigator

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
        self.candidate_speaking: bool = False

        self._playwright: Optional[Playwright] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None
        self._navigator: Optional[MeetNavigator] = None
        self._lock = asyncio.Lock()
        self._speak_lock = asyncio.Lock()

    def set_candidate_speaking(self, is_speaking: bool) -> None:
        """Update whether candidate is actively speaking."""
        self.candidate_speaking = bool(is_speaking)
        if self.candidate_speaking and self.ai_speaking:
            # Candidate interrupted AI while AI was speaking: stop TTS playback immediately
            logger.info("[SAFETY] AI_TTS_CANCELLED_CANDIDATE_STARTED - candidate began speaking during playback")
            try:
                from app.kokoro_tts import kokoro_tts
                kokoro_tts.stop()
            except Exception:
                pass

    def is_candidate_speaking(self) -> bool:
        """Check if candidate is actively speaking."""
        return self.candidate_speaking

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
                        "--restore-last-session=false",
                        "--disable-session-crashed-bubble",
                        "--no-first-run",
                        "--no-default-browser-check",
                        "--disable-features=OptimizationGuideModelDownloading",
                    ],
                    "viewport": {"width": 1280, "height": 720},
                }
                if os.path.exists(chrome_path):
                    launch_kwargs["channel"] = "chrome"

                # Launch Chromium persistent context
                self._context = await self._playwright.chromium.launch_persistent_context(**launch_kwargs)

                # Close any stale restored tabs to guarantee clean meeting state
                while len(self._context.pages) > 1:
                    stale_page = self._context.pages.pop()
                    try:
                        await stale_page.close()
                    except Exception as close_err:
                        logger.debug(f"[MEET] Note closing extra page: {close_err}")

                self._page = self._context.pages[0] if self._context.pages else await self._context.new_page()
                try:
                    await self._page.goto("about:blank")
                except Exception:
                    pass
                self._navigator = MeetNavigator(self._page)

                self.status = BotStatus.OPENING_MEET
                masked_url = mask_meet_url(self.meet_url)
                logger.info("[MEET] Opening Google Meet")
                logger.info(f"[MeetingBot] Opening Google Meet: {masked_url}")
                await self._page.goto(self.meet_url, wait_until="networkidle", timeout=45000)
                logger.info(f"[MeetingBot] Meet page loaded ({masked_url})")

                self.status = BotStatus.PRE_JOIN
                logger.info("[MEET] Prejoin detected")
                logger.info("[MeetingBot] Pre-join screen detected")
                await self._page.wait_for_timeout(3000)

                # Configure Google Meet audio devices (Microphone & Speaker) before joining
                audio_config_res = await self._navigator.configure_audio_devices()
                if not audio_config_res.get("success"):
                    self.status = BotStatus.FAILED
                    self.failure_reason = f"Audio device configuration failed: {audio_config_res.get('error')}"
                    logger.error(f"[MeetingBot] FAILED: {self.failure_reason}")
                    return False

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

                    admitted = await self.wait_for_admission(timeout_sec=300.0)
                    if not admitted:
                        return False
                    return True

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

                # Ensure dialogs dismissed and microphone is muted upon entering
                if self._navigator:
                    await self._navigator.dismiss_incall_dialogs()
                    await self._navigator.mute_microphone()
                    logger.info("[MEET] Microphone muted")

                return True

            except Exception as e:
                self.status = BotStatus.FAILED
                self.failure_reason = f"Exception during meeting join: {str(e)}"
                logger.exception(f"[MeetingBot] FAILED: {self.failure_reason}")
                return False

    async def wait_for_admission(self, timeout_sec: float = 300.0) -> bool:
        """
        Poll Google Meet admission screen until host admits the bot or timeout expires.
        Upon confirmation:
        - Sets self.status = BotStatus.JOINED
        - Sets self.joined_at
        - Dismisses in-call dialogs
        - Mutes microphone
        """
        if not self._navigator or not self._page:
            self.status = BotStatus.FAILED
            self.failure_reason = "Browser or navigator is not active while waiting for admission."
            return False

        logger.info(f"[MEET] Waiting up to {int(timeout_sec)}s for host admission...")
        loop = asyncio.get_event_loop()
        start_time = loop.time()
        poll_interval = 2.0
        log_interval = 10.0
        last_logged = start_time

        while (loop.time() - start_time) < timeout_sec:
            await self._page.wait_for_timeout(int(poll_interval * 1000))

            admission_check = await self._navigator.verify_meeting_admission()

            if admission_check["is_inside"]:
                self.status = BotStatus.JOINED
                self.joined_at = datetime.utcnow().isoformat() + "Z"
                logger.info(
                    f"[MeetingBot] Admission confirmed! Evidence: {', '.join(admission_check['evidence'])}"
                )
                logger.info("[MEET] Bot admitted")
                logger.info("[MEET] Confirmed inside meeting")
                logger.info("[MeetingBot] Successfully joined Google Meet")

                # Dismiss any in-call dialogs ("Your meeting's ready", "Add others")
                await self._navigator.dismiss_incall_dialogs()

                # Ensure mic is muted on entry
                await self._navigator.mute_microphone()
                logger.info("[MEET] Microphone muted")

                return True

            if admission_check["waiting_detected"]:
                now = loop.time()
                if (now - last_logged) >= log_interval:
                    elapsed = int(now - start_time)
                    logger.info(f"[MeetingBot] Still on waiting screen (elapsed {elapsed}s/{int(timeout_sec)}s). State: WAITING_FOR_ADMISSION")
                    last_logged = now
                continue

            # Check if host denied admission or meeting was terminated
            is_waiting = await self._navigator.is_waiting_for_admission()
            if not is_waiting:
                denied_indicators = [
                    'text="You can\'t join this call"',
                    'text="Your request to join was denied"',
                    'text="Return to home screen"',
                    'div:has-text("You can\'t join this call")',
                ]
                for di in denied_indicators:
                    try:
                        loc = self._page.locator(di)
                        if await loc.count() > 0 and await loc.first.is_visible():
                            self.status = BotStatus.FAILED
                            self.failure_reason = "Admission was explicitly denied by the meeting host."
                            logger.error(f"[MeetingBot] FAILED: {self.failure_reason}")
                            return False
                    except Exception:
                        pass

        # Timeout reached
        if await self._navigator.is_waiting_for_admission():
            self.status = BotStatus.FAILED
            self.failure_reason = f"Admission timed out after {int(timeout_sec)}s waiting for host to admit bot."
            logger.error(f"[MeetingBot] FAILED: {self.failure_reason}")
            return False

        self.status = BotStatus.FAILED
        self.failure_reason = "Admission was rejected, canceled, or host closed the meeting."
        logger.error(f"[MeetingBot] FAILED: {self.failure_reason}")
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
            if self.candidate_speaking:
                logger.info("[SAFETY] AI_TTS_BLOCKED_CANDIDATE_SPEAKING - candidate is speaking, suppressing TTS")
                return False

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

                # Run blocking audio playback in thread pool with bounded timeout to prevent indefinite hangs
                loop = asyncio.get_running_loop()
                try:
                    result = await asyncio.wait_for(
                        loop.run_in_executor(None, kokoro_tts.speak, text.strip()),
                        timeout=25.0,
                    )
                except asyncio.TimeoutError:
                    logger.error("[VOICE] Kokoro TTS speak timed out after 25s; continuing without stalling interview loop.")
                    result = {"success": False, "error": "TTS_TIMEOUT"}

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

    def get_media_monitor(self):
        """Retrieve active ParticipantMediaMonitor instance if available."""
        if self._navigator and hasattr(self._navigator, "media_monitor"):
            return self._navigator.media_monitor
        return None

    async def is_candidate_present(self) -> bool:
        """Check if candidate is currently present inside meeting."""
        if self._navigator:
            return await self._navigator.is_candidate_present()
        return False

    async def is_candidate_camera_on(self) -> Optional[bool]:
        """Check if candidate camera is currently ON."""
        if self._navigator:
            return await self._navigator.is_candidate_camera_on()
        return None

    async def is_candidate_mic_muted(self) -> Optional[bool]:
        """Check if candidate microphone is currently muted."""
        if self._navigator:
            return await self._navigator.is_candidate_mic_muted()
        return None

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
