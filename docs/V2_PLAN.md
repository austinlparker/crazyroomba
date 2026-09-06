# Crazy Roomba v2 — design and delivery plan

## What v1 established

Babylon.js 7, Havok, TypeScript and Vite power a four-room house. Five-slot dust collection, distance-weighted rewards, dock deliveries, time attack and endless play form the core loop. The leaderboard only uses localStorage. Camera and control tests mostly duplicate formulas instead of exercising runtime code. The reset position is outside the current house bounds; the physics/rendering scale and low camera make navigation difficult.

## Direction: Small robot. Big shift.

Keep the Crazy Taxi delivery loop, with a readable, toy-like sunlit apartment and an arcade dispatch identity: warm cream, ink, electric chartreuse, oversized typography, checker stripes, little robot personality. All models are built in code, so the game loads without external model/texture dependencies.

1. **Core simulation** — shared deterministic 60 Hz model; stable circle/box collisions; responsive differential steering; momentum, handbrake drift and rechargeable boost. Camera-independent input, keyboard, touch and gamepad. Dust rewards grow with distance; full bins earn delivery multipliers.
2. **Presentation** — Three.js WebGL renderer, physically based materials, soft shadows, procedural wood grain and rugs, detailed furniture and robot, animated dust creatures, pickup/deposit particles, subtle bloom, chase and overview cameras, minimap and positional navigation.
3. **Playable modes** — Arcade starts at 60 seconds and deliveries buy time; Daily is a fixed 90-second UTC-seeded challenge with identical spawns and no time bonuses; Free Roam has no clock. Countdown, pause, results, restart, local records and persistent driver stats.
4. **Onboarding** — an interactive, untimed first shift teaches driving, boost, collection and depositing; replayable from the menu. Show keyboard/gamepad/touch controls and settings for sound and rendering quality.
5. **Online** — Cloudflare Worker serves API plus static assets. D1 holds daily leaderboards and one-time run tickets. Server replays compressed input and derives the score instead of trusting a posted score. Anonymous pilot callsigns are clearly unverified. AT Protocol browser OAuth provides optional login and user-triggered game-record writes/reads on the player's PDS, separate from Bluesky posts.
6. **Validation/delivery** — unit tests exercise actual simulation and replay validation; browser smoke tests cover navigation, modes, inputs and mobile UI; production build, local Worker/D1 integration and deployment dry run. Document provisioning, privacy and limits. Actual cloud deployment depends on available account credentials.

## Deliberate boundaries

The first v2 ships one thoughtfully modeled apartment. No multiplayer, paid assets, or procedural level sprawl. Replays prevent fabricated scores, but cannot prevent bots or tool-assisted driving. AT Protocol stats are user-owned records, not proof of a server-verified identity on the anonymous board. Production OAuth requires a stable HTTPS origin. v1 source remains available for reference; v2 is the default entry point.
