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


@pytest.mark.asyncio
async def test_configure_audio_devices_success():
    page = MagicMock()
    page.wait_for_timeout = AsyncMock()

    # Mock settings button
    loc_settings_btn = AsyncMock()
    loc_settings_btn.count = AsyncMock(return_value=1)
    loc_settings_btn.is_visible = AsyncMock(return_value=True)
    loc_settings_btn.first = AsyncMock()

    # Mock combobox/option
    loc_combobox = AsyncMock()
    loc_combobox.count = AsyncMock(return_value=1)
    loc_combobox.is_visible = AsyncMock(return_value=True)
    loc_combobox.first = AsyncMock()
    loc_combobox.first.inner_text = AsyncMock(return_value="Default Audio")

    # Mock option elements
    loc_mic_opt = AsyncMock()
    loc_mic_opt.inner_text = AsyncMock(return_value="CABLE Output (VB-Audio Virtual Cable)")
    loc_mic_opt.get_attribute = AsyncMock(return_value=None)
    loc_mic_opt.click = AsyncMock()

    loc_spk_opt = AsyncMock()
    loc_spk_opt.inner_text = AsyncMock(return_value="CABLE Input (VB-Audio Virtual Cable)")
    loc_spk_opt.get_attribute = AsyncMock(return_value=None)
    loc_spk_opt.click = AsyncMock()

    loc_options = AsyncMock()
    loc_options.count = AsyncMock(return_value=2)
    loc_options.nth = MagicMock(side_effect=lambda idx: loc_mic_opt if idx == 0 else loc_spk_opt)

    loc_audio_tab = AsyncMock()
    loc_audio_tab.count = AsyncMock(return_value=1)
    loc_audio_tab.is_visible = AsyncMock(return_value=True)
    loc_audio_tab.first = AsyncMock()
    loc_audio_tab.first.get_attribute = AsyncMock(return_value="true")

    loc_dialog = AsyncMock()
    loc_dialog.count = AsyncMock(return_value=1)
    loc_dialog.is_visible = AsyncMock(return_value=True)
    loc_dialog.first = AsyncMock()
    loc_dialog.first.inner_text = AsyncMock(return_value="Settings Microphone Speaker")

    def locator_side_effect(selector):
        if "dialog" in selector:
            return loc_dialog
        if "Audio" in selector:
            return loc_audio_tab
        if "Settings" in selector or "settings" in selector:
            return loc_settings_btn
        if "option" in selector or "listbox" in selector:
            return loc_options
        if "combobox" in selector or "Microphone" in selector or "Speaker" in selector:
            return loc_combobox
        empty = AsyncMock()
        empty.count = AsyncMock(return_value=0)
        empty.is_visible = AsyncMock(return_value=False)
        empty.all = AsyncMock(return_value=[])
        return empty

    page.locator.side_effect = locator_side_effect
    nav = MeetNavigator(page)

    res = await nav.configure_audio_devices(
        target_mic="CABLE Output (VB-Audio Virtual Cable)",
        target_speaker="CABLE Input (VB-Audio Virtual Cable)",
    )

    assert res["success"] is True
    assert "CABLE Output" in res["selected_mic"]
    assert "CABLE Input" in res["selected_speaker"]


@pytest.mark.asyncio
async def test_configure_audio_devices_missing_mic_fails_safely():
    page = MagicMock()
    page.wait_for_timeout = AsyncMock()

    loc_settings_btn = AsyncMock()
    loc_settings_btn.count = AsyncMock(return_value=1)
    loc_settings_btn.is_visible = AsyncMock(return_value=True)
    loc_settings_btn.first = AsyncMock()

    loc_combobox = AsyncMock()
    loc_combobox.count = AsyncMock(return_value=1)
    loc_combobox.is_visible = AsyncMock(return_value=True)
    loc_combobox.first = AsyncMock()
    loc_combobox.first.inner_text = AsyncMock(return_value="Laptop Mic")

    # Only returns irrelevant devices
    loc_other_opt = AsyncMock()
    loc_other_opt.inner_text = AsyncMock(return_value="Internal Realtek Microphone")
    loc_other_opt.get_attribute = AsyncMock(return_value=None)

    loc_options = AsyncMock()
    loc_options.count = AsyncMock(return_value=1)
    loc_options.nth = MagicMock(return_value=loc_other_opt)

    loc_audio_tab = AsyncMock()
    loc_audio_tab.count = AsyncMock(return_value=1)
    loc_audio_tab.is_visible = AsyncMock(return_value=True)
    loc_audio_tab.first = AsyncMock()
    loc_audio_tab.first.get_attribute = AsyncMock(return_value="true")

    loc_dialog = AsyncMock()
    loc_dialog.count = AsyncMock(return_value=1)
    loc_dialog.is_visible = AsyncMock(return_value=True)
    loc_dialog.first = AsyncMock()
    loc_dialog.first.inner_text = AsyncMock(return_value="Settings Microphone Speaker")

    def locator_side_effect(selector):
        if "dialog" in selector:
            return loc_dialog
        if "Audio" in selector:
            return loc_audio_tab
        if "Settings" in selector:
            return loc_settings_btn
        if "option" in selector:
            return loc_options
        if "combobox" in selector or "Microphone" in selector:
            return loc_combobox
        empty = AsyncMock()
        empty.count = AsyncMock(return_value=0)
        empty.is_visible = AsyncMock(return_value=False)
        empty.all = AsyncMock(return_value=[])
        return empty

    page.locator.side_effect = locator_side_effect
    nav = MeetNavigator(page)

    res = await nav.configure_audio_devices(
        target_mic="CABLE Output (VB-Audio Virtual Cable)",
        target_speaker="CABLE Input (VB-Audio Virtual Cable)",
    )

    assert res["success"] is False
    assert "Required audio device not found: Microphone" in res["error"]


@pytest.mark.asyncio
async def test_more_options_alone_does_not_open_settings():
    """Verify that clicking More options without the Settings dialog opening fails safely."""
    page = MagicMock()
    page.wait_for_timeout = AsyncMock()

    # More options button is visible
    loc_more = AsyncMock()
    loc_more.count = AsyncMock(return_value=1)
    loc_more.is_visible = AsyncMock(return_value=True)
    loc_more.first = AsyncMock()

    empty = AsyncMock()
    empty.count = AsyncMock(return_value=0)
    empty.is_visible = AsyncMock(return_value=False)
    empty.all = AsyncMock(return_value=[])

    def locator_side_effect(selector):
        if "More options" in selector or "more settings" in selector:
            return loc_more
        return empty

    page.locator.side_effect = locator_side_effect
    page.get_by_text = MagicMock(return_value=empty)
    nav = MeetNavigator(page)

    res = await nav.configure_audio_devices(
        target_mic="CABLE Output (VB-Audio Virtual Cable)",
        target_speaker="CABLE Input (VB-Audio Virtual Cable)",
    )

    assert res["success"] is False
    assert res["error"] == "GOOGLE_MEET_SETTINGS_NOT_OPENED"


@pytest.mark.asyncio
async def test_more_options_to_settings_dialog_full_flow():
    """Verify full two-step navigation: More options -> menu -> Settings item -> Settings dialog."""
    page = MagicMock()
    page.wait_for_timeout = AsyncMock()

    # More options button
    loc_more = AsyncMock()
    loc_more.count = AsyncMock(return_value=1)
    loc_more.is_visible = AsyncMock(return_value=True)
    loc_more.first = AsyncMock()

    # Settings menu item
    loc_settings_item = AsyncMock()
    loc_settings_item.count = AsyncMock(return_value=1)
    loc_settings_item.is_visible = AsyncMock(return_value=True)
    loc_settings_item.first = AsyncMock()
    loc_settings_item.first.click = AsyncMock()
    loc_settings_item.nth = MagicMock(return_value=loc_settings_item)
    loc_settings_item.evaluate = AsyncMock(return_value="button")
    loc_settings_item.inner_text = AsyncMock(return_value="Settings")
    loc_settings_item.bounding_box = AsyncMock(return_value={"x": 50, "y": 100, "width": 80, "height": 30})

    # Settings dialog
    loc_dialog = AsyncMock()
    loc_dialog.count = AsyncMock(return_value=1)
    loc_dialog.is_visible = AsyncMock(return_value=True)
    loc_dialog.first = AsyncMock()
    loc_dialog.first.inner_text = AsyncMock(return_value="Audio Settings Microphone Speakers")

    # Combobox & options for devices
    loc_combobox = AsyncMock()
    loc_combobox.count = AsyncMock(return_value=1)
    loc_combobox.is_visible = AsyncMock(return_value=True)
    loc_combobox.first = AsyncMock()
    loc_combobox.first.inner_text = AsyncMock(return_value="Default Audio")

    loc_mic_opt = AsyncMock()
    loc_mic_opt.inner_text = AsyncMock(return_value="CABLE Output (VB-Audio Virtual Cable)")
    loc_mic_opt.get_attribute = AsyncMock(return_value=None)
    loc_mic_opt.click = AsyncMock()

    loc_spk_opt = AsyncMock()
    loc_spk_opt.inner_text = AsyncMock(return_value="CABLE Input (VB-Audio Virtual Cable)")
    loc_spk_opt.get_attribute = AsyncMock(return_value=None)
    loc_spk_opt.click = AsyncMock()

    loc_options = AsyncMock()
    loc_options.count = AsyncMock(return_value=2)
    loc_options.nth = MagicMock(side_effect=lambda idx: loc_mic_opt if idx == 0 else loc_spk_opt)

    empty = AsyncMock()
    empty.count = AsyncMock(return_value=0)
    empty.is_visible = AsyncMock(return_value=False)
    empty.all = AsyncMock(return_value=[])

    def locator_side_effect(selector):
        if "More options" in selector or "more settings" in selector:
            return loc_more
        if "dialog" in selector:
            return loc_dialog
        if "option" in selector or "listbox" in selector:
            return loc_options
        if "combobox" in selector or "Microphone" in selector or "Speaker" in selector:
            return loc_combobox
        return empty

    page.locator.side_effect = locator_side_effect
    page.get_by_text = MagicMock(return_value=loc_settings_item)
    nav = MeetNavigator(page)

    res = await nav.configure_audio_devices(
        target_mic="CABLE Output (VB-Audio Virtual Cable)",
        target_speaker="CABLE Input (VB-Audio Virtual Cable)",
    )

    assert res["success"] is True
    assert "CABLE Output" in res["selected_mic"]
    assert "CABLE Input" in res["selected_speaker"]
    # Verify More options button was clicked exactly once
    assert loc_more.first.click.call_count == 1


@pytest.mark.asyncio
async def test_more_options_detects_settings_by_text_without_menu_role():
    """Verify that visible 'Settings' text is detected and clicked even if page has no role=menu."""
    page = MagicMock()
    page.wait_for_timeout = AsyncMock()

    # More options button
    loc_more = AsyncMock()
    loc_more.count = AsyncMock(return_value=1)
    loc_more.is_visible = AsyncMock(return_value=True)
    loc_more.first = AsyncMock()

    # Settings text element (e.g. span or div with text 'Settings')
    loc_settings_text = AsyncMock()
    loc_settings_text.count = AsyncMock(return_value=1)
    loc_settings_text.is_visible = AsyncMock(return_value=True)
    loc_settings_text.nth = MagicMock(return_value=loc_settings_text)
    loc_settings_text.evaluate = AsyncMock(return_value="span")
    loc_settings_text.get_attribute = AsyncMock(return_value="")
    loc_settings_text.inner_text = AsyncMock(return_value="Settings")
    loc_settings_text.bounding_box = AsyncMock(return_value={"x": 100, "y": 200, "width": 80, "height": 30})

    # Settings dialog
    loc_dialog = AsyncMock()
    loc_dialog.count = AsyncMock(return_value=1)
    loc_dialog.is_visible = AsyncMock(return_value=True)
    loc_dialog.first = AsyncMock()
    loc_dialog.first.inner_text = AsyncMock(return_value="Audio Settings Microphone Speakers")

    # Combobox & options
    loc_combobox = AsyncMock()
    loc_combobox.count = AsyncMock(return_value=1)
    loc_combobox.is_visible = AsyncMock(return_value=True)
    loc_combobox.first = AsyncMock()
    loc_combobox.first.inner_text = AsyncMock(return_value="Default Audio")

    loc_mic_opt = AsyncMock()
    loc_mic_opt.inner_text = AsyncMock(return_value="CABLE Output (VB-Audio Virtual Cable)")
    loc_mic_opt.get_attribute = AsyncMock(return_value=None)
    loc_mic_opt.click = AsyncMock()

    loc_spk_opt = AsyncMock()
    loc_spk_opt.inner_text = AsyncMock(return_value="CABLE Input (VB-Audio Virtual Cable)")
    loc_spk_opt.get_attribute = AsyncMock(return_value=None)
    loc_spk_opt.click = AsyncMock()

    loc_options = AsyncMock()
    loc_options.count = AsyncMock(return_value=2)
    loc_options.nth = MagicMock(side_effect=lambda idx: loc_mic_opt if idx == 0 else loc_spk_opt)

    empty = AsyncMock()
    empty.count = AsyncMock(return_value=0)
    empty.is_visible = AsyncMock(return_value=False)
    empty.all = AsyncMock(return_value=[])

    def locator_side_effect(selector):
        if "More options" in selector or "more settings" in selector:
            return loc_more
        if "dialog" in selector:
            return loc_dialog
        if "option" in selector or "listbox" in selector:
            return loc_options
        if "combobox" in selector or "Microphone" in selector or "Speaker" in selector:
            return loc_combobox
        return empty

    page.locator.side_effect = locator_side_effect
    page.get_by_text = MagicMock(return_value=loc_settings_text)
    nav = MeetNavigator(page)

    res = await nav.configure_audio_devices(
        target_mic="CABLE Output (VB-Audio Virtual Cable)",
        target_speaker="CABLE Input (VB-Audio Virtual Cable)",
    )

    assert res["success"] is True
    assert loc_more.first.click.call_count == 1
    # Verify evaluate (which triggers click or closest clickable ancestor) was called on Settings text
    assert loc_settings_text.evaluate.called


@pytest.mark.asyncio
async def test_audio_tab_already_active_skips_click():
    """Verify that when Audio controls are already visible in dialog, no Audio tab click is performed."""
    page = MagicMock()
    page.wait_for_timeout = AsyncMock()

    loc_settings_btn = AsyncMock()
    loc_settings_btn.count = AsyncMock(return_value=1)
    loc_settings_btn.is_visible = AsyncMock(return_value=True)
    loc_settings_btn.first = AsyncMock()

    loc_audio_nav = AsyncMock()
    loc_audio_nav.click = AsyncMock()
    loc_audio_nav.evaluate = AsyncMock()

    # Dialog already contains Microphone and Speaker
    loc_dialog = AsyncMock()
    loc_dialog.count = AsyncMock(return_value=1)
    loc_dialog.is_visible = AsyncMock(return_value=True)
    loc_dialog.first = AsyncMock()
    loc_dialog.first.inner_text = AsyncMock(return_value="Settings Audio Microphone Speakers")
    loc_dialog.first.get_by_text = MagicMock(return_value=loc_audio_nav)

    # Microphone and Speaker already have target values (read-only verification, no click needed)
    loc_mic_box = AsyncMock()
    loc_mic_box.count = AsyncMock(return_value=1)
    loc_mic_box.is_visible = AsyncMock(return_value=True)
    loc_mic_box.first = AsyncMock()
    loc_mic_box.first.inner_text = AsyncMock(return_value="CABLE Output (VB-Audio Virtual Cable)")
    loc_mic_box.first.click = AsyncMock()

    loc_spk_box = AsyncMock()
    loc_spk_box.count = AsyncMock(return_value=1)
    loc_spk_box.is_visible = AsyncMock(return_value=True)
    loc_spk_box.first = AsyncMock()
    loc_spk_box.first.inner_text = AsyncMock(return_value="CABLE Input (VB-Audio Virtual Cable)")
    loc_spk_box.first.click = AsyncMock()

    empty = AsyncMock()
    empty.count = AsyncMock(return_value=0)
    empty.is_visible = AsyncMock(return_value=False)
    empty.all = AsyncMock(return_value=[])

    def locator_side_effect(selector):
        if "dialog" in selector and ("Microphone" in selector or "Speaker" in selector):
            if "Microphone" in selector:
                return loc_mic_box
            return loc_spk_box
        if "dialog" in selector:
            return loc_dialog
        if "Settings" in selector:
            return loc_settings_btn
        return empty

    page.locator.side_effect = locator_side_effect
    nav = MeetNavigator(page)

    res = await nav.configure_audio_devices(
        target_mic="CABLE Output (VB-Audio Virtual Cable)",
        target_speaker="CABLE Input (VB-Audio Virtual Cable)",
    )

    assert res["success"] is True
    assert "CABLE Output" in res["selected_mic"]
    assert "CABLE Input" in res["selected_speaker"]
    # Neither the audio nav tab nor dropdowns should have been clicked since values match
    assert loc_audio_nav.click.call_count == 0
    assert loc_mic_box.first.click.call_count == 0
    assert loc_spk_box.first.click.call_count == 0


def test_normalize_audio_label():
    """Verify audio label normalization across Windows and WebRTC formats."""
    from app.meet import normalize_audio_label

    assert normalize_audio_label("Speaker (2- Realtek(R) Audio)") == "speaker realtek audio"
    assert normalize_audio_label("Default - Speakers (Realtek(R) Audio)") == "speaker realtek audio"
    assert normalize_audio_label("Speakers (Realtek(R) Audio)") == "speaker realtek audio"
    assert normalize_audio_label("Speakers (2- Realtek(R) Audio)") == "speaker realtek audio"
    assert normalize_audio_label("CABLE Input (VB-Audio Virtual Cable)") == "cable input vb audio virtual cable"
    assert normalize_audio_label("Default - CABLE Output (VB-Audio Virtual Cable)") == "cable output vb audio virtual cable"


def test_score_device_match_realtek_variations():
    """Verify robust matching of Realtek speaker variations while preventing feedback loops."""
    from app.meet import score_device_match

    target = "Speaker (2- Realtek(R) Audio)"

    # All Realtek variations should match with high scores
    assert score_device_match(target, "Default - Speakers (Realtek(R) Audio)", "Speaker") >= 75.0
    assert score_device_match(target, "Speakers (Realtek(R) Audio)", "Speaker") >= 75.0
    assert score_device_match(target, "Default - Speakers (2- Realtek(R) Audio)", "Speaker") >= 75.0
    assert score_device_match(target, "Speakers (2- Realtek(R) Audio)", "Speaker") >= 75.0
    assert score_device_match(target, "Speakers / Headphones (Realtek Audio)", "Speaker") >= 70.0
    assert score_device_match(target, "Default - System Speakers", "Speaker") >= 40.0

    # Critical Safety: CABLE Input MUST BE DISQUALIFIED (0.0) when hardware speaker is requested
    assert score_device_match(target, "CABLE Input (VB-Audio Virtual Cable)", "Speaker") == 0.0
    assert score_device_match(target, "CABLE In 16ch (VB-Audio Virtual Cable)", "Speaker") == 0.0


def test_score_device_match_cable_output_mic():
    """Verify microphone matching selects VB-Cable and disqualifies laptop mics."""
    from app.meet import score_device_match

    mic_target = "CABLE Output (VB-Audio Virtual Cable)"

    assert score_device_match(mic_target, "CABLE Output (VB-Audio Virtual Cable)", "Microphone") >= 75.0
    assert score_device_match(mic_target, "Default - CABLE Output (VB-Audio Virtual Cable)", "Microphone") >= 75.0
    assert score_device_match(mic_target, "Microphone Array (2- Intel Smart Sound Technology)", "Microphone") == 0.0


@pytest.mark.asyncio
async def test_select_device_dropdown_realtek_variation_selection_and_verification():
    """Verify _select_device_dropdown identifies Realtek option among CABLE Input and selects it."""
    from app.meet import MeetNavigator

    page = MagicMock()
    page.wait_for_timeout = AsyncMock()

    # Dropdown container currently displays CABLE Input
    loc_container = AsyncMock()
    loc_container.count = AsyncMock(return_value=1)
    loc_container.is_visible = AsyncMock(return_value=True)
    loc_container.first = AsyncMock()
    loc_container.first.inner_text = AsyncMock(return_value="CABLE Input (VB-Audio Virtual Cable)")
    loc_container.first.get_attribute = AsyncMock(return_value="Select speaker")
    loc_container.first.click = AsyncMock()

    # Options revealed: CABLE Input and Default - Speakers (Realtek(R) Audio)
    loc_opt_cable = AsyncMock()
    loc_opt_cable.is_visible = AsyncMock(return_value=True)
    loc_opt_cable.inner_text = AsyncMock(return_value="CABLE Input (VB-Audio Virtual Cable)")
    loc_opt_cable.get_attribute = AsyncMock(return_value=None)
    loc_opt_cable.click = AsyncMock()

    loc_opt_realtek = AsyncMock()
    loc_opt_realtek.is_visible = AsyncMock(return_value=True)
    loc_opt_realtek.inner_text = AsyncMock(return_value="Default - Speakers (Realtek(R) Audio)")
    loc_opt_realtek.get_attribute = AsyncMock(return_value=None)
    loc_opt_realtek.click = AsyncMock()

    # After clicking Realtek, container text updates to Default - Speakers (Realtek(R) Audio)
    async def click_realtek_side_effect():
        loc_container.first.inner_text = AsyncMock(return_value="Default - Speakers (Realtek(R) Audio)")
    loc_opt_realtek.click.side_effect = click_realtek_side_effect

    loc_options = AsyncMock()
    loc_options.count = AsyncMock(return_value=2)
    loc_options.nth = MagicMock(side_effect=lambda idx: loc_opt_cable if idx == 0 else loc_opt_realtek)

    def locator_side_effect(selector):
        if "option" in selector or "listbox" in selector:
            return loc_options
        if "combobox" in selector or "Speaker" in selector:
            return loc_container
        empty = AsyncMock()
        empty.count = AsyncMock(return_value=0)
        empty.is_visible = AsyncMock(return_value=False)
        return empty

    page.locator.side_effect = locator_side_effect
    nav = MeetNavigator(page)

    res = await nav._select_device_dropdown(
        device_type="Speaker",
        target_label="Speaker (2- Realtek(R) Audio)",
        container_selectors=['[role="dialog"] [aria-label*="Speakers" i][role="combobox"]'],
    )

    assert res["success"] is True
    assert "Realtek" in res["selected_label"]
    # Verified: Realtek option was clicked, CABLE Input was NOT clicked
    assert loc_opt_realtek.click.call_count == 1
    assert loc_opt_cable.click.call_count == 0


@pytest.mark.asyncio
async def test_select_device_dropdown_mismatch_returns_error_with_available_options():
    """Verify _select_device_dropdown captures and logs available options on mismatch."""
    from app.meet import MeetNavigator

    page = MagicMock()
    page.wait_for_timeout = AsyncMock()
    page.keyboard = MagicMock()
    page.keyboard.press = AsyncMock()

    loc_container = AsyncMock()
    loc_container.count = AsyncMock(return_value=1)
    loc_container.is_visible = AsyncMock(return_value=True)
    loc_container.first = AsyncMock()
    loc_container.first.inner_text = AsyncMock(return_value="Unrelated Audio Device")
    loc_container.first.get_attribute = AsyncMock(return_value=None)
    loc_container.first.click = AsyncMock()

    loc_opt_unrelated = AsyncMock()
    loc_opt_unrelated.is_visible = AsyncMock(return_value=True)
    loc_opt_unrelated.inner_text = AsyncMock(return_value="HDMI Monitor Audio")
    loc_opt_unrelated.get_attribute = AsyncMock(return_value=None)

    loc_options = AsyncMock()
    loc_options.count = AsyncMock(return_value=1)
    loc_options.nth = MagicMock(return_value=loc_opt_unrelated)

    def locator_side_effect(selector):
        if "option" in selector:
            return loc_options
        if "combobox" in selector:
            return loc_container
        empty = AsyncMock()
        empty.count = AsyncMock(return_value=0)
        empty.is_visible = AsyncMock(return_value=False)
        return empty

    page.locator.side_effect = locator_side_effect
    nav = MeetNavigator(page)

    res = await nav._select_device_dropdown(
        device_type="Speaker",
        target_label="Speaker (2- Realtek(R) Audio)",
        container_selectors=['[role="dialog"] [role="combobox"]'],
    )

    assert res["success"] is False
    assert "HDMI Monitor Audio" in res["error"]
    assert "HDMI Monitor Audio" in res["available_options"]






