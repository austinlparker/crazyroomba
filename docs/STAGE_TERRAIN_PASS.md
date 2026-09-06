# Stage geography and sky pass · 2.6.0

All four stages now have more distinct silhouettes. Outdoor elevation is part of the shared simulation, so the driving surface, generated geometry, pickups and replay verification agree.

## Stages

- **Apartment:** stepped footprint, shorter bathroom wing and a usable balcony with low parapets. Interior floors stay level and the original tutorial route remains clear.
- **House Party:** a gateway through the front terrace leads to an offset garden patio with plants and a crawl-under coffee table. The bay, porch, upper balcony and new garden read as separate parts of the footprint. The patio has its own green stone finish.
- **Cul-de-sac:** an irregular fenced perimeter, narrow street entrance, curved turning circle, sloping lawns and driveways. Asphalt, driveway surfaces and road paint follow the terrain. Trees, basketball and hoop have collision footprints. Houses and distant hills frame the driving view.
- **Moonbase:** an irregular crater field with three traversable depressions, raised rims and surrounding ridges. Ground elevation ranges from about **−0.43 m to +0.83 m**, with 25 cm height-field cells. The launch deck and boost ramp remain separate elevated surfaces. Rover tracks and landing paint follow the ground.

## Rendering and driving

- Shared height samples use the same triangle diagonal and interpolation as the rendered terrain. Polygon clipping trims the mesh to the playable perimeter; boundary clearance accounts for the Roomba's radius.
- Ground props and boost pads have flattened foundations. Pickups and moving residents use the sampled ground elevation. Ground slopes can be climbed without boost; boost remains required for upward ramps and stairs.
- Chassis pitch/roll follow slopes. Chase cameras avoid the ground, and the first-person lens follows the local uphill direction instead of looking down toward the far side of a crater.
- Radar uses the actual outdoor outline. Delivery guidance and radar icons distinguish floors from ground elevation, so climbing a hill does not send the player toward the launch ramp.
- Procedural skies provide a pink city horizon, a warm house sunset, daytime clouds and sun over the street, and stars/galactic haze over the Moon. Earth has cloud detail, a shaded surface and an atmosphere glow.
- Distant scenery is hidden in the rotating stage selector to keep the playable silhouette clear. The sky follows camera orientation without translation or visible cubemap seams.
- No new asset downloads or runtime dependencies. Height fields are generated when their stage data loads; terrain geometry stays in the lazy outdoor rendering chunk.

## Validation

- **226 tests across 15 files pass.** New checks compare Three.js ray intersections against simulation height samples, reject cut-away corners, verify pickup/resident grounding and prop foundations, drive through a crater without boost, and check camera clearance, uphill orientation and delivery guidance. Existing 60-seed reachability, replay determinism, stair traversal, model topology/disposal and tutorial checks also pass.
- Browser and Worker TypeScript checks, production build and bundle guards pass. Initial Apartment + high-quality effects + engine + HTML/CSS: **181.0 KiB gzip**, versus 178.2 KiB before this pass and below the unchanged 185 KiB budget. Additional lazy stage JavaScript: House **10.4 KiB**, Cul-de-sac **6.4 KiB**, Moon **7.4 KiB**.
- The local 90-second API integration passes with ruleset 2.6.0: origin/ruleset checks, login-only metadata, time/input validation, server-derived scores, duplicate-submission rejection, persistence and concurrent start-rate limits. Its zero-score leaderboard fixture was removed afterward.
- Browser review covered all four rotating previews, street gameplay, Moon chase and first-person views, the corrected uphill lens direction, and a no-boost crater crossing. The final captured console contained no errors.
- Two stage cycles at fixed menu camera/time returned identical retained geometry/texture counts: Apartment **129/30**, House **286/82**, Cul-de-sac **160/23**, Moon **85/18**. Counts describe those rendered views, not all source meshes.
- A 120-frame Moon first-person sample on this Mac measured **16.7 ms median frame spacing**, **1.1 ms median JavaScript render time**, **1.7 ms p95**, and **98 draw calls** including shadows/effects. This is one desktop view, not a mobile or cross-browser performance claim.
- `git diff --check` passes. No production deployment was made.

The ruleset advances to **2.6.0** because stage geometry and driving heights affect replay outcomes. Previous scores and local unlock progress are retained; daily verification and rankings use the new ruleset. Authentication and leaderboard storage remain unchanged.
