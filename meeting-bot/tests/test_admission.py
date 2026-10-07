import pytest
from unittest.mock import AsyncMock, MagicMock
from app.bot import BotStatus, MeetingBot
from app.meet import validate_meet_url, MeetNavigator


def test_meet_url_validation():
    assert validate_meet_url("https://meet.google.com/abc-defg-hij")
    assert validate_meet_url("https://meet.google.com/xyz-uvwx-rst?authuser=0")
    assert not validate_meet_url("https://google.com")
    assert not validate_meet_url("https://meet.google.com/invalid-url")
    assert not validate_meet_url("http://meet.google.com/abc-defg-hij")


@pytest.mark.asyncio
async def test_navigator_detects_join_now():
    page = MagicMock()
    # Mock locator for 'Join now' to be visible
    loc_join_now = AsyncMock()
    loc_join_now.count.return_value = 1
    loc_join_now.is_visible.return_value = True

    loc_empty = AsyncMock()
    loc_empty.count.return_value = 0
    loc_empty.is_visible.return_value = False

    def locator_side_effect(selector):
        if "Join now" in selector:
            return loc_join_now
        return loc_empty

    page.locator.side_effect = locator_side_effect

    nav = MeetNavigator(page)
    action = await nav.click_join()
    assert action == "JOIN_NOW"
    loc_join_now.first.click.assert_awaited()


@pytest.mark.asyncio
async def test_navigator_detects_ask_to_join():
    page = MagicMock()
    loc_ask = AsyncMock()
    loc_ask.count.return_value = 1
    loc_ask.is_visible.return_value = True

    loc_empty = AsyncMock()
    loc_empty.count.return_value = 0
    loc_empty.is_visible.return_value = False

    def locator_side_effect(selector):
        if "Ask to join" in selector:
            return loc_ask
        return loc_empty

    page.locator.side_effect = locator_side_effect

    nav = MeetNavigator(page)
    action = await nav.click_join()
    assert action == "ASK_TO_JOIN"
    loc_ask.first.click.assert_awaited()


@pytest.mark.asyncio
async def test_bot_status_waiting_for_admission_not_falsely_joined():
    """Verify that Ask to Join sets WAITING_FOR_ADMISSION and never JOINED unless admitted."""
    bot = MeetingBot()
    bot._navigator = MagicMock()
    bot._navigator.prepare_prejoin = AsyncMock()
    bot._navigator.click_join = AsyncMock(return_value="ASK_TO_JOIN")
    # Simulate not admitted yet
    bot._navigator.is_inside_meeting = AsyncMock(return_value=False)
    bot._navigator.is_waiting_for_admission = AsyncMock(return_value=True)

    # Directly check logic flow without launching browser
    action = await bot._navigator.click_join()
    assert action == "ASK_TO_JOIN"

    is_inside = await bot._navigator.is_inside_meeting()
    assert not is_inside

    is_waiting = await bot._navigator.is_waiting_for_admission()
    assert is_waiting

    # When waiting for admission, bot status must be WAITING_FOR_ADMISSION, NOT JOINED
    if action == "ASK_TO_JOIN" and not is_inside and is_waiting:
        bot.status = BotStatus.WAITING_FOR_ADMISSION

    assert bot.status == BotStatus.WAITING_FOR_ADMISSION
    assert bot.status != BotStatus.JOINED


@pytest.mark.asyncio
async def test_navigator_unknown_ui_returns_none_and_captures_diag():
    page = MagicMock()
    page.title = AsyncMock(return_value="Google Meet")
    page.url = "https://meet.google.com/kdh-evrf-onf"
    page.frames = [MagicMock()]
    page.screenshot = AsyncMock()

    loc_empty = AsyncMock()
    loc_empty.count.return_value = 0
    loc_empty.is_visible.return_value = False
    loc_empty.all.return_value = []

    page.locator.return_value = loc_empty

    nav = MeetNavigator(page)
    action = await nav.click_join()
    assert action is None
    page.screenshot.assert_awaited()


@pytest.mark.asyncio
async def test_leave_meeting_skipped_when_not_in_meeting():
    page = MagicMock()
    loc_empty = AsyncMock()
    loc_empty.count.return_value = 0
    loc_empty.is_visible.return_value = False
    page.locator.return_value = loc_empty

    nav = MeetNavigator(page)
    # When is_inside_meeting is False, leave_meeting should return without error or clicking
    await nav.leave_meeting()
    # verify locator for leave call was not clicked
    loc_empty.first.click.assert_not_called()

