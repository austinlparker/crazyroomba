import {
  FLOOR_HEIGHT,
  type Furniture,
  type Collider,
  type FloorRegion,
  type Room,
  type Wall,
  type Opening,
} from "./level-types";
export * from "./level-types";
import { createLevel } from "./navigation";
import { ROUTINES } from "./household";
export const DUST_COUNT = 28;
export const BOUNDS = { minX: -5.8, maxX: 5.8, minZ: -5.2, maxZ: 11.3 };
// The charging/bin tower backs onto the living room's east wall.
export const DOCK = { x: 3.62, z: 0.88, y: 0 };
export const DOCK_FACING = -Math.PI / 2;
export const START = { x: DOCK.x - 1.1, z: DOCK.z, y: 0, angle: DOCK_FACING };

export const RAMPS = [
  {
    id: "front-stair",
    x: 5,
    z: 2.35,
    w: 1.25,
    d: 3.5,
    bottomZ: 4.1,
    topZ: 0.6,
    fromY: 0,
    toY: FLOOR_HEIGHT,
  },
  {
    id: "back-stair",
    x: 5,
    z: -2.35,
    w: 1.25,
    d: 3.5,
    bottomZ: -4.1,
    topZ: -0.6,
    fromY: 0,
    toY: FLOOR_HEIGHT,
  },
];
export const BOOST_PADS = RAMPS.flatMap((r) => {
  const direction = Math.sign(r.topZ - r.bottomZ);
  return [
    {
      id: `${r.id}-lower`,
      x: r.x,
      z: r.bottomZ - direction * 0.48,
      y: 0,
      w: 1.05,
      d: 0.65,
    },
    {
      id: `${r.id}-upper`,
      x: r.x,
      z: r.topZ + direction * 0.3,
      y: FLOOR_HEIGHT,
      w: 1.05,
      d: 0.45,
    },
  ];
});
BOOST_PADS.push({ id: "garden-charge", x: 2.6, z: 9, y: 0, w: 1.1, d: 0.7 });
// Alhambra-derived plan: a social loop below, hall / bathroom / bedrooms above.
// Rectangles meet at shared edges; voids outside their union are not drivable.
export const FLOOR_REGIONS: FloorRegion[] = [
  { floor: 0, x: -0.4, z: 0, w: 9.2, d: 10, finish: "wood" },
  { floor: 0, x: 5, z: 0, w: 1.6, d: 10.4, finish: "wood" },
  { floor: 0, x: -5.4, z: 2.4, w: 0.8, d: 2.4, finish: "tile" },
  { floor: 0, x: -0.4, z: 6, w: 9.2, d: 2, finish: "terrace" },
  { floor: 0, x: -0.4, z: 8, w: 2.2, d: 2, finish: "terrace" },
  { floor: 0, x: -1.8, z: 10, w: 5, d: 2.6, finish: "terrace" },
  { floor: 0, x: 2.6, z: 8.8, w: 2.2, d: 3.6, finish: "terrace" },
  { floor: 0, x: 0.8, z: 10.4, w: 5.8, d: 1.8, finish: "terrace" },
  { floor: 1, x: -0.4, z: 0, w: 9.2, d: 10, finish: "wood" },
  { floor: 1, x: 5, z: 0, w: 1.6, d: 8.2, finish: "wood" },
  { floor: 1, x: -3.35, z: 5.75, w: 3.3, d: 1.5, finish: "terrace" },
];
export const ROOMS: Room[] = [
  {
    id: "garden",
    name: "Garden terrace",
    floor: 0,
    x: -1.8,
    z: 10,
    w: 5,
    d: 2.6,
    finish: "terrace",
    color: "#739379",
  },
  {
    id: "living",
    name: "Living room",
    floor: 0,
    x: 0.85,
    z: 2.5,
    w: 6.7,
    d: 5,
    finish: "wood",
    color: "#d76936",
  },
  {
    id: "sunroom",
    name: "Sunroom",
    floor: 0,
    x: -3.75,
    z: 2.5,
    w: 2.5,
    d: 5,
    finish: "tile",
    color: "#caac54",
  },
  {
    id: "dining",
    name: "Dining room",
    floor: 0,
    x: -2.7,
    z: -2.5,
    w: 4.6,
    d: 5,
    finish: "wood",
    color: "#497c70",
  },
  {
    id: "kitchen",
    name: "Kitchen",
    floor: 0,
    x: 1.9,
    z: -2.5,
    w: 4.6,
    d: 5,
    finish: "tile",
    color: "#337a81",
  },
  {
    id: "porch",
    name: "Front terrace",
    floor: 0,
    x: -0.4,
    z: 6,
    w: 9.2,
    d: 2,
    finish: "terrace",
    color: "#a37659",
  },
  {
    id: "study",
    name: "Box room",
    floor: 1,
    x: -3.6,
    z: -3.1,
    w: 2.8,
    d: 3.8,
    finish: "wood",
    color: "#75918c",
  },
  {
    id: "bathroom",
    name: "Bathroom",
    floor: 1,
    x: -1.2,
    z: -3.1,
    w: 2,
    d: 3.8,
    finish: "tile",
    color: "#89b3b0",
  },
  {
    id: "bedroom",
    name: "Guest bedroom",
    floor: 1,
    x: 2,
    z: -3.1,
    w: 4.4,
    d: 3.8,
    finish: "wood",
    color: "#cb985a",
  },
  {
    id: "landing",
    name: "Upper landing",
    floor: 1,
    x: 0.4,
    z: -0.45,
    w: 10.8,
    d: 1.5,
    finish: "wood",
    color: "#b29378",
  },
  {
    id: "hall",
    name: "Hall",
    floor: 1,
    x: -0.95,
    z: 2.65,
    w: 1.5,
    d: 4.7,
    finish: "wood",
    color: "#b29378",
  },
  {
    id: "party",
    name: "Spare room",
    floor: 1,
    x: -3.35,
    z: 2.65,
    w: 3.3,
    d: 4.7,
    finish: "wood",
    color: "#8b659b",
  },
  {
    id: "main-bedroom",
    name: "Main bedroom",
    floor: 1,
    x: 2,
    z: 2.65,
    w: 4.4,
    d: 4.7,
    finish: "wood",
    color: "#64988e",
  },
  {
    id: "balcony",
    name: "Bedroom balcony",
    floor: 1,
    x: -3.35,
    z: 5.75,
    w: 3.3,
    d: 1.5,
    finish: "terrace",
    color: "#a37659",
  },
];
export const WALLS: Wall[] = [];
export const OPENINGS: Opening[] = [];
type Aperture = { center: number; width: number; type?: "door" | "window" };
function wall(
  floor: 0 | 1,
  axis: "x" | "z",
  at: number,
  start: number,
  end: number,
  apertures: Aperture[] = [],
  exterior = false,
  height = 2.65,
) {
  const thickness = exterior ? 0.2 : 0.14;
  function piece(a: number, b: number, bottom = 0, top = height) {
    if (b - a < 0.001 || top - bottom < 0.001) return;
    WALLS.push({
      id: `wall-${WALLS.length}`,
      kind: "wall",
      floor,
      exterior,
      x: axis === "x" ? (a + b) / 2 : at,
      z: axis === "z" ? (a + b) / 2 : at,
      w: axis === "x" ? b - a : thickness,
      d: axis === "z" ? b - a : thickness,
      bottom,
      top,
    });
  }
  let cursor = start;
  for (const a of [...apertures].sort((a, b) => a.center - b.center)) {
    const left = a.center - a.width / 2,
      right = a.center + a.width / 2;
    const bottom = a.type === "window" ? 0.8 : 0,
      top = a.type === "window" ? 2.25 : 2.12;
    piece(cursor, left);
    piece(left, right, 0, bottom);
    piece(left, right, top, height);
    OPENINGS.push({
      id: `opening-${OPENINGS.length}`,
      floor,
      axis,
      at,
      center: a.center,
      width: a.width,
      type: a.type ?? "door",
      bottom,
      top,
    });
    cursor = right;
  }
  piece(cursor, end);
}
const win = (center: number, width = 1.3): Aperture => ({
  center,
  width,
  type: "window",
});
const door = (center: number, width = 1.05): Aperture => ({ center, width });
// Exterior walls follow the stepped outline, with a true box bay and terraces.
for (const floor of [0, 1] as const) {
  wall(
    floor,
    "x",
    -5,
    -5,
    4.2,
    [win(-3.6), win(-1.2, 0.85), win(2.1, 1.7)],
    true,
  );
  wall(floor, "z", 4.2, -5.2, -5, [], true);
  wall(floor, "x", -5.2, 4.2, 5.8, [win(5, 0.75)], true);
  wall(
    floor,
    "z",
    5.8,
    -5.2,
    5.2,
    [win(-3.2, 0.85), win(0, 0.65), win(3.2, 0.85)],
    true,
  );
  wall(floor, "x", 5.2, 4.2, 5.8, [win(5, 0.8)], true);
  wall(floor, "z", 4.2, 5, 5.2, [], true);
  if (floor === 0) {
    wall(0, "z", -5, -5, 1.2, [win(-3.1, 1.6), win(0.35, 0.85)], true);
    wall(0, "x", 1.2, -5.8, -5, [], true);
    wall(0, "z", -5.8, 1.2, 3.6, [win(2.4, 1.8)], true);
    wall(0, "x", 3.6, -5.8, -5, [], true);
    wall(0, "z", -5, 3.6, 5, [win(4.3, 0.75)], true);
    wall(
      0,
      "x",
      5,
      -5,
      4.2,
      [door(-3.75, 0.95), win(-0.6, 2.1), door(2.8, 1.15)],
      true,
    );
    wall(0, "z", -5, 5, 7, [], true, 0.8);
    wall(0, "x", 7, -5, 4.2, [door(-0.4, 1.4), door(2.6, 1.5)], true, 0.8);
    wall(0, "z", -1.5, 7, 8.7, [], true, 0.42);
    wall(0, "z", 0.7, 7, 9.5, [], true, 0.42);
    wall(0, "z", 1.5, 7, 9.5, [], true, 0.42);
    wall(0, "z", 3.7, 7, 11.3, [], true, 0.42);
    wall(0, "x", 8.7, -4.3, -1.5, [], true, 0.42);
    wall(0, "z", -4.3, 8.7, 11.3, [], true, 0.42);
    wall(0, "x", 11.3, -4.3, 3.7, [], true, 0.42);
    wall(0, "z", 4.2, 5.2, 7, [], true, 0.8);
  } else {
    wall(1, "z", -5, -5, 5, [win(-3.4, 1.4), win(3, 1.65)], true);
    wall(1, "x", 5, -5, 4.2, [door(-3.4, 1.05), win(2, 1.6)], true);
    wall(1, "z", -5, 5, 6.5, [], true, 0.85);
    wall(1, "z", -1.7, 5, 6.5, [], true, 0.85);
    wall(1, "x", 6.5, -5, -1.7, [], true, 0.85);
  }
}
// Ground-floor social loop and separate service spaces.
wall(0, "x", 0, -5, 4.2, [door(-3.75, 1.25), door(2.8, 1.2)]);
wall(0, "z", -2.5, 0, 5, [door(2.65, 2)]);
wall(0, "z", -0.4, -5, 0, [door(-2.7, 1.1)]);
wall(0, "x", -3.65, 2.65, 4.2, [door(3.42, 0.9)]);
wall(0, "z", 2.65, -5, -3.65);
// The right-hand stair bay has separate front and kitchen entrances.
wall(0, "z", 4.2, -5, 5.2, [door(-4.56, 0.8), door(4.58, 0.82)]);
// Upper floor: four unequal rooms, a bathroom, T-shaped hall and fitted closets.
wall(1, "x", -1.2, -5, 4.2, [door(-3.6, 1), door(-1.2, 0.95), door(1.9, 1.05)]);
wall(1, "z", -2.2, -5, -1.2);
wall(1, "z", -0.2, -5, -1.2);
wall(1, "x", 0.3, -5, -1.7);
wall(1, "x", 0.3, -0.2, 4.2);
wall(1, "z", -1.7, 0.3, 5, [door(2.1, 1.05)]);
wall(1, "z", -0.2, 0.3, 5, [door(2.1, 1.05)]);
wall(1, "z", 4.2, -5, 5.2, [door(0, 1.1)]);
// Walk-in wardrobe in the master and a linen cupboard off the hall.
wall(1, "x", 1.5, -0.2, 1.05, [door(0.43, 0.85)]);
wall(1, "z", 1.05, 0.3, 1.5);
wall(1, "x", 1.25, -5, -2.7, [door(-3.6, 0.9)]);
wall(1, "z", -2.7, 0.3, 1.25);

export const FURNITURE: Furniture[] = [];
function item(
  floor: 0 | 1,
  kind: string,
  x: number,
  z: number,
  w: number,
  d: number,
  bottom: number,
  top: number,
) {
  FURNITURE.push({
    id: `${floor}-${kind}-${FURNITURE.length}`,
    floor,
    kind,
    x,
    z,
    w,
    d,
    bottom,
    top,
  });
}
item(0, "sofa", 0.1, 3.55, 2.45, 0.9, 0, 0.93);
item(0, "dock", 4.015, DOCK.z, 0.2, 0.66, 0, 0.8);
item(0, "coffee", 0.2, 2.12, 1.35, 0.7, 0.4, 0.48);
item(0, "chair", 1.75, 1.55, 0.75, 0.85, 0, 0.85);
item(0, "fireplace", 0.35, 0.25, 1.8, 0.48, 0, 1.25);
item(0, "shelf", -1.5, 0.27, 0.95, 0.45, 0, 1.2);
item(0, "plant", -4.9, 4.3, 0.4, 0.4, 0, 0.9);
item(0, "coffee", -4.1, 2.5, 0.85, 0.65, 0.4, 0.48);
item(0, "chair", -5.32, 2.4, 0.5, 1.7, 0, 0.55);
item(0, "table", -2.8, -2.4, 1.65, 0.9, 0.67, 0.76);
item(0, "stool", -3.92, -2.4, 0.4, 0.4, 0, 0.47);
item(0, "stool", -1.68, -2.4, 0.4, 0.4, 0, 0.47);
item(0, "dresser", -4.5, -4.55, 0.6, 0.7, 0, 1.05);
item(0, "counter", 0.95, -4.55, 2.4, 0.65, 0, 0.94);
item(0, "counter", 3.7, -2.45, 0.65, 1.6, 0, 0.94);
item(0, "fridge", 0.1, -0.6, 0.7, 0.72, 0, 1.85);
item(0, "table", 1.3, -2.15, 1.1, 0.68, 0.67, 0.76);
item(0, "washer", 3.15, -4.48, 0.65, 0.66, 0, 0.87);
item(0, "plant", -4.55, 6.4, 0.45, 0.45, 0, 0.95);
item(0, "chair", -2.1, 6.35, 0.65, 0.55, 0, 0.6);
item(0, "plant", -3.85, 9.25, 0.5, 0.5, 0, 1.1);
item(0, "plant", -3.85, 10.8, 0.5, 0.5, 0, 0.95);
item(0, "coffee", -2.65, 10.25, 1.2, 0.7, 0.4, 0.48);
item(1, "bed", -3.65, -3.7, 1, 1.85, 0.28, 0.64);
item(1, "desk", -4.5, -1.9, 0.6, 1.1, 0.67, 0.76);
item(1, "bath", -1.2, -4.52, 1.65, 0.7, 0, 0.58);
item(1, "toilet", -1.7, -3.2, 0.5, 0.66, 0, 0.76);
item(1, "vanity", -0.55, -2.7, 0.45, 0.9, 0, 0.86);
item(1, "bed", 2.35, -3.6, 1.5, 2.05, 0.28, 0.68);
item(1, "desk", 0.6, -4.4, 0.95, 0.55, 0.67, 0.76);
item(1, "nightstand", 3.55, -3.9, 0.5, 0.5, 0.35, 0.55);
item(1, "dresser", 3.85, -1.9, 0.4, 1, 0, 1.1);
item(1, "bed", -4.05, 3.35, 1.15, 2.05, 0.28, 0.65);
item(1, "desk", -2.4, 4.4, 1.1, 0.5, 0.67, 0.76);
item(1, "arcade", -2.2, 0.77, 0.65, 0.65, 0, 1.6);
item(1, "shelf", -4.7, 0.75, 0.25, 0.7, 0, 1.8);
item(1, "bed", 2.35, 3.25, 1.7, 2.1, 0.28, 0.7);
item(1, "nightstand", 0.95, 3.6, 0.5, 0.5, 0.35, 0.55);
item(1, "nightstand", 3.75, 3.6, 0.5, 0.5, 0.35, 0.55);
item(1, "dresser", 3.87, 1.15, 0.4, 1.3, 0, 1.1);
item(1, "shelf", 0.3, 0.65, 0.7, 0.3, 0, 1.7);
item(1, "plant", -4.6, 6.1, 0.4, 0.4, 0, 0.9);

export const COLLIDERS: Collider[] = FURNITURE.flatMap((o) => {
  const y = o.floor * FLOOR_HEIGHT;
  const body = { ...o, bottom: y + o.bottom, top: y + o.top };
  if (o.bottom === 0) return [body];
  const legs: Collider[] = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      legs.push({
        ...o,
        id: `${o.id}-leg-${sx}-${sz}`,
        kind: "leg",
        x: o.x + sx * (o.w / 2 - 0.1),
        z: o.z + sz * (o.d / 2 - 0.1),
        w: 0.09,
        d: 0.09,
        bottom: y,
        top: y + o.bottom,
      });
  return [body, ...legs];
});
for (const wall of WALLS)
  COLLIDERS.push({
    ...wall,
    bottom: wall.bottom + wall.floor * FLOOR_HEIGHT,
    top: wall.top + wall.floor * FLOOR_HEIGHT,
  });
for (const r of RAMPS)
  for (const side of [-1, 1])
    COLLIDERS.push({
      id: `${r.id}-rail-${side}`,
      kind: "rail",
      floor: 0,
      x: r.x + side * (r.w / 2 + 0.045),
      z: r.z,
      w: 0.09,
      d: r.d,
      bottom: 0,
      top: FLOOR_HEIGHT + 0.8,
    });
// The shared upper landing is a floor above an enclosed stair closet, not a shortcut below the flights.
COLLIDERS.push({
  id: "stair-closet",
  kind: "wall",
  floor: 0,
  x: 5,
  z: 0,
  w: 1.25,
  d: 1.2,
  bottom: 0,
  top: 2.6,
});

export const HOUSE_LEVEL = createLevel({
  id: "house",
  BOUNDS,
  DOCK,
  DOCK_FACING,
  START,
  DUST_COUNT,
  FLOOR_REGIONS,
  ROOMS,
  FURNITURE,
  WALLS,
  COLLIDERS,
  RAMPS,
  BOOST_PADS,
  routines: ROUTINES,
});
export const {
  insideFootprint,
  roomAt,
  rampAt,
  stairSurfaceHeight,
  stairSupportHeight,
  rampHeight,
  rampSlope,
  overlapsHeight,
  walkable,
  clearanceAt,
} = HOUSE_LEVEL;
