import { describe, expect, it } from "vitest";
import { loadLevel } from "./stages/load-data";
import { STAGES, dailyStage } from "./stage-catalog";
import { ROBOT_RADIUS, FLOOR_HEIGHT } from "./level-types";
import {
  Simulation,
  Keys,
  replayDaily,
  appendReplay,
  type Replay,
} from "./simulation";
import type { Level } from "./navigation";

// Keep 5cm resolution for narrow indoor crawl routes; open terrain can use 10cm.
function reachable(level: Level, y: number) {
  const cell = level.outdoor ? 0.1 : 0.05;
  const start =
    y === 0
      ? level.DOCK
      : {
          x: level.RAMPS[0].x,
          z:
            level.RAMPS[0].topZ +
            Math.sign(level.RAMPS[0].topZ - level.RAMPS[0].bottomZ) * 0.5,
        };
  const seen = new Set<string>(),
    queue = [[Math.round(start.x / cell), Math.round(start.z / cell)]];
  seen.add(queue[0].join(","));
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
        key = `${nx},${nz}`;
      if (
        seen.has(key) ||
        !level.walkable(
          {
            x: nx * cell,
            z: nz * cell,
            y: y || level.groundHeight(nx * cell, nz * cell),
          },
          ROBOT_RADIUS,
        )
      )
        continue;
      seen.add(key);
      queue.push([nx, nz]);
    }
  }
  return seen;
}

describe.each(STAGES)("$name stage", ({ id }) => {
  it("keeps all dust on reachable surfaces across 60 seeds", async () => {
    const level = await loadLevel(id),
      floors = [...new Set(level.FLOOR_REGIONS.map((r) => r.floor))];
    const cell = level.outdoor ? 0.1 : 0.05;
    expect(level.walkable(level.START)).toBe(true);
    expect(level.walkable(level.DOCK)).toBe(true);
    const paths = floors.map((f) => reachable(level, f * FLOOR_HEIGHT));
    for (let seed = 1; seed <= 60; seed++)
      for (const d of new Simulation("daily", seed, level).dust) {
        expect(
          level.walkable(d, 0.26),
          `${id} seed ${seed}: ${JSON.stringify(d)}`,
        ).toBe(true);
        const x = Math.round(d.x / cell),
          z = Math.round(d.z / cell),
          path = paths[d.y > FLOOR_HEIGHT / 2 ? 1 : 0];
        expect(
          [
            [0, 0],
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ].some(([dx, dz]) => path.has(`${x + dx},${z + dz}`)),
          `${id} unreachable pickup ${d.x},${d.y},${d.z}`,
        ).toBe(true);
      }
  });
  it("replays the correct stage without shared mutable level state", async () => {
    const level = await loadLevel(id),
      otherLevel = await loadLevel(id === "apartment" ? "moon" : "apartment");
    const sim = new Simulation("daily", 71, level),
      other = new Simulation("freeroam", 9, otherLevel),
      replay: Replay = [];
    for (let i = 0; i < 5400; i++) {
      const keys =
        i % 240 < 160 ? Keys.forward | Keys.boost : Keys.forward | Keys.left;
      sim.step(keys);
      other.step(Keys.forward);
      appendReplay(replay, keys);
    }
    const verified = replayDaily(71, replay, level);
    expect([
      verified.x,
      verified.y,
      verified.z,
      verified.score,
      verified.deposited,
      verified.dust,
    ]).toEqual([sim.x, sim.y, sim.z, sim.score, sim.deposited, sim.dust]);
    expect(other.level.id).not.toBe(sim.level.id);
  });
  it("keeps every household route clear at resident height", async () => {
    const level = await loadLevel(id);
    for (const r of level.routines)
      for (let i = 0; i < r.route.length; i++) {
        const a = r.route[i],
          b = r.route[(i + 1) % r.route.length],
          floorY = r.floor * FLOOR_HEIGHT;
        for (let t = 0; t <= 1; t += 0.04) {
          const x = a.x + (b.x - a.x) * t,
            z = a.z + (b.z - a.z) * t,
            y = floorY || level.groundHeight(x, z);
          expect(
            level.insideFootprint({ x, z, y }, r.floor, r.radius),
            `${id} ${r.id} edge`,
          ).toBe(true);
          for (const o of level.COLLIDERS) {
            if (!level.overlapsHeight(o, y, r.height)) continue;
            const dx = x - Math.max(o.x - o.w / 2, Math.min(o.x + o.w / 2, x)),
              dz = z - Math.max(o.z - o.d / 2, Math.min(o.z + o.d / 2, z));
            expect(
              Math.hypot(dx, dz),
              `${id} ${r.id} hits ${o.id}`,
            ).toBeGreaterThanOrEqual(r.radius - 0.001);
          }
        }
      }
  });
});

it("rotates one shared daily stage through all four stages", () => {
  const days = ["2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08"];
  expect(new Set(days.map(dailyStage)).size).toBe(4);
  expect(dailyStage("2026-09-05")).toBe(dailyStage("2026-09-09"));
});
it("keeps most moon pickups along the ground routes and a smaller reward on the deck", async () => {
  const s = new Simulation("daily", 71, await loadLevel("moon"));
  expect(s.dust.filter((d) => d.y < FLOOR_HEIGHT / 2)).toHaveLength(55);
  expect(s.dust.filter((d) => d.y === FLOOR_HEIGHT)).toHaveLength(9);
});
it("tutorial dust is collectable and the apartment dock pays out", async () => {
  const level = await loadLevel("apartment"),
    s = new Simulation("tutorial", 1, level);
  for (let i = 0; i < 110; i++) s.step(Keys.forward);
  expect(s.bin.length).toBeGreaterThan(0);
  for (let i = 0; i < 240; i++) s.step(Keys.reverse);
  expect(s.deposited).toBeGreaterThan(0);
});
it("drives the moon launch ramp up and down without teleportation", async () => {
  const level = await loadLevel("moon"),
    s = new Simulation("freeroam", 1, level),
    r = level.RAMPS[0];
  s.x = r.x;
  s.z = r.bottomZ + 0.3;
  s.angle = Math.PI;
  s.dust.forEach((d) => {
    d.active = false;
    d.respawnAt = 1e8;
  });
  for (let i = 0; i < 230; i++) s.step(Keys.forward);
  expect(s.y).toBeCloseTo(2.8);
  expect(s.floor).toBe(1);
  expect(s.z).toBeLessThan(r.topZ);
  s.angle = 0;
  s.speed = s.vx = s.vz = 0;
  for (let i = 0; i < 300; i++) s.step(Keys.forward);
  expect(s.y).toBeCloseTo(level.groundHeight(s.x, s.z));
  expect(s.floor).toBe(0);
});
