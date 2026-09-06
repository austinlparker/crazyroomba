import { expect, it } from "vitest";
import { returnTarget } from "./guidance";
import { loadLevel } from "./stages/load-data";
it("guides upper-floor deliveries to the entrance, then down the ramp, then to the dock", async () => {
  const level = await loadLevel("moon"),
    r = level.RAMPS[0],
    p = { level, x: 8, z: -8, y: 2.8, ramp: null as string | null };
  expect(returnTarget(p)).toEqual({ x: r.x, z: r.topZ });
  p.ramp = r.id;
  p.y = 1.4;
  p.z = -2;
  expect(returnTarget(p)).toEqual({ x: r.x, z: r.bottomZ });
  p.ramp = null;
  p.y = 0;
  p.z = 2;
  expect(returnTarget(p)).toEqual(level.DOCK);
});

it("guides crater-rim deliveries straight to the dock", async () => {
  const level = await loadLevel("moon"),
    x = 0,
    z = -5.3;
  const y = level.groundHeight(x, z);
  expect(y).toBeGreaterThan(0.2);
  expect(returnTarget({ level, x, z, y, ramp: null })).toEqual(level.DOCK);
});
