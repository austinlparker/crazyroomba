import type { Level } from "./navigation";
import { nearbyStair, stairCameraHeight } from "./stair-motion";
export type CameraMode = "chase" | "first-person";
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface DriverPose extends Vec3 {
  angle: number;
  grounded?: boolean;
  floor?: 0 | 1;
}

/** Keep boost zoom consistent across refresh rates and skip it on camera cuts. */
export function cameraFov(
  current: number,
  mode: CameraMode,
  aspect: number,
  boosting: boolean,
  dt: number,
  immediate: boolean,
  reducedMotion: boolean,
): number {
  const base = mode === "first-person" ? 82 : 68;
  // Preserve horizontal vision on portrait screens without pulling the boom back.
  const target =
    Math.min(
      106,
      (360 / Math.PI) *
        Math.atan(Math.tan((base * Math.PI) / 360) * Math.max(1, 0.8 / aspect)),
    ) + (boosting && !reducedMotion ? 6 : 0);
  return immediate || reducedMotion
    ? target
    : current + (target - current) * (1 - Math.exp(-Math.max(0, dt) * 5));
}

/** Reserve close-up precision for driving; the orbit needs precision at stage scale. */
export function cameraDepthRange(
  menu: boolean,
  distance: number,
  extent: number,
) {
  if (!menu) return { near: 0.025, far: 260 };
  // This padded envelope contains the stage, including tall props. Use the
  // actual eased camera distance so returning from gameplay cannot clip it.
  const radius = extent * 1.5;
  return {
    near: Math.max(0.025, distance - radius),
    far: Math.max(260, distance + radius),
  };
}

export const angleDelta = (from: number, to: number) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));
export function interpolatePose(
  previous: DriverPose,
  current: DriverPose,
  alpha: number,
): DriverPose {
  const t = Math.max(0, Math.min(1, alpha));
  return {
    grounded: current.grounded,
    floor: current.floor,
    x: previous.x + (current.x - previous.x) * t,
    y: previous.y + (current.y - previous.y) * t,
    z: previous.z + (current.z - previous.z) * t,
    angle: previous.angle + angleDelta(previous.angle, current.angle) * t,
  };
}

const cameraAxes = ["x", "y", "z"] as const;
/** Clip the camera boom against furniture bodies, legs, walls and stair rails. */
export function clipCamera(anchor: Vec3, desired: Vec3, level: Level): Vec3 {
  const delta = {
    x: desired.x - anchor.x,
    y: desired.y - anchor.y,
    z: desired.z - anchor.z,
  };
  let fraction = 1;
  for (const o of level.COLLIDERS) {
    let enter = 0,
      leave = 1;
    for (const axis of cameraAxes) {
      const half = axis === "x" ? o.w / 2 : o.d / 2,
        min = (axis === "y" ? o.bottom : o[axis] - half) - 0.035,
        max = (axis === "y" ? o.top : o[axis] + half) + 0.035;
      if (Math.abs(delta[axis]) < 1e-8) {
        if (anchor[axis] < min || anchor[axis] > max) {
          leave = -1;
          break;
        }
      } else {
        const a = (min - anchor[axis]) / delta[axis];
        const b = (max - anchor[axis]) / delta[axis];
        enter = Math.max(enter, Math.min(a, b));
        leave = Math.min(leave, Math.max(a, b));
        if (leave < enter) break;
      }
    }
    if (leave >= enter && enter > 0.001)
      fraction = Math.min(fraction, Math.max(0.015, enter - 0.025));
  }
  if (level.terrain) {
    const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / 0.05));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (t > fraction) break;
      const x = anchor.x + delta.x * t,
        z = anchor.z + delta.z * t;
      if (anchor.y + delta.y * t < level.groundHeight(x, z) + 0.04) {
        fraction = Math.max(0, (i - 1) / steps);
        break;
      }
    }
  }
  return {
    x: anchor.x + delta.x * fraction,
    y: anchor.y + delta.y * fraction,
    z: anchor.z + delta.z * fraction,
  };
}
export function cameraPose(driver: DriverPose, mode: CameraMode, level: Level) {
  const sx = Math.sin(driver.angle),
    sz = Math.cos(driver.angle),
    ramp = driver.grounded === false ? undefined : nearbyStair(driver, level),
    first = mode === "first-person";
  const baseY = ramp ? stairCameraHeight(ramp, driver.z) : driver.y;
  const anchor = { x: driver.x, y: baseY + 0.105, z: driver.z };
  const clearance = level.clearanceAt(driver),
    eye = first ? 0.105 : Math.min(0.52, clearance - 0.065);
  const boom = first ? -0.145 : clearance < 0.6 ? 0.72 : 1.2;
  const targetZ = driver.z + sz * (ramp ? 1.2 : 2);
  const target = {
    x: driver.x + sx * (ramp ? 1.2 : 2),
    y:
      (ramp
        ? stairCameraHeight(ramp, targetZ)
        : level.terrain && driver.grounded !== false && driver.y < 1.4
          ? level.groundHeight(driver.x + sx * 2, targetZ)
          : driver.y) + (first ? 0.105 : 0.12),
    z: targetZ,
  };
  if (
    first &&
    level.terrain &&
    !ramp &&
    driver.grounded !== false &&
    driver.y < 1.4
  ) {
    // A low, forward-facing camera rides with the chassis on hills. Looking at
    // the far side of a crater would otherwise point its lens into the near rim.
    const ahead = level.groundHeight(
      driver.x + sx * 0.25,
      driver.z + sz * 0.25,
    );
    const behind = level.groundHeight(
      driver.x - sx * 0.25,
      driver.z - sz * 0.25,
    );
    target.y = driver.y + 0.105 + (ahead - behind) * 4;
  }
  const desired = {
    x: driver.x - sx * boom,
    y: (ramp ? stairCameraHeight(ramp, driver.z - sz * boom) : driver.y) + eye,
    z: driver.z - sz * boom,
  };
  if (ramp) {
    // Raise the eye only as far as needed to clear individual noses and the
    // convex top landing. Looking ahead levels out naturally at the crest.
    for (let i = 0; i < 40; i++) {
      const t = i / 40,
        z = desired.z + (target.z - desired.z) * t;
      const required =
        (level.stairSurfaceHeight(ramp, z) + 0.045 - target.y * t) / (1 - t);
      desired.y = Math.max(desired.y, required);
    }
  }
  const position = clipCamera(anchor, desired, level);
  if (level.terrain)
    position.y = Math.max(
      position.y,
      level.surfaceHeight(
        { ...position, y: driver.y },
        driver.floor ?? (driver.y > 1.4 ? 1 : 0),
      ) + eye,
    );
  return { anchor, position, target };
}
