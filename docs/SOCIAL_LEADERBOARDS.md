# Social leaderboards

The Daily board has **World**, **Following**, and **Mutuals** filters. Each account gets one place, using its best score for the selected UTC challenge and current ruleset. Equal scores use the earliest submission, then score ID. Social boards include the signed-in player's own score, highlight it with YOU, and link drivers to their Bluesky profiles.

Following means people the viewer follows, including mutuals. Mutuals require follows in both directions. Both require the game's verified session cookie; a query parameter cannot select another viewer. Guests get a sign-in button. Deleted accounts and reported block relationships are excluded from social matches. These filters describe Bluesky relationships, not an app-private friends list or every AT Protocol application.

## Constellation graph lookup

The Worker uses [Constellation's backlink API](https://constellation.microcosm.blue/) to discover which score authors follow the signed-in player. It calls `blue.microcosm.links.getBacklinks` with the viewer DID as `subject`, `app.bsky.graph.follow:subject` as `source`, and repeated `did` filters limited to eligible score authors. It validates authors, collection, keys, cursor progression, and response size. Pages are deduplicated and followed to the end, with a four-page bound; incomplete scans fail rather than becoming negative membership decisions.

Discovered follow records are hydrated using [Slingshot](https://slingshot.microcosm.blue/)'s `com.atproto.repo.getRecord`. The returned URI, collection, and subject must match. Explicit `RecordNotFound` or a changed subject rejects a stale backlink; gateway errors and timeouts remain retryable. If the AppView supplies a newer refollow key, that record is checked as well. Verification is limited to 40 records and three simultaneous requests per batch.

This is a **hybrid integration**. Bluesky's public [getRelationships](https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/graph/getRelationships.json) still supplies outgoing follows, account/block/list-block exclusions, and historical incoming follows absent from Constellation. A validated Constellation record can establish a reciprocal follow missing from the AppView, but cannot override an exclusion or the absence of an outgoing follow. An empty Constellation response alone never establishes that a historical follow does not exist. The [provider survey](SOCIAL_GRAPH_PROVIDERS.md) includes live evidence of those historical gaps and a future plan for replacing the AppView dependency with repository reconciliation.

No extra OAuth permission, access token, graph SDK, or repository write is needed. All external requests go to fixed service hosts with an identifying User-Agent, manual redirects, bounded JSON bodies, and an eight-second shared deadline per candidate batch. Provider failures return 503 and a retry action. World remains available without graph services.

A 120-second Cloudflare Cache API entry retains only `{did, following, mutual}` per viewer/candidate batch, using a hashed key and a new `constellation-v1` namespace. Its internal HTTP path returns 404. Failed lookups are never cached, cache outages fall back to fresh lookups, and public API responses remain `no-store`. No persistent full graph or new binding is introduced. Relationship changes can take two minutes plus upstream indexing/cache delay to appear.

## Daily results

A completed, signed-in ranked Daily submits its replay automatically. Practice and unfinished runs never submit. The server derives the score and identity and stores one row per ticket. Repeating an owned ticket returns its original verified score (200); the first successful write returns 201. A lost response, retry, or dialog remount cannot overwrite the score or create another row, even after the ticket expires or is cleaned up.

After submission, the lazy results panel scans the same Mutuals board used by the full leaderboard. It displays the player's rank, immediate neighbors, and a button opening Mutuals for that run's UTC challenge date. The rank is based on the player's **best score that day**; if it exceeds the just-finished run, the panel names that best score explicitly. A solo board says “First in your circle” rather than implying other participants have been beaten.

Each interaction scans at most eight pages, stopping once the player and their next neighbor are found, or the board ends. KEEP CHECKING resumes sparse or large boards. An incomplete scan shows no invented rank. Rank retries do not resubmit a saved score. Closing a dialog aborts rank reads and disposes listeners; an already-started score submission is allowed to finish. Account mismatches/expiration lead to sign-in, and stale score cursors can be refreshed. Opening the board after midnight preserves the finished run's date and stage.

## Pagination and load

`GET /api/leaderboard?day=YYYY-MM-DD&scope=world|following|mutuals&cursor=…` returns `{day, stage, scope, viewer, entries, nextCursor}`. An entry adds a one-based `rank` to the existing profile and score fields. Scores remain in the existing D1 store; this feature does not migrate them to a Durable Object. The game ruleset remains 2.9.0, preserving compatible scores and replays.

The SQL ranks best runs before paging. World returns up to 25 players; a social request examines up to 120 players in four concurrent graph batches of up to 30 candidates each and returns up to 25 matches. It continues from the last consumed candidate, so a friend outside the global top 25 remains discoverable. Cursors bind the challenge, scope, viewer, score cutoff timestamp, scan offset, and social rank. They expire after ten minutes; Refresh starts a new snapshot. New scores do not reorder an in-progress scan.

The browser automatically scans sparse pages until it has 25 matches or reaches the end. Each interaction stops after eight pages to bound work on very large boards; MORE resumes without silently omitting lower-ranked friends. If the search is incomplete, the UI says so. Closing the modal or switching filters aborts pending requests. A failed continuation can be retried without losing earlier results. Only World can fall back to the device's best local Daily run, explicitly labeled and without a global rank.

The leaderboard and results controllers and CSS load only when needed. This adds no OAuth SDK or graph dependencies to startup. At substantially higher traffic, best-score materialization and a dedicated relationship cache could replace repeated SQL ranking; full follow-graph ingestion is unnecessary for this feature.

## Checks

- `npm test`: Constellation pagination, hydration, stale/refollow records, provider budgets/failures, results scans, and real SQLite and signed-session tests cover best-run deduplication, ties, viewer binding, outgoing versus reciprocal follows, self inclusion, blocked/deleted accounts, rank/page boundaries, sparse scans, stable score snapshots, expired/mismatched cursors, upstream failures, and cache behavior.
- `npm run build` and `npm run check:bundle`: browser/Worker types, lazy chunks, unchanged startup budgets.
- `TEST_ORIGIN=http://127.0.0.1:8788 npm run test:api`: real local Worker, 90-second replay verification, account binding and cleanup.
- `tests/social.browser.py`: isolated headless browser, local-only session/score fixtures and the real Constellation, Slingshot, and public Bluesky endpoints; desktop and phone layouts; filter races, sparse pagination, retry, close cancellation and guest prompts. It also invokes `daily_results_browser.py` to check the actual App finish/automatic submission/rank flow, phone layouts, best-score labels, board return, and rank retries. It removes its fixtures in `finally`. The command is in the script header. Public account relationships can change, so that live integration check is intentionally separate from deterministic unit tests.

The pass also fixes a Workers runtime incompatibility in DID/profile lookups: `redirect: "manual"` replaces unsupported `redirect: "error"`; non-success redirect responses still fail validation. The live local check fetches a real DID document and rejects an intentionally invalid signature without creating a session.

A real provider consent/callback is still a separate account-level check. The social feature itself uses the already-verified game session and adds no authorization step.
