import { ROBOT_HEIGHT, ROBOT_RADIUS } from "./level-types";
import { furnitureModel } from "./furniture-models";
import { createResident, animateResident } from "./household-models";
import { ROUTINES, createResidents } from "./household";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { loadWorld } from "./stages/load-world";
import { STAGES } from "./stage-catalog";
import {
  clearModelCache,
  createRobot,
  applySkin,
  box,
  mergeStatic,
} from "./models";
import { disposeScene } from "./renderer";
// Canvas drawing is mocked here; these checks cover generated mesh topology and
// resource ownership. Actual texture appearance still requires browser review.
beforeEach(() => {
  const noop = () => {};
  const ctx = new Proxy(
    {
      createRadialGradient: () => ({ addColorStop: noop }),
      measureText: () => ({ width: 100 }),
    } as Record<string, unknown>,
    {
      get: (target, key) => target[String(key)] ?? noop,
      set: (target, key, value) => {
        target[String(key)] = value;
        return true;
      },
    },
  );
  vi.stubGlobal("document", {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
  });
});
afterEach(() => {
  clearModelCache();
  vi.unstubAllGlobals();
});
describe.each(STAGES)("$name generated scene", ({ id }) => {
  it("creates finite geometry, then disposes every owned geometry and material", async () => {
    const build = await loadWorld(id);
    clearModelCache();
    const { group } = build();
    const geometries = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>(),
      textures = new Set<T.Texture>();
    let vertices = 0;
    group.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Points) {
        geometries.add(o.geometry);
        vertices += o.geometry.getAttribute("position").count;
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materials.add(m);
      }
    });
    expect(vertices).toBeGreaterThan(100);
    expect(geometries.size).toBeLessThan(400);
    for (const g of geometries) {
      g.computeBoundingBox();
      const box = g.boundingBox!;
      expect(
        [...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite),
      ).toBe(true);
    }
    for (const m of materials)
      for (const v of Object.values(m))
        if (v instanceof T.Texture) textures.add(v);
    const disposed = new Set<unknown>();
    for (const item of [...geometries, ...materials, ...textures])
      item.addEventListener("dispose", () => disposed.add(item));
    disposeScene(group);
    expect(group.children).toHaveLength(0);
    expect(disposed.size).toBe(
      geometries.size + materials.size + textures.size,
    );
  });
});
it("recolors only the robot and keeps its dimensions cosmetic", () => {
  clearModelCache();
  const a = createRobot(),
    b = createRobot();
  const before = new T.Box3().setFromObject(a).getSize(new T.Vector3());
  applySkin(a, "hotrod");
  const shell = (root: T.Group) => {
    const colors: number[] = [];
    root.traverse((o) => {
      if (o instanceof T.Mesh && o.userData.skinPart === "shell")
        colors.push((o.material as T.MeshStandardMaterial).color.getHex());
    });
    return colors;
  };
  expect(shell(a)).not.toEqual(shell(b));
  expect(
    new T.Box3().setFromObject(a).getSize(new T.Vector3()).equals(before),
  ).toBe(true);
  disposeScene(a);
  disposeScene(b);
});

it("keeps merged geometry in a transformed parent's local space", () => {
  const root = new T.Group(),
    parent = new T.Group();
  root.position.set(3, 2, -7);
  root.rotation.y = 0.6;
  root.scale.set(1.2, 0.8, 2);
  parent.position.set(-1, 0.7, 2);
  parent.rotation.z = 0.3;
  root.add(parent);
  box(parent, 0.3, 0.2, -0.4, 0.7, 0.4, 0.9, "#aabbcc");
  const before = new T.Box3().setFromObject(root, true);
  mergeStatic(parent);
  const after = new T.Box3().setFromObject(root, true);
  expect(before.min.distanceTo(after.min)).toBeLessThan(1e-6);
  expect(before.max.distanceTo(after.max)).toBeLessThan(1e-6);
  disposeScene(root);
});

it("batches static model attributes exactly like the general Three merger", () => {
  const group = new T.Group();
  for (const x of [-1, 1]) {
    const mesh = box(
      group,
      x,
      0.3,
      0.2,
      0.7,
      0.4,
      0.9,
      "#aabbcc",
      x < 0 ? 0 : 0.025,
    );
    mesh.rotation.y = x * 0.4;
    const colors = new Float32Array(
      mesh.geometry.getAttribute("position").count * 3,
    ).fill(0.35);
    mesh.geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  }
  group.updateMatrixWorld(true);
  const sources = group.children.map((child) => {
    const mesh = child as T.Mesh;
    return (
      mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    ).applyMatrix4(mesh.matrixWorld);
  });
  const expected = mergeGeometries(sources)!;
  mergeStatic(group);
  expect(group.children).toHaveLength(1);
  const actual = (group.children[0] as T.Mesh).geometry;
  for (const name of Object.keys(expected.attributes)) {
    expect(actual.getAttribute(name).itemSize).toBe(
      expected.getAttribute(name).itemSize,
    );
    expect(actual.getAttribute(name).array).toEqual(
      expected.getAttribute(name).array,
    );
  }
  for (const g of [...sources, expected]) g.dispose();
  disposeScene(group);
});

it("preserves mismatched attribute layouts and unsupported formats without losing meshes", () => {
  const group = new T.Group();
  const plain = box(group, -1, 0, 0, 1, 1, 1, "#aabbcc"),
    colored = box(group, 1, 0, 0, 1, 1, 1, "#aabbcc"),
    packed = box(group, 3, 0, 0, 1, 1, 1, "#aabbcc");
  colored.geometry.setAttribute(
    "color",
    new T.BufferAttribute(
      new Float32Array(
        colored.geometry.getAttribute("position").count * 3,
      ).fill(0.5),
      3,
    ),
  );
  packed.geometry.setAttribute(
    "color",
    new T.Uint8BufferAttribute(
      new Uint8Array(packed.geometry.getAttribute("position").count * 3).fill(
        128,
      ),
      3,
      true,
    ),
  );
  const before = new T.Box3().setFromObject(group, true);
  const vertexCount = [plain, colored, packed].reduce(
    (n, mesh) => n + mesh.geometry.getAttribute("position").count,
    0,
  );
  mergeStatic(group);
  expect(group.children).toHaveLength(3);
  expect(packed.parent).toBe(group);
  expect(
    group.children.reduce(
      (n, mesh) => n + (mesh as T.Mesh).geometry.getAttribute("position").count,
      0,
    ),
  ).toBe(vertexCount);
  expect(new T.Box3().setFromObject(group, true).equals(before)).toBe(true);
  disposeScene(group);
});

it("keeps the Roomba shell inside its driving radius and overhead clearance", () => {
  const robot = createRobot();
  robot.position.y = 0.012;
  robot.updateMatrixWorld(true);
  const vertices = new T.Vector3();
  robot.traverse((o) => {
    if (!(o instanceof T.Mesh) || o.parent?.name === "brush") return;
    const p = o.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      vertices.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      expect(vertices.y).toBeLessThanOrEqual(ROBOT_HEIGHT + 0.0001);
      expect(Math.hypot(vertices.x, vertices.z)).toBeLessThanOrEqual(
        ROBOT_RADIUS + 0.0001,
      );
    }
  });
  disposeScene(robot);
});

it.each([
  ["bed", 1.65, 2, 0.38, 0.68],
  ["sofa", 2, 0.8, 0.17, 0.7],
] as const)(
  "preserves the center crawl space under %s",
  (kind, w, d, bottom, top) => {
    const group = new T.Group();
    furnitureModel(group, kind, w, d, bottom, top);
    group.updateMatrixWorld(true);
    // Cast down through the full model and inspect backfaces as well as frontfaces.
    group.traverse((o) => {
      if (o instanceof T.Mesh) (o.material as T.Material).side = T.DoubleSide;
    });
    for (const z of [-d * 0.25, 0, d * 0.25]) {
      const ray = new T.Raycaster(
        new T.Vector3(0, 0.001, z),
        new T.Vector3(0, 1, 0),
      );
      const hit = ray.intersectObject(group, true)[0];
      expect(hit).toBeDefined();
      expect(hit.point.y).toBeGreaterThanOrEqual(bottom - 0.001);
    }
    disposeScene(group);
  },
);

it.each([
  ["house sofa", "sofa", 2.45, 0.9, 0, 0.93],
  ["house armchair", "chair", 0.75, 0.85, 0, 0.85],
  ["house window bench", "chair", 1.7, 0.5, 0, 0.55],
  ["house reading chair", "chair", 0.65, 0.55, 0, 0.6],
  ["apartment sofa", "sofa", 2, 0.8, 0.17, 0.7],
  ["gallery sofa", "sofa", 2, 0.8, 0.17, 0.85],
] as const)(
  "connects the %s cushions and arms to their base without closing crawl clearance",
  (_label, kind, w, d, bottom, top) => {
    const group = new T.Group();
    furnitureModel(group, kind, w, d, bottom, top);
    group.updateMatrixWorld(true);
    const meshes: T.Mesh[] = [];
    group.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      (o.material as T.Material).side = T.DoubleSide;
      meshes.push(o);
    });
    const seat = bottom + (top - bottom) * 0.4;
    // Measure actual solid support below seats, arms and the entire rear frame.
    // Front-only rays miss the air gap behind the tilted back cushions.
    for (const [x, z, targetTop] of [
      [0, 0.035, seat + 0.065],
      [-w / 2 + 0.075, 0.035, seat + 0.065],
      [w / 2 - 0.075, 0.035, seat + 0.065],
      [0, -d / 2 + 0.055, top - 0.05],
      [-w * 0.3, -d / 2 + 0.055, top - 0.05],
      [w * 0.3, -d / 2 + 0.055, top - 0.05],
    ]) {
      const ray = new T.Raycaster(
        new T.Vector3(x, -0.2, z),
        new T.Vector3(0, 1, 0),
      );
      const intervals = meshes
        .flatMap((mesh) => {
          const hits = ray.intersectObject(mesh, false);
          if (hits.length < 2) return [];
          return [[hits[0].point.y, hits.at(-1)!.point.y]];
        })
        .sort((a, b) => a[0] - b[0]);
      expect(intervals[0][0]).toBeGreaterThanOrEqual(bottom - 0.001);
      let supportedTop = intervals[0][1];
      for (const [lo, hi] of intervals.slice(1)) {
        if (lo > supportedTop + 0.001) break;
        supportedTop = Math.max(supportedTop, hi);
      }
      expect(
        supportedTop,
        `unattached cushion at x=${x}, z=${z}`,
      ).toBeGreaterThan(targetTop);
    }
    // Tuft buttons must touch the tilted cushion face, rather than remaining
    // fixed in world space a few centimeters in front of it.
    for (const button of meshes.filter(
      (m) => m.geometry instanceof T.SphereGeometry,
    )) {
      const ray = new T.Raycaster(
        button.getWorldPosition(new T.Vector3()),
        new T.Vector3(0, 0, -1).transformDirection(button.parent!.matrixWorld),
      );
      const hit = ray.intersectObjects(
        button.parent!.children.filter((o) => o !== button),
        true,
      )[0];
      expect(hit).toBeDefined();
      expect(hit.distance).toBeLessThanOrEqual(0.0061);
    }
    disposeScene(group);
  },
);

it.each(ROUTINES)(
  "keeps $id grounded through an entire walk cycle",
  (routine) => {
    const actor = createResidents(42).find((a) => a.id === routine.id)!;
    const model = createResident(routine.id);
    actor.x = actor.z = actor.y = 0;
    actor.angle = 0;
    actor.moving = true;
    for (let i = 0; i < 40; i++) {
      actor.travel = i / 20;
      animateResident(model, actor, false, i * 0.1);
      const bounds = new T.Box3().setFromObject(model, true);
      expect(bounds.min.y).toBeGreaterThan(-0.02);
      expect(bounds.max.y).toBeLessThan(routine.height + 0.075);
    }
    let meshes = 0;
    model.traverse((o) => {
      if (o instanceof T.Mesh) meshes++;
    });
    expect(meshes).toBeLessThan(45);
    disposeScene(model);
  },
);
