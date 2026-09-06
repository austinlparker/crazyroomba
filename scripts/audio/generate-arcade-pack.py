#!/usr/bin/env python3
import argparse, base64, hashlib, importlib.util, json, math, subprocess, tempfile, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    "announcer", Path(__file__).with_name("generate-elevenlabs-announcer.py")
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
parser = argparse.ArgumentParser(
    description="Export the cached arcade sound pack. --generate permits paid requests only for missing sources."
)
parser.add_argument("--generate", action="store_true")
parser.add_argument(
    "--cache-dir", type=Path, default=ROOT / ".cache/elevenlabs-announcer/arcade-pack"
)
args = parser.parse_args()
recipe = json.loads(Path(__file__).with_name("arcade-pack.json").read_text())
cache = args.cache_dir
cache.mkdir(parents=True, exist_ok=True)


def voice():
    name = "callouts"
    audio = cache / f"{name}.mp3"
    meta = cache / f"{name}.json"
    if audio.exists() and meta.exists():
        return
    if not args.generate:
        raise SystemExit(
            f"Missing cached {name}; add --generate to permit API requests."
        )
    v = recipe["voice"]
    text = " ".join(f"[{c['direction']}] {c['text'].upper()}" for c in v["cues"])
    payload = {
        "text": text,
        "model_id": v["model"],
        "voice_settings": v["settings"],
        "seed": v["seed"],
    }
    result = m.api(
        f"text-to-speech/{v['id']}/with-timestamps?output_format=mp3_44100_128",
        json.dumps(payload).encode(),
        "application/json",
    )
    audio.write_bytes(base64.b64decode(result.pop("audio_base64")))
    meta.write_text(
        json.dumps({"voice_id": v["id"], "request": payload, **result}, indent=2) + "\n"
    )
    print(name, "generated", audio.stat().st_size, "bytes", flush=True)


def binary(asset):
    name = asset["id"]
    audio = cache / f"{name}.mp3"
    meta = cache / f"{name}.json"
    if audio.exists() and meta.exists():
        return
    if not args.generate:
        raise SystemExit(
            f"Missing cached {name}; add --generate to permit API requests."
        )
    if "kind" in asset:
        endpoint = "music?output_format=mp3_48000_192"
        payload = {
            "prompt": asset["prompt"],
            "music_length_ms": round(asset["seconds"] * 1000),
            "model_id": "music_v2",
            "force_instrumental": True,
        }
    else:
        endpoint = "sound-generation?output_format=mp3_44100_128"
        payload = {
            "text": asset["prompt"],
            "duration_seconds": asset["seconds"],
            "prompt_influence": 0.4,
            "model_id": "eleven_text_to_sound_v2",
            "loop": False,
        }
    request = urllib.request.Request(
        "https://api.elevenlabs.io/v1/" + endpoint,
        data=json.dumps(payload).encode(),
        headers={"xi-api-key": m.key(), "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            data = response.read()
            headers = {
                k: response.headers.get(k)
                for k in ["content-type", "character-cost", "song-id", "request-id"]
                if response.headers.get(k)
            }
    except urllib.error.HTTPError as e:
        raise SystemExit(
            f"{name}: ElevenLabs returned HTTP {e.code}; cached outputs are preserved."
        ) from None
    audio.write_bytes(data)
    meta.write_text(
        json.dumps({"request": payload, "response": headers}, indent=2) + "\n"
    )
    print(name, "generated", len(data), "bytes", flush=True)


with ThreadPoolExecutor(max_workers=2) as pool:
    futures = [pool.submit(voice)] + [
        pool.submit(binary, a)
        for a in [recipe["music"][-1], *recipe["effects"], *recipe["music"][:-1]]
    ]
    for future in futures:
        future.result()

transcript_path = cache / "callouts-transcript.json"
if not transcript_path.exists():
    if not args.generate:
        raise SystemExit(
            "Missing word timings; add --generate to transcribe the source."
        )
    transcript_path.write_text(
        json.dumps(m.transcribe(cache / "callouts.mp3"), indent=2) + "\n"
    )
transcript = json.loads(transcript_path.read_text())
expected = " ".join(c["text"] for c in recipe["voice"]["cues"])
if m.words(transcript["text"]) != m.words(expected):
    raise SystemExit(
        "The source does not match the callout script; inspect its transcript."
    )
recognized = [w for w in transcript["words"] if w["type"] == "word"]
metadata = json.loads((cache / "callouts.json").read_text())
source_text = " ".join(
    f"[{c['direction']}] {c['text'].upper()}" for c in recipe["voice"]["cues"]
)
if (
    metadata["request"]["text"] != source_text
    or metadata["voice_id"] != recipe["voice"]["id"]
    or metadata["request"]["voice_settings"] != recipe["voice"]["settings"]
):
    raise SystemExit(
        "Voice source metadata differs from the recipe; use a new cache directory."
    )

manifest = {
    "version": recipe["version"],
    "provider": "ElevenLabs",
    "effectsModel": "eleven_text_to_sound_v2",
    "musicModel": "music_v2",
    "voiceModel": "eleven_v3",
    "voice": "Charlie",
    "assets": {},
}
voice_manifest = json.loads((ROOT / "public/voice/manifest.json").read_text())
voice_manifest["version"] = recipe["version"]

with tempfile.TemporaryDirectory(prefix="roomba-arcade-audio-") as temporary:
    stage = Path(temporary)
    exports = []

    def export(name, source, effects, duration, kind, destination, extra=None):
        wav = stage / f"{name}.wav"
        mp3 = stage / f"{name}.mp3"
        channels = 1 if kind in ["voice", "effect"] else 2
        bitrate = "96k" if channels == 1 else "128k"
        target, peak = (
            (-16, -2)
            if kind == "voice"
            else (-22, -8)
            if kind == "effect"
            else (-18, -4)
        )
        filters = (
            effects
            + f",afade=t=in:d=0.005,afade=t=out:st={max(0, duration - 0.035)}:d=0.035"
        )
        m.run(
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-af",
            filters,
            "-ar",
            "44100",
            "-ac",
            str(channels),
            str(wav),
        )
        measured = m.run(
            "ffmpeg",
            "-hide_banner",
            "-i",
            str(wav),
            "-af",
            f"loudnorm=I={target}:TP={peak}:LRA=7:print_format=json",
            "-f",
            "null",
            "-",
        ).stderr
        levels = json.JSONDecoder().raw_decode(measured[measured.rfind("{") :])[0]
        if not math.isfinite(float(levels["input_i"])):
            raise SystemExit(f"{name} is silent or too short to measure.")
        normalization = f"loudnorm=I={target}:TP={peak}:LRA=7:measured_I={levels['input_i']}:measured_TP={levels['input_tp']}:measured_LRA={levels['input_lra']}:measured_thresh={levels['input_thresh']}:offset={levels['target_offset']}:linear=true"
        m.run(
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(wav),
            "-af",
            normalization,
            "-ar",
            "44100",
            "-ac",
            str(channels),
            "-c:a",
            "libmp3lame",
            "-b:a",
            bitrate,
            "-map_metadata",
            "-1",
            str(mp3),
        )
        levels = m.measure(mp3)
        probe = json.loads(
            m.run(
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(mp3),
            ).stdout
        )
        actual = float(probe["format"]["duration"])
        if actual > duration + 0.075 or float(levels["input_tp"]) > peak + 1:
            raise SystemExit(f"{name} failed timing or peak checks.")
        data = mp3.read_bytes()
        info = {
            "file": destination,
            "kind": kind,
            "duration": round(actual, 4),
            "size": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
            "integratedLufs": float(levels["input_i"]),
            "truePeakDbtp": float(levels["input_tp"]),
            "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            **(extra or {}),
        }
        manifest["assets"][name] = info
        exports.append((mp3, ROOT / "public" / destination))
        print(
            f"{name}: {actual:.3f}s, {len(data)} bytes, {levels['input_i']} LUFS, {levels['input_tp']} dBTP",
            flush=True,
        )
        return info

    cursor = 0
    for cue in recipe["voice"]["cues"]:
        count = len(m.words(cue["text"]))
        segment = recognized[cursor : cursor + count]
        cursor += count
        if m.words(" ".join(w["text"] for w in segment)) != m.words(cue["text"]):
            raise SystemExit(f"Incorrect word range for {cue['id']}")
        start = max(0, segment[0]["start"] - 0.07)
        end = segment[-1]["end"] + 0.11
        speed = max(1, (end - start) / cue["limit"])
        if speed > 1.35:
            raise SystemExit(f"{cue['id']} needs a faster performance.")
        duration = (end - start) / speed
        effects = f"atrim=start={start}:end={end},asetpts=PTS-STARTPTS,atempo={speed},highpass=f=95,equalizer=f=2400:t=q:w=0.9:g=1.2,acompressor=threshold=0.18:ratio=2:attack=8:release=90"
        info = export(
            cue["id"],
            cache / "callouts.mp3",
            effects,
            duration,
            "voice",
            f"voice/{cue['id']}.mp3",
            {
                "text": cue["text"],
                "sourceStart": start,
                "sourceEnd": end,
                "tempo": speed,
            },
        )
        voice_manifest["voices"][cue["id"]] = {**info, "file": f"{cue['id']}.mp3"}

    for asset in [*recipe["effects"], *recipe["music"]]:
        kind = asset.get("kind", "effect")
        name = asset["id"]
        duration = asset["seconds"]
        meta = json.loads((cache / f"{name}.json").read_text())
        if (
            meta["request"].get("prompt", meta["request"].get("text"))
            != asset["prompt"]
        ):
            raise SystemExit(
                f"{name} source prompt differs; use a new cache directory."
            )
        effects = f"atrim=end={duration},asetpts=PTS-STARTPTS,highpass=f={45 if kind == 'effect' else 30}"
        if kind == "effect":
            effects += ",acompressor=threshold=0.08:ratio=4:attack=1:release=50"
        folder = "music" if kind == "bed" else "audio"
        export(
            name,
            cache / f"{name}.mp3",
            effects,
            duration,
            kind,
            f"{folder}/{name}.mp3",
            {"prompt": asset["prompt"], "model": meta["request"]["model_id"]},
        )

    for source, dest in exports:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(source.read_bytes())
    (ROOT / "public/audio/manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n"
    )
    (ROOT / "public/voice/manifest.json").write_text(
        json.dumps(voice_manifest, indent=2) + "\n"
    )
print(
    "Exported",
    len(exports),
    "new assets. No credentials or source caches are published.",
)
