import { describe, expect, it } from "vitest";
import { createLevel, type LevelData } from "./navigation";
import { ROBOT_RADIUS } from "./level-types";
import {
  Keys,
  Simulation,
  appendReplay,
  replayDaily,
  type GameEvent,
  type Replay,
} from "./simulation";
import { ImpactMotion } from "./impact-motion";

const wall = {
  id: "bumper-wall",
  kind: "wall",
  floor: 0 as const,
  x: 0,
  z: 2,
  w: 6,
  d: 0.4,
  bottom: 0,
  top: 2.5,
};
function arena(overrides: Partial<LevelData> = {}) {
  return createLevel({
    id: "culdesac",
    outdoor: true,
    cruise: 2.8,
    turbo: 5.2,
    BOUNDS: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
    START: { x: 0, y: 0, z: 1.6, angle: 0 },
    DOCK: { x: -8, y: 0, z: -8 },
    DOCK_FACING: 0,
    DUST_COUNT: 0,
    FLOOR_REGIONS: [{ floor: 0, x: 0, z: 0, w: 20, d: 20, finish: "terrace" }],
    COLLIDERS: [wall],
    ROOMS: [],
    FURNITURE: [],
    WALLS: [],
    RAMPS: [],
    BOOST_PADS: [],
    routines: [],
    ...overrides,
  });
}
function advance(s: Simulation, frames: number, input = 0) {
  const impacts: GameEvent[] = [];
  for (let i = 0; i < frames; i++) {
    s.step(input);
    impacts.push(...s.events.filter((e) => e.kind === "bump"));
  }
  return impacts;
}
function crash(speed: number) {
  const s = new Simulation("freeroam", 1, arena());
  s.speed = s.vz = speed;
  const hits = advance(s, 1, Keys.forward | (speed > 3 ? Keys.boost : 0));
  return { s, hits };
}

describe("arcade bumpers", () => {
  it("rebounds away from a head-on collision in proportion to impact speed", () => {
    const gentle = crash(1.45),
      fast = crash(5.2);
    for (const { s, hits } of [gentle, fast]) {
      expect(hits).toHaveLength(1);
      expect(hits[0].normalX).toBe(0);
      expect(hits[0].normalZ).toBe(-1);
      expect(s.vz).toBeLessThan(0);
      expect(s.z).toBeCloseTo(1.8 - ROBOT_RADIUS);
    }
    expect(-fast.s.vz).toBeGreaterThan(-gentle.s.vz * 3);
    expect(fast.hits[0].value).toBeGreaterThan(gentle.hits[0].value * 3);
    const collisionZ = fast.s.z;
    advance(fast.s, 10, Keys.forward | Keys.boost);
    expect(collisionZ - fast.s.z).toBeGreaterThan(0.1);
    expect(collisionZ - fast.s.z).toBeLessThan(0.2);
  });

  it("slides along a wall on glancing contact without reversing lateral velocity", () => {
    const s = new Simulation("freeroam", 1, arena());
    Object.assign(s, {
      z: 1.615,
      angle: Math.atan2(4, 1),
      speed: Math.hypot(4, 1),
      vx: 4,
      vz: 1,
    });
    s.step(Keys.forward | Keys.boost);
    expect(s.vx).toBeGreaterThan(3.9);
    expect(s.vz).toBeLessThan(0);
    expect(s.events.find((e) => e.kind === "bump")?.value).toBeLessThan(1.2);
    const x = s.x;
    advance(s, 15, Keys.forward | Keys.boost);
    expect(s.x - x).toBeGreaterThan(0.8);
    expect(s.z).toBeLessThanOrEqual(1.8 - ROBOT_RADIUS + 1e-8);
  });

  it("settles when throttle remains held without repeating impacts or creeping into geometry", () => {
    const { s } = crash(5.2);
    expect(advance(s, 150, Keys.forward | Keys.boost)).toHaveLength(0);
    const settled = s.z;
    expect(Math.abs(s.vz)).toBeLessThan(1e-8);
    expect(advance(s, 60, Keys.forward)).toHaveLength(0);
    expect(s.z).toBeCloseTo(settled, 8);
    expect(s.level.walkable(s)).toBe(true);
  });

  it("does not play an impact cue for a stationary bumper or slow parking contact", () => {
    const s = new Simulation("freeroam", 1, arena());
    s.z = 1.8 - ROBOT_RADIUS;
    expect(advance(s, 90)).toHaveLength(0);
    expect(advance(s, 120, Keys.forward)).toHaveLength(0);
    expect(Math.abs(s.vz)).toBeLessThan(1e-6);
    expect(s.score).toBe(0);
  });

  it("allows reversing, turning and a fresh collision after clearing the bumper", () => {
    const { s } = crash(5.2);
    advance(s, 60, Keys.forward);
    const z = s.z;
    advance(s, 90, Keys.reverse);
    expect(s.z).toBeLessThan(z - 0.6);
    expect(advance(s, 90, Keys.forward | Keys.boost)).toHaveLength(1);
    advance(s, 40, Keys.left);
    const x = s.x;
    advance(s, 60, Keys.forward);
    expect(s.x - x).toBeGreaterThan(1);
  });

  it("uses a softer rebound for residents and never shoves the actor", () => {
    const level = arena({
      COLLIDERS: [],
      routines: [
        {
          id: "cat",
          kind: "cat",
          floor: 0,
          radius: 0.22,
          height: 0.4,
          speed: 0.5,
          color: "#eee",
          route: [{ x: 0, z: 2.02, wait: 999 }],
        },
      ],
    });
    const s = new Simulation("freeroam", 1, level);
    s.speed = s.vz = 5.2;
    s.step(Keys.forward | Keys.boost);
    expect(s.vz).toBeLessThan(0);
    expect(-s.vz).toBeLessThan(-crash(5.2).s.vz);
    expect(s.residents[0].z).toBe(2.02);
    expect(advance(s, 90, Keys.forward | Keys.boost)).toHaveLength(0);
  });

  it("clears bumper contact when an airborne robot passes above a low prop", () => {
    const s = new Simulation(
      "freeroam",
      1,
      arena({ COLLIDERS: [{ ...wall, kind: "box", top: 0.15 }] }),
    );
    s.speed = s.vz = 2.8;
    advance(s, 1, Keys.forward);
    Object.assign(s, { y: 0.3, grounded: false, vy: 0.5, vz: 1 });
    s.step(Keys.forward);
    expect(s.vz).toBeGreaterThan(1);
    expect(s.y).toBeGreaterThan(0.3);
  });

  it("rebounds from an airborne wall contact without cancelling vertical flight", () => {
    const s = new Simulation("freeroam", 1, arena());
    Object.assign(s, { y: 0.8, grounded: false, vy: 1.5, vz: 5.2, speed: 5.2 });
    s.step(Keys.forward | Keys.boost);
    expect(s.vz).toBeLessThan(-2);
    expect(s.grounded).toBe(false);
    expect(s.y).toBeGreaterThan(0.8);
    expect(s.vy).toBeCloseTo(1.5 - 9.8 / 60);
    expect(s.events.filter((e) => e.kind === "bump")).toHaveLength(1);
  });

  it("reproduces impact events, rebound and final state during the server replay", () => {
    const level = arena(),
      s = new Simulation("daily", 82, level),
      replay: Replay = [];
    let contacts = 0;
    for (let i = 0; i < 5400; i++) {
      const input = i % 300 < 170 ? Keys.forward | Keys.boost : Keys.reverse;
      s.step(input);
      contacts += s.events.filter((e) => e.kind === "bump").length;
      appendReplay(replay, input);
    }
    expect(contacts).toBeGreaterThan(10);
    const verified = replayDaily(s.seed, replay, level);
    for (const k of [
      "x",
      "z",
      "y",
      "vx",
      "vz",
      "speed",
      "boost",
      "score",
      "grounded",
    ] as const)
      expect(verified[k]).toBe(s[k]);
  });
});

describe("impact suspension", () => {
  const bump: GameEvent = {
    kind: "bump",
    x: 0,
    y: 0,
    z: 0,
    normalX: 0,
    normalZ: -1,
    value: 4.5,
  };
  it("tilts in the impact direction, scales with speed, clears the floor and settles", () => {
    const fast = new ImpactMotion(),
      slow = new ImpactMotion();
    fast.hit(bump);
    slow.hit({ ...bump, value: 1.5 });
    const pose = fast.pose(0.05, 0, false),
      gentle = slow.pose(0.05, 0, false);
    expect(pose.pitch).toBeLessThan(-0.12);
    expect(pose.roll).toBeCloseTo(0);
    expect(pose.pitch).toBeCloseTo(gentle.pitch * 3);
    expect(pose.lift).toBeGreaterThanOrEqual(
      ROBOT_RADIUS * Math.sin(Math.abs(pose.pitch)),
    );
    const side = new ImpactMotion();
    side.hit({ ...bump, normalX: -1, normalZ: 0 });
    expect(side.pose(0.05, 0, false).roll).toBeGreaterThan(0.12);
    expect(fast.pose(0.75, 0, false)).toEqual({ pitch: 0, roll: 0, lift: 0 });
  });

  it("is independent of render rate and disables cosmetic movement for reduced motion", () => {
    const fast = new ImpactMotion(),
      slow = new ImpactMotion();
    fast.hit(bump);
    slow.hit(bump);
    for (let i = 0; i < 11; i++) fast.pose(1 / 120, 1, false);
    const a = fast.pose(1 / 120, 1, false),
      b = slow.pose(0.1, 1, false);
    expect(a.pitch).toBeCloseTo(b.pitch, 12);
    expect(a.roll).toBeCloseTo(b.roll, 12);
    expect(slow.pose(0.01, 1, true)).toEqual({ pitch: 0, roll: 0, lift: 0 });
    slow.reset();
    expect(slow.pose(0, 1, false)).toEqual({ pitch: 0, roll: 0, lift: 0 });
  });
});
