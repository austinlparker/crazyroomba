# Cloudflare deployment · September 6, 2026

Live: **[roomba.aparker.io](https://roomba.aparker.io/)**. The [Workers address](https://crazy-roomba-v2.austin-855.workers.dev/) also remains available.

| Resource    | Value                                                                        |
| ----------- | ---------------------------------------------------------------------------- |
| Worker      | `crazy-roomba-v2`                                                            |
| Version     | `63122103-2cf4-4360-8a9d-3bb4f284d3b7`                                       |
| Ruleset     | `2.10.0`                                                                     |
| Account     | `ap2` · `855b76943db29698ef0d3a42430f2f0b`                                   |
| D1 database | `crazy-roomba-v2` · `940229fa-5e97-4546-b816-e17471148af3`                   |
| Migrations  | `0001_leaderboard.sql` and `0002_authenticated_scores.sql`, applied remotely |
| Domain      | `roomba.aparker.io` · active Cloudflare Custom Domain                        |
| Deployed    | September 6, login compatibility fix; verified at 22:50 UTC / 18:50 EDT      |

Wrangler reports a successful deployment of the version above; the live site serves the exact tested build. No migration was needed for 2.10. The existing second migration adds authenticated sessions, proof replay protection and score identity columns; it preserves historical rows. Anonymous scores are excluded from the current board. CI deployment secrets were not configured; the existing GitHub Pages workflow remains a separate static-only build.

## Older PDS login compatibility

The September 6 evening deployment includes the consolidated source cleanup and a fix for login through PDS 0.4.208, reproduced against `rpg.actor`. That PDS rejects service fragments in `getServiceAuth` audiences. The browser now retries its specific audience-validation error once with the game's bare DID; verification accepts only the exact game audiences and login method. The OAuth permission uses a wildcard audience for that single method because the older permission parser drops exact bare-DID scopes. Affected existing accounts need to refresh and reconnect once. [Authentication contract and reproduction](AUTHENTICATED_LEADERBOARD.md).

Validation passed: 477 tests, all four TypeScript configurations, asset integrity, build and startup budgets, Worker dry run, the isolated 90-second API integration, all browser regression suites and all four production stages. Actual old and current AT Protocol permission libraries accept the compatible scope and reject unrelated methods. The reconnect message was visually checked at 390 × 844. Both live origins serve the new metadata and signed-out session response; all 29 deployed HTML, JavaScript and CSS files match the tested build byte for byte. No database migration or production account/score creation was needed. A real affected account must still complete provider consent to confirm its end-to-end login.

## Custom domain

`wrangler.jsonc` attaches `roomba.aparker.io` with `custom_domain: true` and explicitly keeps `workers_dev: true`. The active `aparker.io` zone was verified in the configured `ap2` account before deploying. Wrangler attached the custom domain without DNS or existing Worker conflicts. Public A/AAAA records resolve, HTTPS certificate verification passes for the hostname, and HTTP authentication reads redirect to HTTPS.

OAuth derives its client ID, redirect URL, service DID and proof audience from the request origin. Custom-domain tests exercise the metadata and a signed account exchange, and reject proofs issued for the other hostname in both directions. Session cookies are restricted to each hostname. Existing leaderboard records are shared through the same database; browser login, local progress and preferences are per origin.

Live checks pass for `/client-metadata.json`, `/.well-known/did.json`, `/api/auth-config`, the public leaderboard and signed-out session. Following/Mutuals, run creation, proof exchange and score submission reject unauthenticated requests. All 54 production files match the local build byte for byte on the custom domain. The existing Workers address still returns the game.

An isolated browser loaded all four stage previews, played Moonbase and paused successfully on the custom domain. At 390 px, World/Following/Mutuals and the sign-in dialog worked without JavaScript errors. Screenshots were saved under `/tmp/crazy-roomba-domain-qa/`. Full provider consent remains an account-level check; this smoke test did not sign in as a user or create a production score.

Local domain-change validation: 430 tests across 26 files, browser/Worker type checks, production build, bundle budgets, binding generation and Wrangler deployment dry run pass. Deployment then succeeded with no changed assets or database migrations.

## Link previews

The subsequent social-card deployment changed only `index.html` and added `social/crazy-roomba-v1.jpg`. The 1200 × 630 JPEG is 97,560 bytes and uses the actual game renderer, models and bundled fonts. Static canonical, Open Graph and large Twitter card metadata use the custom domain, with matching titles, descriptions, image dimensions and alt text. The image is referenced only by metadata, outside the game's startup asset graph. [Editable source and regeneration](../scripts/social-card/README.md).

Fresh HTTPS requests using Twitterbot, facebookexternalhit and Cardyb user agents all received HTTP 200 HTML containing the complete metadata and HTTP 200 `image/jpeg` matching the local card. Validation required no JavaScript, cookies or user account. Build, bundle budgets and Worker dry run pass. No posts were created during verification; platforms control when existing previews refresh.

## Login suggestion avatars

WAOW search results now retain HTTPS avatar URLs and display a 40 px picture alongside the display name and handle. Missing or failed images reveal an initial; image errors do not prevent selection. Names remain plain text, invalid image URLs are ignored, and long labels fit narrow screens. The existing debounce, five-result cap and cache remain in place, with no additional profile API request.

Twenty-four account/typeahead tests pass, including avatar URL validation. Browser checks using a real WAOW result pass at 1200, 390 and 320 px with loaded photos and keyboard selection. Local response fixtures cover absent/broken images, long names, unsafe values, clicking the picture and Escape dismissal. Build, unchanged startup budgets and Worker dry run pass. Screenshots are under `/tmp/crazy-roomba-typeahead-qa/`.

After deployment, the same real WAOW photo and keyboard-selection checks passed at all three widths on `roomba.aparker.io`, using a single search request and no account sign-in. Live screenshots are under `/tmp/crazy-roomba-typeahead-live/`.

## ElevenLabs voice and mobile controls

The announcer uses 21 cues from ElevenLabs Charlie / Eleven v3 with exaggerated ’90s arcade delivery. Thirteen new calls react to delivery chains, near misses, clean spins, a full bin, bonus time, the last ten seconds and an existing personal best being beaten. Three READY variants rotate. Shared and event-specific cooldowns limit chatter; priority rules protect countdown and urgent calls. All 21 exported phrases passed independent transcription, with 278,648 total bytes and decoded true peaks no higher than -2.34 dBTP. Opening lines fit the 1.5-second READY window and countdown numbers fit their one-second slots.

Eight generated effects replace the basic synth cues for pickup, docking, collision, recharge, turbo ignition, jumping, landing and near misses. Their 68,996-byte pack has per-effect cooldowns and a maximum of four concurrent effects. Missing samples fall back to synthesis. Three three-second instrumental stings mark GO, large scores/clean stunts and shift completion. They respect music settings and duck beneath speech. Independent ducking reasons keep the radio low until both speech and a sting have ended. “Dust FM: Overdrive” adds a 40-second instrumental with punk guitar, funk bass, breakbeats and scratches to the existing six-song playlist.

Voice/effect/sting packs load only when needed after Play, and only enabled audio groups are fetched. Music streams the selected track. Pause, blur, restart and return-to-garage cancel active sources, including fallback oscillators. Music and sound toggles remain independent. Versioned URLs refresh changed samples. No synthesis service is called by the browser, and the API key is absent from every built asset.

[Base voice generator](../scripts/audio/generate-elevenlabs-announcer.py), [expanded pack generator](../scripts/audio/generate-arcade-pack.py), [recipe](../scripts/audio/arcade-pack.json), [voice credits](../public/voice/CREDITS.txt), [effect/sting credits](../public/audio/CREDITS.txt) and [asset manifest](../public/audio/manifest.json) document provenance, source hashes and processing. The ignored `.cache/elevenlabs-announcer/radical/` and `arcade-pack/` directories preserve original recordings, request metadata and word timings for repeatable exports without further API calls.

The movement stick is now 128 px with an opaque dark base, yellow thumb, directional arrows and a first-use “DRAG TO DRIVE” hint. A short pulse respects reduced motion. The HUD now uses a single segmented bin/combo display with integrated expiry and dock guidance. The minimap and its drawing code are removed. Mobile boost energy appears around the Boost button; the separate speed panel is hidden, and the camera switch moves into Pause. Free Roam omits the infinity clock. Score and clock are compact, with safe-area spacing and smaller type for long scores. Input cleanup releases pointer capture and centers the thumb on pause, blur and cancellation; additional fingers cannot steal an active stick or button.

Real Chromium touch-event and WebKit layout checks pass at 390 × 844, 320 × 568, 844 × 390, 667 × 375 and 568 × 320. They cover stick/button visibility, empty/partial/full bins, active/urgent/lost combos, long scores, HUD overlap, forward/reverse/steering, simultaneous boost, extra fingers, release, cancellation, pause/resume, blur and reduced motion. [Repeatable browser check](../tests/mobile-controls.browser.py): run against Vite with `uv run --with playwright python tests/mobile-controls.browser.py --url http://127.0.0.1:5173/` after installing Playwright Chromium. The layout, state, camera and editable-field checks also pass with `--browser webkit`; the CDP multi-touch/long-press checks run in Chromium. These are browser emulation checks, not physical-device tests. macOS WebKit exposes prefixed user selection but does not emulate iOS native callouts; the iOS-specific callout CSS is included explicitly.

Additional local checks pass for the desktop instruments at 1440 × 900 and tutorial spacing at 568 × 320 and 320 × 568, including climb guidance and reduced-motion combo feedback. Screenshots and state checks are under `/tmp/roomba-hud-qa/`.

Game chrome disables standard and WebKit text selection, native dragging, tap highlights and iOS long-press callouts. Selection/context-menu/drag events are canceled on game surfaces; inputs, editable fields and links are exempt from the event guard. Gameplay touch actions prevent browser gestures without disabling viewport zoom globally. Sign-in text can still be edited and selected, and pause-menu controls retain keyboard focus behavior.

[Repeatable audio browser check](../tests/game-audio.browser.py) uses real Web Audio in Vite at 390 × 844. It verifies all 21 voices and 11 samples decode; nothing downloads before Play; the opening five calls do not overlap; the start sting and new bed play; full-bin and low-time calls trigger correctly; priority interruption and effect limits work; a clean spin triggers speech and a sting; mute, volume zero, pause, results and home clean up the correct sources. It creates no account or backend score. Run with `uv run --with playwright python tests/game-audio.browser.py --url http://127.0.0.1:5173/`. Captured source events and screenshots are under `/tmp/roomba-expanded-qa/`.

Fresh production browsers at 390 × 844 and 568 × 320 verified all 32 voice/effect/sting samples decode after Play, five countdown calls do not overlap, the GO sting plays, Overdrive streams through the actual radio controls, music mute works and pausing cancels active audio. All 33 generated audio files, HTML, emitted JS/CSS, manifests and credits match the final local build byte for byte. No JavaScript errors, synthesis-service requests, account creation or score submission occurred. Live records and screenshots are under `/tmp/roomba-arcade-live/`.

The HUD polish release was also checked on production in Chromium at 390 × 844 and 568 × 320, and WebKit at 390 × 844. Fresh sessions verified the unified display, omitted minimap/mobile speed/infinity clock, selection/context-menu safeguards, camera switching through Pause and clean resume. Chromium additionally verified simultaneous touch drive/boost updates the button’s energy ring and releases cleanly. Production HTML and every emitted JS/CSS file match the local build byte for byte; no page errors or production scores were generated. Live screenshots are under `/tmp/roomba-hud-live/`.

## Overdrive menu theme

Overdrive now loops on the main menu. The initial menu attempts autoplay; a normal menu tap or key press retries playback when browser policy requires activation. A suspended Web Audio context is treated as blocked, even if the media element’s play promise resolves. The Music button on the menu provides immediate mute; saved music enablement and volume are respected, and a muted reload creates no media player or music request.

The 641,192-byte Overdrive file streams separately from the measured JavaScript/font startup budget. One media element and audio graph serve the menu, previews and shifts. Starting a run restores the selected playlist track and disables looping; Pause/Resume retains its position. Preview skips can play other tracks, and closing the preview or returning to the garage restores Overdrive. Hidden/unfocused menus pause; returning to a visible menu resumes the theme, while a paused run stays paused. Voice/effect/sting packs remain lazy until Play.

[Repeatable browser check](../tests/menu-music.browser.py): run against Vite with `--url http://127.0.0.1:5173/`; Chromium supports `--autoplay allowed` and `--autoplay blocked`, and `--browser webkit` checks WebKit. Both Chromium autoplay policies and WebKit pass menu/shift/preview, mute/volume, and one-player checks. Chromium additionally exercises focus/visibility handlers with explicit lifecycle events because headless tabs do not reproduce native tab activation. Menu/shift/preview, mute/volume, blocked-context retry and single-player lifecycle are also covered by the music unit tests. Screenshots are under `/tmp/roomba-menu-music-qa/`.

Fresh production Chromium and WebKit sessions pass menu playback, the first-tap path, preview return to Overdrive, immediate mute, saved mute/volume across reload, one-player playback and shift pause/resume. Permissive Chromium also verifies playback before any gesture. Live checks use Free Roam and create no account or score. No JavaScript errors occurred.

## Expanded Dust FM and UTC Daily rollover

Dust FM now includes four additional 90-second instrumentals generated with ElevenLabs Music: Curbside Riot (skate punk), Kickflip Static (boom-bap hip-hop), Garage Afterburner (alternative rock), and Brass & Burnouts (ska punk). Original arrangement prompts and `force_instrumental: true` produced each source. The final exports measure -18.40 to -18.36 LUFS, with true peaks at or below -4.26 dBTP. Independent transcription found no words in any of the four tracks. They total 5,764,664 bytes and stream individually; the current radio uses only these four songs plus Overdrive, which still loops on the menu.

[Music recipe](../scripts/audio/radio-tracks.json), [cache-first generator](../scripts/audio/generate-radio-tracks.py), [manifest](../public/music/manifest.json) and [credits](../public/music/CREDITS.txt) record provenance, prompts, hashes, levels and regeneration. Source recordings and request metadata remain in the ignored `.cache/elevenlabs-announcer/radio-tracks/` directory. Default regeneration makes no API requests; `--generate` permits missing-source generation explicitly. No credentials ship to the browser.

Daily stage and seed rotation uses **00:00 UTC**. The server already derived the day in UTC; ticket creation now takes the day and timestamp from one clock reading. New tests cover the exact millisecond boundary, ignored client-supplied dates/seeds/stages, stable same-day tickets, fresh current boards, and completion after midnight on the original board. The API remains `no-store`; previous scores are retained by date. No scheduled job or destructive reset is needed.

A UTC date watcher now updates a visible Daily menu and an open current leaderboard, preserving its social filter. Sleeping tabs catch up when they become visible. Preview stages behind dialogs load when the dialog closes, avoiding work that delays the visible board. Historical result boards and runs in progress keep their original day. Practice starts re-check the date after session and stage loading, including when either crosses midnight; ranked starts keep the server-issued ticket date. The menu displays the UTC reset time.

[Daily browser checks](../tests/daily-rotation.browser.py) use a local Vite server, controlled clock and local-only session/board fixtures in a Pacific-time mobile browser. Chromium and WebKit cover visible midnight rotation, sleeping-tab return, social-filter preservation, historical boards, active-run stability, return to Garage, and midnight during both session and stage loading. Unit tests also cover timezone-equivalent instants, DST dates, leap day, year boundaries and watcher cleanup. The [menu music check](../tests/menu-music.browser.py) now plays all four new tracks, checks their duration and verifies an actual ended event wraps from Brass & Burnouts to Overdrive.

Live deployment checks match all 36 relevant HTML/JS/CSS/music/manifest/credit files byte for byte. Public current-day and previous-day leaderboard responses select the correct distinct stages with `no-store`. Fresh 390 px and 320 px browsers in Pacific time show the same UTC date and stage as the server, and the reset label and board fit without horizontal overflow. No production account or score was created. Screenshots are under `/tmp/roomba-radio-daily-live/`.

Fresh production Chromium and WebKit sessions also play all four new songs, wrap through the custom playlist on a native media-ended event, preserve Overdrive on the menu, and pass mute/volume persistence and shift pause/resume. The Chromium end check plays through at an accelerated rate because the CDN stream exposes no seekable range in that browser; it does not synthesize an ended event. No JavaScript errors occurred. The radio release required no database migration or simulation ruleset change.

## Custom-only playlist

The active playlist and deployed `public/music` directory now contain only the five custom ElevenLabs tracks. The six CC0 MP3s were retired outside the public asset tree, with historical credits retained in `docs/archive/CC0_SOUNDTRACK.txt` for earlier promotional exports. Future promo renders use Overdrive. The menu theme, saved music settings, pause/resume and UTC Daily behavior remain as described above. All 13 music unit tests, both TypeScript targets, the production build and bundle guards pass. The build contains exactly five custom MP3s and no references to retired filenames in emitted JavaScript; the custom recordings are unchanged. The previous full-suite result of 457 tests remains the baseline for the unchanged gameplay and Daily code. Live checks match all 36 relevant build/music/credit files byte for byte, and all six retired URLs no longer serve audio. Fresh Chromium playback verifies exactly the five custom MP3 requests, automatic wrap to Overdrive, menu autoplay, saved mute/volume and shift pause/resume without JavaScript errors. No account or score was created.

## Seven-area polish · 2.10

Dedicated engine, models, UI/UX, copy, audio, gameplay and architecture passes are integrated in this release. [The complete polish report](V2_10_POLISH.md) records the changes and boundaries. Camera motion is consistent across refresh rates, display-density resizing includes bloom buffers, and reduced motion updates live. Furniture details and surface finishes are clearer at floor level. Phone results fit, settings prioritize touch instructions, and keyboard navigation works through disclosures, sliders and dialogs.

Hop presses immediately before landing have a six-tick buffer, and slowing beside a resident cancels a pending near miss. These deterministic changes require ruleset **2.10.0** in both browser and Worker. Historical database rows and valid local unlocks/history remain; no database migration or score deletion occurred. Audio handles unavailable or suspended Web Audio, cleans up stopped sources and preserves meaningful retry states. Malformed saved records no longer discard valid preferences/history, and failed API responses retain their HTTP status. The five custom recordings are unchanged.

The combined 515-test suite, both TypeScript targets, build, size guards and Worker dry run pass. Chromium checks all four stages through driving, both cameras, results and Garage, plus Performance-mode resize and live reduced motion. Touch/HUD regression checks pass at 390, 320 and 568 px in Chromium and 390/568 px in WebKit; the dedicated UI pass also covers 844 px landscape and 1440 px desktop, keyboard focus and asynchronous dialog closure. Real Web Audio checks cover all 21 voices and 11 effects/stings, nonoverlapping countdowns, priorities, ducking and cleanup. Missing/throwing AudioContext scenarios remain playable without audio downloads. UTC rollover, delayed startup and in-progress-run checks pass against the final API code.

A fresh local Worker test completed a real 90-second authenticated Daily and verified replay-derived scoring, identity binding, duplicate handling, rate limits and logout; its local fixtures were removed. The local development command now pins the upstream to loopback, avoiding production-domain HTTPS redirects in local tests while preserving production HTTPS enforcement.

Both Chromium and WebKit pass the complete five-track music lifecycle, including a trusted native `ended` event and resumed next-track playback. The test proves normal-speed progress, then seeks only through a reported seekable range; unseekable Chromium streams use accelerated playback. WebKit's test media backend stalled at an artificial 8× rate with a fully buffered file, so its completion check uses normal-rate playback and a supported seek. This required no application or recording change.

Production serves all 81 tested build, font, image and audio files byte for byte. Fresh Chromium verifies autoplay before interaction, all five custom tracks, native wrap, mute/volume persistence and shift pause/resume. No production accounts or ranked scores were created. The API key is absent from the complete final build.

Live UI checks also pass in Chromium at 390 × 844 and 568 × 320, and WebKit at 390 × 844. Settings disclosures and Escape, UTC dates and social-board prompts, Free Roam, camera switching, results and Garage work without horizontal overflow or JavaScript errors. Screenshots are under `/tmp/roomba-polish-live/`.

## Account onboarding

The account entry now uses **@ Sign in**, with an explicit **Sign in with AT Protocol** heading and recognition that existing Bluesky accounts work. A new signup guide explains the Atmosphere and takes newcomers to Bluesky's account host through the existing OAuth callback. A disclosure on sign-in, signup, and connected-account screens explains public profile/follow usage, game-hosted ranked scores, browser-local progress, and provider-owned password handling. [Current app references and implementation details](ACCOUNT_ONBOARDING.md).

All 518 tests, both TypeScript targets, the production build, size budgets, formatting, and Worker dry run pass. The account copy and CSS remain lazy. Local compiled-browser checks cover 320 × 568, 390 × 844, 568 × 320, and desktop, including keyboard focus wrapping, Escape, blank-handle validation, accessible handle help alongside suggestions, signup/back navigation, provider landing, and cancellation/retry. No account was created or authorization grant approved. Production serves all 81 build files byte for byte, with consistent OAuth metadata, unchanged narrow permissions, and a working signed-out session and public board. The live signup CTA reaches the actual Bluesky account-creation chooser using the production client metadata.

## Verification

- 518 tests across 34 files pass, including voice priority/cooldown, effect/sting lifecycle, game-event selection and overlapping music-ducking coverage. Both TypeScript targets, the production build and unchanged bundle budgets pass. Browser checks are described above.
- Initial Apartment plus high-quality effects: 184.2 KiB gzip, within the unchanged 185 KiB limit. Self-hosted fonts add 14.1 KiB, bringing the combined initial payload to 198.3 KiB. Stage, HUD/announcer, garage, leaderboard, Daily-results and OAuth chunks remain lazy. Daily results add 1.73 KiB gzip of JS and 0.64 KiB of CSS on demand, sharing the existing lazy leaderboard module.
- Worker bundle: 230.14 KiB / 61.67 KiB gzip; reported startup: 8 ms. Signature verification dependencies run only on the server.
- Previous domain and social-card deployments verified their HTML, scripts and images byte for byte. Generated audio now comprises 21 voices, eight effects, three stings and five generated music tracks; all final hashes are recorded in the public manifests.
- Live OAuth metadata, game DID document and proof configuration agree on the production origin and scoped audience.
- Anonymous run creation, score submission and session exchange return 401, including caller-supplied identity fields. Cross-origin mutation returns 403. Public HTTP authentication reads redirect to HTTPS; HTTP session mutation returns 426.
- The live leaderboard responds successfully and was empty during the smoke check. No fake authenticated sessions or scores were created in production.
- The built page boots in a fresh local Wrangler preview and on the deployed site. The live menu loads both new fonts, and starting a run loads the separate HUD and enabled audio packs.
- Local browser checks covered avatar/handle restoration, account card, ranked result identity, phone avatar visibility and logout using a local-only session fixture, removed afterward.
- A real local 90-second authenticated Worker test passed replay-derived scoring, wrong-account rejection, spoofed identity rejection, concurrent duplicate protection, rate limiting and logout revocation. Cryptographic proof exchange is separately covered using signed ES256/ES256K tokens and SQLite.

- Local social checks pass against the actual Constellation, Slingshot and public Bluesky APIs, with temporary local sessions/scores removed afterward. Desktop, 390 px and 320 px layouts, best-score/self rows, sparse paging, fast filter switches, failed-request retry, close cancellation and signed-out prompts pass in isolated Chromium. The actual App finish path automatically posts a locally verified Daily, displays the best-daily rank and adjacent mutuals, and opens/returns from the Mutuals board. Rank retries do not repost; sparse scans, solo states and expired sessions are covered.
- Live phone-browser smoke passes for the three filters, World results and Mutuals sign-in prompt. Internal graph cache paths return 404. Real DID-document lookups reach signature validation and correctly reject an intentionally invalid signature, both locally and in production.

See [the social leaderboard design](SOCIAL_LEADERBOARDS.md), [the arcade polish report](V2_9_ARCADE_POLISH.md) and [the account polish report](V2_8_POLISH.md) and [authentication design](AUTHENTICATED_LEADERBOARD.md) for the current behavior and tests. Earlier production tests from 2.7 verified anonymous replay scoring and music delivery; they are historical and do not constitute a current provider login test.

## Remaining boundaries

A complete provider authorization/callback still requires a user account test. Existing grants need one reconnect to authorize the narrow game-specific identity-proof permission. No PDS score writes are requested. Scores currently use D1. Constellation powers reciprocal follow discovery, Slingshot hydrates records, and the public Bluesky AppView supplies outgoing follows, historical gaps and exclusions. No extra OAuth scope is requested. The requested Durable Object migration remains follow-up work.

For future updates, follow the commands in [the README](../README.md#deployment). Wrangler authentication must have access to the account recorded in `wrangler.jsonc`. If a local Wrangler asset watcher is disabled, restart the preview after building so new hashed files are available.

The earlier CLI credential-refresh failure was resolved by a new Wrangler login on September 6. The restored login and access to the configured account were verified before the custom-domain deployment. Future commands that may refresh OAuth must run with access to Wrangler's credential directory before attempting the exchange, so refreshed credentials can be saved.
