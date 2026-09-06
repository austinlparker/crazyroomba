import * as T from "three";
import { box, cylinder, mergeStatic } from "../models";
import { floor, roomFurniture, dock, pads, texture } from "./common-world";
import { level } from "./apartment-data";
import { sky } from "./sky";
import { horizon } from "./horizon";
import type { StageVisual } from "./visual-types";
export function build(): StageVisual {
  const group = new T.Group();
  group.name = "Apartment";
  for (const r of level.ROOMS)
    floor(
      group,
      r.x,
      r.z,
      r.w,
      r.d,
      r.id === "kitchenette"
        ? "#e7ddc3"
        : r.id === "wash"
          ? "#b4d8c0"
          : "#c9955d",
      r.id === "kitchenette"
        ? "#5caaaa"
        : r.id === "wash"
          ? "#73a7a1"
          : "#986341",
      r.finish === "wood" || r.finish === "terrace" ? "wood" : "tile",
    );
  for (const w of level.WALLS) {
    box(
      group,
      w.x,
      (w.top + w.bottom) / 2,
      w.z,
      w.w,
      w.top - w.bottom,
      w.d,
      w.id.includes("partition") ? "#9673a7" : "#efd9ae",
      0,
    );
    if (w.bottom === 0)
      box(group, w.x, 0.055, w.z, w.w + 0.014, 0.11, w.d + 0.014, "#6f5b74", 0);
  }
  for (const o of level.FURNITURE) roomFurniture(group, o);
  // Distinct bedroom rug, wall art and windows sit clear of structural surfaces.
  box(group, 2.5, 0.007, -0.4, 1.9, 0.012, 0.7, "#d48191", 0);
  for (let i = 0; i < 3; i++) {
    box(
      group,
      -3.915,
      1.48,
      0.3 + i * 0.52,
      0.018,
      0.35,
      0.34,
      ["#ee9858", "#b881ac", "#65b5a6"][i],
      0,
    );
  }
  for (const x of [-2, 2.5]) {
    box(group, x, 1.5, -3.417, 1.3, 1.15, 0.012, "#80bfd2", 0);
    box(group, x, 1.5, -3.398, 0.045, 1.2, 0.045, "#fff1d5", 0);
    box(group, x, 1.5, -3.398, 1.35, 0.05, 0.045, "#fff1d5", 0);
  }
  // Details stay on existing furniture or above driving clearance.
  const rug = box(group, -2.25, 0.006, 1.35, 2.3, 0.009, 1.55, "#cf895a", 0);
  const rugMap = texture("#b45864", "#eac098", "grid");
  rugMap.repeat.set(2, 1.4);
  rug.material = new T.MeshStandardMaterial({ map: rugMap, roughness: 1 });
  for (const x of [-2, 2.5]) {
    box(group, x, 2.11, -3.36, 1.5, 0.055, 0.1, "#695f73", 0);
    for (const side of [-1, 1])
      box(
        group,
        x + side * 0.66,
        1.5,
        -3.34,
        0.15,
        1.15,
        0.06,
        "#e6b574",
        0.015,
      );
  }
  cylinder(group, -2.65, 1.13, -3.08, 0.075, 0.31, "#d77e65");
  cylinder(group, -2.65, 1.3, -3.08, 0.12, 0.035, "#f2d7a0");
  dock(group, level);
  pads(group, level);
  mergeStatic(group);
  const light = new T.PointLight("#ffd7aa", 5, 12, 1);
  light.position.set(-1.6, 2, 0);
  group.add(light);
  sky(group, "city");
  const backdrop = horizon(group);
  return {
    group,
    backdrop,
    hideGround: true,
    background: "#253346",
    ground: "#253346",
    sunElevation: 0.19,
    sun: "#fff0d2",
    ambient: "#cbdced",
    extent: 9,
  };
}
