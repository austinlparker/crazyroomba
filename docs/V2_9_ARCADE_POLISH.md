# 2.9 arcade polish

The UI uses self-hosted Google Fonts: [Racing Sans One](https://fonts.google.com/specimen/Racing+Sans+One) for the display lettering and [Chakra Petch](https://fonts.google.com/specimen/Chakra+Petch) for controls and labels. The display font uses Google's uppercase subset. Together the WOFF2 files add 14.1 KiB; licenses and source URLs are in `public/fonts/`.

Account panels no longer include the reconnect explanation or sign-in marketing line. Redundant graphics descriptions, radar legends, camera labels and repeated status copy were removed. Stage targets and result prompts are shorter. Keyboard hints disappear after the first 12 seconds outside the tutorial. Functional account, warning and accessibility labels remain.

## Combos and balance

A large yellow combo panel shows the effective full-bin multiplier (2× through 4×), a shrinking deadline meter, an urgent color and a pulse on delivery. A broken combo visibly changes to COMBO LOST with HIT, TOO SLOW or BIN NOT FULL, plus a synthetic voice cue. Deposit text and results use the same effective multiplier. The existing chain bonus still multiplies the separate full-bin payout; the display now makes their combined effect explicit.

Arcade starts with 60 seconds. A full-bin delivery earns up to eight seconds, drawn from a finite 45-second run budget. The exact bonus sequence is 8, 8, 8, 8, 8, 5, 0…; partial bins score without adding time. A run therefore cannot exceed 105 seconds, including under adversarial repeat delivery. Daily remains exactly 90 seconds and Free roam remains intentionally untimed.

Dust stays inactive while carried. Its original spot becomes eligible 18 seconds after delivery, once the player moves more than 2.25 m away or is grounded at another height. Hopping in place cannot force a respawn. The dock must be exited beyond 1.35 m before another deposit. These rules reward traveling a route instead of waiting beside the dock. Simulation/replay rules advance to 2.9.0.

## Furniture and audio

Shared seating supports now meet their cushions and arms, correcting the House sofa's 9.2 cm gap and armchair's 6 cm gap. Backrest tufts follow the tilted upholstery, and a continuous rear frame supports the leaned cushions from behind. Existing footprints and Apartment crawl clearance are preserved.

Dust FM expands from two to six creator-published CC0 recordings, mixing punk/rock with jungle and breakbeats. The first track varies between visits; pause/resume preserves its position. Each selected song streams separately. New recordings are Final Hour, Cheap Speed Think Fast, Shortcuts and Rock City Ransom. Sources, author declarations, processing and hashes are in `docs/archive/CC0_SOUNDTRACK.txt`.

Eight original announcer cues were synthesized offline with Kokoro and processed with a light arcade-radio effect. Only 56 KB of MP3 clips ships, loaded when Play is pressed; no speech model runs or downloads in the game. A 1.5-second intro leads into a synchronized 3–2–1–GO sequence and diagonal countdown visuals. Music ducks beneath speech; pause/mute cancels current cues. The Sound + voice control covers both. Sources, regeneration instructions and clip timings are in `public/voice/` and `scripts/audio/generate-announcer.py`.

## Verification

- 372 tests across 24 files pass, including 12 new balance tests, six seating geometry checks, announcer loading/cancellation and music ducking tests.
- The 90-second local authenticated Worker integration passes ruleset compatibility, replay-derived scores, identity binding, spoofing rejection, duplicate protection, rate limits and logout revocation. No new authentication permissions or schema changes are needed.
- Browser review confirms both fonts load, the menu fits desktop and phone viewports, and combo/loss panels remain visible without horizontal overflow at 390px. The countdown ran with a running AudioContext and cues at 0, 1,500, 2,500, 3,500 and 4,500 ms. The sofa and armchair were inspected from low oblique angles.
- Delayed-start tests confirm changing mode, opening Settings or losing focus cancels the pending start. Play disables immediately; a late asset load cannot start gameplay behind a modal or bypass the selected stage's lock.
- HUD logic, announcer and countdown effects now load on Play. The existing 185 KiB core startup guard remains; a separate 20 KiB font cap and 205 KiB combined cap include the new font cost. Final core startup is 183.4 KiB gzip; combined with fonts it is 197.5 KiB.

Physical mobile/gamepad and Firefox/Safari behavior have not been tested in this pass. Existing OAuth provider-consent testing remains a separate account-level check; the authentication protocol is unchanged.

Deployed as `6d19e2ce-c197-4815-abc4-66bc9373556d`, with 100% traffic on ruleset 2.9.0. All 42 live page/script/style/font/audio assets match the build. Live anonymous ranking requests are rejected; the live menu and lazy HUD/voice loading were checked. No production score or authenticated test session was created.
