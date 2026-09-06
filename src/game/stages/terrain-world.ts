import * as T from "three";
import type { Level } from "../navigation";
import { sampleHeight, type Vertex2 } from "../terrain";
import { beam, cylinder, box } from "../models";
const cross = (a: Vertex2, b: Vertex2, c: Vertex2) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
/** Small ear clipper keeps polygon construction out of the main engine bundle. */
function triangulate(outline: readonly Vertex2[]) {
  const poly = [...outline];
  if (
    poly.reduce(
      (n, p, i) =>
        n +
        p[0] * poly[(i + 1) % poly.length][1] -
        p[1] * poly[(i + 1) % poly.length][0],
      0,
    ) < 0
  )
    poly.reverse();
  const result: Vertex2[][] = [];
  while (poly.length > 3) {
    const ear = poly.findIndex((b, i) => {
      const a = poly[(i + poly.length - 1) % poly.length],
        c = poly[(i + 1) % poly.length];
      return (
        cross(a, b, c) > 1e-8 &&
        !poly.some(
          (p) =>
            p !== a &&
            p !== b &&
            p !== c &&
            cross(a, b, p) >= -1e-8 &&
            cross(b, c, p) >= -1e-8 &&
            cross(c, a, p) >= -1e-8,
        )
      );
    });
    if (ear < 0) throw new Error("Invalid terrain outline");
    result.push([
      poly[(ear + poly.length - 1) % poly.length],
      poly[ear],
      poly[(ear + 1) % poly.length],
    ]);
    poly.splice(ear, 1);
  }
  result.push(poly);
  return result;
}
function clip(points: Vertex2[], triangle: Vertex2[]) {
  let output = points;
  for (let e = 0; e < 3; e++) {
    const input = output;
    output = [];
    const a = triangle[e],
      b = triangle[(e + 1) % 3];
    for (let i = 0; i < input.length; i++) {
      const p = input[i],
        q = input[(i + 1) % input.length],
        cp = cross(a, b, p),
        cq = cross(a, b, q);
      if (cp >= -1e-8) output.push(p);
      if (cp >= 0 !== cq >= 0) {
        const t = cp / (cp - cq);
        output.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    if (!output.length) break;
  }
  return output;
}
export function terrainSurface(
  level: Level,
  outline = level.outline!,
  color = "#7e9a76",
  offset = 0,
  skirt = true,
) {
  const group = new T.Group(),
    field = level.terrain!,
    vertices: number[] = [],
    normals: number[] = [],
    colors: number[] = [],
    uv: number[] = [];
  const ears = triangulate(outline),
    base = new T.Color(color);
  const emit = (p: Vertex2) => {
    const [x, z] = p,
      y = sampleHeight(field, x, z),
      eps = 0.08;
    vertices.push(x, y + offset, z);
    uv.push(x / 2, z / 2);
    const n = new T.Vector3(
      sampleHeight(field, x - eps, z) - sampleHeight(field, x + eps, z),
      2 * eps,
      sampleHeight(field, x, z - eps) - sampleHeight(field, x, z + eps),
    ).normalize();
    normals.push(n.x, n.y, n.z);
    const shade =
      0.87 +
      Math.sin(x * 15.7 + z * 11.3) * 0.025 +
      Math.sin(x * 3.2 - z * 4.7) * 0.035 +
      Math.min(0.12, Math.max(-0.1, y * 0.1));
    colors.push(base.r * shade, base.g * shade, base.b * shade);
  };
  const minX = Math.max(
      0,
      Math.floor(
        (Math.min(...outline.map((p) => p[0])) - field.x) / field.step,
      ),
    ),
    maxX = Math.min(
      field.columns - 2,
      Math.floor(
        (Math.max(...outline.map((p) => p[0])) - field.x) / field.step,
      ),
    );
  const minZ = Math.max(
      0,
      Math.floor(
        (Math.min(...outline.map((p) => p[1])) - field.z) / field.step,
      ),
    ),
    maxZ = Math.min(
      field.rows - 2,
      Math.floor(
        (Math.max(...outline.map((p) => p[1])) - field.z) / field.step,
      ),
    );
  for (let j = minZ; j <= maxZ; j++)
    for (let i = minX; i <= maxX; i++) {
      const x = field.x + i * field.step,
        z = field.z + j * field.step,
        s = field.step;
      const triangles: Vertex2[][] = [
        [
          [x, z],
          [x + s, z],
          [x, z + s],
        ],
        [
          [x + s, z + s],
          [x, z + s],
          [x + s, z],
        ],
      ];
      for (const triangle of triangles)
        for (const ear of ears) {
          const poly = clip(triangle, ear);
          for (let k = 1; k < poly.length - 1; k++)
            if (Math.abs(cross(poly[0], poly[k], poly[k + 1])) > 1e-9) {
              emit(poly[0]);
              emit(poly[k + 1]);
              emit(poly[k]);
            }
        }
    }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  geo.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  const mesh = new T.Mesh(
    geo,
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }),
  );
  mesh.receiveShadow = true;
  mesh.name = "height-field";
  group.add(mesh);
  if (skirt) {
    const sides: number[] = [];
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i],
        b = outline[(i + 1) % outline.length],
        steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / field.step);
      for (let k = 0; k < steps; k++) {
        const x = a[0] + ((b[0] - a[0]) * k) / steps,
          z = a[1] + ((b[1] - a[1]) * k) / steps,
          nx = a[0] + ((b[0] - a[0]) * (k + 1)) / steps,
          nz = a[1] + ((b[1] - a[1]) * (k + 1)) / steps,
          y = sampleHeight(field, x, z) + offset,
          ny = sampleHeight(field, nx, nz) + offset;
        sides.push(
          x,
          y,
          z,
          nx,
          ny,
          nz,
          nx,
          -1.2,
          nz,
          x,
          y,
          z,
          nx,
          -1.2,
          nz,
          x,
          -1.2,
          z,
        );
      }
    }
    const sideGeo = new T.BufferGeometry();
    sideGeo.setAttribute("position", new T.Float32BufferAttribute(sides, 3));
    sideGeo.computeVertexNormals();
    group.add(
      new T.Mesh(
        sideGeo,
        new T.MeshStandardMaterial({
          color: level.id === "moon" ? "#596074" : "#756752",
          side: T.DoubleSide,
          roughness: 1,
        }),
      ),
    );
  }
  return group;
}
export function rectangle(
  x: number,
  z: number,
  w: number,
  d: number,
): Vertex2[] {
  return [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ];
}
export function boundary(parent: T.Group, level: Level, space = false) {
  const line = level.outline!;
  for (let i = 0; i < line.length; i++) {
    const a = line[i],
      b = line[(i + 1) % line.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.ceil(length / (space ? 1.6 : 0.42));
    for (let k = 0; k < n; k++) {
      const x = a[0] + ((b[0] - a[0]) * k) / n,
        z = a[1] + ((b[1] - a[1]) * k) / n,
        nx = a[0] + ((b[0] - a[0]) * (k + 1)) / n,
        nz = a[1] + ((b[1] - a[1]) * (k + 1)) / n,
        y = level.groundHeight(x, z),
        ny = level.groundHeight(nx, nz);
      if (space) {
        cylinder(parent, x, y + 0.23, z, 0.036, 0.46, "#879eab");
        box(parent, x, y + 0.46, z, 0.1, 0.04, 0.1, "#b2f3eb", 0.007);
      } else box(parent, x, y + 0.28, z, 0.1, 0.56, 0.1, "#d1c4a4", 0.012);
      for (const h of space ? [0.34] : [0.17, 0.43])
        beam(
          parent,
          [x, y + h, z],
          [nx, ny + h, nz],
          space ? 0.012 : 0.02,
          space ? "#a4d6d5" : "#8b927d",
        );
    }
  }
}

/** Bake small paint meshes onto the ground, leaving their original clearance intact. */
export function drape(group: T.Group, level: Level) {
  group.updateMatrixWorld(true);
  group.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const geo = o.geometry.clone().applyMatrix4(o.matrixWorld),
      p = geo.getAttribute("position");
    for (let i = 0; i < p.count; i++)
      p.setY(i, p.getY(i) + level.groundHeight(p.getX(i), p.getZ(i)) + 0.009);
    geo.computeVertexNormals();
    o.geometry.dispose();
    o.geometry = geo;
    o.position.set(0, 0, 0);
    o.rotation.set(0, 0, 0);
    o.scale.set(1, 1, 1);
  });
}
