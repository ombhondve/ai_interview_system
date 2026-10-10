"""
RecruitAI Remote Bot Worker Agent.
Runs as a persistent background daemon on remote worker machines (Windows/Linux).
Polls the central backend for eligible scheduled interview jobs, executes them via
the existing app.main interview engine, manages job leases, and reports status.
"""

import os
import sys
import time
import signal
import random
import platform
import argparse
import logging
import subprocess
import threading
from pathlib import Path
from typing import Optional, Dict, Any
from urllib.parse import urlparse
import requests
from dotenv import load_dotenv

# Ensure environment is loaded from meeting-bot/.env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [Worker] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("RecruitAI.BotWorker")

# Google Meet URL validation regex
from app.meet import validate_meet_url


class BotWorkerConfig:
    """Worker configuration loaded from environment variables with safe defaults."""

    def __init__(
        self,
        api_url: Optional[str] = None,
        api_secret: Optional[str] = None,
        worker_id: Optional[str] = None,
        poll_seconds: Optional[int] = None,
        heartbeat_seconds: Optional[int] = None,
        lease_ms: Optional[int] = None,
    ):
        raw_api_url = (
            api_url
            or os.getenv("BOT_CONTROL_API_URL")
            or f"{os.getenv('RECRUITAI_API_URL', 'http://localhost:5000').rstrip('/')}/api/bot-control"
        )
        self.api_url = raw_api_url.rstrip("/")

        self.api_secret = (
            api_secret
            or os.getenv("BOT_CONTROL_API_SECRET")
            or os.getenv("RECRUITAI_INTERNAL_API_SECRET")
            or os.getenv("MEETING_BOT_API_SECRET")
            or ""
        ).strip()

        default_id = f"worker-{platform.node() or 'generic'}-{os.getpid()}"
        self.worker_id = (
            worker_id
            or os.getenv("BOT_WORKER_ID")
            or default_id
        ).strip()

        self.poll_seconds = int(
            poll_seconds
            or os.getenv("BOT_WORKER_POLL_SECONDS")
            or 10
        )
        self.heartbeat_seconds = int(
            heartbeat_seconds
            or os.getenv("BOT_WORKER_HEARTBEAT_SECONDS")
            or 20
        )
        self.lease_ms = int(
            lease_ms
            or os.getenv("BOT_JOB_LEASE_MS")
            or 120000
        )


class BotWorkerAgent:
    """
    Autonomous distributed worker agent that communicates with the RecruitAI
    central backend over outbound HTTPS only.
    """

    def __init__(self, config: BotWorkerConfig):
        self.config = config
        self.worker_token: Optional[str] = None
        self.status = "IDLE"  # IDLE, BUSY, PAUSED, OFFLINE
        self.enabled = True
        self.running = False
        self.current_job_id: Optional[str] = None
        self.current_process: Optional[subprocess.Popen] = None
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._lease_renew_thread: Optional[threading.Thread] = None
        self._lease_renew_stop = threading.Event()
        self._stop_event = threading.Event()

        # Base directory for meeting-bot
        self.bot_dir = Path(__file__).resolve().parent.parent

    def _safe_request(
        self,
        method: str,
        path: str,
        payload: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        max_retries: int = 3,
        use_master_secret: bool = False,
    ) -> Optional[Dict[str, Any]]:
        """
        Execute an HTTP request with exponential backoff and jitter.
        Never logs sensitive authorization tokens or secrets.
        """
        url = f"{self.config.api_url}{path}"
        headers = {
            "Content-Type": "application/json",
            "X-Worker-Id": self.config.worker_id,
        }

        if use_master_secret or not self.worker_token:
            headers["X-Bot-Control-Secret"] = self.config.api_secret
            headers["Authorization"] = f"Bearer {self.config.api_secret}"
        else:
            headers["Authorization"] = f"Bearer {self.worker_token}"
            headers["X-Worker-Token"] = self.worker_token

        for attempt in range(max_retries):
            try:
                response = requests.request(
                    method=method,
                    url=url,
                    json=payload,
                    params=params,
                    headers=headers,
                    timeout=15.0,
                )

                if response.status_code == 401 and not use_master_secret and self.worker_token:
                    # Token might have been rotated or server restarted; re-register
                    logger.warning("Session token rejected (401). Attempting re-registration...")
                    if self.register():
                        headers["Authorization"] = f"Bearer {self.worker_token}"
                        headers["X-Worker-Token"] = self.worker_token
                        continue

                if response.status_code in (200, 201):
                    return response.json()

                if response.status_code == 403:
                    body = {}
                    try:
                        body = response.json()
                    except Exception:
                        pass
                    msg = body.get("message", "Forbidden")
                    if "disabled" in msg.lower() or "paused" in msg.lower():
                        self.enabled = False
                        self.status = "PAUSED"
                        logger.warning(f"Worker disabled by central administrator: {msg}")
                    return body

                # Transient server errors (502, 503, 504) -> retry with backoff
                if response.status_code in (502, 503, 504):
                    logger.warning(
                        f"Temporary backend error ({response.status_code}). "
                        f"Retrying in attempt {attempt + 1}/{max_retries}..."
                    )
                else:
                    try:
                        return response.json()
                    except Exception:
                        return {"success": False, "status_code": response.status_code}

            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as net_err:
                logger.warning(f"Network error communicating with backend ({net_err.__class__.__name__}). Retrying...")

            # Exponential backoff with jitter
            backoff = (2 ** attempt) + random.uniform(0.5, 1.5)
            time.sleep(backoff)

        return None

    def register(self) -> bool:
        """Register the worker with the central backend."""
        logger.info(f"Registering worker '{self.config.worker_id}' with central API at {self.config.api_url}...")
        payload = {
            "workerId": self.config.worker_id,
            "hostname": platform.node(),
            "platform": f"{platform.system()} {platform.release()} ({platform.machine()})",
            "version": "1.0.0",
        }

        res = self._safe_request(
            method="POST",
            path="/worker/register",
            payload=payload,
            use_master_secret=True,
            max_retries=4,
        )

        if res and res.get("success"):
            self.worker_token = res.get("workerToken")
            self.enabled = res.get("enabled", True)
            if not self.enabled:
                self.status = "PAUSED"
                logger.warning("Worker is currently marked PAUSED/DISABLED in central backend.")
            else:
                self.status = "IDLE"
                logger.info(f"Worker '{self.config.worker_id}' registered successfully. Enabled: {self.enabled}")
            return True

        logger.error(f"Worker registration failed: {res.get('message') if res else 'No response from backend'}")
        return False

    def send_heartbeat(self) -> bool:
        """Send a periodic health heartbeat to the central backend."""
        payload = {
            "workerId": self.config.worker_id,
            "status": self.status,
            "currentJobId": self.current_job_id,
        }

        res = self._safe_request(
            method="POST",
            path="/worker/heartbeat",
            payload=payload,
            max_retries=3,
        )

        if res and res.get("success"):
            prev_enabled = self.enabled
            self.enabled = res.get("enabled", True)
            if prev_enabled and not self.enabled:
                logger.warning("Worker has been disabled/paused by an administrator.")
                if self.status == "IDLE":
                    self.status = "PAUSED"
            elif not prev_enabled and self.enabled:
                logger.info("Worker has been re-enabled by an administrator.")
                if self.status == "PAUSED":
                    self.status = "IDLE"
            return True

        return False

    def claim_job(self) -> Optional[Dict[str, Any]]:
        """Request and atomically claim the next scheduled interview job."""
        if not self.enabled:
            return None

        params = {"workerId": self.config.worker_id}
        res = self._safe_request(
            method="GET",
            path="/worker/claim",
            params=params,
            max_retries=2,
        )

        if res and res.get("success") and res.get("job"):
            return res.get("job")

        return None

    def renew_job_lease(self, job_id: str) -> bool:
        """Renew the execution lease while the interview process is running."""
        payload = {
            "workerId": self.config.worker_id,
            "state": "RUNNING",
        }
        res = self._safe_request(
            method="POST",
            path=f"/worker/jobs/{job_id}/heartbeat",
            payload=payload,
            max_retries=3,
        )
        return bool(res and res.get("success"))

    def report_job_completion(self, job_id: str, exit_code: int, details: str = "") -> bool:
        """Report that the subprocess finished."""
        payload = {
            "workerId": self.config.worker_id,
            "exitCode": exit_code,
            "details": details,
        }
        res = self._safe_request(
            method="POST",
            path=f"/worker/jobs/{job_id}/complete",
            payload=payload,
            max_retries=3,
        )
        return bool(res and res.get("success"))

    def report_job_failure(self, job_id: str, error_message: str, exit_code: Optional[int] = None) -> bool:
        """Report a failure safely to the central backend."""
        payload = {
            "workerId": self.config.worker_id,
            "error": error_message,
            "exitCode": exit_code,
        }
        res = self._safe_request(
            method="POST",
            path=f"/worker/jobs/{job_id}/fail",
            payload=payload,
            max_retries=3,
        )
        return bool(res and res.get("success"))

    def _start_lease_renewal(self, job_id: str, lease_ms: int) -> None:
        """Start background lease renewal thread for the active job."""
        self._lease_renew_stop.clear()
        interval_sec = max(10.0, (lease_ms / 1000.0) / 3.0)

        def renewal_loop():
            while not self._lease_renew_stop.wait(interval_sec):
                logger.debug(f"Renewing lease for job {job_id}...")
                ok = self.renew_job_lease(job_id)
                if not ok:
                    logger.warning(f"Failed to renew lease for job {job_id}. Lease may expire!")

        self._lease_renew_thread = threading.Thread(target=renewal_loop, daemon=True)
        self._lease_renew_thread.start()

    def _stop_lease_renewal(self) -> None:
        """Stop background lease renewal thread."""
        self._lease_renew_stop.set()
        if self._lease_renew_thread and self._lease_renew_thread.is_alive():
            self._lease_renew_thread.join(timeout=2.0)
        self._lease_renew_thread = None

    def execute_job(self, job: Dict[str, Any]) -> None:
        """
        Validate and execute an assigned interview job using the existing Python engine.
        Uses subprocess argument arrays without untrusted string concatenation.
        """
        job_id = job.get("jobId")
        interview_id = job.get("interviewId")
        candidate_id = job.get("candidateId")
        meet_url = job.get("meetUrl")
        lease_ms = job.get("leaseDurationMs", self.config.lease_ms)

        logger.info(f"Received job assignment: jobId={job_id}, interviewId={interview_id}")

        # 1. Validate Google Meet URL
        if not meet_url or not validate_meet_url(meet_url):
            err_msg = f"Rejected invalid Google Meet URL format: {meet_url}"
            logger.error(err_msg)
            self.report_job_failure(job_id, err_msg)
            return

        if not interview_id or not candidate_id:
            err_msg = "Job missing required interviewId or candidateId."
            logger.error(err_msg)
            self.report_job_failure(job_id, err_msg)
            return

        self.status = "BUSY"
        self.current_job_id = job_id

        # 2. Start lease renewal in background
        self._start_lease_renewal(job_id, lease_ms)

        # 3. Build subprocess command array
        cmd = [
            sys.executable,
            "-m",
            "app.main",
            "--meet-url",
            meet_url,
            "--interview-id",
            interview_id,
            "--candidate-id",
            candidate_id,
        ]

        logger.info(f"Launching interview bot process: python -m app.main --interview-id {interview_id}...")

        env = os.environ.copy()
        # Ensure subprocess knows central API URL and secret
        parsed_api = urlparse(self.config.api_url)
        base_origin = f"{parsed_api.scheme}://{parsed_api.netloc}"
        env["RECRUITAI_API_URL"] = base_origin
        env["RECRUITAI_BACKEND_URL"] = base_origin
        if self.config.api_secret:
            env["RECRUITAI_INTERNAL_API_SECRET"] = self.config.api_secret
            env["MEETING_BOT_API_SECRET"] = self.config.api_secret

        try:
            self.current_process = subprocess.Popen(
                cmd,
                cwd=str(self.bot_dir),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )

            # Stream output safely
            if self.current_process.stdout:
                for line in self.current_process.stdout:
                    cleaned_line = line.rstrip()
                    if cleaned_line:
                        logger.info(f"[BotProcess] {cleaned_line}")

            self.current_process.wait()
            exit_code = self.current_process.returncode
            logger.info(f"Interview bot process finished with exit code: {exit_code}")

            # 4. Stop lease renewal
            self._stop_lease_renewal()

            # 5. Report completion to central backend
            # Note: Central backend will verify MongoDB interview status!
            self.report_job_completion(job_id, exit_code, f"Process exited with code {exit_code}")

        except Exception as exc:
            logger.exception(f"Unexpected error executing interview bot: {exc}")
            self._stop_lease_renewal()
            self.report_job_failure(job_id, f"Subprocess execution error: {str(exc)[:200]}")

        finally:
            self.current_process = None
            self.current_job_id = None
            self.status = "PAUSED" if not self.enabled else "IDLE"

    def _start_heartbeat_loop(self) -> None:
        """Background health heartbeat loop."""
        def heartbeat_worker():
            while not self._stop_event.wait(self.config.heartbeat_seconds):
                try:
                    self.send_heartbeat()
                except Exception as hb_err:
                    logger.debug(f"Heartbeat error: {hb_err}")

        self._heartbeat_thread = threading.Thread(target=heartbeat_worker, daemon=True)
        self._heartbeat_thread.start()

    def run_polling_loop(self, once: bool = False) -> None:
        """Main worker loop: registers, heartbeats, and polls for jobs."""
        logger.info(f"Starting BotWorkerAgent (workerId={self.config.worker_id})...")

        # Initial registration with retry
        registered = False
        while not registered and not self._stop_event.is_set():
            registered = self.register()
            if not registered:
                logger.warning(f"Registration failed. Retrying in {self.config.poll_seconds}s...")
                time.sleep(self.config.poll_seconds)
                if once:
                    break

        if not registered:
            logger.error("Could not register with central backend. Exiting.")
            return

        self.running = True
        self._start_heartbeat_loop()

        logger.info(f"Worker '{self.config.worker_id}' is active and polling for jobs every {self.config.poll_seconds}s.")

        try:
            while not self._stop_event.is_set():
                if not self.enabled:
                    logger.debug("Worker is paused by admin. Waiting...")
                    time.sleep(self.config.poll_seconds)
                    if once:
                        break
                    continue

                if self.status == "IDLE":
                    job = self.claim_job()
                    if job:
                        self.execute_job(job)
                        if once:
                            break
                        continue

                if once:
                    break

                time.sleep(self.config.poll_seconds)

        except (KeyboardInterrupt, SystemExit):
            logger.info("Shutdown requested.")
        finally:
            self.stop()

    def stop(self) -> None:
        """Graceful shutdown of worker agent."""
        logger.info("Shutting down worker agent...")
        self._stop_event.set()
        self.running = False
        self._stop_lease_renewal()

        if self.current_process:
            logger.info("Terminating active bot subprocess...")
            try:
                self.current_process.terminate()
                self.current_process.wait(timeout=5.0)
            except Exception:
                try:
                    self.current_process.kill()
                except Exception:
                    pass

        self.status = "OFFLINE"
        try:
            self.send_heartbeat()
        except Exception:
            pass

        logger.info(f"Worker '{self.config.worker_id}' stopped.")


def main():
    parser = argparse.ArgumentParser(description="RecruitAI Remote Bot Worker Agent")
    parser.add_argument("--api-url", type=str, help="Central Bot Control API URL")
    parser.add_argument("--api-secret", type=str, help="Central Bot Control API Secret")
    parser.add_argument("--worker-id", type=str, help="Unique Worker ID")
    parser.add_argument("--poll-seconds", type=int, help="Polling interval in seconds")
    parser.add_argument("--heartbeat-seconds", type=int, help="Heartbeat interval in seconds")
    parser.add_argument("--lease-ms", type=int, help="Job lease duration in milliseconds")
    parser.add_argument("--poll-once", action="store_true", help="Poll once and exit (for testing/diagnostics)")
    args = parser.parse_args()

    config = BotWorkerConfig(
        api_url=args.api_url,
        api_secret=args.api_secret,
        worker_id=args.worker_id,
        poll_seconds=args.poll_seconds,
        heartbeat_seconds=args.heartbeat_seconds,
        lease_ms=args.lease_ms,
    )

    agent = BotWorkerAgent(config)

    # Set up signal handlers for graceful exit
    def sig_handler(signum, frame):
        logger.info("Received termination signal.")
        agent.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, sig_handler)
    signal.signal(signal.SIGTERM, sig_handler)

    agent.run_polling_loop(once=args.poll_once)


if __name__ == "__main__":
    main()
