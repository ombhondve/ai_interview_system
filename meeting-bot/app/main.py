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
        from pathlib import Path
        from datetime import datetime

        logger.info(f"[MeetingBot] CLI meet requested for URL: {args.meet_url}")
        success = await bot_instance.start(args.meet_url)
        if not success:
            logger.error("[MeetingBot] Bot failed to join the meeting.")
            await bot_instance.stop()
            sys.exit(1)

        # If --meet-audio-test was passed or running interactive test
        if args.meet_audio_test:
            logger.info("[MeetingBot] Starting in-meeting audio capture & Deepgram transcription loop...")
            audio_capture.start_capture()
            diag_dir = Path(__file__).resolve().parent.parent / "diagnostics" / "audio_test"
            diag_dir.mkdir(parents=True, exist_ok=True)

            try:
                # Capture in 10-second segments
                while True:
                    logger.info("[MeetingBot] Listening to candidate speech for 10s chunk...")
                    await asyncio.sleep(10)
                    lvl = audio_capture.get_audio_level()
                    if lvl < 0.005:
                        logger.info(f"[MeetingBot] Audio level too low ({round(lvl, 4)}). Skipping silence.")
                        continue

                    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
                    seg_file = str(diag_dir / f"meet_audio_{ts}.wav")
                    meta = audio_capture.save_recording(seg_file)
                    if meta and meta["audioLevel"] > 0.0:
                        logger.info(f"[MeetingBot] Non-zero audio captured (Level: {meta['audioLevel']}). Transcribing...")
                        if deepgram_client.is_configured():
                            try:
                                res = deepgram_client.transcribe_file(seg_file)
                                transcript = (res.get("transcript") or "").strip()
                                if transcript:
                                    print("\n" + "=" * 50)
                                    print(f"CANDIDATE TRANSCRIPT: '{transcript}'")
                                    print("=" * 50 + "\n")

                                    # Phase 3 integration: forward transcript to RecruitAI backend if interview_id is set
                                    if args.interview_id:
                                        try:
                                            backend_res = recruitai_client.submit_transcript(
                                                interview_id=args.interview_id,
                                                transcript=transcript,
                                                candidate_id=args.candidate_id,
                                            )
                                            if backend_res.get("nextQuestion"):
                                                print("\n" + "*" * 50)
                                                print("NEXT QUESTION:")
                                                print(backend_res["nextQuestion"])
                                                print("*" * 50 + "\n")
                                        except Exception as b_err:
                                            logger.error(f"[MeetingBot] Backend submission error: {b_err}")
                                else:
                                    logger.info("[MeetingBot] Deepgram: No speech detected in segment.")
                            except Exception as stt_err:
                                logger.error(f"[MeetingBot] STT error: {stt_err}")
                        else:
                            logger.warning("[MeetingBot] Audio saved, but DEEPGRAM_API_KEY is not configured.")
                    # Restart frame accumulation for next segment
                    audio_capture.start_capture()
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
