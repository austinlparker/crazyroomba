# Historical validation before the repository cleanup

These are dated reports for earlier revisions, including retired tests and media. Current results are in [the validation guide](../VALIDATION.md).

## 2.7.0 stage and movement pass

240 tests pass across 16 files, together with the browser/Worker build and unchanged 185 KiB startup guard. A local 90-second API test accepts hop input and verifies server replay and concurrent submission protection. Stage traversal, ramp launches, camera framing and phone controls were reviewed in a separate browser tab. [Detailed changes and measurements](../STAGES_AND_AIRTIME.md).

# Validation · September 5, 2026

## Constellation and Daily standings

**428 tests pass** across 26 files. Both TypeScript targets, production build and startup guard pass: **183.7 KiB gzip**, or **197.8 KiB** with fonts. New coverage includes graph discovery/hydration, historical fallback, block exclusions, deletion/refollow, pagination/budgets, idempotent score submission, and standing scans. A real local 90-second API test passes. Local Chromium checks exercise actual Constellation/Slingshot/Bluesky requests and the App finish → automatic score submission → mutuals rank flow. Desktop, 390 px and 320 px layouts, best-daily labels, adjacent players, opening/returning from Mutuals, rank-only retry, solo copy, bounded continuation and signed-out states pass. Temporary sessions/scores/tickets are cleaned up. [Behavior and boundaries](../SOCIAL_LEADERBOARDS.md).

## Earlier social leaderboard pass (ruleset 2.9.0 unchanged)

**394 tests pass** across 24 files. Both TypeScript targets, production build and unchanged startup guard pass: **183.5 KiB gzip**, or **197.6 KiB** including fonts. Social boards are lazy and add no OAuth permissions. A real local 90-second API integration passes. Isolated Chromium checks pass for live public-graph filtering, best-score/self rows, desktop and 390/320 px layouts, fast filter races, sparse pagination, retry, closing during a request, and signed-out prompts. The Worker successfully reads a real DID document and rejects an invalid signature. [Feature design and validation](../SOCIAL_LEADERBOARDS.md).

## 2.9 arcade polish

**372 tests pass** across 24 files. Arcade has a tested 105-second maximum, with delayed respawns and dock rearming; Daily still lasts exactly 90 seconds. The local authenticated Worker integration passes. Countdown voice timing, combo/loss feedback, delayed-start cancellation, new fonts and repaired seating were checked in-browser. [Details and boundaries](../V2_9_ARCADE_POLISH.md).

## 2.8 account and gameplay polish

**348 tests pass** across 22 files, both TypeScript targets and the production build pass, and startup remains **184.6 KiB gzip** against the unchanged 185 KiB budget. The real local 90-second authenticated API integration passes. Browser account, guest practice, ranked results, phone avatar, dust and collision checks are complete. [Detailed scope, checks and remaining limits](../V2_8_POLISH.md).

Earlier sections below record validation of preceding releases; current deployment details are in [DEPLOYMENT.md](../DEPLOYMENT.md).

## Preview depth fix

The rotating previews were using the driving camera's 2.5 cm near plane even at Moonbase's approximately 76 m desktop viewing distance. Thin terrain finishes consequently competed for the same 24-bit depth values. Preview clipping now follows the actual camera distance and a padded stage envelope; gameplay restores its original close range immediately. The far plane also expands for the most distant portrait framing.

All four desktop previews were visually checked, including an identical-angle Moonbase comparison. Camera regression checks resolve 2 mm surface details across all four stage scales at desktop, square, 390 × 844 and 320 × 980 aspect ratios, while retaining near/far clearance. Chase and first-person gameplay restore the 2.5 cm near plane. **256 tests pass**, the build and Worker dry run pass, and startup remains **183.9 KiB gzip**. The fix is deployed to the existing URL; ruleset and scoring are unchanged.

## Production deployment

**251 tests pass** across 17 files, both TypeScript targets and the production build pass, and startup remains **183.9 KiB gzip** against the unchanged 185 KiB budget. Ruleset 2.7.0 is deployed to [Cloudflare Workers](https://crazy-roomba-v2.austin-855.workers.dev/), with its production D1 migration applied.

A real 90-second production run passed replay-derived scoring, malformed input rejection, early submission rejection, concurrent duplicate protection and leaderboard persistence. The QA score and ticket were removed afterward. All production JavaScript/CSS assets match the local build. All four stage previews and Moonbase gameplay were checked in the browser without runtime errors. See [deployment details](../DEPLOYMENT.md).

## Current stage-geography validation

**226 tests pass**, both TypeScript targets and the production build pass, and startup is **181.0 KiB gzip**. All four stage previews, outdoor driving views and first-person terrain clearance were reviewed in the browser. Shared height-map/rendering checks, deterministic replays, local API integration and repeatable resource counts pass. See [stage geography, skies and measured results](../STAGE_TERRAIN_PASS.md).

## Earlier model-overhaul validation

**215 tests pass**, both TypeScript targets and production build pass, and the startup payload is **178.2 KiB gzip**. All four stages and the close-up model gallery were visually reviewed. New checks cover robot dimensions, furniture clearance, animated foot placement and transformed model batching. See [model changes and measured results](../MODEL_PASS.md).

## Earlier 2.5 gameplay-polish validation

**208 tests pass**, both TypeScript targets and production build pass, and startup remains within budget at **173.0 KiB gzip**. The real local API integration and Cloudflare dry run also pass. Desktop/phone/landscape and skin interaction checks are now complete; repeated stage swaps returned to stable GPU resource counts. Full scope, measurements, and remaining device limits are in [the 2.5 polish report](../V2_5_POLISH.md).

The sections below retain the earlier 2.4 findings for historical context. Their pending browser checks were subsequently completed in 2.5.

## Earlier 2.4 checks

- **201 tests pass** across 12 files, including 61 inherited v1 tests, music/preferences, the house simulation/architecture/camera/stair/resident tests, and new stage/progression/model tests.
- New stage tests check 7,440 reachable pickups across 60 seeds per stage, resident routes, deterministic interleaved replay, the Apartment tutorial, Moonbase ramp ascent/descent, unlock thresholds, practice-score isolation, old-save migration and lifetime progress after history eviction.
- Model tests check finite geometry, disposal events and skin material isolation. Canvas 2D drawing is mocked: these are not texture-appearance or GPU tests.
- Browser TypeScript, Worker TypeScript and the Vite production build pass.
- Production manifest guards pass: stages, OAuth and postprocessing remain lazy. Initial Apartment + high-quality effects + engine + HTML/CSS is **170.0 KiB gzip**, below the 185 KiB budget. Additional stage JavaScript: House 11.3 KiB, Cul-de-sac 2.2 KiB, Moonbase 2.4 KiB. Audio adds no initial transfer. These are build measurements, not a network waterfall.
- Cloudflare deployment dry run passes with static assets, D1 binding and a 51.85 KiB Worker bundle (13.97 KiB gzip).
- A real local D1-backed 90-second API integration passes with ruleset 2.4.0 and the rotating stage verifier: origin enforcement, login-only metadata scope, dates/rulesets, early submission, name validation, short/impossible replays, server-derived scores, concurrent duplicate rejection and leaderboard persistence. Its local score fixture was removed afterward.
- The concurrent 35-request start check issues exactly 30 tickets and five rate-limit responses.
- `git diff --check` passes.

## Earlier 2.4 browser review

The Codex in-app Chromium browser was available temporarily during this pass:

- Visually checked Apartment, House Party, Cul-de-sac and Moonbase previews at 1280 × 720. The large title, mode controls, stage arrows, lock conditions and Play button fit the desktop menu. Arrow selection changes the displayed stage and its lock state.
- Started the locked Moonbase through Free roam. The fly-in completes into a close chase view with the stage's habitat, rover, launch deck, Earth, pickups and gameplay HUD.
- Initial browser resource inspection showed Apartment/common visual modules and high-quality effects; the other stage worlds and OAuth were absent before selection.
- No runtime errors were captured in the monitored Moonbase segment.

The repeated stage/GPU check stalled on animation frames in a hidden tab. The Mac locked again before responsive menu/skin interaction checks and profiling could finish. Do not treat the source-level disposal tests as proof of stable GPU counts. Fresh 390 × 844 and short-landscape checks of the 2.4 selector and Skins dialog, a complete pointer-driven skin unlock/equip check, and a measured frame-rate/resource comparison remain pending. The final migration/stats/reduced-motion edits typecheck and pass the full suite; they were not visually rechecked after the lock.

## Earlier house and soundtrack checks

The earlier 2.3 pass checked the Alhambra-derived two-story house, room finishes, resident movement, wall-side dock, both stairs, chase/first-person cameras, under-bed clearance, tutorial collection/delivery, pause and free-roam results. It also checked a 390 × 844 touch HUD and joystick. Those findings apply to the retained house implementation, not to the newly changed 2.4 menu and skin dialog.

The soundtrack pass verified both creators' CC0 declarations and recorded sources, credits, hashes and conversion details in `docs/archive/CC0_SOUNDTRACK.txt`. Both bundled MP3s fully decode. Flesh and Blood measures -18.3 LUFS / -8.3 dBFS true peak; Downtown Destruction measures -18.4 LUFS / -8.0 dBFS. Combined payload is 2.07 MB.

Earlier browser playback checks covered preview/start, pause and retained position, music mute independent of sound effects, persisted volume, automatic next-track playback and window-blur pause. The 74.18-second second track advanced without media errors. Radio/dialog controls fit a 390px emulated viewport during that pass.

## Practical limits

- Production deployment and the live leaderboard are verified. A complete provider OAuth authorization/callback still requires a signed-in user test.
- The game requests `atproto` plus one game-specific RPC proof permission and never writes scores to a PDS. Verified account identity is now enforced by the backend. The leaderboard remains in D1. Following and Mutuals filters use Constellation/Slingshot with a public Bluesky fallback for historical follows and exclusions; the proposed Durable Object migration is not implemented.
- Daily replay verification establishes consistency with game rules, not human play. Signed proofs establish account identity.
- No physical mobile/gamepad, Firefox or Safari testing was completed.
- Vite's standard 500 kB advisory remains for the 527 kB Three.js module (132.8 kB gzip). The gzip startup budget passes; no warning threshold was raised to conceal it.
