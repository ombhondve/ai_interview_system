"""
Configuration settings for RecruitAI Meeting Bot.
Loaded from environment variables with safe defaults.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # API authentication secret
    meeting_bot_api_secret: str = os.getenv("MEETING_BOT_API_SECRET", "recruitai-default-bot-secret")

    # Persistent user data directory for Chromium profile
    meeting_bot_profile_dir: str = os.getenv(
        "MEETING_BOT_PROFILE_DIR",
        str(Path(__file__).resolve().parent.parent / "bot-profile"),
    )

    # Browser headless flag (default: False for interactive login and visual inspection)
    meeting_bot_headless: bool = os.getenv("MEETING_BOT_HEADLESS", "false").lower() in ("true", "1", "yes")

    # Deepgram STT configuration
    deepgram_api_key: str = os.getenv("DEEPGRAM_API_KEY", "")
    deepgram_model: str = os.getenv("DEEPGRAM_MODEL", "nova-2")

    # Audio capture configuration (WASAPI loopback capturing audio routed to Meet speaker)
    audio_capture_device: str = os.getenv("AUDIO_CAPTURE_DEVICE", "Speaker (2- Realtek(R) Audio)")
    audio_sample_rate: int = int(os.getenv("AUDIO_SAMPLE_RATE", "16000"))
    audio_channels: int = int(os.getenv("AUDIO_CHANNELS", "1"))

    # Utterance VAD & End-of-Speech Configuration
    audio_speech_start_rms: float = float(os.getenv("AUDIO_SPEECH_START_RMS", "0.012"))
    audio_silence_rms: float = float(os.getenv("AUDIO_SILENCE_RMS", "0.007"))
    audio_silence_duration_sec: float = float(os.getenv("AUDIO_SILENCE_DURATION_SEC", "1.6"))
    audio_min_speech_duration_sec: float = float(os.getenv("AUDIO_MIN_SPEECH_DURATION_SEC", "0.4"))
    audio_max_utterance_sec: float = float(os.getenv("AUDIO_MAX_UTTERANCE_SEC", "90.0"))
    audio_pre_roll_sec: float = float(os.getenv("AUDIO_PRE_ROLL_SEC", "0.5"))

    # Bot Google account identification (Phase 4.5)
    google_meet_bot_email: str = os.getenv("GOOGLE_MEET_BOT_EMAIL", "ombhondve32@gmail.com")

    # Backend API configuration (Phase 3 Integration)
    # Supports RECRUITAI_API_URL or RECRUITAI_BACKEND_URL; defaults to local development http://localhost:5000
    recruitai_api_url: str = os.getenv(
        "RECRUITAI_API_URL",
        os.getenv("RECRUITAI_BACKEND_URL", "http://localhost:5000"),
    )
    recruitai_backend_url: str = os.getenv(
        "RECRUITAI_API_URL",
        os.getenv("RECRUITAI_BACKEND_URL", "http://localhost:5000"),
    )
    recruitai_internal_api_secret: str = os.getenv(
        "RECRUITAI_INTERNAL_API_SECRET",
        os.getenv("BOT_CONTROL_API_SECRET", os.getenv("MEETING_BOT_API_SECRET", "recruitai-default-bot-secret")),
    )

    # Kokoro TTS configuration (Phase 4 Integration)
    kokoro_enabled: bool = os.getenv("KOKORO_ENABLED", "true").lower() in ("true", "1", "yes")
    kokoro_lang_code: str = os.getenv("KOKORO_LANG_CODE", "a")
    kokoro_voice: str = os.getenv("KOKORO_VOICE", "af_heart")
    kokoro_output_device: str = os.getenv("KOKORO_OUTPUT_DEVICE", "CABLE Input (VB-Audio Virtual Cable)")
    kokoro_sample_rate: int = int(os.getenv("KOKORO_SAMPLE_RATE", "48000"))

    # Google Meet in-browser audio device routing configuration
    meet_mic_device: str = os.getenv("MEET_MIC_DEVICE", "CABLE Output (VB-Audio Virtual Cable)")
    meet_speaker_device: str = os.getenv("MEET_SPEAKER_DEVICE", "CABLE Input (VB-Audio Virtual Cable)")

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

