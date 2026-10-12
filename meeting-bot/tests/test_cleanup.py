"""
Unit tests for the RecruitAI Local Artifacts Retention & Cleanup Module (app/cleanup.py).
Verifies:
1. Candidate utterance recordings (> 48h) are cleaned up.
2. Active utterances (< 10m) are strictly preserved (active session protection).
3. Master interview recordings (< 7d) are preserved to guarantee recovery window.
4. Master interview recordings (> 7d) are safely cleaned up.
5. Diagnostic screenshots (> 7d) are cleaned up.
6. Dry-run simulation mode does not modify disk.
7. Idempotency: repeated runs succeed cleanly without exceptions.
"""

import os
import time
import pytest
from pathlib import Path

from app.cleanup import (
    cleanup_local_utterances,
    cleanup_test_recordings,
    cleanup_master_recordings,
    cleanup_diagnostic_screenshots,
    run_local_cleanup,
    ACTIVE_SESSION_PROTECTION_SEC,
)


@pytest.fixture
def temp_artifact_env(tmp_path, monkeypatch):
    """Create isolated mock artifact directories for testing."""
    diag_dir = tmp_path / "diagnostics"
    audio_dir = diag_dir / "audio_test"
    debug_dir = tmp_path / "debug"

    audio_dir.mkdir(parents=True, exist_ok=True)
    debug_dir.mkdir(parents=True, exist_ok=True)

    # Patch _get_artifact_dirs in app.cleanup
    monkeypatch.setattr(
        "app.cleanup._get_artifact_dirs",
        lambda: {
            "diagnostics": diag_dir,
            "audio_test": audio_dir,
            "debug": debug_dir,
        },
    )

    return {
        "diag_dir": diag_dir,
        "audio_dir": audio_dir,
        "debug_dir": debug_dir,
    }


def test_cleanup_local_utterances_deletes_old_and_preserves_active(temp_artifact_env):
    audio_dir = temp_artifact_env["audio_dir"]
    now = time.time()

    # 1. Stale utterance (50 hours old)
    stale_file = audio_dir / "meet_utterance_20261008_083537.wav"
    stale_file.write_bytes(b"RIFF....stale-audio-data")
    stale_mtime = now - (50 * 3600)
    os.utime(stale_file, (stale_mtime, stale_mtime))

    # 2. Fresh utterance (30 hours old - should NOT be deleted if max_age_hours=48)
    medium_file = audio_dir / "meet_utterance_20261011_083537.wav"
    medium_file.write_bytes(b"RIFF....medium-audio-data")
    medium_mtime = now - (30 * 3600)
    os.utime(medium_file, (medium_mtime, medium_mtime))

    # 3. Active utterance (3 minutes old - protected by active session guard)
    active_file = audio_dir / "meet_utterance_20261012_140000.wav"
    active_file.write_bytes(b"RIFF....active-audio-data")
    active_mtime = now - 180  # 3 minutes ago
    os.utime(active_file, (active_mtime, active_mtime))

    res = cleanup_local_utterances(max_age_hours=48.0, now_ts=now)

    assert res["deleted"] == 1
    assert not stale_file.exists(), "Stale utterance > 48h must be deleted"
    assert medium_file.exists(), "Utterance < 48h must be preserved"
    assert active_file.exists(), "Active utterance (< 10m) must NEVER be deleted"


def test_cleanup_master_recordings_preserves_7_day_recovery_window(temp_artifact_env):
    audio_dir = temp_artifact_env["audio_dir"]
    now = time.time()

    # 1. Master recording 3 days old (still in 7-day recovery window)
    recent_master = audio_dir / "master_interview_recent123.wav"
    recent_master.write_bytes(b"RIFF....recent-master-recording")
    recent_mtime = now - (3 * 86400)
    os.utime(recent_master, (recent_mtime, recent_mtime))

    # 2. Master recording 10 days old (past 7-day window)
    stale_master = audio_dir / "master_interview_old456.wav"
    stale_master.write_bytes(b"RIFF....stale-master-recording")
    stale_mtime = now - (10 * 86400)
    os.utime(stale_master, (stale_mtime, stale_mtime))

    res = cleanup_master_recordings(max_age_days=7.0, now_ts=now)

    assert res["deleted"] == 1
    assert recent_master.exists(), "Master recording within 7-day recovery window must be preserved"
    assert not stale_master.exists(), "Master recording older than 7 days must be deleted"


def test_cleanup_test_recordings(temp_artifact_env):
    audio_dir = temp_artifact_env["audio_dir"]
    now = time.time()

    stale_test = audio_dir / "test_recording_20261007_161106.wav"
    stale_test.write_bytes(b"RIFF....test-audio")
    mtime = now - (72 * 3600)
    os.utime(stale_test, (mtime, mtime))

    stale_meet = audio_dir / "meet_audio_20261008_043409.wav"
    stale_meet.write_bytes(b"RIFF....meet-audio")
    os.utime(stale_meet, (mtime, mtime))

    res = cleanup_test_recordings(max_age_hours=48.0, now_ts=now)
    assert res["deleted"] == 2
    assert not stale_test.exists()
    assert not stale_meet.exists()


def test_cleanup_diagnostic_screenshots(temp_artifact_env):
    diag_dir = temp_artifact_env["diag_dir"]
    debug_dir = temp_artifact_env["debug_dir"]
    now = time.time()

    # Old screenshot in diagnostics (10 days old)
    old_diag_ss = diag_dir / "no_join_button_old.png"
    old_diag_ss.write_bytes(b"PNG....old-image")
    old_mtime = now - (10 * 86400)
    os.utime(old_diag_ss, (old_mtime, old_mtime))

    # Old screenshot in debug (10 days old)
    old_debug_ss = debug_dir / "meet-more-options.png"
    old_debug_ss.write_bytes(b"PNG....debug-image")
    os.utime(old_debug_ss, (old_mtime, old_mtime))

    # Fresh screenshot (2 hours old)
    fresh_diag_ss = diag_dir / "no_join_button_fresh.png"
    fresh_diag_ss.write_bytes(b"PNG....fresh-image")
    fresh_mtime = now - (2 * 3600)
    os.utime(fresh_diag_ss, (fresh_mtime, fresh_mtime))

    res = cleanup_diagnostic_screenshots(max_age_days=7.0, now_ts=now)

    assert res["deleted"] == 2
    assert not old_diag_ss.exists()
    assert not old_debug_ss.exists()
    assert fresh_diag_ss.exists(), "Fresh screenshot within 7 days must be preserved"


def test_dry_run_simulation_mode_does_not_modify_disk(temp_artifact_env):
    audio_dir = temp_artifact_env["audio_dir"]
    now = time.time()

    stale_utterance = audio_dir / "meet_utterance_stale.wav"
    stale_utterance.write_bytes(b"RIFF....stale")
    mtime = now - (100 * 3600)
    os.utime(stale_utterance, (mtime, mtime))

    # Execute dry-run
    res = run_local_cleanup(utterance_hours=48.0, dry_run=True, now_ts=now)

    assert res["dry_run"] is True
    assert res["utterances_deleted"] == 1
    # File MUST still exist
    assert stale_utterance.exists(), "Dry-run must not delete files from disk"


def test_idempotent_repeated_cleanup(temp_artifact_env):
    audio_dir = temp_artifact_env["audio_dir"]
    now = time.time()

    stale_utterance = audio_dir / "meet_utterance_stale.wav"
    stale_utterance.write_bytes(b"RIFF....stale")
    mtime = now - (100 * 3600)
    os.utime(stale_utterance, (mtime, mtime))

    # First run: deletes 1 file
    run1 = run_local_cleanup(utterance_hours=48.0, dry_run=False, now_ts=now)
    assert run1["total_files_deleted"] == 1
    assert not stale_utterance.exists()

    # Second run immediately after: 0 files deleted, zero errors
    run2 = run_local_cleanup(utterance_hours=48.0, dry_run=False, now_ts=now)
    assert run2["total_files_deleted"] == 0
    assert len(run2["errors"]) == 0
