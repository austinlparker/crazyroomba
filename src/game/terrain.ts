/** Serializable height fields shared by the renderer and fixed-tick replay. */
export type Vertex2 = readonly [number, number];
export interface HeightField {
  x: number;
  z: number;
  step: number;
  columns: number;
  rows: number;
  heights: number[];
}
export function heightField(
  x: number,
  z: number,
  w: number,
  d: number,
  step: number,
  fn: (x: number, z: number) => number,
): HeightField {
  const columns = Math.round(w / step) + 1,
    rows = Math.round(d / step) + 1,
    heights: number[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < columns; i++)
      heights.push(fn(x + i * step, z + j * step));
  return { x, z, step, columns, rows, heights };
}
/** Same diagonal and barycentric interpolation as the rendered grid triangles. */
export function sampleHeight(
  field: HeightField | undefined,
  x: number,
  z: number,
): number {
  if (!field) return 0;
  const u = Math.max(
    0,
    Math.min(field.columns - 1, (x - field.x) / field.step),
  );
  const v = Math.max(0, Math.min(field.rows - 1, (z - field.z) / field.step));
  const i = Math.min(field.columns - 2, Math.floor(u)),
    j = Math.min(field.rows - 2, Math.floor(v)),
    fx = u - i,
    fz = v - j,
    at = j * field.columns + i;
  const a = field.heights[at],
    b = field.heights[at + 1],
    c = field.heights[at + field.columns],
    d = field.heights[at + field.columns + 1];
  return fx + fz <= 1
    ? a + (b - a) * fx + (c - a) * fz
    : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
}
export function insidePolygon(
  x: number,
  z: number,
  points: readonly Vertex2[],
): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, az] = points[j],
      [bx, bz] = points[i];
    const dx = bx - ax,
      dz = bz - az,
      t = Math.max(
        0,
        Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)),
      );
    if (Math.hypot(x - ax - t * dx, z - az - t * dz) < 1e-6) return true;
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax)
      inside = !inside;
  }
  return inside;
}
export function segmentDistance(x: number, z: number, a: Vertex2, b: Vertex2) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)),
    );
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}
export function flatPad(
  x: number,
  z: number,
  cx: number,
  cz: number,
  w: number,
  d: number,
  feather = 1.2,
) {
  const edge = Math.max(Math.abs(x - cx) - w / 2, Math.abs(z - cz) - d / 2);
  const t = Math.max(0, Math.min(1, edge / feather));
  return t * t * (3 - 2 * t);
}

/** Earthen kicker: shallow approach, crisp lip, steep back. Shared by mesh and physics. */
export function kicker(
  x: number,
  z: number,
  cx: number,
  cz: number,
  width: number,
  length: number,
  height: number,
) {
  const across = Math.max(
    0,
    Math.min(1, (width / 2 - Math.abs(x - cx)) / 0.65),
  );
  const t = (z - cz) / length;
  return (
    across *
    height *
    Math.max(0, t <= 1 ? Math.min(1, t) : 1 - ((t - 1) * length) / 0.5)
  );
}
