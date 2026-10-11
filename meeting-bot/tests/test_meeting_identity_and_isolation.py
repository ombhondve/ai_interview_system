"""
Tests for meeting identity enforcement, browser tab isolation,
and scheduled time verification (User Request Cases 1-16).
"""

import sys
import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.bot import MeetingBot, BotStatus
from app.meet import validate_meet_url, mask_meet_url
from app.worker import BotWorkerAgent, BotWorkerConfig


@pytest.fixture
def mock_config():
    return BotWorkerConfig(
        api_url="http://localhost:5000/api/bot-control",
        api_secret="test-secret",
        worker_id="test-worker-01",
        poll_seconds=5,
        heartbeat_seconds=10,
        lease_ms=60000,
    )


@pytest.fixture
def worker_agent(mock_config):
    agent = BotWorkerAgent(mock_config)
    agent.worker_token = "valid-test-token"
    return agent


# ------------------------------------------------------------------------------
# CASE 1: Worker starts while no interview is eligible
# ------------------------------------------------------------------------------
def test_worker_idle_when_no_job_eligible(worker_agent):
    """When backend returns no eligible job, worker remains IDLE and launches nothing."""
    mock_claim_resp = {
        "success": True,
        "job": None,
        "message": "No eligible interview jobs available at this time.",
        "status_code": 200,
    }

    with patch.object(worker_agent, "_safe_request", return_value=mock_claim_resp), \
         patch("subprocess.Popen") as mock_popen:

        job = worker_agent.claim_job()
        assert job is None
        assert worker_agent.status == "IDLE"
        mock_popen.assert_not_called()


# ------------------------------------------------------------------------------
# CASE 2: Worker starts with one future scheduled interview
# ------------------------------------------------------------------------------
def test_future_scheduled_interview_deferred_without_launch(worker_agent):
    """If backend preflight signals FUTURE_SCHEDULED_TIME, job is released and bot is not started."""
    future_job = {
        "jobId": "job-fut-01",
        "interviewId": "507f1f77bcf86cd799439011",
        "candidateId": "507f1f77bcf86cd799439012",
        "meetUrl": "https://meet.google.com/abc-defg-hij",
        "scheduledAt": "2026-10-15T10:00:00.000Z",
    }

    preflight_resp = {
        "success": False,
        "eligible": False,
        "reason": "FUTURE_SCHEDULED_TIME",
        "message": "Scheduled start time has not arrived.",
    }

    with patch.object(worker_agent, "verify_job_preflight", return_value=preflight_resp), \
         patch.object(worker_agent, "release_job", return_value=True) as mock_release, \
         patch("subprocess.Popen") as mock_popen:

        worker_agent.execute_job(future_job)

        mock_release.assert_called_once_with("job-fut-01", reason="FUTURE_SCHEDULED_TIME")
        mock_popen.assert_not_called()
        assert worker_agent.status == "IDLE"


# ------------------------------------------------------------------------------
# CASE 3: Worker selects correct interview and authoritative URL
# ------------------------------------------------------------------------------
def test_authoritative_meet_url_enforced_from_preflight(worker_agent):
    """If preflight specifies authoritative meetLink, it overrides any stale URL."""
    job = {
        "jobId": "job-corr-01",
        "interviewId": "507f1f77bcf86cd799439011",
        "candidateId": "507f1f77bcf86cd799439012",
        "meetUrl": "https://meet.google.com/old-urll-old",
        "scheduledAt": "2026-10-11T10:00:00.000Z",
    }

    authoritative_url = "https://meet.google.com/new-auth-url"
    preflight_resp = {
        "success": True,
        "eligible": True,
        "meetLink": authoritative_url,
        "candidateId": "507f1f77bcf86cd799439012",
    }

    mock_proc = MagicMock()
    mock_proc.stdout = []
    mock_proc.wait.return_value = None
    mock_proc.returncode = 0

    with patch.object(worker_agent, "verify_job_preflight", return_value=preflight_resp), \
         patch.object(worker_agent, "renew_job_lease", return_value=True), \
         patch.object(worker_agent, "report_job_completion", return_value=True), \
         patch("subprocess.Popen", return_value=mock_proc) as mock_popen:

        worker_agent.execute_job(job)

        mock_popen.assert_called_once()
        cmd_args = mock_popen.call_args[0][0]
        url_idx = cmd_args.index("--meet-url")
        assert cmd_args[url_idx + 1] == authoritative_url


# ------------------------------------------------------------------------------
# CASE 4 & 5: Stale tabs closed & browser session isolated
# ------------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_persistent_browser_closes_stale_pages():
    """Bot closes previous restored tabs before loading target Google Meet."""
    bot = MeetingBot()
    bot.meet_url = "https://meet.google.com/target-test-meet"

    # Mock playwright context with 3 existing/restored pages
    p1 = AsyncMock()
    p2 = AsyncMock()
    p3 = AsyncMock()

    mock_context = MagicMock()
    mock_context.pages = [p1, p2, p3]

    mock_playwright = MagicMock()
    mock_playwright.chromium.launch_persistent_context = AsyncMock(return_value=mock_context)

    with patch("app.bot.async_playwright") as mock_pw_factory, \
         patch("app.bot.MeetNavigator") as mock_nav_cls:

        mock_pw_factory.return_value.start = AsyncMock(return_value=mock_playwright)
        nav_mock = AsyncMock()
        nav_mock.configure_audio_devices = AsyncMock(return_value={"success": True})
        nav_mock.click_join = AsyncMock(return_value="JOIN_NOW")
        nav_mock.is_in_call = AsyncMock(return_value=True)
        nav_mock.is_inside_meeting = AsyncMock(return_value=True)
        mock_nav_cls.return_value = nav_mock

        # Launch and simulate join
        ok = await bot.start("https://meet.google.com/abc-defg-hij")
        assert ok is True

        # Verify extra stale pages were closed
        p3.close.assert_awaited_once()
        p2.close.assert_awaited_once()

        # Target page was navigated to about:blank first, then meet_url
        p1.goto.assert_any_await("about:blank")
        p1.goto.assert_awaited_with("https://meet.google.com/abc-defg-hij", wait_until="networkidle", timeout=45000)


# ------------------------------------------------------------------------------
# CASE 6 & 7: Masked URL diagnostic logging
# ------------------------------------------------------------------------------
def test_masked_url_utility():
    """mask_meet_url redacts center characters without exposing credentials or room IDs."""
    assert mask_meet_url("https://meet.google.com/abc-defg-hij") == "https://meet.google.com/abc-***-hij"
    assert mask_meet_url("") == "<none>"
    assert mask_meet_url(None) == "<none>"


# ------------------------------------------------------------------------------
# CASE 8 & 9: Subprocess exit reporting
# ------------------------------------------------------------------------------
def test_subprocess_failure_reports_actionable_error(worker_agent):
    """Worker reports non-zero exit code with last output lines to backend."""
    bad_job = {
        "jobId": "job-crash-01",
        "interviewId": "507f1f77bcf86cd799439011",
        "candidateId": "507f1f77bcf86cd799439012",
        "meetUrl": "https://meet.google.com/abc-defg-hij",
        "scheduledAt": "2026-10-11T10:00:00.000Z",
    }

    preflight_resp = {
        "success": True,
        "eligible": True,
        "candidateId": "507f1f77bcf86cd799439012",
    }

    mock_proc = MagicMock()
    mock_proc.stdout = ["Fatal error in WebRTC driver", "Process killed"]
    mock_proc.wait.return_value = None
    mock_proc.returncode = 1

    with patch.object(worker_agent, "verify_job_preflight", return_value=preflight_resp), \
         patch.object(worker_agent, "renew_job_lease", return_value=True), \
         patch.object(worker_agent, "report_job_failure") as mock_fail, \
         patch("subprocess.Popen", return_value=mock_proc):

        worker_agent.execute_job(bad_job)

        mock_fail.assert_called_once()
        fail_args = mock_fail.call_args[0]
        assert fail_args[0] == "job-crash-01"
        assert "Process killed" in fail_args[1]
