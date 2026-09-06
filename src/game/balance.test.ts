import { describe, expect, it } from "vitest";
import { createLevel } from "./navigation";
import { CHAIN_WINDOW } from "./driving-rewards";
import {
  ARCADE_START_SECONDS,
  ARCADE_TIME_BUDGET,
  FULL_BIN_SECONDS,
  DUST_RESPAWN_TICKS,
  CAPACITY,
  DAILY_TICKS,
  Keys,
  Simulation,
  appendReplay,
  replayDaily,
  type Dust,
  type GameEvent,
  type Mode,
  type Replay,
} from "./simulation";

function course(mode: Mode = "arcade") {
  return new Simulation(
    mode,
    81,
    createLevel({
      id: "apartment",
      outdoor: true,
      BOUNDS: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
      START: { x: 0, z: -4, y: 0, angle: 0 },
      DOCK: { x: 0, z: -4, y: 0 },
      DOCK_FACING: 0,
      DUST_COUNT: 0,
      FLOOR_REGIONS: [{ floor: 0, x: 0, z: 0, w: 20, d: 20, finish: "wood" }],
      ROOMS: [],
      WALLS: [],
      FURNITURE: [],
      COLLIDERS: [],
      RAMPS: [],
      BOOST_PADS: [],
      routines: [],
    }),
  );
}
function advance(s: Simulation, frames: number, input = 0) {
  const events: GameEvent[] = [];
  for (let i = 0; i < frames; i++) {
    s.step(input);
    events.push(...s.events);
  }
  return events;
}
function bank(s: Simulation, count = CAPACITY) {
  s.x = 0;
  s.z = -2;
  s.step(0); // Leave the dock and rearm the delivery zone.
  s.x = 0;
  s.z = -4;
  s.bin = Array(count).fill(100);
  s.step(0);
  return s.events.find((e) => e.kind === "deposit")!;
}
const dust = (id: number, z = 0): Dust => ({
  id,
  x: 0,
  y: 0,
  z,
  value: 100,
  active: true,
  respawnAt: 0,
});

describe("finite arcade clock", () => {
  it("awards time only for full loads and reports the seconds actually added", () => {
    const s = course();
    expect(s.remaining).toBe(ARCADE_START_SECONDS * 60);
    expect(bank(s, 1).timeAdded).toBe(0);
    expect(s.score).toBe(110);
    expect(s.arcadeTimeEarned).toBe(0);
    const event = bank(s);
    expect(event.timeAdded).toBe(FULL_BIN_SECONDS);
    expect(event.chain).toBe(1);
    expect(s.score).toBe(1110);
    expect(s.remaining).toBe(
      (ARCADE_START_SECONDS + FULL_BIN_SECONDS) * 60 - 4,
    );
  });

  it("caps all earned time at 45 seconds, including exact partial final awards", () => {
    const s = course();
    const bonuses = Array.from({ length: 10 }, () => bank(s).timeAdded);
    expect(bonuses).toEqual([8, 8, 8, 8, 8, 5, 0, 0, 0, 0]);
    expect(s.arcadeTimeEarned).toBe(ARCADE_TIME_BUDGET);
    expect(s.remaining + s.ticks).toBe(105 * 60);
    expect(s.score).toBeGreaterThan(0); // Banking keeps scoring after the time budget is exhausted.
    advance(s, s.remaining);
    expect(s.ended).toBe(true);
    expect(s.ticks).toBe(105 * 60);
  });

  it("ends even when an adversarial player keeps delivering full bins", () => {
    const s = course();
    while (!s.ended) bank(s);
    expect(s.ticks).toBe((ARCADE_START_SECONDS + ARCADE_TIME_BUDGET) * 60);
    expect(s.remaining).toBe(0);
    expect(s.arcadeTimeEarned).toBe(45);
  });

  it("keeps Daily exactly 90 seconds and Free roam intentionally untimed", () => {
    for (const mode of ["daily", "freeroam"] as const) {
      const s = course(mode);
      for (let i = 0; i < 12; i++) expect(bank(s).timeAdded).toBe(0);
      expect(s.arcadeTimeEarned).toBe(0);
      advance(s, DAILY_TICKS - s.ticks);
      expect(s.ended).toBe(mode === "daily");
      expect(s.remaining).toBe(mode === "daily" ? 0 : Infinity);
    }
  });
});

describe("route and camping rules", () => {
  it("does not respawn carried dust before its delivery", () => {
    const s = course("freeroam");
    s.dust = [dust(0)];
    s.z = 0;
    s.step(0);
    s.z = 4;
    advance(s, DUST_RESPAWN_TICKS * 3);
    expect(s.dust[0].active).toBe(false);
    expect(s.bin).toEqual([100]);
    expect(s.deposited).toBe(0);
  });

  it("respawns a banked pickup at its original spot after the cooldown", () => {
    const s = course("freeroam");
    s.dust = [dust(0)];
    s.z = 0;
    s.step(0);
    s.z = -4;
    s.step(0);
    const ready = s.dust[0].respawnAt;
    expect(ready).toBe(s.ticks + DUST_RESPAWN_TICKS);
    advance(s, DUST_RESPAWN_TICKS - 1);
    expect(s.dust[0].active).toBe(false);
    s.step(0);
    expect(s.dust[0]).toMatchObject({ active: true, x: 0, y: 0, z: 0 });
  });

  it("waits for a camper to leave a respawn spot and never vacuums its replacement immediately", () => {
    const s = course("freeroam");
    s.dust = [dust(0)];
    s.z = 0;
    s.step(0);
    s.z = -4;
    s.step(0);
    s.z = 0;
    const events = advance(s, DUST_RESPAWN_TICKS * 3);
    expect(events.some((e) => e.kind === "pickup")).toBe(false);
    expect(s.bin).toHaveLength(0);
    expect(s.dust[0].active).toBe(false);
    Object.assign(s, { y: 0.8, grounded: false, vy: 0 });
    s.step(0); // A high jump must not manufacture a fresh pickup beneath us.
    expect(s.dust[0].active).toBe(false);
    Object.assign(s, { y: 0, grounded: true });
    s.z = 2.3;
    s.step(0);
    expect(s.dust[0].active).toBe(true);
    expect(s.bin).toHaveLength(0);
  });

  it("requires leaving the dock before another bank or combo can happen", () => {
    const s = course();
    bank(s);
    s.bin = Array(CAPACITY).fill(100);
    const events = advance(s, 90);
    expect(events.some((e) => e.kind === "deposit")).toBe(false);
    expect(s.deliveries).toBe(1);
    expect(s.chain.count).toBe(1);
    expect(s.arcadeTimeEarned).toBe(8);
    bank(s);
    expect(s.deliveries).toBe(2);
    expect(s.chain.count).toBe(2);
  });

  it("keeps a real collection circuit repeatable without extending a daily replay", () => {
    const s = course("daily");
    // Initial dust is generated by a tiny level for the actual deterministic replay.
    const level = createLevel({
      ...s.level,
      DUST_COUNT: 8,
      FLOOR_REGIONS: [{ floor: 0, x: 0, z: -1, w: 1, d: 8, finish: "wood" }],
      BOUNDS: { minX: -1, maxX: 1, minZ: -5, maxZ: 5 },
    });
    const route = new Simulation("daily", 4, level),
      replay: Replay = [];
    let returning = false;
    for (let i = 0; i < DAILY_TICKS; i++) {
      if (route.bin.length === CAPACITY || route.z > 2.1) returning = true;
      if (route.z < -3.3 && !route.bin.length) returning = false;
      const targetZ = returning ? -4 : 2.5;
      const target = Math.atan2(-route.x, targetZ - route.z);
      const delta = Math.atan2(
        Math.sin(target - route.angle),
        Math.cos(target - route.angle),
      );
      let input =
        Math.abs(delta) > 0.04 ? (delta > 0 ? Keys.left : Keys.right) : 0;
      if (Math.abs(delta) < 0.15) input |= Keys.forward | Keys.boost;
      route.step(input);
      appendReplay(replay, input);
    }
    const verified = replayDaily(4, replay, level);
    expect(route.deposited).toBeGreaterThanOrEqual(5);
    expect(route.deliveries).toBeGreaterThanOrEqual(3);
    expect(verified.score).toBe(route.score);
    expect(verified.dust).toEqual(route.dust);
    expect(verified.deliveries).toBe(route.deliveries);
    expect(verified.remaining).toBe(0);
    expect(verified.ticks).toBe(DAILY_TICKS);
  });
});

describe("explicit combo loss", () => {
  it("emits timeout once at the exact deadline with the multiplier being lost", () => {
    const s = course("freeroam");
    bank(s);
    bank(s);
    const deadline = s.chain.expires;
    expect(
      advance(s, deadline - s.ticks - 1).filter((e) => e.kind === "chain-lost"),
    ).toHaveLength(0);
    s.step(0);
    expect(s.events.find((e) => e.kind === "chain-lost")).toMatchObject({
      value: 1.25,
      chain: 2,
      reason: "timeout",
    });
    expect(s.chain.count).toBe(0);
    expect(s.chain.best).toBe(2);
    expect(
      advance(s, CHAIN_WINDOW).filter((e) => e.kind === "chain-lost"),
    ).toHaveLength(0);
  });

  it("explains partial-bin losses without reducing the partial delivery's base points", () => {
    const s = course();
    bank(s);
    bank(s);
    const score = s.score;
    const event = bank(s, 2);
    expect(s.events.find((e) => e.kind === "chain-lost")).toMatchObject({
      value: 1.25,
      reason: "partial",
    });
    expect(event.value).toBe(240);
    expect(event.timeAdded).toBe(0);
    expect(s.score - score).toBe(240);
    expect(s.chain.count).toBe(0);
    bank(s, 2);
    expect(s.events.some((e) => e.kind === "chain-lost")).toBe(false);
  });

  it("announces a collision loss once and leaves unchained bumps quiet", () => {
    const s = course("freeroam");
    bank(s);
    bank(s);
    Object.assign(s, { x: 0, z: 9.81, speed: 3.2, vz: 3.2 });
    s.step(Keys.forward | Keys.boost);
    expect(s.events.find((e) => e.kind === "chain-lost")).toMatchObject({
      value: 1.25,
      reason: "collision",
    });
    expect(s.chain.count).toBe(0);
    expect(
      advance(s, 120, Keys.forward | Keys.boost).filter(
        (e) => e.kind === "chain-lost",
      ),
    ).toHaveLength(0);
  });
});
