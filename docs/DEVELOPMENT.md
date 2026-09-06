# Development and checks

## Runtime and setup

Use Node.js 24+ (`.node-version`) and `npm ci`. `npm run dev` starts the browser app. The guest experience works without a backend. For API development, run `npm run build`, `npm run db:local`, and `npm run dev:worker`. Vite proxies API requests to that Worker at `127.0.0.1:8787`.

`npm run check` is the same core gate used in CI:

1. Prettier checks supported source, scripts, configs and documents.
2. Asset checks verify every shipped MP3 against its size and SHA-256 manifest, and ensure the package/replay versions agree.
3. Vitest runs game and Worker tests, including SQLite-backed migration/auth/leaderboard checks.
4. TypeScript checks browser source, Worker source, browser tests and Worker tests in separate environments.
5. Vite builds production assets; the bundle guard enforces lazy imports and unchanged 185 KiB gzip / 205 KiB including-font startup budgets.
6. Wrangler bundles the Worker in a dry run, without deploying.

`npm run format` applies repository formatting. Generated binding types, caches, exports and the generated floor-plan SVG are excluded from formatting.

## API integration

After a build, run `npm run test:api`. The runner chooses an available loopback port, applies the real migrations to a new temporary D1 database, starts the Worker, runs the integration test and removes its state. It never uses a remote database. The test waits a real 90 seconds before submitting a Daily replay and verifies identity binding, concurrency/idempotency, rate limits and logout.

To target an already-running local development Worker, use `npm run test:api:running`. Set `TEST_ORIGIN` for another loopback port and `TEST_PERSIST_TO` if that Worker uses a custom local persistence directory. The test refuses public origins and removes only its own account/ticket/score fixtures.

## Browser regression checks

The existing browser checks use Python Playwright. Install them in an ignored local virtual environment:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r tests/requirements.txt
.venv/bin/python -m playwright install chromium
PYTHON=.venv/bin/python npm run test:browser
```

Build once with `npm run build` before running the browser suite. The runner starts and stops Vite automatically. It checks portrait/narrow/landscape touch controls, UTC rollover, missing or throwing Web Audio, blocked-autoplay recovery and actual voice/effect decoding. It also loads the production build, plays all four stages and checks the six-skin garage without using development hooks. `npm run test:browser -- --production-only` runs just that production check. API responses and clocks are local fixtures. Screenshots go to `/tmp/roomba-*-qa`. CI installs Chromium's system dependencies and runs this same suite.

For focused WebKit or additional viewport checks, start Vite and invoke the individual scripts with `--help`. `tests/social.browser.py` additionally exercises live public graph services against local server fixtures; it is a separate opt-in check because it depends on external providers. The real provider consent flow requires a signed-in browser and is not simulated by CI.

## Code boundaries

- `src/game/simulation.ts`, geometry queries and stage data must work identically in Node, the browser and Workers. Do not import DOM, audio or Three.js into these modules.
- Rendering and cosmetics cannot award points. Rules/layout changes require matching `RULESET` and package-version changes so existing tickets and boards remain scoped correctly.
- `src/shared/api.ts` contains transport types only. Browser credentials stay with the OAuth SDK; the Worker owns identity verification and score derivation.
- Keep lazy stage, HUD, postprocessing, account, leaderboard and garage boundaries. The manifest-based bundle guard catches accidental eager imports.
- Save-data keys, stage/skin IDs, database names and migrations are compatibility contracts. A source-directory refactor is not a data migration.

## Assets and tooling

The model gallery, floor-plan renderer, social-card source, audio generation scripts and trailer source are retained under `scripts/`. Their READMEs and public `CREDITS.txt` files document generation. Cached original audio and transcripts make repeat exports possible without paid calls. Missing-cache generation requires an explicit `--generate` flag and `ELEVENLABS_API_KEY` from the environment or ignored `.env`.

Commit the final small media shipped under `public/`, together with provenance manifests. Do not commit `.env*`, `.dev.vars*`, `.cache/`, `.wrangler/`, `.venv/`, build/test outputs or `exports/`. The traffic monitor's local scripts and snapshots live under ignored `.wrangler/traffic-monitor/`.

## Deployment

`npm run deploy` builds, verifies assets and startup budgets, then deploys Cloudflare. Use `npm run check` first and apply any new migrations separately with `npm run db:remote`. `npm run cf:types` regenerates binding types after Wrangler binding changes. CI never applies remote migrations or deploys Cloudflare.

The manually triggered Pages workflow publishes only the static demo. Its `/crazyroomba/` base path remains supported by the Vite configuration.
