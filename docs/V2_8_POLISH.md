# 2.8 account and gameplay polish

Signed-in players now see their Bluesky avatar, name and handle in the header, account panel, results and leaderboard. The avatar remains visible on narrow screens and falls back to an initial when unavailable. Ranked Daily runs require a verified game session; guests can still play a clearly labeled practice run. There is no editable leaderboard callsign.

The Worker verifies a short-lived PDS-signed proof and binds each ticket to that DID. It derives identity from the session and score from the replay, ignoring submitted identity fields. Existing OAuth grants need one reconnect for the game-specific proof permission. No scores are written to a PDS. Scores remain in D1; the proposed Durable Object migration and further social features remain separate work. See [the authentication design](AUTHENTICATED_LEADERBOARD.md).

A finished ranked run is retained temporarily across a sign-in redirect, validated against its original account/ruleset/stage, and reconstructed before posting. Expired sessions switch to reconnect state. Signing out revokes the server session before clearing the account UI.

Dust bunnies now have one soft oatmeal-colored body, short asymmetric ears and a simpler face. Their draw batches decreased from seven to three and geometry from 3,520 to 3,072 triangles. Pickup dimensions and instancing behavior are preserved.

Collisions now rebound according to normal impact speed while preserving glancing movement. A brief spring-like body wobble settles after impact without shaking the camera; reduced-motion preferences disable that wobble. Held throttle against a wall settles instead of producing repeated collision chatter. Replay rules advance to 2.8.0 because bounce changes driving behavior.

## Validation

- 348 tests across 22 files, both TypeScript targets, production build and Worker deployment dry run pass.
- Tests include real ES256/ES256K signatures, SQLite migrations and queries, proof replay races, session expiry/revocation, origin enforcement, anonymous/wrong-account submissions, identity spoofing, pending-run restoration and deterministic collision behavior.
- A real local 90-second Worker integration passed replay-derived scoring, concurrent duplicate protection, rate limits, identity binding and logout revocation. The local fixture was removed afterward.
- Browser checks covered guest practice, restored avatar/handle, the account card, ranked result identity, no editable name, logout, settings and pause controls. The phone header fits at 390px with the avatar visible. Account UI checks used a local-only session fixture; actual provider consent/callback remains to be tested with the user's account.
- Dust was inspected in the model gallery and at gameplay scale. A boosted head-on collision produced approximately 1.25 m/s rebound, 6 cm retreat and 7 degrees of body tilt, then settled; holding throttle did not retrigger bumps over the next three seconds. Reduced-motion mode kept the body flat.
- Initial Apartment plus high-quality effects is 184.6 KiB gzip, below the unchanged 185 KiB guard. Stages, OAuth, skins, leaderboard and secondary garage panels remain separate chunks. The static-model batcher now specializes the generated Float32 geometry; tests compare every attribute against Three's general merger and preserve unsupported formats.
- Version `8579ecd7-62a3-420d-b49b-3f39377f89e9` is live with migration 0002 applied. Live anonymous/origin/HTTP checks pass, and all 24 HTML/JavaScript/CSS files match the build. No production score fixture was created.
- The final built page boots on a fresh Wrangler preview and on the deployed site. An older dev server's disabled asset watcher had returned HTML for new hashed JS paths after rebuilding; restarting the preview resolved that local issue.

No physical mobile/gamepad or Firefox/Safari testing was completed during this pass.
