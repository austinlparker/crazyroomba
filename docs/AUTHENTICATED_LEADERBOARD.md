# Verified leaderboard accounts

Browser OAuth identifies the player; a short-lived PDS-signed service proof connects that identity to the game server. Scores stay in Cloudflare D1. Nothing writes to the player's repository.

`GET /api/auth-config` returns the current origin's service audience, method, and OAuth scope. The scope includes `atproto` plus one RPC permission for `io.github.austinlparker.crazyroombaLogin`, restricted to the game's DID service. `/.well-known/did.json` publishes that service. Existing sessions with only `atproto` need to authorize this additional permission once.

After OAuth restoration or login, the browser requests `com.atproto.server.getServiceAuth` from its PDS using the returned `audience` and `lxm` and an expiration 60 seconds ahead. It sends that proof to `POST /api/session` in `Authorization: Bearer …`, with a JSON body. The server verifies the issuer's current `#atproto` key, ES256/ES256K signature, audience, method, issue time, expiration and nonce. Proofs last at most two minutes and can be exchanged only once, including concurrent requests.

The resulting session is a random 256-bit token in a Secure, HttpOnly, SameSite=Lax, host-only cookie. D1 stores only its SHA-256 hash, profile snapshot and 12-hour expiration. Local HTTP development uses a separately named cookie. `GET /api/session` returns `{profile, expiresAt}`, or `{profile: null}`. `DELETE /api/session` revokes the stored session and expires the cookie. Every mutating API requires an exact same-origin `Origin` header.

Profile shape: `{did, handle, displayName, avatar}`; `avatar` is a string or null. The server reads the public Bluesky profile using only the verified DID and checks that the response DID matches. Avatar URLs are restricted to HTTPS on `cdn.bsky.app`. Missing profiles fall back to the verified DID. Profile metadata is presentation; the proof's DID establishes account identity.

Both `POST /api/runs` and `POST /api/scores` require the cookie. Tickets record the account DID and return it as `did`; another account cannot submit that run. Submissions derive all identity fields from the server session, ignore caller-supplied names/DIDs/avatars, and calculate the score by replaying all 90 seconds. Completed ranked runs post automatically. Retrying a submitted ticket returns its original verified score, without overwriting it or creating another row. The leaderboard returns `name`, `did`, `handle`, `displayName`, `avatar`, `score`, `deposited`, and `created_at`. Guests can practice locally.

Apply `0002_authenticated_scores.sql` before deploying the new Worker. It adds identity columns and authentication tables without deleting existing scores. Historical anonymous rows remain stored but are excluded from the verified leaderboard.

Validation: `worker/auth.test.ts` signs proofs with both supported curves and runs the actual migration and query SQL through SQLite. It covers signature/claim confusion, issuer keys, proof replay races, cookie expiration and revocation, origin checks, anonymous and account-switch rejection, spoofed identity fields, score derivation, duplicate submissions, and rate limits. `npm run test:api` tests the real local Worker after `npm run db:local`; its temporary sessions are inserted through local-only Wrangler SQL and removed with their own score/ticket fixtures afterward. There is no test-auth endpoint or production bypass. Real OAuth consent remains an account-level browser check.

Protocol references: [inter-service authentication](https://atproto.com/specs/xrpc), [RPC permission scopes](https://atproto.com/specs/permission), [DID signing keys](https://atproto.com/specs/did), and the [PDS getServiceAuth implementation](https://github.com/bluesky-social/atproto/blob/main/packages/pds/src/api/com/atproto/server/getServiceAuth.ts).

Social filters use this same verified session without expanding OAuth scope. World is public; Following and Mutuals require a valid cookie and derive the viewer from that cookie. Each DID gets one best run per day/ruleset, with paginated ranks. See [social leaderboards](SOCIAL_LEADERBOARDS.md) for relationship lookup, cache and pagination details.
