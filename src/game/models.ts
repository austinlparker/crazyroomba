import { skinInfo, type SkinId } from "./progression";
import * as T from "three";
import { skinPattern } from "./skin-patterns";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
const materials = new Map<string, T.MeshStandardMaterial>();
export function material(
  color: string,
  roughness = 0.7,
  metalness = 0,
): T.MeshStandardMaterial {
  const key = `${color}:${roughness}:${metalness}`;
  if (!materials.has(key))
    materials.set(
      key,
      new T.MeshStandardMaterial({ color, roughness, metalness }),
    );
  return materials.get(key)!;
}
export function box(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: string,
  radius = 0.025,
): T.Mesh {
  const mesh = new T.Mesh(
    radius
      ? new RoundedBoxGeometry(
          w,
          h,
          d,
          2,
          Math.min(radius, w / 3, h / 3, d / 3),
        )
      : new T.BoxGeometry(w, h, d),
    material(color),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function cylinder(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  color: string,
  top = r,
): T.Mesh {
  const mesh = new T.Mesh(
    new T.CylinderGeometry(top, r, h, 24),
    material(color),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function sphere(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  r: number,
  color: string,
): T.Mesh {
  const mesh = new T.Mesh(new T.SphereGeometry(r, 12, 8), material(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
/** Revolved profiles give small props a continuous silhouette without heavy assets. */
export function lathe(
  parent: T.Object3D,
  profile: [number, number][],
  color: string,
  segments = 32,
) {
  const mesh = new T.Mesh(
    new T.LatheGeometry(
      profile.map(([r, y]) => new T.Vector2(r, y)),
      segments,
    ),
    material(color),
  );
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function ring(
  parent: T.Object3D,
  radius: number,
  tube: number,
  color: string,
  arc = Math.PI * 2,
) {
  const mesh = new T.Mesh(
    new T.TorusGeometry(radius, tube, 6, 32, arc),
    material(color),
  );
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function beam(
  parent: T.Object3D,
  a: [number, number, number],
  b: [number, number, number],
  radius: number,
  color: string,
) {
  const start = new T.Vector3(...a),
    end = new T.Vector3(...b),
    delta = end.clone().sub(start);
  const mesh = new T.Mesh(
    new T.CylinderGeometry(radius * 0.85, radius, delta.length(), 8),
    material(color),
  );
  mesh.position.copy(start.add(end).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function ellipsoid(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: string,
) {
  const m = sphere(parent, x, y, z, 1, color);
  m.scale.set(w / 2, h / 2, d / 2);
  return m;
}
/** Shared, tiny finish maps; disposed with the scene and evicted on stage changes. */
export function finish(color: string, kind: "fabric" | "wood" = "fabric") {
  const key = `${color}:${kind}`;
  if (!materials.has(key)) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 128; i += kind === "fabric" ? 4 : 8) {
      ctx.strokeStyle =
        kind === "wood"
          ? i % 3
            ? "rgba(255,240,220,.05)"
            : "rgba(35,20,30,.07)"
          : i % 3
            ? "rgba(255,240,220,.1)"
            : "rgba(35,20,30,.16)";
      ctx.lineWidth = kind === "fabric" ? 1 : 2;
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.bezierCurveTo(i + (kind === "wood" ? 2 : 0), 42, i - 1, 86, i, 128);
      ctx.stroke();
      if (kind === "fabric") {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(128, i);
        ctx.stroke();
      }
    }
    const map = new T.CanvasTexture(c);
    map.colorSpace = T.SRGBColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.set(kind === "fabric" ? 3 : 1, 3);
    map.anisotropy = 8;
    materials.set(
      key,
      new T.MeshStandardMaterial({
        map,
        roughness: kind === "fabric" ? 0.96 : 0.48,
      }),
    );
  }
  return materials.get(key)!;
}
export function mergeStatic(parent: T.Group): void {
  parent.updateWorldMatrix(true, true);
  const inverse = parent.matrixWorld.clone().invert();
  type Batch = {
    material: T.Material;
    cast: boolean;
    receive: boolean;
    ignore: boolean;
    geometries: T.BufferGeometry[];
  };
  const batches = new Map<string, Batch>(),
    meshes: T.Mesh[] = [];
  parent.traverse((o) => {
    if (!(o instanceof T.Mesh) || Array.isArray(o.material)) return;
    // Generated static models use plain Float32 attributes. Keep other mesh
    // formats intact instead of loading general skin/morph conversion machinery.
    const attributes = Object.keys(o.geometry.attributes)
      .sort()
      .map((name) => [name, o.geometry.getAttribute(name)] as const);
    if (
      o instanceof T.InstancedMesh ||
      Object.keys(o.geometry.morphAttributes).length ||
      attributes.some(
        ([, a]) =>
          !(a instanceof T.BufferAttribute) ||
          !(a.array instanceof Float32Array) ||
          a.normalized ||
          a.gpuType !== T.FloatType,
      )
    )
      return;
    const layout = attributes
      .map(([name, a]) => `${name}:${a.itemSize}`)
      .join(",");
    const key = `${o.material.uuid}:${o.castShadow}:${o.receiveShadow}:${!!o.userData.cameraIgnore}:${layout}`;
    const batch: Batch = batches.get(key) ?? {
      material: o.material,
      cast: o.castShadow,
      receive: o.receiveShadow,
      ignore: !!o.userData.cameraIgnore,
      geometries: [],
    };
    // Rounded boxes are non-indexed; normalize planes/cylinders before batching.
    batch.geometries.push(
      (o.geometry.index
        ? o.geometry.toNonIndexed()
        : o.geometry.clone()
      ).applyMatrix4(inverse.clone().multiply(o.matrixWorld)),
    );
    batches.set(key, batch);
    meshes.push(o);
  });
  for (const mesh of meshes) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
  }
  for (const batch of batches.values()) {
    const merged = new T.BufferGeometry();
    for (const name of Object.keys(batch.geometries[0].attributes)) {
      const attributes = batch.geometries.map((g) => g.getAttribute(name));
      const array = new Float32Array(
        attributes.reduce((n, a) => n + a.array.length, 0),
      );
      let offset = 0;
      for (const attribute of attributes) {
        array.set(attribute.array, offset);
        offset += attribute.array.length;
      }
      merged.setAttribute(
        name,
        new T.BufferAttribute(array, attributes[0].itemSize),
      );
    }
    const mesh = new T.Mesh(merged, batch.material);
    mesh.castShadow = batch.cast;
    mesh.receiveShadow = batch.receive;
    mesh.userData.cameraIgnore = batch.ignore;
    parent.add(mesh);
    batch.geometries.forEach((geometry) => geometry.dispose());
  }
}
export function createRobot(): T.Group {
  const g = new T.Group();
  // Rolled shell, inset rubber bumper and chamfered lid; same gameplay envelope.
  lathe(
    g,
    [
      [0, 0.065],
      [0.35, 0.065],
      [0.407, 0.09],
      [0.437, 0.135],
      [0.44, 0.235],
      [0.429, 0.285],
      [0.405, 0.3],
      [0, 0.3],
    ],
    "#202b40",
    64,
  );
  lathe(
    g,
    [
      [0.406, 0.273],
      [0.43, 0.285],
      [0.438, 0.313],
      [0.43, 0.349],
      [0.405, 0.378],
      [0.355, 0.395],
      [0, 0.395],
    ],
    "#ffca26",
    64,
  );
  const lip = ring(g, 0.409, 0.011, "#252a41");
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.363;
  // Segmented front sensor band follows the bumper instead of sticking out of it.
  const bumper = lathe(
    g,
    [
      [0.442, 0.16],
      [0.449, 0.17],
      [0.449, 0.236],
      [0.44, 0.247],
    ],
    "#111d2c",
    64,
  );
  bumper.material = material("#111d2c", 0.28, 0.2);
  for (const side of [-1, 1]) {
    const sensor = ellipsoid(
      g,
      side * 0.135,
      0.212,
      0.414,
      0.105,
      0.064,
      0.025,
      "#a5ddeb",
    );
    sensor.rotation.y = side * 0.3;
    sensor.material = material("#a5ddeb", 0.15, 0.4);
    for (let i = 0; i < 7; i++) {
      const vent = box(
        g,
        side * 0.362,
        0.388,
        -0.12 + i * 0.034,
        0.034,
        0.012,
        0.017,
        "#252a41",
        0.005,
      );
      vent.rotation.z = -side * 0.15;
    }
    const wheel = new T.Group();
    wheel.position.set(side * 0.383, 0.1, -0.015);
    wheel.rotation.z = Math.PI / 2;
    g.add(wheel);
    lathe(
      wheel,
      [
        [0, -0.043],
        [0.086, -0.043],
        [0.117, -0.031],
        [0.122, 0],
        [0.117, 0.031],
        [0.086, 0.043],
        [0, 0.043],
      ],
      "#182332",
      24,
    );
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      box(
        wheel,
        Math.sin(a) * 0.118,
        0,
        Math.cos(a) * 0.118,
        0.025,
        0.07,
        0.015,
        "#354254",
        0.003,
      ).rotation.y = a;
    }
  }
  // Lidar cap, recessed buttons, dust-bin latch and charging contacts.
  cylinder(g, 0, 0.416, -0.07, 0.098, 0.042, "#252a41");
  cylinder(g, 0, 0.442, -0.07, 0.083, 0.018, "#202b40");
  const halo = ring(g, 0.063, 0.007, "#95ffcf");
  halo.rotation.x = Math.PI / 2;
  halo.position.set(0, 0.453, -0.07);
  for (const x of [-0.054, 0.054])
    cylinder(g, x, 0.403, 0.125, 0.022, 0.009, "#252a41");
  box(g, 0, 0.375, -0.305, 0.12, 0.022, 0.05, "#252a41", 0.009);
  for (const x of [-0.15, 0.15])
    box(g, x, 0.117, -0.399, 0.06, 0.026, 0.012, "#d4b474", 0.003);
  for (const angle of [-0.8, 0.8, 2.4, -2.4]) {
    const screw = cylinder(
      g,
      Math.sin(angle) * 0.384,
      0.372,
      Math.cos(angle) * 0.384,
      0.011,
      0.008,
      "#718491",
    );
    screw.material = material("#718491", 0.3, 0.7);
  }
  const brush = new T.Group();
  brush.name = "brush";
  brush.position.set(0.345, 0.027, 0.21);
  for (let i = 0; i < 3; i++) {
    const arm = new T.Group();
    arm.rotation.y = (i * Math.PI * 2) / 3;
    brush.add(arm);
    box(arm, 0, 0, 0.07, 0.027, 0.019, 0.14, "#34374a", 0.005);
    for (let k = -1; k <= 1; k++)
      beam(
        arm,
        [k * 0.012, 0, 0.12],
        [k * 0.024, -0.007, 0.213],
        0.006,
        "#d0a168",
      );
  }
  cylinder(brush, 0, 0, 0, 0.035, 0.025, "#252a41");
  mergeStatic(g);
  mergeStatic(brush);
  g.add(brush);
  g.traverse((o) => {
    if (!(o instanceof T.Mesh) || Array.isArray(o.material)) return;
    const m = o.material as T.MeshStandardMaterial;
    o.material = m.clone();
    const hex = m.color.getHexString();
    o.userData.skinPart =
      hex === "ffca26" ? "shell" : hex === "252a41" ? "accent" : "";
  });
  const decal = new T.Mesh(
    new T.CircleGeometry(0.35, 64),
    new T.MeshStandardMaterial({ roughness: 0.38, metalness: 0.2 }),
  );
  decal.name = "skin-decal";
  decal.rotation.x = -Math.PI / 2;
  decal.position.y = 0.398;
  g.add(decal);
  applySkin(g, "taxi");
  g.scale.set(0.4, 0.255, 0.4);
  return g;
}
export function createDust(): T.Group {
  const g = new T.Group();
  // One soft, irregular puff: small lobes blend into the body instead of
  // reading as paws, and the face sits clear of its front surface.
  const fluff = new T.SphereGeometry(1, 24, 16);
  const positions = fluff.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    const r = 1 + 0.055 * Math.sin(x * 13 + y * 9) * Math.sin(z * 12 - y * 7);
    positions.setXYZ(i, x * r, y * r, z * r);
  }
  fluff.computeVertexNormals();
  const body = new T.Mesh(fluff, material("#dcd3b8"));
  body.material.roughness = 1;
  body.position.y = 0.16;
  body.scale.set(0.2, 0.15, 0.16);
  body.castShadow = true;
  g.add(body);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.399;
    ellipsoid(
      g,
      Math.sin(a) * 0.13,
      0.13 + (i % 3) * 0.03,
      Math.cos(a) * 0.105,
      0.15,
      0.15,
      0.14,
      "#dcd3b8",
    );
  }
  // Short mismatched ears suggest a bunny without turning the dust into a pet.
  for (const side of [-1, 1]) {
    const ear = ellipsoid(
      g,
      side * 0.083,
      side < 0 ? 0.315 : 0.32,
      -0.006,
      0.095,
      side < 0 ? 0.17 : 0.2,
      0.083,
      "#dcd3b8",
    );
    ear.rotation.z = side < 0 ? 0.65 : -0.25;
    const inner = ellipsoid(
      g,
      side * 0.093,
      side < 0 ? 0.332 : 0.34,
      0.027,
      0.039,
      side < 0 ? 0.073 : 0.1,
      0.026,
      "#b6a084",
    );
    inner.rotation.z = ear.rotation.z;
    ellipsoid(g, side * 0.056, 0.181, 0.174, 0.03, 0.041, 0.018, "#37333b");
  }
  ellipsoid(g, 0, 0.153, 0.176, 0.027, 0.016, 0.014, "#b6a084");
  mergeStatic(g);
  g.scale.set(0.55, 0.44, 0.55);
  return g;
}

export function clearModelCache() {
  materials.clear();
}

export function applySkin(robot: T.Group, id: SkinId) {
  const skin = skinInfo(id);
  const decal = robot.getObjectByName("skin-decal") as T.Mesh | undefined;
  if (decal && robot.userData.skinId !== id) {
    const m = decal.material as T.MeshStandardMaterial;
    m.map?.dispose();
    m.map = skinPattern(id);
    m.needsUpdate = true;
    m.metalness = id === "gold" ? 0.8 : 0.2;
    m.roughness = id === "gold" ? 0.25 : 0.45;
  }
  robot.userData.skinId = id;
  robot.traverse((o) => {
    if (
      !(o instanceof T.Mesh) ||
      Array.isArray(o.material) ||
      !o.userData.skinPart
    )
      return;
    const m = o.material as T.MeshStandardMaterial;
    m.color.set(o.userData.skinPart === "shell" ? skin.color : skin.accent);
    m.metalness = id === "gold" ? 0.8 : 0.25;
    m.roughness = id === "gold" ? 0.25 : 0.4;
  });
}
