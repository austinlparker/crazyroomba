# 2.1 — The House Party

The Crazy Taxi collection/delivery loop stays. Routes become something the driver discovers at floor level, with tight furniture shortcuts and valuable upstairs pickups.

## Implementation plan

1. **Physical scale and camera.** Use meters consistently: a 36 cm robot, 13 cm tall; 1.45 m/s cruise and a short 3.2 m/s arcade turbo. Replace solid furniture footprints with legs and overhead bodies. Add close bumper chase, first-person sensor view, collision-aware camera placement, automatic camera crouching, and a short dock fly-in.
2. **A vertical route loop.** Build a two-story house at 2.8 m story height. Put a turbo stairway on each side so players can climb one and return down the other. Recharge pads make the mechanic discoverable and keep the upstairs trip viable. Give upstairs dust a 150-point premium. Keep all movement, height transitions, pickups and scoring in the server-shared deterministic rules.
3. **Arcade presentation.** Replace muted apartment styling with yellow/black checker accents, orange and teal furniture, CRTs, arcade cabinets, oversized slanted display type and punchier synthesized cues. Keep touch controls, reduced motion, graphics quality and keyboard navigation. Replace the full map with a nearby radar; retain a dock beacon when carrying cargo.
4. **Version and validate.** Bump replay rules to 2.1.0. Preserve the ruleset on local/AT records and isolate comparable scores. Verify both stair routes, under-furniture clearance, camera clipping, spawn connectivity on both stories, replay equivalence, desktop/mobile rendering and the Cloudflare build.

## Scope

One larger handcrafted house with two floors and multiple loops. Stairs are arcade turbo lanes over continuous collision slopes, with visible treads alongside. They are not a general jumping or rigid-body physics system. The browser uses the same 60 Hz simulation as the Worker. Daily runs remain 90 seconds; Arcade starts at 60 seconds and deliveries add time.

The model dimensions are physically consistent; turbo speed is intentionally exaggerated for the arcade premise. Menu artwork is an exterior cutaway; gameplay stays at robot height. No paid assets or new engine dependencies are required.
