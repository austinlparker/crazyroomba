import { expect, it } from "vitest";
import {
  DeliveryChain,
  NearMissTracker,
  CHAIN_WINDOW,
} from "./driving-rewards";
import { Simulation } from "./simulation";
import { loadLevel } from "./stages/load-data";

it("rewards timely full-bin deliveries, caps the bonus, and expires it at the deadline", () => {
  const c = new DeliveryChain();
  expect(c.deliver(true, 1)).toBe(1);
  expect(c.deliver(true, 500)).toBe(1.25);
  for (let i = 0; i < 20; i++) c.deliver(true, 501 + i);
  expect(c.multiplier).toBe(2);
  c.expire(520 + CHAIN_WINDOW);
  expect(c.count).toBe(0);
  expect(c.best).toBe(5);
  expect(c.deliver(true, 9999)).toBe(1);
});
it("partial deliveries and collisions break the chain without deleting the best", () => {
  const c = new DeliveryChain();
  c.deliver(true, 1);
  c.deliver(true, 2);
  expect(c.deliver(false, 3)).toBe(1);
  expect(c.count).toBe(0);
  c.deliver(true, 4);
  c.break();
  expect(c.multiplier).toBe(1);
  expect(c.best).toBe(2);
});
it("requires a completed moving near miss and rejects collisions, parking and repeat farming", () => {
  const m = new NearMissTracker();
  expect(m.update("dog", 1, { x: 0, z: 0 }, 0.2, 2, false)).toBe(false);
  expect(m.update("dog", 2, { x: 0, z: 0.1 }, 0.7, 2, false)).toBe(false);
  m.update("dog", 3, { x: 0, z: 0 }, 0.2, 2, false);
  expect(m.update("dog", 4, { x: 0, z: 1.3 }, 0.8, 2, false)).toBe(true);
  m.update("dog", 5, { x: 0, z: 0 }, 0.2, 2, false);
  expect(m.update("dog", 6, { x: 0, z: 2 }, 0.8, 2, false)).toBe(false);
  m.update("cat", 1, { x: 0, z: 0 }, 0.2, 2, false);
  m.update("cat", 2, { x: 0, z: 0.1 }, -0.01, 2, true);
  expect(m.update("cat", 3, { x: 0, z: 2 }, 0.8, 2, false)).toBe(false);
});
it("cancels an unfinished near miss when braking and permits a fresh clean pass", () => {
  const m = new NearMissTracker();
  m.update("dog", 1, { x: 0, z: 0 }, 0.2, 2, false);
  m.update("dog", 2, { x: 0, z: 0.2 }, 0.2, 0, false);
  expect(m.update("dog", 500, { x: 0, z: 1.3 }, 0.8, 2, false)).toBe(false);
  // Stopping is not a collision: a new, uninterrupted pass can score immediately.
  m.update("dog", 501, { x: 0, z: 0 }, 0.2, 2, false);
  expect(m.update("dog", 550, { x: 0, z: 1.3 }, 0.8, 2, false)).toBe(true);
});
it("requires forward or reverse driving speed throughout a near miss", () => {
  const m = new NearMissTracker();
  m.update("cat", 1, { x: 0, z: 0 }, 0.2, 2, false);
  expect(m.update("cat", 2, { x: 0, z: 1.3 }, 0.8, 1.2, false)).toBe(false);
  expect(m.update("cat", 3, { x: 0, z: 2 }, 0.8, 2, false)).toBe(false);
  m.update("cat", 4, { x: 0, z: 0 }, 0.2, -2, false);
  expect(m.update("cat", 5, { x: 0, z: -1.3 }, 0.8, -2, false)).toBe(true);
});
it("applies chain rewards to real deliveries while keeping the daily timer fixed", async () => {
  const s = new Simulation("daily", 1, await loadLevel("apartment"));
  s.dust = [];
  s.residents = [];
  s.x = s.level.DOCK.x;
  s.z = s.level.DOCK.z;
  s.bin = [100, 100, 100, 100, 100];
  s.step(0);
  expect(s.score).toBe(1000);
  s.x = s.level.START.x + 0.5;
  s.z = s.level.START.z;
  s.step(0);
  s.x = s.level.DOCK.x;
  s.z = s.level.DOCK.z;
  s.bin = [100, 100, 100, 100, 100];
  s.step(0);
  expect(s.score).toBe(2250);
  expect(s.remaining).toBe(5397);
  expect(s.chain.count).toBe(2);
});
