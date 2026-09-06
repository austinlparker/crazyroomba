# The Alhambra House Party · ruleset 2.3.0

The house is based on the first- and second-floor drawings of the **Sears Alhambra**, reproduced on printed page 34 (PDF page 42) of the [Prince George’s County Sears, Roebuck & Co. Mail-Order House Survey (1988)](https://www.pgplanning.org/wp-content/uploads/2024/03/Sears-Roebuck-and-Co-Mail-Order-House-Survey-1988-sm.pdf). The original scanned plan was rendered and inspected alongside the implementation.

This is a playable adaptation, not a measured reconstruction. The reference supplies the room relationships and circulation; furniture clearances, the stair connection and some dimensions are adjusted for driving.

## What the reference changed

- **Ground-floor loop:** the living room connects to the sunroom, dining room and kitchen through differently sized openings. The kitchen has a pantry/service nook and separate stair access. A fireplace anchors the living room.
- **Different upper floor:** four unequal bedrooms and a bathroom open onto a T-shaped hall, with a walk-in wardrobe and a linen cupboard. Upstairs no longer repeats the downstairs room grid.
- **Varied footprint:** a projecting sunroom window bay, full-width front terrace and smaller bedroom balcony replace the rectangular shell. Window positions follow the rooms, and walls include real sills, lintels and open doorways.
- **Domestic scale:** the main block is 9.2 × 10 meters, with a compact stair bay alongside it. Beds are about 1.85–2.1 meters long, counters 94 cm high, and ordinary doors about 0.8–1.25 meters wide. The 36 cm robot can pass beneath beds and tables while their legs still block it.

## Deliberate gameplay adaptations

The reference’s front and kitchen stair approaches inspire two opposing flights in one side bay. In the game they meet directly at the upstairs landing, so each is a complete boost route. Their continuous collision surfaces have a 2.8-meter rise over a 3.5-meter run; full-width visible treads, individual carpet sections and an animated stair-climbing suspension communicate the climb. This replaces the previous enormous ramps on opposite sides of the building.

Doorways stay open and a few circulation spaces are widened to allow turning. The roof is omitted for the menu overview. The house retains its late-1990s arcade dressing, boost pads and dust-delivery gameplay; normal and turbo driving speeds remain arcade abstractions.

## Reviewing and changing the plan

[View the two-story floor plan](HOUSE_FLOORPLAN.svg). It is generated directly from `src/game/level.ts`, the same geometry used by the renderer and authoritative Worker simulation:

```sh
node scripts/render-floorplan.mjs
```

Floor regions define the nonrectangular footprint. Walls, windows, doorways, room names, furniture and ramps are shared data, avoiding mismatches between visible architecture and collision. Tests flood-fill both floors through every room and doorway and check 2,800 seeded pickup locations, both stairs and camera sightlines at their crests.
