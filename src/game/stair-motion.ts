import {
  ROBOT_RADIUS,
  STAIR_STEPS,
  type Point,
  type Ramp,
} from "./level-types";
import type { Level } from "./navigation";
export function nearbyStair(p: Point, level: Level) {
  return level.RAMPS.find(
    (r) =>
      Math.abs(p.x - r.x) < r.w / 2 &&
      p.z > Math.min(r.bottomZ, r.topZ) - 0.42 &&
      p.z < Math.max(r.bottomZ, r.topZ) + 0.42,
  );
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
/** Position-locked auto-climber: lift ahead of each riser, kick, then land on its tread. */
export function stairMotion(
  p: Point & { angle: number; speed: number; boosting: boolean },
  reduced = false,
  level: Level,
) {
  const r = nearbyStair(p, level);
  if (!r && !level.terrain) return { y: p.y ?? 0, pitch: 0, roll: 0 };
  if (!r || r.steps === false) {
    const x = p.x,
      z = p.z,
      d = 0.16,
      y = p.y ?? 0;
    const height = (x: number, z: number) => level.surfaceHeight({ x, z, y });
    const dx = (height(x + d, z) - height(x - d, z)) / (2 * d),
      dz = (height(x, z + d) - height(x, z - d)) / (2 * d);
    return {
      y,
      pitch: -Math.atan(dx * Math.sin(p.angle) + dz * Math.cos(p.angle)),
      roll: Math.atan(dx * Math.cos(p.angle) - dz * Math.sin(p.angle)),
    };
  }
  const direction = Math.sign(r.topZ - r.bottomZ),
    rise = (r.toY - r.fromY) / STAIR_STEPS;
  const progress =
    ((p.z + direction * ROBOT_RADIUS - r.bottomZ) / (r.topZ - r.bottomZ)) *
    STAIR_STEPS;
  const step = Math.floor(progress),
    phase = progress - step;
  const base = Math.max(0, Math.min(STAIR_STEPS, step + 1)) * rise;
  const next = Math.max(0, Math.min(STAIR_STEPS, step + 2)) * rise;
  const t = clamp((phase - 0.4) / 0.6),
    lift = t * t * (3 - 2 * t);
  const speed = clamp(Math.abs(p.speed) / 1.5),
    envelope = clamp(progress + 1) * clamp(STAIR_STEPS - 1 - progress);
  const kick = reduced ? 0 : Math.sin(phase * Math.PI) * speed * envelope;
  const y =
    r.fromY +
    base +
    (next - base) * lift * speed +
    kick * (p.boosting ? 0.15 : 0.045);
  // Keep the entire tilted chassis clear of the stair nose.
  return {
    y: Math.max(p.y ?? 0, y) + kick * 0.055,
    pitch:
      kick === 0
        ? 0
        : -direction * Math.cos(p.angle) * kick * (p.boosting ? 0.34 : 0.12),
    roll: reduced ? 0 : Math.sin(progress * Math.PI) * kick * 0.13,
  };
}
/** Smooth camera rail is separate from the chassis's deliberately wild suspension. */
export function stairCameraHeight(r: Ramp, z: number) {
  return (
    r.fromY +
    clamp(
      (z + Math.sign(r.topZ - r.bottomZ) * 0.3 - r.bottomZ) /
        (r.topZ - r.bottomZ),
    ) *
      (r.toY - r.fromY)
  );
}
