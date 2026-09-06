import type { Point } from "./level-types";

export const CHAIN_WINDOW = 30 * 60;

/** Fixed-tick rules shared by the game and the daily replay verifier. */
export class DeliveryChain {
  count = 0;
  best = 0;
  expires = 0;
  get multiplier() {
    return 1 + Math.max(0, this.count - 1) * 0.25;
  }
  expire(tick: number) {
    return tick >= this.expires ? this.break() : 0;
  }
  break() {
    const count = this.count;
    this.count = 0;
    this.expires = 0;
    return count;
  }
  deliver(full: boolean, tick: number): number {
    this.expire(tick);
    if (!full) {
      this.break();
      return 1;
    }
    this.count = Math.min(5, this.count + 1);
    this.best = Math.max(this.best, this.count);
    this.expires = tick + CHAIN_WINDOW;
    return this.multiplier;
  }
}

export class NearMissTracker {
  private passes = new Map<string, { x: number; z: number }>();
  private cooldown = new Map<string, number>();
  /** Reward a clean, completed pass, never merely sitting beside a resident. */
  update(
    id: string,
    tick: number,
    p: Point,
    gap: number,
    speed: number,
    hit: boolean,
  ): boolean {
    if (hit || gap < 0) {
      this.passes.delete(id);
      this.cooldown.set(id, tick + 240);
      return false;
    }
    // Braking to a stop ends the attempt. Leaving later is a new pass, not a
    // delayed reward for parking beside a resident.
    if (Math.abs(speed) <= 1.2) {
      this.passes.delete(id);
      return false;
    }
    if ((this.cooldown.get(id) ?? 0) > tick) return false;
    const pass = this.passes.get(id);
    if (!pass && gap < 0.32) this.passes.set(id, { x: p.x, z: p.z });
    if (pass && gap > 0.65) {
      this.passes.delete(id);
      if (Math.hypot(p.x - pass.x, p.z - pass.z) > 1) {
        this.cooldown.set(id, tick + 240);
        return true;
      }
    }
    return false;
  }
}
