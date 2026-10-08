"""
Client for interacting with the RecruitAI backend internal API.
Sends candidate transcripts to /api/ai-interviews/internal/:interviewId/answer.
Handles authentication, timeouts, retries, and sanitized logging.
"""

import uuid
import logging
from typing import Optional, Dict, Any
import requests

from app.config import settings

logger = logging.getLogger("MeetingBot.RecruitAIClient")

# Filter trivial noise words and utterances that do not constitute answers
NON_MEANINGFUL_RESPONSES = {"", "um", "uh", "hmm", "ah", "huh", "mm", "mmm"}


class RecruitAIClient:
    """Client for submitting candidate responses to the RecruitAI Backend."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        internal_secret: Optional[str] = None,
        timeout_seconds: float = 15.0,
    ):
        raw_url = base_url or settings.recruitai_api_url or settings.recruitai_backend_url
        if not raw_url:
            raise ValueError(
                "RECRUITAI_API_URL is missing. Please configure RECRUITAI_API_URL in .env (e.g. https://<backend-host> or http://localhost:5000)."
            )
        self.base_url = raw_url.rstrip("/")
        self.internal_secret = internal_secret or settings.recruitai_internal_api_secret
        self.timeout_seconds = timeout_seconds

    def is_meaningful_transcript(self, transcript: str) -> bool:
        """
        Check whether the transcript meets minimum criteria for an answer.
        Filters out pure silence, noise, or trivial single-word filler utterances.
        """
        cleaned = transcript.strip().lower()
        if not cleaned:
            return False
        # Remove trailing punctuation for comparison
        normalized = "".join(c for c in cleaned if c.isalnum() or c.isspace()).strip()
        if normalized in NON_MEANINGFUL_RESPONSES:
            return False
        return len(normalized) >= 2

    def submit_transcript(
        self,
        interview_id: str,
        transcript: str,
        candidate_id: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Submit a candidate's transcribed answer to the RecruitAI backend.
        Returns a dictionary containing the accepted status, duplicate flag,
        and next question details.
        """
        if not transcript or not transcript.strip():
            raise ValueError("Transcript cannot be empty.")

        if not self.is_meaningful_transcript(transcript):
            logger.info(f"[RecruitAIClient] Filtered out non-meaningful transcript: '{transcript}'")
            return {
                "accepted": False,
                "filtered": True,
                "reason": "Transcript contains only silence or filler noises.",
            }

        req_id = request_id or f"meet-bot-{uuid.uuid4()}"
        endpoint = f"{self.base_url}/api/ai-interviews/internal/{interview_id}/answer"

        headers = {
            "Content-Type": "application/json",
            "X-Internal-Secret": self.internal_secret,
            "X-Request-Id": req_id,
        }

        payload: Dict[str, Any] = {
            "transcript": transcript.strip(),
            "requestId": req_id,
            "source": "google-meet-bot",
        }
        if candidate_id:
            payload["candidateId"] = candidate_id

        # Never log internal secrets or full sensitive candidate tokens
        logger.info(
            f"[RecruitAIClient] Submitting answer for interview {interview_id} "
            f"(requestId: {req_id}, chars: {len(transcript)}) to {endpoint}"
        )

        try:
            response = requests.post(
                endpoint,
                json=payload,
                headers=headers,
                timeout=self.timeout_seconds,
            )
        except requests.exceptions.Timeout:
            logger.error(f"[RecruitAIClient] Request timed out connecting to backend ({endpoint})")
            raise TimeoutError("Backend request timed out.")
        except requests.exceptions.RequestException as exc:
            logger.error(f"[RecruitAIClient] Network error connecting to backend: {exc}")
            raise ConnectionError(f"Backend network error: {exc}")

        if response.status_code == 401:
            logger.error("[RecruitAIClient] 401 Unauthorized: Invalid internal service secret.")
            raise PermissionError("Unauthorized: Backend rejected internal service secret.")
        elif response.status_code == 403:
            logger.error("[RecruitAIClient] 403 Forbidden: Candidate mismatch or project not verified.")
            raise PermissionError("Forbidden: Candidate mismatch or project unverified.")
        elif response.status_code == 404:
            logger.error(f"[RecruitAIClient] 404 Not Found: Interview {interview_id} not found.")
            raise FileNotFoundError(f"Interview {interview_id} not found.")
        elif response.status_code == 409:
            logger.warning("[RecruitAIClient] 409 Conflict: Interview is not currently in progress.")
            try:
                err_data = response.json()
                msg = err_data.get("message", "Interview not in progress.")
            except Exception:
                msg = "Interview not in progress."
            raise ValueError(msg)
        elif response.status_code >= 500:
            logger.error(f"[RecruitAIClient] {response.status_code} Internal Server Error from backend.")
            raise RuntimeError(f"Backend server error ({response.status_code}).")
        elif not response.ok:
            logger.error(f"[RecruitAIClient] HTTP {response.status_code}: {response.text}")
            raise RuntimeError(f"Backend error ({response.status_code}): {response.text}")

        try:
            data = response.json()
        except Exception as json_err:
            raise ValueError(f"Failed to parse backend JSON response: {json_err}")

        logger.info(
            f"[RecruitAIClient] Backend response received: accepted={data.get('accepted')}, "
            f"duplicate={data.get('duplicate')}, phase={data.get('phase')}, "
            f"qIndex={data.get('currentQuestionIndex')}"
        )

        return data

    def get_interview_session(
        self,
        interview_id: str,
        candidate_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Fetch existing interview session info (including the current/first question already generated).
        Calls GET /api/ai-interviews/internal/:interviewId/session.
        """
        endpoint = f"{self.base_url}/api/ai-interviews/internal/{interview_id}/session"
        headers = {
            "Content-Type": "application/json",
            "X-Internal-Secret": self.internal_secret,
        }
        params = {}
        if candidate_id:
            params["candidateId"] = candidate_id

        try:
            response = requests.get(
                endpoint,
                headers=headers,
                params=params,
                timeout=self.timeout_seconds,
            )
        except requests.exceptions.Timeout:
            logger.error(f"[RecruitAIClient] Request timed out connecting to backend ({endpoint})")
            raise TimeoutError("Backend request timed out.")
        except requests.exceptions.RequestException as exc:
            logger.error(f"[RecruitAIClient] Network error connecting to backend: {exc}")
            raise ConnectionError(f"Backend network error: {exc}")

        if response.status_code == 401:
            raise PermissionError("Unauthorized: Backend rejected internal service secret.")
        elif response.status_code == 403:
            raise PermissionError("Forbidden: Candidate mismatch or session forbidden.")
        elif response.status_code == 404:
            raise FileNotFoundError(f"Interview {interview_id} not found.")
        elif response.status_code == 409:
            try:
                msg = response.json().get("message", "Interview not in progress.")
            except Exception:
                msg = "Interview not in progress."
            raise ValueError(msg)
        elif not response.ok:
            raise RuntimeError(f"Backend error ({response.status_code}): {response.text}")

        return response.json()

    def notify_candidate_joined(
        self,
        interview_id: str,
        candidate_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Signal backend that the candidate has joined Google Meet.
        Transitions interview status to IN_PROGRESS and bootstraps initial question.
        Calls POST /api/ai-interviews/internal/:interviewId/candidate-joined.
        """
        endpoint = f"{self.base_url}/api/ai-interviews/internal/{interview_id}/candidate-joined"
        headers = {
            "Content-Type": "application/json",
            "X-Internal-Secret": self.internal_secret,
        }
        payload = {}
        if candidate_id:
            payload["candidateId"] = candidate_id

        logger.info(f"[RecruitAIClient] Notifying backend candidate joined for interview {interview_id}...")
        try:
            response = requests.post(
                endpoint,
                json=payload,
                headers=headers,
                timeout=self.timeout_seconds,
            )
        except requests.exceptions.Timeout:
            logger.error(f"[RecruitAIClient] Request timed out connecting to backend ({endpoint})")
            raise TimeoutError("Backend request timed out.")
        except requests.exceptions.RequestException as exc:
            logger.error(f"[RecruitAIClient] Network error connecting to backend: {exc}")
            raise ConnectionError(f"Backend network error: {exc}")

        if response.status_code == 401:
            raise PermissionError("Unauthorized: Backend rejected internal service secret.")
        elif response.status_code == 403:
            raise PermissionError("Forbidden: Candidate mismatch.")
        elif response.status_code == 404:
            raise FileNotFoundError(f"Interview {interview_id} not found.")
        elif not response.ok:
            raise RuntimeError(f"Backend error ({response.status_code}): {response.text}")

        data = response.json()
        logger.info(
            f"[RecruitAIClient] Candidate-joined recorded: status={data.get('status')}, "
            f"started={data.get('started')}, hasFirstQuestion={bool(data.get('firstQuestion'))}"
        )
        return data


recruitai_client = RecruitAIClient()

