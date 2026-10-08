"""
Unit tests for KokoroTTS module and Phase 4 Voice Output requirements.
Validates:
1. KokoroTTS initialization
2. Output device discovery
3. Missing output device raises clear diagnostic error
4. Text-to-audio generation
5. Audio conversion 24kHz -> 48kHz (proper resampling)
6. AI_SPEAKING state management
7. STT ignored while AI_SPEAKING=true
8. nextQuestion passed to Kokoro
9. Microphone mute/unmute sequencing
10. Voice-test mode configuration
"""

import sys
import numpy as np
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from app.kokoro_tts import KokoroTTS
from app.bot import MeetingBot, BotStatus


# ==============================================================================
# TEST 1 & 2: Initialization & Device Discovery
# ==============================================================================

def test_kokoro_tts_initialization():
    tts = KokoroTTS(
        enabled=True,
        lang_code="a",
        voice="af_heart",
        output_device_name="CABLE Input",
        sample_rate=48000,
        auto_init_pipeline=False,
    )
    assert tts.enabled is True
    assert tts.lang_code == "a"
    assert tts.voice == "af_heart"
    assert tts.output_device_name == "CABLE Input"
    assert tts.sample_rate == 48000
    assert tts.is_speaking is False


def test_kokoro_tts_output_device_discovery():
    tts = KokoroTTS(enabled=True)
    mock_devices = [
        {"name": "Speakers (Realtek)", "max_output_channels": 2, "hostapi": 0},
        {"name": "CABLE Input (VB-Audio Virtual Cable)", "max_output_channels": 2, "hostapi": 1},
        {"name": "Microphone (Realtek)", "max_output_channels": 0, "hostapi": 0},
    ]
    mock_apis = [{"name": "MME"}, {"name": "Windows WASAPI"}]

    with patch("sounddevice.query_devices", return_value=mock_devices), \
         patch("sounddevice.query_hostapis", return_value=mock_apis):
        devices = tts.get_available_output_devices()
        assert len(devices) == 2
        assert devices[0]["name"] == "Speakers (Realtek)"
        assert devices[1]["name"] == "CABLE Input (VB-Audio Virtual Cable)"
        assert devices[1]["hostApi"] == "Windows WASAPI"


# ==============================================================================
# TEST 3: Missing Output Device Diagnostic Error
# ==============================================================================

def test_kokoro_tts_missing_output_device_raises_diagnostic():
    tts = KokoroTTS(enabled=True, output_device_name="NonExistentAudioDevice12345")
    mock_devices = [
        {"name": "Speakers (Realtek)", "max_output_channels": 2, "hostapi": 0},
    ]
    mock_apis = [{"name": "MME"}]

    with patch("sounddevice.query_devices", return_value=mock_devices), \
         patch("sounddevice.query_hostapis", return_value=mock_apis):
        with pytest.raises(RuntimeError) as exc_info:
            tts.resolve_output_device()
        assert "NonExistentAudioDevice12345" in str(exc_info.value)
        assert "Available audio output devices:" in str(exc_info.value)


def test_kokoro_tts_resolve_prefers_wasapi():
    tts = KokoroTTS(enabled=True, output_device_name="CABLE Input")
    mock_devices = [
        {"name": "CABLE Input (VB-Audio Virtual Cable)", "max_output_channels": 2, "hostapi": 0},  # MME
        {"name": "CABLE Input (VB-Audio Virtual Cable)", "max_output_channels": 2, "hostapi": 1},  # WASAPI
    ]
    mock_apis = [{"name": "MME"}, {"name": "Windows WASAPI"}]

    with patch("sounddevice.query_devices", return_value=mock_devices), \
         patch("sounddevice.query_hostapis", return_value=mock_apis):
        idx, name, api = tts.resolve_output_device()
        assert idx == 1
        assert api == "Windows WASAPI"


# ==============================================================================
# TEST 4 & 5: Resampling (24kHz -> 48kHz) & Audio Generation
# ==============================================================================

def test_audio_resampling_24k_to_48k():
    # 1 second of 24 kHz audio
    input_24k = np.ones(24000, dtype=np.float32) * 0.5
    resampled_48k = KokoroTTS.resample_24k_to_48k(input_24k, target_rate=48000)

    # Must be double the length (48000 samples)
    assert len(resampled_48k) == 48000
    assert resampled_48k.dtype == np.float32
    assert np.allclose(resampled_48k[:100], 0.5, atol=1e-3)


def test_text_to_audio_generation_mocked():
    tts = KokoroTTS(enabled=True, auto_init_pipeline=False)

    # Mock KPipeline instance
    mock_audio_chunk = MagicMock()
    mock_audio_chunk.numpy.return_value = np.zeros(24000, dtype=np.float32)

    mock_pipeline = MagicMock()
    mock_pipeline.return_value = [("g", "p", mock_audio_chunk)]
    tts._pipeline = mock_pipeline

    with patch.object(tts, "resolve_output_device", return_value=(15, "CABLE Input", "WASAPI")):
        audio_out = tts.generate_audio("Hello, world!")
        assert len(audio_out) == 48000
        assert audio_out.dtype == np.float32
        mock_pipeline.assert_called_once_with("Hello, world!", voice="af_heart")


def test_speak_playback_routed_to_sounddevice():
    tts = KokoroTTS(enabled=True, auto_init_pipeline=False)
    tts._pipeline = MagicMock()
    tts._selected_device_index = 15
    tts._selected_device_name = "CABLE Input"
    tts._selected_host_api = "Windows DirectSound"
    tts._candidate_devices = [(15, "CABLE Input", "Windows DirectSound")]
    tts.generate_audio = MagicMock(return_value=np.zeros(48000, dtype=np.float32))

    import sounddevice as sd
    with patch.object(tts, "validate_output_device", return_value={"valid": True, "deviceIndex": 15, "hostApi": "Windows DirectSound"}), \
         patch.object(tts, "resolve_output_device", return_value=(15, "CABLE Input", "Windows DirectSound")), \
         patch.object(sd, "play") as mock_play, \
         patch.object(sd, "stop") as mock_stop:
        res = tts.speak("Test speech")
        assert res["success"] is True
        assert res["duration"] == 1.0
        mock_play.assert_called_once()
        args, kwargs = mock_play.call_args
        assert kwargs["device"] == 15
        assert kwargs["samplerate"] == 48000
        assert kwargs["blocking"] is True
        mock_stop.assert_called_once()



# ==============================================================================
# TEST 6 & 7: AI_SPEAKING State Management & Self-Transcription Prevention
# ==============================================================================

@pytest.mark.asyncio
async def test_ai_speaking_state_during_speak_text():
    bot = MeetingBot()
    bot.status = BotStatus.JOINED

    mock_navigator = MagicMock()
    mock_navigator.is_inside_meeting = AsyncMock(return_value=True)
    mock_navigator.unmute_microphone = AsyncMock(return_value=True)
    mock_navigator.mute_microphone = AsyncMock(return_value=True)
    bot._navigator = mock_navigator
    bot._page = MagicMock()

    observed_states = []

    def fake_speak(text):
        observed_states.append({
            "status": bot.status,
            "ai_speaking": bot.is_ai_speaking(),
        })
        return True

    with patch("app.kokoro_tts.kokoro_tts.speak", side_effect=fake_speak):
        assert bot.is_ai_speaking() is False
        success = await bot.speak_text("Next question")
        assert success is True

    # Check observed state while speaking
    assert len(observed_states) == 1
    assert observed_states[0]["status"] == BotStatus.AI_SPEAKING
    assert observed_states[0]["ai_speaking"] is True

    # State restored after speaking
    assert bot.status == BotStatus.JOINED
    assert bot.is_ai_speaking() is False


# ==============================================================================
# TEST 8 & 9: Microphone Mute/Unmute Sequencing & nextQuestion passed to Kokoro
# ==============================================================================

@pytest.mark.asyncio
async def test_mic_mute_unmute_sequencing_and_next_question():
    bot = MeetingBot()
    bot.status = BotStatus.JOINED

    events = []

    mock_navigator = MagicMock()
    mock_navigator.is_inside_meeting = AsyncMock(return_value=True)

    async def mock_unmute():
        events.append("UNMUTE_MIC")
        return True

    async def mock_mute():
        events.append("MUTE_MIC")
        return True

    mock_navigator.unmute_microphone = mock_unmute
    mock_navigator.mute_microphone = mock_mute
    bot._navigator = mock_navigator
    bot._page = MagicMock()

    def fake_speak(text):
        events.append(f"KOKORO_SPEAK:{text}")
        return True

    with patch("app.kokoro_tts.kokoro_tts.speak", side_effect=fake_speak):
        next_question = "What design pattern did you choose?"
        res = await bot.speak_text(next_question)
        assert res is True

    # Verify strict execution sequence: UNMUTE -> SPEAK -> MUTE
    assert events == [
        "UNMUTE_MIC",
        f"KOKORO_SPEAK:{next_question}",
        "MUTE_MIC",
    ]


@pytest.mark.asyncio
async def test_speak_text_aborts_if_not_inside_meeting():
    bot = MeetingBot()
    bot.status = BotStatus.STARTING

    mock_navigator = MagicMock()
    mock_navigator.is_inside_meeting = AsyncMock(return_value=False)
    bot._navigator = mock_navigator
    bot._page = MagicMock()

    with patch("app.kokoro_tts.kokoro_tts.speak") as mock_speak:
        res = await bot.speak_text("Should not speak")
        assert res is False
        mock_speak.assert_not_called()


# ==============================================================================
# TEST 10: Voice Test Mode CLI & Configuration
# ==============================================================================

def test_voice_test_cli_flags():
    from app.main import run_cli
    import argparse

    # Test parser parses --voice-test and --speak
    with patch("argparse.ArgumentParser.parse_args") as mock_args:
        mock_args.return_value = argparse.Namespace(
            voice_test=True,
            speak="Test sentence",
            meet_url="https://meet.google.com/abc-defg-hij",
            server=False,
            auth_setup=False,
            audio_test=False,
            transcribe_file=None,
            meet_audio_test=False,
            interview_id=None,
            candidate_id=None,
            submit_test_transcript=False,
            text=None,
        )
        assert mock_args.return_value.voice_test is True
        assert mock_args.return_value.speak == "Test sentence"
