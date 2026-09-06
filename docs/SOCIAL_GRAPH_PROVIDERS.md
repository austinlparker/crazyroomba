# Social graph provider decision

Reviewed September 5, 2026 (live probe completed September 6 at 01:44 UTC).

**Choose Constellation for independent AT Protocol relationship discovery, with PDS reads to fill historical gaps.** The initial hybrid integration is now implemented: Constellation discovers incoming follows, Slingshot hydrates their records, and the existing public AppView supplies outgoing follows, historical gaps, and exclusions. See [current behavior](SOCIAL_LEADERBOARDS.md). The full PDS reconciliation plan below remains future work. Scores remain in Cloudflare D1; the previously requested Durable Object migration is separate unfinished work.

Constellation indexes links across applications, rather than limiting us to Bluesky's graph. The official [AT Protocol social graph guide](https://atproto.com/guides/social-graph) specifically points to Microcosm for this use. Reusing an identity does not imply merging every application's follows: initially, Following and Mutuals should continue to mean `app.bsky.graph.follow` relationships. Tangled's separate follow collection could support an explicit future option.

## What the live checks found

The [read-only probe](../scripts/social/probe-providers.mjs) compared two public account pairs and fetched their four reference follow records. [Saved responses](research/social-graph-probe-2026-09-06.json) include exact URLs, status codes, record subjects, and timestamps. No account tokens, writes, or network-wide crawl were involved.

| Source                  | Reference follows found | Observation                                                                      |
| ----------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| Bluesky public AppView  | All four                | Both pairs reported mutual follows.                                              |
| Blacksky public AppView | Three                   | One incoming follow was absent in both forward and reverse relationship queries. |
| Constellation           | One                     | Found the August 2026 follow; three April 2023 follows were absent.              |
| Authors' PDS hosts      | All four                | Each existing record had the expected subject.                                   |
| Slingshot `getRecord`   | All four                | Fetched the already-known record URIs successfully.                              |

This is a diagnostic spot check, **not a network coverage estimate, latency benchmark, or ranking of provider reliability**. Public relationships can change. Direct PDS retrieval establishes what these hosts served at probe time; the script does not independently verify repository signatures.

Constellation's [current API page](https://constellation.microcosm.blue/) still says historical backfill is forthcoming. That is consistent with the observed missing older records, though the probe cannot establish the cause of every missing edge. An empty backlink result therefore cannot establish that two people do not follow each other. A direct replacement would have incorrectly removed both tested pairs from Mutuals.

Slingshot's `listRecords` route returned 404; the author's actual PDS returned a valid paginated result. Knowing how to retrieve a record is different from discovering an unindexed record whose key we do not know.

Reproduce from the repository root with Node's built-in fetch:

```sh
node scripts/social/probe-providers.mjs > /tmp/roomba-graph-probe.json
```

The script records HTTP failures rather than treating every non-200 as fatal: the unsupported Slingshot route is an intentional capability check. Inspect the result before drawing conclusions.

## Alternatives considered

| Service or approach                                                                                                | What it provides                                                                                                                                    | Fit for this game                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Constellation](https://constellation.microcosm.blue/)                                                             | Public backlink queries by target, collection/path, and optional source DIDs.                                                                       | Selected discovery service. Historical completeness needs a companion source.                                                                                                                               |
| [Slingshot](https://slingshot.microcosm.blue/)                                                                     | Public record retrieval and identity resolution/cache.                                                                                              | Useful for hydrating known references; our probe found no repository enumeration route.                                                                                                                     |
| [Blacksky AppView](https://github.com/blacksky-algorithms/atproto)                                                 | Independently operated Bluesky-compatible AppView at `api.blacksky.community`.                                                                      | Real query alternative, confirmed without auth. The observed disagreement prevents treating it as a guaranteed completeness fallback.                                                                       |
| [Direct PDS reads](https://github.com/bluesky-social/atproto/blob/main/lexicons/com/atproto/repo/listRecords.json) | Public, paginated records from an author's repository, up to 100 per request.                                                                       | Source for an author's outgoing follows. Incoming relationships require other repositories or an index.                                                                                                     |
| [Spacedust](https://github.com/at-microcosm/microcosm-rs/blob/main/spacedust/readme.md)                            | Live link events filtered by target.                                                                                                                | Current README documents no replay or delete events. Cannot alone maintain correct unfollow state.                                                                                                          |
| [Jetstream](https://bsky.network/docs/jetstream/)                                                                  | Filtered create/update/delete and account events. Current v2 also documents history and snapshots; historical replay adds authenticated HTTP calls. | Possible later update feed for a small player-only index. More operational work than request-based lookups.                                                                                                 |
| [SkyFeed indexer](https://github.com/skyfeed-dev/indexer), [AppViewLite](https://github.com/alnkesq/AppViewLite)   | Self-hosted indexing/AppView software; configurable graph storage or retrieval.                                                                     | Useful implementation references. No supported public relationship service was established in this survey. Hosting another index is unnecessary for the first social features.                              |
| [Graze](https://help.graze.social/en/category/api-1igtl7z/), [GraphTracks](https://www.graphtracks.com/docs/api)   | Feed/personalization tooling and analytics APIs respectively.                                                                                       | Reviewed documentation did not establish a complete follow-membership API. Follower growth/counts and engagement graphs do not answer mutual membership. No credentials were requested or paid APIs tested. |
| [WAOW typeahead](https://typeahead.waow.tech/docs)                                                                 | Actor search and profile endpoints. Its documentation explicitly excludes caller social-graph state.                                                | Keep using it for login search. Profile hydration is a separate possible use, not a relationship provider.                                                                                                  |

Additional leads included Atlas, the aturi toolkit, Eurosky's deployment stack, and Semble graph-sync tooling. None established an additional supported hosted membership endpoint in this survey. “Not established” does not mean a service cannot offer one privately.

## Proposed Constellation integration

The important operation is whether the signed-in player and a score's author follow one another. We do not need the whole network or everybody's followers.

1. **Cache outgoing follows for game participants.** Resolve each DID's current PDS and paginate `com.atproto.repo.listRecords` for `app.bsky.graph.follow`. Keep record URI, subject DID, refresh time, and explicit completeness state. Bootstrap on demand for the signed-in player and eligible score authors. Give each job a request/time budget and resumable cursor; exhausting that budget means incomplete, not an empty set. Deduplicate jobs and bound concurrency per host.
2. **Use Constellation to discover incoming links.** Query `blue.microcosm.links.getBacklinks` with the viewer as `subject`, `source=app.bsky.graph.follow:subject`, and repeated `did` filters for score authors. Follow cursors and deduplicate records. Fetch known records from their PDS or Slingshot to validate author, collection, key, and subject. A missing index entry remains unknown until repository reconciliation establishes it.
3. **Intersect both directions for Mutuals.** For A and B, check A's outgoing set for B and B's for A. Repository reconciliation supplies the older relationships Constellation may lack. A backlink endpoint finds incoming edges; querying every possible target separately to enumerate A's outgoing follows would cause avoidable request fan-out.
4. **Refresh and remove relationships.** Periodically reconcile participant repositories, retaining the last complete generation while a new one loads. Publish the new generation together, detect account/PDS migration and invalid cursors, and expire stale decisions. An unfinished or failed refresh must not silently assert a negative. A later Jetstream consumer can reduce polling, but must handle deletes, duplicate events, and reconnect gaps. Spacedust's current event stream cannot replace reconciliation.
5. **Preserve exclusions and failure behavior.** Raw follow backlinks do not implement AppView block/list-block or account-availability policy. Resolve these separately before enabling an independent provider. Do not union positive follow results around an exclusion. Keep the existing AppView path until the replacement has tested equivalent exclusions; upstream failure must remain a retryable/incomplete state, never a convincing empty friends list.
6. **Keep the game UI small.** World / Following / Mutuals already express the feature. Keep provider requests on the Worker, bind the viewer to the verified session, keep response bodies bounded and private responses uncached, and add no graph SDK to the initial browser bundle. Return the existing board shape, with a concise loading/retry state when reconciliation is unfinished. OAuth remains login-only; score writes remain in Cloudflare.

This plan makes Constellation useful for discovery across lexicons while repositories establish completeness. It does not remove all upstream dependencies: account identity resolution and each author's hosting provider still matter. For only the current Bluesky social boards, the existing batched AppView lookup remains operationally simpler.

## Before changing the live provider

The provider boundary should represent `following`, `mutual`, `excluded`, and `unknown` explicitly rather than collapsing every result to booleans immediately. Add deterministic coverage for old/new follows, one-way relationships, unfollows, direct and list blocks, deleted accounts, PDS moves, duplicated/repeating cursors, partial scans, rate limits, oversized responses, and timeouts. Compare the resulting filtered boards with the current path before switching. A fallback is acceptable only if it preserves exclusions and does not turn unresolved membership into false.

Research deliverables in this pass are the provider decision, saved public evidence, and reproducible probe. That research-only pass changed no runtime behavior. The subsequent implementation is documented in [Social leaderboards](SOCIAL_LEADERBOARDS.md); OAuth permissions and score storage remain unchanged.
