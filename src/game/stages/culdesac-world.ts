import * as T from "three";
import { box, cylinder, sphere, material, mergeStatic } from "../models";
import { dock, pads, tree, roomFurniture } from "./common-world";
import { suburbanHouse, vehicleDetails, gardenProp } from "./suburban-details";
import { level, street, jumps } from "./culdesac-data";
import { terrainSurface, rectangle, drape } from "./terrain-world";
import { sky } from "./sky";
import { horizon } from "./horizon";
import type { StageVisual } from "./visual-types";
export function build(): StageVisual {
  const group = new T.Group();
  group.name = "Cul-de-sac";
  group.add(terrainSurface(level, level.outline, "#729466"));
  group.add(terrainSurface(level, street, "#737c86", 0.008, false));
  for (const x of [-6.4, 6.2])
    group.add(
      terrainSurface(
        level,
        rectangle(x, -1.7, 3, 13.3),
        "#cfbca5",
        0.016,
        false,
      ),
    );
  let houseIndex = 0;
  for (const o of level.FURNITURE) {
    if (o.kind === "house") {
      suburbanHouse(group, o.x, o.z, houseIndex++);
      continue;
    }
    if (o.kind === "porch") continue;
    if (o.kind === "car" || o.kind === "van") {
      vehicleDetails(group, o);
    } else if (o.kind === "table") roomFurniture(group, o);
    else if (o.kind === "tree")
      tree(group, o.x, o.z, o.id.startsWith("edge") ? 1.5 : 0.8);
    else if (o.kind === "hoop" || o.kind === "ball") continue;
    else {
      gardenProp(group, o);
      if (o.kind === "planter")
        tree(group, o.x, o.z, o.id === "island" ? 1 : 0.55);
    }
  }

  const backdrop = horizon(group);
  // Open paths continue around the houses into connected back gardens.
  for (const x of [-11, 11])
    group.add(
      terrainSurface(level, rectangle(x, 11, 2.4, 18), "#b8aa87", 0.018, false),
    );
  for (const j of jumps)
    group.add(
      terrainSurface(
        level,
        rectangle(j.x, j.z + j.d / 2, j.w, j.d + 1),
        "#c59969",
        0.012,
        false,
      ),
    );
  const roadPaint = new T.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    box(
      roadPaint,
      Math.sin(a) * 6.9,
      0.014,
      Math.cos(a) * 6.9 - 1,
      0.1,
      0.002,
      0.7,
      "#f5d997",
      0,
    ).rotation.y = a;
  }
  drape(roadPaint, level);
  group.add(roadPaint);
  // Basketball hoop and a few party leftovers; no billboard copy.
  cylinder(group, 8.8, 1.5, -8.7, 0.06, 3, "#596473");
  box(group, 8.8, 2.8, -8.65, 1.4, 0.9, 0.06, "#e7dfc0", 0);
  const hoop = new T.Mesh(
    new T.TorusGeometry(0.24, 0.024, 6, 20),
    material("#ee754c"),
  );
  hoop.rotation.x = Math.PI / 2;
  hoop.position.set(8.8, 2.5, -8.25);
  group.add(hoop);
  sphere(group, 6.9, 0.16, -7.8, 0.16, "#ef9856");
  dock(group, level);
  pads(group, level);
  backdrop.removeFromParent();
  mergeStatic(group);
  mergeStatic(backdrop);
  group.add(backdrop);
  sky(group, "day");
  return {
    group,
    backdrop,
    hideGround: true,
    background: "#a9cad5",
    ground: "#538879",
    sun: "#ffe0ae",
    ambient: "#d6e8ed",
    extent: 33,
  };
}
