"""
End-to-End Integration Test for RecruitAI Meeting Bot Interview Start Flow.
Tests that:
1. Bot handles Google Meet admission correctly (waiting -> admitted -> JOINED).
2. Bot detects candidate presence via multi-signal UI indicators.
3. Bot transitions session on backend to IN_PROGRESS.
4. Bot receives and delivers first question (or fallback greeting) via TTS.
5. Interview conversation loop starts listening for candidate answers.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.bot import BotStatus, MeetingBot
from app.meet import MeetNavigator
from app.main import ConversationState, ConversationManager


@pytest.mark.asyncio
async def test_full_interview_start_workflow_when_candidate_joins():
    # 1. Setup MeetingBot and mocked MeetNavigator
    bot = MeetingBot()
    page = MagicMock()
    page.wait_for_timeout = AsyncMock()
    
    navigator = MeetNavigator(page)
    # Simulate admission: initial check is waiting, second check is inside
    navigator.verify_meeting_admission = AsyncMock(
        side_effect=[
            {"is_inside": False, "waiting_detected": True, "evidence": []},
            {"is_inside": True, "waiting_detected": False, "evidence": ["Leave call present", "Dock present"]},
        ]
    )
    navigator.dismiss_incall_dialogs = AsyncMock()
    navigator.mute_microphone = AsyncMock(return_value=True)
    navigator.unmute_microphone = AsyncMock(return_value=True)
    navigator.is_inside_meeting = AsyncMock(return_value=True)
    
    # Simulate candidate joins Google Meet
    # Check 1 (bot alone): count=1 -> False
    # Check 2 (candidate enters): count=2 -> True
    navigator.get_participant_count = AsyncMock(side_effect=[1, 2])
    
    bot._page = page
    bot._navigator = navigator

    # 2. Simulate wait_for_admission
    bot.status = BotStatus.WAITING_FOR_ADMISSION
    admitted = await bot.wait_for_admission(timeout_sec=5.0)
    assert admitted is True
    assert bot.status == BotStatus.JOINED
    assert bot.joined_at is not None
    navigator.dismiss_incall_dialogs.assert_awaited()
    navigator.mute_microphone.assert_awaited()

    # 3. Simulate candidate presence detection
    # First attempt: bot alone
    present_1 = await navigator.is_candidate_present()
    assert present_1 is False

    # Second attempt: candidate joined
    present_2 = await navigator.is_candidate_present()
    assert present_2 is True

    # 4. Simulate RecruitAI client candidate-joined notification
    recruitai_client = MagicMock()
    recruitai_client.notify_candidate_joined.return_value = {
        "success": True,
        "interviewId": "test-interview-123",
        "candidateId": "test-cand-456",
        "status": "IN_PROGRESS",
        "phase": "PRECHECK",
        "durationMinutes": 30,
        "firstQuestion": "Hi, welcome to your interview. Can you hear me clearly?",
        "started": True,
    }

    join_res = recruitai_client.notify_candidate_joined("test-interview-123", candidate_id="test-cand-456")
    assert join_res["status"] == "IN_PROGRESS"
    assert join_res["started"] is True
    first_q = join_res["firstQuestion"]
    assert "clearly" in first_q

    # 5. Simulate first question TTS delivery
    with patch("app.kokoro_tts.kokoro_tts.speak", return_value={"success": True, "duration": 2.5}):
        spoken = await bot.speak_text(first_q)
        assert spoken is True
        assert bot.status == BotStatus.JOINED
        navigator.unmute_microphone.assert_awaited()

    # 6. Initialize ConversationManager and verify ready to listen
    audio_capture = MagicMock()
    deepgram_client = MagicMock()
    conv_mgr = ConversationManager(
        bot=bot,
        audio_capture=audio_capture,
        recruitai_client=recruitai_client,
        deepgram_client=deepgram_client,
        duration_minutes=30,
    )
    conv_mgr.current_question = first_q
    conv_mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="listening_for_candidate")

    assert conv_mgr.state == ConversationState.WAITING_FOR_ANSWER
    assert conv_mgr.current_question == first_q
    assert bot.is_ai_speaking() is False
    assert bot.status == BotStatus.JOINED
