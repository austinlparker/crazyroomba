import { describe, expect, it } from "vitest";
import { Simulation } from "./house-test-fixture";
import {
  COLLIDERS,
  DOCK,
  FLOOR_HEIGHT,
  FLOOR_REGIONS,
  FURNITURE,
  OPENINGS,
  RAMPS,
  ROBOT_HEIGHT,
  ROBOT_RADIUS,
  ROOMS,
  clearanceAt,
  insideFootprint,
  rampAt,
  rampHeight,
  walkable,
  type Point,
} from "./level";

// Each flood-fill starts at the dock or shared upper landing. The simulation
// tests below exercise the actual flights joining the two story components.
const CELL = 0.05;
const key = (x: number, z: number) => `${x},${z}`;
function reachableFloor(start: Point, y: number) {
  const origin: [number, number] = [
    Math.round(start.x / CELL),
    Math.round(start.z / CELL),
  ];
  const visited = new Set([key(...origin)]),
    queue = [origin];
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i];
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz,
        nextKey = key(nx, nz);
      if (
        !visited.has(nextKey) &&
        walkable({ x: nx * CELL, z: nz * CELL, y }, ROBOT_RADIUS)
      ) {
        visited.add(nextKey);
        queue.push([nx, nz]);
      }
    }
  }
  return visited;
}
const near = (p: Point, visited: Set<string>) => {
  for (const x of [Math.floor(p.x / CELL), Math.ceil(p.x / CELL)])
    for (const z of [Math.floor(p.z / CELL), Math.ceil(p.z / CELL)])
      if (visited.has(key(x, z))) return true;
  return false;
};
const reachable = [
  reachableFloor(DOCK, 0),
  reachableFloor({ x: RAMPS[0].x, z: 0 }, FLOOR_HEIGHT),
];

describe("architectural house routes", () => {
  it.each(RAMPS)("connects both landings of $id to the house", (ramp) => {
    const direction = Math.sign(ramp.topZ - ramp.bottomZ);
    expect(
      near({ x: ramp.x, z: ramp.bottomZ - direction * 0.375 }, reachable[0]),
    ).toBe(true);
    expect(
      near({ x: ramp.x, z: ramp.topZ + direction * 0.3 }, reachable[1]),
    ).toBe(true);
  });
  it.each(ROOMS)("makes the usable floor of $name reachable", (room) => {
    let clearPoints = 0;
    for (
      let ix = Math.ceil((room.x - room.w / 2 + ROBOT_RADIUS) / CELL);
      ix * CELL < room.x + room.w / 2 - ROBOT_RADIUS;
      ix++
    ) {
      for (
        let iz = Math.ceil((room.z - room.d / 2 + ROBOT_RADIUS) / CELL);
        iz * CELL < room.z + room.d / 2 - ROBOT_RADIUS;
        iz++
      ) {
        const p = { x: ix * CELL, z: iz * CELL, y: room.floor * FLOOR_HEIGHT };
        if (!walkable(p) || rampAt(p)) continue;
        clearPoints++;
        expect(
          near(p, reachable[room.floor]),
          `${room.name} at ${p.x},${p.z}`,
        ).toBe(true);
      }
    }
    expect(clearPoints).toBeGreaterThan(0);
  });
  it.each(OPENINGS.filter((o) => o.type === "door"))(
    "keeps $id open and reachable on floor $floor",
    (opening) => {
      const p = {
        x: opening.axis === "x" ? opening.center : opening.at,
        z: opening.axis === "z" ? opening.center : opening.at,
        y: opening.floor * FLOOR_HEIGHT,
      };
      expect(walkable(p), `door at ${p.x},${p.z}`).toBe(true);
      expect(near(p, reachable[opening.floor]), `door at ${p.x},${p.z}`).toBe(
        true,
      );
    },
  );
  it("provides reachable spawns on both stories, including beneath furniture, across 100 seeds", () => {
    let underFurniture = 0;
    for (let seed = 0; seed < 100; seed++)
      for (const d of new Simulation("daily", seed).dust) {
        expect(
          walkable(d, 0.26),
          `spawn ${d.id} of seed ${seed}: ${d.x},${d.z}`,
        ).toBe(true);
        expect(
          near(d, reachable[d.y === 0 ? 0 : 1]),
          `unreachable spawn ${d.id} of seed ${seed}: ${d.x},${d.z},${d.y}`,
        ).toBe(true);
        if (
          FURNITURE.some(
            (o) =>
              o.floor * FLOOR_HEIGHT === d.y &&
              o.bottom > ROBOT_HEIGHT &&
              Math.abs(d.x - o.x) < o.w / 2 &&
              Math.abs(d.z - o.z) < o.d / 2,
          )
        )
          underFurniture++;
      }
    expect(underFurniture).toBeGreaterThan(0);
  });
  it.each(["bed", "table", "coffee", "desk"])(
    "exposes the actual %s clearance and solid legs",
    (kind) => {
      const o = FURNITURE.find((o) => o.kind === kind)!;
      const p = { x: o.x, z: o.z, y: o.floor * FLOOR_HEIGHT };
      expect(walkable(p)).toBe(true);
      expect(near(p, reachable[o.floor])).toBe(true);
      expect(clearanceAt(p)).toBeCloseTo(o.bottom);
      const leg = COLLIDERS.find((c) => c.id.startsWith(`${o.id}-leg`))!;
      expect(walkable({ x: leg.x, z: leg.z, y: p.y })).toBe(false);
      expect(walkable({ ...p, y: p.y + o.bottom })).toBe(false);
    },
  );
  it.each(RAMPS)(
    "only exposes the $id surface at its actual elevation",
    (ramp) => {
      const y = rampHeight(ramp, ramp.z);
      expect(walkable({ x: ramp.x, z: ramp.z, y })).toBe(true);
      expect(walkable({ x: ramp.x, z: ramp.z, y: 0 })).toBe(false);
      expect(walkable({ x: ramp.x, z: ramp.z, y: FLOOR_HEIGHT })).toBe(false);
    },
  );
  it("uses the stepped floorplan rather than filling its rectangular bounding box", () => {
    for (const region of FLOOR_REGIONS)
      expect(
        insideFootprint({
          x: region.x,
          z: region.z,
          y: region.floor * FLOOR_HEIGHT,
        }),
      ).toBe(true);
    for (const floor of [0, 1] as const)
      for (const p of [
        { x: -5.5, z: -3 },
        { x: 5, z: 6.5 },
      ]) {
        expect(insideFootprint({ ...p, y: floor * FLOOR_HEIGHT })).toBe(false);
        expect(walkable({ ...p, y: floor * FLOOR_HEIGHT })).toBe(false);
      }
    expect(insideFootprint({ x: 2, z: 6, y: 0 })).toBe(true);
    expect(insideFootprint({ x: 2, z: 6, y: FLOOR_HEIGHT })).toBe(false);
    expect(insideFootprint({ x: -5.4, z: 2.4, y: 0 })).toBe(true);
    expect(insideFootprint({ x: -5.4, z: 2.4, y: FLOOR_HEIGHT })).toBe(false);
  });
});
