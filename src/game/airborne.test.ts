import { describe, expect, it } from "vitest";
import {
  Simulation,
  Keys,
  STEP,
  appendReplay,
  replayDaily,
  type Replay,
} from "./simulation";
import { createLevel } from "./navigation";
import { loadLevel } from "./stages/load-data";
import { heightField, insidePolygon } from "./terrain";
import { angleDelta, interpolatePose, cameraPose } from "./camera";
import { street, jumps as streetJumps } from "./stages/culdesac-data";
import { jumps as moonJumps } from "./stages/moon-data";

async function open(id: "culdesac" | "moon" = "culdesac") {
  const level = await loadLevel(id);
  return createLevel({
    ...level,
    START: { x: 0, y: 0, z: 0, angle: 0 },
    COLLIDERS: [],
    RAMPS: [],
    routines: [],
    FLOOR_REGIONS: [{ floor: 0, x: 0, z: 0, w: 60, d: 60, finish: "terrace" }],
    terrain: heightField(-36, -36, 72, 72, 1, () => 0),
    DUST_COUNT: 0,
  });
}
it("eases steering input and interpolates angle wrap without a full rotation", async () => {
  const s = new Simulation("freeroam", 1, await open());
  s.step(Keys.left);
  expect(s.yawRate).toBeGreaterThan(0);
  expect(s.yawRate).toBeLessThan(1);
  for (let i = 0; i < 30; i++) s.step(Keys.left);
  expect(s.yawRate).toBeCloseTo(2.4, 2);
  const before = s.yawRate;
  s.step(Keys.right);
  expect(s.yawRate).toBeGreaterThan(-2.4);
  expect(s.yawRate).toBeLessThan(before);
  const previous = { x: 0, y: 0, z: 0, angle: Math.PI - 0.02 },
    current = { x: 1, y: 0, z: 1, angle: -Math.PI + 0.02 };
  expect(interpolatePose(previous, current, 0.5)).toEqual({
    x: 0.5,
    y: 0,
    z: 0.5,
    angle: Math.PI,
  });
  expect(angleDelta(previous.angle, current.angle)).toBeCloseTo(0.04);
});
it("hops on a fresh press, lands once, and cannot auto-hop by holding the button", async () => {
  const s = new Simulation("freeroam", 1, await open());
  let landings = 0,
    peak = 0;
  for (let i = 0; i < 150; i++) {
    s.step(Keys.hop);
    peak = Math.max(peak, s.y);
    landings += s.events.filter((e) => e.kind === "land").length;
  }
  expect(peak).toBeGreaterThan(0.3);
  expect(peak).toBeLessThan(0.45);
  expect(landings).toBe(1);
  expect(s.y).toBe(0);
  expect(s.vy).toBe(0);
  expect(s.grounded).toBe(true);
  s.step(0);
  s.step(Keys.hop);
  expect(s.grounded).toBe(false);
});
it.each(["culdesac", "moon"] as const)(
  "buffers a fresh hop before landing once on %s, without repeating a held press",
  async (id) => {
    const level = await open(id),
      reference = new Simulation("freeroam", 1, level);
    reference.step(Keys.hop);
    while (!reference.grounded) reference.step(0);
    const touchdown = reference.ticks,
      s = new Simulation("daily", 1, level),
      replay: Replay = [],
      hops: number[] = [];
    for (let tick = 1; tick <= 5400; tick++) {
      const input = tick === 1 || tick >= touchdown - 4 ? Keys.hop : 0;
      s.step(input);
      appendReplay(replay, input);
      if (s.events.some((e) => e.kind === "hop")) hops.push(tick);
    }
    expect(hops).toEqual([1, touchdown + 1]);
    expect(s.grounded).toBe(true);
    expect(s.y).toBe(0);
    expect(s.ticks).toBe(5400);
    expect(s.remaining).toBe(0);
    const verified = replayDaily(s.seed, replay, level);
    expect(verified.y).toBe(s.y);
    expect(verified.boost).toBe(s.boost);
    expect(verified.grounded).toBe(s.grounded);
    expect(verified.score).toBe(s.score);
  },
);
it.each([
  { lead: 5, expected: 2 },
  { lead: 6, expected: 1 },
])(
  "keeps a landing hop only inside its six-tick buffer ($lead ticks early)",
  async ({ lead, expected }) => {
    const level = await open(),
      reference = new Simulation("freeroam", 1, level);
    reference.step(Keys.hop);
    while (!reference.grounded) reference.step(0);
    const s = new Simulation("freeroam", 1, level);
    let hops = 0;
    for (let tick = 1; tick <= 180; tick++) {
      s.step(tick === 1 || tick >= reference.ticks - lead ? Keys.hop : 0);
      hops += s.events.filter((e) => e.kind === "hop").length;
    }
    expect(hops).toBe(expected);
    expect(s.grounded).toBe(true);
  },
);
it("does not carry a stair hop press onto the downstairs landing", async () => {
  const level = await loadLevel("house"),
    ramp = level.RAMPS[0],
    direction = Math.sign(ramp.topZ - ramp.bottomZ),
    s = new Simulation("freeroam", 1, level),
    z = ramp.bottomZ + direction * 0.06;
  s.residents = [];
  Object.assign(s, {
    x: ramp.x,
    z,
    y: level.rampHeight(ramp, z),
    angle: direction > 0 ? Math.PI : 0,
    speed: 1.45,
    vz: -direction * 1.45,
  });
  const hops: number[] = [];
  for (let i = 0; i < 12; i++) {
    s.step(Keys.forward | Keys.hop);
    if (s.events.some((e) => e.kind === "hop")) hops.push(s.ticks);
  }
  expect(level.rampAt(s)).toBeUndefined();
  expect(s.y).toBe(0);
  expect(s.grounded).toBe(true);
  expect(hops).toEqual([]);
});
it("keeps flight momentum during a spin and awards a clean landing boost", async () => {
  const s = new Simulation("freeroam", 1, await open("moon"));
  s.speed = s.vz = 5;
  s.boost = 0;
  s.step(Keys.forward | Keys.hop);
  for (let i = 0; i < 62; i++) s.step(Keys.forward | Keys.drift | Keys.left);
  expect(s.grounded).toBe(false);
  expect(s.vz).toBeGreaterThan(3);
  expect(Math.abs(s.vx)).toBeLessThan(1);
  let trick = 0;
  for (let i = 0; i < 70; i++) {
    s.step(Keys.forward);
    trick += s.events
      .filter((e) => e.kind === "land")
      .reduce((n, e) => n + e.value, 0);
  }
  expect(trick).toBe(1);
  expect(s.boost).toBeGreaterThan(50);
  expect(s.score).toBe(0); // Tricks recharge the drive; the board still rewards deliveries.
});
it("sweeps a hop against a low underside without pushing through the table", async () => {
  const level = await open();
  const table = {
    id: "table",
    floor: 0 as const,
    kind: "table",
    x: 0,
    z: 0,
    w: 2,
    d: 2,
    bottom: 0.28,
    top: 0.4,
  };
  const s = new Simulation(
    "freeroam",
    1,
    createLevel({ ...level, COLLIDERS: [table] }),
  );
  for (let i = 0; i < 100; i++) {
    s.step(Keys.hop);
    expect(s.y + 0.13).toBeLessThanOrEqual(table.bottom + 1e-8);
    expect(s.x).toBe(0);
    expect(s.z).toBe(0);
  }
  expect(s.y).toBe(0);
});
it("lands on a prop and falls naturally off its edge", async () => {
  const level = await open();
  const s = new Simulation(
    "freeroam",
    1,
    createLevel({
      ...level,
      COLLIDERS: [
        {
          id: "block",
          floor: 0,
          kind: "block",
          x: 0,
          z: 0,
          w: 2,
          d: 2,
          bottom: 0,
          top: 0.25,
        },
      ],
    }),
  );
  s.y = 0.8;
  s.grounded = false;
  for (let i = 0; i < 50; i++) s.step(0);
  expect(s.y).toBe(0.25);
  let airborne = false;
  for (let i = 0; i < 150; i++) {
    s.step(Keys.forward);
    airborne ||= !s.grounded;
    expect(s.y).toBeGreaterThanOrEqual(0);
  }
  expect(airborne).toBe(true);
  expect(s.y).toBe(0);
});
describe.each(["culdesac", "moon"] as const)("%s ramp course", (id) => {
  it("launches from its new kicker, clears the ground and lands", async () => {
    const level = await loadLevel(id),
      j = (id === "moon" ? moonJumps : streetJumps)[0],
      s = new Simulation("freeroam", 1, level);
    Object.assign(s, {
      x: j.x,
      z: j.z - 2,
      y: level.groundHeight(j.x, j.z - 2),
      angle: 0,
    });
    let flight = 0,
      peak = 0,
      landed = false;
    for (let i = 0; i < 230; i++) {
      s.step(Keys.forward | Keys.boost);
      if (!s.grounded) {
        flight++;
        peak = Math.max(peak, s.y - level.groundHeight(s.x, s.z));
      }
      if (s.events.some((e) => e.kind === "land")) landed = true;
      expect(Number.isFinite(s.y)).toBe(true);
      expect(s.y).toBeGreaterThanOrEqual(level.groundHeight(s.x, s.z) - 1e-7);
    }
    expect(flight).toBeGreaterThan(12);
    expect(peak).toBeGreaterThan(0.4);
    expect(landed).toBe(true);
  });
});
it("keeps every point on the asphalt flat while lawns retain elevation", async () => {
  const level = await loadLevel("culdesac");
  let road = 0,
    lawn = 0;
  for (let x = -23.8; x < 24; x += 0.31)
    for (let z = -23.8; z < 23; z += 0.37) {
      if (insidePolygon(x, z, street)) {
        expect(level.groundHeight(x, z)).toBe(0);
        road++;
      } else if (level.groundHeight(x, z) > 0.2) lawn++;
    }
  expect(road).toBeGreaterThan(1000);
  expect(lawn).toBeGreaterThan(1000);
});
it("keeps an airborne camera with the chassis rather than dragging it onto the ramp", async () => {
  const level = await loadLevel("moon");
  const p = cameraPose(
    { x: 8, z: -3, y: 4, angle: Math.PI, grounded: false, floor: 0 },
    "chase",
    level,
  );
  expect(p.anchor.y).toBeGreaterThan(4);
  expect(p.target.y).toBeGreaterThan(4);
});
it("replays hops, spins and landing state exactly", async () => {
  const level = await loadLevel("moon"),
    s = new Simulation("daily", 517, level),
    r: Replay = [];
  for (let i = 0; i < 5400; i++) {
    const input =
      Keys.forward |
      Keys.boost |
      (i % 150 < 80 ? Keys.left | Keys.drift : 0) |
      (i % 130 === 0 ? Keys.hop : 0);
    s.step(input);
    appendReplay(r, input);
  }
  const replay = replayDaily(s.seed, r, level);
  for (const k of [
    "x",
    "y",
    "z",
    "vy",
    "yawRate",
    "grounded",
    "boost",
    "score",
    "floor",
  ] as const)
    expect(replay[k]).toBe(s[k]);
  expect(STEP).toBe(1 / 60);
});

it("blocks airborne side entry into a ramp instead of snapping onto its high surface", async () => {
  const level = await loadLevel("moon"),
    s = new Simulation("freeroam", 1, level);
  Object.assign(s, {
    x: 6.7,
    z: -3,
    y: 0.5,
    grounded: false,
    vy: -0.2,
    angle: Math.PI / 2,
    vx: 5,
    speed: 5,
  });
  let previous = s.y;
  for (let i = 0; i < 35; i++) {
    s.step(Keys.forward | Keys.boost);
    expect(s.y - previous).toBeLessThan(0.1);
    previous = s.y;
  }
  expect(s.x).toBeLessThan(7);
  expect(s.floor).toBe(0);
});

it("opens the apartment crawl portal and both house garden entrances", async () => {
  const apartment = await loadLevel("apartment"),
    house = await loadLevel("house");
  for (let x = 0.5; x < 1.6; x += 0.05)
    expect(apartment.walkable({ x, z: 0.08, y: 0 })).toBe(true);
  expect(apartment.clearanceAt({ x: 1, z: 0.08, y: 0 })).toBe(0.26);
  for (const x of [-0.4, 2.6])
    for (let z = 6.4; z < 10.4; z += 0.05)
      expect(house.walkable({ x, z, y: 0 }), `${x},${z}`).toBe(true);
  for (let x = -0.4; x < 2.6; x += 0.05)
    expect(house.walkable({ x, z: 10.4, y: 0 })).toBe(true);
});

it("can complete a boost-hop 360 in normal gravity", async () => {
  const s = new Simulation("freeroam", 1, await open());
  s.speed = s.vz = 5.2;
  s.step(Keys.forward | Keys.boost | Keys.hop);
  let turns = 0;
  for (let i = 0; i < 65; i++) {
    s.step(Keys.forward | Keys.boost | Keys.drift | Keys.left);
    turns += s.events
      .filter((e) => e.kind === "land")
      .reduce((sum, e) => sum + e.value, 0);
  }
  expect(turns).toBe(1);
});
