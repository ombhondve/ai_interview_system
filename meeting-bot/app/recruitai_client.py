"""
Client for interacting with the RecruitAI backend internal API.
Sends candidate transcripts to /api/ai-interviews/internal/:interviewId/answer.
Handles authentication, timeouts, retries, and sanitized logging.
"""

import uuid
import time
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
        camera_on: Optional[bool] = None,
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
        if camera_on is not None:
            payload["cameraOn"] = camera_on

        # Never log internal secrets or full sensitive candidate tokens
        logger.info(
            f"[RecruitAIClient] Submitting answer for interview {interview_id} "
            f"(requestId: {req_id}, chars: {len(transcript)}) to {endpoint}"
        )

        max_retries = 3
        last_exception = None

        for attempt in range(max_retries):
            try:
                response = requests.post(
                    endpoint,
                    json=payload,
                    headers=headers,
                    timeout=self.timeout_seconds,
                )
            except requests.exceptions.Timeout as t_err:
                logger.warning(f"[RecruitAIClient] Attempt {attempt + 1}/{max_retries} timed out connecting to backend ({endpoint})")
                last_exception = TimeoutError("Backend request timed out.")
                if attempt < max_retries - 1:
                    time.sleep(1.0 * (attempt + 1))
                    continue
                raise last_exception
            except requests.exceptions.RequestException as exc:
                logger.warning(f"[RecruitAIClient] Attempt {attempt + 1}/{max_retries} network error: {exc}")
                last_exception = ConnectionError(f"Backend network error: {exc}")
                if attempt < max_retries - 1:
                    time.sleep(1.0 * (attempt + 1))
                    continue
                raise last_exception

            if response.status_code >= 500:
                logger.warning(f"[RecruitAIClient] Attempt {attempt + 1}/{max_retries} received {response.status_code} from backend.")
                last_exception = RuntimeError(f"Backend server error ({response.status_code}).")
                if attempt < max_retries - 1:
                    time.sleep(1.0 * (attempt + 1))
                    continue
                raise last_exception

            # If not 5xx, break retry loop to process response
            break

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

    def notify_recording_started(
        self,
        interview_id: str,
        candidate_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Notify backend that master interview recording has started.
        """
        endpoint = f"{self.base_url}/api/ai-interviews/internal/{interview_id}/recording"
        headers = {
            "Content-Type": "application/json",
            "X-Internal-Secret": self.internal_secret,
        }
        payload = {"action": "START"}
        if candidate_id:
            payload["candidateId"] = candidate_id

        try:
            response = requests.post(
                endpoint,
                json=payload,
                headers=headers,
                timeout=self.timeout_seconds,
            )
            return response.json() if response.ok else {}
        except Exception as exc:
            logger.warning(f"[RecruitAIClient] Error notifying recording start: {exc}")
            return {}

    def upload_recording(
        self,
        interview_id: str,
        recording_file_path: str,
        duration_seconds: float = 0.0,
        candidate_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Upload the master interview audio recording file to the backend Cloudinary endpoint.
        """
        import os
        endpoint = f"{self.base_url}/api/ai-interviews/internal/{interview_id}/recording"
        headers = {
            "X-Internal-Secret": self.internal_secret,
        }
        data = {
            "action": "UPLOAD",
            "duration": str(duration_seconds),
        }
        if candidate_id:
            data["candidateId"] = candidate_id

        if not os.path.exists(recording_file_path):
            raise FileNotFoundError(f"Recording file not found: {recording_file_path}")

        logger.info(f"[RecruitAIClient] Uploading master interview recording ({recording_file_path}) to backend Cloudinary service...")
        with open(recording_file_path, "rb") as f:
            files = {"recording": (os.path.basename(recording_file_path), f, "audio/wav")}
            response = requests.post(
                endpoint,
                data=data,
                files=files,
                headers=headers,
                timeout=120.0,  # Audio upload may take longer
            )

        if not response.ok:
            logger.error(f"[RecruitAIClient] Failed to upload recording: HTTP {response.status_code} - {response.text}")
            raise RuntimeError(f"Recording upload failed: HTTP {response.status_code}")

        res_json = response.json()
        logger.info(f"[RecruitAIClient] Master interview recording uploaded successfully: {res_json}")
        return res_json

    def complete_interview(
        self,
        interview_id: str,
        candidate_id: Optional[str] = None,
        wait_for_analysis: bool = False,
    ) -> Dict[str, Any]:
        """
        Notify backend that interview is finished, triggering evaluation and report generation.
        Calls POST /api/ai-interviews/internal/:interviewId/complete.
        """
        endpoint = f"{self.base_url}/api/ai-interviews/internal/{interview_id}/complete"
        headers = {
            "Content-Type": "application/json",
            "X-Internal-Secret": self.internal_secret,
        }
        payload = {"waitForAnalysis": wait_for_analysis}
        if candidate_id:
            payload["candidateId"] = candidate_id

        try:
            logger.info(f"[RecruitAIClient] Finalizing interview {interview_id} on backend...")
            response = requests.post(
                endpoint,
                json=payload,
                headers=headers,
                timeout=self.timeout_seconds,
            )
            if not response.ok:
                logger.error(f"[RecruitAIClient] Failed to finalize interview: HTTP {response.status_code} - {response.text}")
                return {"success": False, "error": response.text}
            res_data = response.json()
            logger.info(f"[RecruitAIClient] Interview finalization acknowledged by backend: status={res_data.get('status')}")
            return res_data
        except Exception as exc:
            logger.error(f"[RecruitAIClient] Error finalizing interview on backend: {exc}")
            return {"success": False, "error": str(exc)}


recruitai_client = RecruitAIClient()

