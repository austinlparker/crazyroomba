# Crazy Roomba · All Guts. No Dust.

Revised September 6, 2026: a coherent 30-second household-rebellion commercial using the current 2.10.0 game, 29 moving camera setups, sparse text, a new raspy Charlie performance, and Curbside Riot skate-punk. The creative brief and full narration are in [SCRIPT.md](SCRIPT.md).

## Deliverables

- `exports/promo/crazy-roomba-vertical-promo.mp4` — 1080 × 1920, 60 fps, H.264 / stereo AAC, fast start.
- `exports/promo/crazy-roomba-vertical-share.mp4` — 720 × 1280, 30 fps, smaller sharing copy.
- `exports/promo/poster.jpg` — closing card with the game address.
- `exports/promo/storyboard.jpg` — frames sampled across the finished edit and its camera cuts.
- `exports/promo/captions.srt` and `captions.vtt` — optional English captions.
- `exports/promo/validation.json`, `capture.json`, and `audio-cues.json` — final media measurements, physics evidence, camera changes, cue timing, and source hashes.

The first 30-second cut and its scripts remain in `exports/promo/archive/2026-09-06-30s-v1/`. The previous 36-second version and its editable scripts remain in `exports/promo/archive/2026-09-06-36s/`. The September 5 export remains in `archive/2026-09-05/`. Generated exports and cached speech sources are ignored by Git.

## The edit

| Time        | Picture                                                                       |
| ----------- | ----------------------------------------------------------------------------- |
| 0–1.6 s     | Dry, desaturated vacuum reveal.                                               |
| 1.6–4.8 s   | Fill the bin; color and full-band sound break through on “let’s get radical.” |
| 4.8–6.4 s   | Crane toward the dock and punch in on the actual 1,000-point payout.          |
| 6.4–8.8 s   | Climb the stairs; punch in on the upper landing.                              |
| 8.8–10.6 s  | First-person under-bed push and pan, with a dust pickup.                      |
| 10.6–13.4 s | Take the action outside: rear push, front tracking pan, and drift sweep.      |
| 13.4–15.6 s | Close takeoff, airborne pan, and a landing push.                              |
| 15.6–17.6 s | Reveal the Moon on the announcer’s “freakin’ Moon.”                           |
| 17.6–20.6 s | Lunar launch, airborne sweep, and landing close-up.                           |
| 20.6–22.6 s | Six skins in quick match cuts.                                                |
| 22.6–26.6 s | Three Daily angles while inviting friends to compete.                         |
| 26.6–30 s   | Arcade-box logo, All Guts. No Dust., Play Free, and the game address.         |

`story.js` defines durations, seeds, poses, and controls. `camera.js` defines hard cuts and smoothly moving lenses, camera positions, and pans. Shipping camera collision checks keep furniture out of the sightline; interior and first-person pushes retain the game's native camera path. Stunt coverage keeps a world bearing while the robot spins. Outdoor action uses restrained changing Dutch angles. A little scanline texture, grain, stronger color, and two short tracking tears add a 1990s video finish. End-card text remains crisp above the texture.

The collection and delivery shots are one continuous simulated run played at 1.25×. Simulation still advances in fixed 60 Hz ticks; input and captured event times are mapped to the faster edit. All other gameplay runs at normal speed. Deterministic seed searches find natural pickup routes. No pickups, rewards, or scores are fabricated.

`capture.js` removes the former title slogans, stage labels, edge marks, wipes, and large HUD. Only a small bin meter, the real payout, a single Daily line, and the closing card with the campaign tagline remain. `studio.js` uses the original illuminated turntable and speaker set; the six skins now appear as close match cuts. These display models are promo cinematics, not new playable game objects.

## Audio

Music is **Curbside Riot**, seconds 60–90 of the existing original ElevenLabs Music skate-punk recording, preserving its natural ending. The original prompt calls for 178 BPM power chords, picked bass, live punk drums, and an upbeat 1990s skate-video feel. See [soundtrack provenance](../../public/music/CREDITS.txt).

`voice.json` contains eight connected phrases, replacing the former feature-by-feature calls. One new Charlie / `eleven_v3` performance uses a dry opening and more expressive raspy/shouted directions. It is independently transcribed before phrase export. The first seven phrases use their natural delivery; only the closing brand line is gently compressed to fit. Word-level timestamps align the Moon reveal and announcer echoes. The isolated cache is `exports/promo/source/voice-extreme/`; earlier performances remain in their original cache.

`render.py` starts the music through a narrow mono filter, brakes it just before 3.24 seconds, then opens to the full stereo skate-punk track. Procedural vinyl scrubs resample this original instrumental; no external samples are used. The voice gets light parallel saturation and short echoes on a few emphatic words. Game effects follow actual retimed events, and edit impacts accent camera cuts. The former extra in-game spoken call is removed so one announcer carries the story. Music ducks beneath speech but gets room to drive between phrases.

Two-pass normalization targets −14 LUFS with true-peak headroom. Temporary stems, silent video, and the independent mixed-audio transcript remain in `/tmp/crazy-roomba-promo-210-extreme/`.

## Reproduce

Start Vite:

```sh
npm run dev -- --port 5174 --strictPort
```

Rebuild speech from the verified cache, without API requests:

```sh
python3 scripts/promo/generate-voice.py
```

If the source performance is absent, `--generate` permits synthesis and transcription using `ELEVENLABS_API_KEY` from the environment or ignored `.env`. The key is not stored in media or metadata.

Render and verify with local Chromium, FFmpeg, Pillow, and NumPy:

```sh
UV_CACHE_DIR=/tmp/crazy-roomba-uv \
PLAYWRIGHT_BROWSERS_PATH=/tmp/crazy-roomba-promo/browsers \
uv run --no-project --with playwright --with pillow --with numpy \
python scripts/promo/render.py

python3 scripts/promo/validate.py
```

The renderer uses an isolated browser profile and fixed clock. `--contact` makes a storyboard, `--draft` renders a 540 × 960 / 30 fps review cut, and `--reuse-video` remixes an existing silent render. `--origin` accepts another Vite address. Install Chromium through Playwright if needed. The Metal configuration and fonts target macOS; browser launching needs normal macOS process permissions.

Open `/scripts/promo/watch.html` on the local server for playback and download. All promo assets remain outside the production entry graph.

## Verification

`validate.py` checks full FFmpeg decoding, dimensions, exactly 30 seconds and 1,800 / 900 frames, audio format, MP4 fast start, loudness, true peaks, source hashes, and nonoverlapping speech. It verifies the narrative shot order, multiple camera angles and lens movement, plus actual events for both 360° landings, stairs, the shortcut pickup, a full bin, and the 1,000-point delivery. Final measurements are saved in `exports/promo/validation.json`.
