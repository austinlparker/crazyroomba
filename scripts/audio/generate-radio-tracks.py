#!/usr/bin/env python3
"""Generate once, then normalize cached instrumental songs without further API use."""

import argparse
import hashlib
import importlib.util
import json
import math
import tempfile
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    "audio", Path(__file__).with_name("generate-elevenlabs-announcer.py")
)
audio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audio)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--generate",
        action="store_true",
        help="Permit paid requests for missing sources only",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=ROOT / ".cache/elevenlabs-announcer/radio-tracks",
    )
    args = parser.parse_args()
    recipe = json.loads(Path(__file__).with_name("radio-tracks.json").read_text())
    cache = args.cache_dir
    cache.mkdir(parents=True, exist_ok=True)

    def generate(track):
        name = track["id"]
        source, meta = cache / f"{name}.mp3", cache / f"{name}.json"
        payload = {
            "prompt": track["prompt"],
            "music_length_ms": track["seconds"] * 1000,
            "model_id": recipe["model"],
            "force_instrumental": True,
        }
        if source.exists() and meta.exists():
            if json.loads(meta.read_text())["request"] != payload:
                raise SystemExit(
                    f"{name}: recipe changed; choose a new cache directory."
                )
            return
        if not args.generate:
            raise SystemExit(
                f"{name}: missing source; --generate permits API generation."
            )
        request = urllib.request.Request(
            "https://api.elevenlabs.io/v1/music?output_format=mp3_48000_192",
            data=json.dumps(payload).encode(),
            headers={"xi-api-key": audio.key(), "Content-Type": "application/json"},
        )
        print(f"Generating {name} ({track['seconds']} seconds)…", flush=True)
        try:
            with urllib.request.urlopen(request, timeout=360) as response:
                data = response.read()
                metadata = {
                    k: response.headers.get(k)
                    for k in ("content-type", "character-cost", "song-id", "request-id")
                    if response.headers.get(k)
                }
        except urllib.error.HTTPError as e:
            raise SystemExit(
                f"{name}: HTTP {e.code}; existing sources preserved."
            ) from None
        source.write_bytes(data)
        meta.write_text(
            json.dumps({"request": payload, "response": metadata}, indent=2) + "\n"
        )
        print(f"Generated {name}: {len(data)} bytes", flush=True)

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(generate, recipe["tracks"]))

    manifest = {
        "version": recipe["version"],
        "provider": "ElevenLabs",
        "model": recipe["model"],
        "instrumental": True,
        "tracks": {},
    }
    with tempfile.TemporaryDirectory(prefix="roomba-radio-") as temporary:
        exports = []
        for track in recipe["tracks"]:
            name, seconds = track["id"], track["seconds"]
            source = cache / f"{name}.mp3"
            target = Path(temporary) / f"{name}.mp3"
            filters = f"atrim=end={seconds},asetpts=PTS-STARTPTS,highpass=f=30,afade=t=in:d=0.005,afade=t=out:st={seconds - 0.08}:d=0.08"
            measured = audio.run(
                "ffmpeg",
                "-hide_banner",
                "-i",
                str(source),
                "-af",
                filters + ",loudnorm=I=-18:TP=-4:LRA=9:print_format=json",
                "-f",
                "null",
                "-",
            ).stderr
            levels = json.JSONDecoder().raw_decode(measured[measured.rfind("{") :])[0]
            if not math.isfinite(float(levels["input_i"])):
                raise SystemExit(f"{name}: silent source.")
            norm = f",loudnorm=I=-18:TP=-4:LRA=9:measured_I={levels['input_i']}:measured_TP={levels['input_tp']}:measured_LRA={levels['input_lra']}:measured_thresh={levels['input_thresh']}:offset={levels['target_offset']}:linear=true"
            audio.run(
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(source),
                "-af",
                filters + norm,
                "-ar",
                "44100",
                "-ac",
                "2",
                "-c:a",
                "libmp3lame",
                "-b:a",
                "128k",
                "-map_metadata",
                "-1",
                str(target),
            )
            levels = audio.measure(target)
            probe = json.loads(
                audio.run(
                    "ffprobe",
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "json",
                    str(target),
                ).stdout
            )
            duration = float(probe["format"]["duration"])
            if (
                abs(duration - seconds) > 0.1
                or float(levels["input_tp"]) > -3
                or not -20 <= float(levels["input_i"]) <= -17
            ):
                raise SystemExit(
                    f"{name}: duration or loudness check failed: {duration}, {levels}"
                )
            data = target.read_bytes()
            manifest["tracks"][name] = {
                **track,
                "file": f"{name}.mp3",
                "duration": round(duration, 4),
                "size": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
                "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                "integratedLufs": float(levels["input_i"]),
                "truePeakDbtp": float(levels["input_tp"]),
            }
            exports.append((target, ROOT / "public/music" / target.name))
            print(
                f"{name}: {duration:.2f}s, {levels['input_i']} LUFS, {levels['input_tp']} dBTP",
                flush=True,
            )
        for source, destination in exports:
            destination.write_bytes(source.read_bytes())
        (ROOT / "public/music/manifest.json").write_text(
            json.dumps(manifest, indent=2) + "\n"
        )


if __name__ == "__main__":
    main()
