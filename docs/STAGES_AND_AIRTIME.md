# Stages and airtime · 2.7.0

This pass addresses the uneven road, fenced outdoor arenas, discontinuous third-person steering, and ground-locked movement.

## Plan and implementation

1. Separate the street surface from landscape relief. The asphalt outline is shared with the terrain data; a flat shoulder extends beyond it to cover the full interpolation triangles. Asphalt and the two original drives are level. Lawns and jump approaches retain relief.
2. Give each stage a useful route change. Keep indoor dimensions and crawl clearance; expand outdoor geography without scaling the furniture or robot.
3. Add deterministic vertical motion and repair presentation separately. Steering eases into an angular velocity, the renderer interpolates fixed-step poses, and the chase rig uses one heading for both position and aim.
4. Verify geometry, traversal, contact, replay compatibility, rendering, and loading size.

## Stage changes

- **Apartment:** a 26 cm crawl hatch links the living room and bedroom. The balcony now has a boost recharge, giving the side route a purpose. Existing bed/table shortcuts remain traversable.
- **House Party:** a second terrace exit connects to the garden through an eastern walk and a cross-path. The garden is now a loop rather than a dead end. There is a recharge on the return route. Boost-driven stair suspension remains engaged on the actual treads.
- **Cul-de-sac:** the playable bounds grow from roughly 24 × 25 m to 48 × 47 m. Four houses sit in connected, playable lots, with porch collision, trees, picnic areas, open paths and two earth kickers. The perimeter fence is removed. The asphalt stays at Y = 0; the surrounding lawns roll. There are 52 pickups, distributed across the court, approach and yards.
- **Moonbase:** the bounds grow from 28 × 24 m to 72 × 64 m. Broad crater fields, a remote habitat, rover, solar array, antenna, basalt outcrops and three launch approaches extend the routes. There are 64 pickups, including nine on the raised launch deck. The perimeter cables are removed, the distant terrain moves outward, and Earth sits farther away. Pickups concentrate in route regions while the surrounding basin remains traversable.

Outdoor stages remain finite courses with an irregular footprint; they are not infinite worlds. Their larger space, connected routes and distant scenery replace the tight fenced-arena presentation.

## Driving and tricks

- **E** hops. On gamepad, use **X**; touch has a **HOP** button.
- Boost into a smooth ramp or a kicker and momentum carries the robot off its lip. Falling off a supported edge also produces free flight.
- Hold **drift + steer** in the air to spin. A completed 360 over a moving jump gives **25 boost** on a clean landing. Tricks do not add leaderboard points. A collision cancels the pending trick; holding hop does not automatically repeat it.
- Flight retains horizontal momentum with limited air steering. Lunar gravity is tuned lower for longer, arcade-style airtime.
- Swept vertical contact handles landings on solid prop tops and stops hops at table undersides and indoor ceilings. Landing settles onto the sampled terrain. Camera height follows the airborne chassis.
- During an airborne spin, the chase camera follows the travel direction so the robot can rotate without whirling the entire view. Ground steering has a short response curve; both model and camera interpolate between simulation poses. Boost exhaustion now has hysteresis instead of oscillating on and off each frame.
- Outdoor shadow coverage follows the driver, keeping local shadows detailed across the larger maps. Boost particles use a soft circular mask and a screen-size cap to avoid huge squares near the camera.

## Validation

- 240 tests across 16 files: stage connectivity and spawn validity across 60 seeds per stage, exact road flatness, render/simulation terrain agreement, normal/lunar hops, momentum, clean 360 rewards, landing and ceiling sweeps, airborne ramp-side rejection, floor/stair transitions, yaw wrap interpolation and deterministic replay.
- Browser and Worker TypeScript checks plus the production build pass. The initial high-quality Apartment payload remains below the unchanged 185 KiB gzip guard; other stages, OAuth and the garage remain lazy.
- Local 90-second Worker/D1 integration passes under ruleset 2.7.0, including a valid hop input, invalid bit rejection, server-derived scores, concurrent submission protection and leaderboard persistence. The test's score and ticket were removed afterward.
- Separate browser playtest tab, with saving disabled: drove the Apartment crawl hatch, House eastern garden entrance, flat street, and both outdoor jump types. Verified touch-button press/release and keyboard hop-handler bits. At a 390 × 844 layout, the touch controls remain inside the viewport and the page has no horizontal overflow.
- Desktop development-browser measurements with bloom enabled: Cul-de-sac median frame interval 16.7 ms / 95th percentile 18.3 ms over 180 frames; Moonbase 16.7 / 18.4 ms over 150 frames. Median JavaScript simulation/render submission was 1.8 / 1.5 ms respectively. These are local measurements, not a guarantee for every device. Both returned WebGL error 0; browser error logs were empty.

The simulation/input changes bump the ruleset from 2.6.0 to 2.7.0, so older daily replays are not interpreted using the new movement rules. The earlier promo exports remain recordings of 2.6.0.
