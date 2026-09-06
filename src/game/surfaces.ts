import * as T from "three";

export interface RoomStyle {
  wall: string;
  accent: string;
  trim: string;
  pattern:
    "plain" | "leaves" | "stripes" | "tiles" | "stars" | "memphis" | "flowers";
  floor: [string, string];
  flooring: "wood" | "tile" | "carpet" | "terrace";
  fabric: string;
  rug: string;
  light: string;
  title: string;
}
const base: RoomStyle = {
  wall: "#efe1c6",
  accent: "#a98458",
  trim: "#efe5cf",
  pattern: "plain",
  floor: ["#bb844f", "#cc9d63"],
  flooring: "wood",
  fabric: "#d18d51",
  rug: "#826547",
  light: "#ffe2bc",
  title: "HOME SWEET HOME",
};
export const ROOM_STYLES: Record<string, RoomStyle> = {
  living: {
    ...base,
    wall: "#d79470",
    accent: "#a7553d",
    trim: "#efcc9d",
    pattern: "stripes",
    fabric: "#d95926",
    rug: "#7c3f51",
    title: "SIDE A\nGOOD TIMES",
  },
  sunroom: {
    ...base,
    wall: "#dce5a8",
    accent: "#739368",
    pattern: "leaves",
    floor: ["#e5cd9a", "#91ac85"],
    flooring: "tile",
    fabric: "#ad9150",
    rug: "#d2b479",
    light: "#eaffbf",
    title: "GROW\nSLOW",
  },
  dining: {
    ...base,
    wall: "#8d4658",
    accent: "#bd8490",
    trim: "#553934",
    pattern: "stripes",
    floor: ["#845d3d", "#a37449"],
    fabric: "#aa683d",
    rug: "#b7844b",
    light: "#ffd29b",
    title: "SUPPER\nCLUB",
  },
  kitchen: {
    ...base,
    wall: "#eff0c9",
    accent: "#32958e",
    trim: "#e7e2b9",
    pattern: "tiles",
    floor: ["#eceacb", "#438f88"],
    flooring: "tile",
    fabric: "#279c98",
    rug: "#eaa845",
    light: "#c4f4e2",
    title: "MIDNIGHT\nSNACKS",
  },
  study: {
    ...base,
    wall: "#6f93b2",
    accent: "#d7e3c8",
    trim: "#cbd6cb",
    pattern: "stars",
    floor: ["#466985", "#7093aa"],
    flooring: "carpet",
    fabric: "#435d9c",
    rug: "#cbaa5a",
    light: "#cbdcff",
    title: "SPACE\nCADET",
  },
  bathroom: {
    ...base,
    wall: "#e9efdc",
    accent: "#58a398",
    trim: "#e8c2ae",
    pattern: "tiles",
    floor: ["#aad3c1", "#f0ded0"],
    flooring: "tile",
    fabric: "#d59a97",
    rug: "#c98080",
    light: "#c8fff2",
    title: "FRESH\nSTART",
  },
  bedroom: {
    ...base,
    wall: "#edcb86",
    accent: "#c48046",
    pattern: "flowers",
    floor: ["#bd925d", "#d9b277"],
    fabric: "#d69939",
    rug: "#8e6860",
    light: "#ffe3ad",
    title: "BE OUR\nGUEST",
  },
  landing: {
    ...base,
    wall: "#eadac0",
    accent: "#c4aa84",
    pattern: "stripes",
    title: "THE\nUPSTAIRS",
  },
  hall: {
    ...base,
    wall: "#eadac0",
    accent: "#c4aa84",
    pattern: "stripes",
    title: "FAMILY\nALBUM",
  },
  party: {
    ...base,
    wall: "#594977",
    accent: "#bc83ad",
    trim: "#34324f",
    pattern: "memphis",
    floor: ["#413b62", "#76557b"],
    flooring: "carpet",
    fabric: "#a26aba",
    rug: "#d7a03a",
    light: "#ddc4ff",
    title: "INSERT\nCOIN '99",
  },
  "main-bedroom": {
    ...base,
    wall: "#81aaa0",
    accent: "#bdd0af",
    trim: "#e9d7b6",
    pattern: "leaves",
    floor: ["#ad865c", "#c6a979"],
    fabric: "#387f7b",
    rug: "#cfb487",
    light: "#d8efe1",
    title: "SUNDAY\nFOREVER",
  },
  porch: {
    ...base,
    wall: "#e7c5a2",
    floor: ["#bd8059", "#cc926a"],
    flooring: "terrace",
    fabric: "#ac7c47",
    title: "WELCOME\nHOME",
  },
  garden: {
    ...base,
    wall: "#84977e",
    floor: ["#afb198", "#858c77"],
    flooring: "terrace",
    fabric: "#de9d60",
  },
  balcony: {
    ...base,
    wall: "#e7c5a2",
    floor: ["#c5956c", "#d6ab82"],
    flooring: "terrace",
    fabric: "#8a9b56",
    title: "FRESH\nAIR",
  },
};
export const styleFor = (id?: string): RoomStyle =>
  ROOM_STYLES[id ?? ""] ?? base;
const cache = new Map<string, T.MeshStandardMaterial>();
export function surface(
  id: string,
  kind: "wall" | "floor" | "rug",
): T.MeshStandardMaterial {
  const key = `${id}:${kind}`;
  const saved = cache.get(key);
  if (saved) return saved;
  const s = styleFor(id),
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d")!;
  c.fillStyle = kind === "wall" ? s.wall : kind === "rug" ? s.rug : s.floor[0];
  c.fillRect(0, 0, 512, 512);
  if (kind === "wall") {
    c.fillStyle = c.strokeStyle = s.accent;
    if (s.pattern === "tiles") {
      for (let x = 0; x < 8; x++)
        for (let y = 0; y < 8; y++) {
          c.globalAlpha = (x + y) % 2 ? 0.22 : 0.12;
          c.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
        }
      c.globalAlpha = 1;
      c.fillRect(0, 472, 512, 12);
    } else if (s.pattern === "stripes") {
      c.globalAlpha = 0.3;
      for (let x = 0; x < 512; x += 64) c.fillRect(x, 0, 14, 512);
      c.globalAlpha = 0.18;
      for (let x = 28; x < 512; x += 64) c.fillRect(x, 0, 2, 512);
    } else if (s.pattern === "leaves" || s.pattern === "flowers") {
      c.globalAlpha = 0.45;
      for (let x = 32; x < 512; x += 96)
        for (let y = 40; y < 512; y += 112) {
          c.save();
          c.translate(x, y + (x % 3) * 8);
          if (s.pattern === "leaves") {
            c.rotate(-0.5);
            c.beginPath();
            c.ellipse(0, 0, 9, 25, 0, 0, Math.PI * 2);
            c.fill();
            c.rotate(1);
            c.beginPath();
            c.ellipse(16, 12, 7, 20, 0, 0, Math.PI * 2);
            c.fill();
          } else {
            for (let a = 0; a < 6; a++) {
              c.rotate(Math.PI / 3);
              c.beginPath();
              c.ellipse(0, 9, 5, 10, 0, 0, Math.PI * 2);
              c.fill();
            }
          }
          c.restore();
        }
    } else if (s.pattern === "stars" || s.pattern === "memphis") {
      for (let i = 0; i < 35; i++) {
        const x = (i * 137 + 31) % 512,
          y = (i * 83 + 29) % 512;
        c.save();
        c.translate(x, y);
        c.rotate(i * 1.3);
        c.globalAlpha = 0.6;
        c.lineWidth = 3;
        if (s.pattern === "stars") {
          c.fillRect(-5, -1, 10, 2);
          c.fillRect(-1, -5, 2, 10);
        } else {
          c.strokeStyle = [s.accent, "#cfa052", "#80b1b4"][i % 3];
          c.beginPath();
          c.moveTo(-11, 5);
          c.lineTo(-4, -5);
          c.lineTo(3, 5);
          c.lineTo(10, -5);
          c.stroke();
        }
        c.restore();
      }
    }
  } else if (kind === "rug") {
    c.strokeStyle = s.fabric;
    c.lineWidth = 14;
    c.strokeRect(22, 22, 468, 468);
    c.strokeStyle = s.trim;
    c.lineWidth = 3;
    c.strokeRect(42, 42, 428, 428);
    for (let i = 0; i < 5; i++) {
      c.save();
      c.translate(256, 90 + i * 82);
      c.rotate(Math.PI / 4);
      c.fillStyle = i % 2 ? s.trim : s.fabric;
      c.fillRect(-22, -22, 44, 44);
      c.restore();
    }
  } else if (s.flooring === "wood") {
    for (let y = 0; y < 8; y++) {
      c.fillStyle = s.floor[y % 2];
      c.fillRect(0, y * 64 + 2, 512, 62);
      c.fillStyle = "#654b39";
      c.globalAlpha = 0.32;
      c.fillRect((y * 173) % 500, y * 64, 2, 64);
      c.globalAlpha = 0.14;
      for (let j = 0; j < 6; j++) c.fillRect(0, y * 64 + 8 + j * 9, 512, 1);
      c.globalAlpha = 1;
    }
  } else if (s.flooring === "carpet") {
    for (let i = 0; i < 6500; i++) {
      c.fillStyle = s.floor[i % 2];
      c.globalAlpha = 0.2 + (i % 3) * 0.12;
      c.fillRect(
        (i * 137) % 512,
        (i * 73 + Math.floor(i / 512) * 17) % 512,
        2,
        3,
      );
    }
    if (id === "party")
      for (let i = 0; i < 25; i++) {
        c.fillStyle = ["#d5b366", "#92769e", "#709d9a"][i % 3];
        c.fillRect((i * 137) % 512, (i * 87) % 512, 9, 3);
      }
  } else {
    const n = id === "bathroom" ? 8 : 4,
      size = 512 / n;
    for (let x = 0; x < n; x++)
      for (let y = 0; y < n; y++) {
        c.fillStyle = s.floor[(x + y) % 2];
        c.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
      }
  }
  c.globalAlpha = 1;
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 8;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  const mat = new T.MeshStandardMaterial({
    map,
    roughness: kind === "floor" && s.flooring === "tile" ? 0.57 : 0.9,
  });
  if (kind === "rug") {
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -1;
    mat.polygonOffsetUnits = -1;
  }
  cache.set(key, mat);
  return mat;
}

export function clearSurfaceCache() {
  cache.clear();
}
