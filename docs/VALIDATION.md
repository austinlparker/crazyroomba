# Validation · September 6, 2026

## Repository consolidation

The cleanup removes the retired Babylon/Havok game, its 61 obsolete tests, MIDI asset and unused engine/audio/deployment dependencies. The current game moves from `src/v2` to `src/game`; browser/Worker transport types are shared, app markup is separated from lifecycle code, and HTML escaping is centralized. Save keys, stage/skin IDs, migrations, deployed resource names and replay ruleset **2.10.0** are preserved.

- A fresh `npm ci` succeeds on Node 24; npm reports zero known dependency vulnerabilities at install time.
- **457 unit tests pass across 31 files**, covering the current game and server.
- Browser, Worker, browser-test and Worker-test TypeScript checks pass in separate environments. The browser target matches Vite's ES2022 build target.
- All **37 shipped MP3s** match their provenance hashes and byte sizes.
- Production builds and Worker dry-run bundling pass. Startup is **184.4 KiB gzip**, or **198.6 KiB including fonts**, within the existing 185/205 KiB budgets. Stage, account, HUD, leaderboard, garage and postprocessing code remain lazy.
- The isolated local API test passes a real 90-second challenge, account binding, replay derivation, concurrent/idempotent submission, atomic start limits and logout. Its temporary database is removed afterward.
- Chromium checks pass at 390 × 844, 320 × 568 and 844 × 390 for touch input, unified HUD states and controls. UTC rollover, sleeping-tab recovery, retained historical/run dates, unavailable Web Audio, blocked autoplay, sample decoding, music transitions and complete audio cleanup pass.
- The production preview loads and plays **all four stages** through pause, results and Garage. All six skin previews are present, locked equip stays disabled and the preview closes correctly. No failed module loads or page errors occur, and the development inspection hook is absent.
- Python scripts compile, supported files pass Prettier, Markdown file links resolve, and Git whitespace checks pass. Generated exports, credentials, caches, virtual environments and local monitoring state remain ignored.

GitHub CI now runs the core checks, isolated API integration and browser suite on pull requests and pushes to `main`. The static GitHub Pages demo is manual. These checks do not deploy Cloudflare.

## Scope of the evidence

The browser checks use Chromium emulation; this cleanup did not repeat physical-device, WebKit, Firefox or live provider-consent testing. Social graph unit tests use bounded fixtures; the external-provider browser probe remains opt-in. The standard Vite advisory for the Three.js chunk remains visible; startup limits were not increased.

Earlier feature and deployment evidence remains in [deployment history](DEPLOYMENT.md), [the 2.10 polish report](V2_10_POLISH.md), and [historical validation](archive/VALIDATION-BEFORE-CLEANUP.md). Older counts and soundtrack details describe those earlier revisions.
