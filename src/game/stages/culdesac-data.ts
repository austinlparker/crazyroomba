import { heightField, flatPad, kicker, type Vertex2 } from "../terrain";
import { makeLevel, furniture as f } from "./data-tools";
// The bulb and approach are one level asphalt slab, with flat adjoining drives.
export const street: Vertex2[] = [
  [-3.45, -24],
  [3.45, -24],
];
const join = Math.acos(3.45 / 8.5);
for (let i = 0; i <= 64; i++) {
  const a = -join + ((Math.PI + 2 * join) * i) / 64;
  street.push([Math.cos(a) * 8.5, Math.sin(a) * 8.5 - 1]);
}
export const outline: Vertex2[] = [
  [-5, -24],
  [5, -24],
  [9, -23],
  [18, -23],
  [23, -18],
  [22, -10],
  [24, -3],
  [22, 5],
  [24, 13],
  [19, 21],
  [10, 23],
  [3, 20],
  [-5, 23],
  [-15, 21],
  [-23, 15],
  [-24, 6],
  [-22, -2],
  [-24, -12],
  [-20, -21],
  [-10, -23],
];
export const jumps = [
  { x: 17, z: 9, w: 3.6, d: 3.5, h: 0.85 },
  { x: -17, z: 9, w: 3.2, d: 3, h: 0.7 },
];
const data = {
  id: "culdesac" as const,
  outline,
  outdoor: true,
  BOUNDS: { minX: -24, maxX: 24, minZ: -24, maxZ: 23 },
  DOCK: { x: 0, z: 8.4, y: 0 },
  DOCK_FACING: Math.PI,
  START: { x: 0, z: 7.2, y: 0, angle: Math.PI },
  DUST_COUNT: 52,
  cruise: 2.1,
  turbo: 5.2,
  FLOOR_REGIONS: [
    {
      floor: 0 as const,
      x: 0,
      z: -1.4,
      w: 24,
      d: 24.8,
      finish: "terrace" as const,
    },
    { floor: 0, x: -17, z: 11, w: 9, d: 14, finish: "terrace" },
    { floor: 0, x: 17, z: 11, w: 9, d: 14, finish: "terrace" },
    { floor: 0, x: 0, z: -18, w: 8, d: 10, finish: "terrace" },
  ],
  ROOMS: [
    {
      id: "court",
      name: "The court",
      floor: 0,
      x: 0,
      z: 0,
      w: 22,
      d: 20,
      finish: "terrace",
      color: "#55a187",
    },
    {
      id: "drive",
      name: "Driveway",
      floor: 0,
      x: 0,
      z: -11,
      w: 8,
      d: 2,
      finish: "terrace",
      color: "#829baa",
    },
  ],
  WALLS: [],
  FURNITURE: [
    ...outline
      .filter((_, i) => i % 2 === 0)
      .map(([x, z], i) =>
        f(`edge-tree-${i}`, "tree", x * 0.96, z * 0.96, 0.65, 0.65, 0, 2.8),
      ),
    f("house-west", "house", -16, -5, 5.1, 7.2, 0, 5.3),
    f("house-east", "house", 16, -5, 5.1, 7.2, 0, 5.3),
    f("house-southwest", "house", -10, -18.5, 7.2, 5.1, 0, 5.3),
    f("house-southeast", "house", 10, -18.5, 7.2, 5.1, 0, 5.3),
    f("porch-west", "porch", -12.95, -5, 1.5, 2.6, 0, 0.24),
    f("porch-east", "porch", 12.95, -5, 1.5, 2.6, 0, 0.24),
    f("porch-sw", "porch", -10, -15.45, 2.6, 1.5, 0, 0.24),
    f("porch-se", "porch", 10, -15.45, 2.6, 1.5, 0, 0.24),
    f("yard-tree-w", "tree", -20, 4, 0.5, 0.5, 0, 2.5),
    f("yard-tree-e", "tree", 20, 18, 0.5, 0.5, 0, 2.5),
    f("yard-picnic", "table", -14, 17, 2.4, 1.4, 0.75, 0.86),
    f("yard-grill", "grill", 13, 15, 1, 0.7, 0, 1.1),
    f("tree-nw", "tree", -9, -8, 0.42, 0.42, 0, 1.7),
    f("tree-se", "tree", 9, 8, 0.42, 0.42, 0, 1.7),
    f("tree-west", "tree", -10, 3, 0.42, 0.42, 0, 1.7),
    f("tree-ne", "tree", 10, -8, 0.42, 0.42, 0, 1.7),
    f("hoop", "hoop", 8.8, -8.7, 0.12, 0.12, 0, 3),
    f("basketball", "ball", 6.9, -7.8, 0.32, 0.32, 0, 0.32),
    f("island", "planter", 0, -1.6, 3.3, 3.3, 0, 0.42),
    f("van", "van", -6.4, -4, 2.15, 4.3, 0.35, 1.95),
    f("wagon", "car", 6.2, 1.8, 2.1, 4, 0.28, 1.2),
    f("picnic", "table", -5.6, 4.8, 2.4, 1.4, 0.75, 0.86),
    f("bin-a", "bin", 7.8, -6.9, 0.65, 0.7, 0, 1),
    f("bin-b", "bin", 8.7, -6.9, 0.65, 0.7, 0, 1),
    f("shed", "shed", -8.9, 7.6, 2.3, 2.8, 0, 2.2),
    f("barbecue", "grill", 8.8, 6.8, 1, 0.7, 0, 1.1),
    f("garden-west", "planter", -9.3, -0.2, 1.1, 3.6, 0, 0.45),
    f("garden-east", "planter", 9, -2.5, 1.5, 2.5, 0, 0.45),
  ],
  RAMPS: [],
  BOOST_PADS: [
    { id: "east-kicker", x: 17, z: 7, y: 0, w: 2, d: 1.2 },
    { id: "west-kicker", x: -17, z: 7, y: 0, w: 2, d: 1.2 },
    { id: "approach", x: 0, z: -20, y: 0, w: 1.4, d: 2 },
    { id: "street-boost", x: 0, z: -8, y: 0, w: 1.4, d: 1.6 },
    { id: "yard-boost", x: -5, z: 1.5, y: 0, w: 1.3, d: 1.2 },
    { id: "drive-boost", x: 4, z: 6, y: 0, w: 1.3, d: 1.2 },
  ],
  routines: [
    {
      id: "biscuit",
      kind: "dog",
      floor: 0,
      radius: 0.31,
      height: 0.6,
      speed: 1,
      color: "#aa784b",
      route: [
        { x: -3.3, z: -5, wait: 90 },
        { x: 3.2, z: -5 },
        { x: 3.2, z: 3.3, wait: 60 },
        { x: -3.3, z: 3.3 },
      ],
    },
    {
      id: "alex",
      kind: "person",
      floor: 0,
      radius: 0.23,
      height: 1.72,
      speed: 0.8,
      color: "#bd6b68",
      route: [
        { x: -2.7, z: 6 },
        { x: 2.7, z: 6, wait: 150 },
        { x: 2.7, z: 1 },
        { x: 2.7, z: 6 },
        { x: -2.7, z: 6, wait: 120 },
      ],
    },
  ],
} satisfies Omit<import("../navigation").LevelData, "COLLIDERS">;
const flatten = [
  ...data.FURNITURE.filter((o) => o.floor === 0).map((o) => [
    o.x,
    o.z,
    o.w + (o.kind === "house" ? 3 : 1),
    o.d + (o.kind === "house" ? 3 : 1),
  ]),
  [data.DOCK.x, data.DOCK.z, 2.4, 2.8],
  ...data.BOOST_PADS.map((p) => [p.x, p.z, p.w + 1, p.d + 1]),
];
export const level = makeLevel({
  ...data,
  terrain: heightField(-24, -24, 48, 48, 0.5, (x, z) => {
    const h =
      0.28 +
      0.2 * Math.sin(x * 0.28) * Math.cos(z * 0.22) +
      0.6 * Math.exp(-((x - 18) ** 2 + (z - 18) ** 2) / 42);
    // Extra 0.8m shoulder covers every grid triangle touching the asphalt edge.
    const roadMask = Math.min(
      Math.max(0, Math.min(1, (Math.hypot(x, z + 1) - 9.3) / 2.2)),
      flatPad(x, z, 0, -17, 8.5, 18, 2),
      flatPad(x, z, -6.4, -1.7, 4.6, 14.9, 1.5),
      flatPad(x, z, 6.2, -1.7, 4.6, 14.9, 1.5),
    );
    const foundations = flatten.reduce(
      (m, [cx, cz, w, d]) => Math.min(m, flatPad(x, z, cx, cz, w, d, 1.8)),
      1,
    );
    const launch = jumps.reduce(
      (h, j) => Math.max(h, kicker(x, z, j.x, j.z, j.w, j.d, j.h)),
      0,
    );
    // A flat approach makes each lip deliberate rather than an accidental bump.
    const approach = jumps.reduce(
      (m, j) => Math.min(m, flatPad(x, z, j.x, j.z + 2, j.w + 2, 10, 2)),
      1,
    );
    return h * roadMask * foundations * approach + launch;
  }),
});
