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

        # Prioritize Windows WASAPI, then Windows DirectSound, then MME
        # Store all valid matches sorted by preference so fallback is possible if PortAudio has an error with one API
        sorted_matches = []
        for pref_api in ["Windows WASAPI", "Windows DirectSound", "MME"]:
            for match in matches:
                if match[2] == pref_api and match not in sorted_matches:
                    sorted_matches.append(match)
        for match in matches:
            if match not in sorted_matches:
                sorted_matches.append(match)

        self._candidate_devices = sorted_matches
        preferred = sorted_matches[0]

        self._selected_device_index = preferred[0]
        self._selected_device_name = preferred[1]
        self._selected_host_api = preferred[2]

        return preferred

    def validate_output_device(self, device_index: Optional[int] = None) -> Dict[str, Any]:
        """
        Validate whether the selected output device exists, check output settings,
        and verify that an actual test stream can open, start, and stop cleanly.
        Returns a dictionary with validation status and diagnostics.
        """
        import sounddevice as sd

        idx = device_index if device_index is not None else self._selected_device_index
        if idx is None:
            self.resolve_output_device()
            idx = self._selected_device_index

        try:
            dev_info = sd.query_devices(idx)
            apis = sd.query_hostapis()
            host_api = apis[dev_info["hostapi"]]["name"] if dev_info["hostapi"] < len(apis) else "Unknown"
        except Exception as e:
            return {
                "valid": False,
                "error": f"Device {idx} lookup failed: {e}",
                "deviceIndex": idx,
            }

        # Validate channel capacity
        out_channels = dev_info.get("max_output_channels", 0)
        if out_channels <= 0:
            return {
                "valid": False,
                "error": f"Device {idx} has 0 output channels",
                "deviceIndex": idx,
                "deviceName": dev_info.get("name"),
            }

        # Test opening, starting, and closing OutputStream with 2 channels at sample_rate
        channels_to_test = min(2, out_channels)
        try:
            sd.check_output_settings(device=idx, samplerate=self.sample_rate, channels=channels_to_test)
            test_stream = sd.OutputStream(
                device=idx,
                samplerate=self.sample_rate,
                channels=channels_to_test,
            )
            test_stream.start()
            test_stream.stop()
            test_stream.close()
            return {
                "valid": True,
                "deviceIndex": idx,
                "deviceName": dev_info.get("name"),
                "hostApi": host_api,
                "sampleRate": self.sample_rate,
                "channels": channels_to_test,
            }
        except Exception as stream_err:
            return {
                "valid": False,
                "error": f"Stream validation failed: {stream_err}",
                "deviceIndex": idx,
                "deviceName": dev_info.get("name"),
                "hostApi": host_api,
            }

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
            diag = self.validate_output_device()
            if diag.get("valid"):
                logger.info(f"[VOICE] Device validation passed: {diag['deviceName']} ({diag['hostApi']})")
            else:
                logger.warning(f"[VOICE] Device validation warning: {diag.get('error')}")
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

    def speak(self, text: str, voice: Optional[str] = None, blocking: bool = True) -> Dict[str, Any]:
        """
        Generate speech from text and play it through the configured VB-CABLE device.
        Returns a dict:
        {
            "success": True/False,
            "duration": float,
            "error": Optional[str],
            "deviceIndex": int,
            "hostApi": str
        }
        """
        if not text or not text.strip():
            logger.warning("[KokoroTTS] Speak called with empty text.")
            return {"success": False, "duration": 0.0, "error": "EMPTY_TEXT"}

        if not self.enabled:
            logger.info(f"[KokoroTTS] Kokoro disabled, skipping playback for: {text[:50]}")
            return {"success": False, "duration": 0.0, "error": "TTS_DISABLED"}

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
            return {"success": False, "duration": 0.0, "error": "NO_AUDIO_GENERATED"}

        duration = len(audio_data) / self.sample_rate

        # Reshape mono to stereo for maximum virtual cable driver compatibility
        if audio_data.ndim == 1:
            playback_audio = np.column_stack([audio_data, audio_data])
        else:
            playback_audio = audio_data

        # Candidates to try: primary preferred device, then any other host API matches (e.g. DirectSound/MME)
        candidates = getattr(self, "_candidate_devices", [(self._selected_device_index, self._selected_device_name, self._selected_host_api)])
        last_error = None

        for cand_idx, cand_name, cand_api in candidates:
            logger.info(f"[VOICE] CABLE stream opening: {cand_name} (index {cand_idx}, API: {cand_api})")
            val = self.validate_output_device(cand_idx)
            if not val.get("valid"):
                logger.warning(f"[VOICE] Device validation note for index {cand_idx}: {val.get('error')}. Trying next or proceeding...")

            self._is_speaking = True
            try:
                logger.info(f"[VOICE] Playback started (duration: {duration:.2f}s, samples: {len(audio_data)}, API: {cand_api})")
                sd.play(
                    playback_audio,
                    samplerate=self.sample_rate,
                    device=cand_idx,
                    blocking=blocking,
                )
                if blocking:
                    sd.stop()
                logger.info(f"[VOICE] Playback completed successfully on {cand_name} ({cand_api})")
                self._selected_device_index = cand_idx
                self._selected_device_name = cand_name
                self._selected_host_api = cand_api
                return {
                    "success": True,
                    "duration": round(duration, 2),
                    "deviceIndex": cand_idx,
                    "hostApi": cand_api,
                }
            except Exception as e:
                logger.warning(f"[KokoroTTS] Playback attempt failed on {cand_name} ({cand_api}): {e}")
                last_error = str(e)
            finally:
                self._is_speaking = False

        logger.error(f"[KokoroTTS] All playback candidates failed. Last error: {last_error}")
        return {
            "success": False,
            "duration": round(duration, 2),
            "error": f"PORTAUDIO_PLAYBACK_FAILED: {last_error}",
        }

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
