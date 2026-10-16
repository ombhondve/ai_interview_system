"""
RecruitAI Meeting Bot Environment Configuration Validator

Validates bot runtime settings, backend connectivity targets, audio configuration,
and local speech assets without exposing secrets or making paid network calls.

Usage:
    python validate_env.py
"""

import sys
import os
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

# Reconfigure stdout for UTF-8 on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.config import settings

def mask_status(val: bool) -> str:
    return "[CONFIGURED]" if val else "[- NOT SET]"

def main():
    print("=================================================")
    print("   RecruitAI Meeting Bot Environment Audit")
    print("=================================================")
    print(f"Platform: {sys.platform}")
    print(f"Python:   {sys.version.split()[0]}")
    print("-------------------------------------------------")

    # Inventory
    inventory = [
        ("1. Bot Identity & Worker", [
            ("BOT_WORKER_ID", mask_status(bool(os.getenv("BOT_WORKER_ID")))),
            ("BOT_WORKER_POLL_SECONDS", f"[OK] {os.getenv('BOT_WORKER_POLL_SECONDS', '10')}s"),
            ("BOT_WORKER_HEARTBEAT_SECONDS", f"[OK] {os.getenv('BOT_WORKER_HEARTBEAT_SECONDS', '20')}s"),
            ("BOT_JOB_LEASE_MS", f"[OK] {os.getenv('BOT_JOB_LEASE_MS', '120000')}ms"),
        ]),
        ("2. Backend Control API", [
            ("BOT_CONTROL_API_URL", mask_status(bool(os.getenv("BOT_CONTROL_API_URL") or settings.recruitai_api_url))),
            ("RECRUITAI_API_URL", mask_status(bool(settings.recruitai_api_url))),
            ("BOT_CONTROL_API_SECRET", mask_status(bool(settings.recruitai_internal_api_secret and settings.recruitai_internal_api_secret != "recruitai-default-bot-secret"))),
        ]),
        ("3. Browser & Google Meet", [
            ("GOOGLE_MEET_BOT_EMAIL", mask_status(bool(settings.google_meet_bot_email))),
            ("MEETING_BOT_HEADLESS", f"[OK] {settings.meeting_bot_headless}"),
            ("MEETING_BOT_PROFILE_DIR", mask_status(bool(settings.meeting_bot_profile_dir))),
        ]),
        ("4. Speech-to-Text (Deepgram)", [
            ("DEEPGRAM_API_KEY", mask_status(bool(settings.deepgram_api_key))),
            ("DEEPGRAM_MODEL", f"[OK] {settings.deepgram_model}"),
        ]),
        ("5. Text-to-Speech (Local Kokoro)", [
            ("KOKORO_ENABLED", f"[OK] {settings.kokoro_enabled}"),
            ("KOKORO_VOICE", f"[OK] {settings.kokoro_voice}"),
            ("KOKORO_LANG_CODE", f"[OK] {settings.kokoro_lang_code}"),
            ("KOKORO_OUTPUT_DEVICE", mask_status(bool(settings.kokoro_output_device))),
        ]),
        ("6. Audio Capture & Devices", [
            ("AUDIO_CAPTURE_DEVICE", mask_status(bool(settings.audio_capture_device))),
            ("MEET_MIC_DEVICE", mask_status(bool(settings.meet_mic_device))),
            ("MEET_SPEAKER_DEVICE", mask_status(bool(settings.meet_speaker_device))),
            ("AUDIO_SAMPLE_RATE", f"[OK] {settings.audio_sample_rate} Hz"),
        ]),
    ]

    for section_name, items in inventory:
        print(f"\n{section_name}:")
        for k, status in items:
            print(f"  {k.ljust(30)} {status}")

    print("\n-------------------------------------------------")
    print("Running sanity checks...")

    warnings = []
    errors = []

    # Check Bot Control Secret
    secret = settings.recruitai_internal_api_secret
    if not secret or secret == "recruitai-default-bot-secret":
        warnings.append("BOT_CONTROL_API_SECRET is unset or using development fallback.")

    # Check Deepgram
    if not settings.deepgram_api_key:
        warnings.append("DEEPGRAM_API_KEY is not configured; live speech-to-text will be unavailable.")

    # Check Google Meet Bot Email
    if not settings.google_meet_bot_email:
        warnings.append("GOOGLE_MEET_BOT_EMAIL is empty; bot will attempt anonymous join or fallback.")

    # Check Profile Dir
    profile_path = Path(settings.meeting_bot_profile_dir)
    if not profile_path.exists():
        warnings.append(f"MEETING_BOT_PROFILE_DIR '{profile_path}' does not exist yet (will be created at first run).")

    # Audio device query (safe check, non-fatal)
    try:
        import sounddevice as sd
        devices = sd.query_devices()
        print(f"  [OK] sounddevice detected {len(devices)} host audio devices.")
    except Exception as e:
        warnings.append(f"Audio device query warning: {e}")

    print("-------------------------------------------------")
    if errors:
        print("[-] Meeting Bot validation FAILED with errors:")
        for err in errors:
            print(f"   - {err}")
        sys.exit(1)
    elif warnings:
        print("[!] Meeting Bot validation PASSED with warnings:")
        for warn in warnings:
            print(f"   - {warn}")
        sys.exit(0)
    else:
        print("[OK] All Meeting Bot environment checks PASSED successfully!")
        sys.exit(0)

if __name__ == "__main__":
    main()
