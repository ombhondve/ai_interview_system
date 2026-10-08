"""
Deepgram Speech-to-Text Client for RecruitAI Meeting Bot.
Transcribes audio using Deepgram Nova-2 API, matching RecruitAI's configuration.
"""

import os
import io
import logging
from typing import Optional, Dict, Any
import requests

from app.config import settings

logger = logging.getLogger("MeetingBot.Deepgram")


class DeepgramClient:
    """
    HTTP client for Deepgram Speech-to-Text API.
    Uses model Nova-2 with smart_format enabled.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: int = 30,
    ):
        self.api_key = api_key if api_key is not None else (settings.deepgram_api_key or os.getenv("DEEPGRAM_API_KEY", ""))
        self.model = model or settings.deepgram_model or "nova-2"
        self.timeout_seconds = timeout_seconds

    def is_configured(self) -> bool:
        """Check if DEEPGRAM_API_KEY is configured."""
        return bool(self.api_key and self.api_key.strip())

    def transcribe_audio_bytes(
        self,
        audio_bytes: bytes,
        content_type: str = "audio/wav",
    ) -> Dict[str, Any]:
        """
        Send raw audio bytes to Deepgram HTTP transcription endpoint.
        Returns a dictionary with transcript, confidence, words, and duration.
        """
        if not self.is_configured():
            raise ValueError(
                "DEEPGRAM_API_KEY is not configured. Please set DEEPGRAM_API_KEY in your environment or .env."
            )

        if not audio_bytes or len(audio_bytes) == 0:
            raise ValueError("Audio payload is empty.")

        url = "https://api.deepgram.com/v1/listen"
        params = {
            "model": self.model,
            "smart_format": "true",
            "punctuate": "true",
        }
        headers = {
            "Authorization": f"Token {self.api_key.strip()}",
            "Content-Type": content_type,
        }

        logger.info(
            f"[Deepgram] Sending {len(audio_bytes)} bytes of audio to Deepgram (model: {self.model})..."
        )

        try:
            response = requests.post(
                url,
                params=params,
                headers=headers,
                data=audio_bytes,
                timeout=self.timeout_seconds,
            )

            if response.status_code == 401 or response.status_code == 403:
                logger.error("[Deepgram] Authentication failed with Deepgram API.")
                raise PermissionError("Invalid Deepgram API credentials.")

            if response.status_code != 200:
                logger.error(
                    f"[Deepgram] API request failed with status {response.status_code}: {response.text}"
                )
                raise RuntimeError(
                    f"Deepgram transcription failed (HTTP {response.status_code})."
                )

            data = response.json()
            channel = data.get("results", {}).get("channels", [{}])[0]
            alternative = channel.get("alternatives", [{}])[0]
            transcript = alternative.get("transcript", "").strip()
            confidence = alternative.get("confidence", 0.0)
            words = alternative.get("words", [])
            duration = data.get("metadata", {}).get("duration", 0.0)

            logger.info(
                f"[Deepgram] Transcription completed successfully. "
                f"Transcript: '{transcript}' (Confidence: {round(confidence, 3)}, Duration: {round(duration, 2)}s)"
            )

            return {
                "success": True,
                "transcript": transcript,
                "confidence": confidence,
                "wordsCount": len(words),
                "durationSeconds": duration,
                "model": self.model,
            }

        except requests.exceptions.Timeout:
            logger.error("[Deepgram] Request timed out while waiting for transcription.")
            raise TimeoutError("Deepgram transcription request timed out.")
        except Exception as e:
            if not isinstance(e, (ValueError, PermissionError, TimeoutError, RuntimeError)):
                logger.exception(f"[Deepgram] Unexpected error during transcription: {e}")
            raise

    def transcribe_file(self, file_path: str) -> Dict[str, Any]:
        """Transcribe an audio file from disk."""
        path = os.path.abspath(file_path)
        if not os.path.exists(path):
            raise FileNotFoundError(f"Audio file not found: {path}")

        ext = os.path.splitext(path)[1].lower()
        content_type = "audio/wav"
        if ext == ".mp3":
            content_type = "audio/mpeg"
        elif ext in [".webm", ".ogg"]:
            content_type = f"audio/{ext[1:]}"

        with open(path, "rb") as f:
            audio_bytes = f.read()

        return self.transcribe_audio_bytes(audio_bytes, content_type=content_type)


# Global singleton Deepgram instance
deepgram_client = DeepgramClient()
