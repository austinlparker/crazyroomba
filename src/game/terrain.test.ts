import { describe, it, expect } from "vitest";
import * as T from "three";
import { heightField, sampleHeight, insidePolygon } from "./terrain";
import { loadLevel } from "./stages/load-data";
import { terrainSurface } from "./stages/terrain-world";
import { createLevel } from "./navigation";
import { Simulation, Keys } from "./simulation";
import { stairMotion } from "./stair-motion";
import { clipCamera, cameraPose } from "./camera";
import { disposeScene } from "./renderer";

it("samples both triangles and exact outer vertices without bilinear saddle drift", () => {
  const f = heightField(0, 0, 1, 1, 1, (x, z) => x * z);
  expect(sampleHeight(f, 0.2, 0.3)).toBe(0);
  expect(sampleHeight(f, 0.8, 0.7)).toBeCloseTo(0.5);
  expect(sampleHeight(f, 1, 1)).toBe(1);
  expect(sampleHeight(f, 4, 4)).toBe(1);
});

describe.each(["culdesac", "moon"] as const)("%s elevation", (id) => {
  it("matches the visible triangulated surface and rejects cut-away corners", async () => {
    const level = await loadLevel(id),
      group = terrainSurface(level);
    group.updateMatrixWorld(true);
    const ray = new T.Raycaster(),
      down = new T.Vector3(0, -1, 0);
    let sampled = 0,
      outside = 0;
    for (let i = 0; i < 150; i++) {
      const x =
        level.BOUNDS.minX +
        ((i * 0.61803398875) % 1) * (level.BOUNDS.maxX - level.BOUNDS.minX);
      const z =
        level.BOUNDS.minZ +
        ((i * 0.41421356237) % 1) * (level.BOUNDS.maxZ - level.BOUNDS.minZ);
      ray.set(new T.Vector3(x, 5, z), down);
      const hits = ray.intersectObject(group.children[0]);
      if (insidePolygon(x, z, level.outline!)) {
        expect(hits.length, `terrain hole at ${x},${z}`).toBeGreaterThan(0);
        expect(hits[0].point.y).toBeCloseTo(level.groundHeight(x, z), 5);
        sampled++;
      } else {
        expect(hits).toHaveLength(0);
        outside++;
      }
    }
    expect(sampled).toBeGreaterThan(80);
    expect(outside).toBeGreaterThan(5);
    expect(Math.max(...level.terrain!.heights)).toBeLessThan(1.4);
    disposeScene(group);
  });
  it("grounds every pickup and resident on the same surface", async () => {
    const level = await loadLevel(id),
      s = new Simulation("freeroam", 32, level);
    for (let i = 0; i < 240; i++) s.step(0);
    for (const d of s.dust.filter((d) => d.y < 1.4))
      expect(d.y).toBe(level.groundHeight(d.x, d.z));
    for (const r of s.residents) expect(r.y).toBe(level.groundHeight(r.x, r.z));
    for (const o of level.FURNITURE.filter((o) => o.floor === 0)) {
      // Props occupy flattened pads; the local models and collider bases agree.
      expect(level.groundHeight(o.x, o.z)).toBeCloseTo(0, 4);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          expect(
            level.groundHeight(o.x + (sx * o.w) / 2, o.z + (sz * o.d) / 2),
          ).toBeLessThan(0.008);
    }
  });
});

it("drives into and out of a crater without boost and collects dust in its bowl", async () => {
  const level = await loadLevel("moon"),
    s = new Simulation("freeroam", 1, level);
  Object.assign(s, { x: 0, z: -6, y: level.groundHeight(0, -6), angle: 0 });
  s.dust.forEach((d) => {
    d.active = false;
    d.respawnAt = 1e8;
  });
  Object.assign(s.dust[0], {
    x: 0,
    z: -2,
    y: level.groundHeight(0, -2),
    active: true,
  });
  let low = Infinity,
    high = -Infinity;
  for (let i = 0; i < 165; i++) {
    s.step(Keys.forward);
    low = Math.min(low, s.y);
    high = Math.max(high, s.y);
    expect(s.y).toBeCloseTo(level.groundHeight(s.x, s.z), 8);
    expect(s.stairBlocked).toBe(false);
  }
  expect(s.z).toBeGreaterThan(-0.2);
  expect(high).toBeGreaterThan(0.3);
  expect(low).toBeLessThan(-0.3);
  expect(s.bin.length).toBeGreaterThan(0);
  expect(s.floor).toBe(0);
});

it("tilts the chassis uphill and keeps the camera boom above a ridge", async () => {
  const base = await loadLevel("culdesac");
  const slope = createLevel({
    ...base,
    COLLIDERS: [],
    terrain: heightField(-2, -2, 4, 4, 0.25, (x, z) => x * 0.2 + z * 0.3),
  });
  const pose = { x: 0, z: 0, y: 0, angle: 0, speed: 1, boosting: false };
  const motion = stairMotion(pose, false, slope);
  expect(motion.pitch).toBeCloseTo(-Math.atan(0.3));
  expect(motion.roll).toBeCloseTo(Math.atan(0.2));
  for (const mode of ["chase", "first-person"] as const) {
    const camera = cameraPose(pose, mode, slope);
    expect(camera.position.y).toBeGreaterThan(
      slope.groundHeight(camera.position.x, camera.position.z),
    );
  }
  const ridge = createLevel({
    ...base,
    COLLIDERS: [],
    terrain: heightField(-2, -2, 4, 4, 0.25, (x) => 0.6 * Math.exp(-x * x * 8)),
  });
  const camera = clipCamera(
    { x: -1, y: 0.15, z: 0 },
    { x: 1, y: 0.15, z: 0 },
    ridge,
  );
  expect(camera.x).toBeLessThan(0);
  expect(camera.y).toBeGreaterThan(
    ridge.groundHeight(camera.x, camera.z) + 0.035,
  );
});

it("points the first-person lens uphill when approaching a crater rim", async () => {
  const level = await loadLevel("moon"),
    driver = { x: 0, z: -5.8, y: level.groundHeight(0, -5.8), angle: 0 };
  const camera = cameraPose(driver, "first-person", level);
  expect(camera.target.y).toBeGreaterThan(camera.position.y + 0.1);
});
