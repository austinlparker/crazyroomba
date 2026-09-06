import { WALLS, type Wall } from "./level";
export interface WallFace {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  axis: "x" | "y" | "z";
  sign: number;
  floor: 0 | 1;
  trim: boolean;
}
/** Emit only the boundary of the wall union, so junctions have no duplicate skins or caps. */
export function wallSurfaces(walls: Wall[] = WALLS): WallFace[] {
  const faces: WallFace[] = [];
  const unique = (a: number[]) =>
    [...new Set(a.map((n) => Math.round(n * 100000) / 100000))].sort(
      (a, b) => a - b,
    );
  for (const floor of [0, 1] as const) {
    const ws = walls.filter((w) => w.floor === floor);
    if (!ws.length) continue;
    const xs = unique(ws.flatMap((w) => [w.x - w.w / 2, w.x + w.w / 2]));
    const zs = unique(ws.flatMap((w) => [w.z - w.d / 2, w.z + w.d / 2]));
    const ys = unique([0.1, 2.59, ...ws.flatMap((w) => [w.bottom, w.top])]);
    const nx = xs.length - 1,
      ny = ys.length - 1,
      nz = zs.length - 1;
    const solid = new Uint8Array(nx * ny * nz),
      idx = (x: number, y: number, z: number) => (x * ny + y) * nz + z;
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++)
        for (let k = 0; k < nz; k++) {
          const x = (xs[i] + xs[i + 1]) / 2,
            y = (ys[j] + ys[j + 1]) / 2,
            z = (zs[k] + zs[k + 1]) / 2;
          if (
            ws.some(
              (w) =>
                Math.abs(x - w.x) < w.w / 2 + 1e-7 &&
                Math.abs(z - w.z) < w.d / 2 + 1e-7 &&
                y > w.bottom &&
                y < w.top,
            )
          )
            solid[idx(i, j, k)] = 1;
        }
    const occupied = (i: number, j: number, k: number) =>
      i >= 0 &&
      j >= 0 &&
      k >= 0 &&
      i < nx &&
      j < ny &&
      k < nz &&
      !!solid[idx(i, j, k)];
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++)
        for (let k = 0; k < nz; k++)
          if (occupied(i, j, k)) {
            const x = (xs[i] + xs[i + 1]) / 2,
              y = (ys[j] + ys[j + 1]) / 2,
              z = (zs[k] + zs[k + 1]) / 2;
            for (const sign of [-1, 1]) {
              if (!occupied(i + sign, j, k))
                faces.push({
                  x: sign < 0 ? xs[i] : xs[i + 1],
                  y,
                  z,
                  w: zs[k + 1] - zs[k],
                  h: ys[j + 1] - ys[j],
                  axis: "x",
                  sign,
                  floor,
                  trim: y < 0.1 || y > 2.59,
                });
              if (!occupied(i, j, k + sign))
                faces.push({
                  x,
                  y,
                  z: sign < 0 ? zs[k] : zs[k + 1],
                  w: xs[i + 1] - xs[i],
                  h: ys[j + 1] - ys[j],
                  axis: "z",
                  sign,
                  floor,
                  trim: y < 0.1 || y > 2.59,
                });
              if (!occupied(i, j + sign, k))
                faces.push({
                  x,
                  y: sign < 0 ? ys[j] : ys[j + 1],
                  z,
                  w: xs[i + 1] - xs[i],
                  h: zs[k + 1] - zs[k],
                  axis: "y",
                  sign,
                  floor,
                  trim: true,
                });
            }
          }
  }
  return faces;
}
