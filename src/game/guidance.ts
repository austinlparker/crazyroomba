import { FLOOR_HEIGHT } from "./level-types";
import type { Simulation } from "./simulation";

/** Point to a usable floor transition before pointing to the downstairs dock. */
export function returnTarget(
  s: Pick<Simulation, "x" | "z" | "y" | "ramp" | "level"> & { floor?: 0 | 1 },
) {
  const current = s.level.RAMPS.find((r) => r.id === s.ramp);
  if (current && s.y > 0.2) return { x: current.x, z: current.bottomZ };
  if (
    (s.floor ?? (s.y > FLOOR_HEIGHT / 2 ? 1 : 0)) === 1 &&
    s.level.RAMPS.length
  ) {
    const r = [...s.level.RAMPS].sort(
      (a, b) =>
        Math.hypot(a.x - s.x, a.topZ - s.z) -
        Math.hypot(b.x - s.x, b.topZ - s.z),
    )[0];
    return { x: r.x, z: r.topZ };
  }
  return s.level.DOCK;
}
