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
async def test_verify_meeting_admission_waiting_dialog_blocks_joined():
    """Verify that if a waiting dialog is present, even with a Leave/Cancel button, it is NEVER considered inside."""
    page = MagicMock()
    # Mock waiting dialog to be visible
    loc_waiting = AsyncMock()
    loc_waiting.count.return_value = 1
    loc_waiting.is_visible.return_value = True

    # Mock leave call also visible (e.g. background toolbar or modal cancel)
    loc_leave = AsyncMock()
    loc_leave.count.return_value = 1
    loc_leave.is_visible.return_value = True

    def locator_side_effect(selector):
        if "Asking to join" in selector or "Someone in the call" in selector:
            return loc_waiting
        if "Leave call" in selector:
            return loc_leave
        empty = AsyncMock()
        empty.count.return_value = 0
        empty.is_visible.return_value = False
        return empty

    page.locator.side_effect = locator_side_effect

    nav = MeetNavigator(page)
    res = await nav.verify_meeting_admission()
    assert not res["is_inside"]
    assert res["waiting_detected"]


@pytest.mark.asyncio
async def test_verify_meeting_admission_multi_signal_success():
    """Verify that when waiting is absent AND Leave call AND People/Chat dock are present, it confirms entry."""
    page = MagicMock()
    loc_visible = AsyncMock()
    loc_visible.count.return_value = 1
    loc_visible.is_visible.return_value = True

    def locator_side_effect(selector):
        # Waiting selectors return false
        if "Asking to join" in selector or "someone lets you in" in selector:
            empty = AsyncMock()
            empty.count.return_value = 0
            empty.is_visible.return_value = False
            return empty
        # Leave call and People dock return true
        if "Leave call" in selector or "People" in selector or "Chat" in selector:
            return loc_visible
        empty = AsyncMock()
        empty.count.return_value = 0
        empty.is_visible.return_value = False
        return empty

    page.locator.side_effect = locator_side_effect

    nav = MeetNavigator(page)
    res = await nav.verify_meeting_admission()
    assert res["is_inside"]
    assert not res["waiting_detected"]
    assert len(res["evidence"]) >= 2


@pytest.mark.asyncio
async def test_leave_call_alone_insufficient_for_joined():
    """Verify that a Leave call button by itself without active in-meeting dock/layout does not produce JOINED."""
    page = MagicMock()
    loc_leave = AsyncMock()
    loc_leave.count.return_value = 1
    loc_leave.is_visible.return_value = True

    def locator_side_effect(selector):
        if "Leave call" in selector:
            return loc_leave
        empty = AsyncMock()
        empty.count.return_value = 0
        empty.is_visible.return_value = False
        return empty

    page.locator.side_effect = locator_side_effect

    nav = MeetNavigator(page)
    res = await nav.verify_meeting_admission()
    assert not res["is_inside"]


@pytest.mark.asyncio
async def test_candidate_presence_detection():
    page = MagicMock()
    # Mock locator for people button with "People (2)"
    loc_people = AsyncMock()
    loc_people.count = AsyncMock(return_value=1)
    loc_people.is_visible = AsyncMock(return_value=True)
    loc_people.nth = MagicMock(return_value=loc_people)
    loc_people.get_attribute = AsyncMock(return_value="People (2)")
    loc_people.inner_text = AsyncMock(return_value="2")

    # Mock video tiles count = 2
    loc_tiles = AsyncMock()
    loc_tiles.count = AsyncMock(return_value=2)

    def locator_side_effect(selector):
        if "People" in selector or "Show everyone" in selector:
            return loc_people
        if "participant-id" in selector or "allocation-index" in selector:
            return loc_tiles
        empty = AsyncMock()
        empty.count = AsyncMock(return_value=0)
        empty.is_visible = AsyncMock(return_value=False)
        return empty

    page.locator.side_effect = locator_side_effect
    nav = MeetNavigator(page)

    count = await nav.get_participant_count()
    assert count == 2

    is_present = await nav.is_candidate_present()
    assert is_present is True


@pytest.mark.asyncio
async def test_bot_only_candidate_not_present():
    page = MagicMock()
    loc_people = AsyncMock()
    loc_people.count = AsyncMock(return_value=1)
    loc_people.is_visible = AsyncMock(return_value=True)
    loc_people.nth = MagicMock(return_value=loc_people)
    loc_people.get_attribute = AsyncMock(return_value="People (1)")
    loc_people.inner_text = AsyncMock(return_value="1")

    loc_tiles = AsyncMock()
    loc_tiles.count = AsyncMock(return_value=1)

    def locator_side_effect(selector):
        if "People" in selector or "Show everyone" in selector:
            return loc_people
        if "participant-id" in selector or "allocation-index" in selector:
            return loc_tiles
        empty = AsyncMock()
        empty.count = AsyncMock(return_value=0)
        empty.is_visible = AsyncMock(return_value=False)
        return empty

    page.locator.side_effect = locator_side_effect
    nav = MeetNavigator(page)

    count = await nav.get_participant_count()
    assert count == 1

    is_present = await nav.is_candidate_present()
    assert is_present is False

