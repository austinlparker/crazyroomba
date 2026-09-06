import {
  furnitureModel,
  chargingDock,
  television,
  mug,
  lamp,
} from "./furniture-models";
import {
  box,
  cylinder,
  sphere,
  material,
  mergeStatic,
  lathe,
  ring,
  finish,
} from "./models";
import * as T from "three";

import {
  BOOST_PADS,
  COLLIDERS,
  DOCK,
  DOCK_FACING,
  STAIR_STEPS,
  roomAt,
  FLOOR_HEIGHT,
  FLOOR_REGIONS,
  FURNITURE,
  OPENINGS,
  RAMPS,
  ROOMS,
  WALLS,
} from "./level";

import { styleFor, surface } from "./surfaces";
import { wallSurfaces } from "./wall-surfaces";

function plant(
  parent: T.Object3D,
  x: number,
  z: number,
  y = 0,
  scale = 1,
): void {
  const g = new T.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  parent.add(g);
  lathe(
    g,
    [
      [0, 0],
      [0.18, 0],
      [0.22, 0.025],
      [0.28, 0.39],
      [0.3, 0.4],
      [0.3, 0.445],
      [0.265, 0.45],
      [0.255, 0.4],
      [0.16, 0.05],
      [0, 0.05],
    ],
    "#ba7956",
  );
  const rim = ring(g, 0.278, 0.015, "#d09a6c");
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.442;
  cylinder(g, 0, 0.409, 0, 0.25, 0.014, "#493c2b");
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    const leaf = sphere(
      g,
      Math.sin(a) * 0.23,
      0.62 + (i % 3) * 0.15,
      Math.cos(a) * 0.23,
      0.25,
      i % 2 ? "#247957" : "#63a43d",
    );
    leaf.scale.set(0.42, 1.8, 0.65);
    leaf.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * 0.6);
  }
}
function canvasTexture(
  draw: (ctx: CanvasRenderingContext2D) => void,
  size = 512,
): T.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d")!);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
const graphics = new Map<string, T.MeshBasicMaterial>();
function graphic(
  parent: T.Object3D,
  text: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  color = "#ffdc20",
  background = "#232343",
  floor = false,
): T.Mesh {
  const key = `${text}:${color}:${background}`;
  let mat = graphics.get(key);
  if (!mat) {
    const map = canvasTexture((c) => {
      c.fillStyle = background;
      c.fillRect(0, 0, 512, 512);
      c.fillStyle = color;
      c.fillRect(14, 14, 484, 8);
      c.fillRect(14, 490, 484, 8);
      for (let i = 0; i < 16; i++) {
        c.fillStyle = i % 2 ? background : color;
        c.fillRect(i * 32, 38, 32, 25);
        c.fillRect(i * 32, 449, 32, 25);
      }
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = color;
      const lines = text.split("\n");
      c.font = `italic 900 ${lines.length > 2 ? 75 : 94}px Arial, sans-serif`;
      lines.forEach((line, i) =>
        c.fillText(line, 256, 256 + (i - (lines.length - 1) / 2) * 104, 470),
      );
    });
    mat = new T.MeshBasicMaterial({
      map,
      side: T.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    });
    graphics.set(key, mat);
  }
  const m = new T.Mesh(new T.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  if (floor) m.rotation.x = -Math.PI / 2;
  m.userData.cameraIgnore = true;
  parent.add(m);
  return m;
}
function floorRect(
  parent: T.Object3D,
  x: number,
  z: number,
  w: number,
  d: number,
  y: number,
  mat: T.Material,
): void {
  // Slabs end four centimetres below their finish: no coplanar floor faces.
  if (y > 0) box(parent, x, y - 0.13, z, w, 0.18, d, "#e8d9b8", 0);
  const geometry = new T.PlaneGeometry(w, d);
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i++)
    uv.setXY(
      i,
      (x - w / 2 + uv.getX(i) * w) / 2,
      (z + d / 2 - uv.getY(i) * d) / 2,
    );
  const floor = new T.Mesh(geometry, mat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(x, y, z);
  floor.receiveShadow = true;
  parent.add(floor);
}
function rug(
  parent: T.Object3D,
  x: number,
  z: number,
  w: number,
  d: number,
  y: number,
  room: string,
): void {
  const mesh = new T.Mesh(new T.PlaneGeometry(w, d), surface(room, "rug"));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y + 0.016, z);
  mesh.receiveShadow = true;
  mesh.userData.cameraIgnore = true;
  parent.add(mesh);
}
function crt(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  scale = 1,
): void {
  television(parent, x, y, z, scale);
}
function legs(
  parent: T.Object3D,
  x: number,
  z: number,
  w: number,
  d: number,
  bottom: number,
  baseY: number,
  color = "#533854",
): void {
  for (const dx of [-w / 2 + 0.1, w / 2 - 0.1])
    for (const dz of [-d / 2 + 0.1, d / 2 - 0.1])
      box(
        parent,
        x + dx,
        baseY + bottom / 2,
        z + dz,
        0.09,
        bottom,
        0.09,
        color,
        0.009,
      );
}
function furnish(scene: T.Object3D): void {
  for (const o of FURNITURE) {
    const { kind, bottom, top } = o;
    let w = o.w,
      d = o.d;
    const x = 0,
      z = 0,
      y = 0;
    const parent = new T.Group();
    parent.position.set(o.x, o.floor * FLOOR_HEIGHT, o.z);
    scene.add(parent);
    const room = ROOMS.find(
      (r) =>
        r.floor === o.floor &&
        Math.abs(o.x - r.x) < r.w / 2 &&
        Math.abs(o.z - r.z) < r.d / 2,
    );
    const orient = [
      "sofa",
      "chair",
      "desk",
      "dresser",
      "shelf",
      "counter",
      "vanity",
      "fridge",
      "washer",
      "arcade",
    ].includes(kind);
    if (orient && d > w * 1.35) {
      [w, d] = [d, w];
      parent.rotation.y = ((room && o.x > room.x ? -1 : 1) * Math.PI) / 2;
    } else if (orient && room && o.z > room.z) parent.rotation.y = Math.PI;
    // Beds face the room with the headboard toward the nearest rear/front wall.
    if (kind === "bed" && room && o.z < room.z) parent.rotation.y = Math.PI;
    if (kind === "dock") continue;
    const style = styleFor(room?.id);
    if (furnitureModel(parent, kind, w, d, bottom, top, style.fabric)) {
      if (kind === "dresser") crt(parent, 0, top, 0, 0.8);
      continue;
    }
    if (kind === "wall") {
      box(
        parent,
        x,
        y + (top + bottom) / 2,
        z,
        w,
        top - bottom,
        d,
        o.floor ? "#8c73ae" : "#ead59c",
        0,
      );
      box(parent, x, y + 0.065, z, w + 0.018, 0.13, d + 0.018, "#fff1c5", 0);
      box(
        parent,
        x,
        y + top - 0.075,
        z,
        w + 0.025,
        0.13,
        d + 0.025,
        "#533451",
        0,
      );
    } else if (kind === "plant") {
      plant(parent, x, z, y, Math.min(w, d) / 0.6);
    } else if (["coffee", "desk", "table", "nightstand"].includes(kind)) {
      legs(parent, x, z, w, d, bottom, y);
      box(
        parent,
        x,
        y + (bottom + top) / 2,
        z,
        w,
        top - bottom,
        d,
        kind === "table" ? "#f4c948" : "#bb743c",
        0.025,
      ).material = finish(kind === "table" ? "#bf965b" : "#aa774c", "wood");
      if (kind === "coffee") {
        box(
          parent,
          x - w * 0.22,
          y + top + 0.025,
          z,
          0.28,
          0.05,
          0.22,
          "#773ca0",
          0.003,
        );
        box(
          parent,
          x - w * 0.19,
          y + top + 0.064,
          z + 0.01,
          0.26,
          0.028,
          0.19,
          "#fddc19",
          0.003,
        );
        mug(parent, x + w * 0.27, y + top, z, "#e6e5db");
        box(
          parent,
          x,
          y + top + 0.019,
          z + d * 0.26,
          0.12,
          0.035,
          0.18,
          "#263144",
          0.006,
        );
      } else if (kind === "desk") {
        crt(parent, x, y + top, z - 0.08, 0.85);
        box(
          parent,
          x,
          y + top + 0.022,
          z + d * 0.33,
          0.45,
          0.04,
          0.15,
          "#d5ccb1",
          0.01,
        );
        cylinder(
          parent,
          x + w * 0.33,
          y + top + 0.05,
          z + d * 0.32,
          0.05,
          0.08,
          "#f54858",
        );
        box(
          parent,
          x - w * 0.33,
          y + top + 0.17,
          z,
          0.12,
          0.34,
          0.19,
          "#262444",
          0.01,
        );
      } else if (kind === "table") {
        for (const dx of [-w * 0.28, w * 0.28]) {
          cylinder(parent, x + dx, y + top + 0.016, z, 0.17, 0.025, "#eae4c8");
          cylinder(parent, x + dx, y + top + 0.04, z, 0.13, 0.028, "#faac22");
        }
        box(parent, x, y + top + 0.035, z, 0.28, 0.07, 0.28, "#fb5739", 0.005);
      } else {
        lamp(parent, x, y + top, z);
      }
    } else if (kind === "fireplace") {
      box(parent, x, y + top / 2, z, w, top, d, "#be8263", 0.015);
      box(
        parent,
        x,
        y + top * 0.91,
        z,
        w + 0.09,
        top * 0.09,
        d + 0.075,
        "#bd925e",
        0.015,
      );
      box(
        parent,
        x,
        y + top * 0.4,
        z + d / 2 + 0.005,
        w * 0.57,
        top * 0.64,
        0.012,
        "#352a28",
        0.035,
      );
      for (const side of [-1, 1])
        box(
          parent,
          x + side * w * 0.34,
          y + top * 0.43,
          z + d / 2 + 0.016,
          w * 0.09,
          top * 0.71,
          0.04,
          "#d1a382",
          0.01,
        );
      box(
        parent,
        x,
        y + 0.035,
        z + 0.05,
        w + 0.05,
        0.07,
        d + 0.12,
        "#9d7660",
        0.01,
      );
      for (let i = 0; i < 3; i++)
        box(
          parent,
          x + (i - 1) * w * 0.13,
          y + 0.12,
          z + d / 2 + 0.012,
          w * 0.1,
          0.085,
          0.05,
          "#755242",
          0.025,
        );
    } else if (kind === "stool") {
      cylinder(
        parent,
        x,
        y + top - 0.045,
        z,
        Math.min(w, d) / 2,
        0.09,
        "#f76232",
      );
      cylinder(
        parent,
        x,
        y + (top - 0.09) / 2,
        z,
        0.045,
        top - 0.09,
        "#54717b",
      );
      cylinder(parent, x, y + 0.04, z, Math.min(w, d) / 2, 0.08, "#435765");
    } else if (kind === "counter" || kind === "island") {
      box(
        parent,
        x,
        y + (top - 0.055) / 2,
        z,
        w,
        top - 0.055,
        d,
        "#128f98",
        0.02,
      );
      box(
        parent,
        x,
        y + top - 0.027,
        z,
        w + 0.035,
        0.055,
        d + 0.035,
        "#f0e4c3",
      );
      const count = Math.max(2, Math.round(w / 0.6));
      for (let i = 0; i < count; i++) {
        const cx = x - w / 2 + ((i + 0.5) * w) / count;
        box(
          parent,
          cx,
          y + top * 0.47,
          z + d / 2 + 0.007,
          w / count - 0.035,
          top * 0.77,
          0.014,
          "#39b4b0",
          0.003,
        );
        box(
          parent,
          cx,
          y + top * 0.76,
          z + d / 2 + 0.025,
          0.11,
          0.018,
          0.025,
          "#ffc343",
          0.003,
        );
      }
      if (kind === "counter") {
        box(
          parent,
          x - (w > 1.8 ? w * 0.23 : 0),
          y + top + 0.007,
          z,
          0.52,
          0.008,
          d * 0.65,
          "#8ba9a4",
          0.01,
        );
        cylinder(
          parent,
          x - (w > 1.8 ? w * 0.23 : 0),
          y + top + 0.14,
          z - d * 0.27,
          0.018,
          0.28,
          "#bac5b4",
        );
        if (w > 1.8)
          box(
            parent,
            x + w * 0.24,
            y + top + 0.008,
            z,
            0.62,
            0.016,
            d * 0.75,
            "#303148",
            0.007,
          );
        if (w > 1.8)
          for (const dx of [-0.16, 0.16])
            for (const dz of [-0.11, 0.11])
              cylinder(
                parent,
                x + w * 0.24 + dx,
                y + top + 0.02,
                z + dz,
                0.1,
                0.008,
                "#697986",
              );
      } else {
        cylinder(
          parent,
          x - w * 0.25,
          y + top + 0.07,
          z,
          0.18,
          0.14,
          "#ffb630",
          0.24,
        );
        for (let i = 0; i < 3; i++)
          sphere(
            parent,
            x - w * 0.25 + (i - 1) * 0.09,
            y + top + 0.14,
            z,
            0.075,
            ["#e85121", "#f5cf22", "#79b240"][i],
          );
        plant(parent, x + w * 0.3, z, y + top, 0.3);
      }
    } else if (kind === "arcade") {
      box(parent, x, y + top * 0.33, z, w, top * 0.66, d, "#56398c", 0.025);
      box(
        parent,
        x,
        y + top * 0.74,
        z - d * 0.19,
        w,
        top * 0.52,
        d * 0.62,
        "#e85a26",
        0.025,
      );
      box(
        parent,
        x,
        y + top * 0.72,
        z + d * 0.14,
        w * 0.83,
        top * 0.28,
        0.035,
        "#272440",
        0.012,
      );
      graphic(
        parent,
        "DUST\nBUSTERS",
        x,
        y + top * 0.72,
        z + d * 0.14 + 0.019,
        w * 0.73,
        top * 0.23,
        "#6ffccc",
        "#16214b",
      );
      graphic(
        parent,
        "TURBO '99",
        x,
        y + top * 0.95,
        z + d * 0.13,
        w * 0.86,
        top * 0.1,
        "#27223e",
        "#ffe332",
      );
      box(
        parent,
        x,
        y + top * 0.51,
        z + d * 0.27,
        w,
        0.11,
        d * 0.45,
        "#ffce25",
        0.018,
      );
      cylinder(
        parent,
        x - w * 0.23,
        y + top * 0.57,
        z + d * 0.26,
        0.018,
        0.1,
        "#463d62",
      );
      sphere(
        parent,
        x - w * 0.23,
        y + top * 0.61,
        z + d * 0.26,
        0.045,
        "#f73958",
      );
      for (let i = 0; i < 3; i++)
        cylinder(
          parent,
          x + w * (0.04 + i * 0.12),
          y + top * 0.548,
          z + d * 0.28,
          0.027,
          0.018,
          ["#10bdaf", "#f74969", "#6649ae"][i],
        );
      graphic(
        parent,
        "1UP",
        x,
        y + top * 0.23,
        z + d / 2 + 0.003,
        w * 0.45,
        top * 0.2,
        "#ffcd22",
        "#56398c",
      );
    } else {
      box(parent, x, y + top / 2, z, w, top, d, "#bd7c47");
      const shelves = kind === "shelf" ? 4 : 3;
      for (let i = 0; i < shelves; i++) {
        const shelfY = y + ((i + 0.5) * top) / shelves;
        box(
          parent,
          x,
          shelfY,
          z + d / 2 + 0.007,
          w - 0.045,
          top / shelves - 0.025,
          0.014,
          kind === "shelf" ? "#6d483c" : "#d3985d",
          0.003,
        );
        if (kind === "shelf")
          for (let j = 0; j < 5; j++)
            box(
              parent,
              x - w * 0.35 + j * w * 0.16,
              shelfY - 0.025,
              z + d / 2 + 0.034,
              w * 0.12,
              (top / shelves) * (0.5 + (j % 3) * 0.1),
              0.06,
              ["#10a9a0", "#f4c430", "#f16a2b", "#9864b0", "#e8dac4"][j],
              0.002,
            );
        else
          box(
            parent,
            x,
            shelfY + 0.025,
            z + d / 2 + 0.028,
            0.13,
            0.018,
            0.025,
            "#593e51",
          );
      }
      if (kind === "dresser") crt(parent, x, y + top, z, 0.8);
    }
  }
}
function stairs(parent: T.Object3D): void {
  for (const ramp of RAMPS) {
    const rise = ramp.toY - ramp.fromY,
      deltaZ = ramp.topZ - ramp.bottomZ,
      run = Math.abs(deltaZ),
      direction = Math.sign(deltaZ);
    const angle = -direction * Math.atan2(rise, run),
      length = Math.hypot(rise, run);
    for (let i = 0; i < STAIR_STEPS; i++) {
      const height = ((i + 1) * rise) / STAIR_STEPS,
        z = ramp.bottomZ + ((i + 0.5) * deltaZ) / STAIR_STEPS;
      box(
        parent,
        ramp.x,
        ramp.fromY + height / 2,
        z,
        ramp.w,
        height,
        run / STAIR_STEPS,
        "#a87348",
        0,
      );
      const riser = new T.Mesh(
        new T.PlaneGeometry(ramp.w, rise / STAIR_STEPS),
        material("#e6cca0"),
      );
      riser.position.set(
        ramp.x,
        ramp.fromY + height - rise / STAIR_STEPS / 2,
        ramp.bottomZ + (i * deltaZ) / STAIR_STEPS - direction * 0.004,
      );
      riser.rotation.y = direction > 0 ? Math.PI : 0;
      riser.receiveShadow = true;
      parent.add(riser);
      // Carpet lies flat on each tread; nothing bridges across the risers.
      const tread = new T.Mesh(
        new T.PlaneGeometry(ramp.w - 0.32, run / STAIR_STEPS - 0.018),
        surface("landing", "rug"),
      );
      tread.position.set(ramp.x, ramp.fromY + height + 0.006, z);
      tread.rotation.x = -Math.PI / 2;
      tread.receiveShadow = true;
      parent.add(tread);
    }
    for (const side of [-1, 1]) {
      const x = ramp.x + side * (ramp.w / 2 + 0.045);
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        box(
          parent,
          x,
          ramp.fromY + rise * t + 0.36,
          ramp.bottomZ + deltaZ * t,
          0.045,
          0.72,
          0.045,
          "#614837",
          0.006,
        );
      }
      box(
        parent,
        x,
        (ramp.fromY + ramp.toY) / 2 + 0.74,
        ramp.z,
        0.075,
        0.06,
        length,
        "#9e673b",
        0.02,
      ).rotation.x = angle;
    }
  }
  for (const pad of BOOST_PADS) {
    const label = graphic(
      parent,
      "TURBO",
      pad.x,
      pad.y + 0.022,
      pad.z,
      pad.w,
      pad.d,
      "#ffe3a3",
      "#a86734",
      true,
    );
    label.userData.cameraIgnore = true;
  }
}
function houseFloors(parent: T.Group): void {
  const inside = (
    r: { x: number; z: number; w: number; d: number },
    x: number,
    z: number,
  ) => Math.abs(x - r.x) < r.w / 2 + 1e-6 && Math.abs(z - r.z) < r.d / 2 + 1e-6;
  for (const floor of [0, 1] as const) {
    const regions = FLOOR_REGIONS.filter((r) => r.floor === floor),
      rooms = ROOMS.filter((r) => r.floor === floor);
    const rects = [...regions, ...rooms, ...RAMPS];
    const unique = (values: number[]) =>
      [...new Set(values.map((v) => Math.round(v * 10000) / 10000))].sort(
        (a, b) => a - b,
      );
    const xs = unique(rects.flatMap((r) => [r.x - r.w / 2, r.x + r.w / 2]));
    const zs = unique(rects.flatMap((r) => [r.z - r.d / 2, r.z + r.d / 2]));
    // Partition the union once: adjacent regions never create overlapping floor faces.
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < zs.length - 1; j++) {
        const x = (xs[i] + xs[i + 1]) / 2,
          z = (zs[j] + zs[j + 1]) / 2,
          w = xs[i + 1] - xs[i],
          d = zs[j + 1] - zs[j];
        const region = regions.find((r) => inside(r, x, z));
        if (!region || (floor === 1 && RAMPS.some((r) => inside(r, x, z))))
          continue;
        const room = rooms.find((r) => inside(r, x, z));
        if (floor === 0) box(parent, x, -0.34, z, w, 0.6, d, "#b89b77", 0);
        floorRect(
          parent,
          x,
          z,
          w,
          d,
          floor * FLOOR_HEIGHT,
          surface(
            room?.id ?? (region.finish === "terrace" ? "porch" : "landing"),
            "floor",
          ),
        );
      }
  }
}
function architecture(parent: T.Group): void {
  // One exposed surface at every junction; no wall box plus offset paint skin.
  for (const f of wallSurfaces()) {
    const room = roomAt({
      x: f.x + (f.axis === "x" ? f.sign * 0.06 : 0),
      z: f.z + (f.axis === "z" ? f.sign * 0.06 : 0),
      y: f.floor * FLOOR_HEIGHT,
    });
    const style = styleFor(room?.id);

    const mat = f.trim
      ? material(style.trim)
      : room
        ? surface(room.id, "wall")
        : material("#dfcba7");
    const geometry = new T.PlaneGeometry(f.w, f.h),
      uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++)
      uv.setXY(
        i,
        ((f.axis === "x" ? f.z : f.x) - f.w / 2 + uv.getX(i) * f.w) / 1.5,
        (f.y - f.h / 2 + uv.getY(i) * f.h) / 1.5,
      );
    const mesh = new T.Mesh(geometry, mat);
    mesh.position.set(f.x, f.y + f.floor * FLOOR_HEIGHT, f.z);
    if (f.axis === "x") mesh.rotation.y = (f.sign * Math.PI) / 2;
    else if (f.axis === "z") mesh.rotation.y = f.sign > 0 ? 0 : Math.PI;
    else mesh.rotation.x = f.sign > 0 ? -Math.PI / 2 : Math.PI / 2;
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
  }
  const closedLanding = COLLIDERS.find((o) => o.id === "stair-closet");
  if (closedLanding)
    box(
      parent,
      closedLanding.x,
      (closedLanding.top + closedLanding.bottom) / 2,
      closedLanding.z,
      closedLanding.w,
      closedLanding.top - closedLanding.bottom,
      closedLanding.d,
      "#e1cfad",
      0,
    );
  const glass = new T.MeshStandardMaterial({
    color: "#b1d4d8",
    transparent: true,
    opacity: 0.23,
    roughness: 0.18,
    side: T.DoubleSide,
    depthWrite: false,
  });
  for (const opening of OPENINGS) {
    const { axis, at, center, width, bottom, top, floor, type } = opening,
      height = top - bottom,
      y = floor * FLOOR_HEIGHT;
    const g = new T.Group();
    g.position.set(axis === "x" ? center : at, y, axis === "x" ? at : center);
    if (axis === "z") g.rotation.y = Math.PI / 2;
    parent.add(g);
    const trim = type === "door" ? "#ad8051" : "#f4e7c9";
    for (const side of [-1, 1])
      box(
        g,
        side * (width / 2 + 0.025),
        (top + bottom) / 2,
        0,
        0.065,
        height + 0.09,
        0.235,
        trim,
        0.005,
      );
    box(g, 0, top + 0.025, 0, width + 0.12, 0.07, 0.235, trim, 0.005);
    if (type === "door") {
      const sill = new T.Mesh(
        new T.PlaneGeometry(width, 0.24),
        material("#b99a67"),
      );
      sill.position.y = 0.014;
      sill.rotation.x = -Math.PI / 2;
      sill.receiveShadow = true;
      sill.userData.cameraIgnore = true;
      g.add(sill);
    } else {
      box(g, 0, bottom - 0.025, 0, width + 0.13, 0.065, 0.29, trim, 0.006);
      const pane = new T.Mesh(
        new T.PlaneGeometry(width - 0.06, height - 0.06),
        glass,
      );
      pane.position.set(0, (bottom + top) / 2, 0);
      g.add(pane);
      const count = width > 1.4 ? 3 : 2;
      for (let i = 1; i < count; i++)
        box(
          g,
          -width / 2 + (i * width) / count,
          (bottom + top) / 2,
          0,
          0.035,
          height,
          0.055,
          trim,
          0,
        );
      box(g, 0, bottom + height * 0.58, 0, width, 0.035, 0.055, trim, 0);
    }
  }
  // Porch columns sit inside the already-solid parapet footprint.
  const porch = ROOMS.find((r) => r.id === "porch");
  if (porch) {
    for (const x of [porch.x - porch.w / 2, porch.x + porch.w / 2]) {
      box(
        parent,
        x,
        1.4,
        porch.z + porch.d / 2,
        0.19,
        2.8,
        0.19,
        "#e8d7b6",
        0.012,
      );
      box(
        parent,
        x,
        0.2,
        porch.z + porch.d / 2,
        0.24,
        0.4,
        0.24,
        "#c4936e",
        0.01,
      );
    }
    box(
      parent,
      porch.x,
      2.63,
      porch.z + porch.d / 2,
      porch.w + 0.2,
      0.2,
      0.23,
      "#d6bc96",
      0.015,
    );
  }
}
function roomDetails(parent: T.Group): void {
  for (const o of FURNITURE) {
    if (o.kind === "bed")
      rug(
        parent,
        o.x,
        o.z,
        o.w + 0.4,
        o.d + 0.4,
        o.floor * FLOOR_HEIGHT,
        roomAt({ x: o.x, z: o.z, y: o.floor * FLOOR_HEIGHT })?.id ?? "bedroom",
      );
    if (o.kind === "sofa")
      rug(
        parent,
        o.x,
        o.z - 0.9,
        o.w + 0.15,
        1.8,
        o.floor * FLOOR_HEIGHT,
        "living",
      );
  }
  for (const room of ROOMS) {
    if (
      ![
        "living",
        "sunroom",
        "dining",
        "kitchen",
        "bathroom",
        "study",
        "bedroom",
        "party",
        "main-bedroom",
        "hall",
      ].includes(room.id)
    )
      continue;
    const wall = WALLS.find(
      (w) =>
        w.floor === room.floor &&
        w.bottom === 0 &&
        w.top > 2.2 &&
        Math.max(w.w, w.d) > 0.85 &&
        ((w.w > w.d &&
          Math.abs(w.x - room.x) < room.w / 2 &&
          Math.abs(Math.abs(w.z - room.z) - room.d / 2) < 0.15) ||
          (w.d > w.w &&
            Math.abs(w.z - room.z) < room.d / 2 &&
            Math.abs(Math.abs(w.x - room.x) - room.w / 2) < 0.15)),
    );
    if (!wall) continue;
    const alongX = wall.w > wall.d,
      sign = Math.sign(alongX ? room.z - wall.z : room.x - wall.x) || 1;
    const x = alongX ? wall.x : wall.x + sign * (wall.w / 2 + 0.014),
      z = alongX ? wall.z + sign * (wall.d / 2 + 0.014) : wall.z;
    const poster = graphic(
      parent,
      styleFor(room.id).title,
      x,
      room.floor * FLOOR_HEIGHT + 1.65,
      z,
      Math.min(0.66, (alongX ? wall.w : wall.d) - 0.15),
      0.78,
      styleFor(room.id).trim,
      styleFor(room.id).accent,
    );
    poster.rotation.y = alongX
      ? sign > 0
        ? 0
        : Math.PI
      : (sign * Math.PI) / 2;
  }
}
export function createApartment(): T.Group {
  const g = new T.Group();
  g.name = "Alhambra House";
  houseFloors(g);
  architecture(g);
  furnish(g);
  stairs(g);
  roomDetails(g);
  const dock = new T.Group();
  dock.position.set(DOCK.x, 0, DOCK.z);
  dock.rotation.y = DOCK_FACING + Math.PI;
  g.add(dock);
  chargingDock(dock);
  mergeStatic(g);
  graphics.clear();
  return g;
}
