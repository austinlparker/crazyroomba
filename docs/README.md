# Documentation

## Current guides

- [Development and checks](DEVELOPMENT.md): local setup, CI commands, API/browser tests and asset workflows.
- [Architecture](ARCHITECTURE.md): deterministic rules, scene lifetimes, module boundaries and storage.
- [Authentication](AUTHENTICATED_LEADERBOARD.md): signed proofs, secure sessions and verified replays.
- [Social leaderboards](SOCIAL_LEADERBOARDS.md): World/Following/Mutuals, pagination and relationship verification.
- [Account onboarding](ACCOUNT_ONBOARDING.md) and [handle suggestions](LOGIN_TYPEAHEAD.md).
- [Deployment record](DEPLOYMENT.md): existing Cloudflare resources and dated production checks.
- [Validation record](VALIDATION.md): dated evidence; older counts describe their original revisions.

## Design and release history

These documents preserve the decisions and measurements from each pass. Earlier plans may describe superseded behavior; use the current guides above and the implementation for today's contract.

- [Initial v2 plan](V2_PLAN.md) and [House Party plan](V2_1_PLAN.md).
- [House references](ARCHITECTURE_REFERENCES.md), [floor plan](HOUSE_FLOORPLAN.svg), [house polish](POLISH_PLAN.md), and [engine assessment](ENGINE_ASSESSMENT.md).
- [Four stages](STAGES.md), [terrain pass](STAGE_TERRAIN_PASS.md), and [airtime pass](STAGES_AND_AIRTIME.md).
- [Model pass](MODEL_PASS.md), [copy pass](COPY_PASS.md), and polish reports for [2.5](V2_5_POLISH.md), [2.8](V2_8_POLISH.md), [2.9](V2_9_ARCADE_POLISH.md), and [2.10](V2_10_POLISH.md).
- [Social graph provider survey](SOCIAL_GRAPH_PROVIDERS.md) and its dated probe data under `research/`.

Asset recipes live beside their tools: [social card](../scripts/social-card/README.md), [trailer](../scripts/promo/README.md), and public audio/music/voice credits. The retired game implementation lives in Git history.
