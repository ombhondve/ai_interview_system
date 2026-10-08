import os
import asyncio
import pytest
from unittest.mock import MagicMock, patch

from app.config import settings
from app.audio_capture import AudioCaptureService
from app.deepgram import DeepgramClient


def test_audio_capture_service_defaults():
    service = AudioCaptureService(sample_rate=16000, channels=1)
    info = service.get_device_info()
    assert info["targetSampleRate"] == 16000
    assert info["targetChannels"] == 1
    assert not service.is_running()


def test_audio_capture_zero_audio_level_on_empty():
    service = AudioCaptureService()
    level = service.get_audio_level()
    assert level == 0.0


def test_audio_capture_export_wav_bytes_structure():
    import numpy as np

    service = AudioCaptureService(sample_rate=16000, channels=1)
    service._native_sample_rate = 16000
    service._native_channels = 1
    # Generate 16000 samples (1 second) of a 440Hz sine wave
    t = np.linspace(0, 1, 16000, endpoint=False)
    sine = (np.sin(2 * np.pi * 440 * t) * 16000).astype(np.int16)
    service._recorded_frames = [sine.tobytes()]

    wav_bytes = service.export_wav_bytes()
    assert len(wav_bytes) > 44  # Has WAV header
    assert wav_bytes[:4] == b"RIFF"
    assert wav_bytes[8:12] == b"WAVE"

    level = service.get_audio_level()
    assert level > 0.0  # Non-zero audio detected


def test_deepgram_client_missing_key_raises():
    client = DeepgramClient(api_key="")
    with pytest.raises(ValueError, match="DEEPGRAM_API_KEY is not configured"):
        client.transcribe_audio_bytes(b"dummy")


def test_deepgram_client_empty_audio_raises():
    client = DeepgramClient(api_key="valid-test-key")
    with pytest.raises(ValueError, match="Audio payload is empty"):
        client.transcribe_audio_bytes(b"")


@patch("requests.post")
def test_deepgram_client_transcribe_success(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "results": {
            "channels": [
                {
                    "alternatives": [
                        {
                            "transcript": "Hello, I am ready for the interview.",
                            "confidence": 0.985,
                            "words": [{"word": "Hello"}, {"word": "I"}],
                        }
                    ]
                }
            ]
        },
        "metadata": {"duration": 2.45},
    }
    mock_post.return_value = mock_response

    client = DeepgramClient(api_key="valid-test-key")
    res = client.transcribe_audio_bytes(b"dummy-audio-bytes")
    assert res["success"] is True
    assert res["transcript"] == "Hello, I am ready for the interview."
    assert res["confidence"] == 0.985
    assert res["durationSeconds"] == 2.45

    # Ensure API key is passed in headers but not logged or leaked
    mock_post.assert_called_once()
    headers = mock_post.call_args[1]["headers"]
    assert headers["Authorization"] == "Token valid-test-key"


@patch("requests.post")
def test_deepgram_client_auth_failure_raises(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 401
    mock_post.return_value = mock_response

    client = DeepgramClient(api_key="invalid-key")
    with pytest.raises(PermissionError, match="Invalid Deepgram API credentials"):
        client.transcribe_audio_bytes(b"dummy-bytes")


def test_audio_capture_idempotent_start_no_duplicate_workers():
    from app.audio_capture import CaptureState
    service = AudioCaptureService()
    service._state = CaptureState.RUNNING
    service._thread = MagicMock()
    original_thread = service._thread

    # Repeated start while RUNNING should be idempotent and not replace thread
    success = service.start_capture()
    assert success is True
    assert service.state == CaptureState.RUNNING
    assert service._thread is original_thread


@pytest.mark.asyncio
async def test_audio_capture_utterance_short_answer():
    """
    Test 1: Short answer 'Hello' (~0.5s speech) followed by silence.
    Expected: Quickly finalized utterance without 30s wait.
    """
    import numpy as np
    from app.audio_capture import CaptureState

    service = AudioCaptureService(sample_rate=16000, channels=1)
    service._native_sample_rate = 16000
    service._native_channels = 1
    service._state = CaptureState.RUNNING

    # Generate 50ms chunks at 16000Hz (800 samples each)
    chunk_samples = 800
    t = np.linspace(0, 0.05, chunk_samples, endpoint=False)
    # Speech tone (RMS ~0.35)
    speech_chunk = (np.sin(2 * np.pi * 440 * t) * 16000).astype(np.int16).tobytes()
    # Silence chunk (RMS 0.0)
    silence_chunk = np.zeros(chunk_samples, dtype=np.int16).tobytes()

    # Pre-populate queue: 2 silence (pre-roll), 10 speech (0.5s), 20 silence (1.0s silence gap)
    for _ in range(2):
        service._audio_queue.put(silence_chunk)
    for _ in range(10):
        service._audio_queue.put(speech_chunk)
    for _ in range(20):
        service._audio_queue.put(silence_chunk)

    utterance = await service.capture_utterance(
        speech_start_rms=0.01,
        silence_rms=0.005,
        silence_duration_sec=0.5,
        min_speech_duration_sec=0.2,
        check_interval=0.01,
    )

    assert utterance is not None
    assert utterance["duration"] > 0
    # Must NOT wait 30 seconds
    assert utterance["duration"] < 5.0
    assert len(utterance["wav_bytes"]) > 44


@pytest.mark.asyncio
async def test_audio_capture_utterance_pause_between_words():
    """
    Test 3: Pause between words within utterance.
    Expected: Brief pause (< silence_duration_sec) does not cut off the answer prematurely.
    """
    import numpy as np
    from app.audio_capture import CaptureState

    service = AudioCaptureService(sample_rate=16000, channels=1)
    service._native_sample_rate = 16000
    service._native_channels = 1
    service._state = CaptureState.RUNNING

    chunk_samples = 800
    t = np.linspace(0, 0.05, chunk_samples, endpoint=False)
    speech_chunk = (np.sin(2 * np.pi * 440 * t) * 16000).astype(np.int16).tobytes()
    silence_chunk = np.zeros(chunk_samples, dtype=np.int16).tobytes()

    # "I used React" (8 chunks = 0.4s) -> short pause (4 chunks = 0.2s) -> "and Bootstrap" (8 chunks = 0.4s) -> silence (15 chunks = 0.75s)
    for _ in range(8):
        service._audio_queue.put(speech_chunk)
    for _ in range(4):
        service._audio_queue.put(silence_chunk)
    for _ in range(8):
        service._audio_queue.put(speech_chunk)
    for _ in range(15):
        service._audio_queue.put(silence_chunk)

    utterance = await service.capture_utterance(
        speech_start_rms=0.01,
        silence_rms=0.005,
        silence_duration_sec=0.5,
        min_speech_duration_sec=0.2,
        check_interval=0.01,
    )

    assert utterance is not None
    # All 8 + 4 + 8 chunks plus final silence should be preserved as ONE utterance
    assert utterance["frames_count"] >= 20


@pytest.mark.asyncio
async def test_audio_capture_max_utterance_limit():
    """
    Test 4: Candidate speaks continuously.
    Expected: Max utterance limit stops recording and returns audio.
    """
    import numpy as np
    from app.audio_capture import CaptureState

    service = AudioCaptureService(sample_rate=16000, channels=1)
    service._native_sample_rate = 16000
    service._native_channels = 1
    service._state = CaptureState.RUNNING

    chunk_samples = 800
    t = np.linspace(0, 0.05, chunk_samples, endpoint=False)
    speech_chunk = (np.sin(2 * np.pi * 440 * t) * 16000).astype(np.int16).tobytes()

    # 30 speech chunks (1.5s total)
    for _ in range(30):
        service._audio_queue.put(speech_chunk)

    # Force max_utterance_sec to 0.5s
    utterance = await service.capture_utterance(
        speech_start_rms=0.01,
        silence_rms=0.005,
        max_utterance_sec=0.5,
        check_interval=0.01,
    )

    assert utterance is not None
    assert utterance["duration"] <= 1.0


@pytest.mark.asyncio
async def test_audio_capture_ai_speaking_clears_candidate_buffer():
    """
    Test 6: When AI is speaking, candidate buffer is cleared to prevent self-transcription.
    """
    import numpy as np
    from app.audio_capture import CaptureState

    service = AudioCaptureService(sample_rate=16000, channels=1)
    service._native_sample_rate = 16000
    service._native_channels = 1
    service._state = CaptureState.RUNNING

    chunk_samples = 800
    t = np.linspace(0, 0.05, chunk_samples, endpoint=False)
    speech_chunk = (np.sin(2 * np.pi * 440 * t) * 16000).astype(np.int16).tobytes()

    for _ in range(5):
        service._audio_queue.put(speech_chunk)

    ai_speaking = True

    async def run_capture():
        return await service.capture_utterance(
            is_ai_speaking_fn=lambda: ai_speaking,
            check_interval=0.01,
        )

    task = asyncio.create_task(run_capture())
    await asyncio.sleep(0.05)
    # Stop capture
    service.stop_capture()
    result = await task
    assert result is None


