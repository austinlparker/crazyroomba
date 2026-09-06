import {
  sampleHeight,
  insidePolygon,
  segmentDistance,
  type HeightField,
  type Vertex2,
} from "./terrain";
import {
  FLOOR_HEIGHT,
  ROBOT_HEIGHT,
  ROBOT_RADIUS,
  STAIR_STEPS,
  type Point,
  type Collider,
  type Room,
  type FloorRegion,
  type Furniture,
  type Wall,
  type Ramp,
  type BoostPad,
  type StageId,
} from "./level-types";
import type { Routine } from "./household";
export interface LevelData {
  id: StageId;
  BOUNDS: { minX: number; maxX: number; minZ: number; maxZ: number };
  DOCK: { x: number; z: number; y: number };
  DOCK_FACING: number;
  START: { x: number; z: number; y: number; angle: number };
  DUST_COUNT: number;
  FLOOR_REGIONS: FloorRegion[];
  ROOMS: Room[];
  FURNITURE: Furniture[];
  WALLS: Wall[];
  COLLIDERS: Collider[];
  RAMPS: Ramp[];
  BOOST_PADS: BoostPad[];
  routines: Routine[];
  cruise?: number;
  turbo?: number;
  traction?: number;
  terrain?: HeightField;
  outline?: readonly Vertex2[];
  outdoor?: boolean;
}
export function createLevel(data: LevelData) {
  const { FLOOR_REGIONS, ROOMS, RAMPS, COLLIDERS } = data;
  function insideFootprint(
    p: Point,
    floor: 0 | 1 = (p.y ?? 0) > FLOOR_HEIGHT / 2 ? 1 : 0,
    radius = 0,
  ): boolean {
    if (floor === 0 && data.outline) {
      return (
        insidePolygon(p.x, p.z, data.outline) &&
        (radius === 0 ||
          data.outline.every(
            (a, i) =>
              segmentDistance(
                p.x,
                p.z,
                a,
                data.outline![(i + 1) % data.outline!.length],
              ) >=
              radius - 1e-6,
          ))
      );
    }
    const contains = (x: number, z: number) =>
      FLOOR_REGIONS.some(
        (r) =>
          r.floor === floor &&
          x >= r.x - r.w / 2 - 1e-6 &&
          x <= r.x + r.w / 2 + 1e-6 &&
          z >= r.z - r.d / 2 - 1e-6 &&
          z <= r.z + r.d / 2 + 1e-6,
      );
    if (!contains(p.x, p.z)) return false;
    for (let i = 0; i < 8; i++)
      if (
        !contains(
          p.x + Math.cos((i * Math.PI) / 4) * radius,
          p.z + Math.sin((i * Math.PI) / 4) * radius,
        )
      )
        return false;
    return true;
  }
  function groundHeight(x: number, z: number) {
    return sampleHeight(data.terrain, x, z);
  }
  function surfaceHeight(
    p: Point,
    floor: 0 | 1 = (p.y ?? 0) > FLOOR_HEIGHT / 2 ? 1 : 0,
  ) {
    const ramp = rampAt(p);
    return ramp
      ? rampHeight(ramp, p.z)
      : floor
        ? FLOOR_HEIGHT
        : groundHeight(p.x, p.z);
  }
  function roomAt(p: Point): Room | undefined {
    const floor = (p.y ?? 0) > FLOOR_HEIGHT / 2 ? 1 : 0;
    return ROOMS.find(
      (r) =>
        r.floor === floor &&
        Math.abs(p.x - r.x) < r.w / 2 &&
        Math.abs(p.z - r.z) < r.d / 2,
    );
  }
  function rampAt(p: Point) {
    return RAMPS.find(
      (r) =>
        Math.abs(p.x - r.x) < r.w / 2 &&
        p.z > Math.min(r.topZ, r.bottomZ) &&
        p.z < Math.max(r.topZ, r.bottomZ),
    );
  }
  /** Visible tread surface, including the flat landings outside the flight. */
  function stairSurfaceHeight(r: Ramp, z: number) {
    const progress = Math.max(
      0,
      Math.min(1, (z - r.bottomZ) / (r.topZ - r.bottomZ)),
    );
    if (r.steps === false) return rampHeight(r, z);
    return (
      r.fromY +
      (Math.ceil(progress * STAIR_STEPS) * (r.toY - r.fromY)) / STAIR_STEPS
    );
  }
  /** Chassis support above the highest tread under its circular footprint. */
  function stairSupportHeight(r: Ramp, z: number) {
    return stairSurfaceHeight(
      r,
      z + Math.sign(r.topZ - r.bottomZ) * ROBOT_RADIUS,
    );
  }
  function rampHeight(r: Ramp, z: number) {
    return (
      r.fromY +
      Math.max(0, Math.min(1, (z - r.bottomZ) / (r.topZ - r.bottomZ))) *
        (r.toY - r.fromY)
    );
  }
  function rampSlope(r: Ramp) {
    return (r.toY - r.fromY) / (r.topZ - r.bottomZ);
  }
  function overlapsHeight(o: Collider, y: number, height = ROBOT_HEIGHT) {
    return y + height > o.bottom + 0.001 && y < o.top - 0.001;
  }
  function walkable(p: Point, radius = ROBOT_RADIUS): boolean {
    const y = p.y ?? groundHeight(p.x, p.z);
    const r = rampAt(p);
    if (r && Math.abs(rampHeight(r, p.z) - y) > 0.12) return false;
    if (
      data.terrain &&
      !r &&
      y < FLOOR_HEIGHT / 2 &&
      Math.abs(groundHeight(p.x, p.z) - y) > 0.06
    )
      return false;
    return (
      insideFootprint(p, undefined, radius) &&
      !COLLIDERS.some(
        (o) =>
          overlapsHeight(o, y) &&
          Math.abs(p.x - o.x) < o.w / 2 + radius &&
          Math.abs(p.z - o.z) < o.d / 2 + radius,
      )
    );
  }
  /** Camera ceiling when the robot is inside a furniture shortcut. */
  function clearanceAt(p: Point): number {
    const y = p.y ?? 0;
    let ceiling =
      !data.outdoor && y < FLOOR_HEIGHT - 0.3 && !rampAt(p)
        ? FLOOR_HEIGHT - 0.15
        : y + 30;
    for (const o of COLLIDERS)
      if (
        o.bottom > y + ROBOT_HEIGHT &&
        Math.abs(p.x - o.x) < o.w / 2 + 0.15 &&
        Math.abs(p.z - o.z) < o.d / 2 + 0.15
      )
        ceiling = Math.min(ceiling, o.bottom);
    return ceiling - y;
  }

  return {
    ...data,
    groundHeight,
    surfaceHeight,
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
  };
}
export type Level = ReturnType<typeof createLevel>;
