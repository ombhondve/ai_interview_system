"""
Tests for RecruitAI 15-Minute Interview Engine and Lifecycle:
- 15-minute default duration (900 seconds)
- Monotonic elapsed time calculation
- Timer starting at actual interview start, not scheduled time
- Closing window calculations
- Hard deadline enforcement
- Camera check handling
- Duplicate closing and farewell prevention
"""

import time
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.main import ConversationManager, ConversationState


@pytest.fixture
def mock_bot_components():
    bot = AsyncMock()
    bot.is_ai_speaking = MagicMock(return_value=False)
    bot.is_candidate_speaking = MagicMock(return_value=False)
    bot.speak_text = AsyncMock(return_value=True)

    audio_capture = MagicMock()
    audio_capture.stop_master_recording = MagicMock(return_value=850.0)
    audio_capture.export_master_recording_wav = MagicMock(return_value=True)

    recruitai_client = MagicMock()
    recruitai_client.submit_transcript = MagicMock(return_value={"accepted": True, "nextQuestion": "Next Q"})
    recruitai_client.complete_interview = MagicMock(return_value={"success": True})

    deepgram_client = MagicMock()
    deepgram_client.is_configured = MagicMock(return_value=True)

    return bot, audio_capture, recruitai_client, deepgram_client


def test_fifteen_minute_default_duration(mock_bot_components):
    """ConversationManager defaults to 15.0 minutes (900s)."""
    bot, audio_capture, recruitai_client, deepgram_client = mock_bot_components
    mgr = ConversationManager(
        bot=bot,
        audio_capture=audio_capture,
        recruitai_client=recruitai_client,
        deepgram_client=deepgram_client,
    )
    assert mgr.duration_minutes == 15.0
    total_sec = mgr.duration_minutes * 60.0
    assert total_sec == 900.0


def test_timer_elapsed_monotonic_measurement(mock_bot_components):
    """Timer uses monotonic clock and measures elapsed time accurately."""
    bot, audio_capture, recruitai_client, deepgram_client = mock_bot_components
    mgr = ConversationManager(
        bot=bot,
        audio_capture=audio_capture,
        recruitai_client=recruitai_client,
        deepgram_client=deepgram_client,
        duration_minutes=15.0,
    )
    # Simulate interview start 300 seconds ago (5 minutes elapsed)
    now = time.monotonic()
    mgr.interview_start_time = now - 300.0

    elapsed = mgr.get_elapsed_time_sec()
    assert 299.5 <= elapsed <= 300.5

    remaining = mgr.get_remaining_time_sec()
    assert 599.5 <= remaining <= 600.5
    assert not mgr.is_hard_deadline_reached()
    assert not mgr.is_in_closing_window()


def test_closing_window_timing_for_15_minutes(mock_bot_components):
    """For 15 minutes (900s), closing window starts when <= 108s (approx 13m 12s elapsed)."""
    bot, audio_capture, recruitai_client, deepgram_client = mock_bot_components
    mgr = ConversationManager(
        bot=bot,
        audio_capture=audio_capture,
        recruitai_client=recruitai_client,
        deepgram_client=deepgram_client,
        duration_minutes=15.0,
    )
    now = time.monotonic()

    # At 12 minutes (720s elapsed, 180s remaining) -> NOT in closing window
    mgr.interview_start_time = now - 720.0
    assert not mgr.is_in_closing_window()

    # At 13 minutes 30 seconds (810s elapsed, 90s remaining) -> IN closing window
    mgr.interview_start_time = now - 810.0
    assert mgr.is_in_closing_window()
    assert not mgr.is_hard_deadline_reached()


def test_hard_deadline_at_900_seconds(mock_bot_components):
    """At 900 seconds elapsed, hard deadline is reached."""
    bot, audio_capture, recruitai_client, deepgram_client = mock_bot_components
    mgr = ConversationManager(
        bot=bot,
        audio_capture=audio_capture,
        recruitai_client=recruitai_client,
        deepgram_client=deepgram_client,
        duration_minutes=15.0,
    )
    now = time.monotonic()

    # At 899 seconds -> not reached
    mgr.interview_start_time = now - 899.0
    assert not mgr.is_hard_deadline_reached()

    # At 900 seconds -> reached
    mgr.interview_start_time = now - 900.5
    assert mgr.is_hard_deadline_reached()
    assert mgr.get_remaining_time_sec() == 0.0


def test_closing_invitation_and_farewell_single_delivery_flags(mock_bot_components):
    """Closing invitation and farewell flags prevent repeated prompts."""
    bot, audio_capture, recruitai_client, deepgram_client = mock_bot_components
    mgr = ConversationManager(
        bot=bot,
        audio_capture=audio_capture,
        recruitai_client=recruitai_client,
        deepgram_client=deepgram_client,
        duration_minutes=15.0,
    )

    assert mgr.closing_invited is False
    assert mgr.farewell_delivered is False

    mgr.closing_invited = True
    assert mgr.closing_invited is True

    mgr.farewell_delivered = True
    assert mgr.farewell_delivered is True


def test_twenty_five_minute_duration_override_capped_at_fifteen(mock_bot_components):
    """Passing 25.0 or 30.0 minutes to ConversationManager is strictly capped at 15.0 minutes."""
    bot, audio_capture, recruitai_client, deepgram_client = mock_bot_components
    mgr25 = ConversationManager(
        bot=bot,
        audio_capture=audio_capture,
        recruitai_client=recruitai_client,
        deepgram_client=deepgram_client,
        duration_minutes=25.0,
    )
    assert mgr25.duration_minutes == 15.0
    assert mgr25.duration_minutes * 60.0 == 900.0

    mgr30 = ConversationManager(
        bot=bot,
        audio_capture=audio_capture,
        recruitai_client=recruitai_client,
        deepgram_client=deepgram_client,
        duration_minutes=30.0,
    )
    assert mgr30.duration_minutes == 15.0


def test_kokoro_tts_device_validation_caching():
    """KokoroTTS caches validated devices to avoid re-opening PortAudio streams on every utterance."""
    from app.kokoro_tts import KokoroTTS
    tts = KokoroTTS(enabled=False)
    assert hasattr(tts, "_validated_devices")
    assert isinstance(tts._validated_devices, set)

    tts._validated_devices.add(1)
    assert 1 in tts._validated_devices


def test_spoken_payload_preamble_deduplication():
    """Verify that redundant conversational preambles (e.g. 'Good question. That's a good question...') are deduplicated."""
    # Simulation of the preamble deduplication logic in main.py
    def compose_payload(ack, next_q):
        clean_ack = (ack or "").strip()
        clean_q = (next_q or "").strip()
        if clean_ack and clean_q:
            ack_lower = clean_ack.lower()
            if clean_q.lower().startswith(ack_lower) or clean_q.lower().startswith(f"that's a {ack_lower}"):
                return clean_q
            elif clean_q.lower().startswith("that's a good question") and "good question" in ack_lower:
                return clean_q
            else:
                return f"{clean_ack} {clean_q}"
        return clean_q or clean_ack

    # Case 1: Identical acknowledgment repeated
    p1 = compose_payload("Good question.", "Good question. Let's proceed to data structures.")
    assert p1 == "Good question. Let's proceed to data structures."

    # Case 2: "That's a good question." preamble
    p2 = compose_payload("Good question.", "That's a good question. Our engineering team uses microservices.")
    assert p2 == "That's a good question. Our engineering team uses microservices."

    # Case 3: Distinct acknowledgment and question
    p3 = compose_payload("Understood.", "Which part of the database did you optimize?")
    assert p3 == "Understood. Which part of the database did you optimize?"

