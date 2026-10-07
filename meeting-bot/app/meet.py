"""
Google Meet URL parsing and interaction utilities.
Provides robust selectors for pre-join setup, camera/mic controls, and join actions.
"""

import re
import logging
from typing import Optional
from playwright.async_api import Page, TimeoutError as PlaywrightTimeoutError

logger = logging.getLogger("MeetingBot.Meet")

# Regex pattern for Google Meet URLs
MEET_URL_PATTERN = re.compile(
    r"^https:\/\/meet\.google\.com\/[a-zA-Z0-9]{3}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{3}(\?.*)?$"
)


def validate_meet_url(url: str) -> bool:
    """Validate that the URL is a genuine Google Meet URL."""
    if not url or not isinstance(url, str):
        return False
    return bool(MEET_URL_PATTERN.match(url.strip()))


class MeetNavigator:
    """Manages the page lifecycle, pre-join controls, and joining a Google Meet room."""

    def __init__(self, page: Page):
        self.page = page

    async def prepare_prejoin(self) -> None:
        """
        Handle pre-join screen: dismiss alerts, turn off camera/microphone if requested.
        Uses accessible roles and stable attribute selectors with retries.
        """
        logger.info("[MeetingBot] Handling pre-join screen setup...")

        # Dismiss "Got it" / dismiss prompts if any appear
        try:
            dismiss_buttons = [
                self.page.locator('button:has-text("Got it")'),
                self.page.locator('button:has-text("Dismiss")'),
                self.page.locator('button[aria-label="Close"]'),
            ]
            for btn in dismiss_buttons:
                if await btn.count() > 0 and await btn.first.is_visible():
                    await btn.first.click(timeout=2000)
                    logger.info("[MeetingBot] Dismissed informational dialog")
        except Exception as e:
            logger.debug(f"[MeetingBot] No informational dialog to dismiss: {e}")

        # Turn off camera if active (aria-label containing "Turn off camera")
        try:
            cam_toggle = self.page.locator(
                'button[aria-label*="Turn off camera" i], '
                'div[role="button"][aria-label*="Turn off camera" i], '
                'button[data-is-muted="false"][aria-label*="camera" i]'
            )
            if await cam_toggle.count() > 0 and await cam_toggle.first.is_visible():
                await cam_toggle.first.click()
                logger.info("[MeetingBot] Camera turned off")
        except Exception as e:
            logger.debug(f"[MeetingBot] Camera toggle note: {e}")

        # Ensure microphone is muted or configured for Phase 1
        try:
            mic_toggle = self.page.locator(
                'button[aria-label*="Turn off microphone" i], '
                'div[role="button"][aria-label*="Turn off microphone" i]'
            )
            if await mic_toggle.count() > 0 and await mic_toggle.first.is_visible():
                await mic_toggle.first.click()
                logger.info("[MeetingBot] Microphone muted for Phase 1 pre-join")
        except Exception as e:
            logger.debug(f"[MeetingBot] Microphone toggle note: {e}")

    async def click_join(self) -> bool:
        """
        Identify and click the 'Join now' or 'Ask to join' button.
        Returns True if a join button was found and clicked, False otherwise.
        """
        logger.info("[MeetingBot] Attempting to click Join button...")

        join_selectors = [
            'button:has-text("Join now")',
            'button:has-text("Ask to join")',
            'span:has-text("Join now")',
            'span:has-text("Ask to join")',
            'div[role="button"]:has-text("Join now")',
            'div[role="button"]:has-text("Ask to join")',
            'button[aria-label*="Join now" i]',
            'button[aria-label*="Ask to join" i]',
        ]

        for selector in join_selectors:
            locator = self.page.locator(selector)
            try:
                if await locator.count() > 0 and await locator.first.is_visible():
                    await locator.first.click(timeout=5000)
                    logger.info(f"[MeetingBot] Clicked join control via selector: {selector}")
                    return True
            except Exception as e:
                logger.debug(f"[MeetingBot] Selector {selector} not clickable: {e}")

        logger.warning("[MeetingBot] No standard 'Join now' or 'Ask to join' button found.")
        return False

    async def is_inside_meeting(self, timeout_ms: int = 15000) -> bool:
        """
        Determine whether the bot has successfully transitioned into the active meeting room.
        Checks for in-meeting controls (e.g. Leave call button, meeting details, chat, participant list).
        """
        in_meeting_indicators = [
            'button[aria-label*="Leave call" i]',
            'button[aria-label*="End call" i]',
            'div[aria-label*="Leave call" i]',
            'button[data-tooltip*="Leave call" i]',
            'button[aria-label*="Meeting details" i]',
            'button[aria-label*="People" i]',
            'button[aria-label*="Chat with everyone" i]',
        ]

        end_time = self.page.context.browser.is_connected()  # just to check loop
        waited = 0
        step = 1000

        while waited < timeout_ms:
            for selector in in_meeting_indicators:
                try:
                    loc = self.page.locator(selector)
                    if await loc.count() > 0 and await loc.first.is_visible():
                        logger.info(f"[MeetingBot] Confirmed in-meeting via element: {selector}")
                        return True
                except Exception:
                    pass
            await self.page.wait_for_timeout(step)
            waited += step

        return False

    async def leave_meeting(self) -> None:
        """Attempt to click the Leave Call button gracefully."""
        try:
            leave_btn = self.page.locator('button[aria-label*="Leave call" i], button[aria-label*="End call" i]')
            if await leave_btn.count() > 0 and await leave_btn.first.is_visible():
                await leave_btn.first.click(timeout=3000)
                logger.info("[MeetingBot] Clicked 'Leave call' button")
        except Exception as e:
            logger.debug(f"[MeetingBot] Leave call note: {e}")
