"""
Unit tests for Meeting Bot RecruitAI client and Phase 3 integration requirements.
Validates:
1. Valid transcript submitted to backend.
2. Missing transcript rejected.
3. Meaningless / silence / filler transcript filtered.
4. Duplicate requestId handled safely.
5. Backend timeout handled safely.
6. Backend 401/403 handled safely.
7. Backend 500 handled safely.
8. Valid response returns nextQuestion.
9. Meeting bot does not invoke Groq directly.
10. Meeting bot does not invoke ElevenLabs.
11. Secrets are never logged.
"""

import sys
import logging
from unittest.mock import patch, MagicMock
import pytest
import requests

from app.recruitai_client import RecruitAIClient


@pytest.fixture
def client():
    return RecruitAIClient(
        base_url="http://localhost:5000",
        internal_secret="mock-secret-xyz",
        timeout_seconds=5.0,
    )


def test_missing_transcript_rejected(client):
    with pytest.raises(ValueError, match="cannot be empty"):
        client.submit_transcript("int-123", "")


def test_meaningless_noise_filtered(client):
    res = client.submit_transcript("int-123", "um")
    assert res["accepted"] is False
    assert res["filtered"] is True
    assert "silence or filler" in res["reason"]


def test_valid_transcript_submitted_successfully(client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.ok = True
    mock_response.json.return_value = {
        "success": True,
        "accepted": True,
        "duplicate": False,
        "nextQuestion": "Explain how you designed the database schema.",
        "interviewStatus": "IN_PROGRESS",
        "phase": "QUESTIONING",
        "currentQuestionIndex": 1,
    }

    with patch("requests.post", return_value=mock_response) as mock_post:
        res = client.submit_transcript(
            interview_id="507f1f77bcf86cd799439011",
            transcript="I designed the database using PostgreSQL and MongoDB.",
            candidate_id="507f1f77bcf86cd799439012",
            request_id="req-custom-123",
        )

        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == "http://localhost:5000/api/ai-interviews/internal/507f1f77bcf86cd799439011/answer"
        assert kwargs["headers"]["X-Internal-Secret"] == "mock-secret-xyz"
        assert kwargs["headers"]["X-Request-Id"] == "req-custom-123"
        assert kwargs["json"]["transcript"] == "I designed the database using PostgreSQL and MongoDB."
        assert kwargs["json"]["candidateId"] == "507f1f77bcf86cd799439012"
        assert kwargs["json"]["source"] == "google-meet-bot"

        assert res["accepted"] is True
        assert res["nextQuestion"] == "Explain how you designed the database schema."
        assert res["currentQuestionIndex"] == 1


def test_duplicate_request_id_handled_safely(client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.ok = True
    mock_response.json.return_value = {
        "success": True,
        "accepted": True,
        "duplicate": True,
        "nextQuestion": "Explain how you designed the database schema.",
        "interviewStatus": "IN_PROGRESS",
        "phase": "QUESTIONING",
        "currentQuestionIndex": 1,
    }

    with patch("requests.post", return_value=mock_response):
        res = client.submit_transcript(
            interview_id="507f1f77bcf86cd799439011",
            transcript="I designed the database using PostgreSQL and MongoDB.",
            request_id="req-duplicate-123",
        )
        assert res["duplicate"] is True
        assert res["accepted"] is True


def test_backend_timeout_handled_safely(client):
    with patch("requests.post", side_effect=requests.exceptions.Timeout):
        with pytest.raises(TimeoutError, match="timed out"):
            client.submit_transcript("507f1f77bcf86cd799439011", "Some candidate response.")


def test_backend_401_unauthorized_handled_safely(client):
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.ok = False
    with patch("requests.post", return_value=mock_resp):
        with pytest.raises(PermissionError, match="Unauthorized"):
            client.submit_transcript("507f1f77bcf86cd799439011", "Some candidate response.")


def test_backend_403_forbidden_handled_safely(client):
    mock_resp = MagicMock()
    mock_resp.status_code = 403
    mock_resp.ok = False
    with patch("requests.post", return_value=mock_resp):
        with pytest.raises(PermissionError, match="Forbidden"):
            client.submit_transcript("507f1f77bcf86cd799439011", "Some candidate response.")


def test_backend_404_not_found_handled_safely(client):
    mock_resp = MagicMock()
    mock_resp.status_code = 404
    mock_resp.ok = False
    with patch("requests.post", return_value=mock_resp):
        with pytest.raises(FileNotFoundError, match="not found"):
            client.submit_transcript("507f1f77bcf86cd799439011", "Some candidate response.")


def test_backend_500_handled_safely(client):
    mock_resp = MagicMock()
    mock_resp.status_code = 500
    mock_resp.ok = False
    with patch("requests.post", return_value=mock_resp):
        with pytest.raises(RuntimeError, match="500"):
            client.submit_transcript("507f1f77bcf86cd799439011", "Some candidate response.")


def test_meeting_bot_does_not_import_or_invoke_groq():
    # Meeting bot codebase should not have groq SDK imported or invoked
    assert "groq" not in sys.modules
    with open("app/recruitai_client.py", "r", encoding="utf-8") as f:
        content = f.read()
    assert "groq" not in content.lower()


def test_meeting_bot_does_not_import_or_invoke_elevenlabs():
    # Meeting bot codebase should not have elevenlabs SDK imported or invoked
    assert "elevenlabs" not in sys.modules
    with open("app/recruitai_client.py", "r", encoding="utf-8") as f:
        content = f.read()
    assert "elevenlabs" not in content.lower()


def test_secrets_are_never_logged(caplog, client):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.ok = True
    mock_resp.json.return_value = {"accepted": True}

    with patch("requests.post", return_value=mock_resp):
        with caplog.at_level(logging.DEBUG):
            client.submit_transcript(
                interview_id="507f1f77bcf86cd799439011",
                transcript="A valid candidate answer about microservices.",
            )

    # Ensure secret string was never output in any log message
    for record in caplog.records:
        assert "mock-secret-xyz" not in record.message


def test_notify_candidate_joined_success(client):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.ok = True
    mock_resp.json.return_value = {
        "success": True,
        "interviewStatus": "IN_PROGRESS",
        "firstQuestion": "Can you tell me about yourself?",
    }

    with patch("requests.post", return_value=mock_resp) as mock_post:
        res = client.notify_candidate_joined(
            interview_id="507f1f77bcf86cd799439011",
            candidate_id="507f1f77bcf86cd799439012",
        )

        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == "http://localhost:5000/api/ai-interviews/internal/507f1f77bcf86cd799439011/candidate-joined"
        assert kwargs["headers"]["X-Internal-Secret"] == "mock-secret-xyz"
        assert kwargs["json"]["candidateId"] == "507f1f77bcf86cd799439012"
        assert res["interviewStatus"] == "IN_PROGRESS"
        assert res["firstQuestion"] == "Can you tell me about yourself?"
