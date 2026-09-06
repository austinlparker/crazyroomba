import { describe, expect, it } from "vitest";
import {
  CAPACITY,
  DAILY_TICKS,
  DOCK,
  Keys,
  Simulation,
  appendReplay,
  replayDaily,
  seedForDay,
  utcDay,
  validateReplay,
  walkable,
  type Replay,
} from "./house-test-fixture";
import {
  BOOST_PADS,
  COLLIDERS,
  CRUISE_SPEED,
  DUST_COUNT,
  FLOOR_HEIGHT,
  FURNITURE,
  RAMPS,
  ROBOT_RADIUS,
  TURBO_SPEED,
  insideFootprint,
  rampAt,
} from "./level";

const advance = (sim: Simulation, frames: number, input = 0) => {
  for (let i = 0; i < frames; i++) sim.step(input);
};
const place = (
  sim: Simulation,
  x: number,
  z: number,
  floor: 0 | 1 = 0,
  angle = 0,
) => {
  Object.assign(sim, {
    x,
    z,
    floor,
    y: floor * FLOOR_HEIGHT,
    angle,
    vx: 0,
    vz: 0,
    speed: 0,
  });
};

describe("v2 production simulation", () => {
  it("starts every mode inside the house on a clear route away from the dock", () => {
    for (const mode of ["arcade", "daily", "freeroam", "tutorial"] as const) {
      const sim = new Simulation(mode, 42);
      expect(walkable(sim)).toBe(true);
      expect(sim.x).toBeLessThan(DOCK.x);
      expect(sim.z).toBe(DOCK.z);
      expect(sim.y).toBe(0);
      expect(sim.floor).toBe(0);
    }
  });
  it("daily seeds are UTC based, reproducible, and change each day", () => {
    expect(utcDay(new Date("2026-09-05T23:30:00-04:00"))).toBe("2026-09-06");
    expect(seedForDay("2026-09-05")).not.toBe(seedForDay("2026-09-06"));
    expect(new Simulation("daily", 42).dust).toEqual(
      new Simulation("daily", 42).dust,
    );
    expect(new Simulation("daily", 42).dust).not.toEqual(
      new Simulation("daily", 43).dust,
    );
  });
  it("splits dust equally across both stories and keeps the tutorial downstairs", () => {
    const daily = new Simulation("daily", 42);
    expect(daily.dust).toHaveLength(DUST_COUNT);
    expect(daily.dust.filter((d) => d.y === 0)).toHaveLength(DUST_COUNT / 2);
    expect(daily.dust.filter((d) => d.y === FLOOR_HEIGHT)).toHaveLength(
      DUST_COUNT / 2,
    );
    expect(new Simulation("tutorial", 42).dust.every((d) => d.y === 0)).toBe(
      true,
    );
  });
  it("steers at rest, accelerates to room-scale speed, reverses and coasts to a stop", () => {
    const s = new Simulation("freeroam", 1);
    advance(s, 20, Keys.right);
    expect(s.angle).toBeLessThan(Math.PI);
    expect(s.speed).toBe(0);
    place(s, 2.8, 3, 0, Math.PI);
    advance(s, 60, Keys.forward);
    expect(s.speed).toBeGreaterThan(CRUISE_SPEED * 0.98);
    expect(s.speed).toBeLessThanOrEqual(CRUISE_SPEED);
    expect(s.distanceDriven).toBeLessThan(1.5);
    advance(s, 120);
    expect(Math.abs(s.speed)).toBeLessThan(0.01);
    advance(s, 60, Keys.reverse);
    expect(s.speed).toBeLessThan(-0.8);
    expect(s.speed).toBeGreaterThanOrEqual(-0.85);
  });
  it("boost consumes charge, raises speed and recharges after release", () => {
    const s = new Simulation("freeroam", 2);
    place(s, 2.8, 3, 0, Math.PI);
    advance(s, 40, Keys.forward | Keys.boost);
    expect(s.boost).toBeLessThan(86);
    expect(s.boostTicks).toBe(40);
    expect(s.speed).toBeGreaterThan(TURBO_SPEED * 0.95);
    expect(s.speed).toBeLessThanOrEqual(TURBO_SPEED);
    const before = s.boost;
    advance(s, 40);
    expect(s.boost).toBeGreaterThan(before);
  });
  it("drift keeps lateral momentum while the robot rotates", () => {
    const normal = new Simulation("freeroam", 3),
      drift = new Simulation("freeroam", 3);
    for (const s of [normal, drift]) {
      place(s, 2.8, 2.5);
      s.residents = []; // Isolate traction from household contacts.
      s.speed = CRUISE_SPEED;
      s.vz = CRUISE_SPEED;
    }
    advance(normal, 12, Keys.forward | Keys.right);
    advance(drift, 12, Keys.forward | Keys.right | Keys.drift);
    expect(drift.driftTicks).toBe(12);
    expect(drift.vz).toBeGreaterThan(normal.vz);
    expect(Math.abs(drift.angle)).toBeGreaterThan(Math.abs(normal.angle));
  });
  it("cannot drive through perimeter walls or solid furniture while boosting", () => {
    const s = new Simulation("freeroam", 4);
    place(s, 3.6, 6, 0, Math.PI / 2);
    advance(s, 180, Keys.forward | Keys.boost);
    expect(s.x).toBeLessThan(4.2 - ROBOT_RADIUS);
    const sofa = FURNITURE.find((o) => o.kind === "sofa")!;
    place(s, sofa.x, sofa.z + sofa.d / 2 + 0.7, 0, Math.PI);
    advance(s, 120, Keys.forward | Keys.boost);
    expect(s.z).toBeGreaterThanOrEqual(
      sofa.z + sofa.d / 2 + ROBOT_RADIUS - 0.001,
    );
  });
  it.each(["bed", "table", "coffee", "desk"])(
    "can enter the open center under a %s and reverse out",
    (kind) => {
      const s = new Simulation("freeroam", 4);
      const o = FURNITURE.find((o) => o.kind === kind)!;
      const acrossX = o.w < o.d;
      const start = {
        x: o.x + (acrossX ? o.w / 2 + 0.3 : 0),
        z: o.z + (acrossX ? 0 : o.d / 2 + 0.3),
      };
      place(s, start.x, start.z, o.floor, acrossX ? -Math.PI / 2 : Math.PI);
      const entryDistance = (acrossX ? o.w : o.d) / 2 + 0.3;
      advance(
        s,
        Math.ceil((entryDistance / CRUISE_SPEED + 0.23) * 60),
        Keys.forward,
      );
      expect(Math.abs(s.x - o.x)).toBeLessThan(o.w / 2 - 0.1);
      expect(Math.abs(s.z - o.z)).toBeLessThan(o.d / 2 - 0.1);
      expect(s.y).toBe(o.floor * FLOOR_HEIGHT);
      advance(s, Math.ceil((entryDistance / 0.85 + 0.55) * 60), Keys.reverse);
      expect(acrossX ? s.x : s.z).toBeGreaterThan(
        (acrossX ? o.x + o.w / 2 : o.z + o.d / 2) + 0.1,
      );
    },
  );
  it.each(["bed", "table"])(
    "collides with %s legs rather than its entire footprint",
    (kind) => {
      const s = new Simulation("freeroam", 4);
      const o = FURNITURE.find((o) => o.kind === kind)!;
      const leg = COLLIDERS.find(
        (c) => c.id.startsWith(`${o.id}-leg`) && c.z > o.z,
      )!;
      place(s, leg.x, leg.z + 0.7, o.floor, Math.PI);
      advance(s, 90, Keys.forward | Keys.boost);
      expect(s.z).toBeGreaterThanOrEqual(
        leg.z + leg.d / 2 + ROBOT_RADIUS - 0.001,
      );
    },
  );
  it("collects up to five dust without removing any extras", () => {
    const s = new Simulation("freeroam", 5);
    s.z = 2.4;
    for (const d of s.dust) Object.assign(d, { x: s.x, z: s.z, y: s.y });
    s.step(0);
    expect(s.bin).toHaveLength(CAPACITY);
    expect(s.dust.filter((d) => d.active)).toHaveLength(DUST_COUNT - CAPACITY);
    expect(s.score).toBe(0);
  });
  it("does not vacuum dust through the ceiling", () => {
    const s = new Simulation("freeroam", 5);
    place(s, 2.8, 1.9);
    for (const d of s.dust)
      Object.assign(d, { x: s.x, z: s.z, y: FLOOR_HEIGHT });
    s.step(0);
    expect(s.bin).toHaveLength(0);
    expect(s.dust.every((d) => d.active)).toBe(true);
    place(s, s.x, s.z, 1);
    s.step(0);
    expect(s.bin).toHaveLength(CAPACITY);
  });
  it("cannot deposit at the upstairs position directly over the dock", () => {
    const s = new Simulation("freeroam", 6);
    place(s, DOCK.x, DOCK.z, 1);
    s.bin = [100];
    s.step(0);
    expect(s.bin).toEqual([100]);
    expect(s.score).toBe(0);
    expect(s.deliveries).toBe(0);
    place(s, DOCK.x, DOCK.z);
    s.step(0);
    expect(s.bin).toHaveLength(0);
    expect(s.score).toBe(110);
  });
  it("only banks on delivery, doubles a full load, and buys time only in Arcade", () => {
    for (const mode of ["arcade", "daily"] as const) {
      const s = new Simulation(mode, 6);
      place(s, DOCK.x, DOCK.z);
      s.bin = [100, 100, 100, 100, 100];
      s.remaining = 1200;
      s.step(0);
      expect(s.score).toBe(1000);
      expect(s.deposited).toBe(5);
      expect(s.bin).toHaveLength(0);
      expect(s.deliveries).toBe(1);
      expect(s.remaining).toBe(mode === "arcade" ? 1679 : 1199);
      s.step(0);
      expect(s.score).toBe(1000);
    }
  });
  it("ends daily at exactly 5400 steps; subsequent input changes nothing", () => {
    const s = new Simulation("daily", 7);
    advance(s, DAILY_TICKS);
    expect(s.ended).toBe(true);
    expect(s.remaining).toBe(0);
    const x = s.x;
    advance(s, 300, Keys.forward);
    expect(s.x).toBe(x);
    expect(s.ticks).toBe(DAILY_TICKS);
  });
  it("lets free roam continue and respawns collected dust on its original floor", () => {
    const s = new Simulation("freeroam", 8);
    const first = s.dust[1];
    place(s, 2.8, 1.9, 1);
    Object.assign(first, { x: s.x, z: s.z });
    s.step(0);
    expect(first.active).toBe(false);
    place(s, DOCK.x, DOCK.z);
    s.step(0);
    advance(s, DAILY_TICKS + 1);
    expect(s.ended).toBe(false);
    expect(s.remaining).toBe(Infinity);
    expect(s.dust[1]).not.toBe(first);
    expect(s.dust[1].y).toBe(FLOOR_HEIGHT);
  });
});

describe("turbo stairs", () => {
  it.each(RAMPS)("blocks an unboosted ascent at the $id entrance", (ramp) => {
    const s = new Simulation("freeroam", 1),
      direction = Math.sign(ramp.topZ - ramp.bottomZ);
    place(
      s,
      ramp.x,
      ramp.bottomZ - direction * 0.3,
      0,
      direction > 0 ? 0 : Math.PI,
    );
    advance(s, 150, Keys.forward);
    expect(s.y).toBe(0);
    expect(s.floor).toBe(0);
    expect((s.z - ramp.bottomZ) * direction).toBeLessThanOrEqual(0);
    expect(s.stairBlocked).toBe(true);
  });
  it.each(RAMPS)(
    "ascends the $id flight, exits upstairs, and reverses down the same flight",
    (ramp) => {
      const s = new Simulation("freeroam", 2),
        direction = Math.sign(ramp.topZ - ramp.bottomZ);
      place(
        s,
        ramp.x,
        ramp.bottomZ - direction * 0.4,
        0,
        direction > 0 ? 0 : Math.PI,
      );
      let previousY = s.y;
      for (let i = 0; i < 300; i++) {
        s.step(Keys.forward | Keys.boost);
        expect(Math.abs(s.y - previousY)).toBeLessThan(0.1);
        previousY = s.y;
        if (s.floor === 1 && !s.ramp && (s.z - ramp.topZ) * direction > 0.1)
          break;
      }
      expect(s.y).toBe(FLOOR_HEIGHT);
      expect(s.floor).toBe(1);
      expect(s.ramp).toBeNull();
      expect((s.z - ramp.topZ) * direction).toBeGreaterThan(0.1);
      advance(s, 40);
      previousY = s.y;
      for (let i = 0; i < 600; i++) {
        s.step(Keys.reverse);
        expect(Math.abs(s.y - previousY)).toBeLessThan(0.1);
        previousY = s.y;
        if (s.floor === 0 && !s.ramp && (s.z - ramp.bottomZ) * direction < -0.1)
          break;
      }
      expect((s.z - ramp.bottomZ) * direction).toBeLessThan(-0.1);
      expect(s.y).toBe(0);
      expect(s.floor).toBe(0);
      expect(s.ramp).toBeNull();
    },
  );
  it.each(RAMPS)(
    "cannot enter the middle of the $id flight from either floor",
    (ramp) => {
      for (const floor of [0, 1] as const) {
        const s = new Simulation("freeroam", 3);
        place(s, 3.1, ramp.z, floor, Math.PI / 2);
        advance(s, 120, Keys.forward | Keys.boost);
        expect(s.x).toBeLessThan(ramp.x - ramp.w / 2);
        expect(s.y).toBe(floor * FLOOR_HEIGHT);
        expect(s.ramp).toBeNull();
      }
    },
  );
  it("refills turbo on pad entry, not continuously while parked on it", () => {
    const s = new Simulation("freeroam", 4),
      pad = BOOST_PADS[0];
    place(s, pad.x, pad.z);
    s.boost = 20;
    s.step(0);
    expect(s.boost).toBe(100);
    expect(s.events.some((e) => e.kind === "boost")).toBe(true);
    s.boost = 20;
    s.step(0);
    expect(s.boost).toBeLessThan(21);
    expect(s.events.some((e) => e.kind === "boost")).toBe(false);
    place(s, 3.8, pad.z);
    s.step(0);
    place(s, pad.x, pad.z);
    s.step(0);
    expect(s.boost).toBe(100);
    expect(s.events.some((e) => e.kind === "boost")).toBe(true);
  });
  it("does not recharge from a pad on the other floor", () => {
    const s = new Simulation("freeroam", 4),
      pad = BOOST_PADS.find((p) => p.id.endsWith("upper"))!;
    place(s, pad.x, pad.z, 0);
    s.boost = 20;
    s.step(0);
    expect(s.boost).toBeLessThan(21);
    expect(s.events.some((e) => e.kind === "boost")).toBe(false);
  });
  it.each([
    { x: 3.6, z: 6, floor: 0 as const, angle: Math.PI / 2 },
    { x: -2.1, z: 5.8, floor: 1 as const, angle: Math.PI / 2 },
    { x: -4.6, z: -0.4, floor: 0 as const, angle: -Math.PI / 2 },
  ])(
    "cannot escape a terrace or bay boundary into the bounding-box void at $x,$z",
    (pose) => {
      const s = new Simulation("freeroam", 4);
      place(s, pose.x, pose.z, pose.floor, pose.angle);
      expect(walkable(s)).toBe(true);
      for (let i = 0; i < 180; i++) {
        s.step(Keys.forward | Keys.boost);
        expect(insideFootprint(s, s.floor, ROBOT_RADIUS)).toBe(true);
      }
    },
  );
});

describe("server replay verification", () => {
  it("recreates the exact final run from compressed production input", () => {
    const s = new Simulation("daily", seedForDay("2026-09-05")),
      replay: Replay = [];
    for (let i = 0; i < DAILY_TICKS; i++) {
      const input =
        Keys.forward |
        (i % 200 < 70 ? Keys.right : 0) |
        (i % 500 < 120 ? Keys.boost : 0);
      s.step(input);
      appendReplay(replay, input);
    }
    expect(replay.length).toBeLessThan(200);
    const verified = replayDaily(s.seed, replay);
    expect(verified.score).toBe(s.score);
    expect(verified.deposited).toBe(s.deposited);
    expect(verified.x).toBe(s.x);
    expect(verified.z).toBe(s.z);
    expect(verified.y).toBe(s.y);
    expect(verified.floor).toBe(s.floor);
    expect(verified.dust).toEqual(s.dust);
  });
  it("replays a complete stair climb to the same upstairs position", () => {
    const s = new Simulation("daily", 42),
      replay: Replay = [];
    const ramp = RAMPS[0];
    const targets = [
      { x: DOCK.x, z: BOOST_PADS[0].z },
      { x: ramp.x, z: BOOST_PADS[0].z },
      { x: ramp.x, z: 0 },
      { x: 3.4, z: 0 },
    ];
    let target = 0;
    for (let i = 0; i < DAILY_TICKS; i++) {
      let input = 0;
      if (target < targets.length) {
        const p = targets[target],
          dx = p.x - s.x,
          dz = p.z - s.z;
        if (Math.hypot(dx, dz) < 0.075 && Math.abs(s.speed) < 0.4) target++;
        else {
          const delta = Math.atan2(
            Math.sin(Math.atan2(dx, dz) - s.angle),
            Math.cos(Math.atan2(dx, dz) - s.angle),
          );
          input =
            Math.abs(delta) > 0.025 ? (delta > 0 ? Keys.left : Keys.right) : 0;
          if (
            Math.abs(delta) < 0.12 &&
            (Math.hypot(dx, dz) > 0.3 || Math.abs(s.speed) < 0.3)
          ) {
            input |= Keys.forward;
            if (rampAt(s) || s.stairBlocked) input |= Keys.boost;
          }
        }
      }
      s.step(input);
      appendReplay(replay, input);
    }
    expect(target).toBe(targets.length);
    expect(s.y).toBe(FLOOR_HEIGHT);
    expect(s.floor).toBe(1);
    expect(s.x).toBeLessThan(4.2);
    const verified = replayDaily(s.seed, replay);
    expect({
      x: verified.x,
      z: verified.z,
      y: verified.y,
      floor: verified.floor,
      boost: verified.boost,
      score: verified.score,
    }).toEqual({
      x: s.x,
      z: s.z,
      y: s.y,
      floor: s.floor,
      boost: s.boost,
      score: s.score,
    });
    expect(verified.dust).toEqual(s.dust);
  });
  it.each(
    [
      null,
      [],
      [[0, 5399]],
      [[0, 5401]],
      [[128, 5400]],
      [[1, 1.5]],
      [[0, -1]],
      [[0, Infinity]],
      [[0, "5400"]],
      [
        [0, 5400],
        [0, 1],
      ],
    ].map((replay) => ({ replay })),
  )("rejects malformed, short or unbounded replay $replay", ({ replay }) => {
    expect(() => validateReplay(replay)).toThrow();
  });
  it("accepts a complete idle run with zero score", () => {
    expect(replayDaily(1, [[0, 5400]]).score).toBe(0);
  });
});
