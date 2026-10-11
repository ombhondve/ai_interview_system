"""
Targeted tests for RecruitAI Google Meet Interview Bot Production Upgrades:
- Problem A: Silence non-blocking return with max_initial_wait_sec, conversation lock, retry handling.
- Problem B: ParticipantMediaMonitor isolated selectors (excluding self-view), state detection, reminders cooldown & quota.
- Problem C: Time-aware duration closing window, multi-turn Q&A, hard deadline detection, completion reason persistence.
"""

import asyncio
import time
import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from app.media_monitor import ParticipantMediaMonitor, MediaState, MEET_SELECTORS
from app.audio_capture import AudioCaptureService, CaptureState
from app.main import ConversationState, ConversationManager
from app.bot import MeetingBot
from app.recruitai_client import RecruitAIClient


# ==============================================================================
# PROBLEM A: NON-BLOCKING INITIAL WAIT & CONVERSATION SYNCHRONIZATION
# ==============================================================================

@pytest.mark.asyncio
async def test_capture_utterance_exits_on_max_initial_wait_sec_when_silent():
    """Verify capture_utterance does not block indefinitely when candidate is silent."""
    audio = AudioCaptureService(sample_rate=16000, channels=1)
    audio._state = CaptureState.RUNNING

    # Feed silence into audio queue
    chunk = b"\x00" * 1600
    for _ in range(50):
        audio._audio_queue.put(chunk)

    start = time.monotonic()
    utterance = await audio.capture_utterance(
        max_initial_wait_sec=0.2,
        check_interval=0.02,
    )
    elapsed = time.monotonic() - start

    assert utterance is None, "Should return None on silence after max_initial_wait_sec"
    assert elapsed < 1.0, f"Wait should respect max_initial_wait_sec (elapsed: {elapsed}s)"


@pytest.mark.asyncio
async def test_conversation_manager_lock_prevents_concurrency():
    """Verify ConversationManager lock serializes concurrent turns."""
    mgr = ConversationManager(
        bot=MagicMock(),
        audio_capture=MagicMock(),
        recruitai_client=MagicMock(),
        deepgram_client=MagicMock(),
        duration_minutes=30.0,
    )

    execution_order = []

    async def worker(task_id: int, delay: float):
        async with mgr.lock:
            execution_order.append(f"start_{task_id}")
            await asyncio.sleep(delay)
            execution_order.append(f"end_{task_id}")

    await asyncio.gather(
        worker(1, 0.05),
        worker(2, 0.01),
    )

    assert execution_order == ["start_1", "end_1", "start_2", "end_2"], (
        f"Lock must serialize tasks without interleaving: {execution_order}"
    )


# ==============================================================================
# PROBLEM B: PARTICIPANT MEDIA MONITORING & ISOLATED SELECTORS
# ==============================================================================

def test_meet_selectors_exclude_self_view():
    """Verify selectors explicitly avoid matching the bot's own preview or self-view."""
    remote_tiles = " ".join(MEET_SELECTORS["remote_tiles"])
    assert ":not([data-self-name])" in remote_tiles
    assert ':not([data-is-self="true"])' in remote_tiles


@pytest.mark.asyncio
async def test_media_monitor_candidate_presence():
    """Verify candidate presence detection via participant tiles and people counter."""
    page = MagicMock()
    mock_btn = MagicMock()
    mock_btn.is_visible = AsyncMock(return_value=True)
    mock_btn.get_attribute = AsyncMock(return_value="People (2)")
    mock_btn.inner_text = AsyncMock(return_value="People (2)")

    mock_counter = MagicMock()
    mock_counter.count = AsyncMock(return_value=1)
    mock_counter.nth = MagicMock(return_value=mock_btn)

    def locator_side_effect(selector):
        if selector in MEET_SELECTORS["participant_count"]:
            return mock_counter
        mock_fallback = MagicMock()
        mock_fallback.count = AsyncMock(return_value=0)
        return mock_fallback

    page.locator = locator_side_effect

    monitor = ParticipantMediaMonitor(page)
    state = await monitor.check_candidate_presence()
    assert state == MediaState.PRESENT
    assert await monitor.is_candidate_present() is True


@pytest.mark.asyncio
async def test_media_monitor_mic_muted_detection():
    """Verify candidate mic mute status check distinguishes muted vs unmuted."""
    page = MagicMock()
    # Mock candidate present
    monitor = ParticipantMediaMonitor(page)
    monitor.check_candidate_presence = AsyncMock(return_value=MediaState.PRESENT)

    mock_muted_loc = MagicMock()
    mock_muted_loc.count = AsyncMock(return_value=1)
    mock_first = MagicMock()
    mock_first.is_visible = AsyncMock(return_value=True)
    mock_muted_loc.first = mock_first

    page.locator = MagicMock(return_value=mock_muted_loc)

    mic_state = await monitor.check_candidate_mic()
    assert mic_state == MediaState.MUTED
    assert await monitor.is_candidate_mic_muted() is True


def test_media_monitor_reminder_cooldown_and_quotas():
    """Verify camera and mic reminders enforce minimum cooldowns and maximum quotas."""
    page = MagicMock()
    monitor = ParticipantMediaMonitor(page, camera_reminder_cooldown_sec=20.0, max_camera_reminders=2)

    # Initial state: can remind
    assert monitor.can_remind_camera() is True
    monitor.record_camera_reminder()

    # Immediate next check: blocked by cooldown
    assert monitor.can_remind_camera() is False

    # Simulate cooldown passing
    monitor.last_camera_reminder_time = time.monotonic() - 25.0
    assert monitor.can_remind_camera() is True
    monitor.record_camera_reminder()

    # Now max count (2) is reached
    monitor.last_camera_reminder_time = time.monotonic() - 30.0
    assert monitor.can_remind_camera() is False, "Exceeded max_camera_reminders quota"


# ==============================================================================
# PROBLEM C: TIME-AWARE DURATION & CLOSING WINDOW
# ==============================================================================

def test_conversation_manager_duration_and_closing_window():
    """Verify closing window calculation for a scheduled 30-minute interview."""
    mgr = ConversationManager(
        bot=MagicMock(),
        audio_capture=MagicMock(),
        recruitai_client=MagicMock(),
        deepgram_client=MagicMock(),
        duration_minutes=30.0,
    )

    # At start (elapsed = 0s)
    assert mgr.get_remaining_time_sec() > 1700
    assert mgr.is_in_closing_window() is False
    assert mgr.is_hard_deadline_reached() is False

    # Simulate elapsed time reaching 27 minutes (1620s elapsed -> 180s remaining)
    # Threshold for 30m: 1800 * 0.12 = 216s
    mgr.interview_start_time = time.monotonic() - (27 * 60)
    assert mgr.is_in_closing_window() is True
    assert mgr.is_hard_deadline_reached() is False

    # Simulate hard deadline reached (31 minutes elapsed)
    mgr.interview_start_time = time.monotonic() - (31 * 60)
    assert mgr.get_remaining_time_sec() == 0.0
    assert mgr.is_hard_deadline_reached() is True


def test_conversation_manager_explicit_state_machine():
    """Verify explicit states are updated and logged accurately."""
    mgr = ConversationManager(
        bot=MagicMock(),
        audio_capture=MagicMock(),
        recruitai_client=MagicMock(),
        deepgram_client=MagicMock(),
        duration_minutes=30.0,
    )

    mgr.set_state(ConversationState.ASKING_QUESTION, decision="question_start")
    assert mgr.state == ConversationState.ASKING_QUESTION

    mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="listening")
    assert mgr.state == ConversationState.WAITING_FOR_ANSWER

    mgr.set_state(ConversationState.ANSWER_DETECTED, decision="speech_detected")
    assert mgr.state == ConversationState.ANSWER_DETECTED

    mgr.set_state(ConversationState.INVITING_STUDENT_QUESTIONS, decision="closing_entered")
    assert mgr.state == ConversationState.INVITING_STUDENT_QUESTIONS

    mgr.set_state(ConversationState.ANSWERING_STUDENT_QUESTION, decision="student_q_answered")
    assert mgr.state == ConversationState.ANSWERING_STUDENT_QUESTION

    mgr.set_state(ConversationState.CLOSING_INTERVIEW, decision="wrap_up")
    assert mgr.state == ConversationState.CLOSING_INTERVIEW

    mgr.set_state(ConversationState.COMPLETED, decision="done")
    assert mgr.state == ConversationState.COMPLETED


# ==============================================================================
# CLIENT PERSISTENCE WITH REASON & CLOSING FLAG
# ==============================================================================

def test_recruitai_client_submit_transcript_sends_closing_flag():
    """Verify submit_transcript attaches closing flag when requested."""
    client = RecruitAIClient(base_url="http://test-server:5000", internal_secret="test-secret")

    with patch("requests.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "success": True,
            "accepted": True,
            "nextQuestion": "Thank you for your time.",
            "closing": True,
        }
        mock_post.return_value = mock_resp

        res = client.submit_transcript(
            interview_id="int-123",
            transcript="No questions.",
            candidate_id="cand-456",
            closing=True,
        )

        assert res.get("closing") is True
        # Verify payload sent
        call_args = mock_post.call_args
        payload = call_args[1]["json"]
        assert payload.get("closing") is True
        assert payload.get("transcript") == "No questions."


def test_recruitai_client_complete_interview_sends_reason():
    """Verify complete_interview sends reason parameter in payload."""
    client = RecruitAIClient(base_url="http://test-server:5000", internal_secret="test-secret")

    with patch("requests.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"success": True, "status": "COMPLETED"}
        mock_post.return_value = mock_resp

        client.complete_interview(
            interview_id="int-123",
            candidate_id="cand-456",
            reason="COMPLETED_NORMAL",
        )

        call_args = mock_post.call_args
        payload = call_args[1]["json"]
        assert payload.get("reason") == "COMPLETED_NORMAL"
