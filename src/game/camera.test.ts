import { describe, it, expect } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { cameraDepthRange, cameraFov } from "./camera";
import { cameraPose, clipCamera } from "./house-test-fixture";
import {
  START,
  stairSurfaceHeight,
  FLOOR_HEIGHT,
  FURNITURE,
  RAMPS,
  WALLS,
  rampHeight,
} from "./level";

describe("camera field of view", () => {
  it("gives boost zoom the same timing at 30, 60 and 144 Hz", () => {
    const values = [30, 60, 144].map((fps) => {
      let fov = 68;
      for (let frame = 0; frame < fps / 2; frame++)
        fov = cameraFov(fov, "chase", 16 / 9, true, 1 / fps, false, false);
      return fov;
    });
    expect(values[0]).toBeGreaterThan(73);
    expect(values[0]).toBeLessThan(74);
    expect(values[0]).toBeCloseTo(values[1], 12);
    expect(values[1]).toBeCloseTo(values[2], 12);
  });

  it("sets the lens immediately on camera cuts and removes zoom for reduced motion", () => {
    expect(cameraFov(43, "chase", 16 / 9, false, 0, true, false)).toBe(68);
    expect(
      cameraFov(68, "first-person", 16 / 9, false, 0, true, false),
    ).toBeCloseTo(82);
    expect(cameraFov(74, "chase", 16 / 9, true, 0, false, true)).toBe(68);
  });

  it("retains portrait visibility and settles smoothly after boost is released", () => {
    expect(
      cameraFov(68, "chase", 390 / 844, false, 0, true, false),
    ).toBeGreaterThan(95);
    expect(
      cameraFov(82, "first-person", 320 / 980, false, 0, true, false),
    ).toBe(106);
    const released = cameraFov(74, "chase", 16 / 9, false, 0.1, false, false);
    expect(released).toBeGreaterThan(68);
    expect(released).toBeLessThan(74);
    expect(cameraFov(74, "chase", 16 / 9, false, 0, false, false)).toBe(74);
  });
});

describe("preview depth precision", () => {
  it.each([9, 16, 33, 44])(
    "separates thin surface details across a stage of extent %s, including portrait previews",
    (extent) => {
      for (const aspect of [16 / 9, 1, 390 / 844, 320 / 980]) {
        const size = extent * (aspect > 1 ? 1 : Math.max(1.05, 0.94 / aspect));
        const distance = Math.hypot(size * 1.3, size * 1.15 - 1);
        const { near, far } = cameraDepthRange(true, distance, extent);
        const camera = new PerspectiveCamera(43, aspect, near, far);
        // Two-millimetre separation at the far side of the stage must span
        // several 24-bit depth values, even at the most distant phone framing.
        const depthAt = (z: number) =>
          (new Vector3(0, 0, -z).project(camera).z * 0.5 + 0.5) * (2 ** 24 - 1);
        const z = distance + extent;
        expect(depthAt(z + 0.002) - depthAt(z)).toBeGreaterThan(8);
        expect(near).toBeLessThan(distance - extent);
        expect(far).toBeGreaterThan(distance + extent);
      }
    },
  );
  it("retains close-up clearance during driving and when returning to the menu", () => {
    expect(cameraDepthRange(false, 1, 44).near).toBe(0.025);
    expect(cameraDepthRange(true, 1, 44).near).toBe(0.025);
    expect(cameraDepthRange(false, 1, 44).far).toBe(260);
  });
});

describe("floor-level cameras", () => {
  it("keeps chase close and first person at the robot's sensor height", () => {
    const driver = { ...START };
    const chase = cameraPose(driver, "chase"),
      first = cameraPose(driver, "first-person");
    expect(chase.position.y).toBe(0.52);
    expect(
      Math.hypot(chase.position.x - driver.x, chase.position.z - driver.z),
    ).toBeCloseTo(1.2);
    expect(first.position.y).toBe(0.105);
    expect(first.position.x).toBeLessThan(driver.x);
  });
  it("clips the chase boom before an intervening floorplan wall", () => {
    const wall = WALLS.find(
      (w) =>
        w.floor === 0 &&
        !w.exterior &&
        w.bottom === 0 &&
        w.w < 0.2 &&
        w.d > 1.2,
    )!;
    const anchor = { x: wall.x + 0.45, y: 0.2, z: wall.z };
    const p = clipCamera(anchor, { x: wall.x - 0.6, y: 0.52, z: wall.z });
    expect(p.x).toBeGreaterThan(wall.x + wall.w / 2 + 0.035);
    expect(p.x).toBeLessThan(anchor.x);
  });
  it("crouches below a bed rather than putting the camera in its mattress", () => {
    const bed = FURNITURE.find((o) => o.kind === "bed")!;
    const y = bed.floor * FLOOR_HEIGHT;
    const pose = cameraPose({ x: bed.x, y, z: bed.z, angle: 0 }, "chase");
    expect(pose.position.y - y).toBeGreaterThan(0.13);
    expect(pose.position.y - y).toBeLessThan(bed.bottom - 0.035);
  });
  it.each(["first-person", "chase"] as const)(
    "keeps the %s sightline above the stairs in both directions and across the top landing",
    (mode) => {
      for (const ramp of RAMPS)
        for (const angle of [0, Math.PI])
          for (const progress of [0.02, 0.25, 0.5, 0.75, 0.85, 0.95, 0.99]) {
            const z = ramp.bottomZ + (ramp.topZ - ramp.bottomZ) * progress;
            const pose = cameraPose(
              { x: ramp.x, z, y: rampHeight(ramp, z), angle },
              mode,
            );
            for (let step = 0; step <= 20; step++) {
              const fraction = step / 20;
              const sightZ =
                pose.position.z + (pose.target.z - pose.position.z) * fraction;
              const sightY =
                pose.position.y + (pose.target.y - pose.position.y) * fraction;
              expect(
                sightY - stairSurfaceHeight(ramp, sightZ),
                `${ramp.id} ${mode} at z=${z}, angle=${angle}, sight z=${sightZ}`,
              ).toBeGreaterThan(0.02);
            }
          }
    },
  );
  it.each(RAMPS)(
    "keeps the eye at the $id landing height and levels the view as it clears the crest",
    (ramp) => {
      const direction = Math.sign(ramp.topZ - ramp.bottomZ);
      const z = ramp.topZ - direction * 0.05;
      const pose = cameraPose(
        {
          x: ramp.x,
          z,
          y: rampHeight(ramp, z),
          angle: direction > 0 ? 0 : Math.PI,
        },
        "first-person",
      );
      expect((pose.position.z - ramp.topZ) * direction).toBeGreaterThan(0);
      expect(pose.position.y).toBeCloseTo(FLOOR_HEIGHT + 0.105);
      expect(pose.target.y).toBeCloseTo(pose.position.y);
    },
  );
  it("follows the upstairs floor and does not collide with furniture below it", () => {
    const lowerSofa = FURNITURE.find(
      (o) => o.floor === 0 && o.kind === "sofa",
    )!;
    const pose = cameraPose(
      { x: lowerSofa.x, z: lowerSofa.z, y: FLOOR_HEIGHT, angle: 0 },
      "first-person",
    );
    expect(pose.position.y).toBeCloseTo(FLOOR_HEIGHT + 0.105);
  });
});
