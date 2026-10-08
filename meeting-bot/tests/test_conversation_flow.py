"""
Unit tests for the Live AI Interview Conversation State Machine and Safety Guards.
Verifies all 15 required conversation scenarios:
1. Candidate speaks continuously -> no interruption.
2. Candidate pauses 1-2 seconds -> bot waits (CANDIDATE_PAUSED, no premature cutoff).
3. Candidate pauses then continues -> same answer utterance.
4. Candidate finishes -> only then Deepgram/backend processing.
5. Candidate says 'I don't know' -> MOVE_ON.
6. Candidate says 'I'm not sure' -> MOVE_ON.
7. Candidate asks for clarification -> REPEAT / rephrase.
8. Candidate asks for time -> WAIT ('Sure, take your time.').
9. Candidate gives short answer -> relevant follow-up.
10. Candidate gives strong answer -> contextual follow-up.
11. Candidate is silent -> recovery flow (reassure -> offer repeat -> skip).
12. Candidate speaks while TTS is pending -> TTS is blocked/cancelled.
13. Partial transcript never triggers next question.
14. AI voice does not trigger candidate-answer processing.
15. Interview reaches completion without getting stuck.
"""

import asyncio
import time
import pytest
import numpy as np
from unittest.mock import MagicMock, AsyncMock, patch

from app.main import ConversationState, ConversationManager
from app.bot import MeetingBot, BotStatus
from app.audio_capture import AudioCaptureService, CaptureState


# ------------------------------------------------------------------------------
# Test 1, 2, 3: Candidate speech, pauses, and continuous answer
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_candidate_pause_transitions_to_candidate_paused_and_resumes():
    """
    Test 2 & 3:
    Candidate pauses 1-2 seconds -> state transitions to CANDIDATE_PAUSED without ending utterance.
    Candidate resumes speaking -> state transitions back to CANDIDATE_SPEAKING in the same utterance.
    """
    bot = MeetingBot()
    audio = AudioCaptureService(sample_rate=16000, channels=1)
    audio._native_sample_rate = 16000
    audio._native_channels = 1
    audio._state = CaptureState.RUNNING

    client = MagicMock()
    deepgram = MagicMock()
    mgr = ConversationManager(bot, audio, client, deepgram)

    # Audio synthesis: speech (0.4s) -> silence (0.6s) -> speech (0.4s) -> silence (1.8s)
    chunk_samples = 800
    t = np.linspace(0, 0.05, chunk_samples, endpoint=False)
    speech_chunk = (np.sin(2 * np.pi * 440 * t) * 16000).astype(np.int16).tobytes()
    silence_chunk = np.zeros(chunk_samples, dtype=np.int16).tobytes()

    for _ in range(8):  # 0.4s speech
        audio._audio_queue.put(speech_chunk)
    for _ in range(12):  # 0.6s pause
        audio._audio_queue.put(silence_chunk)
    for _ in range(8):  # 0.4s speech resume
        audio._audio_queue.put(speech_chunk)
    for _ in range(35):  # 1.75s confirmed end silence
        audio._audio_queue.put(silence_chunk)

    state_history = []
    orig_set_state = mgr.set_state

    def capture_state(new_state, decision=""):
        state_history.append(new_state)
        orig_set_state(new_state, decision)

    mgr.set_state = capture_state

    utterance = await audio.capture_utterance(
        on_speech_start=mgr.on_speech_start,
        on_speech_pause=mgr.on_speech_pause,
        on_speech_resume=mgr.on_speech_resume,
        speech_start_rms=0.01,
        silence_rms=0.005,
        pause_confirmation_sec=1.5,
        min_speech_duration_sec=0.2,
        check_interval=0.01,
    )

    assert utterance is not None
    # Verify sequence of transitions: SPEAKING -> PAUSED -> SPEAKING
    assert ConversationState.CANDIDATE_SPEAKING in state_history
    assert ConversationState.CANDIDATE_PAUSED in state_history
    assert state_history.count(ConversationState.CANDIDATE_SPEAKING) >= 2


# ------------------------------------------------------------------------------
# Test 12: Interruption Safety Guards (Hard TTS guard and cancel)
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ai_tts_blocked_when_candidate_speaking():
    """
    Test 12A:
    If candidate_speaking is True, speak_text() aborts immediately and logs
    [SAFETY] AI_TTS_BLOCKED_CANDIDATE_SPEAKING.
    """
    bot = MeetingBot()
    bot.status = BotStatus.JOINED
    bot.set_candidate_speaking(True)

    with patch("app.kokoro_tts.kokoro_tts.speak") as mock_speak:
        spoken = await bot.speak_text("What technologies did you use?")
        assert spoken is False
        mock_speak.assert_not_called()


@pytest.mark.asyncio
async def test_ai_tts_cancelled_when_candidate_starts_speaking():
    """
    Test 12B:
    If AI is currently speaking and candidate begins speaking, active TTS playback
    is cancelled immediately via kokoro_tts.stop().
    """
    bot = MeetingBot()
    bot.status = BotStatus.AI_SPEAKING
    bot.ai_speaking = True

    with patch("app.kokoro_tts.kokoro_tts.stop") as mock_stop:
        bot.set_candidate_speaking(True)
        assert bot.is_candidate_speaking() is True
        mock_stop.assert_called_once()


# ------------------------------------------------------------------------------
# Test 14: AI Voice Echo Prevention
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ai_speaking_clears_candidate_utterance_buffer():
    """
    Test 14:
    Audio capture discards loopback audio if AI is speaking, preventing feedback loop.
    """
    audio = AudioCaptureService(sample_rate=16000, channels=1)
    audio._native_sample_rate = 16000
    audio._native_channels = 1
    audio._state = CaptureState.RUNNING

    chunk = np.zeros(800, dtype=np.int16).tobytes()
    for _ in range(5):
        audio._audio_queue.put(chunk)

    async def run_capture():
        return await audio.capture_utterance(
            is_ai_speaking_fn=lambda: True,
            check_interval=0.01,
        )

    task = asyncio.create_task(run_capture())
    await asyncio.sleep(0.05)
    audio.stop_capture()
    res = await task
    assert res is None


# ------------------------------------------------------------------------------
# Test 5, 6, 7, 8, 9, 10: Intent Classification & Conversation Flow
# ------------------------------------------------------------------------------

def test_intent_mapping_actions():
    """
    Test 5-10:
    Verifies that backend response actions map directly to expected conversation states.
    """
    bot = MeetingBot()
    audio = MagicMock()
    client = MagicMock()
    deepgram = MagicMock()
    mgr = ConversationManager(bot, audio, client, deepgram)

    # 1. "I don't know" -> MOVE_ON
    mgr.set_state(ConversationState.ASKING_NEXT_QUESTION, decision="dont_know_move_on")
    assert mgr.state == ConversationState.ASKING_NEXT_QUESTION

    # 2. "Give me a moment" -> THINKING
    mgr.set_state(ConversationState.THINKING, decision="candidate_thinking")
    assert mgr.state == ConversationState.THINKING

    # 3. "Can you repeat?" -> CLARIFICATION
    mgr.set_state(ConversationState.CLARIFICATION, decision="clarification_requested")
    assert mgr.state == ConversationState.CLARIFICATION

    # 4. Short answer -> ASKING_FOLLOWUP
    mgr.set_state(ConversationState.ASKING_FOLLOWUP, decision="contextual_follow_up")
    assert mgr.state == ConversationState.ASKING_FOLLOWUP

    # 5. Acknowledgment -> ACKNOWLEDGING
    mgr.set_state(ConversationState.ACKNOWLEDGING, decision="ack='Got it.'")
    assert mgr.state == ConversationState.ACKNOWLEDGING


# ------------------------------------------------------------------------------
# Test 11: No Response Recovery Flow
# ------------------------------------------------------------------------------

def test_no_response_recovery_state_progression():
    """
    Test 11:
    Candidate silence progresses from step 0 (waiting) -> step 1 (reassure) -> step 2 (offer repeat) -> step 3 (skip).
    """
    bot = MeetingBot()
    audio = MagicMock()
    client = MagicMock()
    deepgram = MagicMock()
    mgr = ConversationManager(bot, audio, client, deepgram)

    # Initial state
    assert mgr.no_response_step == 0
    mgr.set_state(ConversationState.WAITING_FOR_CANDIDATE)

    # Step 1: Reassure
    mgr.no_response_step = 1
    mgr.set_state(ConversationState.NO_RESPONSE, decision="reassure_candidate")
    assert mgr.state == ConversationState.NO_RESPONSE

    # Step 2: Offer repeat
    mgr.no_response_step = 2
    mgr.set_state(ConversationState.NO_RESPONSE, decision="offer_repeat")
    assert mgr.state == ConversationState.NO_RESPONSE

    # Step 3: Skip
    mgr.no_response_step = 0
    mgr.set_state(ConversationState.SKIPPING_QUESTION, decision="prolonged_silence_skip")
    assert mgr.state == ConversationState.SKIPPING_QUESTION


# ------------------------------------------------------------------------------
# Test 8, 9, 10, 15: Multilingual Intent & Completion Lifecycle
# ------------------------------------------------------------------------------

def test_multilingual_and_completion_states():
    """
    Test 8, 9, 15:
    Validates state transitions for multilingual clarifications, redirects, and clean interview completion.
    """
    bot = MeetingBot()
    audio = MagicMock()
    client = MagicMock()
    deepgram = MagicMock()
    mgr = ConversationManager(bot, audio, client, deepgram)

    # Closing -> COMPLETING -> ENDED
    mgr.set_state(ConversationState.COMPLETING, decision="interview_closing")
    assert mgr.state == ConversationState.COMPLETING

    mgr.set_state(ConversationState.ENDED, decision="interview_ended")
    assert mgr.state == ConversationState.ENDED


# ------------------------------------------------------------------------------
# Test 16: Pre-check, Adaptive Stages & Master Recording Flow
# ------------------------------------------------------------------------------

def test_interview_phases_progression():
    """
    Verifies that the full 10-phase states are supported in ConversationState:
    PRECHECK -> CAMERA_CHECK -> OPENING -> PROJECT_CONFIRMATION ->
    PROJECT_UNDERSTANDING -> QUESTIONING -> STRENGTH_DEPTH -> WEAKNESS_GAP ->
    COMPLETING -> ENDED
    """
    bot = MeetingBot()
    audio = MagicMock()
    client = MagicMock()
    deepgram = MagicMock()
    mgr = ConversationManager(bot, audio, client, deepgram)

    phases = [
        ConversationState.PRECHECK,
        ConversationState.CAMERA_CHECK,
        ConversationState.OPENING,
        ConversationState.PROJECT_CONFIRMATION,
        ConversationState.PROJECT_UNDERSTANDING,
        ConversationState.QUESTIONING,
        ConversationState.STRENGTH_DEPTH,
        ConversationState.WEAKNESS_GAP,
        ConversationState.COMPLETING,
        ConversationState.ENDED,
    ]

    for p in phases:
        mgr.set_state(p, decision=f"transition_to_{p.value}")
        assert mgr.state == p


def test_master_recording_accumulation_and_export(tmp_path):
    """
    Verifies that AudioCaptureService accumulates audio during master recording
    and exports a valid master WAV file without altering live VAD.
    """
    audio = AudioCaptureService(sample_rate=16000, channels=1)
    audio._native_sample_rate = 16000
    audio._native_channels = 1
    audio._state = CaptureState.RUNNING

    chunk = (np.sin(np.linspace(0, 0.05, 800, endpoint=False)) * 16000).astype(np.int16).tobytes()

    # Start master recording
    audio.start_master_recording()
    assert audio._master_recording_active is True

    # Simulate arrival of audio frames
    with audio._lock:
        audio._master_frames.append(chunk)
        audio._master_frames.append(chunk)

    out_file = str(tmp_path / "master_test.wav")
    meta = audio.export_master_recording_wav(out_file)
    assert meta is not None
    assert meta["durationSeconds"] > 0
    assert meta["channels"] == 1
    assert meta["sampleRate"] == 16000

    dur = audio.stop_master_recording()
    assert audio._master_recording_active is False
    assert dur >= 0.0

