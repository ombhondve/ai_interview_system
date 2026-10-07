import os
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
