"""
Audio Capture Module for RecruitAI Meeting Bot.
Captures system/meeting output audio using WASAPI loopback on Windows
without capturing or interfering with the bot's own microphone.
"""

import os
import io
import wave
import time
import queue
import logging
import threading
from typing import Optional, Dict, Any, List
from pathlib import Path

import numpy as np

from app.config import settings

logger = logging.getLogger("MeetingBot.AudioCapture")


class AudioCaptureService:
    """
    Manages capturing live output audio from Google Meet via WASAPI loopback.
    Supports starting, stopping, measuring audio RMS level, and saving recordings to WAV.
    """

    def __init__(
        self,
        device_name: Optional[str] = None,
        sample_rate: int = 16000,
        channels: int = 1,
    ):
        self.device_name = device_name or settings.audio_capture_device
        self.target_sample_rate = sample_rate or settings.audio_sample_rate
        self.target_channels = channels or settings.audio_channels

        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._audio_queue: queue.Queue = queue.Queue()
        self._recorded_frames: List[bytes] = []
        self._lock = threading.Lock()
        self._capture_device_info: Optional[Dict[str, Any]] = None
        self._native_sample_rate: int = 48000
        self._native_channels: int = 2

    def is_running(self) -> bool:
        """Check if audio capture is actively running."""
        return self._running

    def get_device_info(self) -> Dict[str, Any]:
        """Return details about the currently selected loopback capture device."""
        return {
            "deviceName": self._capture_device_info.get("name") if self._capture_device_info else "Default WASAPI Loopback",
            "targetSampleRate": self.target_sample_rate,
            "targetChannels": self.target_channels,
            "nativeSampleRate": self._native_sample_rate,
            "nativeChannels": self._native_channels,
            "isRunning": self._running,
        }

    def start_capture(self) -> bool:
        """Start capturing output audio in a background thread."""
        with self._lock:
            if self._running:
                logger.warning("[AudioCapture] Audio capture is already active.")
                return True

            self._recorded_frames = []
            while not self._audio_queue.empty():
                try:
                    self._audio_queue.get_nowait()
                except queue.Empty:
                    break

            try:
                import pyaudiowpatch as pyaudio

                p = pyaudio.PyAudio()
                try:
                    wasapi_info = p.get_host_api_info_by_type(pyaudio.paWASAPI)
                except Exception as e:
                    logger.error(f"[AudioCapture] WASAPI host API not found: {e}")
                    p.terminate()
                    return False

                # Find the default WASAPI output speaker and its matching loopback device
                default_speakers = p.get_device_info_by_index(wasapi_info["defaultOutputDevice"])
                target_loopback = None

                for loopback_device in p.get_loopback_device_info_generator():
                    # If specific device configured, match by name
                    if self.device_name and self.device_name.lower() in loopback_device["name"].lower():
                        target_loopback = loopback_device
                        break
                    # Otherwise match the system default output device
                    if default_speakers["name"] in loopback_device["name"]:
                        target_loopback = loopback_device
                        break

                # Fallback to the first available loopback device
                if not target_loopback:
                    loopback_list = list(p.get_loopback_device_info_generator())
                    if loopback_list:
                        target_loopback = loopback_list[0]

                if not target_loopback:
                    logger.error("[AudioCapture] No WASAPI loopback audio device discovered on system.")
                    p.terminate()
                    return False

                self._capture_device_info = target_loopback
                self._native_sample_rate = int(target_loopback["defaultSampleRate"])
                self._native_channels = int(target_loopback["maxInputChannels"])

                logger.info(
                    f"[AudioCapture] Selected loopback device: '{target_loopback['name']}' "
                    f"(Native rate: {self._native_sample_rate}Hz, channels: {self._native_channels})"
                )

                self._running = True
                self._thread = threading.Thread(
                    target=self._capture_worker,
                    args=(p, target_loopback),
                    daemon=True,
                )
                self._thread.start()
                logger.info("[AudioCapture] Audio capture background worker started.")
                return True

            except Exception as e:
                logger.exception(f"[AudioCapture] Failed to start audio capture: {e}")
                self._running = False
                return False

    def _capture_worker(self, p_audio, device_info: dict) -> None:
        """Worker loop reading audio frames from WASAPI loopback stream."""
        import pyaudiowpatch as pyaudio

        stream = None
        try:
            stream = p_audio.open(
                format=pyaudio.paInt16,
                channels=device_info["maxInputChannels"],
                rate=int(device_info["defaultSampleRate"]),
                input=True,
                input_device_index=device_info["index"],
                frames_per_buffer=1024,
            )

            while self._running:
                data = stream.read(1024, exception_on_overflow=False)
                if data:
                    with self._lock:
                        self._recorded_frames.append(data)
                        self._audio_queue.put(data)

        except Exception as e:
            if self._running:
                logger.error(f"[AudioCapture] Exception in capture loop: {e}")
        finally:
            if stream:
                try:
                    stream.stop_stream()
                    stream.close()
                except Exception:
                    pass
            try:
                p_audio.terminate()
            except Exception:
                pass
            logger.info("[AudioCapture] Audio capture stream closed.")

    def stop_capture(self) -> None:
        """Stop capturing audio and join the worker thread."""
        with self._lock:
            if not self._running:
                return
            self._running = False

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3.0)
        self._thread = None
        logger.info("[AudioCapture] Audio capture stopped.")

    def get_audio_level(self, window_chunks: int = 10) -> float:
        """
        Calculate Root-Mean-Square (RMS) amplitude level from the most recent audio chunks.
        Returns a float between 0.0 (silence) and 1.0 (peak).
        """
        diag = self.get_audio_diagnostics(window_chunks=window_chunks)
        return diag["rms"]

    def get_audio_diagnostics(self, window_chunks: int = 10) -> Dict[str, Any]:
        """
        Compute safe runtime diagnostics including RMS, peak amplitude, and speech presence
        without logging or exposing raw candidate speech audio.
        """
        with self._lock:
            if not self._recorded_frames:
                return {"rms": 0.0, "peak": 0.0, "speechDetected": False, "chunkCount": 0}
            recent = self._recorded_frames[-window_chunks:]

        if not recent:
            return {"rms": 0.0, "peak": 0.0, "speechDetected": False, "chunkCount": 0}

        raw_bytes = b"".join(recent)
        samples = np.frombuffer(raw_bytes, dtype=np.int16)
        if len(samples) == 0:
            return {"rms": 0.0, "peak": 0.0, "speechDetected": False, "chunkCount": 0}

        rms = np.sqrt(np.mean(samples.astype(np.float64) ** 2))
        normalized_rms = min(1.0, float(rms / 32768.0))
        peak = float(np.max(np.abs(samples))) / 32768.0
        speech_detected = normalized_rms > 0.003 or peak > 0.01

        return {
            "rms": round(normalized_rms, 4),
            "peak": round(peak, 4),
            "speechDetected": speech_detected,
            "chunkCount": len(recent),
        }

    def export_wav_bytes(self) -> bytes:
        """
        Export all recorded frames resampled/downmixed to target sample rate (16kHz mono).
        Returns raw WAV bytes suitable for file saving or Deepgram upload.
        """
        with self._lock:
            if not self._recorded_frames:
                return b""
            raw_bytes = b"".join(self._recorded_frames)

        # Parse raw native audio (int16)
        samples = np.frombuffer(raw_bytes, dtype=np.int16)
        if self._native_channels > 1:
            # Reshape and average channels to mono
            samples = samples.reshape(-1, self._native_channels).mean(axis=1).astype(np.int16)

        # Resample if native rate differs from target rate (e.g. 48kHz -> 16kHz)
        if self._native_sample_rate != self.target_sample_rate and len(samples) > 0:
            num_target_samples = int(len(samples) * self.target_sample_rate / self._native_sample_rate)
            indices = np.linspace(0, len(samples) - 1, num_target_samples)
            samples = np.interp(indices, np.arange(len(samples)), samples).astype(np.int16)

        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(self.target_channels)
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(self.target_sample_rate)
            wav_file.writeframes(samples.tobytes())

        return buffer.getvalue()

    def save_recording(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Save captured audio to a WAV file on disk and return metadata."""
        wav_bytes = self.export_wav_bytes()
        if not wav_bytes:
            logger.warning("[AudioCapture] No audio frames to save.")
            return None

        out_path = Path(file_path).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "wb") as f:
            f.write(wav_bytes)

        duration = (len(wav_bytes) - 44) / (self.target_sample_rate * self.target_channels * 2)
        rms_level = self.get_audio_level()

        result = {
            "filePath": str(out_path),
            "sampleRate": self.target_sample_rate,
            "channels": self.target_channels,
            "durationSeconds": round(max(0.0, duration), 2),
            "fileSizeBytes": len(wav_bytes),
            "audioLevel": round(rms_level, 4),
        }
        logger.info(f"[AudioCapture] Saved recording: {result}")
        return result


# Global singleton capture instance
audio_capture = AudioCaptureService()
