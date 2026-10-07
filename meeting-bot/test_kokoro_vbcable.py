import numpy as np
import sounddevice as sd
from kokoro import KPipeline

CABLE_INPUT_DEVICE = 15
OUTPUT_SAMPLE_RATE = 48000

print("Loading Kokoro...")
pipeline = KPipeline(lang_code="a")

text = "Hello! This is the RecruitAI AI interviewer. Welcome to your interview."

print("Generating speech...")

audio_chunks = []

for _, _, audio in pipeline(text, voice="af_heart"):
    audio_chunks.append(audio.numpy())

audio_24k = np.concatenate(audio_chunks).astype(np.float32)

print(f"Kokoro audio: {len(audio_24k) / 24000:.2f} seconds")

# Resample 24 kHz → 48 kHz
new_length = int(len(audio_24k) * OUTPUT_SAMPLE_RATE / 24000)

old_positions = np.linspace(0, 1, len(audio_24k))
new_positions = np.linspace(0, 1, new_length)

audio_48k = np.interp(
    new_positions,
    old_positions,
    audio_24k
).astype(np.float32)

print(f"Sending audio to CABLE Input (device {CABLE_INPUT_DEVICE})...")

sd.play(
    audio_48k,
    samplerate=OUTPUT_SAMPLE_RATE,
    device=CABLE_INPUT_DEVICE,
    blocking=True
)

sd.stop()

print("Finished.")