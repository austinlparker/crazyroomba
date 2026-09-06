import {
  Simulation as Base,
  replayDaily as replay,
  type Mode,
} from "./simulation";
import { HOUSE_LEVEL } from "./level";
export * from "./simulation";
export { DOCK, walkable } from "./level";
export class Simulation extends Base {
  constructor(mode: Mode, seed: number) {
    super(mode, seed, HOUSE_LEVEL);
  }
}
export const replayDaily = (seed: number, input: unknown) =>
  replay(seed, input, HOUSE_LEVEL);
import {
  cameraPose as pose,
  clipCamera as clip,
  type DriverPose,
  type CameraMode,
  type Vec3,
} from "./camera";
export const cameraPose = (driver: DriverPose, mode: CameraMode) =>
  pose(driver, mode, HOUSE_LEVEL);
export const clipCamera = (anchor: Vec3, desired: Vec3) =>
  clip(anchor, desired, HOUSE_LEVEL);
import { stairMotion as motion } from "./stair-motion";
export const stairMotion = (p: Parameters<typeof motion>[0], reduced = false) =>
  motion(p, reduced, HOUSE_LEVEL);
