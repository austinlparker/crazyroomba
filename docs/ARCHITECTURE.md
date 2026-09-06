# Architecture and boundaries

## Deterministic game rules

`src/main.ts` boots the single game implementation in `src/game`. `Simulation.step()` advances one 1/60-second tick from a seven-bit input mask. The simulation owns seeded dust generation, collision, charge, pickups, delivery, timers, household movement, hops and airborne rewards. Browser rendering cannot change a score. The Worker imports the same simulation and stage data to replay exactly 5,400 Daily ticks.

`RULESET` and the package version are 2.10.0. Rules or collision-layout changes require a new ruleset; structural refactors do not. Daily stages and seeds are selected by UTC date. A run keeps the date when it started, even if it finishes after midnight. Live menus and current boards refresh through `daily-clock.ts`.

Arcade starts at 60 seconds; full-bin deliveries add up to 8 seconds from a 45-second budget, for a maximum 105-second shift. Daily is always 90 active seconds. Free roam and Tutorial are untimed. Pausing freezes active time; ranked tickets expire after one hour of wall time.

## Levels and rendering

Each `Simulation` receives an explicit `Level`. Stage data has no DOM or Three.js dependency. `level-types.ts` and `navigation.ts` define shared dimensions, floor regions and geometry queries. House data remains in `level.ts`; Apartment, Cul-de-sac and Moonbase have separate modules under `stages/`. Renderer and simulation use the same colliders, ramps and footprint. [House reference and adaptations](ARCHITECTURE_REFERENCES.md) and [generated floor plan](HOUSE_FLOORPLAN.svg).

The stage catalog is small and eager. `loadLevel` and `loadWorld` import only the selected stage; an epoch prevents late loads replacing a newer selection. Old scenes and cached model resources are disposed between stages. Pickups are instanced, static geometry is merged by material, particles are pooled, and graphics quality controls shadows and lazy postprocessing. The garage preview owns and releases its renderer when closed.

Camera collision uses the shared geometry while smoothing and effects remain visual. Touch, keyboard and gamepad controls produce the same deterministic digital mask. The app renders menus at 30 Hz, avoids covered/paused redraws and pauses on focus loss. Reduced-motion settings update live.

## Application and sound

`app.ts` coordinates stage loading, run lifecycle, persistence, account state and lazy dialogs. `app-shell.ts` owns the static menu/HUD markup. `html.ts` provides the shared HTML escaping and number formatting used by template-based panels. Profile pictures and text are escaped; untrusted avatar URLs are restricted to HTTPS.

HUD, leaderboard, Daily results, OAuth, garage preview and postprocessing are separate lazy entries. Only the selected scene enters the startup graph. The bundle check holds the high-quality Apartment load below 185 KiB gzip and 205 KiB including local fonts.

`audio.ts` manages Web Audio availability and fallback effects. `game-audio.ts`, `announcer.ts` and `sample-bank.ts` load the 21 voices and 11 effects/stings on Play, apply priorities/cooldowns, duck music and stop active sounds on pause. `music.ts` streams the selected track, owns menu playback and reports blocked/unavailable playback without preventing play. Request generations keep stale asynchronous playback results from undoing a newer choice.

## Identity and scores

`src/shared/api.ts` defines the account, ticket and leaderboard transport types. The OAuth SDK owns PKCE, DPoP and browser credential storage. The requested scope is `atproto` plus a narrow game-login RPC permission. A PDS-signed, single-use proof exchanges for a 12-hour Secure, HttpOnly session cookie; D1 stores only its token hash. Mutating routes require same-origin requests; public HTTP authentication mutations are rejected. [Authentication contract](AUTHENTICATED_LEADERBOARD.md).

A ranked ticket belongs to the verified account. Score submission requires that same account, a minimum 90 seconds of wall time and a bounded, complete replay. Server-derived identity and score replace caller-supplied fields. A D1 transaction inserts the result and consumes the ticket; retries return the original verified score. This prevents fabricated scores and account impersonation, but cannot prove a human drove the replay.

World, Following and Mutuals show one best score per DID, with deterministic tie ordering and bounded, snapshot-based pagination. Constellation discovers reciprocal follows; Slingshot verifies records, and Bluesky supplies outgoing relationships, exclusions and historical gaps. Short-lived caches retain minimal relationship data. Failed lookups produce retryable errors rather than empty boards. [Social board design](SOCIAL_LEADERBOARDS.md).

## Persistence and deployment

Device storage preserves settings, lifetime progression and the latest 100 non-tutorial runs. Damaged rows are isolated; missing lifetime fields can recover from valid retained history. Existing storage keys, IDs and ruleset metadata remain compatible. Reads never rewrite storage as a side effect.

Cloudflare D1 stores sessions, consumed proofs, run tickets and scores. Migrations preserve historical data; old anonymous scores remain stored but are excluded from verified boards. A daily salted hash of the connecting IP implements the start-rate guard; the application does not store raw IP addresses.

Static assets use asset-first routing. `/api/*`, `/client-metadata.json` and `/.well-known/did.json` pass through the Worker. The deployed Worker/database name `crazy-roomba-v2` remains unchanged. The custom domain and Workers hostname share the backend; local storage and sign-ins remain origin-specific. GitHub Pages is a manual static demo, not the production API.

[Development and checks](DEVELOPMENT.md) · [Deployment history](DEPLOYMENT.md) · [Documentation index](README.md)
