import * as T from "three";
import { box } from "../models";
/** Low-detail continuous horizons; hidden in the stage carousel to keep the playable shape legible. */
export function horizon(parent: T.Group, space = false) {
  const g = new T.Group();
  g.name = "distant-landscape";
  parent.add(g);
  const positions: number[] = [],
    colors: number[] = [],
    n = 96,
    base = new T.Color(space ? "#394860" : "#5a7c7d");
  const point = (i: number, r: number): [number, number, number] => {
    const a = (i / n) * Math.PI * 2,
      radius = [0, 52, 100, 180][r],
      h =
        r < 2
          ? -1.1
          : r === 3
            ? -2
            : 2 +
              Math.sin(a * 7) * 1.7 +
              Math.cos(a * 13) * 1.2 +
              (space ? 4 : 1.4) * (1 + Math.sin(a * 3));
    return [Math.cos(a) * radius, h, Math.sin(a) * radius];
  };
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < n; i++)
      for (const [j, k] of [
        [i, r],
        [i + 1, r + 1],
        [i + 1, r],
        [i, r],
        [i, r + 1],
        [i + 1, r + 1],
      ]) {
        positions.push(...point(j, k));
        const shade = 1 - k * 0.13;
        colors.push(base.r * shade, base.g * shade, base.b * shade);
      }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const m = new T.Mesh(
    geo,
    new T.MeshBasicMaterial({
      vertexColors: true,
      side: T.DoubleSide,
      fog: false,
    }),
  );
  m.userData.cameraIgnore = true;
  g.add(m);
  if (!space)
    for (let i = 0; i < 34; i++) {
      const a = i * 2.399,
        rad = 64 + (i % 3) * 9;
      box(
        g,
        Math.sin(a) * rad,
        1.2 + (i % 4) * 0.6,
        Math.cos(a) * rad,
        1.8,
        3 + (i % 4),
        2,
        "#829394",
        0,
      ).castShadow = false;
    }
  return g;
}
