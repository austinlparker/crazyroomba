import { FLOOR_HEIGHT, ROBOT_RADIUS, type Point } from "./level-types";
export type ResidentKind = "cat" | "dog" | "person";
export interface Stop {
  x: number;
  z: number;
  wait?: number;
  activity?: string;
}
export interface Routine {
  id: string;
  kind: ResidentKind;
  floor: 0 | 1;
  radius: number;
  height: number;
  speed: number;
  color: string;
  route: Stop[];
}
export const ROUTINES: Routine[] = [
  {
    id: "miso",
    kind: "cat",
    floor: 0,
    radius: 0.22,
    height: 0.36,
    speed: 0.65,
    color: "#d48742",
    route: [
      { x: -3.3, z: 2.65, wait: 180, activity: "Window watching" },
      { x: -1.55, z: 2.65 },
      { x: 1, z: 2.65 },
      { x: 2.7, z: 2.65, wait: 90, activity: "Investigating" },
      { x: 2.7, z: 3.05 },
      { x: 1.65, z: 3.05 },
      { x: 1.65, z: 2.65 },
      { x: 1, z: 2.65 },
      { x: -1.55, z: 2.65 },
    ],
  },
  {
    id: "biscuit",
    kind: "dog",
    floor: 0,
    radius: 0.31,
    height: 0.6,
    speed: 0.55,
    color: "#aa784b",
    route: [
      { x: -4.46, z: -3.5, wait: 180, activity: "Sniffing" },
      { x: -1.1, z: -3.5, wait: 210, activity: "Snack break" },
      { x: -1.1, z: -1.03 },
      { x: -4.46, z: -1.03, wait: 120, activity: "On patrol" },
    ],
  },
  {
    id: "alex",
    kind: "person",
    floor: 1,
    radius: 0.23,
    height: 1.72,
    speed: 0.7,
    color: "#bd6b68",
    route: [
      { x: 1.9, z: -0.45 },
      { x: 1.9, z: -1.65 },
      { x: 1.1, z: -1.65, wait: 240, activity: "Looking for keys" },
      { x: 1.9, z: -1.65 },
      { x: 1.9, z: -0.45 },
      { x: -0.95, z: -0.45 },
      { x: -0.95, z: 2.1 },
      { x: 0.45, z: 2.1 },
      { x: 1.1, z: 2.1, wait: 300, activity: "Coffee break" },
      { x: 0.45, z: 2.1 },
      { x: -0.95, z: 2.1 },
      { x: -0.95, z: -0.45 },
    ],
  },
];
export interface Resident extends Point {
  y: number;
  id: string;
  kind: ResidentKind;
  radius: number;
  height: number;
  angle: number;
  node: number;
  wait: number;
  moving: boolean;
  activity: string;
  travel: number;
}
export function createResidents(seed: number, routines = ROUTINES): Resident[] {
  return routines.map((r, i) => {
    const node = ((seed >>> 0) + i * 7) % r.route.length,
      p = r.route[node];
    return {
      x: p.x,
      z: p.z,
      y: r.floor * FLOOR_HEIGHT,
      id: r.id,
      kind: r.kind,
      radius: r.radius,
      height: r.height,
      angle: 0,
      node: (node + 1) % r.route.length,
      wait: p.wait ?? 60,
      moving: false,
      activity: p.activity ?? "Taking a moment",
      travel: 0,
    };
  });
}
/** Fixed-tick routines are replayed on the Worker. Residents yield instead of pushing a parked robot. */
export function stepResidents(
  residents: Resident[],
  player: Point,
  routines = ROUTINES,
): void {
  for (const actor of residents) {
    const r = routines.find((r) => r.id === actor.id)!;
    actor.moving = false;
    if (actor.wait > 0) {
      actor.wait--;
      continue;
    }
    const target = r.route[actor.node],
      dx = target.x - actor.x,
      dz = target.z - actor.z,
      distance = Math.hypot(dx, dz),
      step = Math.min(r.speed / 60, distance);
    const x = actor.x + (distance ? (dx / distance) * step : 0),
      z = actor.z + (distance ? (dz / distance) * step : 0);
    if (
      Math.abs((player.y ?? 0) - actor.y) < 0.4 &&
      Math.hypot(player.x - x, player.z - z) <
        actor.radius + ROBOT_RADIUS + 0.12
    ) {
      actor.activity = "After you!";
      continue;
    }
    actor.x = x;
    actor.z = z;
    actor.travel += step;
    actor.moving = step > 0;
    if (distance > 0.001) actor.angle = Math.atan2(dx, dz);
    actor.activity = "On the move";
    if (distance <= step + 0.000001) {
      actor.wait = target.wait ?? 0;
      actor.activity = target.activity ?? "Taking a moment";
      actor.node = (actor.node + 1) % r.route.length;
    }
  }
}
