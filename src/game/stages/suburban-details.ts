import * as T from "three";
import {
  box,
  cylinder,
  material,
  lathe,
  ring,
  beam,
  ellipsoid,
  finish,
} from "../models";
import type { Furniture, Wall } from "../level-types";

export function suburbanHouse(
  parent: T.Group,
  x: number,
  z: number,
  index: number,
) {
  const g = new T.Group();
  g.position.set(x, 0, z);
  g.rotation.y = x < -12 ? Math.PI / 2 : x > 12 ? -Math.PI / 2 : 0;
  parent.add(g);
  const color = ["#e3b489", "#7bb2af", "#b29ec2", "#c97f69"][index];
  box(g, 0, 1.7, 0, 7, 3.4, 5, color, 0);
  for (const side of [-1, 1]) {
    for (let y = 0.35; y < 3.3; y += 0.26)
      box(g, side * 3.507, y, 0, 0.018, 0.025, 5, "#e7d6bc", 0);
    box(g, side * 3.47, 1.7, 2.54, 0.12, 3.4, 0.08, "#f4e8d4", 0);
    box(g, side * 3.47, 1.7, -2.54, 0.12, 3.4, 0.08, "#f4e8d4", 0);
  }
  // Gabled roof with real eaves and contrasting fascia.
  for (const side of [-1, 1]) {
    const roof = box(g, side * 1.9, 4.12, 0, 4.05, 0.15, 5.65, "#605569", 0);
    roof.rotation.z = -side * 0.36;
    box(g, side * 3.6, 3.38, 0, 0.12, 0.18, 5.7, "#f4e8d4", 0);
  }
  for (const side of [-1, 1]) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute([-3.6, 0, 0, 3.6, 0, 0, 0, 1.36, 0], 3),
    );
    geometry.computeVertexNormals();
    const face = new T.Mesh(
      geometry,
      new T.MeshStandardMaterial({ color, side: T.DoubleSide }),
    );
    face.position.set(0, 3.4, side * 2.51);
    g.add(face);
  }
  for (let y = 0.35; y < 3.3; y += 0.26)
    for (const side of [-1, 1])
      box(g, 0, y, side * 2.512, 7, 0.025, 0.018, "#e7d6bc", 0);
  for (const dx of [-2.15, 2.15]) {
    box(g, dx, 1.93, 2.55, 1.5, 1.5, 0.08, "#f6edda", 0);
    box(g, dx, 1.93, 2.602, 1.28, 1.28, 0.025, "#5c8898", 0);
    for (const side of [-1, 1])
      box(g, dx + side * 0.86, 1.93, 2.6, 0.22, 1.56, 0.07, "#5b596e", 0);
    box(g, dx, 1.93, 2.625, 0.055, 1.32, 0.018, "#f6edda", 0);
    box(g, dx, 1.93, 2.628, 1.32, 0.055, 0.018, "#f6edda", 0);
    box(g, dx, 1.13, 2.64, 1.64, 0.09, 0.3, "#f6edda", 0);
  }
  box(g, 0, 1.1, 2.55, 1.24, 2.2, 0.08, "#f5e8cf", 0);
  box(g, 0, 1.05, 2.61, 1.06, 2.08, 0.04, "#65485e", 0);
  box(g, 0, 1.46, 2.636, 0.62, 0.62, 0.016, "#91b8c1", 0);
  cylinder(g, 0.37, 0.98, 2.66, 0.035, 0.05, "#efce6c").rotation.x =
    Math.PI / 2;
  box(g, 0, 0.12, 3.05, 2.6, 0.24, 1.5, "#b4a78f", 0);
  box(g, 0, 2.58, 3.05, 2.85, 0.17, 1.65, "#6d647a", 0);
  for (const side of [-1, 1])
    box(g, side * 1.18, 1.37, 3.57, 0.1, 2.5, 0.1, "#f3e5ca", 0);
  box(g, 2.5, 4.2, -1, 0.62, 1.9, 0.7, "#a47867", 0);
  box(g, 2.5, 5.16, -1, 0.76, 0.14, 0.84, "#e7d6bc", 0);
  for (let i = 0; i < 7; i++)
    box(g, 2.5, 3.5 + i * 0.22, -0.643, 0.61, 0.015, 0.012, "#dbc1a1", 0);
  box(g, 2.5, 5.239, -1, 0.52, 0.016, 0.58, "#514e57", 0);
  for (const x of [-2.15, 2.15])
    for (const side of [-1, 1])
      for (let j = 0; j < 7; j++)
        box(
          g,
          x + side * 0.86,
          1.31 + j * 0.2,
          2.64,
          0.18,
          0.022,
          0.015,
          "#83788c",
          0,
        );
  for (const side of [-1, 1])
    box(g, side * 2.5, 0.18, 3.1, 1.5, 0.36, 0.75, "#638968", 0.1);
}

export function fence(g: T.Group, w: Wall) {
  const alongX = w.w > w.d,
    length = alongX ? w.w : w.d;
  const wood =
    w.id.includes("fence") || w.id.includes("north") || w.id === "end";
  // Keep a thin continuous lower curb matching the solid gameplay boundary.
  box(g, w.x, 0.11, w.z, w.w, 0.22, w.d, "#858875", 0);
  if (!wood) {
    box(g, w.x, 0.49, w.z, w.w, 0.6, w.d, "#628568", 0.055);
    return;
  }
  for (let i = 0; i <= Math.floor(length / 0.28); i++) {
    const at = -length / 2 + i * 0.28;
    box(
      g,
      w.x + (alongX ? at : 0),
      0.48,
      w.z + (alongX ? 0 : at),
      alongX ? 0.13 : 0.16,
      0.76,
      alongX ? 0.16 : 0.13,
      "#e0c9a3",
      0.02,
    );
  }
  for (const y of [0.32, 0.64])
    box(g, w.x, y, w.z, w.w, 0.085, w.d, "#c5a77d", 0);
}

function quad(
  g: T.Object3D,
  points: [number, number, number][],
  color: string,
) {
  const geo = new T.BufferGeometry();
  geo.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [
        ...points[0],
        ...points[1],
        ...points[2],
        ...points[0],
        ...points[2],
        ...points[3],
      ],
      3,
    ),
  );
  geo.computeVertexNormals();
  const m = new T.Mesh(geo, material(color, 0.23, 0.22));
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
}
export function vehicleDetails(parent: T.Group, o: Furniture) {
  const g = new T.Group();
  g.position.set(o.x, 0, o.z);
  parent.add(g);
  const van = o.kind === "van",
    w = o.w,
    d = o.d,
    paint = van ? "#e5b45e" : "#5e9cac",
    glass = "#456c80",
    trim = "#344250";
  const belt = van ? 1.12 : 0.82,
    roof = van ? 2.13 : 1.56,
    front = van ? d * 0.28 : d * 0.11,
    rear = -d * 0.34;
  box(
    g,
    0,
    (o.bottom + belt) / 2,
    0,
    w,
    belt - o.bottom,
    d,
    paint,
    0.13,
  ).material = material(paint, 0.35, 0.25);
  // Sloped glass and tapered pillars form a real cabin silhouette.
  const lx = -w * 0.46,
    rx = w * 0.46,
    tx = w * 0.38,
    tz = front - 0.25;
  quad(
    g,
    [
      [lx, belt, front],
      [rx, belt, front],
      [tx, roof, tz],
      [-tx, roof, tz],
    ],
    glass,
  );
  quad(
    g,
    [
      [rx, belt, rear],
      [lx, belt, rear],
      [-tx, roof, rear + 0.16],
      [tx, roof, rear + 0.16],
    ],
    glass,
  );
  for (const side of [-1, 1]) {
    quad(
      g,
      [
        [side * w * 0.46, belt, rear],
        [side * w * 0.46, belt, front],
        [side * tx, roof, tz],
        [side * tx, roof, rear + 0.16],
      ],
      glass,
    ).material = new T.MeshStandardMaterial({
      color: glass,
      roughness: 0.2,
      metalness: 0.25,
      side: T.DoubleSide,
    });
    for (const z of [rear, front, van ? -0.1 : -0.35])
      beam(
        g,
        [side * w * 0.468, belt, z],
        [side * tx, roof, z === front ? tz : z === rear ? rear + 0.16 : z],
        0.041,
        paint,
      );
    box(
      g,
      side * (w / 2 + 0.008),
      belt - 0.09,
      -0.1,
      0.024,
      0.09,
      d * 0.88,
      "#eee1bd",
      0.007,
    );
    for (const z of [front - 0.2, rear + 0.3])
      box(
        g,
        side * (w / 2 + 0.025),
        belt - 0.2,
        z,
        0.04,
        0.04,
        0.21,
        trim,
        0.008,
      );
    box(
      g,
      side * (w * 0.48),
      belt + 0.18,
      front - 0.13,
      0.12,
      0.13,
      0.24,
      paint,
      0.025,
    );
    box(
      g,
      side * (w / 2 + 0.012),
      belt * 0.68,
      -0.1,
      0.014,
      0.22,
      0.018,
      trim,
      0.003,
    );
    for (const end of [-1, 1]) {
      const z = end * (d / 2 - 0.67),
        wheel = new T.Group();
      wheel.position.set(side * w * 0.475, 0.31, z);
      wheel.rotation.z = Math.PI / 2;
      g.add(wheel);
      lathe(
        wheel,
        [
          [0, -0.11],
          [0.235, -0.11],
          [0.3, -0.085],
          [0.318, -0.035],
          [0.318, 0.04],
          [0.3, 0.1],
          [0.23, 0.12],
          [0, 0.12],
        ],
        "#293443",
        24,
      );
      for (const sy of [-1, 1]) {
        const hub = cylinder(wheel, 0, sy * 0.124, 0, 0.188, 0.019, "#b7c5c5");
        hub.material = material("#b7c5c5", 0.3, 0.6);
        for (let i = 0; i < 5; i++)
          cylinder(
            wheel,
            Math.sin(i * 1.257) * 0.115,
            sy * 0.139,
            Math.cos(i * 1.257) * 0.115,
            0.036,
            0.012,
            trim,
          );
      }
      const arch = ring(g, 0.35, 0.034, paint, Math.PI);
      arch.rotation.y = Math.PI / 2;
      arch.position.set(side * (w / 2 + 0.008), 0.31, z);
    }
    for (const end of [-1, 1])
      box(
        g,
        side * w * 0.33,
        belt * 0.74,
        end * (d / 2 + 0.012),
        w * 0.21,
        0.15,
        0.043,
        end > 0 ? "#f6e6ba" : "#d46756",
        0.025,
      );
  }
  box(
    g,
    0,
    roof + 0.015,
    (rear + 0.16 + tz) / 2,
    w * 0.8,
    0.075,
    tz - rear - 0.1,
    paint,
    0.06,
  );
  box(
    g,
    0,
    belt - 0.012,
    (front + d / 2) / 2,
    w * 0.93,
    0.08,
    d / 2 - front,
    paint,
    0.045,
  );
  for (const end of [-1, 1]) {
    box(g, 0, 0.4, end * (d / 2 + 0.025), w * 0.93, 0.17, 0.1, trim, 0.035);
    box(g, 0, 0.6, end * (d / 2 + 0.051), 0.39, 0.145, 0.018, "#ded2ac", 0.01);
  }
  for (let i = 0; i < 4; i++)
    box(
      g,
      0,
      0.79 + i * 0.037,
      d / 2 + 0.019,
      w * 0.38,
      0.014,
      0.018,
      trim,
      0.003,
    );
  for (const side of [-1, 1])
    beam(
      g,
      [side * 0.14, belt + 0.025, front + 0.008],
      [side * 0.51, belt + 0.13, front - 0.025],
      0.011,
      trim,
    );
  if (van) {
    for (const side of [-1, 1]) {
      box(
        g,
        side * w * 0.29,
        roof + 0.11,
        -0.2,
        0.06,
        0.1,
        d * 0.56,
        trim,
        0.01,
      );
      beam(
        g,
        [side * w * 0.3, roof + 0.15, -d * 0.25],
        [-side * w * 0.3, roof + 0.15, -d * 0.25],
        0.022,
        "#afbec1",
      );
    }
    box(g, 0, roof + 0.21, -0.35, w * 0.5, 0.16, d * 0.35, "#d4825b", 0.055);
  }
}
export function gardenProp(parent: T.Group, o: Furniture) {
  const g = new T.Group();
  g.position.set(o.x, 0, o.z);
  parent.add(g);
  const { w, d, top: h } = o;
  if (o.kind === "bin") {
    const body = lathe(
      g,
      [
        [0, 0],
        [0.72, 0],
        [0.78, 0.06],
        [0.94, h * 0.87],
        [1, h * 0.91],
        [0, h * 0.91],
      ],
      "#438880",
      12,
    );
    body.scale.set(w / 2, 1, d / 2);
    box(g, 0, h * 0.95, 0, w + 0.025, h * 0.1, d + 0.025, "#2e6463", 0.035);
    box(g, 0, h * 0.93, -d * 0.38, w * 0.68, 0.065, 0.065, "#253e45", 0.015);
    for (const x of [-w * 0.31, w * 0.31])
      cylinder(g, x, 0.09, -d * 0.32, 0.09, 0.08, "#283746").rotation.z =
        Math.PI / 2;
    for (const side of [-1, 1])
      beam(
        g,
        [side * Math.sin(0.6) * w * 0.4, h * 0.15, Math.cos(0.6) * d * 0.4],
        [side * Math.sin(0.6) * w * 0.47, h * 0.82, Math.cos(0.6) * d * 0.47],
        0.012,
        "#6ba499",
      );
  } else if (o.kind === "grill") {
    box(g, 0, 0.33, 0, w * 0.77, 0.66, d * 0.8, "#475b62", 0.03);
    const lid = ellipsoid(g, 0, 0.82, 0, w, 0.52, d, "#526e6e");
    lid.material = material("#526e6e", 0.3, 0.55);
    box(g, 0, 0.75, 0, w + 0.02, 0.05, d + 0.02, "#acbaba", 0.012);
    beam(g, [-0.2, 0.91, d * 0.46], [0.2, 0.91, d * 0.46], 0.025, "#c2c5b7");
    cylinder(g, 0, 1.08, -d * 0.1, 0.08, 0.035, "#273e48");
    for (const side of [-1, 1])
      cylinder(
        g,
        side * w * 0.32,
        0.1,
        -d * 0.33,
        0.1,
        0.08,
        "#253343",
      ).rotation.z = Math.PI / 2;
  } else if (o.kind === "shed") {
    box(g, 0, h / 2, 0, w, h, d, "#b68a62", 0.01).material = finish(
      "#b68a62",
      "wood",
    );
    for (let x = -w / 2 + 0.2; x < w / 2; x += 0.23)
      box(g, x, h / 2, d / 2 + 0.012, 0.025, h, 0.025, "#795e53", 0);
    for (const side of [-1, 1]) {
      const roof = box(
        g,
        side * w * 0.27,
        h + 0.14,
        0,
        w * 0.57,
        0.09,
        d + 0.22,
        "#526875",
        0.012,
      );
      roof.rotation.z = -side * 0.25;
    }
    box(
      g,
      0,
      h * 0.44,
      d / 2 + 0.035,
      w * 0.7,
      h * 0.86,
      0.05,
      "#7f6656",
      0.012,
    );
    for (const side of [-1, 1])
      beam(
        g,
        [side * w * 0.32, 0.1, d / 2 + 0.075],
        [-side * w * 0.32, h * 0.79, d / 2 + 0.075],
        0.022,
        "#d6bd91",
      );
    box(g, 0.1, h * 0.46, d / 2 + 0.1, 0.08, 0.03, 0.024, "#243642", 0.005);
  } else if (o.kind === "planter") {
    box(g, 0, h / 2, 0, w, h, d, "#a88462", 0.014).material = finish(
      "#a88462",
      "wood",
    );
    box(g, 0, h + 0.009, 0, w - 0.11, 0.018, d - 0.11, "#504d3d", 0);
    for (const side of [-1, 1]) {
      box(g, side * (w / 2 - 0.025), h, 0, 0.07, 0.07, d, "#c6a379", 0.009);
      box(g, 0, h, side * (d / 2 - 0.025), w, 0.07, 0.07, "#c6a379", 0.009);
    }
    for (let i = 0; i < 7; i++) {
      const x = Math.sin(i * 2.4) * w * 0.33,
        z = Math.cos(i * 2.4) * d * 0.33;
      beam(g, [x, h, z], [x, h + 0.23, z], 0.012, "#658252");
      for (const side of [-1, 1])
        ellipsoid(
          g,
          x + side * 0.065,
          h + 0.14,
          z,
          0.15,
          0.07,
          0.09,
          "#83a466",
        ).rotation.z = side * 0.35;
    }
  }
}

export function road(g: T.Group) {
  // A star-shaped polygon triangulated from its center. No overlapping surfaces,
  // and no general path/triangulation library added to the core engine chunk.
  const r = 8.5,
    half = 3.5,
    join = Math.acos(half / r);
  const outline: [number, number][] = [
    [-half, -11],
    [half, -11],
  ];
  for (let i = 0; i <= 100; i++) {
    const angle = -join + ((Math.PI + 2 * join) * i) / 100;
    outline.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  const vertices: number[] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    vertices.push(0, 0, 0, b[0], 0, b[1], a[0], 0, a[1]);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  const mesh = new T.Mesh(geometry, material("#686f7b", 0.95));
  mesh.position.set(0, 0.012, -1);
  mesh.receiveShadow = true;
  g.add(mesh);
}
