// Promo-only editorial camera setup. Gameplay actions use the shipping 2.10 simulation.
import { Simulation, Keys } from "/src/game/simulation.ts";
import { loadLevel } from "/src/game/stages/load-data.ts";
const K = Keys;
export const SHOTS = [
  {
    id: "hook",
    stage: "culdesac",
    duration: 1.6,
    skin: "taxi",
    camera: "studio",
  },
  {
    id: "collect",
    stage: "apartment",
    duration: 3.2,
    speed: 1.25,
    skin: "taxi",
    camera: "chase",
    mode: "tutorial",
  },
  {
    id: "deliver",
    stage: "apartment",
    duration: 1.6,
    speed: 1.25,
    skin: "taxi",
    camera: "delivery",
    continue: true,
  },
  {
    id: "stairs",
    stage: "house",
    duration: 2.4,
    skin: "hotrod",
    camera: "chase",
    pose: { x: 5, z: 4.5, angle: Math.PI },
  },
  {
    id: "crawl",
    stage: "house",
    duration: 1.8,
    skin: "mint",
    camera: "first-person",
    pose: { x: 2.35, z: 4.65, angle: Math.PI, y: 2.8, floor: 1 },
  },
  {
    id: "drive",
    stage: "culdesac",
    duration: 2.8,
    skin: "hotrod",
    camera: "street",
    pose: { x: -4.4, z: -1.6, angle: Math.PI },
  },
  {
    id: "air",
    stage: "culdesac",
    duration: 2.2,
    skin: "neon",
    camera: "side",
    pose: { x: 2.3, z: 6, angle: Math.PI },
  },
  {
    id: "crater",
    stage: "moon",
    duration: 2,
    skin: "lunar",
    camera: "first-person",
    pose: { x: 0, z: -6, angle: 0 },
  },
  {
    id: "launch",
    stage: "moon",
    duration: 3,
    skin: "lunar",
    camera: "wide",
    pose: { x: 16, z: 6, angle: Math.PI / 2 },
  },
  {
    id: "skins",
    stage: "moon",
    duration: 2,
    skin: "gold",
    camera: "studio",
  },
  {
    id: "daily",
    stage: "culdesac",
    duration: 4,
    skin: "neon",
    camera: "street",
    mode: "daily",
    pose: { x: -4.4, z: -1.6, angle: Math.PI },
  },
  {
    id: "end",
    stage: "culdesac",
    duration: 3.4,
    skin: "taxi",
    camera: "studio",
  },
];
let at = 0;
for (const shot of SHOTS) {
  shot.start = Math.round(at * 100) / 100;
  at += shot.duration;
}
export const DURATION = Math.round(at * 100) / 100;
function circle(s, t) {
  const a = Math.atan2(s.x, s.z + 1.6) - 0.4;
  const target = Math.atan2(
    Math.sin(a) * 4.4 - s.x,
    -1.6 + Math.cos(a) * 4.4 - s.z,
  );
  const delta = Math.atan2(
    Math.sin(s.angle - target),
    Math.cos(s.angle - target),
  );
  const drifting = t > 1.9 && t < 2.8;
  return (
    K.forward |
    (!drifting && Math.abs(delta) < 0.7 ? K.boost : 0) |
    (delta > 0.045 ? K.right : delta < -0.045 ? K.left : 0) |
    (drifting ? K.drift : 0)
  );
}
export function input(shot, s, t) {
  switch (shot.id) {
    case "drive":
    case "daily":
      return circle(s, t);
    case "air":
      if (t > 1.25) return 0;
      return (
        K.forward |
        (t < 0.9 ? K.boost : 0) |
        (t > 0.6 && t < 0.65 ? K.hop : 0) |
        (t > 0.62 && t < 1.15 ? K.drift | K.left : 0)
      );
    case "collect":
      return t < 1.65 ? K.forward : K.reverse;
    case "deliver":
      return K.reverse;
    case "stairs":
      if (s.floor === 0 || s.z > 0.3) return K.forward | K.boost;
      if (s.angle > -1.62 && s.angle < -0.9) return K.forward;
      return K.left;
    case "crawl":
      return K.forward;
    case "crater":
      return K.forward | K.boost;
    case "launch":
      return (
        (t < 1.35 ? K.forward | K.boost : 0) |
        (t > 0.7 && t < 0.75 ? K.hop : 0) |
        (t > 0.8 && !s.grounded ? K.drift | K.left : 0)
      );
    default:
      return 0;
  }
}
export async function createShot(shot, previous) {
  if (shot.continue) return previous;
  const level = await loadLevel(shot.stage);
  let seed = 71;
  if (shot.id === "collect") {
    for (seed = 1; seed < 1000; seed++) {
      const test = new Simulation("tutorial", seed, level);
      for (let tick = 0; tick < 100; tick++) test.step(K.forward);
      if (test.bin.length === 5) break;
    }
    if (seed === 1000) throw new Error("No full-bin capture route found");
  }
  if (shot.id === "crawl") {
    for (seed = 1; seed < 200; seed++) {
      const test = new Simulation("freeroam", seed, level);
      if (
        test.dust.some(
          (d) =>
            d.y === 2.8 &&
            Math.abs(d.x - 2.35) < 0.32 &&
            d.z > 2.3 &&
            d.z < 4.1,
        )
      )
        break;
    }
  }
  const sim = new Simulation(shot.mode ?? "freeroam", seed, level);
  if (shot.pose)
    Object.assign(sim, shot.pose, {
      y: shot.pose.y ?? level.groundHeight(shot.pose.x, shot.pose.z),
    });
  return sim;
}
