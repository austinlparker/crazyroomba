import * as T from "three";
import { box, cylinder, beam, ellipsoid, finish } from "../models";
import {
  furnitureModel,
  chargingDock,
  television,
  mug,
} from "../furniture-models";
import type { Level } from "../navigation";
import { FLOOR_HEIGHT, type Furniture } from "../level-types";
export function texture(
  a: string,
  b: string,
  kind: "wood" | "tile" | "noise" | "grid" = "tile",
) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = a;
  x.fillRect(0, 0, 256, 256);
  if (kind === "tile") {
    x.fillStyle = b;
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        if ((i + j) % 2) x.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
  }
  if (kind === "grid") {
    x.strokeStyle = b;
    x.lineWidth = 1.5;
    for (let i = 0; i <= 256; i += 32) {
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i, 256);
      x.moveTo(0, i);
      x.lineTo(256, i);
      x.stroke();
    }
  }
  if (kind === "wood") {
    x.strokeStyle = b;
    x.lineWidth = 2;
    for (let y = 0; y < 256; y += 32) {
      x.beginPath();
      x.moveTo(0, y);
      x.lineTo(256, y);
      x.stroke();
      for (let k = 0; k < 4; k++) {
        x.beginPath();
        x.moveTo(k * 80 + (y % 64), y);
        x.lineTo(k * 80 + (y % 64), y + 32);
        x.stroke();
      }
    }
  }
  if (kind === "noise") {
    let seed = 1987;
    for (let i = 0; i < 6500; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const px = seed % 256;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      x.fillStyle = i % 3 ? b : a;
      x.globalAlpha = 0.28;
      x.fillRect(px, seed % 256, 1 + (i % 3), 1);
    }
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = 2;
  return t;
}
export function floor(
  g: T.Group,
  x: number,
  z: number,
  w: number,
  d: number,
  color: string,
  detail: string,
  kind: "wood" | "tile" | "noise" | "grid",
  y = 0,
) {
  const t = texture(color, detail, kind);
  t.repeat.set(w / 2, d / 2);
  const m = new T.MeshStandardMaterial({ map: t, roughness: 0.9 });
  const mesh = new T.Mesh(new T.BoxGeometry(w, 0.12, d), m);
  mesh.position.set(x, y - 0.06, z);
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
export function dock(g: T.Group, level: Level) {
  const d = new T.Group();
  d.position.set(level.DOCK.x, level.DOCK.y, level.DOCK.z);
  d.rotation.y = level.DOCK_FACING + Math.PI;
  g.add(d);
  chargingDock(d);
}
export function pads(g: T.Group, level: Level) {
  for (const p of level.BOOST_PADS) {
    box(g, p.x, p.y + 0.014, p.z, p.w, 0.028, p.d, "#464759", 0.018);
    box(
      g,
      p.x,
      p.y + 0.032,
      p.z,
      p.w - 0.055,
      0.009,
      p.d - 0.055,
      "#eeb13d",
      0.014,
    );
    for (const side of [-1, 1]) {
      box(
        g,
        p.x + side * (p.w / 2 - 0.045),
        p.y + 0.04,
        p.z,
        0.018,
        0.006,
        p.d * 0.76,
        "#fff0a7",
        0.003,
      );
      for (const end of [-1, 1])
        cylinder(
          g,
          p.x + side * (p.w / 2 - 0.07),
          p.y + 0.04,
          p.z + end * (p.d / 2 - 0.065),
          0.017,
          0.007,
          "#464759",
        );
    }
    for (let i = -1; i <= 1; i++) {
      const a = box(
        g,
        p.x - 0.12,
        p.y + 0.039,
        p.z + i * p.d * 0.2,
        0.08,
        0.008,
        0.24,
        "#38303e",
        0,
      );
      a.rotation.y = -0.65;
      const b = box(
        g,
        p.x + 0.12,
        p.y + 0.039,
        p.z + i * p.d * 0.2,
        0.08,
        0.008,
        0.24,
        "#38303e",
        0,
      );
      b.rotation.y = 0.65;
    }
  }
}
export function legs(g: T.Group, o: Furniture, color = "#403749") {
  const y = o.floor * FLOOR_HEIGHT;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      box(
        g,
        o.x + sx * (o.w / 2 - 0.1),
        y + o.bottom / 2,
        o.z + sz * (o.d / 2 - 0.1),
        0.09,
        o.bottom,
        0.09,
        color,
        0,
      );
}
export function roomFurniture(g: T.Group, o: Furniture) {
  const y = o.floor * FLOOR_HEIGHT;
  const local = new T.Group();
  local.position.set(o.x, y, o.z);
  g.add(local);
  if (o.kind === "bed") local.rotation.y = Math.PI;
  if (
    furnitureModel(
      local,
      o.kind,
      o.w,
      o.d,
      o.bottom,
      o.top,
      o.kind === "bed" ? "#629d99" : "#cf7d6f",
    )
  )
    return;
  local.removeFromParent();
  const color =
    (
      {
        sofa: "#ee8567",
        table: "#bf844b",
        bed: "#685d91",
        counter: "#31978c",
        fridge: "#f1e7cb",
        tub: "#e9f2e2",
        sink: "#e7ead4",
        tv: "#45465b",
      } as Record<string, string>
    )[o.kind] ?? "#a68e7b";
  box(
    g,
    o.x,
    y + (o.bottom + o.top) / 2,
    o.z,
    o.w,
    o.top - o.bottom,
    o.d,
    color,
    0.03,
  );
  if (o.bottom > 0) legs(g, o);
  if (o.kind === "table") {
    mug(g, o.x - 0.3, y + o.top, o.z, "#63a7af");
    cylinder(g, o.x + 0.32, y + o.top + 0.018, o.z, 0.16, 0.025, "#e8ca8d");
  }
  if (o.kind === "counter") {
    box(
      g,
      o.x,
      y + o.top + 0.025,
      o.z,
      o.w + 0.03,
      0.05,
      o.d + 0.02,
      "#e3d1a7",
      0,
    );
    const count = Math.max(1, Math.round(o.w / 0.6));
    for (let i = 0; i < count; i++) {
      const x = o.x - o.w / 2 + ((i + 0.5) * o.w) / count;
      box(
        g,
        x,
        y + o.top * 0.45,
        o.z + o.d / 2 + 0.012,
        o.w / count - 0.035,
        o.top * 0.77,
        0.025,
        "#5ea89c",
        0.01,
      );
      box(
        g,
        x,
        y + o.top * 0.78,
        o.z + o.d / 2 + 0.04,
        0.19,
        0.025,
        0.035,
        "#d9cfad",
        0.008,
      );
    }
    box(
      g,
      o.x,
      y + 0.045,
      o.z + o.d / 2 + 0.009,
      o.w - 0.1,
      0.08,
      0.02,
      "#485d57",
      0,
    );
    mug(g, o.x + 0.5, y + o.top + 0.05, o.z, "#d79b63");
  }

  if (o.kind === "tv") {
    const tv = new T.Group();
    tv.position.set(o.x, y + o.top, o.z);
    tv.rotation.y = Math.PI / 2;
    g.add(tv);
    television(tv, 0, 0, 0, 1.1);
  }
}
export function tree(parent: T.Group, x: number, z: number, scale = 1) {
  const g = new T.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  parent.add(g);
  cylinder(g, 0, 1.05, 0, 0.18, 2.1, "#866b51", 0.115).material = finish(
    "#866b51",
    "wood",
  );
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4,
      px = Math.sin(a) * 0.57,
      pz = Math.cos(a) * 0.57;
    beam(g, [0, 1.4, 0], [px, 2.25 + (i % 2) * 0.3, pz], 0.075, "#866b51");
    const crown = ellipsoid(
      g,
      px,
      2.56 + (i % 2) * 0.28,
      pz,
      1.24,
      1.45,
      1.26,
      i % 2 ? "#7caa65" : "#51866a",
    );
    crown.rotation.y = a;
    for (let k = 0; k < 2; k++)
      ellipsoid(
        g,
        px + Math.sin(a + k) * 0.35,
        2.86 + (i % 2) * 0.28,
        pz + Math.cos(a + k) * 0.35,
        0.6,
        0.67,
        0.64,
        "#8bb774",
      );
  }
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    beam(
      g,
      [Math.sin(a) * 0.29, 0.045, Math.cos(a) * 0.29],
      [0, 0.36, 0],
      0.06,
      "#866b51",
    );
  }
}
