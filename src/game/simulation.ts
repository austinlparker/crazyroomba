/** Rendering-free, fixed-step game rules. The Worker replays these exact rules. */
import {
  CRUISE_SPEED,
  TURBO_SPEED,
  ROBOT_RADIUS,
  FLOOR_HEIGHT,
  type Point,
  type Collider,
} from "./level-types";
import type { Level } from "./navigation";
import { createResidents, stepResidents, type Resident } from "./household";
import { DeliveryChain, NearMissTracker } from "./driving-rewards";
export type { Point } from "./level-types";
export const RULESET = "2.10.0";
export const STEP = 1 / 60;
export const DAILY_TICKS = 90 * 60;
export const ARCADE_START_SECONDS = 60;
export const ARCADE_TIME_BUDGET = 45;
export const FULL_BIN_SECONDS = 8;
export const DUST_RESPAWN_TICKS = 18 * 60;
const HOP_BUFFER_TICKS = 6;
export const CAPACITY = 5;
export type Mode = "arcade" | "daily" | "freeroam" | "tutorial";
export const Keys = {
  forward: 1,
  reverse: 2,
  left: 4,
  right: 8,
  boost: 16,
  drift: 32,
  hop: 64,
} as const;
export interface Dust extends Point {
  y: number;
  id: number;
  value: number;
  active: boolean;
  respawnAt: number;
}
export interface GameEvent extends Point {
  kind:
    | "pickup"
    | "deposit"
    | "bump"
    | "boost"
    | "stairs"
    | "near-miss"
    | "hop"
    | "land"
    | "chain-lost";
  value: number;
  /** Bump value is closing speed in m/s; the normal points away from contact. */
  normalX?: number;
  normalZ?: number;
  timeAdded?: number;
  chain?: number;
  reason?: "collision" | "timeout" | "partial";
}
interface DriveContact {
  x: number;
  y: number;
  z: number;
  normalX: number;
  normalZ: number;
  collider?: Collider;
  resident?: Resident;
}
export type Replay = [number, number][];
export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.z - b.z);
export const utcDay = (date = new Date()) => date.toISOString().slice(0, 10);
export function seedForDay(day: string): number {
  let h = 2166136261;
  for (const c of `${RULESET}:${day}`)
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export class Simulation {
  readonly random: () => number;
  x: number;
  y = 0;
  floor: 0 | 1 = 0;
  ramp: string | null = null;
  stairBlocked = false;
  private padContact: string | null = null;
  z: number;
  angle: number;
  vx = 0;
  vz = 0;
  speed = 0;
  yawRate = 0;
  vy = 0;
  grounded = true;
  airTicks = 0;
  private groundVelocity = 0;
  private hopHeld = false;
  private hopQueuedUntil = 0;
  private airTurn = 0;
  private airTravel = 0;
  private boostExhausted = false;
  previous = { x: 0, y: 0, z: 0, angle: 0 };

  boost = 100;
  boosting = false;
  drifting = false;
  ticks = 0;
  remaining = ARCADE_START_SECONDS * 60;
  arcadeTimeEarned = 0;
  score = 0;
  deposited = 0;
  deliveries = 0;
  distanceDriven = 0;
  boostTicks = 0;
  driftTicks = 0;
  bestDelivery = 0;
  readonly chain = new DeliveryChain();
  nearMisses = 0;
  private nearMissTracker = new NearMissTracker();
  bin: number[] = [];
  private carriedDust: number[] = [];
  private dockReady = true;
  dust: Dust[] = [];
  events: GameEvent[] = [];
  ended = false;
  residents: Resident[];
  private bumpAt = -60;
  private driveContacts: DriveContact[] = [];
  constructor(
    readonly mode: Mode,
    readonly seed: number,
    readonly level: Level,
  ) {
    this.x = level.START.x;
    this.z = level.START.z;
    this.angle = level.START.angle;
    this.y = level.START.y;
    this.previous = { x: this.x, y: this.y, z: this.z, angle: this.angle };
    this.random = rng(seed);
    this.residents =
      mode === "tutorial" ? [] : createResidents(seed, level.routines);
    for (const actor of this.residents)
      if (actor.y === 0) actor.y = level.groundHeight(actor.x, actor.z);
    this.remaining =
      mode === "daily"
        ? DAILY_TICKS
        : mode === "arcade"
          ? ARCADE_START_SECONDS * 60
          : Infinity;
    for (let i = 0; i < this.level.DUST_COUNT; i++)
      this.dust.push(this.spawn(i));
    // Teach with a visible, unobstructed trail immediately in front of the dock.
    if (mode === "tutorial") {
      this.dust.slice(0, 3).forEach((d, i) => {
        d.x =
          this.level.DOCK.x +
          Math.sin(this.level.DOCK_FACING) * (1.65 + i * 0.7);
        d.y = 0;
        d.z =
          this.level.DOCK.z +
          Math.cos(this.level.DOCK_FACING) * (1.65 + i * 0.7);
        d.value = 100;
      });
    }
  }
  private spawn(id: number): Dust {
    const floors = [...new Set(this.level.FLOOR_REGIONS.map((r) => r.floor))];
    const floorY =
      this.mode === "tutorial"
        ? 0
        : (this.level.id === "moon"
            ? id % 7 === 1
              ? 1
              : 0
            : floors[id % floors.length]) * FLOOR_HEIGHT;
    const regions = this.level.FLOOR_REGIONS.filter(
      (r) => r.floor * FLOOR_HEIGHT === floorY,
    );
    const area = regions.reduce((sum, r) => sum + r.w * r.d, 0);
    let p: { x: number; z: number; y: number } | undefined;
    const valid = (candidate: { x: number; z: number; y: number }) =>
      this.level.walkable(candidate, 0.26) &&
      !this.level.rampAt(candidate) &&
      distance(candidate, this.level.DOCK) > 2.5;
    for (let i = 0; i < 300; i++) {
      let pick = this.random() * area;
      const region =
        regions.find((r) => (pick -= r.w * r.d) < 0) ??
        regions[regions.length - 1];
      const candidate = {
        x: region.x + (this.random() - 0.5) * region.w,
        z: region.z + (this.random() - 0.5) * region.d,
        y: floorY,
      };
      candidate.y = floorY || this.level.groundHeight(candidate.x, candidate.z);
      if (
        valid(candidate) &&
        !this.dust.some(
          (d) =>
            d.active &&
            Math.abs(d.y - candidate.y) < 0.4 &&
            distance(d, candidate) < 0.8,
        )
      ) {
        p = candidate;
        break;
      }
    }
    // A dense or narrow deck can exhaust the spacing attempts. Never fall back
    // to a ground-floor spawn at an upper-floor Y; choose a valid surface instead.
    if (!p)
      for (const region of regions) {
        for (
          let x = region.x - region.w / 2 + 0.3;
          x < region.x + region.w / 2 - 0.3 && !p;
          x += 0.3
        )
          for (
            let z = region.z - region.d / 2 + 0.3;
            z < region.z + region.d / 2 - 0.3 && !p;
            z += 0.3
          )
            if (valid({ x, z, y: floorY || this.level.groundHeight(x, z) }))
              p = { x, z, y: floorY || this.level.groundHeight(x, z) };
        if (p) break;
      }
    if (!p)
      throw new Error(`No pickup surface in ${this.level.id} at ${floorY}`);
    return {
      ...p,
      id,
      value:
        100 +
        Math.floor(distance(p, this.level.DOCK) / 5) * 75 +
        (floorY > 0 ? 150 : 0),
      active: true,
      respawnAt: 0,
    };
  }
  /** Highest reachable support, including solid prop tops but never a ceiling. */
  private supportHeight(limit: number): number {
    const r = this.level.rampAt(this);
    if (r) return this.level.rampHeight(r, this.z);
    let y = this.level.groundHeight(this.x, this.z);
    if (limit >= FLOOR_HEIGHT && this.level.insideFootprint(this, 1))
      y = FLOOR_HEIGHT;
    for (const o of this.level.COLLIDERS)
      if (
        o.kind !== "wall" &&
        o.kind !== "rail" &&
        o.top <= limit &&
        Math.abs(this.x - o.x) < o.w / 2 &&
        Math.abs(this.z - o.z) < o.d / 2
      )
        y = Math.max(y, o.top);
    return y;
  }
  private updateFloor(): void {
    const r = this.level.rampAt(this);
    this.ramp =
      r && Math.abs(this.y - this.level.rampHeight(r, this.z)) < 0.12
        ? r.id
        : null;
    if (!this.grounded) return;
    const before = this.floor;
    if (this.ramp) {
      if (this.y > FLOOR_HEIGHT - 0.06) this.floor = 1;
      else if (this.y < 0.06) this.floor = 0;
    } else
      this.floor =
        this.y >= FLOOR_HEIGHT - 0.06 && this.level.insideFootprint(this, 1)
          ? 1
          : 0;
    if (before !== this.floor)
      this.events.push({
        kind: "stairs",
        x: this.x,
        y: this.y,
        z: this.z,
        value: this.floor,
      });
  }
  private nearContact(c: DriveContact): boolean {
    if (c.collider) {
      const o = c.collider;
      return (
        this.level.overlapsHeight(o, this.y) &&
        Math.hypot(
          this.x - clamp(this.x, o.x - o.w / 2, o.x + o.w / 2),
          this.z - clamp(this.z, o.z - o.d / 2, o.z + o.d / 2),
        ) <
          ROBOT_RADIUS + 0.3
      );
    }
    if (c.resident)
      return (
        this.y + 0.13 > c.resident.y &&
        this.y < c.resident.y + c.resident.height &&
        distance(this, c.resident) < ROBOT_RADIUS + c.resident.radius + 0.3
      );
    return Math.abs(this.y - c.y) < 0.2 && distance(this, c) < 0.45;
  }
  private loseChain(
    reason: GameEvent["reason"],
    count = this.chain.break(),
  ): void {
    if (!count) return;
    this.events.push({
      kind: "chain-lost",
      x: this.x,
      y: this.y,
      z: this.z,
      value: 1 + Math.max(0, count - 1) * 0.25,
      chain: count,
      reason,
    });
  }
  step(input: number): void {
    this.events = [];
    if (this.ended) return;
    this.previous.x = this.x;
    this.previous.y = this.y;
    this.previous.z = this.z;
    this.previous.angle = this.angle;
    this.ticks++;
    this.loseChain("timeout", this.chain.expire(this.ticks));
    stepResidents(this.residents, this, this.level.routines);
    for (const actor of this.residents)
      if (this.level.routines.find((r) => r.id === actor.id)?.floor === 0)
        actor.y = this.level.groundHeight(actor.x, actor.z);
    const forward =
      Number(!!(input & Keys.forward)) - Number(!!(input & Keys.reverse));
    const turn = Number(!!(input & Keys.right)) - Number(!!(input & Keys.left));
    if (!(input & Keys.boost) || this.boost > 18) this.boostExhausted = false;
    if (this.boost < 0.6) this.boostExhausted = true;
    this.boosting =
      !!(input & Keys.boost) && forward > 0 && !this.boostExhausted;
    this.drifting = !!(input & Keys.drift) && Math.abs(this.speed) > 0.7;
    this.boost = clamp(
      this.boost + (this.boosting ? -22 : this.drifting ? 30 : 18) * STEP,
      0,
      100,
    );
    this.boostTicks += Number(this.boosting);
    this.driftTicks += Number(this.drifting);
    const spin = !this.grounded && !!(input & Keys.drift);
    const desiredYaw =
      -turn *
      (spin
        ? this.level.id === "moon"
          ? 7.5
          : 14
        : this.drifting
          ? 3.25
          : 2.4);
    // Ease steering reversals without delaying the translation/camera independently.
    this.yawRate += (desiredYaw - this.yawRate) * (1 - Math.exp(-18 * STEP));
    this.angle += this.yawRate * STEP;
    if (spin) this.airTurn += this.yawRate * STEP;
    this.angle = Math.atan2(Math.sin(this.angle), Math.cos(this.angle));
    const targetSpeed =
      forward *
      (forward < 0
        ? 0.85
        : this.boosting
          ? (this.level.turbo ?? TURBO_SPEED)
          : (this.level.cruise ?? CRUISE_SPEED));
    this.speed += (targetSpeed - this.speed) * (forward ? 5 : 6) * STEP;
    const traction = !this.grounded
      ? 0.35
      : this.drifting
        ? 2.5
        : (this.level.traction ?? 16);
    let driveX = Math.sin(this.angle) * this.speed,
      driveZ = Math.cos(this.angle) * this.speed;
    this.driveContacts = this.driveContacts.filter((c) => this.nearContact(c));
    // A bumper stays compressed until we steer away or clear the obstacle. Holding
    // the throttle against a wall must not create an endless impact/sound loop.
    for (const c of this.driveContacts) {
      const into = driveX * c.normalX + driveZ * c.normalZ;
      if (into < 0) {
        driveX -= into * c.normalX;
        driveZ -= into * c.normalZ;
      }
    }
    this.vx += (driveX - this.vx) * traction * STEP;
    this.vz += (driveZ - this.vz) * traction * STEP;
    const oldX = this.x,
      oldZ = this.z,
      oldY = this.y,
      oldFloor = this.floor;
    this.x += this.vx * STEP;
    this.z += this.vz * STEP;
    let bumped = false;
    let impact = 0,
      impactX = 0,
      impactZ = 0;
    const contact = (
      normalX: number,
      normalZ: number,
      collider?: Collider,
      resident?: Resident,
    ) => {
      bumped = true;
      const closing = -(this.vx * normalX + this.vz * normalZ);
      if (closing > 0) {
        // Preserve tangential momentum on a sideswipe; a fast head-on hit gets
        // a short, clear rebound. Residents have softer bumpers than furniture.
        const restitution =
          closing < 0.35
            ? 0
            : (0.2 + Math.min(closing / 5, 1) * 0.3) * (resident ? 0.7 : 1);
        const rebound = Math.min(2.4, closing * restitution);
        this.vx += (closing + rebound) * normalX;
        this.vz += (closing + rebound) * normalZ;
        if (closing > impact) {
          impact = closing;
          impactX = normalX;
          impactZ = normalZ;
        }
      }
      if (
        !this.driveContacts.some(
          (c) =>
            c.collider === collider &&
            c.resident === resident &&
            c.normalX * normalX + c.normalZ * normalZ > 0.98 &&
            distance(this, c) < 0.5,
        )
      )
        this.driveContacts.push({
          x: this.x,
          y: this.y,
          z: this.z,
          normalX,
          normalZ,
          collider,
          resident,
        });
    };
    this.stairBlocked = false;
    const nextRamp = this.level.rampAt(this);
    let support = this.supportHeight(
      Math.max(oldY, this.y + this.vy * STEP) + (this.grounded ? 0.1 : 0),
    );
    const uphillStair =
      nextRamp && nextRamp.steps !== false && support > oldY + 0.0001;
    if (
      (this.grounded &&
        (support > oldY + 0.1 || (uphillStair && !this.boosting))) ||
      (!this.grounded &&
        !!nextRamp &&
        support > Math.max(oldY, oldY + this.vy * STEP) + 0.1)
    ) {
      this.stairBlocked = !!uphillStair && !this.boosting;
      if (!this.stairBlocked) {
        const moved = Math.hypot(this.x - oldX, this.z - oldZ);
        if (moved > 0)
          contact((oldX - this.x) / moved, (oldZ - this.z) / moved);
      }
      this.x = oldX;
      this.z = oldZ;
      if (this.stairBlocked) {
        this.vx *= 0.2;
        this.vz *= 0.2;
      }
      this.speed *= 0.7;
      support = oldY;
    }
    const gravity = this.level.id === "moon" ? 3.2 : 9.8;
    const hop = !!(input & Keys.hop);
    const onRamp = !!this.level.rampAt(this);
    // A fresh press just before touchdown should still hop on landing. Consume
    // the request once; holding the button never queues another jump.
    if (onRamp) this.hopQueuedUntil = 0;
    else if (hop && !this.hopHeld)
      this.hopQueuedUntil = this.ticks + HOP_BUFFER_TICKS;
    if (this.ticks <= this.hopQueuedUntil && this.grounded && !onRamp) {
      this.hopQueuedUntil = 0;
      this.grounded = false;
      this.vy = this.level.id === "moon" ? 2.45 : 2.8;
      this.groundVelocity = 0;
      this.events.push({
        kind: "hop",
        x: this.x,
        y: this.y,
        z: this.z,
        value: 0,
      });
    }
    this.hopHeld = hop;
    if (this.grounded) {
      const velocity = (support - oldY) / STEP;
      const oldRamp = this.level.rampAt({ x: oldX, z: oldZ });
      const stairs = oldRamp && oldRamp.steps !== false;
      // Lose contact at a lip when the ballistic path rises above the next surface.
      // Stair-climbing suspension stays engaged; smooth ramps and terrain can launch.
      if (
        support < oldY - 0.1 ||
        (!stairs &&
          Math.hypot(this.vx, this.vz) > 2.6 &&
          this.groundVelocity > 0.65 &&
          oldY + (this.groundVelocity - gravity * STEP) * STEP >
            support + 0.008)
      ) {
        this.grounded = false;
        this.vy = this.groundVelocity;
      } else {
        this.y = support;
        this.groundVelocity = stairs ? 0 : velocity;
        this.vy = 0;
      }
    }
    if (!this.grounded) {
      this.airTicks++;
      this.airTravel += Math.hypot(this.x - oldX, this.z - oldZ);
      this.vy -= gravity * STEP;
      this.y += this.vy * STEP;
      // Swept vertical contact prevents hopping through table undersides or floor slabs.
      let ceiling =
        !this.level.outdoor && this.floor === 0 && !this.level.rampAt(this)
          ? FLOOR_HEIGHT - 0.15
          : Infinity;
      for (const o of this.level.COLLIDERS) {
        if (
          Math.abs(this.x - o.x) > o.w / 2 + ROBOT_RADIUS ||
          Math.abs(this.z - o.z) > o.d / 2 + ROBOT_RADIUS
        )
          continue;
        if (oldY + 0.13 <= o.bottom + 0.001)
          ceiling = Math.min(ceiling, o.bottom);
      }
      if (this.vy > 0 && this.y + 0.13 > ceiling) {
        this.y = ceiling - 0.13;
        this.vy = 0;
      }
      if (this.vy <= 0 && this.y <= support) {
        this.y = support;
        this.grounded = true;
        this.vy = this.groundVelocity = 0;
        const tricks =
          this.airTravel > 1.5
            ? Math.floor((Math.abs(this.airTurn) + 0.12) / (2 * Math.PI))
            : 0;
        if (this.airTicks > 8)
          this.events.push({
            kind: "land",
            x: this.x,
            y: this.y,
            z: this.z,
            value: tricks,
          });
        this.airTicks = this.airTurn = this.airTravel = 0;
      }
    }
    this.updateFloor();
    const radius = ROBOT_RADIUS;
    const bx = clamp(
        this.x,
        this.level.BOUNDS.minX + radius,
        this.level.BOUNDS.maxX - radius,
      ),
      bz = clamp(
        this.z,
        this.level.BOUNDS.minZ + radius,
        this.level.BOUNDS.maxZ - radius,
      );
    if (bx !== this.x) {
      contact(Math.sign(bx - this.x), 0);
    }
    if (bz !== this.z) {
      contact(0, Math.sign(bz - this.z));
    }
    this.x = bx;
    this.z = bz;
    // Residents stop for a parked robot; driving into them gives a soft bumper
    // response. Resolve static geometry afterward so nobody can push us through a wall.
    for (const actor of this.residents) {
      if (this.y + 0.13 <= actor.y || this.y >= actor.y + actor.height)
        continue;
      const dx = this.x - actor.x,
        dz = this.z - actor.z,
        len = Math.hypot(dx, dz),
        reach = radius + actor.radius;
      if (len < reach) {
        if (len > 0.00001) {
          this.x = actor.x + (dx / len) * reach;
          this.z = actor.z + (dz / len) * reach;
          contact(dx / len, dz / len, undefined, actor);
        } else {
          this.x = oldX;
          this.z = oldZ;
          const away = Math.hypot(oldX - actor.x, oldZ - actor.z);
          if (away > 0.00001)
            contact(
              (oldX - actor.x) / away,
              (oldZ - actor.z) / away,
              undefined,
              actor,
            );
        }
      }
    }
    for (const o of this.level.COLLIDERS) {
      if (!this.level.overlapsHeight(o, this.y)) continue;
      const nx = clamp(this.x, o.x - o.w / 2, o.x + o.w / 2);
      const nz = clamp(this.z, o.z - o.d / 2, o.z + o.d / 2);
      const dx = this.x - nx,
        dz = this.z - nz,
        len = Math.hypot(dx, dz);
      if (len < radius) {
        if (len > 0.00001) {
          this.x += (dx / len) * (radius - len);
          this.z += (dz / len) * (radius - len);
          contact(dx / len, dz / len, o);
        } else {
          this.x = oldX;
          this.z = oldZ;
          const oldNx = clamp(oldX, o.x - o.w / 2, o.x + o.w / 2),
            oldNz = clamp(oldZ, o.z - o.d / 2, o.z + o.d / 2),
            away = Math.hypot(oldX - oldNx, oldZ - oldNz);
          if (away > 0.00001)
            contact((oldX - oldNx) / away, (oldZ - oldNz) / away, o);
          else {
            this.vx = this.vz = 0;
            bumped = true;
          }
        }
      }
    }
    // The porch, window bay and balcony form a union, not a rectangular arena.
    if (
      !this.level.insideFootprint(this, this.ramp ? 0 : this.floor, radius) &&
      !(this.level.outdoor && this.level.insideFootprint(this, 0, radius))
    ) {
      const moved = Math.hypot(this.x - oldX, this.z - oldZ);
      if (moved > 0) contact((oldX - this.x) / moved, (oldZ - this.z) / moved);
      this.x = oldX;
      this.z = oldZ;
      this.y = oldY;
      this.floor = oldFloor;
      this.ramp = this.level.rampAt(this)?.id ?? null;
    }
    if (this.grounded && (this.x !== oldX || this.z !== oldZ)) {
      const resolved = this.supportHeight(this.y + 0.1);
      if (resolved < this.y - 0.1) {
        this.grounded = false;
        this.vy = 0;
      } else this.y = resolved;
    }
    this.updateFloor();
    if (bumped) this.airTurn = 0;
    for (const e of this.events)
      if (e.kind === "land") {
        if (bumped) e.value = 0;
        else this.boost = Math.min(100, this.boost + e.value * 25);
      }
    if (bumped && impact > 0.65) this.loseChain("collision");
    if (bumped && this.ticks - this.bumpAt > 24 && impact > 0.65) {
      this.events.push({
        kind: "bump",
        x: this.x,
        y: this.y,
        z: this.z,
        value: impact,
        normalX: impactX,
        normalZ: impactZ,
      });
      this.bumpAt = this.ticks;
      this.speed *= 0.65;
    }
    if (this.mode !== "tutorial")
      for (const actor of this.residents) {
        const sameFloor = Math.abs(actor.y - this.y) < 0.2;
        if (
          this.nearMissTracker.update(
            actor.id,
            this.ticks,
            this,
            sameFloor
              ? distance(this, actor) - radius - actor.radius
              : Infinity,
            Math.hypot(this.vx, this.vz),
            bumped || !sameFloor,
          )
        ) {
          this.nearMisses++;
          this.score += 75;
          this.boost = Math.min(100, this.boost + 18);
          this.events.push({
            kind: "near-miss",
            x: this.x,
            y: this.y,
            z: this.z,
            value: 75,
          });
        }
      }
    const pad = this.level.BOOST_PADS.find(
      (p) =>
        Math.abs(
          (p.y > FLOOR_HEIGHT / 2
            ? p.y
            : this.level.groundHeight(this.x, this.z)) - this.y,
        ) < 0.1 &&
        Math.abs(p.x - this.x) < p.w / 2 &&
        Math.abs(p.z - this.z) < p.d / 2,
    );
    if (pad && this.padContact !== pad.id) {
      this.boost = 100;
      this.events.push({
        kind: "boost",
        x: this.x,
        y: this.y,
        z: this.z,
        value: 100,
      });
    }
    this.padContact = pad?.id ?? null;
    this.distanceDriven += Math.hypot(this.x - oldX, this.z - oldZ);
    for (let i = 0; i < this.dust.length; i++) {
      const d = this.dust[i];
      if (
        !d.active &&
        d.respawnAt <= this.ticks &&
        ((this.grounded && Math.abs(this.y - d.y) > 0.4) ||
          distance(this, d) > 2.25)
      ) {
        // Fixed return locations make a daily route learnable. A spot stays empty
        // while carried, then cools down and cannot refill beneath a parked robot.
        this.dust[i] = { ...d, active: true, respawnAt: 0 };
        continue;
      }
      if (
        d.active &&
        this.bin.length < CAPACITY &&
        Math.abs(this.y - d.y) < 0.15 &&
        distance(this, d) < 0.43
      ) {
        d.active = false;
        d.respawnAt = Infinity;
        this.carriedDust.push(d.id);
        this.bin.push(d.value);
        this.events.push({
          kind: "pickup",
          x: d.x,
          y: d.y,
          z: d.z,
          value: d.value,
        });
      }
    }
    const dockDistance = distance(this, this.level.DOCK);
    if (dockDistance > 1.35) this.dockReady = true;
    if (
      this.bin.length &&
      this.dockReady &&
      this.floor === 0 &&
      Math.abs(this.y - this.level.DOCK.y) < 0.15 &&
      dockDistance < 0.85
    ) {
      const count = this.bin.length;
      if (count < CAPACITY) this.loseChain("partial");
      const multiplier =
        this.mode === "tutorial"
          ? 1
          : this.chain.deliver(count === CAPACITY, this.ticks);
      const value = Math.round(
        multiplier *
          this.bin.reduce((a, b) => a + b, 0) *
          (count === CAPACITY ? 2 : 1 + count * 0.1),
      );
      this.score += value;
      this.deposited += count;
      this.deliveries++;
      this.bestDelivery = Math.max(this.bestDelivery, value);
      const timeAdded =
        this.mode === "arcade" && count === CAPACITY
          ? Math.min(
              FULL_BIN_SECONDS,
              ARCADE_TIME_BUDGET - this.arcadeTimeEarned,
            )
          : 0;
      this.arcadeTimeEarned += timeAdded;
      this.remaining += timeAdded * 60;
      this.events.push({
        kind: "deposit",
        x: this.x,
        y: this.y,
        z: this.z,
        value,
        timeAdded,
        chain: this.chain.count,
      });
      for (const id of this.carriedDust) {
        const d = this.dust.find((d) => d.id === id);
        if (d) d.respawnAt = this.ticks + DUST_RESPAWN_TICKS;
      }
      this.carriedDust = [];
      this.bin = [];
      this.dockReady = false;
      this.boost = 100;
    }
    this.remaining--;
    if (
      this.remaining <= 0 ||
      (this.mode === "arcade" &&
        this.ticks >= (ARCADE_START_SECONDS + ARCADE_TIME_BUDGET) * 60)
    ) {
      this.remaining = 0;
      this.ended = true;
    }
  }
}
export function appendReplay(replay: Replay, input: number): void {
  const last = replay[replay.length - 1];
  if (last && last[0] === input) last[1]++;
  else replay.push([input, 1]);
}
export function validateReplay(value: unknown): asserts value is Replay {
  if (!Array.isArray(value) || !value.length || value.length > DAILY_TICKS)
    throw new Error("Invalid replay");
  let frames = 0;
  for (const row of value) {
    if (
      !Array.isArray(row) ||
      row.length !== 2 ||
      !Number.isInteger(row[0]) ||
      row[0] < 0 ||
      row[0] > 127 ||
      !Number.isInteger(row[1]) ||
      row[1] < 1 ||
      row[1] > DAILY_TICKS
    )
      throw new Error("Invalid replay frame");
    frames += row[1];
    if (frames > DAILY_TICKS) throw new Error("Replay too long");
  }
  if (frames !== DAILY_TICKS)
    throw new Error("Finish the full daily challenge before submitting");
}
export function replayDaily(
  seed: number,
  replay: unknown,
  level: Level,
): Simulation {
  validateReplay(replay);
  const sim = new Simulation("daily", seed, level);
  for (const [input, frames] of replay)
    for (let i = 0; i < frames; i++) sim.step(input);
  return sim;
}
