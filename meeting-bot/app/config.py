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

    # Audio capture configuration
    audio_capture_device: str = os.getenv("AUDIO_CAPTURE_DEVICE", "")  # empty means default loopback output
    audio_sample_rate: int = int(os.getenv("AUDIO_SAMPLE_RATE", "16000"))
    audio_channels: int = int(os.getenv("AUDIO_CHANNELS", "1"))

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
