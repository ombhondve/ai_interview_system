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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("MeetingBot.Main")

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

        logger.info("[MeetingBot] Starting 10-second audio capture loopback test...")
        started = audio_capture.start_capture()
        if not started:
            logger.error("[MeetingBot] Audio capture failed to start.")
            sys.exit(1)

        info = audio_capture.get_device_info()
        logger.info(f"[MeetingBot] Capture active on: {info['deviceName']} ({info['targetSampleRate']}Hz, {info['targetChannels']}ch)")
        logger.info("[MeetingBot] Recording for 10 seconds. Play audio or speak in Google Meet...")

        for s in range(10):
            await asyncio.sleep(1)
            level = audio_capture.get_audio_level()
            logger.info(f"[MeetingBot] T+{s+1}s | Audio level (RMS): {round(level, 4)}")

        audio_capture.stop_capture()

        diag_dir = Path(__file__).resolve().parent.parent / "diagnostics" / "audio_test"
        diag_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        test_file = str(diag_dir / f"test_recording_{ts}.wav")
        res = audio_capture.save_recording(test_file)
        if res:
            logger.info(f"[MeetingBot] Audio test recording successfully saved: {res}")
            if res["audioLevel"] == 0.0:
                logger.warning("[MeetingBot] NO_AUDIO_DETECTED: Audio level is 0.0 (silence).")
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
                session_check = recruitai_client.get_interview_session(
                    args.interview_id, candidate_id=args.candidate_id
                )
                logger.info(f"[BACKEND] Verified session status: {session_check.get('status')} (phase: {session_check.get('phase')})")
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
            logger.info("[MeetingBot] Starting in-meeting audio capture and interview loop...")
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
                    logger.info("[INTERVIEW] Transitioned to IN_PROGRESS")
                    join_res = recruitai_client.notify_candidate_joined(
                        args.interview_id, candidate_id=args.candidate_id
                    )
                    first_question = join_res.get("firstQuestion")
                except Exception as sess_err:
                    logger.warning(
                        f"[MeetingBot] Could not signal candidate presence ({sess_err}). "
                        "Attempting fallback session fetch."
                    )
                    try:
                        session_info = recruitai_client.get_interview_session(
                            args.interview_id, candidate_id=args.candidate_id
                        )
                        first_question = session_info.get("currentQuestion")
                    except Exception:
                        pass

                if first_question:
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
                else:
                    logger.info("[MeetingBot] No initial question returned from backend; waiting for candidate speech.")

            logger.info("[PERF] candidate_listening_started")
            logger.info("[AUDIO] Listening for candidate")
            try:
                while True:
                    # AI_SPEAKING guard: Do NOT process candidate audio if AI is speaking
                    if bot_instance.is_ai_speaking():
                        logger.debug("[STT] Ignored because AI_SPEAKING=true")
                        await asyncio.sleep(0.3)
                        continue

                    # Continuous utterance-based capture with silence detection
                    # Automatically segments speech, applies pre-roll, and detects end of speech
                    utterance = await audio_capture.capture_utterance(
                        is_ai_speaking_fn=bot_instance.is_ai_speaking
                    )

                    if not utterance:
                        await asyncio.sleep(0.1)
                        continue

                    # Double check AI_SPEAKING
                    if bot_instance.is_ai_speaking():
                        logger.info("[STT] Ignored captured utterance because AI_SPEAKING=true")
                        continue

                    wav_bytes = utterance.get("wav_bytes")
                    total_dur = utterance.get("duration", 0.0)
                    speech_dur = utterance.get("speech_duration", 0.0)

                    # Performance timestamp recording
                    speech_ended_timestamp = time.monotonic()
                    logger.info(f"[PERF] utterance_duration={total_dur}s (actual speech: {speech_dur}s)")

                    if not wav_bytes or len(wav_bytes) < 44:
                        logger.warning("[AUDIO] Empty audio payload; continuing listening.")
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
                        continue

                    # 1. Deepgram STT
                    deepgram_start = time.monotonic()
                    logger.info(f"[PERF] deepgram_start")
                    try:
                        res = deepgram_client.transcribe_file(seg_file)
                        deepgram_end = time.monotonic()
                        deepgram_duration = round(deepgram_end - deepgram_start, 2)
                        logger.info(f"[PERF] deepgram_end duration={deepgram_duration}s")
                    except Exception as stt_err:
                        logger.error(f"[MeetingBot] STT error: {stt_err}")
                        continue

                    transcript = (res.get("transcript") or "").strip()
                    confidence = res.get("confidence", 0.0)
                    logger.info(f"[STT] Deepgram response: success={res.get('success')}, confidence={round(confidence, 3)}, model={res.get('model')}")

                    # Reject empty or very low confidence noise
                    if not transcript or confidence < 0.35:
                        logger.info(f"[STT] Filtered empty/low-confidence transcript (conf={round(confidence, 2)})")
                        continue

                    if bot_instance.is_ai_speaking():
                        logger.info("[STT] Ignored candidate transcript because AI_SPEAKING=true")
                        continue

                    print("\n" + "=" * 50)
                    print(f"CANDIDATE TRANSCRIPT: '{transcript}'")
                    print("=" * 50 + "\n")
                    logger.info(f"[STT] Transcript: {transcript}")

                    if not args.interview_id:
                        continue

                    # 2. Backend Submission
                    backend_start = time.monotonic()
                    logger.info(f"[PERF] backend_start")
                    try:
                        backend_res = recruitai_client.submit_transcript(
                            interview_id=args.interview_id,
                            transcript=transcript,
                            candidate_id=args.candidate_id,
                        )
                        backend_end = time.monotonic()
                        backend_duration = round(backend_end - backend_start, 2)
                        logger.info(f"[PERF] backend_end duration={backend_duration}s")

                        logger.info(
                            f"[BACKEND] Answer submitted: accepted={backend_res.get('accepted')}, "
                            f"status={backend_res.get('interviewStatus')}, phase={backend_res.get('phase')}, "
                            f"qIndex={backend_res.get('currentQuestionIndex')}"
                        )

                        # Filter filler answers if backend rejected
                        if not backend_res.get("accepted"):
                            logger.info(f"[BACKEND] Answer not accepted: {backend_res.get('reason')}")
                            continue

                        next_q = backend_res.get("nextQuestion")
                        is_closing = backend_res.get("closing", False)

                        if next_q:
                            logger.info(f"[AI] Next question received: '{next_q[:60]}...'")
                            print("\n" + "*" * 50)
                            print(f"NEXT QUESTION: {next_q}")
                            print("*" * 50 + "\n")

                            # 3. TTS Playback
                            tts_start = time.monotonic()
                            logger.info(f"[PERF] tts_start")
                            logger.info("[AI] SPEAKING")
                            # Speak through Kokoro TTS and VB-CABLE into Google Meet
                            await bot_instance.speak_text(next_q)
                            tts_end = time.monotonic()
                            tts_duration = round(tts_end - tts_start, 2)
                            logger.info(f"[PERF] tts_end duration={tts_duration}s")
                            logger.info("[PERF] ai_speaking_finished")
                            audio_capture.reset_buffer()
                            logger.info("[PERF] audio_buffer_flushed")
                            await asyncio.sleep(0.4)
                            logger.info("[PERF] candidate_listening_started")

                            # Total response time from candidate speech end to AI question starting/completing
                            total_response_time = round(tts_end - speech_ended_timestamp, 2)
                            logger.info(f"[PERF] total_response_time={total_response_time}s")

                        if is_closing:
                            logger.info("[MeetingBot] Interview completed (closing=true). Exiting meeting gracefully.")
                            await asyncio.sleep(2.0)
                            break

                    except Exception as b_err:
                        logger.error(f"[MeetingBot] Backend submission error: {b_err}")

            except (KeyboardInterrupt, asyncio.CancelledError):
                pass
            finally:
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
