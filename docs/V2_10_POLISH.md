# 2.10 polish pass

Seven dedicated reviews covered engine, models, UI/UX, copy, audio, gameplay and architecture. The resulting changes preserve the four stages, progression, five custom songs, Overdrive menu theme and UTC Daily rotation.

| Area         | Result                                                                                                                                                                                                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine       | Time-based boost FOV behaves consistently across refresh rates. Camera cuts and reduced motion settle immediately; OS motion changes apply live. Renderer and postprocessing buffers follow display density. Camera collision checks avoid per-obstacle allocations.                                |
| Models       | Restrained wood grain and anisotropic texture filtering improve floor-level views. Books rest on shelves with attached spine details and page edges. Fixtures share coherent chrome and ceramic finishes. Moon review models reuse the game's solid basalt builder.                                 |
| UI/UX        | Results actions fit on one line at 390 px and stack at 320 px. Phone settings show touch instructions first with a keyboard/gamepad disclosure. Dialog navigation covers visible controls, escaped focus, sliders, Escape and stale autofocus callbacks.                                            |
| Copy         | Controls, tutorial delivery guidance, local-stat persistence and Daily posting/ranking states describe what the game actually does. Mutuals and local leaderboard fallbacks have clearer explanations. The README's obsolete Arcade timing description is corrected.                                |
| Audio        | Missing, throwing or closed Web Audio no longer prevents play. Suspended contexts skip short cues, the radio reports/retries blocked playback, and stale play promises cannot erase media errors. Stopped oscillators and gains disconnect immediately.                                             |
| Gameplay     | A fresh hop press is buffered for six active ticks and consumed once after landing; held inputs never repeat and stairs clear the request. Braking below the near-miss speed threshold cancels that pass.                                                                                           |
| Architecture | Malformed saved entries are isolated so valid history and preferences survive. Invalid JSON is distinct from unavailable storage; reading never rewrites saved data. API failures retain HTTP status even when an error body is missing or broken, while cancellation and timeouts remain distinct. |

## Deterministic rules

`RULESET` and the package version are **2.10.0** because hop timing and near-miss eligibility affect replay results. Browser and Worker use the same implementation. Daily tickets and leaderboard queries remain ruleset-scoped; historical database rows are retained and no migration is required. Device unlocks and valid local history remain intact.

Arcade still starts with 60 seconds. A full five-dust delivery adds up to eight seconds while a shared 45-second bonus budget remains, giving a maximum 105-second shift. Daily remains exactly 90 active seconds without time bonuses. No timing, point value, stage layout or collider was changed beyond the two gameplay fixes above.

## Validation

The local Worker command pins its upstream origin to `http://127.0.0.1:8787`. Without that override, Wrangler inherited the production route and local API requests hit the HTTPS enforcement intended for public hosts. Production routing and HTTPS enforcement are unchanged.

Focused checks cover hop timing at normal and lunar gravity, buffer expiry, stair exits, held-input behavior, continuous near-miss passes and exact Daily replay duration. Camera clipping matched the previous implementation across 2,000 deterministic poses. An isolated Node benchmark over 30,000 house camera checks measured a median 1,328 ms before and 506 ms after; this measures the clipping routine, not game frame rate.

Model review passed in Chromium and WebKit, including near-floor views. The shelf remains eight merged meshes after adding simple book details. UI browser checks cover 390 × 844, 320 × 568, 844 × 390 and 1440 × 900, including keyboard focus and the existing 128 px movement stick. Unavailable-audio browser checks exercise both missing and throwing AudioContext constructors through settings, preview, play, pause/resume, results and Garage, with zero audio downloads and no page errors.

See [deployment verification](DEPLOYMENT.md) for the final combined build, tests and production checks. Repeatable checks include [mobile controls](../tests/mobile-controls.browser.py), [game audio](../tests/game-audio.browser.py), [menu music](../tests/menu-music.browser.py), [unavailable audio](../tests/audio-unavailable.browser.py) and [UTC rotation](../tests/daily-rotation.browser.py). Browser emulation is not a physical-device test.
