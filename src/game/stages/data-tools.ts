import { sampleHeight } from "../terrain";
import { createLevel, type LevelData } from "../navigation";
import {
  FLOOR_HEIGHT,
  type Furniture,
  type Wall,
  type Collider,
} from "../level-types";
export function furniture(
  id: string,
  kind: string,
  x: number,
  z: number,
  w: number,
  d: number,
  bottom = 0,
  top = 0.8,
  floor: 0 | 1 = 0,
): Furniture {
  return { id, kind, x, z, w, d, bottom, top, floor };
}
export function wall(
  id: string,
  x: number,
  z: number,
  w: number,
  d: number,
  top = 2.45,
): Wall {
  return { ...furniture(id, "wall", x, z, w, d, 0, top), exterior: false };
}
export function makeLevel(data: Omit<LevelData, "COLLIDERS">) {
  const base = (o: Furniture) =>
    o.floor ? FLOOR_HEIGHT : sampleHeight(data.terrain, o.x, o.z);
  const colliders: Collider[] = [
    ...data.WALLS.map((o) => ({
      ...o,
      bottom: base(o) + o.bottom,
      top: base(o) + o.top,
    })),
  ];
  for (const o of data.FURNITURE) {
    const y = base(o);
    colliders.push({ ...o, bottom: y + o.bottom, top: y + o.top });
    if (o.bottom > 0) {
      const vehicle = ["car", "van", "rover"].includes(o.kind);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          colliders.push({
            ...o,
            id: `${o.id}-leg-${sx}-${sz}`,
            kind: "leg",
            x:
              o.x +
              sx *
                (vehicle
                  ? o.kind === "rover"
                    ? 0.88
                    : o.w / 2 + 0.035
                  : o.w / 2 - 0.1),
            z:
              o.z +
              sz *
                (vehicle
                  ? o.kind === "rover"
                    ? 0.9
                    : o.d / 2 - 0.65
                  : o.d / 2 - 0.1),
            w: vehicle ? 0.22 : 0.09,
            d: vehicle ? 0.64 : 0.09,
            bottom: y,
            top: y + (vehicle ? 0.64 : o.bottom),
          });
    }
  }
  for (const r of data.RAMPS)
    for (const side of [-1, 1])
      colliders.push({
        ...wall(
          `${r.id}-rail-${side}`,
          r.x + side * (r.w / 2 + 0.045),
          r.z,
          0.09,
          r.d,
          FLOOR_HEIGHT + 0.8,
        ),
        kind: "rail",
      });
  return createLevel({
    ...data,
    DOCK: {
      ...data.DOCK,
      y: sampleHeight(data.terrain, data.DOCK.x, data.DOCK.z),
    },
    START: {
      ...data.START,
      y: sampleHeight(data.terrain, data.START.x, data.START.z),
    },
    BOOST_PADS: data.BOOST_PADS.map((p) => ({
      ...p,
      y: p.y || sampleHeight(data.terrain, p.x, p.z),
    })),
    COLLIDERS: colliders,
  });
}
