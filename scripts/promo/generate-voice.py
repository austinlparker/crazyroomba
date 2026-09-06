"""Cache one promo-only ElevenLabs performance and export independently verified phrases.

Sources live in exports/promo/source/voice, outside the game and git. --generate
authorizes missing synthesis/transcription requests; ordinary rebuilds are offline.
"""
import argparse
import base64
import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("announcer", ROOT / "scripts/audio/generate-elevenlabs-announcer.py")
audio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audio)
config = json.loads((Path(__file__).parent / "voice.json").read_text())
parser = argparse.ArgumentParser()
parser.add_argument("--generate", action="store_true")
args = parser.parse_args()
cache = config.get("cache", "voice")
assert re.fullmatch(r"[a-z0-9-]+", cache), "Use a plain cache directory name"
out = ROOT / "exports/promo/source" / cache
out.mkdir(parents=True, exist_ok=True)
source = out / "performance.mp3"
metadata = out / "performance.json"
transcript = out / "transcript.json"
payload = {
    "text": "\n\n".join(line["direction"] for line in config["lines"]),
    "model_id": config["model"], "voice_settings": config["settings"], "seed": config["seed"],
}
if not source.exists():
    if not args.generate:
        raise SystemExit("Missing performance; use --generate")
    result = audio.api(f"text-to-speech/{config['voiceId']}/with-timestamps?output_format=mp3_44100_128", json.dumps(payload).encode(), "application/json")
    source.write_bytes(base64.b64decode(result.pop("audio_base64")))
    metadata.write_text(json.dumps({"voiceId": config["voiceId"], "request": payload, **result}, indent=2))
    print("Generated promo announcer performance", flush=True)
cached = json.loads(metadata.read_text())
assert cached["request"] == payload and cached["voiceId"] == config["voiceId"], "Voice config differs from cached source"
if not transcript.exists():
    if not args.generate:
        raise SystemExit("Missing transcript; use --generate")
    transcript.write_text(json.dumps(audio.transcribe(source), indent=2))
recognized = json.loads(transcript.read_text())
words = [w for w in recognized["words"] if w["type"] == "word"]
expected = audio.words(" ".join(line["text"] for line in config["lines"]))
# Hyphenation and the product name can be split differently by ASR.
normalize = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
assert normalize(recognized["text"]) == normalize(" ".join(line["text"] for line in config["lines"])), recognized["text"]
offset = 0
exported = []
for line in config["lines"]:
    segment = []
    while offset < len(words) and normalize(" ".join(w["text"] for w in segment)) != normalize(line["text"]):
        segment.append(words[offset]); offset += 1
    assert normalize(" ".join(w["text"] for w in segment)) == normalize(line["text"]), line
    start = max(0, segment[0]["start"] - .055)
    stop = segment[-1]["end"] + .085
    limit = line["until"] - line["at"]
    speed = max(1, (stop - start) / limit)
    assert speed <= 1.3, f"Phrase {line['id']} too long: {stop-start:.2f}s for {limit:.2f}s; adjust schedule or performance"
    duration = (stop-start) / speed
    target = out / (line["id"] + ".wav")
    filters = f"atrim=start={start}:end={stop},asetpts=PTS-STARTPTS,atempo={speed},highpass=f=90,equalizer=f=2800:t=q:w=1:g=1.5,acompressor=threshold=0.15:ratio=2.5:attack=7:release=100,loudnorm=I=-16:TP=-2:LRA=7,afade=t=in:d=0.008,afade=t=out:st={duration-.025}:d=0.025"
    audio.run("ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(source), "-af", filters, "-ar", "48000", "-ac", "1", str(target))
    exported.append({**line, "file": target.name, "duration": duration, "sourceStart": start, "sourceEnd": stop, "tempo": speed,
        "words": [{"text": w["text"], "at": line["at"] + (w["start"] - start) / speed, "until": line["at"] + (w["end"] - start) / speed} for w in segment]})
    print(f"{line['id']}: {duration:.2f}s at {line['at']:.2f}s (tempo {speed:.2f})", flush=True)
(out / "cues.json").write_text(json.dumps({"voice": config["voice"], "model": config["model"], "lines": exported}, indent=2))
