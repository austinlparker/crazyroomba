import { describe, it, expect } from "vitest";
import { ROUTINES, createResidents, stepResidents } from "./household";
import {
  COLLIDERS,
  FLOOR_HEIGHT,
  DOCK,
  START,
  RAMPS,
  ROBOT_RADIUS,
  stairSupportHeight,
  rampHeight,
  walkable,
  insideFootprint,
  overlapsHeight,
} from "./level";
import { stairMotion } from "./house-test-fixture";
import { wallSurfaces } from "./wall-surfaces";
import {
  Simulation,
  Keys,
  appendReplay,
  replayDaily,
  type Replay,
  DAILY_TICKS,
} from "./house-test-fixture";

describe("household routines", () => {
  it.each(ROUTINES)(
    "keeps $id's complete route clear of walls and furniture",
    (r) => {
      for (let i = 0; i < r.route.length; i++) {
        const a = r.route[i],
          b = r.route[(i + 1) % r.route.length];
        for (let t = 0; t <= 1; t += 0.02) {
          const x = a.x + (b.x - a.x) * t,
            z = a.z + (b.z - a.z) * t,
            y = r.floor * FLOOR_HEIGHT;
          expect(
            insideFootprint({ x, z }, r.floor, r.radius),
            `${r.id} footprint ${x},${z}`,
          ).toBe(true);
          for (const o of COLLIDERS) {
            if (!overlapsHeight(o, y, r.height)) continue;
            const dx = x - Math.max(o.x - o.w / 2, Math.min(o.x + o.w / 2, x)),
              dz = z - Math.max(o.z - o.d / 2, Math.min(o.z + o.d / 2, z));
            expect(
              Math.hypot(dx, dz),
              `${r.id} hits ${o.id} at ${x},${z}`,
            ).toBeGreaterThanOrEqual(r.radius - 0.001);
          }
        }
      }
    },
  );
  it("moves, pauses at stops and yields without pushing a parked player", () => {
    const actors = createResidents(42),
      a = actors[0];
    a.wait = 0;
    const r = ROUTINES[0],
      next = r.route[a.node],
      len = Math.hypot(next.x - a.x, next.z - a.z);
    const player = {
      x: a.x + ((next.x - a.x) / len) * 0.43,
      z: a.z + ((next.z - a.z) / len) * 0.43,
      y: a.y,
    };
    const start = { x: a.x, z: a.z };
    for (let i = 0; i < 90; i++) stepResidents(actors, player);
    expect({ x: a.x, z: a.z }).toEqual(start);
    expect(a.activity).toBe("After you!");
    for (let i = 0; i < 120; i++)
      stepResidents(actors, { x: 100, z: 100, y: 0 });
    expect(a.travel).toBeGreaterThan(0.5);
  });
  it("blocks a driven collision without moving the actor through a wall", () => {
    const s = new Simulation("freeroam", 42),
      actor = s.residents[1];
    actor.wait = 300;
    Object.assign(s, {
      x: actor.x - 0.7,
      z: actor.z,
      y: 0,
      floor: 0,
      angle: Math.PI / 2,
    });
    const start = { x: actor.x, z: actor.z };
    for (let i = 0; i < 90; i++) s.step(Keys.forward | Keys.boost);
    expect(Math.hypot(s.x - actor.x, s.z - actor.z)).toBeGreaterThanOrEqual(
      actor.radius + ROBOT_RADIUS - 0.001,
    );
    expect({ x: actor.x, z: actor.z }).toEqual(start);
    expect(walkable(s)).toBe(true);
  });
  it("replays household movement and bumper contacts exactly", () => {
    const s = new Simulation("daily", 19),
      replay: Replay = [];
    for (let i = 0; i < DAILY_TICKS; i++) {
      const input =
        (i % 420 < 250 ? Keys.forward : Keys.reverse) |
        (i % 310 < 160 ? Keys.right : 0) |
        (i % 500 < 200 ? Keys.boost : 0);
      s.step(input);
      appendReplay(replay, input);
    }
    const verified = replayDaily(19, replay);
    expect(verified.residents).toEqual(s.residents);
    expect(verified.x).toBe(s.x);
    expect(verified.score).toBe(s.score);
  });
  it("leaves onboarding's approach clear and banks at the new wall station", () => {
    const s = new Simulation("tutorial", 1);
    expect(s.residents).toHaveLength(0);
    expect(walkable(START)).toBe(true);
    expect(walkable(DOCK)).toBe(true);
    for (let i = 0; i < 65; i++) s.step(Keys.forward | Keys.boost);
    expect(s.bin.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < 300; i++) s.step(Keys.reverse);
    expect(s.deposited).toBeGreaterThanOrEqual(3);
  });
});
describe("stair chassis support", () => {
  it.each(RAMPS)("clears every tread of $id even at full turbo pitch", (r) => {
    const direction = Math.sign(r.topZ - r.bottomZ);
    for (let i = 0; i <= 1000; i++) {
      const z = r.bottomZ + ((r.topZ - r.bottomZ) * i) / 1000;
      for (const reduced of [true, false]) {
        const p = {
          x: r.x,
          z,
          y: rampHeight(r, z),
          angle: direction > 0 ? 0 : Math.PI,
          speed: 3.2,
          boosting: true,
        };
        const pose = stairMotion(p, reduced);
        expect(
          pose.y - ROBOT_RADIUS * Math.sin(Math.abs(pose.pitch)),
          `${r.id} tread ${i}`,
        ).toBeGreaterThanOrEqual(stairSupportHeight(r, z) - 0.001);
        if (reduced) {
          expect(pose.pitch).toBe(0);
          expect(pose.roll).toBe(0);
        }
      }
    }
  });
  it("does not animate when parked or away from stairs", () => {
    expect(stairMotion({ ...START, speed: 0, boosting: false })).toEqual({
      y: 0,
      pitch: 0,
      roll: 0,
    });
    const r = RAMPS[0],
      pose = stairMotion({
        x: r.x,
        z: r.z,
        y: rampHeight(r, r.z),
        angle: 0,
        speed: 0,
        boosting: true,
      });
    expect(pose.pitch).toBe(0);
    expect(pose.roll).toBe(0);
    expect(pose.y).toBeCloseTo(stairSupportHeight(r, r.z));
  });
});
describe("architectural surface union", () => {
  it("removes overlapping skins and internal faces at a T junction", () => {
    const base = {
      kind: "wall",
      floor: 0 as const,
      bottom: 0,
      top: 2.65,
      exterior: false,
    };
    const walls = [
      { ...base, id: "a", x: 0, z: 0, w: 3, d: 0.14 },
      { ...base, id: "b", x: 0, z: 1, w: 0.14, d: 2 },
    ];
    const faces = wallSurfaces(walls),
      keys = faces.map((f) => JSON.stringify(f));
    expect(new Set(keys).size).toBe(keys.length);
    for (const f of faces) {
      const p = {
        x: f.x + (f.axis === "x" ? f.sign * 0.0001 : 0),
        y: f.y + (f.axis === "y" ? f.sign * 0.0001 : 0),
        z: f.z + (f.axis === "z" ? f.sign * 0.0001 : 0),
      };
      expect(
        walls.some(
          (w) =>
            Math.abs(p.x - w.x) < w.w / 2 &&
            Math.abs(p.z - w.z) < w.d / 2 &&
            p.y > w.bottom &&
            p.y < w.top,
        ),
      ).toBe(false);
    }
  });
});
