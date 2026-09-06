import type { StageId } from "../level-types";
import type { Level } from "../navigation";
export async function loadLevel(id: StageId): Promise<Level> {
  switch (id) {
    case "apartment":
      return (await import("./apartment-data")).level;
    case "house":
      return (await import("../level")).HOUSE_LEVEL;
    case "culdesac":
      return (await import("./culdesac-data")).level;
    case "moon":
      return (await import("./moon-data")).level;
  }
}
