"""
Google Meet URL parsing and interaction utilities.
Provides robust selectors for pre-join setup, camera/mic controls, and join actions.
"""

import re
import time
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

    async def configure_audio_devices(
        self,
        target_mic: Optional[str] = None,
        target_speaker: Optional[str] = None,
    ) -> dict:
        """
        Configure Google Meet audio settings using Playwright UI selectors.
        Selects target microphone and target speaker from Meet's Audio Settings modal.
        Fails safely if required devices are missing.
        Returns a dict:
        {
            "success": bool,
            "selected_mic": str,
            "selected_speaker": str,
            "expected_mic": str,
            "expected_speaker": str,
            "error": Optional[str],
        }
        """
        from app.config import settings

        exp_mic = (target_mic or settings.meet_mic_device or "").strip()
        exp_speaker = (target_speaker or settings.meet_speaker_device or "").strip()

        logger.info("[MEET][AUDIO] Configuring Google Meet audio devices...")
        logger.info(f"[MEET][AUDIO] Microphone target: {exp_mic}")
        logger.info(f"[MEET][AUDIO] Speaker target: {exp_speaker}")

        result = {
            "success": False,
            "selected_mic": "",
            "selected_speaker": "",
            "expected_mic": exp_mic,
            "expected_speaker": exp_speaker,
            "error": None,
        }

        # Step 1: Open Settings dialog
        opened = await self._open_settings_dialog()
        if not opened:
            err = "GOOGLE_MEET_SETTINGS_NOT_OPENED"
            logger.error(f"[MEET][AUDIO] {err}: Failed to locate and open Google Meet settings dialog.")
            result["error"] = err
            return result

        # Step 2: Ensure "Audio" tab is active in Settings
        logger.info("[MEET][AUDIO] Navigating to Audio tab...")
        audio_tab_opened = False
        try:
            # Look for dialog container
            dialog_loc = self.page.locator('[role="dialog"]')
            if await dialog_loc.count() > 0 and await dialog_loc.first.is_visible():
                dialog = dialog_loc.first

                # Check if Audio settings controls (Microphone / Speaker) are ALREADY visible in dialog
                dialog_text = await dialog.inner_text()
                if "Microphone" in dialog_text and ("Speaker" in dialog_text or "Speakers" in dialog_text):
                    logger.info("[MEET][AUDIO] Audio navigation item detected")
                    logger.info("[MEET][AUDIO] Audio tab is already active")
                    audio_tab_opened = True
                else:
                    # Scope search for exact text "Audio" navigation tab inside the settings sidebar
                    # NEVER use button:has-text("Audio") or [aria-label*="Audio"] which match the microphone button!
                    audio_nav_candidates = dialog.get_by_text("Audio", exact=True)
                    count_candidates = await audio_nav_candidates.count()
                    target_audio_nav = None

                    for idx in range(count_candidates):
                        cand = audio_nav_candidates.nth(idx)
                        if await cand.is_visible():
                            # Check tag and attributes
                            tag = await cand.evaluate("el => el.tagName.toLowerCase()")
                            role = await cand.get_attribute("role") or ""
                            aria_selected = await cand.get_attribute("aria-selected")
                            is_active = (
                                aria_selected == "true"
                                or await cand.evaluate(
                                    "el => { const p = el.closest('[role=\"tab\"], li, button, [role=\"button\"]'); return p ? p.getAttribute('aria-selected') === 'true' || p.classList.contains('active') || p.classList.contains('selected') : false; }"
                                )
                            )

                            logger.info(
                                f"[MEET][AUDIO][DEBUG] Audio tab candidate #{idx}: tag={tag}, role={role}, "
                                f"aria-selected={aria_selected}, is_active={is_active}"
                            )

                            if is_active:
                                logger.info("[MEET][AUDIO] Audio navigation item detected")
                                logger.info("[MEET][AUDIO] Audio tab is already active")
                                audio_tab_opened = True
                                break
                            elif target_audio_nav is None:
                                target_audio_nav = cand

                    if not audio_tab_opened and target_audio_nav:
                        logger.info("[MEET][AUDIO] Audio tab is not active. Clicking exact Audio tab navigation...")
                        await target_audio_nav.evaluate(
                            "el => { const p = el.closest('[role=\"tab\"], li, button, [role=\"button\"]'); if (p) p.click(); else el.click(); }"
                        )
                        await self.page.wait_for_timeout(500)
                        # Verify dialog text updated
                        dialog_text_after = await dialog.inner_text()
                        if "Microphone" in dialog_text_after:
                            logger.info("[MEET][AUDIO] Audio tab opened successfully")
                            audio_tab_opened = True
            else:
                logger.warning("[MEET][AUDIO] Settings dialog locator not found when checking Audio tab.")
        except Exception as e:
            logger.warning(f"[MEET][AUDIO] Error verifying Audio tab: {e}")

        if not audio_tab_opened:
            err = "GOOGLE_MEET_AUDIO_TAB_NOT_OPENED"
            logger.error(f"[MEET][AUDIO] {err}: Could not confirm Audio tab inside Settings dialog.")
            result["error"] = err
            await self._close_settings_dialog()
            return result

        logger.info("[MEET][AUDIO] Audio tab opened successfully")

        # Step 3: Verify and configure Microphone device
        mic_res = await self._select_device_dropdown(
            device_type="Microphone",
            target_label=exp_mic,
            container_selectors=[
                # Look specifically for the dropdown/combobox for Microphone
                '[role="dialog"] [aria-label*="Microphone" i][role="combobox"]',
                '[role="dialog"] [aria-label*="Microphone" i][role="listbox"]',
                '[role="dialog"] div:has-text("Microphone") [role="combobox"]',
                '[role="dialog"] div:has-text("Microphone") [role="listbox"]',
                '[role="dialog"] [aria-label*="Microphone" i]',
            ],
        )

        # Step 4: Verify and configure Speaker device
        speaker_res = await self._select_device_dropdown(
            device_type="Speaker",
            target_label=exp_speaker,
            container_selectors=[
                # Look specifically for the dropdown/combobox for Speaker
                '[role="dialog"] [aria-label*="Speakers" i][role="combobox"]',
                '[role="dialog"] [aria-label*="Speaker" i][role="combobox"]',
                '[role="dialog"] [aria-label*="Speakers" i][role="listbox"]',
                '[role="dialog"] [aria-label*="Speaker" i][role="listbox"]',
                '[role="dialog"] div:has-text("Speakers") [role="combobox"]',
                '[role="dialog"] div:has-text("Speaker") [role="combobox"]',
                '[role="dialog"] [aria-label*="Speakers" i]',
                '[role="dialog"] [aria-label*="Speaker" i]',
            ],
        )

        # Step 5: Close Settings dialog
        await self._close_settings_dialog()
        await self.page.wait_for_timeout(500)

        # Step 6: Verify and assemble result
        result["selected_mic"] = mic_res.get("selected_label", "")
        result["selected_speaker"] = speaker_res.get("selected_label", "")

        logger.info(f"[MEET][AUDIO] Current microphone: {result['selected_mic']}")
        logger.info(f"[MEET][AUDIO] Current speaker: {result['selected_speaker']}")

        if not mic_res.get("success"):
            err = f"Required audio device not found: Microphone '{exp_mic}' ({mic_res.get('error')})"
            logger.error(f"[MEET][AUDIO] {err}")
            result["error"] = err
            return result

        logger.info("[MEET][AUDIO] Microphone verification passed")

        if not speaker_res.get("success"):
            err = f"Required audio device not found: Speaker '{exp_speaker}' ({speaker_res.get('error')})"
            logger.error(f"[MEET][AUDIO] {err}")
            result["error"] = err
            return result

        logger.info("[MEET][AUDIO] Speaker verification passed")
        logger.info("[MEET][AUDIO] Audio device verification passed")
        result["success"] = True
        return result

    async def _open_settings_dialog(self) -> bool:
        """
        Locate and click settings control to open Settings dialog with bounded timeouts.
        Distinguishes More options menu from the actual Settings dialog.
        Captures diagnostic screenshots and dumps visible DOM buttons/menu items.
        """
        from pathlib import Path
        debug_dir = Path(__file__).resolve().parent.parent / "debug"
        debug_dir.mkdir(parents=True, exist_ok=True)

        logger.info("[MEET][AUDIO] Opening Google Meet settings...")

        # Diagnostic 1: Log all visible buttons currently on the pre-join page
        try:
            visible_btns = await self.page.locator("button, [role='button']").all()
            btn_summaries = []
            for b in visible_btns:
                try:
                    if await b.is_visible():
                        b_text = (await b.inner_text()).strip()
                        b_aria = (await b.get_attribute("aria-label") or "").strip()
                        b_tip = (await b.get_attribute("data-tooltip") or "").strip()
                        b_title = (await b.get_attribute("title") or "").strip()
                        b_role = await b.get_attribute("role") or "button"
                        label_part = b_aria or b_tip or b_title or b_text
                        if label_part:
                            btn_summaries.append(f"tag=button, role={b_role}, text='{b_text[:40]}', aria='{b_aria[:40]}', tooltip='{b_tip[:40]}'")
                except Exception:
                    pass
            if btn_summaries:
                logger.info(f"[MEET][AUDIO][DEBUG] Visible pre-join buttons ({len(btn_summaries)}):\n- " + "\n- ".join(btn_summaries[:20]))
        except Exception as e:
            logger.debug(f"[MEET][AUDIO] Pre-join button dump note: {e}")

        # PATH A: Direct Settings button if already visible
        settings_selectors = [
            'button[aria-label*="Settings" i]',
            '[role="button"][aria-label*="Settings" i]',
            'button[data-tooltip*="Settings" i]',
            'button:has-text("Settings")',
        ]
        for sel in settings_selectors:
            loc = self.page.locator(sel)
            try:
                if await loc.count() > 0 and await loc.first.is_visible():
                    logger.info(f"[MEET][AUDIO] Direct Settings button found ({sel}). Clicking...")
                    await loc.first.click()
                    if await self._wait_for_settings_dialog(timeout_ms=5000):
                        logger.info("[MEET][AUDIO] Settings dialog detected")
                        logger.info("[MEET][AUDIO] Settings dialog opened successfully")
                        return True
            except Exception as e:
                logger.debug(f"[MEET][AUDIO] Direct settings click failed: {e}")

        logger.info("[MEET][AUDIO] Direct Settings control not found; opening More options...")

        # PATH B: Find and click More options button ONCE
        more_selectors = [
            'button[aria-label*="More options" i]',
            'div[role="button"][aria-label*="More options" i]',
            'button[aria-label*="more settings" i]',
            'button[data-tooltip*="More options" i]',
            '[aria-label*="More options" i]',
            'button:has([data-icon="more_vert"])',
            'button:has(i:has-text("more_vert"))',
        ]
        more_button = None
        clicked_selector = None

        for more_sel in more_selectors:
            loc = self.page.locator(more_sel)
            try:
                if await loc.count() > 0 and await loc.first.is_visible():
                    more_button = loc.first
                    clicked_selector = more_sel
                    break
            except Exception:
                pass

        if more_button:
            logger.info(f"[MEET][AUDIO] Clicking More options button via: {clicked_selector}")
            await more_button.click()
            # Wait short time for menu transition
            await self.page.wait_for_timeout(500)

            # Save debug screenshot immediately
            screenshot_path = str(debug_dir / "meet-more-options.png")
            try:
                await self.page.screenshot(path=screenshot_path)
                logger.info(f"[MEET][AUDIO][DEBUG] Screenshot saved to: {screenshot_path}")
            except Exception as ss_err:
                logger.debug(f"[MEET][AUDIO] Screenshot error: {ss_err}")

            # Wait a bounded amount of time (up to 5s) for visible Settings text to appear
            # Do NOT require [role="menu"]
            settings_locator = self.page.get_by_text("Settings", exact=True)
            settings_appeared = False
            for _ in range(15):
                if await settings_locator.count() > 0:
                    for idx in range(await settings_locator.count()):
                        if await settings_locator.nth(idx).is_visible():
                            settings_appeared = True
                            break
                if settings_appeared:
                    break
                await self.page.wait_for_timeout(300)

            if settings_appeared:
                logger.info("[MEET][AUDIO] More options menu opened successfully")
            else:
                logger.warning("[MEET][AUDIO] 'Settings' text not immediately visible; scanning visible elements...")

            # Inspect and log all visible Settings candidates
            count = await settings_locator.count()
            logger.info(f"[MEET][AUDIO][DEBUG] Settings candidates found: {count}")

            target_settings_el = None
            for idx in range(count):
                item = settings_locator.nth(idx)
                try:
                    if await item.is_visible():
                        tag = await item.evaluate("el => el.tagName.toLowerCase()")
                        role = await item.get_attribute("role") or ""
                        aria = (await item.get_attribute("aria-label") or "").strip()
                        title = (await item.get_attribute("title") or "").strip()
                        txt = (await item.inner_text()).strip()
                        bbox = await item.bounding_box()
                        bbox_str = f"x={int(bbox['x'])}, y={int(bbox['y'])}, w={int(bbox['width'])}, h={int(bbox['height'])}" if bbox else "none"
                        logger.info(
                            f"[MEET][AUDIO][DEBUG] Candidate #{idx}: tag={tag}, role={role}, text='{txt}', "
                            f"aria='{aria}', title='{title}', bbox=({bbox_str})"
                        )

                        if target_settings_el is None:
                            # If this element is a span or text container inside a clickable ancestor, prefer ancestor
                            is_clickable = await item.evaluate(
                                "el => el.tagName === 'BUTTON' || el.getAttribute('role') === 'menuitem' || el.getAttribute('role') === 'button' || Boolean(el.closest('button, [role=\"menuitem\"], [role=\"button\"], li'))"
                            )
                            if is_clickable:
                                target_settings_el = item
                            else:
                                target_settings_el = item
                except Exception as cand_err:
                    logger.debug(f"[MEET][AUDIO] Candidate inspect error: {cand_err}")

            # Fallback check if get_by_text didn't find visible item: check menuitem with Settings
            if not target_settings_el:
                fallback_items = self.page.locator('[role="menuitem"]:has-text("Settings"), [role="menu"] :has-text("Settings"), li:has-text("Settings")')
                if await fallback_items.count() > 0:
                    for f_idx in range(await fallback_items.count()):
                        if await fallback_items.nth(f_idx).is_visible():
                            target_settings_el = fallback_items.nth(f_idx)
                            break

            if target_settings_el:
                logger.info("[MEET][AUDIO] Settings menu item found")
                logger.info("[MEET][AUDIO] Clicking Settings...")
                try:
                    # Click either the element or its closest clickable container
                    await target_settings_el.evaluate(
                        "el => { const parent = el.closest('button, [role=\"menuitem\"], [role=\"button\"], li'); if (parent) parent.click(); else el.click(); }"
                    )
                    if await self._wait_for_settings_dialog(timeout_ms=7000):
                        logger.info("[MEET][AUDIO] Settings dialog detected")
                        logger.info("[MEET][AUDIO] Settings dialog opened successfully")
                        return True
                    else:
                        logger.error("[MEET][AUDIO] ERROR: Settings dialog did not open after clicking Settings menu item")
                        return False
                except Exception as click_err:
                    logger.error(f"[MEET][AUDIO] Error clicking Settings menu item: {click_err}")
                    return False
            else:
                logger.error("[MEET][AUDIO] Settings menu item not found after opening More options")
                # Diagnostic screenshot & dump
                fail_ss = str(debug_dir / "meet-settings-not-found.png")
                try:
                    await self.page.screenshot(path=fail_ss)
                except Exception:
                    pass

        # PATH C: Audio & Video settings icon in prejoin preview if present
        preview_audio_btns = [
            'button[aria-label*="Check your audio" i]',
            'button[aria-label*="Audio and video" i]',
            'button[aria-label*="device settings" i]',
            '[data-tooltip*="Check your audio" i]',
        ]
        for sel in preview_audio_btns:
            loc = self.page.locator(sel)
            try:
                if await loc.count() > 0 and await loc.first.is_visible():
                    logger.info(f"[MEET][AUDIO] Attempting preview device settings: {sel}")
                    await loc.first.click()
                    if await self._wait_for_settings_dialog(timeout_ms=5000):
                        logger.info("[MEET][AUDIO] Settings dialog detected")
                        logger.info("[MEET][AUDIO] Settings dialog opened successfully")
                        return True
            except Exception:
                pass

        logger.error(
            f"[MEET][AUDIO] Settings failed to open. Diagnostic summary: "
            f"more_button_found={bool(more_button)}"
        )
        return False

    async def _wait_for_settings_dialog(self, timeout_ms: int = 6000) -> bool:
        """Wait for the Settings dialog/panel to appear in DOM within timeout_ms."""
        dialog_selectors = [
            '[role="dialog"][aria-label*="Settings" i]',
            '[role="dialog"]:has-text("Audio")',
            '[role="dialog"]:has-text("Microphone")',
            '[role="dialog"]:has-text("Settings")',
            '[role="dialog"]',
        ]
        start_time = time.monotonic()
        timeout_sec = timeout_ms / 1000.0

        while (time.monotonic() - start_time) < timeout_sec:
            for sel in dialog_selectors:
                try:
                    loc = self.page.locator(sel)
                    if await loc.count() > 0 and await loc.first.is_visible():
                        return True
                except Exception:
                    pass
            await self.page.wait_for_timeout(200)

        return False

    async def _close_settings_dialog(self) -> None:
        """Close the Settings dialog cleanly."""
        close_selectors = [
            '[role="dialog"] button[aria-label*="Close" i]',
            'button[aria-label*="Close settings" i]',
            'button[aria-label*="Close" i]',
            '[role="dialog"] button:has-text("Close")',
            '[role="dialog"] button:has-text("Done")',
        ]
        for sel in close_selectors:
            loc = self.page.locator(sel)
            try:
                if await loc.count() > 0 and await loc.first.is_visible():
                    await loc.first.click()
                    logger.debug(f"[MEET][AUDIO] Closed settings dialog via {sel}")
                    return
            except Exception:
                pass
        try:
            await self.page.keyboard.press("Escape")
        except Exception:
            pass

    async def _select_device_dropdown(
        self,
        device_type: str,
        target_label: str,
        container_selectors: list,
    ) -> dict:
        """
        Find and select target_label in the specified device selector.
        Supports HTML select elements, custom ARIA comboboxes, and listbox menus.
        Matches with tolerance: exact match > normalized case/whitespace > substring match.
        """
        norm_target = " ".join(target_label.lower().split())

        # Attempt A: Native <select> elements inside settings dialog
        select_els = await self.page.locator('[role="dialog"] select').all()
        for s_el in select_els:
            try:
                if not await s_el.is_visible():
                    continue
                # Inspect options in this select
                options = await s_el.locator("option").all()
                for opt in options:
                    opt_text = (await opt.inner_text()).strip()
                    norm_opt = " ".join(opt_text.lower().split())
                    if norm_target in norm_opt or norm_opt in norm_target:
                        val = await opt.get_attribute("value")
                        if val:
                            await s_el.select_option(value=val)
                        else:
                            await s_el.select_option(label=opt_text)
                        return {"success": True, "selected_label": opt_text}
            except Exception:
                pass

        # Attempt B: Click combobox/listbox container to reveal dropdown options
        for sel in container_selectors:
            loc = self.page.locator(sel)
            try:
                if await loc.count() == 0 or not await loc.first.is_visible():
                    continue

                # Check if current value already matches target
                current_text = (await loc.first.inner_text() or await loc.first.get_attribute("aria-label") or "").strip()
                norm_current = " ".join(current_text.lower().split())
                if norm_target in norm_current or (norm_current and norm_current in norm_target):
                    return {"success": True, "selected_label": current_text}

                # Click dropdown to open option menu
                await loc.first.click()
                await self.page.wait_for_timeout(500)

                # Look for matching option in the revealed listbox / menu / options
                option_locators = [
                    self.page.locator('[role="option"]'),
                    self.page.locator('[role="listbox"] [role="option"]'),
                    self.page.locator('li[role="option"]'),
                    self.page.locator('[role="menuitemradio"]'),
                ]
                for opt_group in option_locators:
                    count = await opt_group.count()
                    for idx in range(count):
                        item = opt_group.nth(idx)
                        text = (await item.inner_text() or await item.get_attribute("aria-label") or "").strip()
                        norm_item = " ".join(text.lower().split())

                        if norm_target in norm_item or norm_item in norm_target:
                            await item.click()
                            await self.page.wait_for_timeout(300)
                            return {"success": True, "selected_label": text}

                # If no matching option clicked, press Escape to close this dropdown
                await self.page.keyboard.press("Escape")
                await self.page.wait_for_timeout(300)

            except Exception as e:
                logger.debug(f"[MEET][AUDIO] Selector attempt error on {sel}: {e}")

        return {
            "success": False,
            "selected_label": "",
            "error": f"Device label '{target_label}' not found among available options.",
        }

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
            'span:has-text("Asking to join")',
            'div:has-text("Someone in the call will let you in shortly")',
            'button:has-text("Cancel")',
        ]
        for selector in waiting_indicators:
            try:
                loc = self.page.locator(selector)
                if await loc.count() > 0 and await loc.first.is_visible():
                    return True
            except Exception:
                pass
        return False

    async def verify_meeting_admission(self) -> dict:
        """
        Verify with multi-signal evidence that the bot is genuinely inside the active meeting:
        1. Waiting-for-admission dialog/text is strictly ABSENT.
        2. Meeting room UI is present (e.g. participant list, chat, meeting details, main grid).
        3. Active in-call toolbar is present (e.g. bottom bar with End call AND People/Chat/Captions).
        Returns a dict with `is_inside: bool`, `evidence: list[str]`, and `waiting_detected: bool`.
        """
        waiting = await self.is_waiting_for_admission()
        if waiting:
            return {
                "is_inside": False,
                "waiting_detected": True,
                "evidence": ["Waiting dialog or 'Asking to join' text is currently visible"],
            }

        evidence = []

        # Signal 1: In-call bottom control bar / Leave call button
        leave_call_selectors = [
            'button[aria-label*="Leave call" i]',
            'button[aria-label*="End call" i]',
            'div[aria-label*="Leave call" i]',
            'button[data-tooltip*="Leave call" i]',
        ]
        has_leave = False
        for sel in leave_call_selectors:
            loc = self.page.locator(sel)
            if await loc.count() > 0 and await loc.first.is_visible():
                has_leave = True
                evidence.append(f"In-call leave control present ({sel})")
                break

        # Signal 2: Active in-call companion controls (People, Chat, Meeting details, Activities)
        # Note: These NEVER exist on the pre-join or waiting-to-join modal.
        incall_dock_selectors = [
            'button[aria-label*="People" i]',
            'button[aria-label*="Chat with everyone" i]',
            'button[aria-label*="Meeting details" i]',
            'button[aria-label*="Activities" i]',
            'button[aria-label*="Show everyone" i]',
        ]
        has_dock = False
        for sel in incall_dock_selectors:
            loc = self.page.locator(sel)
            if await loc.count() > 0 and await loc.first.is_visible():
                has_dock = True
                evidence.append(f"In-call companion dock control present ({sel})")
                break

        # Signal 3: In-call layout/captions/grid container
        layout_selectors = [
            '[data-allocation-index]',
            'div[data-call-client-version]',
            'div[role="region"][aria-label*="call" i]',
            'button[aria-label*="Turn on captions" i]',
            'button[aria-label*="Turn off captions" i]',
        ]
        has_layout = False
        for sel in layout_selectors:
            loc = self.page.locator(sel)
            if await loc.count() > 0 and await loc.first.is_visible():
                has_layout = True
                evidence.append(f"In-call layout/caption control present ({sel})")
                break

        # Strict requirement: Waiting must NOT be active, AND we must see Leave Call AND (Dock OR Layout)
        is_inside = (not waiting) and has_leave and (has_dock or has_layout)

        return {
            "is_inside": is_inside,
            "waiting_detected": waiting,
            "evidence": evidence,
        }

    async def is_inside_meeting(self, timeout_ms: int = 15000) -> bool:
        """
        Determine whether the bot has successfully transitioned into the active meeting room.
        Requires multi-signal confirmation and strict absence of waiting screens.
        """
        waited = 0
        step = 1000

        while waited < timeout_ms:
            res = await self.verify_meeting_admission()
            if res["is_inside"]:
                logger.info(f"[MeetingBot] Confirmed in-meeting with evidence: {', '.join(res['evidence'])}")
                return True
            await self.page.wait_for_timeout(step)
            waited += step

        return False

    async def get_participant_count(self) -> int:
        """
        Detect number of participants currently in Google Meet from UI badges and people panel.
        Returns:
            int: detected count (defaults to 1 if bot is sole participant).
        """
        try:
            # Check 1: Button aria-label such as "People (2)", "Show everyone (2)"
            people_buttons = self.page.locator(
                'button[aria-label*="People" i], button[aria-label*="Show everyone" i]'
            )
            count = await people_buttons.count()
            for i in range(count):
                btn = people_buttons.nth(i)
                if await btn.is_visible():
                    aria = (await btn.get_attribute("aria-label") or "")
                    text = (await btn.inner_text() or "")
                    # Extract digits from e.g. "People (2)" or innerText "2"
                    m = re.search(r"\((\d+)\)", aria) or re.search(r"\b(\d+)\b", text)
                    if m:
                        return int(m.group(1))

            # Check 2: Participant video tiles or grid elements ([data-participant-id] or [data-allocation-index])
            tiles = self.page.locator("[data-participant-id], [data-allocation-index]")
            tile_count = await tiles.count()
            if tile_count > 0:
                return tile_count

        except Exception as e:
            logger.debug(f"[MEET] Error detecting participant count: {e}")

        # Default fallback when bot is alone inside meeting
        return 1

    async def is_candidate_present(self) -> bool:
        """
        Check if any candidate / other participant has joined the Google Meet.
        Distinguishes BOT_ONLY (count <= 1) from CANDIDATE_PRESENT (count >= 2).
        """
        count = await self.get_participant_count()
        return count >= 2

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
                logger.info("[MEET] Leaving meeting")
                logger.info("[MeetingBot] Clicked 'Leave call' button")
        except Exception as e:
            logger.debug(f"[MeetingBot] Leave call note: {e}")

    async def is_microphone_muted(self) -> Optional[bool]:
        """
        Check if the in-call microphone is currently muted.
        Returns:
            True if microphone is muted
            False if microphone is unmuted
            None if unable to determine
        """
        mute_indicators = [
            'button[aria-label*="Turn on microphone" i]',
            'div[role="button"][aria-label*="Turn on microphone" i]',
            'button[data-is-muted="true"][aria-label*="microphone" i]',
            'button[data-is-muted="true"][aria-label*="mic" i]',
        ]
        unmute_indicators = [
            'button[aria-label*="Turn off microphone" i]',
            'div[role="button"][aria-label*="Turn off microphone" i]',
            'button[data-is-muted="false"][aria-label*="microphone" i]',
            'button[data-is-muted="false"][aria-label*="mic" i]',
        ]

        for sel in mute_indicators:
            loc = self.page.locator(sel)
            if await loc.count() > 0 and await loc.first.is_visible():
                return True

        for sel in unmute_indicators:
            loc = self.page.locator(sel)
            if await loc.count() > 0 and await loc.first.is_visible():
                return False

        return None

    async def unmute_microphone(self) -> bool:
        """
        Unmute the Google Meet microphone when AI needs to speak.
        Verifies that bot is inside the meeting and that the mic state transitions to unmuted.
        """
        # Selectors for button that turns ON the microphone (currently muted)
        unmute_buttons = [
            'button[aria-label*="Turn on microphone" i]',
            'div[role="button"][aria-label*="Turn on microphone" i]',
            'button[data-is-muted="true"][aria-label*="microphone" i]',
            'button[data-is-muted="true"][aria-label*="mic" i]',
        ]

        for sel in unmute_buttons:
            loc = self.page.locator(sel)
            if await loc.count() > 0 and await loc.first.is_visible():
                await loc.first.click(timeout=3000)
                await self.page.wait_for_timeout(300)
                logger.info("[MEET] Microphone unmuted")
                return True

        # Check if already unmuted
        muted = await self.is_microphone_muted()
        if muted is False:
            logger.info("[MEET] Microphone is already unmuted")
            return True

        # Fallback to standard Google Meet shortcut: Ctrl + D
        logger.info("[MEET] Attempting keyboard shortcut (Ctrl+D) to unmute microphone...")
        await self.page.keyboard.press("Control+d")
        await self.page.wait_for_timeout(400)
        muted = await self.is_microphone_muted()
        if muted is False:
            logger.info("[MEET] Microphone unmuted via Ctrl+D")
            return True

        logger.warning("[MEET] Could not confirm microphone unmute via controls or shortcut.")
        return False

    async def mute_microphone(self) -> bool:
        """
        Mute the Google Meet microphone when AI finishes speaking.
        """
        # Selectors for button that turns OFF the microphone (currently unmuted)
        mute_buttons = [
            'button[aria-label*="Turn off microphone" i]',
            'div[role="button"][aria-label*="Turn off microphone" i]',
            'button[data-is-muted="false"][aria-label*="microphone" i]',
            'button[data-is-muted="false"][aria-label*="mic" i]',
        ]

        for sel in mute_buttons:
            loc = self.page.locator(sel)
            if await loc.count() > 0 and await loc.first.is_visible():
                await loc.first.click(timeout=3000)
                await self.page.wait_for_timeout(300)
                logger.info("[MEET] Microphone muted")
                return True

        # Check if already muted
        muted = await self.is_microphone_muted()
        if muted is True:
            logger.info("[MEET] Microphone is already muted")
            return True

        # Fallback to shortcut
        logger.info("[MEET] Attempting keyboard shortcut (Ctrl+D) to mute microphone...")
        await self.page.keyboard.press("Control+d")
        await self.page.wait_for_timeout(400)
        muted = await self.is_microphone_muted()
        if muted is True:
            logger.info("[MEET] Microphone muted via Ctrl+D")
            return True

        logger.warning("[MEET] Could not confirm microphone mute via controls or shortcut.")
        return False

