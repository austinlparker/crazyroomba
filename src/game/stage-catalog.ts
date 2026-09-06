import type { StageId } from "./level-types";
export const STAGES = [
  { id: "apartment", name: "Apartment", target: 1000, color: "#ffc94d" },
  { id: "house", name: "House Party", target: 1800, color: "#ff7944" },
  { id: "culdesac", name: "Cul-de-sac", target: 2600, color: "#65e3c4" },
  { id: "moon", name: "Moonbase", target: 3600, color: "#bd99ff" },
] as const;
export const isStage = (id: unknown): id is StageId =>
  STAGES.some((s) => s.id === id);
export const stageInfo = (id: StageId) => STAGES.find((s) => s.id === id)!;
export function dailyStage(day: string): StageId {
  return STAGES[
    ((Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000) % 4) + 4) % 4
  ].id;
}
