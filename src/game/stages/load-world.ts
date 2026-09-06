import type { StageId } from "../level-types";
import type { StageVisual } from "./visual-types";
export async function loadWorld(id: StageId): Promise<() => StageVisual> {
  switch (id) {
    case "apartment":
      return (await import("./apartment-world")).build;
    case "house":
      return (await import("./house-world")).build;
    case "culdesac":
      return (await import("./culdesac-world")).build;
    case "moon":
      return (await import("./moon-world")).build;
  }
}
