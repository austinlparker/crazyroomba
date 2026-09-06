import * as T from "three";
import { createApartment } from "../world";
import { ROOMS, FLOOR_HEIGHT } from "../level";
import { styleFor, clearSurfaceCache } from "../surfaces";
import { sky } from "./sky";
import { horizon } from "./horizon";
import type { StageVisual } from "./visual-types";
export function build(): StageVisual {
  clearSurfaceCache();
  const group = createApartment();
  for (const r of ROOMS.filter(
    (r) => !["landing", "hall", "balcony", "porch", "garden"].includes(r.id),
  )) {
    const light = new T.PointLight(styleFor(r.id).light, 3.5, 8, 1.2);
    light.position.set(r.x, r.floor * FLOOR_HEIGHT + 2.15, r.z);
    group.add(light);
  }
  clearSurfaceCache();
  sky(group, "golden");
  const backdrop = horizon(group);
  return {
    group,
    backdrop,
    hideGround: true,
    background: "#222b46",
    ground: "#222a3b",
    sunElevation: 0.19,
    sun: "#fff0ce",
    ambient: "#fff0d6",
    extent: 16,
  };
}
