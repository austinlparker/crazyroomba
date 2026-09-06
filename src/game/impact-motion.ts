import type { GameEvent } from "./simulation";
import { ROBOT_RADIUS } from "./level-types";

/** Cosmetic bumper suspension, evaluated from elapsed time without feeding physics. */
export class ImpactMotion {
  private age = 1;
  private strength = 0;
  private normalX = 0;
  private normalZ = 0;

  hit(event: GameEvent): void {
    if (event.kind !== "bump") return;
    this.age = 0;
    this.strength = Math.min(1, Math.max(0, event.value) / 4.5);
    this.normalX = event.normalX ?? 0;
    this.normalZ = event.normalZ ?? -1;
  }

  reset(): void {
    this.age = 1;
    this.strength = 0;
  }

  pose(dt: number, angle: number, reducedMotion: boolean) {
    this.age = Math.min(1, this.age + Math.max(0, dt));
    if (reducedMotion || this.age >= 0.75)
      return { pitch: 0, roll: 0, lift: 0 };
    const wave = Math.sin(this.age * 28) * Math.exp(-this.age * 7.5),
      tilt = wave * this.strength * 0.26,
      forward = this.normalX * Math.sin(angle) + this.normalZ * Math.cos(angle),
      side = this.normalX * Math.cos(angle) - this.normalZ * Math.sin(angle),
      pitch = forward * tilt,
      roll = -side * tilt;
    // Lift the pivot by the tilted bumper radius so wobble cannot cut into the floor.
    return { pitch, roll, lift: ROBOT_RADIUS * Math.hypot(pitch, roll) };
  }
}
