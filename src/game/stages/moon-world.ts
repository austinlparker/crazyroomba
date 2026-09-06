import * as T from "three";
import { box, mergeStatic } from "../models";
import { floor, dock, pads } from "./common-world";
import { lunarHardware, lunarObject, earth, visitor } from "./moon-details";
import { level, jumps } from "./moon-data";
import { terrainSurface, rectangle, drape } from "./terrain-world";
import { sky } from "./sky";
import { horizon } from "./horizon";
import type { StageVisual } from "./visual-types";
export function build(): StageVisual {
  const group = new T.Group();
  group.name = "Moonbase";
  group.add(terrainSurface(level, level.outline, "#a3a9bd"));
  // No perimeter cables: the whole basin is traversable, out to the distant ridges.
  for (const j of jumps)
    group.add(
      terrainSurface(
        level,
        rectangle(j.x, j.z + j.d / 2, j.w, j.d + 1),
        "#758fa7",
        0.012,
        false,
      ),
    );
  floor(group, 8, -8.4, 6, 5.8, "#33465f", "#638299", "grid", 2.8);
  for (const w of level.WALLS) {
    box(
      group,
      w.x,
      w.floor * 2.8 + w.top / 2,
      w.z,
      w.w,
      w.top,
      w.d,
      w.floor ? "#6adfdf" : "#687ba6",
      0,
    );
  }
  for (const o of level.FURNITURE) lunarObject(group, o);
  const r = level.RAMPS[0];
  // Ramp top exactly matches the deterministic surface; sides are separate rails.
  const geo = new T.BufferGeometry();
  geo.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [
        r.x - r.w / 2,
        0,
        r.bottomZ,
        r.x + r.w / 2,
        0,
        r.bottomZ,
        r.x - r.w / 2,
        2.8,
        r.topZ,
        r.x + r.w / 2,
        0,
        r.bottomZ,
        r.x + r.w / 2,
        2.8,
        r.topZ,
        r.x - r.w / 2,
        2.8,
        r.topZ,
      ],
      3,
    ),
  );
  geo.computeVertexNormals();
  const rm = new T.Mesh(
    geo,
    new T.MeshStandardMaterial({
      color: "#456079",
      side: T.DoubleSide,
      roughness: 0.7,
    }),
  );
  rm.receiveShadow = true;
  group.add(rm);
  for (const side of [-1, 1]) {
    const rail = box(
      group,
      r.x + side * (r.w / 2 + 0.045),
      1.57,
      r.z,
      0.09,
      0.14,
      Math.hypot(r.d, 2.8),
      "#80f5de",
      0,
    );
    rail.rotation.x = Math.atan2(2.8, r.d);
  }
  const decals = new T.Group();
  lunarHardware(decals);
  drape(decals, level);
  group.add(decals);
  dock(group, level);
  pads(group, level);
  mergeStatic(group);
  sky(group, "space");
  const backdrop = horizon(group, true);
  const globe = earth(group),
    ufo = visitor(group);
  return {
    animate: (time) => {
      globe.rotation.y = time * 0.015;
      ufo.position.set(
        Math.sin(time * 0.09) * 16,
        8 + Math.sin(time * 0.7) * 0.5,
        Math.cos(time * 0.09) * 16,
      );
      ufo.rotation.y = time * 0.35;
    },
    group,
    backdrop,
    hideGround: true,
    background: "#090f28",
    ground: "#252e4b",
    sun: "#d4e4ff",
    ambient: "#8698cf",
    extent: 44,
  };
}
