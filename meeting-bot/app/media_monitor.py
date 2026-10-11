"""
Google Meet Participant Media-State Monitor.
Monitors remote candidate microphone, camera, and presence independently from
the bot's own controls and audio playback.
Provides debounced state updates, observable verification, and reminder cooldowns.
"""

import time
import logging
from typing import Optional, Dict, Any
from enum import Enum
from playwright.async_api import Page

logger = logging.getLogger("MeetingBot.MediaMonitor")


class MediaState(str, Enum):
    ON = "ON"
    OFF = "OFF"
    MUTED = "MUTED"
    UNMUTED = "UNMUTED"
    PRESENT = "PRESENT"
    DISCONNECTED = "DISCONNECTED"
    UNKNOWN = "UNKNOWN"


# Centralized selectors for Google Meet UI
MEET_SELECTORS = {
    # Leave / In-call toolbar
    "leave_call": [
        'button[aria-label*="Leave call" i]',
        'button[aria-label*="End call" i]',
        'div[aria-label*="Leave call" i]',
        'button[data-tooltip*="Leave call" i]',
    ],
    # Participant count and people list
    "participant_count": [
        'button[aria-label*="People" i]',
        'button[aria-label*="Show everyone" i]',
    ],
    # Remote participant video and tiles (strictly isolating remote tiles from self-view)
    "remote_tiles": [
        'div[data-allocation-index]:not([data-self-name]):not([data-is-self="true"])',
        'div[data-participant-id]:not([data-self-name]):not([data-is-self="true"])',
    ],
    "remote_video": [
        'div[data-allocation-index]:not([data-self-name]) video',
        'div[data-participant-id]:not([data-self-name]) video',
    ],
    "remote_camera_off": [
        'div[data-allocation-index]:not([data-self-name]) [aria-label*="camera off" i]',
        'div[data-participant-id]:not([data-self-name]) [aria-label*="camera off" i]',
        'div[data-allocation-index]:not([data-self-name]) img',
        'div[data-participant-id]:not([data-self-name]) img',
    ],
    # Remote microphone mute indicators
    "remote_mic_muted": [
        'div[data-allocation-index]:not([data-self-name]) [aria-label*="muted" i]',
        'div[data-allocation-index]:not([data-self-name]) [data-is-muted="true"]',
        'div[data-participant-id]:not([data-self-name]) [aria-label*="muted" i]',
        'div[data-participant-id]:not([data-self-name]) [data-is-muted="true"]',
        'div[data-allocation-index]:not([data-self-name]) i:has-text("mic_off")',
        'div[data-participant-id]:not([data-self-name]) i:has-text("mic_off")',
    ],
    # Bot's own microphone toolbar controls
    "bot_mic_muted": [
        'button[aria-label*="Turn on microphone" i]',
        'div[role="button"][aria-label*="Turn on microphone" i]',
        'button[data-is-muted="true"][aria-label*="microphone" i]',
        'button[data-is-muted="true"][aria-label*="mic" i]',
    ],
    "bot_mic_unmuted": [
        'button[aria-label*="Turn off microphone" i]',
        'div[role="button"][aria-label*="Turn off microphone" i]',
        'button[data-is-muted="false"][aria-label*="microphone" i]',
        'button[data-is-muted="false"][aria-label*="mic" i]',
    ],
}


class ParticipantMediaMonitor:
    """
    Independent observer for Google Meet media and participant presence.
    Runs non-blocking polls, caches observables with cooldowns, and maintains
    reminder quotas to prevent repeated nagging.
    """

    def __init__(
        self,
        page: Optional[Page] = None,
        camera_reminder_cooldown_sec: float = 30.0,
        mic_reminder_cooldown_sec: float = 25.0,
        max_camera_reminders: int = 2,
        max_mic_reminders: int = 2,
    ):
        self.page = page
        self.camera_reminder_cooldown = camera_reminder_cooldown_sec
        self.mic_reminder_cooldown = mic_reminder_cooldown_sec
        self.max_camera_reminders = max_camera_reminders
        self.max_mic_reminders = max_mic_reminders

        # State tracking
        self.candidate_present: MediaState = MediaState.UNKNOWN
        self.candidate_camera: MediaState = MediaState.UNKNOWN
        self.candidate_mic: MediaState = MediaState.UNKNOWN
        self.bot_mic: MediaState = MediaState.UNKNOWN

        # Reminder counters and timestamps
        self.camera_reminders_sent: int = 0
        self.mic_reminders_sent: int = 0
        self.last_camera_reminder_time: float = 0.0
        self.last_mic_reminder_time: float = 0.0
        self.last_candidate_present_time: float = time.monotonic()
        self.last_check_time: float = 0.0

    def set_page(self, page: Page) -> None:
        """Update or bind active Playwright Page instance."""
        self.page = page

    async def check_candidate_presence(self) -> MediaState:
        """
        Check if at least one remote participant is present in the meeting.
        Distinguishes sole bot (count <= 1) from remote participant presence (count >= 2).
        """
        if not self.page:
            return MediaState.UNKNOWN

        try:
            # Check button aria-label e.g. "People (2)", "Show everyone (2)"
            for sel in MEET_SELECTORS["participant_count"]:
                loc = self.page.locator(sel)
                count = await loc.count()
                for i in range(count):
                    btn = loc.nth(i)
                    if await btn.is_visible():
                        aria = (await btn.get_attribute("aria-label") or "")
                        text = (await btn.inner_text() or "")
                        import re
                        m = re.search(r"\((\d+)\)", aria) or re.search(r"\b(\d+)\b", text)
                        if m:
                            total = int(m.group(1))
                            if total >= 2:
                                self.candidate_present = MediaState.PRESENT
                                self.last_candidate_present_time = time.monotonic()
                                return MediaState.PRESENT
                            elif total == 1:
                                self.candidate_present = MediaState.DISCONNECTED
                                return MediaState.DISCONNECTED

            # Fallback check on participant tiles
            tiles = self.page.locator("[data-participant-id], [data-allocation-index]")
            tile_count = await tiles.count()
            if tile_count >= 2:
                self.candidate_present = MediaState.PRESENT
                self.last_candidate_present_time = time.monotonic()
                return MediaState.PRESENT
            elif tile_count == 1:
                self.candidate_present = MediaState.DISCONNECTED
                return MediaState.DISCONNECTED

            return MediaState.UNKNOWN
        except Exception as e:
            logger.debug(f"[MediaMonitor] Error checking presence: {e}")
            return MediaState.UNKNOWN

    async def check_candidate_camera(self) -> MediaState:
        """
        Check remote candidate video streaming status without confusing bot self-view.
        Returns:
            MediaState.ON: Remote video is streaming and active.
            MediaState.OFF: Remote tile displays avatar, initial, or camera-off indicator.
            MediaState.UNKNOWN: Cannot determine or candidate absent.
        """
        if not self.page:
            return MediaState.UNKNOWN

        try:
            # First check presence
            presence = await self.check_candidate_presence()
            if presence == MediaState.DISCONNECTED:
                self.candidate_camera = MediaState.UNKNOWN
                return MediaState.UNKNOWN

            # Check remote video elements
            for sel in MEET_SELECTORS["remote_video"]:
                vid_loc = self.page.locator(sel)
                count = await vid_loc.count()
                for i in range(count):
                    vid = vid_loc.nth(i)
                    if await vid.is_visible():
                        # Verify video stream has valid dimensions and is not ended/paused
                        is_streaming = await vid.evaluate(
                            "(v) => !v.paused && !v.ended && v.readyState >= 2 && v.videoWidth > 0"
                        )
                        if is_streaming:
                            self.candidate_camera = MediaState.ON
                            return MediaState.ON

            # Check remote camera off indicators or avatar placeholders
            for sel in MEET_SELECTORS["remote_camera_off"]:
                off_loc = self.page.locator(sel)
                if await off_loc.count() > 0 and await off_loc.first.is_visible():
                    self.candidate_camera = MediaState.OFF
                    return MediaState.OFF

            return MediaState.UNKNOWN
        except Exception as e:
            logger.debug(f"[MediaMonitor] Error checking candidate camera: {e}")
            return MediaState.UNKNOWN

    async def check_candidate_mic(self) -> MediaState:
        """
        Check remote candidate microphone status.
        Returns:
            MediaState.MUTED: Red/gray mute icon on candidate tile.
            MediaState.UNMUTED: Candidate is unmuted (mute icon absent on active tile).
            MediaState.UNKNOWN: Cannot determine.
        """
        if not self.page:
            return MediaState.UNKNOWN

        try:
            presence = await self.check_candidate_presence()
            if presence == MediaState.DISCONNECTED:
                self.candidate_mic = MediaState.UNKNOWN
                return MediaState.UNKNOWN

            for sel in MEET_SELECTORS["remote_mic_muted"]:
                muted_loc = self.page.locator(sel)
                if await muted_loc.count() > 0 and await muted_loc.first.is_visible():
                    self.candidate_mic = MediaState.MUTED
                    return MediaState.MUTED

            # If remote tile is visible and mute indicator is strictly absent, unmuted
            remote_tiles = self.page.locator(MEET_SELECTORS["remote_tiles"][0])
            if await remote_tiles.count() > 0 and await remote_tiles.first.is_visible():
                self.candidate_mic = MediaState.UNMUTED
                return MediaState.UNMUTED

            return MediaState.UNKNOWN
        except Exception as e:
            logger.debug(f"[MediaMonitor] Error checking candidate mic: {e}")
            return MediaState.UNKNOWN

    async def check_bot_mic(self) -> MediaState:
        """Check whether the bot's own microphone is currently muted or unmuted."""
        if not self.page:
            return MediaState.UNKNOWN

        try:
            for sel in MEET_SELECTORS["bot_mic_muted"]:
                loc = self.page.locator(sel)
                if await loc.count() > 0 and await loc.first.is_visible():
                    self.bot_mic = MediaState.MUTED
                    return MediaState.MUTED

            for sel in MEET_SELECTORS["bot_mic_unmuted"]:
                loc = self.page.locator(sel)
                if await loc.count() > 0 and await loc.first.is_visible():
                    self.bot_mic = MediaState.UNMUTED
                    return MediaState.UNMUTED

            return MediaState.UNKNOWN
        except Exception as e:
            logger.debug(f"[MediaMonitor] Error checking bot mic: {e}")
            return MediaState.UNKNOWN

    async def poll_full_media_state(self) -> Dict[str, Any]:
        """Collect snapshot of all media observables."""
        presence = await self.check_candidate_presence()
        camera = await self.check_candidate_camera()
        mic = await self.check_candidate_mic()
        bot_mic = await self.check_bot_mic()
        self.last_check_time = time.monotonic()

        return {
            "candidatePresent": presence.value,
            "candidateCamera": camera.value,
            "candidateMic": mic.value,
            "botMic": bot_mic.value,
            "lastCheckTime": self.last_check_time,
        }

    async def is_candidate_present(self) -> bool:
        """Check if candidate is currently present inside meeting."""
        state = await self.check_candidate_presence()
        return state == MediaState.PRESENT

    async def is_candidate_camera_on(self) -> Optional[bool]:
        """Check if candidate camera is currently ON."""
        state = await self.check_candidate_camera()
        if state == MediaState.ON:
            return True
        if state == MediaState.OFF:
            return False
        return None

    async def is_candidate_mic_muted(self) -> Optional[bool]:
        """Check if candidate microphone is currently muted."""
        state = await self.check_candidate_mic()
        if state == MediaState.MUTED:
            return True
        if state == MediaState.UNMUTED:
            return False
        return None

    def can_remind_camera(self) -> bool:
        """Verify cooldown and quota for camera reminder."""
        now = time.monotonic()
        if self.camera_reminders_sent >= self.max_camera_reminders:
            return False
        if (now - self.last_camera_reminder_time) < self.camera_reminder_cooldown:
            return False
        return True

    def record_camera_reminder(self) -> None:
        """Record that a camera reminder was delivered."""
        self.camera_reminders_sent += 1
        self.last_camera_reminder_time = time.monotonic()
        logger.info(
            f"[MediaMonitor] Camera reminder recorded ({self.camera_reminders_sent}/{self.max_camera_reminders})"
        )

    def can_remind_mic(self) -> bool:
        """Verify cooldown and quota for microphone unmuting reminder."""
        now = time.monotonic()
        if self.mic_reminders_sent >= self.max_mic_reminders:
            return False
        if (now - self.last_mic_reminder_time) < self.mic_reminder_cooldown:
            return False
        return True

    def record_mic_reminder(self) -> None:
        """Record that a mic reminder was delivered."""
        self.mic_reminders_sent += 1
        self.last_mic_reminder_time = time.monotonic()
        logger.info(
            f"[MediaMonitor] Mic reminder recorded ({self.mic_reminders_sent}/{self.max_mic_reminders})"
        )

    def reset_reminders(self) -> None:
        """Reset reminder quotas upon successful candidate media action."""
        self.camera_reminders_sent = 0
        self.mic_reminders_sent = 0
