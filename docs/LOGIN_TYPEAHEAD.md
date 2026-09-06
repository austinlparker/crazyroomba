# Login handle suggestions

Use [WAOW typeahead](https://typeahead.waow.tech/docs) for account discovery:

`GET https://typeahead.waow.tech/xrpc/tech.waow.typeahead.searchActors?q=…&limit=5`

The account dialog searches after 400 ms of idle typing, cancels superseded requests, ignores stale responses, and caches recent queries in memory for 60 seconds. Requests time out after five seconds. The browser sends `X-Client: crazy-roomba`, omits credentials and referrer information, and never falls back to Bluesky actor search. No search happens before the account dialog opens. Its code and styles load with the existing lazy identity module.

The combobox supports arrow keys, Enter, Escape and pointer selection. Choosing an account fills its handle; the user then activates Sign in. Display names and handles are rendered as plain text. Missing actors, malformed responses, network errors, timeouts and rate limits leave manual entry available. Closing or replacing the dialog cancels the search and removes its listeners.

This is discovery, not authentication. The service's suggested DID is not used as proof of identity or as a replacement OAuth resolver. `Identity.login()` passes the chosen or manually entered handle to the OAuth SDK for verification. The current `https://bsky.social` handle-to-DID resolver remains unchanged; replacing that separate dependency requires an actual handle resolver, not a typeahead endpoint. OAuth uses `atproto` plus one narrowly scoped game-login RPC permission. The PDS signs a service proof, and the Worker verifies it before establishing a server session for ranked runs. Existing users reconnect once to grant this permission. Guests can practice locally; scores are never written to a PDS. See [verified leaderboard accounts](AUTHENTICATED_LEADERBOARD.md).

Validation: 11 focused tests cover debouncing, query encoding, credential omission, receiver-safe browser fetch, response parsing, cache expiry, cancellation, stale requests, timeouts, HTTP failures and disposal. Browser checks used live WAOW results, arrow/Enter selection, and a stubbed login handler to verify the selected handle without signing into an account. The typeahead code and CSS remain deferred with account sign-in. Current build and bundle measurements are recorded in [validation notes](VALIDATION.md).
