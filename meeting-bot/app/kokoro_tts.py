"""
Dedicated Kokoro TTS Module for RecruitAI Meeting Bot (Phase 4).
Responsibilities:
- Initialize Kokoro KPipeline once at bot startup
- Generate speech audio from text using local Kokoro model
- Resample 24 kHz Kokoro audio to 48 kHz mono float32 for VB-CABLE
- Discover and route playback audio through configured VB-CABLE device
- Expose speak(text), stop(), and device query methods
"""

import logging
from typing import Optional, Dict, Any, List, Tuple
import numpy as np

from app.config import settings

logger = logging.getLogger("MeetingBot.KokoroTTS")


class KokoroTTS:
    """
    Manages local Kokoro TTS pipeline and sounddevice audio playback
    routed directly to VB-CABLE Input.
    """

    def __init__(
        self,
        enabled: Optional[bool] = None,
        lang_code: Optional[str] = None,
        voice: Optional[str] = None,
        output_device_name: Optional[str] = None,
        sample_rate: Optional[int] = None,
        auto_init_pipeline: bool = False,
    ):
        self.enabled = settings.kokoro_enabled if enabled is None else enabled
        self.lang_code = lang_code or settings.kokoro_lang_code
        self.voice = voice or settings.kokoro_voice
        self.output_device_name = output_device_name or settings.kokoro_output_device
        self.sample_rate = sample_rate or settings.kokoro_sample_rate

        self._pipeline = None
        self._is_speaking = False
        self._selected_device_index: Optional[int] = None
        self._selected_device_name: Optional[str] = None
        self._selected_host_api: Optional[str] = None

        if self.enabled and auto_init_pipeline:
            self.initialize()

    def get_available_output_devices(self) -> List[Dict[str, Any]]:
        """List all audio output devices available on the system."""
        try:
            import sounddevice as sd
            devices = sd.query_devices()
            apis = sd.query_hostapis()
            results = []
            for idx, dev in enumerate(devices):
                if dev.get("max_output_channels", 0) > 0:
                    api_name = apis[dev["hostapi"]]["name"] if dev["hostapi"] < len(apis) else "Unknown"
                    results.append({
                        "index": idx,
                        "name": dev["name"],
                        "hostApi": api_name,
                        "maxOutputChannels": dev["max_output_channels"],
                        "defaultSampleRate": dev.get("default_samplerate", 44100),
                    })
            return results
        except Exception as e:
            logger.warning(f"[KokoroTTS] Failed to query audio devices: {e}")
            return []

    def resolve_output_device(self, target_name: Optional[str] = None) -> Tuple[int, str, str]:
        """
        Locate the output device matching target_name (case-insensitive substring).
        Prioritizes Windows WASAPI > Windows DirectSound > MME for best audio stability.
        Raises RuntimeError with available output devices if not found.
        """
        import sounddevice as sd

        search = (target_name or self.output_device_name or "").strip().lower()
        devices = sd.query_devices()
        apis = sd.query_hostapis()

        matches = []
        for idx, dev in enumerate(devices):
            if dev.get("max_output_channels", 0) > 0:
                name = dev.get("name", "")
                if search and search in name.lower():
                    api_name = apis[dev["hostapi"]]["name"] if dev["hostapi"] < len(apis) else "Unknown"
                    matches.append((idx, name, api_name))

        if not matches:
            available = self.get_available_output_devices()
            avail_str = "\n".join(
                [f"  [{d['index']}] {d['name']} (API: {d['hostApi']}, Out Ch: {d['maxOutputChannels']})" for d in available]
            )
            raise RuntimeError(
                f"[KokoroTTS] Configured output device '{self.output_device_name}' was not found on system.\n"
                f"Available audio output devices:\n{avail_str}"
            )

        # Prioritize Windows WASAPI, then DirectSound, then MME
        preferred = None
        for pref_api in ["Windows WASAPI", "Windows DirectSound", "MME"]:
            for match in matches:
                if match[2] == pref_api:
                    preferred = match
                    break
            if preferred:
                break

        if not preferred:
            preferred = matches[0]

        self._selected_device_index = preferred[0]
        self._selected_device_name = preferred[1]
        self._selected_host_api = preferred[2]

        return preferred

    def initialize(self) -> None:
        """
        Initialize the Kokoro KPipeline once and verify device routing.
        """
        if not self.enabled:
            logger.info("[KokoroTTS] Kokoro TTS is disabled by configuration.")
            return

        if self._pipeline is not None:
            return

        logger.info("[VOICE] Initializing Kokoro...")
        try:
            from kokoro import KPipeline
            self._pipeline = KPipeline(lang_code=self.lang_code)
            logger.info("[VOICE] Kokoro initialized")
        except Exception as e:
            logger.exception(f"[KokoroTTS] Failed to initialize Kokoro pipeline: {e}")
            raise RuntimeError(f"Kokoro initialization failed: {e}")

        # Resolve output device
        try:
            dev_idx, dev_name, host_api = self.resolve_output_device()
            logger.info(f"[VOICE] Output device: {dev_name} (index: {dev_idx}, host API: {host_api})")
            logger.info(f"[VOICE] Sample rate: {self.sample_rate}")
        except Exception as e:
            logger.error(f"[KokoroTTS] Device resolution warning: {e}")
            raise

    @staticmethod
    def resample_24k_to_48k(audio_24k: np.ndarray, target_rate: int = 48000) -> np.ndarray:
        """
        Resample 24 kHz float32 audio to target sample rate (default 48 kHz).
        Uses high-fidelity linear interpolation.
        Returns 1D float32 numpy array.
        """
        if len(audio_24k) == 0:
            return np.array([], dtype=np.float32)

        if audio_24k.dtype != np.float32:
            audio_24k = audio_24k.astype(np.float32)

        # If already mono 1D
        if audio_24k.ndim > 1:
            audio_24k = audio_24k.flatten()

        new_length = int(len(audio_24k) * target_rate / 24000)
        old_positions = np.linspace(0, 1, len(audio_24k))
        new_positions = np.linspace(0, 1, new_length)

        audio_resampled = np.interp(new_positions, old_positions, audio_24k).astype(np.float32)
        return audio_resampled

    def generate_audio(self, text: str, voice: Optional[str] = None) -> np.ndarray:
        """
        Generate resampled 48 kHz audio for the provided text using Kokoro pipeline.
        Returns a 1D float32 numpy array.
        """
        if not text or not text.strip():
            return np.array([], dtype=np.float32)

        if self._pipeline is None:
            self.initialize()

        target_voice = voice or self.voice
        audio_chunks = []

        for _, _, audio in self._pipeline(text.strip(), voice=target_voice):
            if hasattr(audio, "numpy"):
                audio_chunks.append(audio.numpy())
            elif isinstance(audio, np.ndarray):
                audio_chunks.append(audio)

        if not audio_chunks:
            return np.array([], dtype=np.float32)

        audio_24k = np.concatenate(audio_chunks).astype(np.float32)
        audio_48k = self.resample_24k_to_48k(audio_24k, target_rate=self.sample_rate)
        return audio_48k

    def speak(self, text: str, voice: Optional[str] = None, blocking: bool = True) -> bool:
        """
        Generate speech from text and play it through the configured VB-CABLE device.
        """
        if not text or not text.strip():
            logger.warning("[KokoroTTS] Speak called with empty text.")
            return False

        if not self.enabled:
            logger.info(f"[KokoroTTS] Kokoro disabled, skipping playback for: {text[:50]}")
            return False

        if self._pipeline is None:
            self.initialize()

        if self._selected_device_index is None:
            self.resolve_output_device()

        import sounddevice as sd

        logger.info(f"[VOICE] Text: {text.strip()}")
        logger.info("[VOICE] Generating speech...")
        audio_data = self.generate_audio(text, voice=voice)

        if len(audio_data) == 0:
            logger.warning("[KokoroTTS] No audio generated for text.")
            return False

        duration = len(audio_data) / self.sample_rate
        logger.info(f"[VOICE] Playback started (duration: {duration:.2f}s, samples: {len(audio_data)})")

        self._is_speaking = True
        try:
            sd.play(
                audio_data,
                samplerate=self.sample_rate,
                device=self._selected_device_index,
                blocking=blocking,
            )
            if blocking:
                sd.stop()
            logger.info("[VOICE] Playback finished")
            return True
        except Exception as e:
            logger.exception(f"[KokoroTTS] Error during audio playback: {e}")
            return False
        finally:
            self._is_speaking = False

    def stop(self) -> None:
        """Immediately stop any active sounddevice playback."""
        try:
            import sounddevice as sd
            sd.stop()
        except Exception as e:
            logger.debug(f"[KokoroTTS] Stop playback exception: {e}")
        self._is_speaking = False

    @property
    def is_speaking(self) -> bool:
        return self._is_speaking


# Global singleton instance
kokoro_tts = KokoroTTS()
