"""
Entrypoint for RecruitAI Meeting Bot.
Provides:
1. CLI mode:
   - python -m app.main --auth-setup
   - python -m app.main --meet-url "https://meet.google.com/xxx-yyyy-zzz"
2. HTTP API mode (FastAPI):
   - python -m app.main --server
   - Or run with uvicorn app.main:api_app
"""

import sys
import time
import signal
import asyncio
import logging
import argparse
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Header, status
from pydantic import BaseModel
import uvicorn

from app.config import settings
from app.bot import bot_instance, BotStatus
from app.meet import validate_meet_url

from enum import Enum

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("MeetingBot.Main")


# ==============================================================================
# CONVERSATION STATE MACHINE
# ==============================================================================

class ConversationState(str, Enum):
    # Explicit conversation lifecycle states
    ASKING_QUESTION = "ASKING_QUESTION"
    WAITING_FOR_ANSWER = "WAITING_FOR_ANSWER"
    ANSWER_DETECTED = "ANSWER_DETECTED"
    PROCESSING_ANSWER = "PROCESSING_ANSWER"
    GENERATING_NEXT_QUESTION = "GENERATING_NEXT_QUESTION"
    PLAYING_RESPONSE = "PLAYING_RESPONSE"
    HANDLING_SILENCE = "HANDLING_SILENCE"
    RECOVERING = "RECOVERING"
    INVITING_STUDENT_QUESTIONS = "INVITING_STUDENT_QUESTIONS"
    LISTENING_TO_STUDENT = "LISTENING_TO_STUDENT"
    ANSWERING_STUDENT_QUESTION = "ANSWERING_STUDENT_QUESTION"
    CHECKING_FOR_MORE_QUESTIONS = "CHECKING_FOR_MORE_QUESTIONS"
    CLOSING_INTERVIEW = "CLOSING_INTERVIEW"
    LEAVING_MEETING = "LEAVING_MEETING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

    # Backward-compatible phase and action states
    PRECHECK = "PRECHECK"
    CAMERA_CHECK = "CAMERA_CHECK"
    OPENING = "OPENING"
    PROJECT_CONFIRMATION = "PROJECT_CONFIRMATION"
    PROJECT_UNDERSTANDING = "PROJECT_UNDERSTANDING"
    QUESTIONING = "QUESTIONING"
    STRENGTH_DEPTH = "STRENGTH_DEPTH"
    WEAKNESS_GAP = "WEAKNESS_GAP"
    WAITING_FOR_CANDIDATE = "WAITING_FOR_CANDIDATE"
    CANDIDATE_SPEAKING = "CANDIDATE_SPEAKING"
    CANDIDATE_PAUSED = "CANDIDATE_PAUSED"
    ACKNOWLEDGING = "ACKNOWLEDGING"
    ASKING_FOLLOWUP = "ASKING_FOLLOWUP"
    ASKING_NEXT_QUESTION = "ASKING_NEXT_QUESTION"
    CLARIFICATION = "CLARIFICATION"
    THINKING = "THINKING"
    NO_RESPONSE = "NO_RESPONSE"
    SKIPPING_QUESTION = "SKIPPING_QUESTION"
    COMPLETING = "COMPLETING"
    ASKING_FINAL_QUESTION = "ASKING_FINAL_QUESTION"
    WAITING_FOR_FINAL_RESPONSE = "WAITING_FOR_FINAL_RESPONSE"
    ENDED = "ENDED"


class ConversationManager:
    """
    Manages conversational lifecycle states, silence timers, participant media states,
    and AI interviewer flow. Coordinates turn-taking, inactivity recovery, and time-aware closing.
    """

    def __init__(
        self,
        bot,
        audio_capture,
        recruitai_client,
        deepgram_client,
        duration_minutes: float = 30.0,
    ):
        self.bot = bot
        self.audio_capture = audio_capture
        self.recruitai_client = recruitai_client
        self.deepgram_client = deepgram_client
        self.state: ConversationState = ConversationState.OPENING
        self.current_phase: str = "OPENING"
        self.candidate_is_speaking: bool = False
        self.candidate_paused: bool = False
        self.answer_finalized: bool = False
        self.current_question: Optional[str] = None
        self.last_speech_time: float = time.monotonic()
        self.interview_start_time: float = time.monotonic()
        self.duration_minutes: float = float(duration_minutes)
        self.no_response_step: int = 0  # 0: waiting, 1: reminded ("Take your time"), 2: offered repeat/audio check
        self.empty_transcript_count: int = 0
        self.student_question_count: int = 0
        self.lock = asyncio.Lock()
        self.disconnect_start_time: Optional[float] = None

    def get_elapsed_time_sec(self) -> float:
        """Elapsed time since interview loop started in seconds."""
        return time.monotonic() - self.interview_start_time

    def get_remaining_time_sec(self) -> float:
        """Estimated remaining interview time in seconds."""
        total_sec = max(60.0, self.duration_minutes * 60.0)
        return max(0.0, total_sec - self.get_elapsed_time_sec())

    def is_in_closing_window(self) -> bool:
        """
        Determines whether the interview is nearing the end of its scheduled duration.
        For a 30-min interview: closing window starts when remaining time is <= 3.5 minutes (210s).
        Scales dynamically with interview duration (approx 12% of total duration).
        """
        total_sec = max(60.0, self.duration_minutes * 60.0)
        threshold_sec = min(300.0, max(90.0, total_sec * 0.12))
        return self.get_remaining_time_sec() <= threshold_sec

    def is_hard_deadline_reached(self) -> bool:
        """Checks if the scheduled hard deadline has arrived."""
        return self.get_remaining_time_sec() <= 0.0

    def set_state(self, new_state: ConversationState, decision: str = "") -> None:
        prev = self.state.value if hasattr(self.state, "value") else str(self.state)
        self.state = new_state
        rem = round(self.get_remaining_time_sec(), 1)
        logger.info(
            f"[CONVERSATION] state={self.state.value} prev={prev} remaining={rem}s "
            f"candidate_speaking={self.candidate_is_speaking} candidate_paused={self.candidate_paused} "
            f"answer_finalized={self.answer_finalized} decision={decision}"
        )

    def on_speech_start(self) -> None:
        self.candidate_is_speaking = True
        self.candidate_paused = False
        self.answer_finalized = False
        self.bot.set_candidate_speaking(True)
        self.last_speech_time = time.monotonic()
        self.set_state(ConversationState.CANDIDATE_SPEAKING, decision="candidate_speech_started")

    def on_speech_pause(self) -> None:
        self.candidate_paused = True
        self.set_state(ConversationState.CANDIDATE_PAUSED, decision="candidate_paused_answering")

    def on_speech_resume(self) -> None:
        self.candidate_paused = False
        self.candidate_is_speaking = True
        self.bot.set_candidate_speaking(True)
        self.last_speech_time = time.monotonic()
        self.set_state(ConversationState.CANDIDATE_SPEAKING, decision="candidate_resumed_speaking")


# ==============================================================================
# FASTAPI LOCAL SERVER
# ==============================================================================

api_app = FastAPI(
    title="RecruitAI Meeting Bot Control API",
    description="Local service controlling Chromium browser bot for Google Meet (Phase 1)",
    version="1.0.0",
)


class StartMeetingRequest(BaseModel):
    meetUrl: str


def verify_secret(
    x_api_secret: Optional[str] = Header(None, alias="X-API-Secret"),
    authorization: Optional[str] = Header(None),
) -> None:
    """Validate API secret provided via X-API-Secret or Authorization header."""
    token = None
    if x_api_secret:
        token = x_api_secret.strip()
    elif authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip()

    expected = settings.meeting_bot_api_secret.strip()
    if not token or token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid or missing API secret.",
        )


@api_app.post("/bot/start", dependencies=[Depends(verify_secret)])
async def api_start_bot(request: StartMeetingRequest):
    """Start the Meeting Bot and join the provided Google Meet URL."""
    if not validate_meet_url(request.meetUrl):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Google Meet URL. Must match https://meet.google.com/xxx-yyyy-zzz",
        )

    # Launch asynchronously
    asyncio.create_task(bot_instance.start(request.meetUrl))
    return {"success": True, "status": BotStatus.STARTING, "meetUrl": request.meetUrl}


@api_app.get("/bot/status", dependencies=[Depends(verify_secret)])
async def api_get_status():
    """Retrieve current bot status and metadata."""
    return bot_instance.get_status_info()


@api_app.post("/bot/stop", dependencies=[Depends(verify_secret)])
async def api_stop_bot():
    """Stop the Meeting Bot and close the browser session."""
    await bot_instance.stop()
    return {"success": True, "status": BotStatus.STOPPED}


# ==============================================================================
# CLI HANDLER
# ==============================================================================


async def run_cli():
    parser = argparse.ArgumentParser(description="RecruitAI Meeting Bot (Phase 1 & 2)")
    parser.add_argument("--auth-setup", action="store_true", help="Launch browser for interactive Google account sign-in")
    parser.add_argument("--meet-url", type=str, help="Google Meet URL to join")
    parser.add_argument("--server", action="store_true", help="Run local HTTP API server")
    # Phase 2 CLI commands
    parser.add_argument("--audio-test", action="store_true", help="Record ~10 seconds of output audio via loopback to diagnostics/audio_test/ and report levels")
    parser.add_argument("--transcribe-file", type=str, help="Transcribe a local WAV/MP3/WebM file with Deepgram Nova-2")
    parser.add_argument("--meet-audio-test", action="store_true", help="Join meeting, capture audio in chunks, and transcribe with Deepgram")
    # Phase 3 CLI commands
    parser.add_argument("--interview-id", type=str, help="AiInterviewSession ID to associate with the meeting bot")
    parser.add_argument("--candidate-id", type=str, help="Candidate ID to verify with the interview session")
    parser.add_argument("--duration-minutes", type=float, default=30.0, help="Scheduled interview duration in minutes (default: 30.0)")
    parser.add_argument("--submit-test-transcript", action="store_true", help="Submit test transcript to RecruitAI backend internal API")
    parser.add_argument("--text", type=str, default="Hello, I am ready for the interview.", help="Text content for --submit-test-transcript")
    # Phase 4 CLI commands
    parser.add_argument("--voice-test", action="store_true", help="Test AI voice routing into Google Meet with test sentence")
    parser.add_argument("--speak", type=str, help="Test speaking text locally or in meeting using Kokoro TTS")
    args = parser.parse_args()


    if args.audio_test:
        from app.audio_capture import audio_capture
        from pathlib import Path
        from datetime import datetime
        import numpy as np

        logger.info("[MeetingBot] Starting 4-second diagnostic audio capture test...")
        started = audio_capture.start_capture()
        if not started:
            logger.error("[MeetingBot] Audio capture failed to start.")
            sys.exit(1)

        info = audio_capture.get_device_info()
        logger.info("[AUDIO][DEVICE]")
        logger.info(f"Selected: {info['deviceName']}")
        logger.info("API: Windows WASAPI")
        logger.info(f"Rate: {info['nativeSampleRate']}")
        logger.info(f"Channels: {info['nativeChannels']}")
        logger.info("[MeetingBot] Recording for 4 seconds...")

        for s in range(4):
            await asyncio.sleep(1)
            level = audio_capture.get_audio_level()
            logger.info(f"[MeetingBot] T+{s+1}s | Audio level (RMS): {round(level, 4)}")

        diag = audio_capture.get_audio_diagnostics()
        wav_bytes = audio_capture.export_wav_bytes()
        samples = np.frombuffer(wav_bytes[44:], dtype=np.int16) if len(wav_bytes) > 44 else np.array([], dtype=np.int16)
        non_zero = int(np.count_nonzero(samples))

        logger.info("[AUDIO][LEVEL]")
        logger.info(f"RMS={diag.get('rms', 0.0):.6f}")
        logger.info(f"Peak={diag.get('peak', 0.0):.6f}")
        logger.info(f"NonZeroSamples={non_zero}")

        audio_capture.stop_capture()

        diag_dir = Path(__file__).resolve().parent.parent / "diagnostics" / "audio_test"
        diag_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        test_file = str(diag_dir / f"test_recording_{ts}.wav")
        res = audio_capture.save_recording(test_file)
        if res:
            logger.info(f"[MeetingBot] Audio test recording successfully saved: {res}")
        else:
            logger.warning("[MeetingBot] No audio frames were captured.")
        return

    if args.transcribe_file:
        from app.deepgram import deepgram_client
        logger.info(f"[MeetingBot] Transcribing file with Deepgram: {args.transcribe_file}")
        try:
            res = deepgram_client.transcribe_file(args.transcribe_file)
            print("\n" + "=" * 50)
            print(f"DEEPGRAM TRANSCRIPT ({res['model']}):")
            print(f"'{res['transcript']}'")
            print(f"Confidence: {round(res['confidence'], 3)} | Duration: {round(res['durationSeconds'], 2)}s")
            print("=" * 50 + "\n")
        except Exception as e:
            logger.error(f"[MeetingBot] Transcription failed: {e}")
            sys.exit(1)
        return

    if args.submit_test_transcript:
        from app.recruitai_client import recruitai_client
        if not args.interview_id:
            logger.error("[MeetingBot] --interview-id is required for --submit-test-transcript")
            sys.exit(1)

        logger.info(
            f"[MeetingBot] Submitting test transcript to RecruitAI backend for interview {args.interview_id}..."
        )
        try:
            res = recruitai_client.submit_transcript(
                interview_id=args.interview_id,
                transcript=args.text,
                candidate_id=args.candidate_id,
            )
            print("\n" + "=" * 60)
            print("RECRUITAI BACKEND RESPONSE:")
            print(f"Accepted: {res.get('accepted')}")
            print(f"Duplicate: {res.get('duplicate')}")
            print(f"Interview Status: {res.get('interviewStatus')}")
            print(f"Phase: {res.get('phase')}")
            print(f"Question Index: {res.get('currentQuestionIndex')}")
            if res.get("nextQuestion"):
                print(f"NEXT QUESTION:\n{res.get('nextQuestion')}")
            print("=" * 60 + "\n")
        except Exception as e:
            logger.error(f"[MeetingBot] Failed to submit transcript: {e}")
            sys.exit(1)
        return

    if args.speak and not args.meet_url:
        from app.kokoro_tts import kokoro_tts
        logger.info(f"[MeetingBot] Standalone Kokoro speak requested: '{args.speak}'")
        try:
            success = kokoro_tts.speak(args.speak)
            if success:
                logger.info("[MeetingBot] Speech playback completed.")
            else:
                logger.error("[MeetingBot] Speech playback failed.")
        except Exception as e:
            logger.exception(f"[MeetingBot] Speak error: {e}")
            sys.exit(1)
        return

    if args.auth_setup:
        logger.info("[MeetingBot] Launching interactive authentication setup...")
        await bot_instance.open_auth_session()
        return

    if args.server:
        logger.info(f"[MeetingBot] Starting API server on {settings.meeting_bot_host}:{settings.meeting_bot_port}")
        config = uvicorn.Config(
            api_app,
            host=settings.meeting_bot_host,
            port=settings.meeting_bot_port,
            log_level="info",
        )
        server = uvicorn.Server(config)
        await server.serve()
        return

    if args.meet_url:
        from app.audio_capture import audio_capture
        from app.deepgram import deepgram_client
        from app.recruitai_client import recruitai_client
        from app.kokoro_tts import kokoro_tts
        from pathlib import Path
        from datetime import datetime

        # Log backend host safely (Phase 4.5 requirement)
        from urllib.parse import urlparse
        backend_host = urlparse(recruitai_client.base_url).netloc or recruitai_client.base_url
        logger.info(f"[BACKEND] API URL: {backend_host}")

        # Safe diagnostic for Deepgram configuration without exposing key
        deepgram_ready = deepgram_client.is_configured()
        logger.info(f"[STT] DEEPGRAM_API_KEY configured: {deepgram_ready}")

        if args.interview_id and not deepgram_ready:
            logger.error(
                "[STT] DEEPGRAM_API_KEY is not configured in environment or meeting-bot/.env. "
                "Candidate voice transcription cannot operate. Please configure DEEPGRAM_API_KEY before starting."
            )
            sys.exit(1)

        # Voice test or Real interview mode pre-checks
        if args.voice_test or args.interview_id or args.speak:
            try:
                # Eagerly initialize Kokoro model, pipeline, voice, and audio device before joining Meet
                logger.info("[VOICE] Pre-initializing Kokoro TTS pipeline and verifying VB-CABLE output...")
                kokoro_tts.initialize()
            except Exception as e:
                logger.error(f"[MeetingBot] Kokoro TTS initialization failed: {e}")
                sys.exit(1)

        # Pre-verify backend connection if interview-id is provided before opening Meet
        if args.interview_id:
            try:
                logger.info(f"[BACKEND] Pre-verifying backend session access for {args.interview_id}...")
                cand_param = args.candidate_id if args.candidate_id not in ("null", "None", "") else None
                session_check = recruitai_client.get_interview_session(
                    args.interview_id, candidate_id=cand_param
                )
                logger.info(f"[BACKEND] Verified session status: {session_check.get('status')} (phase: {session_check.get('phase')})")
                if session_check.get("candidateId"):
                    resolved_cand = str(session_check["candidateId"]).strip()
                    if resolved_cand and resolved_cand not in ("null", "None") and resolved_cand != args.candidate_id:
                        logger.info(f"[BACKEND] Synchronized authoritative candidateId: {resolved_cand}")
                        args.candidate_id = resolved_cand
                if session_check.get("durationMinutes"):
                    try:
                        args.duration_minutes = float(session_check["durationMinutes"])
                        logger.info(f"[BACKEND] Synchronized scheduled duration: {args.duration_minutes} minutes")
                    except Exception:
                        pass
            except Exception as pre_backend_err:
                logger.error(f"[BACKEND] Backend session pre-flight failed ({pre_backend_err}). Aborting meeting join to prevent unlinked interview.")
                sys.exit(1)

        success = await bot_instance.start(args.meet_url)
        if not success:
            logger.error("[MeetingBot] Bot failed to join the meeting.")
            await bot_instance.stop()
            sys.exit(1)

        # ----------------------------------------------------------------------
        # MODE 1: Voice Test Mode (--voice-test)
        # ----------------------------------------------------------------------
        if args.voice_test:
            test_phrase = (
                args.speak
                or "Hello. This is the RecruitAI AI interviewer. Can you hear me clearly?"
            )
            logger.info("[VOICE] === Starting Google Meet Voice Output Test ===")
            logger.info(f"[VOICE] Test sentence: '{test_phrase}'")
            logger.info("[VOICE] Verifying CABLE Output configuration and in-call admission...")

            # Wait 2 seconds for in-call stream stabilization
            await asyncio.sleep(2.0)

            # Speak test sentence with complete mic unmute/mute sequencing
            speak_success = await bot_instance.speak_text(test_phrase)
            if speak_success:
                logger.info("[VOICE] Test sentence successfully played through VB-CABLE into Google Meet!")
                logger.info("[VOICE] Note: Other participants in Google Meet should have heard the AI voice.")
            else:
                logger.error("[VOICE] Failed to speak test sentence into Google Meet.")

            logger.info("[MeetingBot] Voice test complete. Keeping meeting open for manual audio verification (Ctrl+C to exit)...")

            stop_event = asyncio.Event()

            def handle_sig():
                stop_event.set()

            loop = asyncio.get_running_loop()
            for sig in (signal.SIGINT, signal.SIGTERM):
                try:
                    loop.add_signal_handler(sig, handle_sig)
                except NotImplementedError:
                    pass

            try:
                while not stop_event.is_set():
                    await asyncio.sleep(1)
            except (KeyboardInterrupt, asyncio.CancelledError):
                pass
            finally:
                await bot_instance.stop()
            return

        # ----------------------------------------------------------------------
        # MODE 2: Real Interview Mode (--interview-id) OR In-Meeting Audio Test
        # ----------------------------------------------------------------------
        if args.interview_id or args.meet_audio_test:
            # Check admission state first if bot was waiting
            if bot_instance.status == BotStatus.WAITING_FOR_ADMISSION:
                logger.info("[MEET] Bot is waiting for host admission before starting interview loop...")
                admitted = await bot_instance.wait_for_admission(timeout_sec=300.0)
                if not admitted:
                    logger.error("[MeetingBot] Bot was not admitted to Google Meet.")
                    await bot_instance.stop()
                    sys.exit(1)

            # Ensure bot is genuinely inside meeting before starting audio capture
            if bot_instance.status != BotStatus.JOINED:
                logger.error(f"[MeetingBot] Cannot start interview loop: bot status is {bot_instance.status}, expected JOINED.")
                await bot_instance.stop()
                sys.exit(1)

            logger.info("[MeetingBot] Confirmed inside Google Meet. Starting in-meeting audio capture...")
            audio_capture.start_capture()
            diag_dir = Path(__file__).resolve().parent.parent / "diagnostics" / "audio_test"
            diag_dir.mkdir(parents=True, exist_ok=True)

            # If interview_id provided, wait for candidate presence in Google Meet before starting the interview
            first_question = None
            if args.interview_id:
                logger.info("[MEET] Waiting for candidate")
                # Poll Google Meet participant presence
                candidate_detected = False
                for wait_attempt in range(60):  # Wait up to 10 minutes (checking every 10s)
                    if bot_instance._navigator:
                        present = await bot_instance._navigator.is_candidate_present()
                        if present:
                            candidate_detected = True
                            logger.info("[MEET] Candidate detected")
                            break
                    await asyncio.sleep(10)

                if not candidate_detected:
                    logger.warning("[INTERVIEW] Candidate did not join within grace period.")
                    await bot_instance.stop()
                    sys.exit(0)

                try:
                    logger.info("[INTERVIEW] Signaling candidate presence to backend...")
                    cand_param = args.candidate_id if args.candidate_id not in ("null", "None", "") else None
                    join_res = recruitai_client.notify_candidate_joined(
                        args.interview_id, candidate_id=cand_param
                    )
                    first_question = join_res.get("firstQuestion")
                    if join_res.get("durationMinutes"):
                        try:
                            args.duration_minutes = float(join_res["durationMinutes"])
                            logger.info(f"[BACKEND] Synchronized scheduled duration: {args.duration_minutes} minutes")
                        except Exception:
                            pass
                    logger.info(f"[INTERVIEW] Backend successfully transitioned to IN_PROGRESS (started={join_res.get('started')}).")
                except Exception as sess_err:
                    logger.error(
                        f"[MeetingBot] Candidate-presence notification failed on backend ({sess_err}). "
                        "Backend did not transition to IN_PROGRESS. Aborting to prevent unlinked interview."
                    )
                    await bot_instance.stop()
                    sys.exit(1)

                if not first_question or not first_question.strip():
                    first_question = "Hi, welcome to your interview. Before we begin, let's quickly check your audio and video. Can you hear me clearly?"
                    logger.info(f"[AI] Using default precheck question: '{first_question}'")

                logger.info(f"[AI] First question generated: '{first_question}'")
                logger.info("[AI] SPEAKING")
                await asyncio.sleep(1.5)
                spoken = await bot_instance.speak_text(first_question)
                if not spoken:
                    logger.warning("[AI] First question playback failed; attempting single retry in 2s...")
                    await asyncio.sleep(2.0)
                    spoken = await bot_instance.speak_text(first_question)
                if not spoken:
                    logger.error("[AI] Question playback could not be completed after retry. Mic remains muted.")
                logger.info("[PERF] ai_speaking_finished")
                audio_capture.reset_buffer()
                logger.info("[PERF] audio_buffer_flushed")
                await asyncio.sleep(0.4)

            # Start Master Interview Recording
            audio_capture.start_master_recording()
            if args.interview_id:
                recruitai_client.notify_recording_started(args.interview_id, candidate_id=args.candidate_id)

            # Initialize Conversation Manager
            conv_mgr = ConversationManager(
                bot=bot_instance,
                audio_capture=audio_capture,
                recruitai_client=recruitai_client,
                deepgram_client=deepgram_client,
                duration_minutes=args.duration_minutes,
            )

            # Periodic monitoring and presence tracking
            last_camera_check_time = time.monotonic()
            last_presence_check_time = time.monotonic()
            disconnect_start_time: Optional[float] = None

            if first_question:
                conv_mgr.current_question = first_question
                conv_mgr.set_state(ConversationState.ASKING_QUESTION, decision="first_question_delivered")
                conv_mgr.last_speech_time = time.monotonic()

            logger.info("[PERF] candidate_listening_started")
            dev_info = audio_capture.get_device_info()
            logger.info("[AUDIO] Candidate listening started")
            logger.info(f"[AUDIO] Capture device: {dev_info.get('deviceName', 'Unknown')}")
            logger.info("[AUDIO] Waiting for speech...")
            conv_mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="listening_for_candidate")

            try:
                while True:
                    # AI_SPEAKING guard: Do NOT process candidate audio if AI is speaking
                    if bot_instance.is_ai_speaking():
                        logger.debug("[STT] Ignored because AI_SPEAKING=true")
                        await asyncio.sleep(0.3)
                        continue

                    # Continuous utterance-based capture with silence detection and non-blocking wait
                    utterance = await audio_capture.capture_utterance(
                        is_ai_speaking_fn=bot_instance.is_ai_speaking,
                        on_speech_start=conv_mgr.on_speech_start,
                        on_speech_pause=conv_mgr.on_speech_pause,
                        on_speech_resume=conv_mgr.on_speech_resume,
                        max_initial_wait_sec=2.5,
                    )

                    media_monitor = bot_instance.get_media_monitor()

                    # Periodic Participant Presence Monitoring (every ~5 seconds)
                    if media_monitor and (time.monotonic() - last_presence_check_time >= 5.0):
                        last_presence_check_time = time.monotonic()
                        try:
                            is_present = await media_monitor.is_candidate_present()
                            if not is_present:
                                if disconnect_start_time is None:
                                    disconnect_start_time = time.monotonic()
                                    logger.warning("[MEET][PRESENCE] Candidate not detected in Google Meet. Starting 75s disconnect grace timer.")
                                else:
                                    elapsed_dc = time.monotonic() - disconnect_start_time
                                    logger.warning(f"[MEET][PRESENCE] Candidate absent for {elapsed_dc:.1f}s / 75s grace period.")
                                    if elapsed_dc >= 75.0:
                                        logger.error("[MEET][PRESENCE] Candidate disconnected beyond grace period. Concluding interview as failed.")
                                        conv_mgr.set_state(ConversationState.FAILED, decision="candidate_disconnected_timeout")
                                        if args.interview_id:
                                            try:
                                                recruitai_client.complete_interview(
                                                    interview_id=args.interview_id,
                                                    candidate_id=args.candidate_id,
                                                    reason="CANDIDATE_DISCONNECTED",
                                                    wait_for_analysis=False,
                                                )
                                            except Exception as close_err:
                                                logger.error(f"[MeetingBot] Failed to finalize on disconnection: {close_err}")
                                        dur = audio_capture.stop_master_recording()
                                        break
                            else:
                                if disconnect_start_time is not None:
                                    logger.info("[MEET][PRESENCE] Candidate presence restored. Grace timer cleared.")
                                    disconnect_start_time = None
                        except Exception as pres_err:
                            logger.debug(f"[MEET][PRESENCE] Presence check error: {pres_err}")

                    # Check candidate microphone state
                    candidate_mic_muted = None
                    if media_monitor:
                        try:
                            candidate_mic_muted = await media_monitor.is_candidate_mic_muted()
                        except Exception as mic_err:
                            logger.debug(f"[MEET][MIC] Mic check error: {mic_err}")

                    # Periodic Camera Check (every ~25 seconds)
                    if media_monitor and (time.monotonic() - last_camera_check_time >= 25.0):
                        last_camera_check_time = time.monotonic()
                        try:
                            cam_status = await media_monitor.is_candidate_camera_on()
                            if cam_status is False and media_monitor.can_remind_camera():
                                media_monitor.record_camera_reminder()
                                logger.info("[MEET][CAMERA] Candidate camera is OFF. Delivering gentle reminder.")
                                conv_mgr.set_state(ConversationState.HANDLING_SILENCE, decision="camera_off_reminder")
                                await bot_instance.speak_text("Please make sure your camera is turned on for the interview.")
                                conv_mgr.last_speech_time = time.monotonic()
                                conv_mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="waiting_after_camera_reminder")
                        except Exception as cam_err:
                            logger.debug(f"[MEET][CAMERA] Camera check error: {cam_err}")

                    # Check Scheduled Hard Deadline
                    if conv_mgr.is_hard_deadline_reached() and not bot_instance.is_ai_speaking():
                        logger.info("[TIMER] Scheduled hard deadline reached. Concluding interview safely.")
                        conv_mgr.set_state(ConversationState.CLOSING_INTERVIEW, decision="hard_deadline_reached")
                        try:
                            await bot_instance.speak_text("We have reached the end of our scheduled time. Thank you so much for your time today. Goodbye!")
                        except Exception:
                            pass
                        conv_mgr.set_state(ConversationState.COMPLETED, decision="hard_deadline_completed")
                        dur = audio_capture.stop_master_recording()
                        if args.interview_id:
                            try:
                                master_wav_path = str(diag_dir / f"master_interview_{args.interview_id}.wav")
                                saved = audio_capture.export_master_recording_wav(master_wav_path)
                                if saved:
                                    recruitai_client.upload_recording(
                                        interview_id=args.interview_id,
                                        recording_file_path=master_wav_path,
                                        duration_seconds=dur,
                                        candidate_id=args.candidate_id,
                                    )
                            except Exception as up_err:
                                logger.error(f"[MeetingBot] Failed to upload recording: {up_err}")
                            try:
                                recruitai_client.complete_interview(
                                    interview_id=args.interview_id,
                                    candidate_id=args.candidate_id,
                                    reason="SCHEDULED_DURATION_REACHED",
                                    wait_for_analysis=False,
                                )
                            except Exception as comp_err:
                                logger.error(f"[MeetingBot] Failed to finalize on deadline: {comp_err}")
                        await asyncio.sleep(1.5)
                        break

                    # Check Transition into Closing Window
                    if conv_mgr.is_in_closing_window() and conv_mgr.current_phase != "CLOSING" and not bot_instance.is_ai_speaking():
                        logger.info("[TIMER] Approaching end of scheduled duration. Transitioning to CLOSING phase and inviting student questions.")
                        conv_mgr.current_phase = "CLOSING"
                        conv_mgr.no_response_step = 0
                        conv_mgr.set_state(ConversationState.INVITING_STUDENT_QUESTIONS, decision="closing_window_reached")
                        closing_invitation = (
                            "Thank you for sharing your experience and answers today. "
                            "We are approaching the end of our scheduled interview time. "
                            "Before we conclude, do you have any questions for me?"
                        )
                        conv_mgr.set_state(ConversationState.PLAYING_RESPONSE, decision="speaking_closing_invitation")
                        await bot_instance.speak_text(closing_invitation)
                        audio_capture.reset_buffer()
                        conv_mgr.last_speech_time = time.monotonic()
                        conv_mgr.set_state(ConversationState.LISTENING_TO_STUDENT, decision="waiting_for_student_questions")
                        continue

                    # Silence / No-Response Monitoring (when no utterance completed)
                    if not utterance:
                        silence_duration = time.monotonic() - conv_mgr.last_speech_time
                        if not bot_instance.is_ai_speaking() and not conv_mgr.candidate_is_speaking:
                            # If candidate mic is muted, prompt to unmute instead of advancing silence penalties
                            if candidate_mic_muted is True:
                                if silence_duration >= 18.0 and media_monitor and media_monitor.can_remind_mic():
                                    conv_mgr.set_state(ConversationState.HANDLING_SILENCE, decision="candidate_mic_muted_reminder")
                                    media_monitor.record_mic_reminder()
                                    logger.info("[MEET][MIC] Candidate is muted. Prompting to unmute.")
                                    await bot_instance.speak_text("I noticed your microphone is currently muted. Please unmute yourself whenever you are ready.")
                                    conv_mgr.last_speech_time = time.monotonic()
                                    conv_mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="waiting_after_unmute_prompt")
                                else:
                                    conv_mgr.last_speech_time = max(conv_mgr.last_speech_time, time.monotonic() - 10.0)

                            elif conv_mgr.current_phase == "CLOSING":
                                # Dedicated silence handling for CLOSING phase
                                if silence_duration >= 12.0 and conv_mgr.no_response_step == 0:
                                    conv_mgr.set_state(ConversationState.HANDLING_SILENCE, decision="closing_silence_prompt")
                                    conv_mgr.no_response_step = 1
                                    logger.info("[RECOVERY] reason=closing_silence action=prompt_questions")
                                    await bot_instance.speak_text("Take your time. Is there anything you'd like to ask?")
                                    conv_mgr.last_speech_time = time.monotonic()
                                    conv_mgr.set_state(ConversationState.LISTENING_TO_STUDENT, decision="waiting_after_closing_prompt")
                                elif silence_duration >= 12.0 and conv_mgr.no_response_step == 1:
                                    conv_mgr.set_state(ConversationState.CLOSING_INTERVIEW, decision="closing_silence_conclude")
                                    logger.info("[RECOVERY] reason=closing_silence action=conclude_interview")
                                    conv_mgr.no_response_step = 0
                                    farewell_msg = "Thank you for your time today. That concludes our interview."
                                    if args.interview_id:
                                        try:
                                            farewell_res = recruitai_client.submit_transcript(
                                                interview_id=args.interview_id,
                                                transcript="No questions.",
                                                candidate_id=args.candidate_id,
                                                closing=True,
                                            )
                                            farewell_msg = farewell_res.get("nextQuestion") or farewell_msg
                                        except Exception as close_err:
                                            logger.error(f"[MeetingBot] Failed to finalize on closing silence: {close_err}")
                                    await bot_instance.speak_text(farewell_msg)
                                    conv_mgr.set_state(ConversationState.COMPLETED, decision="closing_silence_ended")
                                    dur = audio_capture.stop_master_recording()
                                    if args.interview_id:
                                        try:
                                            master_wav_path = str(diag_dir / f"master_interview_{args.interview_id}.wav")
                                            saved = audio_capture.export_master_recording_wav(master_wav_path)
                                            if saved:
                                                recruitai_client.upload_recording(
                                                    interview_id=args.interview_id,
                                                    recording_file_path=master_wav_path,
                                                    duration_seconds=dur,
                                                    candidate_id=args.candidate_id,
                                                )
                                        except Exception as up_err:
                                            logger.error(f"[MeetingBot] Failed to upload recording: {up_err}")
                                        try:
                                            recruitai_client.complete_interview(
                                                interview_id=args.interview_id,
                                                candidate_id=args.candidate_id,
                                                reason="COMPLETED_NORMAL",
                                                wait_for_analysis=False,
                                            )
                                        except Exception as comp_err:
                                            logger.error(f"[MeetingBot] Failed to complete interview: {comp_err}")
                                    await asyncio.sleep(1.5)
                                    break
                            else:
                                # Normal Questioning Silence Recovery
                                # Step 1: Silent for >= 18s -> Reassure "Take your time."
                                if silence_duration >= 18.0 and conv_mgr.no_response_step == 0:
                                    conv_mgr.set_state(ConversationState.HANDLING_SILENCE, decision="reassure_candidate")
                                    conv_mgr.no_response_step = 1
                                    logger.info("[RECOVERY] reason=no_response action=reassure")
                                    await bot_instance.speak_text("Take your time.")
                                    conv_mgr.last_speech_time = time.monotonic()
                                    conv_mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="waiting_after_reassurance")

                                # Step 2: Still silent after another 18s -> Offer repeat
                                elif silence_duration >= 18.0 and conv_mgr.no_response_step == 1:
                                    conv_mgr.set_state(ConversationState.HANDLING_SILENCE, decision="offer_repeat")
                                    conv_mgr.no_response_step = 2
                                    logger.info("[RECOVERY] reason=no_response action=repeat_question")
                                    await bot_instance.speak_text("Would you like me to repeat the question?")
                                    conv_mgr.last_speech_time = time.monotonic()
                                    conv_mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="waiting_after_repeat_offer")

                                # Step 3: Still silent after another 20s -> Skip question gracefully
                                elif silence_duration >= 20.0 and conv_mgr.no_response_step == 2:
                                    conv_mgr.set_state(ConversationState.RECOVERING, decision="prolonged_silence_skip")
                                    logger.info("[RECOVERY] reason=no_response action=skip")
                                    conv_mgr.no_response_step = 0
                                    if args.interview_id:
                                        try:
                                            skip_res = recruitai_client.submit_transcript(
                                                interview_id=args.interview_id,
                                                transcript="I don't know.",
                                                candidate_id=args.candidate_id,
                                            )
                                            next_q = skip_res.get("nextQuestion")
                                            if next_q:
                                                conv_mgr.set_state(ConversationState.PLAYING_RESPONSE, decision="skip_to_next")
                                                await bot_instance.speak_text(f"Let's move on to the next question. {next_q}")
                                        except Exception as skip_err:
                                            logger.error(f"[MeetingBot] Failed to advance skipped question: {skip_err}")
                                    conv_mgr.last_speech_time = time.monotonic()
                                    conv_mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="listening_after_skip")

                        await asyncio.sleep(0.1)
                        continue

                    # Utterance detected and completed!
                    conv_mgr.candidate_is_speaking = False
                    conv_mgr.candidate_paused = False
                    conv_mgr.answer_finalized = True
                    bot_instance.set_candidate_speaking(False)
                    conv_mgr.no_response_step = 0
                    conv_mgr.last_speech_time = time.monotonic()
                    conv_mgr.set_state(ConversationState.ANSWER_DETECTED, decision="utterance_finalized")

                    # Double check AI_SPEAKING guard
                    if bot_instance.is_ai_speaking():
                        logger.info("[STT] Ignored captured utterance because AI_SPEAKING=true")
                        conv_mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="ignored_due_to_ai_speaking")
                        continue

                    wav_bytes = utterance.get("wav_bytes")
                    total_dur = utterance.get("duration", 0.0)
                    speech_dur = utterance.get("speech_duration", 0.0)
                    speech_ended_timestamp = time.monotonic()
                    logger.info(f"[PERF] utterance_duration={total_dur}s (actual speech: {speech_dur}s)")

                    if not wav_bytes or len(wav_bytes) < 44:
                        logger.warning("[AUDIO] Empty audio payload; continuing listening.")
                        conv_mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="empty_audio")
                        continue

                    # Save recording artifact for diagnostics
                    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
                    seg_file = str(diag_dir / f"meet_utterance_{ts}.wav")
                    try:
                        with open(seg_file, "wb") as f:
                            f.write(wav_bytes)
                    except Exception as save_err:
                        logger.warning(f"[AUDIO] Failed to save diagnostic WAV: {save_err}")

                    if not deepgram_client.is_configured():
                        logger.warning("[MeetingBot] Audio saved, but DEEPGRAM_API_KEY is not configured.")
                        conv_mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="deepgram_not_configured")
                        continue

                    # 1. Deepgram STT
                    conv_mgr.set_state(ConversationState.PROCESSING_ANSWER, decision="transcribing_utterance")
                    logger.info("[STT] Sending utterance to Deepgram")
                    deepgram_start = time.monotonic()
                    try:
                        res = deepgram_client.transcribe_file(seg_file)
                        deepgram_end = time.monotonic()
                        deepgram_duration = round(deepgram_end - deepgram_start, 2)
                        logger.info(f"[PERF] deepgram_end duration={deepgram_duration}s")
                    except Exception as stt_err:
                        logger.error(f"[MeetingBot] STT error: {stt_err}")
                        conv_mgr.set_state(ConversationState.RECOVERING, decision="stt_error_recovery")
                        try:
                            await bot_instance.speak_text("I had a momentary audio glitch. Could you please repeat that?")
                        except Exception:
                            pass
                        conv_mgr.last_speech_time = time.monotonic()
                        conv_mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="listening_after_stt_glitch")
                        continue

                    transcript = (res.get("transcript") or "").strip()
                    confidence = res.get("confidence", 0.0)
                    logger.info(f"[STT] Deepgram response: success={res.get('success')}, confidence={round(confidence, 3)}, model={res.get('model')}")

                    # Filter empty or low-confidence noise
                    if not transcript or confidence < 0.20:
                        logger.info(f"[STT] Filtered empty/low-confidence transcript (conf={round(confidence, 2)})")
                        conv_mgr.empty_transcript_count = getattr(conv_mgr, "empty_transcript_count", 0) + 1
                        if speech_dur >= 1.0 and conv_mgr.empty_transcript_count >= 2:
                            conv_mgr.empty_transcript_count = 0
                            conv_mgr.set_state(ConversationState.HANDLING_SILENCE, decision="ask_to_repeat_unheard_speech")
                            try:
                                await bot_instance.speak_text("Sorry, I couldn't catch that clearly. Could you say that again?")
                            except Exception:
                                pass
                            audio_capture.reset_buffer()
                            conv_mgr.last_speech_time = time.monotonic()
                            conv_mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="listening_after_unheard_prompt")
                        else:
                            conv_mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="low_confidence_filtered")
                        continue

                    conv_mgr.empty_transcript_count = 0

                    if bot_instance.is_ai_speaking():
                        logger.info("[STT] Ignored candidate transcript because AI_SPEAKING=true")
                        conv_mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="ai_speaking_race")
                        continue

                    print("\n" + "=" * 50)
                    print(f"CANDIDATE TRANSCRIPT: '{transcript}'")
                    print("=" * 50 + "\n")
                    logger.info(f"[STT] Transcript: {transcript}")

                    if not args.interview_id:
                        conv_mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="no_interview_id_mode")
                        continue

                    # Check camera status for PRECHECK or ongoing verification
                    candidate_cam_on = None
                    try:
                        candidate_cam_on = await bot_instance.is_candidate_camera_on()
                        logger.info(f"[MEET][CAMERA] Candidate camera status: {candidate_cam_on}")
                    except Exception as cam_err:
                        logger.debug(f"[MEET][CAMERA] Could not determine candidate camera status: {cam_err}")

                    # Synchronized turn processing to prevent concurrent submissions
                    async with conv_mgr.lock:
                        if conv_mgr.current_phase == "CLOSING":
                            # Candidate response in CLOSING phase
                            lower_trans = transcript.lower().strip()
                            is_no_question = (
                                lower_trans in ("no", "nope", "nothing", "no questions", "all good", "i'm good", "no thank you", "nah", "none", "no i don't", "no questions from my side", "no sir", "no ma'am", "nothing else")
                                or "no questions" in lower_trans
                                or "nothing from my side" in lower_trans
                                or "all good" in lower_trans
                                or "all clear" in lower_trans
                                or "nothing else" in lower_trans
                            )
                            if is_no_question:
                                conv_mgr.set_state(ConversationState.CLOSING_INTERVIEW, decision="candidate_declined_questions")
                                farewell_text = "That's perfectly fine. Thank you for your time today. That concludes our interview."
                                try:
                                    farewell_res = recruitai_client.submit_transcript(
                                        interview_id=args.interview_id,
                                        transcript="No questions.",
                                        candidate_id=args.candidate_id,
                                        camera_on=candidate_cam_on,
                                        closing=True,
                                    )
                                    farewell_text = farewell_res.get("nextQuestion") or farewell_text
                                except Exception as f_err:
                                    logger.warning(f"[MeetingBot] Failed to submit closing 'No questions': {f_err}")

                                conv_mgr.set_state(ConversationState.PLAYING_RESPONSE, decision="speaking_farewell")
                                await bot_instance.speak_text(farewell_text)
                                conv_mgr.set_state(ConversationState.COMPLETED, decision="closing_completed_normal")

                                dur = audio_capture.stop_master_recording()
                                try:
                                    master_wav_path = str(diag_dir / f"master_interview_{args.interview_id}.wav")
                                    saved = audio_capture.export_master_recording_wav(master_wav_path)
                                    if saved:
                                        recruitai_client.upload_recording(
                                            interview_id=args.interview_id,
                                            recording_file_path=master_wav_path,
                                            duration_seconds=dur,
                                            candidate_id=args.candidate_id,
                                        )
                                except Exception as up_err:
                                    logger.error(f"[MeetingBot] Failed to upload recording: {up_err}")

                                try:
                                    recruitai_client.complete_interview(
                                        interview_id=args.interview_id,
                                        candidate_id=args.candidate_id,
                                        reason="COMPLETED_NORMAL",
                                        wait_for_analysis=False,
                                    )
                                except Exception as comp_err:
                                    logger.error(f"[MeetingBot] Failed to complete interview: {comp_err}")

                                await asyncio.sleep(1.5)
                                break
                            else:
                                # Candidate asked a question!
                                conv_mgr.student_question_count += 1
                                conv_mgr.set_state(ConversationState.ANSWERING_STUDENT_QUESTION, decision="answering_student_q")
                                ans_text = "That is a great question. Our recruitment team will review the evaluation results and follow up with you on the next steps."
                                try:
                                    b_res = recruitai_client.submit_transcript(
                                        interview_id=args.interview_id,
                                        transcript=transcript,
                                        candidate_id=args.candidate_id,
                                        camera_on=candidate_cam_on,
                                        closing=True,
                                    )
                                    ans_text = b_res.get("nextQuestion") or ans_text
                                except Exception as q_err:
                                    logger.error(f"[MeetingBot] Backend error answering student question: {q_err}")

                                conv_mgr.set_state(ConversationState.PLAYING_RESPONSE, decision="speaking_answer_to_student")
                                await bot_instance.speak_text(ans_text)
                                audio_capture.reset_buffer()
                                rem_time = conv_mgr.get_remaining_time_sec()
                                if rem_time > 70.0 and conv_mgr.student_question_count < 3:
                                    conv_mgr.set_state(ConversationState.CHECKING_FOR_MORE_QUESTIONS, decision="checking_additional_q")
                                    await bot_instance.speak_text("Do you have any other questions for me?")
                                    audio_capture.reset_buffer()
                                    conv_mgr.last_speech_time = time.monotonic()
                                    conv_mgr.set_state(ConversationState.LISTENING_TO_STUDENT, decision="listening_for_next_student_q")
                                    continue
                                else:
                                    conv_mgr.set_state(ConversationState.CLOSING_INTERVIEW, decision="closing_after_student_q")
                                    await bot_instance.speak_text("Thank you for those great questions. That brings us to the end of our scheduled time. Have a wonderful day!")
                                    conv_mgr.set_state(ConversationState.COMPLETED, decision="completed_normal")
                                    dur = audio_capture.stop_master_recording()
                                    try:
                                        master_wav_path = str(diag_dir / f"master_interview_{args.interview_id}.wav")
                                        saved = audio_capture.export_master_recording_wav(master_wav_path)
                                        if saved:
                                            recruitai_client.upload_recording(
                                                interview_id=args.interview_id,
                                                recording_file_path=master_wav_path,
                                                duration_seconds=dur,
                                                candidate_id=args.candidate_id,
                                            )
                                    except Exception as up_err:
                                        logger.error(f"[MeetingBot] Failed to upload recording: {up_err}")
                                    try:
                                        recruitai_client.complete_interview(
                                            interview_id=args.interview_id,
                                            candidate_id=args.candidate_id,
                                            reason="COMPLETED_NORMAL",
                                            wait_for_analysis=False,
                                        )
                                    except Exception as comp_err:
                                        logger.error(f"[MeetingBot] Failed to complete interview: {comp_err}")
                                    await asyncio.sleep(1.5)
                                    break

                        # 2. Normal Questioning Phase: Backend Submission
                        conv_mgr.set_state(ConversationState.GENERATING_NEXT_QUESTION, decision="submitting_answer_to_backend")
                        backend_start = time.monotonic()
                        try:
                            backend_res = recruitai_client.submit_transcript(
                                interview_id=args.interview_id,
                                transcript=transcript,
                                candidate_id=args.candidate_id,
                                camera_on=candidate_cam_on,
                            )
                            backend_end = time.monotonic()
                            backend_duration = round(backend_end - backend_start, 2)
                            logger.info(f"[PERF] backend_end duration={backend_duration}s")

                            logger.info(
                                f"[BACKEND] Answer submitted: accepted={backend_res.get('accepted')}, "
                                f"status={backend_res.get('interviewStatus')}, phase={backend_res.get('phase')}, "
                                f"qIndex={backend_res.get('currentQuestionIndex')}"
                            )

                            if not backend_res.get("accepted"):
                                logger.info(f"[BACKEND] Answer not accepted: {backend_res.get('reason')}")
                                conv_mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="backend_rejected")
                                continue

                            next_q = backend_res.get("nextQuestion")
                            ack = backend_res.get("acknowledgment")
                            action = backend_res.get("action", "NEXT_TOPIC")
                            is_closing = backend_res.get("closing", False)
                            res_phase = backend_res.get("phase")
                            if res_phase:
                                conv_mgr.current_phase = res_phase

                            logger.info(
                                f"[ANSWER] transcript='{transcript}' answer_type={action} decision={action} phase={conv_mgr.current_phase} is_closing={is_closing}"
                            )

                            if is_closing or conv_mgr.current_phase == "CLOSING":
                                conv_mgr.current_phase = "CLOSING"
                                conv_mgr.set_state(ConversationState.INVITING_STUDENT_QUESTIONS, decision="closing_phase_initiated")
                                closing_prompt = next_q or "We are now approaching the end of our interview. Do you have any questions for me?"
                                conv_mgr.set_state(ConversationState.PLAYING_RESPONSE, decision="speaking_closing_invitation")
                                await bot_instance.speak_text(closing_prompt)
                                audio_capture.reset_buffer()
                                conv_mgr.last_speech_time = time.monotonic()
                                conv_mgr.set_state(ConversationState.LISTENING_TO_STUDENT, decision="waiting_for_student_questions")
                                continue

                            # Compose spoken payload
                            spoken_payload = ""
                            if ack and ack.strip():
                                if next_q and next_q.strip() and not next_q.startswith(ack):
                                    spoken_payload = f"{ack} {next_q}"
                                else:
                                    spoken_payload = next_q or ack
                            else:
                                spoken_payload = next_q

                            if spoken_payload:
                                conv_mgr.current_question = spoken_payload
                                logger.info(f"[AI] Next spoken utterance: '{spoken_payload[:60]}...'")
                                print("\n" + "*" * 50)
                                print(f"AI RESPONSE: {spoken_payload}")
                                print("*" * 50 + "\n")

                                conv_mgr.set_state(ConversationState.PLAYING_RESPONSE, decision="speaking_response")
                                tts_start = time.monotonic()
                                if bot_instance.is_candidate_speaking():
                                    logger.info("[SAFETY] AI_TTS_BLOCKED_CANDIDATE_SPEAKING - candidate started speaking before playback")
                                else:
                                    await bot_instance.speak_text(spoken_payload)

                                tts_end = time.monotonic()
                                logger.info(f"[PERF] tts_end duration={round(tts_end - tts_start, 2)}s")
                                audio_capture.reset_buffer()
                                await asyncio.sleep(0.4)
                                conv_mgr.last_speech_time = time.monotonic()
                                conv_mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="listening_for_next_answer")

                        except Exception as b_err:
                            logger.error(f"[MeetingBot] Backend submission error: {b_err}")
                            conv_mgr.set_state(ConversationState.RECOVERING, decision="backend_submission_error")
                            conv_mgr.last_speech_time = time.monotonic()
                            audio_capture.reset_buffer()
                            try:
                                await bot_instance.speak_text("I had a brief glitch processing that. Could you please say that one more time?")
                            except Exception:
                                pass
                            conv_mgr.set_state(ConversationState.WAITING_FOR_ANSWER, decision="listening_after_backend_error")

            except (KeyboardInterrupt, asyncio.CancelledError):
                pass
            finally:
                # Ensure master recording is stopped if interrupted
                audio_capture.stop_master_recording()
                audio_capture.stop_capture()
                await bot_instance.stop()
            return

        logger.info("[MeetingBot] Bot joined successfully. Keeping browser open until interrupted (Ctrl+C)...")

        # Keep running until Ctrl+C
        stop_event = asyncio.Event()

        def handle_signal():
            logger.info("[MeetingBot] Shutdown signal received. Exiting...")
            stop_event.set()

        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, handle_signal)
            except NotImplementedError:
                pass

        try:
            while not stop_event.is_set():
                await asyncio.sleep(1)
        except (KeyboardInterrupt, asyncio.CancelledError):
            pass
        finally:
            await bot_instance.stop()
        return


    parser.print_help()


def main():
    try:
        asyncio.run(run_cli())
    except KeyboardInterrupt:
        logger.info("[MeetingBot] Process terminated by user.")


if __name__ == "__main__":
    main()
