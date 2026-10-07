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
    parser = argparse.ArgumentParser(description="RecruitAI Meeting Bot (Phase 1)")
    parser.add_argument("--auth-setup", action="store_true", help="Launch browser for interactive Google account sign-in")
    parser.add_argument("--meet-url", type=str, help="Google Meet URL to join")
    parser.add_argument("--server", action="store_true", help="Run local HTTP API server")
    args = parser.parse_args()

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
        logger.info(f"[MeetingBot] CLI meet requested for URL: {args.meet_url}")
        success = await bot_instance.start(args.meet_url)
        if not success:
            logger.error("[MeetingBot] Bot failed to join the meeting.")
            await bot_instance.stop()
            sys.exit(1)

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
                # Windows signal compatibility
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
