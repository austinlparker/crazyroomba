# Stage expansion · 2.4

For the current gameplay, visual, garage and performance improvements, see [the 2.5 polish report](V2_5_POLISH.md). It supersedes the pending browser checks and initial payload measurements recorded below.

Implemented four stages with a rotating main-screen preview, arcade progression, and six Roomba skins. The copy pass was delegated to `arcade_copy`; implementation and detailed recommendations are in `COPY_PASS.md`.

## Stages

- **Apartment:** an 8 × 7 m plan with living room, kitchenette, bedroom and bathroom. Doorways form a short loop; the table, sofa and bed offer low routes. A cat crosses the living room.
- **House Party:** the existing Alhambra-derived two-story house and its dynamic residents. Existing architectural, stair, camera and household regressions are retained.
- **Cul-de-sac:** a 22 × 22 m footprint with a central road island, driveways, picnic area, parked vehicles and perimeter houses. Dogs and pedestrians cross the racing lines. Vehicle wheels have collision boxes matching their rendered footprints.
- **Moonbase:** a 26 × 24 m base with habitat, rover, solar panels, rocks, Earth overhead and a raised rocket deck. Lower traction and faster boost change handling. The ramp connects both elevations; the visual boost bounce does not alter authoritative collision height.

Arcade targets are 1,000 / 1,800 / 2,600 / 3,600 points. Clearing a target unlocks the next stage and a cosmetic skin. Free roam allows every stage; Daily rotates by UTC date and ignores arcade locks. Skins and progress are saved locally, with no account requirement or purchase flow. Earlier House arcade scores retain access to that stage. Lifetime stats and unlocks survive the 100-run history limit.

## Loading and runtime changes

Each layout and visual module is a dynamic entry. The initial Apartment dependency graph includes neither the house, cul-de-sac, moon, nor OAuth SDK. Only the selected scene owns stage GPU resources; switching removes and disposes the previous geometry/materials/textures. Shared primitives and the renderer load once. Dust uses instancing and shadow resolution is capped at 1024px. High-quality postprocessing is imported separately; Performance skips that import on a fresh load and disposes active effects.

`npm run check:bundle` checks the production manifest and enforces a 185 KiB gzip budget for HTML + CSS + initial Apartment JavaScript + high-quality effects. Current measured total: about 170 KiB. Additional compressed JavaScript after that: House 11.3 KiB, Cul-de-sac 2.2 KiB, Moon 2.4 KiB. These are build measurements, not a measured network waterfall or frame-rate benchmark. The two soundtrack files remain lazy and add no startup audio transfer.

## Validation

The test suite includes all earlier house regressions plus:

- Pickup reachability across 60 seeds per stage (7,440 pickups), at robot clearance on each floor.
- Every new household route at resident height.
- Deterministic replay with interleaved simulations on different stages.
- Apartment tutorial collection and dock delivery; moon ramp ascent/descent.
- Unlock boundaries, legacy migration, practice-score isolation and preservation after 100-run history eviction.
- Finite generated geometry, resource disposal events and skin material isolation. Canvas drawing is mocked for these model tests; they do not validate texture appearance.

Browser and Worker TypeScript, production build, bundle guards, the real 90-second local API integration and Cloudflare deployment dry run are checked separately.

All 201 tests pass. A desktop browser pass checked all four stage previews, arrow selection, arcade lock states and starting Moonbase in Free roam. The Moonbase chase view renders the habitat, rover, launch deck, dust and Earth. Initial module inspection confirmed that other stage worlds and OAuth were absent from the Apartment load.

A repeated GPU-resource check stalled waiting for animation frames in a hidden browser tab. The Mac then locked again, preventing the remaining phone/skin-dialog checks and runtime profiling. The model disposal tests pass, but repeated GPU resource counts and frame-rate measurements remain unverified. See `VALIDATION.md` for the exact scope. No production deployment was made.

## Auth boundary

The PDS score-writing flow and repository write scope were removed per the user's correction. AT OAuth is currently browser login only. The proposed backend session binding, social features and Durable Object leaderboard migration are not part of this stage expansion; D1 continues to verify and store daily scores.
