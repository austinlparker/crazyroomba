import { heightField, flatPad, kicker, type Vertex2 } from "../terrain";
import { makeLevel, furniture as f, wall } from "./data-tools";
const ramp = {
  id: "launch-ramp",
  x: 8,
  z: -2,
  w: 2,
  d: 7,
  bottomZ: 1.5,
  topZ: -5.5,
  fromY: 0,
  toY: 2.8,
  steps: false,
};
export const outline: Vertex2[] = [
  [-28, -32],
  [-16, -29],
  [-7, -32],
  [8, -30],
  [19, -32],
  [30, -25],
  [34, -16],
  [31, -5],
  [36, 4],
  [32, 18],
  [24, 27],
  [12, 30],
  [3, 27],
  [-9, 32],
  [-23, 28],
  [-32, 20],
  [-36, 8],
  [-32, -3],
  [-35, -15],
];
export const jumps = [
  { x: 18, z: 6, w: 5, d: 5, h: 1.05 },
  { x: -20, z: 2, w: 5, d: 4, h: 0.9 },
  { x: 1, z: -23, w: 4, d: 4, h: 1.05 },
];
export const craters = [
  { x: 19, z: -13, radius: 7, depth: 0.6 },
  { x: -22, z: 17, radius: 6.5, depth: 0.55 },
  { x: 5, z: 21, radius: 5.5, depth: 0.5 },
  { x: -17, z: -21, radius: 5, depth: 0.45 },
  { x: 0, z: -2, radius: 3.3, depth: 0.55 },
  { x: 4, z: 5.5, radius: 2.5, depth: 0.4 },
  { x: -2, z: 8.6, radius: 1.8, depth: 0.25 },
];
const data = {
  id: "moon" as const,
  outline,
  outdoor: true,
  BOUNDS: { minX: -36, maxX: 36, minZ: -32, maxZ: 32 },
  DOCK: { x: -8.2, z: 8.8, y: 0 },
  DOCK_FACING: Math.PI,
  START: { x: -8.2, z: 7.6, y: 0, angle: Math.PI },
  DUST_COUNT: 64,
  cruise: 2.6,
  turbo: 7.2,
  traction: 6,
  FLOOR_REGIONS: [
    { floor: 0, x: 0, z: 0, w: 28, d: 24, finish: "terrace" },
    { floor: 0, x: 18, z: 9, w: 12, d: 16, finish: "terrace" },
    { floor: 0, x: -21, z: 8, w: 10, d: 18, finish: "terrace" },
    { floor: 0, x: 1, z: -21, w: 15, d: 12, finish: "terrace" },
    { floor: 0, x: 4, z: 22, w: 16, d: 10, finish: "terrace" },
    { floor: 1, x: 8, z: -8.4, w: 6, d: 5.8, finish: "tile" },
    { floor: 1, x: 8, z: -2, w: 2, d: 7, finish: "tile" },
  ],
  ROOMS: [
    {
      id: "regolith",
      name: "Tranquility Base",
      floor: 0,
      x: 0,
      z: 0,
      w: 26,
      d: 24,
      finish: "terrace",
      color: "#919caf",
    },
    {
      id: "launch",
      name: "Launch deck",
      floor: 1,
      x: 8,
      z: -8.4,
      w: 6,
      d: 5.8,
      finish: "tile",
      color: "#64d9dc",
    },
  ],
  WALLS: [
    { ...wall("deck-west", 5, -8.4, 0.12, 5.8, 0.7), floor: 1 },
    { ...wall("deck-east", 11, -8.4, 0.12, 5.8, 0.7), floor: 1 },
    { ...wall("deck-back", 8, -11.3, 6, 0.12, 0.7), floor: 1 },
    { ...wall("deck-front-left", 5.95, -5.5, 1.9, 0.12, 0.7), floor: 1 },
    { ...wall("deck-front-right", 10.05, -5.5, 1.9, 0.12, 0.7), floor: 1 },
  ],
  FURNITURE: [
    ...[
      [-29, -20, 2.4, 1.8, 1.1],
      [-25, 25, 2, 1.5, 0.8],
      [28, 19, 2.6, 2, 1.2],
      [25, -25, 3, 2.2, 1.1],
      [-30, 5, 1.6, 2.3, 0.8],
      [12, 26, 2.1, 1.5, 0.7],
      [-10, -25, 1.8, 1.4, 0.75],
      [29, -3, 1.5, 1.3, 0.6],
      [14, 8, 0.7, 0.8, 0.32],
      [22, 8, 0.9, 0.7, 0.4],
      [-24, 5, 0.8, 0.7, 0.3],
      [-16, 5, 0.7, 1, 0.35],
      [-3, -21, 0.8, 0.8, 0.3],
      [5, -21, 0.7, 0.9, 0.35],
    ].map(([x, z, w, d, h], i) => f(`basalt-${i}`, "rock", x, z, w, d, 0, h)),
    f("outpost", "habitat", -23, -9, 5.2, 3.7, 0.48, 3),
    f("east-array", "solar", 26, 1, 2.6, 3, 0.65, 0.8),
    f("remote-rover", "rover", 7, 22, 1.8, 2.6, 0.45, 1.4),
    f("far-antenna", "antenna", 1, -27, 1.6, 1.6, 0, 0.4),
    f("habitat", "habitat", -6, -5, 5.2, 3.7, 0.48, 3),
    f("antenna", "antenna", -8.5, 2, 1.6, 1.6, 0, 0.4),
    f("rover", "rover", -2, 2.1, 1.8, 2.6, 0.45, 1.4),
    f("solar", "solar", 2.3, -7.9, 2.6, 3, 0.65, 0.8),
    f("deck-support", "support", 8, -8.4, 6, 5.8, 0, 2.65),
    f("rocket", "rocket", 9, -9, 1.4, 1.4, 0, 3.8, 1),
  ],
  RAMPS: [ramp],
  BOOST_PADS: [
    { id: "east-charge", x: 18, z: 4, y: 0, w: 2, d: 1.5 },
    { id: "west-charge", x: -20, z: 0, y: 0, w: 2, d: 1.5 },
    { id: "north-charge", x: 1, z: -25, y: 0, w: 2, d: 1.5 },
    { id: "launch-charge", x: 8, z: 2.2, y: 0, w: 1.6, d: 1 },
    { id: "landing-charge", x: 8, z: -6.2, y: 2.8, w: 1.6, d: 0.8 },
    { id: "base-charge", x: -4.2, z: 5, y: 0, w: 1.3, d: 1.3 },
  ],
  routines: [],
} satisfies Omit<import("../navigation").LevelData, "COLLIDERS">;
const flatten = [
  ...data.FURNITURE.filter((o) => o.floor === 0).map((o) => [
    o.x,
    o.z,
    o.w + 1,
    o.d + 1,
  ]),
  [ramp.x, ramp.z, ramp.w + 1, ramp.d + 1.2],
  [data.DOCK.x, data.DOCK.z, 2.6, 3],
  ...data.BOOST_PADS.filter((p) => p.y === 0).map((p) => [
    p.x,
    p.z,
    p.w + 1,
    p.d + 1,
  ]),
];
export const level = makeLevel({
  ...data,
  terrain: heightField(-36, -32, 72, 64, 0.5, (x, z) => {
    let h = 0.12 + 0.14 * Math.sin(x * 0.27) * Math.cos(z * 0.32);
    for (const c of craters) {
      const r = Math.hypot(x - c.x, z - c.z) / c.radius;
      h +=
        0.62 * Math.exp(-(((r - 1) / 0.2) ** 2)) -
        c.depth * Math.exp(-r * r * 2.5);
    }
    h += 0.36 * Math.exp(-((x + 10) ** 2 + (z + 9) ** 2) / 16);
    const approach = jumps.reduce(
      (m, j) => Math.min(m, flatPad(x, z, j.x, j.z + 2, j.w + 3, 13, 2)),
      1,
    );
    const launch = jumps.reduce(
      (h, j) => Math.max(h, kicker(x, z, j.x, j.z, j.w, j.d, j.h)),
      0,
    );
    return (
      launch +
      h *
        approach *
        flatten.reduce(
          (m, [cx, cz, w, d]) => Math.min(m, flatPad(x, z, cx, cz, w, d, 1.5)),
          1,
        )
    );
  }),
});
