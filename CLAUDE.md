# Development guide

Crazy Roomba uses TypeScript, Three.js, Vite, and a Cloudflare Worker with D1. The browser starts in `src/main.ts`; the game lives in `src/game`, shared API contracts in `src/shared`, and the server in `worker`.

Read [README.md](README.md), [development instructions](docs/DEVELOPMENT.md), and [architecture](docs/ARCHITECTURE.md) before changing behavior. Use Node.js 24 or newer.

- Run `npm run check` for formatting, asset integrity, unit tests, browser/Worker/test types, production build, startup budgets, and Worker bundling.
- Run `npm run test:api` for API or shared-simulation changes. It owns its temporary local D1 database and server.
- Run `npm run test:browser` for UI, input, audio, or module-loading changes; install the Python browser dependencies described in the development guide.
- Keep simulation and stage data deterministic and free of browser/rendering dependencies. Bump the replay ruleset and package version together when rules or collision layouts change.
- Preserve deployed resource names, saved-data keys, migrations, and stage/skin identifiers during refactors.
- Keep scene, OAuth, garage, board, HUD, and postprocessing imports lazy; do not increase startup budgets to make a regression pass.
- Commit finished public media and provenance manifests. Keep credentials, source-generation caches, local databases and large promotional exports out of Git.

GitHub CI validates changes. Cloudflare deployment uses `npm run deploy`; GitHub Pages is a manually triggered static demo.
