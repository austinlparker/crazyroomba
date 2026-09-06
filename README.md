# Crazy Roomba

**Small robot. Big shift.** A Crazy Taxi inspired 3D browser game about an overqualified vacuum. Collect dust, fill a five-slot bin, and deliver it to the green dock. A full bin doubles the delivery's points.

**[Play at roomba.aparker.io](https://roomba.aparker.io/)**

## Development

Use **Node.js 24+**; `.node-version` pins the major version used in CI.

```sh
npm ci
npm run dev
```

Open [the local game](http://127.0.0.1:5173). Guests can play without a backend; Daily is local practice until signed in. To use the local Worker and D1 database:

```sh
npm run build
npm run db:local
npm run dev:worker
```

Open [the local Worker](http://127.0.0.1:8787), or run Vite alongside it for hot reload. Vite proxies `/api` and OAuth metadata to the local Worker. The Worker command pins its upstream to loopback so production HTTPS routing cannot redirect local requests.

```sh
npm run check         # Format, assets, unit tests, all types, build, size guard, Worker bundle
npm run test:api      # Starts an isolated local Worker/D1; includes a real 90-second run
npm run test:browser  # Starts Vite; requires Python and Playwright (see development guide)
npm run format       # Format supported source, config, scripts, and documentation
```

See [the development guide](docs/DEVELOPMENT.md) for browser setup, checks, asset generation and contribution boundaries.

## Stages, modes and controls

The garage arrows select Apartment, House Party, Cul-de-sac or Moonbase. Each layout and scene loads on demand. Arcade unlocks stages in order; Free roam and Daily are always available.

| Stage       | Arcade target | Unlocks                  |
| ----------- | ------------: | ------------------------ |
| Apartment   |         1,000 | House Party + Hot Rod    |
| House Party |         1,800 | Cul-de-sac + Night Rider |
| Cul-de-sac  |         2,600 | Moonbase + Lunar Patrol  |
| Moonbase    |         3,600 | Solid Gold               |

Taxi is the starter skin; delivering 25 dust earns Fresh Mint. All six skins are cosmetic. Unlocks and lifetime progress stay on this device independently of the latest 100 recorded runs.

| Mode      | Rules                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arcade    | Start with 60 seconds. Full-bin deliveries add up to 8 seconds, with a 45-second bonus budget and a 105-second maximum shift.                           |
| Daily     | Exactly 90 active seconds. A shared UTC date and seed determine the stage and spawns. Signed-in runs submit a verified replay; guests practice locally. |
| Free roam | Unlimited time. End the run from Pause to save stats.                                                                                                   |
| Tutorial  | An untimed introduction to driving, boost, pickups and delivery.                                                                                        |

| Action          | Keyboard       | Gamepad                | Touch                      |
| --------------- | -------------- | ---------------------- | -------------------------- |
| Drive / reverse | W / S or ↑ / ↓ | Left stick or triggers | Left joystick vertically   |
| Steer           | A / D or ← / → | Left stick             | Left joystick horizontally |
| Boost           | Shift          | A                      | BOOST                      |
| Drift brake     | Space          | B                      | DRIFT                      |
| Hop             | E              | X                      | HOP                        |
| Air spin        | Space + steer  | B + steer              | DRIFT + steer              |
| Pause / resume  | Esc or P       | Start                  | Pause button               |
| Change camera   | C              | —                      | Camera setting in Pause    |

House Party has two stories, crawl routes and turbo stairs; the neighborhood has rolling lawns and kickers; Moonbase has low gravity, craters and a launch deck. Clean moving 360s refill boost, and delivery chains and near misses reward careful driving. Reduced-motion preferences follow the OS. Switching apps pauses a run and clears held inputs.

Daily rotates at **00:00 UTC**. Menus and current boards refresh across midnight or when a sleeping tab returns. A started run keeps its original date, seed and board. World, Following and Mutuals show one best score per account, with daily results highlighting nearby mutuals.

## Sound and visuals

Three.js renders procedural stages, furniture, residents, vehicles and six robot liveries. Geometry and textures are built locally, and fonts are bundled. Performance mode disables shadows and postprocessing. The [development model gallery](http://127.0.0.1:5173/scripts/model-gallery.html) previews the model families while Vite runs.

Dust FM includes the Overdrive menu theme and four original skate-punk, hip-hop, alternative-rock and ska-punk tracks. The announcer has 21 pre-rendered Charlie cues, with eight incidental effects and three score/start/end stings. Music, voice and effects honor the garage/pause settings; the game remains playable if audio is unavailable.

[Music credits](public/music/CREDITS.txt), [voice credits](public/voice/CREDITS.txt) and [effect credits](public/audio/CREDITS.txt) include provenance and regeneration details. Finished assets and their hash manifests are committed. Generation caches, credentials and promotional exports are ignored. Paid generation is opt-in through the scripts' `--generate` option.

## Accounts and verified scores

Sign in with an existing Bluesky or AT Protocol handle, or use “New here? Sign up” to continue to Bluesky account creation. Optional [WAOW typeahead](https://typeahead.waow.tech/docs) suggests handles; the OAuth SDK independently resolves the selected account.

The browser requests `atproto` and a single game-login RPC permission. The Worker verifies a PDS-signed service proof and issues an HttpOnly session. Ranked Daily scores require an account-bound, single-use ticket and a replay of exactly 5,400 fixed simulation ticks. The server derives the score; it never trusts submitted names, DIDs or score values. Scores remain in Cloudflare D1. The game does not write records to a PDS.

[Authentication](docs/AUTHENTICATED_LEADERBOARD.md), [social boards](docs/SOCIAL_LEADERBOARDS.md) and [architecture](docs/ARCHITECTURE.md) explain the contracts and limitations.

## Deployment

The production game uses **Cloudflare Workers + D1**, configured in `wrangler.jsonc`. The custom domain and the existing [Workers URL](https://crazy-roomba-v2.austin-855.workers.dev/) share leaderboard data. Device-local progress and sign-ins are separate for each origin.

```sh
npx wrangler login
npm run db:remote
npm run check
npm run deploy
```

The checked-in configuration targets the existing `ap2` account and `crazy-roomba-v2` database. These deployed resource names stay stable even though the source directory is now `src/game`. For another account, replace the account/database IDs and custom-domain route. Apply both migrations before running the authenticated leaderboard. After changing bindings, regenerate `worker-configuration.d.ts` with `npm run cf:types`.

OAuth metadata and callbacks use the origin being visited. Production requires HTTPS; local OAuth uses `127.0.0.1`. No OAuth client secret is required. [Deployment history and verification](docs/DEPLOYMENT.md).

GitHub Actions runs checks on pull requests and pushes to `main`. The separate **Publish static demo to GitHub Pages** workflow is manual and builds at `/crazyroomba/`; online accounts and Daily submissions require the Cloudflare backend. Pushing a commit does not deploy Cloudflare.

## Repository map

| Path                | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `src/main.ts`       | Browser boot and development-only inspection hook                |
| `src/game/`         | Simulation, rendering, input, audio, UI and colocated unit tests |
| `src/game/stages/`  | Independently loaded stage data and scenes                       |
| `src/shared/api.ts` | Browser/Worker account, ticket and board contracts               |
| `worker/`           | API, proof verification, social graph and server tests           |
| `migrations/`       | Append-only D1 schema migrations                                 |
| `public/`           | Shipped audio, fonts, icons and social preview                   |
| `scripts/`          | Checks, local test services, model/asset/promo tools             |
| `tests/`            | Local API integration and browser regression checks              |
| `docs/`             | Current documentation and dated design/validation history        |

The retired Babylon/Havok implementation is available in Git history. The current source has one game implementation. [Documentation index](docs/README.md).
