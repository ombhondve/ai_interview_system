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
import asyncio
import collections
import threading
from typing import Optional, Dict, Any, List
from pathlib import Path
from enum import Enum

import numpy as np

from app.config import settings

logger = logging.getLogger("MeetingBot.AudioCapture")


class CaptureState(str, Enum):
    STOPPED = "STOPPED"
    STARTING = "STARTING"
    RUNNING = "RUNNING"
    STOPPING = "STOPPING"


class AudioCaptureService:
    """
    Manages capturing live output audio from Google Meet via WASAPI loopback.
    Supports starting, stopping, measuring audio RMS level, and saving recordings to WAV.
    Lifecycle states: STOPPED, STARTING, RUNNING, STOPPING.
    Repeated calls to start_capture() while already RUNNING are idempotent.
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

        self._state: CaptureState = CaptureState.STOPPED
        self._thread: Optional[threading.Thread] = None
        self._audio_queue: queue.Queue = queue.Queue()
        self._recorded_frames: List[bytes] = []
        self._lock = threading.Lock()
        self._capture_device_info: Optional[Dict[str, Any]] = None
        self._native_sample_rate: int = 48000
        self._native_channels: int = 2

        # Master recording accumulator for entire interview session
        self._master_frames: List[bytes] = []
        self._master_recording_active: bool = False
        self._master_start_time: Optional[float] = None

    @property
    def state(self) -> CaptureState:
        with self._lock:
            return self._state

    def is_running(self) -> bool:
        """Check if audio capture is actively running."""
        with self._lock:
            return self._state == CaptureState.RUNNING

    def get_device_info(self) -> Dict[str, Any]:
        """Return details about the currently selected loopback capture device."""
        with self._lock:
            return {
                "deviceName": self._capture_device_info.get("name") if self._capture_device_info else "Default WASAPI Loopback",
                "targetSampleRate": self.target_sample_rate,
                "targetChannels": self.target_channels,
                "nativeSampleRate": self._native_sample_rate,
                "nativeChannels": self._native_channels,
                "isRunning": self._state == CaptureState.RUNNING,
                "state": self._state.value,
            }

    def start_master_recording(self) -> None:
        """Begin accumulating frames for the full interview recording."""
        with self._lock:
            self._master_frames.clear()
            self._master_recording_active = True
            self._master_start_time = time.monotonic()
        logger.info("[AudioCapture] Master interview recording started.")

    def stop_master_recording(self) -> float:
        """Stop master recording and return elapsed duration in seconds."""
        with self._lock:
            self._master_recording_active = False
            dur = (time.monotonic() - self._master_start_time) if self._master_start_time else 0.0
        logger.info(f"[AudioCapture] Master interview recording stopped. Duration: {dur:.2f}s")
        return dur

    def export_master_recording_wav(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Export the accumulated master interview frames into a WAV file on disk."""
        with self._lock:
            frames_copy = list(self._master_frames)

        if not frames_copy:
            logger.warning("[AudioCapture] No master recording frames captured to export.")
            return None

        return self.save_recording(file_path, frames=frames_copy)

    def reset_buffer(self) -> None:
        """Clear recorded frames and pending queue chunks without restarting worker thread."""
        with self._lock:
            self._recorded_frames.clear()
            while not self._audio_queue.empty():
                try:
                    self._audio_queue.get_nowait()
                except queue.Empty:
                    break
            logger.debug("[AudioCapture] Recorded frames buffer reset.")

    def start_capture(self) -> bool:
        """
        Start capturing output audio in a background thread.
        Idempotent: If already RUNNING or STARTING, clears the segment buffer and returns True
        without creating a second worker thread.
        """
        with self._lock:
            if self._state == CaptureState.RUNNING:
                # Idempotent: Reset segment buffer without spawning duplicate worker thread
                self._recorded_frames.clear()
                while not self._audio_queue.empty():
                    try:
                        self._audio_queue.get_nowait()
                    except queue.Empty:
                        break
                logger.debug("[AudioCapture] start_capture called while RUNNING; cleared segment buffer idempotently.")
                return True

            if self._state == CaptureState.STARTING:
                logger.debug("[AudioCapture] Audio capture is already in STARTING state.")
                return True

            self._state = CaptureState.STARTING
            self._recorded_frames.clear()
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

                # 1. Enumerate and log available PyAudioWPatch devices at startup
                device_count = p.get_device_count()
                all_devices = []
                for idx in range(device_count):
                    try:
                        d = p.get_device_info_by_index(idx)
                        host_info = p.get_host_api_info_by_index(d.get("hostApi", 0))
                        host_name = host_info.get("name", "Unknown")
                        all_devices.append((d, host_name))
                    except Exception:
                        pass

                logger.info("=" * 60)
                logger.info("[AudioCapture] PyAudioWPatch Device Inventory:")
                for d, host_name in all_devices:
                    is_loopback = bool(d.get("isLoopbackDevice", False) or "[loopback]" in d.get("name", "").lower())
                    logger.info(
                        f"  [{d['index']}] '{d['name']}' | Host: {host_name} | "
                        f"In: {d['maxInputChannels']} | Out: {d['maxOutputChannels']} | "
                        f"Rate: {int(d['defaultSampleRate'])}Hz | Loopback: {is_loopback}"
                    )
                logger.info("=" * 60)

                # 2. Enumerate WASAPI loopback devices
                loopback_devices = list(p.get_loopback_device_info_generator())
                target_loopback = None

                # Search key: configured device_name (e.g., "CABLE Input (VB-Audio Virtual Cable)")
                search_name = (self.device_name or "").strip()

                if search_name:
                    logger.info(f"[AudioCapture] Resolving configured capture device: '{search_name}'")
                    # Clean/normalize target name (remove [Loopback] if already present in config)
                    clean_target = search_name.replace("[Loopback]", "").replace("[loopback]", "").strip().lower()

                    for dev in loopback_devices:
                        dev_clean = dev["name"].replace("[Loopback]", "").replace("[loopback]", "").strip().lower()
                        # Match either cleaned device name or full substring
                        if clean_target in dev_clean or dev_clean in clean_target:
                            target_loopback = dev
                            break

                    if not target_loopback:
                        available_names = [f"'{dev['name']}' (idx={dev['index']})" for dev in loopback_devices]
                        logger.error(
                            f"[AudioCapture] AUDIO_CAPTURE_DEVICE_NOT_FOUND: Configured capture device '{search_name}' "
                            f"does not match any available WASAPI loopback endpoint! "
                            f"Available loopback endpoints: {', '.join(available_names) if available_names else 'None'}"
                        )
                        p.terminate()
                        return False
                else:
                    # If no device_name explicitly configured, find the default WASAPI output speaker loopback
                    default_speakers = p.get_device_info_by_index(wasapi_info["defaultOutputDevice"])
                    for dev in loopback_devices:
                        if default_speakers["name"].lower() in dev["name"].lower():
                            target_loopback = dev
                            break
                    if not target_loopback and loopback_devices:
                        target_loopback = loopback_devices[0]

                if not target_loopback:
                    logger.error("[AudioCapture] AUDIO_CAPTURE_DEVICE_NOT_FOUND: No suitable WASAPI loopback device found.")
                    p.terminate()
                    return False

                self._capture_device_info = target_loopback
                self._native_sample_rate = int(target_loopback["defaultSampleRate"])
                self._native_channels = int(target_loopback["maxInputChannels"])

                logger.info("[AUDIO][DEVICE]")
                logger.info(f"Selected: {target_loopback['name']}")
                logger.info("API: Windows WASAPI")
                logger.info(f"Rate: {self._native_sample_rate}")
                logger.info(f"Channels: {self._native_channels}")

                self._state = CaptureState.RUNNING
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
                self._state = CaptureState.STOPPED
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

            while True:
                with self._lock:
                    if self._state not in (CaptureState.RUNNING, CaptureState.STARTING):
                        break
                data = stream.read(1024, exception_on_overflow=False)
                if data:
                    with self._lock:
                        self._recorded_frames.append(data)
                        if self._master_recording_active:
                            self._master_frames.append(data)
                        self._audio_queue.put(data)

        except Exception as e:
            with self._lock:
                is_active = self._state in (CaptureState.RUNNING, CaptureState.STARTING)
            if is_active:
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
            with self._lock:
                self._state = CaptureState.STOPPED
            logger.info("[AudioCapture] Audio capture stream closed.")

    def stop_capture(self) -> None:
        """Stop capturing audio and join the worker thread."""
        with self._lock:
            if self._state == CaptureState.STOPPED:
                return
            self._state = CaptureState.STOPPING

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3.0)
        self._thread = None
        with self._lock:
            self._state = CaptureState.STOPPED
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

    def export_wav_bytes(self, frames: Optional[List[bytes]] = None) -> bytes:
        """
        Export recorded frames resampled/downmixed to target sample rate (16kHz mono).
        Returns raw WAV bytes suitable for file saving or Deepgram upload.
        """
        if frames is None:
            with self._lock:
                if not self._recorded_frames:
                    return b""
                raw_bytes = b"".join(self._recorded_frames)
        else:
            if not frames:
                return b""
            raw_bytes = b"".join(frames)

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

    def save_recording(self, file_path: str, frames: Optional[List[bytes]] = None) -> Optional[Dict[str, Any]]:
        """Save captured audio to a WAV file on disk and return metadata."""
        wav_bytes = self.export_wav_bytes(frames=frames)
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

    async def capture_utterance(
        self,
        is_ai_speaking_fn=None,
        on_speech_start=None,
        on_speech_pause=None,
        on_speech_resume=None,
        speech_start_rms: Optional[float] = None,
        silence_rms: Optional[float] = None,
        silence_duration_sec: Optional[float] = None,
        pause_confirmation_sec: float = 1.8,
        min_speech_duration_sec: Optional[float] = None,
        max_utterance_sec: Optional[float] = None,
        pre_roll_sec: Optional[float] = None,
        check_interval: float = 0.05,
    ) -> Optional[Dict[str, Any]]:
        """
        Monitor continuous loopback stream and extract a single complete candidate utterance.
        Two-stage end-of-speech strategy:
            - short silence (0.5s - 1.5s) -> CANDIDATE_PAUSED (keeps buffer open, triggers on_speech_pause)
            - if speech resumes -> CANDIDATE_SPEAKING (keeps buffer open, triggers on_speech_resume)
            - only sustained silence >= confirm_limit (1.8s+) -> finalize answer
        """
        import asyncio

        start_thresh = speech_start_rms or settings.audio_speech_start_rms
        end_thresh = silence_rms or settings.audio_silence_rms
        silence_limit = silence_duration_sec if silence_duration_sec is not None else settings.audio_silence_duration_sec
        # If caller explicitly provided silence_duration_sec or pause_confirmation_sec, respect it;
        # otherwise ensure at least 1.8s for live interview pause protection
        if silence_duration_sec is not None:
            confirm_limit = silence_limit
        elif pause_confirmation_sec != 1.8:
            confirm_limit = max(silence_limit, pause_confirmation_sec)
        else:
            confirm_limit = max(silence_limit, pause_confirmation_sec, 1.8)
        min_speech_limit = min_speech_duration_sec or settings.audio_min_speech_duration_sec
        max_utterance_limit = max_utterance_sec or settings.audio_max_utterance_sec
        pre_roll_time = pre_roll_sec or settings.audio_pre_roll_sec

        chunk_sec = 1024.0 / max(1, self._native_sample_rate)
        pre_roll_chunks = max(3, int(pre_roll_time / chunk_sec))

        pre_roll_buffer: collections.deque = collections.deque(maxlen=pre_roll_chunks)
        utterance_frames: List[bytes] = []

        in_speech = False
        is_paused = False
        speech_start_time: Optional[float] = None
        last_speech_time: Optional[float] = None
        audio_clock: Optional[float] = None

        logger.debug(
            f"[VAD] Started utterance listening (start_thresh={start_thresh}, end_thresh={end_thresh}, "
            f"silence_limit={silence_limit}s, confirm_limit={confirm_limit}s)"
        )

        while self.is_running():
            # If AI starts speaking, drain and discard buffers to prevent echo
            if is_ai_speaking_fn and is_ai_speaking_fn():
                pre_roll_buffer.clear()
                utterance_frames.clear()
                in_speech = False
                speech_start_time = None
                last_speech_time = None
                await asyncio.sleep(0.1)
                continue

            # Read all available chunks from queue
            chunks_read = []
            while not self._audio_queue.empty():
                try:
                    chunk = self._audio_queue.get_nowait()
                    chunks_read.append(chunk)
                except queue.Empty:
                    break

            if not chunks_read:
                await asyncio.sleep(check_interval)
                continue

            for chunk in chunks_read:
                samples = np.frombuffer(chunk, dtype=np.int16)
                if len(samples) == 0:
                    continue

                actual_chunk_sec = len(samples) / max(1, self._native_sample_rate * max(1, self._native_channels))
                rms = float(np.sqrt(np.mean(samples.astype(np.float64) ** 2)) / 32768.0)
                peak = float(np.max(np.abs(samples))) / 32768.0

                if audio_clock is None:
                    audio_clock = time.monotonic()
                else:
                    audio_clock += actual_chunk_sec

                now = audio_clock

                if not in_speech:
                    pre_roll_buffer.append(chunk)
                    # Speech start trigger
                    if rms >= start_thresh or peak >= (start_thresh * 2.5):
                        in_speech = True
                        is_paused = False
                        speech_start_time = now
                        last_speech_time = now
                        logger.info(f"[PERF] speech_started (RMS: {rms:.4f}, Peak: {peak:.4f})")
                        if on_speech_start:
                            try:
                                on_speech_start()
                            except Exception:
                                pass
                        # Include pre-roll buffer so the first consonant/syllable is preserved
                        utterance_frames.extend(list(pre_roll_buffer))
                        pre_roll_buffer.clear()
                        utterance_frames.append(chunk)
                else:
                    utterance_frames.append(chunk)
                    if rms >= end_thresh:
                        if is_paused:
                            is_paused = False
                            logger.info("[PERF] speech_resumed (candidate resumed speaking after pause)")
                            if on_speech_resume:
                                try:
                                    on_speech_resume()
                                except Exception:
                                    pass
                        last_speech_time = now
                    else:
                        # Candidate is silent right now
                        gap = now - (last_speech_time or now)
                        if gap >= 0.5 and not is_paused:
                            is_paused = True
                            logger.info("[PERF] speech_paused (candidate paused answering)")
                            if on_speech_pause:
                                try:
                                    on_speech_pause()
                                except Exception:
                                    pass

                if in_speech:
                    curr_speech_duration = now - (speech_start_time or now)
                    silence_gap = now - (last_speech_time or now)

                    # Condition A: Max utterance duration reached
                    if curr_speech_duration >= max_utterance_limit:
                        logger.info(
                            f"[PERF] speech_ended (max utterance reached: {curr_speech_duration:.2f}s)"
                        )
                        break

                    # Condition B: Continuous silence confirmed after confirmation window
                    if silence_gap >= confirm_limit:
                        actual_speech_duration = (last_speech_time or now) - (speech_start_time or now)
                        if actual_speech_duration >= min_speech_limit:
                            logger.info(
                                f"[PERF] speech_ended after {actual_speech_duration:.2f}s (confirmed silence: {silence_gap:.2f}s)"
                            )
                            break
                        else:
                            # Too brief (e.g. click/cough), discard and resume listening
                            logger.debug(f"[VAD] Discarded brief noise spike ({actual_speech_duration:.2f}s)")
                            in_speech = False
                            is_paused = False
                            utterance_frames.clear()
                            speech_start_time = None
                            last_speech_time = None

            if in_speech and silence_gap >= confirm_limit:
                break
            if in_speech and curr_speech_duration >= max_utterance_limit:
                break

            await asyncio.sleep(check_interval)

        if not utterance_frames:
            return None

        # Build WAV payload
        wav_bytes = self.export_wav_bytes(frames=utterance_frames)
        duration = len(utterance_frames) * chunk_sec
        actual_speech_dur = (last_speech_time or now) - (speech_start_time or now) if speech_start_time else duration

        return {
            "wav_bytes": wav_bytes,
            "duration": round(duration, 2),
            "speech_duration": round(actual_speech_dur, 2),
            "frames_count": len(utterance_frames),
        }


# Global singleton capture instance
audio_capture = AudioCaptureService()
