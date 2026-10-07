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

    # API server host and port
    meeting_bot_host: str = os.getenv("MEETING_BOT_HOST", "127.0.0.1")
    meeting_bot_port: int = int(os.getenv("MEETING_BOT_PORT", "8001"))

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
