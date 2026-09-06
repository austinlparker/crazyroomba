#!/usr/bin/env python3
"""Build the announcer MP3s with FFmpeg and cached ElevenLabs speech.

python3 scripts/audio/generate-elevenlabs-announcer.py --cache-dir /path/to/cache
Add --generate to permit paid API requests for missing speech/transcript files.
Use --voice harry to export the alternate performance from the same cache.
ELEVENLABS_API_KEY is read from the environment or the repository's ignored .env.
The key and source audio are never copied to public/.
"""

import argparse
import base64
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]
VOICE = "IKne3meq5aSn9XLyUdCD"
MODEL = "eleven_v3"
SETTINGS = {"stability": 0.0, "similarity_boost": 0.7, "style": 0.75, "use_speaker_boost": True}
BATCHES = {
    "charlie-extreme": "[wildly excited] [raspy shout] LET'S GET RADICAL! [shouting] THREE! TWO! ONE! GO! [taunting] COMBO BUSTED! [shouting] TIME'S UP! [excited] TIME TO CLEAN HOUSE!",
}
# Word ranges use independently recognized speech, excluding expressive prompt tags.
# The tagged TTS alignment can put a cue boundary inside the first syllable.
CUES = {
    "three": ("Three!", "charlie-extreme", 3, 4, 0.85),
    "two": ("Two!", "charlie-extreme", 4, 5, 0.85),
    "one": ("One!", "charlie-extreme", 5, 6, 0.85),
    "go": ("Go!", "charlie-extreme", 6, 7, 0.90),
    "make-a-mess": ("Let's get radical!", "charlie-extreme", 0, 3, 1.42),
    "clean-house": ("Time to clean house!", "charlie-extreme", 11, 15, 1.42),
    "combo-lost": ("Combo busted!", "charlie-extreme", 7, 9, 1.35),
    "times-up": ("Time's up!", "charlie-extreme", 9, 11, 1.35),
}


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


def key():
    value = os.environ.get("ELEVENLABS_API_KEY")
    if not value:
        match = re.search(r"^\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*(.+)$", (ROOT / ".env").read_text(), re.M)
        value = match.group(1).strip().strip("\"'") if match else None
    if not value:
        raise SystemExit("Set ELEVENLABS_API_KEY in the environment or .env.")
    return value


def api(path, body, content_type):
    request = urllib.request.Request(
        "https://api.elevenlabs.io/v1/" + path,
        data=body,
        headers={"xi-api-key": key(), "Content-Type": content_type},
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise SystemExit(f"ElevenLabs returned HTTP {error.code}; cached outputs are preserved.") from None


def transcribe(path):
    boundary = uuid.uuid4().hex
    parts = []
    for name, value in {"model_id": "scribe_v2", "tag_audio_events": "false", "diarize": "false", "language_code": "eng"}.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="announcer.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n'.encode() + path.read_bytes() + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    return api("speech-to-text", b"".join(parts), f"multipart/form-data; boundary={boundary}")


def words(text):
    return re.findall(r"[a-z]+(?:'[a-z]+)?", text.lower().replace("’", "'"))


def measure(path):
    result = run("ffmpeg", "-hide_banner", "-i", str(path), "-af", "loudnorm=I=-16:TP=-2:LRA=7:print_format=json", "-f", "null", "-")
    return json.JSONDecoder().raw_decode(result.stderr[result.stderr.rfind("{"):])[0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", type=Path, required=True)
    parser.add_argument("--voice", choices=["charlie", "harry"], default="charlie")
    parser.add_argument("--generate", action="store_true", help="Permit API requests for missing cached files")
    args = parser.parse_args()
    voice_id = VOICE if args.voice == "charlie" else "SOYHLrjzK2X1ezoPC6cr"
    settings = SETTINGS | {"stability": 0.0 if args.voice == "charlie" else 0.5}
    batch_name = f"{args.voice}-extreme"
    batches = {batch_name: BATCHES["charlie-extreme"]}
    cues = {name: (text, batch_name, first, last, limit) for name, (text, _, first, last, limit) in CUES.items()}
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    transcripts = {}
    for batch, text in batches.items():
        audio_path = args.cache_dir / f"{batch}.mp3"
        metadata_path = args.cache_dir / f"{batch}.json"
        transcript_path = args.cache_dir / f"{batch}-transcript.json"
        if not audio_path.exists() or not metadata_path.exists():
            if not args.generate:
                raise SystemExit(f"Missing cache for {batch}; add --generate to synthesize it.")
            payload = {"text": text, "model_id": MODEL, "voice_settings": settings, "seed": 9096}
            result = api(f"text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_128", json.dumps(payload).encode(), "application/json")
            audio_path.write_bytes(base64.b64decode(result.pop("audio_base64")))
            metadata_path.write_text(json.dumps({"voice_id": voice_id, "request": payload, **result}, indent=2) + "\n")
            print(f"Generated {batch}", flush=True)
        metadata = json.loads(metadata_path.read_text())
        if metadata["voice_id"] != voice_id or metadata["request"]["text"] != text or metadata["request"]["model_id"] != MODEL or metadata["request"]["voice_settings"] != settings:
            raise SystemExit(f"Cache metadata differs for {batch}; use a new cache directory.")
        if not transcript_path.exists():
            if not args.generate:
                raise SystemExit(f"Missing transcript for {batch}; add --generate to recognize it.")
            transcript_path.write_text(json.dumps(transcribe(audio_path), indent=2) + "\n")
        transcript = json.loads(transcript_path.read_text())
        expected = words(re.sub(r"\[[^\]]+\]", "", text))
        if words(transcript["text"]) != expected:
            raise SystemExit(f"Speech differs from the script for {batch}; inspect its cached transcript before exporting.")
        transcripts[batch] = [w for w in transcript["words"] if w["type"] == "word"]
        if len(transcripts[batch]) != len(expected):
            raise SystemExit(f"Unexpected word boundaries for {batch}; inspect cached transcript.")

    output = ROOT / "public/voice"
    manifest = {"provider": "ElevenLabs", "model": MODEL, "voice": args.voice.title(), "voiceId": voice_id, "version": f"eleven-{args.voice}-extreme-1", "sampleRate": 44100, "channels": 1, "bitrate": 96000, "voices": {}}
    # Validate every staged cue before replacing the deployed pack.
    with tempfile.TemporaryDirectory(prefix="roomba-announcer-") as temp:
        staging = Path(temp)
        for name, (text, batch, first, last, limit) in cues.items():
            recognized = transcripts[batch][first:last]
            if words(" ".join(w["text"] for w in recognized)) != words(text):
                raise SystemExit(f"Wrong word range for {name}")
            start = max(0, recognized[0]["start"] - 0.07)
            end = recognized[-1]["end"] + 0.11
            speed = max(1, (end - start) / limit)
            if speed > 1.35:
                raise SystemExit(f"{name} needs a faster performance; refusing excessive time compression.")
            duration = (end - start) / speed
            wav = staging / f"{name}.wav"
            effects = f"atrim=start={start}:end={end},asetpts=PTS-STARTPTS,atempo={speed},highpass=f=95,equalizer=f=2400:t=q:w=0.9:g=1.2,acompressor=threshold=0.18:ratio=2:attack=8:release=90,afade=t=in:d=0.008,afade=t=out:st={duration-0.025}:d=0.025"
            run("ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(args.cache_dir / f"{batch}.mp3"), "-af", effects, "-ar", "44100", "-ac", "1", str(wav))
            levels = measure(wav)
            normalization = f"loudnorm=I=-16:TP=-2:LRA=7:measured_I={levels['input_i']}:measured_TP={levels['input_tp']}:measured_LRA={levels['input_lra']}:measured_thresh={levels['input_thresh']}:offset={levels['target_offset']}:linear=true"
            mp3 = staging / f"{name}.mp3"
            run("ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav), "-af", normalization, "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "96k", "-map_metadata", "-1", str(mp3))
            levels = measure(mp3)
            probe = json.loads(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(mp3)).stdout)
            actual_duration = float(probe["format"]["duration"])
            if actual_duration > limit + 0.07 or not math.isfinite(float(levels["input_i"])) or float(levels["input_tp"]) > -1:
                raise SystemExit(f"Final timing/level check failed for {name}")
            data = mp3.read_bytes()
            manifest["voices"][name] = {"file": mp3.name, "text": text, "sha256": hashlib.sha256(data).hexdigest(), "duration": round(actual_duration, 4), "size": len(data), "integratedLufs": float(levels["input_i"]), "truePeakDbtp": float(levels["input_tp"]), "sourceSha256": hashlib.sha256((args.cache_dir / f"{batch}.mp3").read_bytes()).hexdigest(), "sourceStart": round(start, 4), "sourceEnd": round(end, 4), "tempo": round(speed, 4)}
            print(f"{name}: {actual_duration:.3f}s, {len(data)} bytes, {levels['input_i']} LUFS, {levels['input_tp']} dBTP", flush=True)
        output.mkdir(parents=True, exist_ok=True)
        for name in cues:
            (output / f"{name}.mp3").write_bytes((staging / f"{name}.mp3").read_bytes())
        (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
