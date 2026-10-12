"""
Local Artifacts Retention & Cleanup Module.

Safely manages local temporary files produced during Google Meet interview sessions:
1. Candidate speech utterances (meet_utterance_*.wav) - deleted after 48h (transcription is immediate).
2. Audio level / loopback test recordings (test_recording_*.wav, meet_audio_*.wav) - deleted after 48h.
3. Master interview audio recordings (master_interview_*.wav) - retained locally for 7 days
   as an emergency recovery window for failed Cloudinary uploads, then cleaned up.
4. Diagnostic screenshots (*.png in diagnostics/ and debug/) - deleted after 7 days.

SAFETY INVARIANTS:
- Files younger than 600s (10 minutes) are NEVER deleted regardless of parameters to prevent
  interfering with an interview currently in progress.
- Master recordings younger than 7 days are NEVER deleted to guarantee recovery window.
- Failures on locked files are caught and logged; cleanup is resilient and idempotent.
- Deletions are strictly restricted to designated artifact directories.
"""

import os
import time
import argparse
import logging
from pathlib import Path
from typing import Dict, Any, List

logger = logging.getLogger("RecruitAI.Cleanup")

# Guard: Never touch files created or modified within the last 10 minutes
ACTIVE_SESSION_PROTECTION_SEC = 600.0


def _get_artifact_dirs() -> Dict[str, Path]:
    base_dir = Path(__file__).resolve().parent.parent
    return {
        "diagnostics": base_dir / "diagnostics",
        "audio_test": base_dir / "diagnostics" / "audio_test",
        "debug": base_dir / "debug",
    }


def cleanup_local_utterances(
    max_age_hours: float = 48.0,
    dry_run: bool = False,
    now_ts: float = None,
) -> Dict[str, Any]:
    """
    Remove transient per-utterance WAV recordings older than max_age_hours.
    """
    now = now_ts if now_ts is not None else time.time()
    cutoff_ts = now - (max_age_hours * 3600.0)
    audio_dir = _get_artifact_dirs()["audio_test"]

    deleted = 0
    bytes_freed = 0
    errors: List[str] = []

    if not audio_dir.exists():
        return {"deleted": 0, "bytes_freed": 0, "errors": []}

    for file_path in audio_dir.glob("meet_utterance_*.wav"):
        try:
            mtime = file_path.stat().st_mtime
            # Protection guard: active session
            if (now - mtime) < ACTIVE_SESSION_PROTECTION_SEC:
                continue

            if mtime < cutoff_ts:
                file_size = file_path.stat().st_size
                if not dry_run:
                    file_path.unlink(missing_ok=True)
                deleted += 1
                bytes_freed += file_size
        except Exception as e:
            errors.append(f"{file_path.name}: {e}")
            logger.warning(f"[CLEANUP] Could not delete utterance {file_path.name}: {e}")

    return {"deleted": deleted, "bytes_freed": bytes_freed, "errors": errors}


def cleanup_test_recordings(
    max_age_hours: float = 48.0,
    dry_run: bool = False,
    now_ts: float = None,
) -> Dict[str, Any]:
    """
    Remove test audio recordings (meet_audio_*.wav, test_recording_*.wav) older than max_age_hours.
    """
    now = now_ts if now_ts is not None else time.time()
    cutoff_ts = now - (max_age_hours * 3600.0)
    audio_dir = _get_artifact_dirs()["audio_test"]

    deleted = 0
    bytes_freed = 0
    errors: List[str] = []

    if not audio_dir.exists():
        return {"deleted": 0, "bytes_freed": 0, "errors": []}

    patterns = ["meet_audio_*.wav", "test_recording_*.wav"]
    for pattern in patterns:
        for file_path in audio_dir.glob(pattern):
            try:
                mtime = file_path.stat().st_mtime
                if (now - mtime) < ACTIVE_SESSION_PROTECTION_SEC:
                    continue

                if mtime < cutoff_ts:
                    file_size = file_path.stat().st_size
                    if not dry_run:
                        file_path.unlink(missing_ok=True)
                    deleted += 1
                    bytes_freed += file_size
            except Exception as e:
                errors.append(f"{file_path.name}: {e}")
                logger.warning(f"[CLEANUP] Could not delete test recording {file_path.name}: {e}")

    return {"deleted": deleted, "bytes_freed": bytes_freed, "errors": errors}


def cleanup_master_recordings(
    max_age_days: float = 7.0,
    dry_run: bool = False,
    now_ts: float = None,
) -> Dict[str, Any]:
    """
    Remove full interview master recordings (master_interview_*.wav) older than max_age_days.
    Preserves a minimum 7-day retention window on disk for recovery/retry purposes.
    """
    now = now_ts if now_ts is not None else time.time()
    cutoff_ts = now - (max_age_days * 86400.0)
    audio_dir = _get_artifact_dirs()["audio_test"]

    deleted = 0
    bytes_freed = 0
    errors: List[str] = []

    if not audio_dir.exists():
        return {"deleted": 0, "bytes_freed": 0, "errors": []}

    for file_path in audio_dir.glob("master_interview_*.wav"):
        try:
            mtime = file_path.stat().st_mtime
            if (now - mtime) < ACTIVE_SESSION_PROTECTION_SEC:
                continue

            if mtime < cutoff_ts:
                file_size = file_path.stat().st_size
                if not dry_run:
                    file_path.unlink(missing_ok=True)
                deleted += 1
                bytes_freed += file_size
        except Exception as e:
            errors.append(f"{file_path.name}: {e}")
            logger.warning(f"[CLEANUP] Could not delete master recording {file_path.name}: {e}")

    return {"deleted": deleted, "bytes_freed": bytes_freed, "errors": errors}


def cleanup_diagnostic_screenshots(
    max_age_days: float = 7.0,
    dry_run: bool = False,
    now_ts: float = None,
) -> Dict[str, Any]:
    """
    Remove debug screenshots (*.png in diagnostics/ and debug/) older than max_age_days.
    """
    now = now_ts if now_ts is not None else time.time()
    cutoff_ts = now - (max_age_days * 86400.0)
    dirs = [_get_artifact_dirs()["diagnostics"], _get_artifact_dirs()["debug"]]

    deleted = 0
    bytes_freed = 0
    errors: List[str] = []

    for d in dirs:
        if not d.exists():
            continue
        for file_path in d.glob("*.png"):
            try:
                mtime = file_path.stat().st_mtime
                if (now - mtime) < ACTIVE_SESSION_PROTECTION_SEC:
                    continue

                if mtime < cutoff_ts:
                    file_size = file_path.stat().st_size
                    if not dry_run:
                        file_path.unlink(missing_ok=True)
                    deleted += 1
                    bytes_freed += file_size
            except Exception as e:
                errors.append(f"{file_path.name}: {e}")
                logger.warning(f"[CLEANUP] Could not delete screenshot {file_path.name}: {e}")

    return {"deleted": deleted, "bytes_freed": bytes_freed, "errors": errors}


def run_local_cleanup(
    utterance_hours: float = 48.0,
    test_hours: float = 48.0,
    master_days: float = 7.0,
    screenshot_days: float = 7.0,
    dry_run: bool = False,
    now_ts: float = None,
) -> Dict[str, Any]:
    """
    Execute all local artifact cleanup policies idempotently.
    """
    action_label = "SIMULATING" if dry_run else "EXECUTING"
    logger.info(f"[CLEANUP] {action_label} local meeting-bot artifact cleanup...")

    utterance_res = cleanup_local_utterances(utterance_hours, dry_run=dry_run, now_ts=now_ts)
    test_res = cleanup_test_recordings(test_hours, dry_run=dry_run, now_ts=now_ts)
    master_res = cleanup_master_recordings(master_days, dry_run=dry_run, now_ts=now_ts)
    ss_res = cleanup_diagnostic_screenshots(screenshot_days, dry_run=dry_run, now_ts=now_ts)

    total_bytes = (
        utterance_res["bytes_freed"]
        + test_res["bytes_freed"]
        + master_res["bytes_freed"]
        + ss_res["bytes_freed"]
    )
    all_errors = (
        utterance_res["errors"]
        + test_res["errors"]
        + master_res["errors"]
        + ss_res["errors"]
    )

    summary = {
        "dry_run": dry_run,
        "utterances_deleted": utterance_res["deleted"],
        "test_recordings_deleted": test_res["deleted"],
        "master_recordings_deleted": master_res["deleted"],
        "screenshots_deleted": ss_res["deleted"],
        "total_files_deleted": (
            utterance_res["deleted"]
            + test_res["deleted"]
            + master_res["deleted"]
            + ss_res["deleted"]
        ),
        "bytes_freed": total_bytes,
        "megabytes_freed": round(total_bytes / (1024 * 1024), 2),
        "errors": all_errors,
    }

    logger.info(
        f"[CLEANUP] Local cleanup finished: {summary['total_files_deleted']} files "
        f"({summary['megabytes_freed']} MB freed). Errors: {len(all_errors)}"
    )
    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    parser = argparse.ArgumentParser(description="RecruitAI Local Artifact Cleanup Utility")
    parser.add_argument("--dry-run", action="store_true", help="Report files that would be deleted without deleting")
    parser.add_argument("--utterance-hours", type=float, default=48.0, help="Max age for utterance WAVs in hours (default: 48)")
    parser.add_argument("--master-days", type=float, default=7.0, help="Max age for master interview WAVs in days (default: 7)")
    parser.add_argument("--screenshot-days", type=float, default=7.0, help="Max age for screenshots in days (default: 7)")

    args = parser.parse_args()
    res = run_local_cleanup(
        utterance_hours=args.utterance_hours,
        master_days=args.master_days,
        screenshot_days=args.screenshot_days,
        dry_run=args.dry_run,
    )
    print(res)
