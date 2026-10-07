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

    async def dump_prejoin_diagnostics(self) -> dict:
        """
        Collect safe, non-sensitive diagnostic information from the pre-join page:
        - document title, current URL
        - visible buttons, their text, accessible names, aria-labels, and role=button elements
        - whether iframes exist
        """
        diagnostics = {
            "title": await self.page.title(),
            "url": self.page.url,
            "buttons": [],
            "role_buttons": [],
            "headings": [],
            "iframes_count": len(self.page.frames),
        }

        try:
            # Query all button elements
            buttons = await self.page.locator("button").all()
            for btn in buttons:
                try:
                    if await btn.is_visible():
                        text = (await btn.inner_text()).strip()
                        aria = (await btn.get_attribute("aria-label") or "").strip()
                        role = await btn.get_attribute("role") or "button"
                        diagnostics["buttons"].append({
                            "text": text[:60] if text else "",
                            "aria_label": aria[:60] if aria else "",
                            "role": role,
                        })
                except Exception:
                    pass

            # Query all role="button" elements
            role_btns = await self.page.locator('[role="button"]').all()
            for r_btn in role_btns:
                try:
                    if await r_btn.is_visible():
                        text = (await r_btn.inner_text()).strip()
                        aria = (await r_btn.get_attribute("aria-label") or "").strip()
                        diagnostics["role_buttons"].append({
                            "text": text[:60] if text else "",
                            "aria_label": aria[:60] if aria else "",
                        })
                except Exception:
                    pass

            # Query visible headings or main indicators
            headings = await self.page.locator("h1, h2, [role='heading']").all()
            for h in headings:
                try:
                    if await h.is_visible():
                        htext = (await h.inner_text()).strip()
                        if htext:
                            diagnostics["headings"].append(htext[:80])
                except Exception:
                    pass
        except Exception as e:
            logger.debug(f"[MeetingBot] Diagnostics collection note: {e}")

        return diagnostics

    async def capture_failure_screenshot(self, prefix: str = "prejoin_failure") -> Optional[str]:
        """Save a diagnostic screenshot to meeting-bot/diagnostics/ when join-control detection fails."""
        try:
            from pathlib import Path
            from datetime import datetime

            diag_dir = Path(__file__).resolve().parent.parent / "diagnostics"
            diag_dir.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            file_path = diag_dir / f"{prefix}_{timestamp}.png"
            await self.page.screenshot(path=str(file_path), full_page=True)
            logger.info(f"[MeetingBot] Diagnostic screenshot saved: {file_path}")
            return str(file_path)
        except Exception as e:
            logger.warning(f"[MeetingBot] Failed to capture diagnostic screenshot: {e}")
            return None

    async def get_join_action(self) -> Optional[str]:
        """
        Check if 'Join now' or 'Ask to join' is visible on the pre-join page.
        Returns 'JOIN_NOW', 'ASK_TO_JOIN', or None.
        """
        # 1. Direct join selectors
        join_now_selectors = [
            'button:has-text("Join now")',
            'span:has-text("Join now")',
            'div[role="button"]:has-text("Join now")',
            'button[aria-label*="Join now" i]',
            '[role="button"][aria-label*="Join now" i]',
            'button:text-is("Join now")',
            'button:has-text("Join")',
        ]
        for sel in join_now_selectors:
            loc = self.page.locator(sel)
            try:
                if await loc.count() > 0 and await loc.first.is_visible():
                    return "JOIN_NOW"
            except Exception:
                pass

        # 2. Ask to join selectors
        ask_to_join_selectors = [
            'button:has-text("Ask to join")',
            'span:has-text("Ask to join")',
            'div[role="button"]:has-text("Ask to join")',
            'button[aria-label*="Ask to join" i]',
            '[role="button"][aria-label*="Ask to join" i]',
            'button:text-is("Ask to join")',
        ]
        for sel in ask_to_join_selectors:
            loc = self.page.locator(sel)
            try:
                if await loc.count() > 0 and await loc.first.is_visible():
                    return "ASK_TO_JOIN"
            except Exception:
                pass

        return None

    async def click_join(self) -> Optional[str]:
        """
        Identify and click 'Join now' or 'Ask to join'.
        Returns:
            'JOIN_NOW': Clicked direct join button
            'ASK_TO_JOIN': Clicked admission request button
            None: No join control found
        """
        logger.info("[MeetingBot] Inspecting pre-join join control...")

        # 1. First priority: Check for direct "Join now"
        join_now_selectors = [
            'button:has-text("Join now")',
            'span:has-text("Join now")',
            'div[role="button"]:has-text("Join now")',
            'button[aria-label*="Join now" i]',
            '[role="button"][aria-label*="Join now" i]',
            'button:text-is("Join now")',
            # Fallback for plain "Join" button if present
            'button:text-matches("^Join$", "i")',
            'div[role="button"]:text-matches("^Join$", "i")',
        ]
        for selector in join_now_selectors:
            locator = self.page.locator(selector)
            try:
                if await locator.count() > 0 and await locator.first.is_visible():
                    await locator.first.click(timeout=5000)
                    logger.info(f"[MeetingBot] Detected and clicked 'Join now' via: {selector}")
                    return "JOIN_NOW"
            except Exception as e:
                logger.debug(f"[MeetingBot] Join now selector {selector} note: {e}")

        # 2. Second priority: Check for "Ask to join"
        ask_to_join_selectors = [
            'button:has-text("Ask to join")',
            'span:has-text("Ask to join")',
            'div[role="button"]:has-text("Ask to join")',
            'button[aria-label*="Ask to join" i]',
            '[role="button"][aria-label*="Ask to join" i]',
            'button:text-is("Ask to join")',
        ]
        for selector in ask_to_join_selectors:
            locator = self.page.locator(selector)
            try:
                if await locator.count() > 0 and await locator.first.is_visible():
                    await locator.first.click(timeout=5000)
                    logger.warning(f"[MeetingBot] Detected and clicked 'Ask to join' via: {selector}")
                    return "ASK_TO_JOIN"
            except Exception as e:
                logger.debug(f"[MeetingBot] Ask to join selector {selector} note: {e}")

        # Dump diagnostic information if join controls were not found
        diagnostics = await self.dump_prejoin_diagnostics()
        logger.warning(
            f"[MeetingBot] Diagnostic dump on pre-join page: Title='{diagnostics.get('title')}', "
            f"URL='{diagnostics.get('url')}', Headings={diagnostics.get('headings')}"
        )
        if diagnostics.get("buttons"):
            logger.info(f"[MeetingBot] Visible buttons found: {diagnostics['buttons'][:10]}")
        if diagnostics.get("role_buttons"):
            logger.info(f"[MeetingBot] Visible role='button' elements: {diagnostics['role_buttons'][:10]}")

        # Capture diagnostic screenshot
        await self.capture_failure_screenshot("no_join_button")

        logger.warning("[MeetingBot] No 'Join now' or 'Ask to join' button found.")
        return None

    async def is_waiting_for_admission(self) -> bool:
        """
        Check if the bot is currently on the waiting screen (e.g. 'Asking to join...',
        'Someone in the call will let you in shortly', or 'You'll join the call when someone lets you in').
        """
        waiting_indicators = [
            'text="Asking to join"',
            'text="someone lets you in"',
            'text="will let you in shortly"',
            'text="Waiting for the host"',
            'div:has-text("Asking to join")',
            'p:has-text("will let you in shortly")',
        ]
        for selector in waiting_indicators:
            try:
                loc = self.page.locator(selector)
                if await loc.count() > 0 and await loc.first.is_visible():
                    return True
            except Exception:
                pass
        return False

    async def is_inside_meeting(self, timeout_ms: int = 15000) -> bool:
        """
        Determine whether the bot has successfully transitioned into the active meeting room.
        Checks strictly for in-meeting controls (e.g. Leave call button, meeting details, chat, participant list).
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
        """Attempt to click the Leave Call button gracefully only when actually inside meeting."""
        try:
            # First verify we are actually in a meeting before clicking leave
            in_meeting = await self.is_inside_meeting(timeout_ms=1000)
            if not in_meeting:
                logger.debug("[MeetingBot] Not in an active meeting; skipping leave_meeting click.")
                return

            leave_btn = self.page.locator('button[aria-label*="Leave call" i], button[aria-label*="End call" i]')
            if await leave_btn.count() > 0 and await leave_btn.first.is_visible():
                await leave_btn.first.click(timeout=3000)
                logger.info("[MeetingBot] Clicked 'Leave call' button")
        except Exception as e:
            logger.debug(f"[MeetingBot] Leave call note: {e}")
