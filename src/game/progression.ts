import type { StageId } from "./level-types";
import { STAGES } from "./stage-catalog";
export interface Progress {
  best: Record<StageId, number>;
  dust: number;
  shifts: number;
}
export const freshProgress = (): Progress => ({
  best: { apartment: 0, house: 0, culdesac: 0, moon: 0 },
  dust: 0,
  shifts: 0,
});
export function unlockedStage(id: StageId, p: Progress): boolean {
  const i = STAGES.findIndex((s) => s.id === id);
  // Older saves began in the house. Keep previously played arcade stages open.
  return (
    i === 0 ||
    p.best[id] > 0 ||
    p.best[STAGES[i - 1].id] >= STAGES[i - 1].target
  );
}
export const SKINS = [
  {
    id: "taxi",
    name: "Taxi",
    color: "#ffca26",
    accent: "#252a41",
    requirement: "",
    unlocked: (_p: Progress) => true,
  },
  {
    id: "mint",
    name: "Fresh Mint",
    color: "#79efd0",
    accent: "#225276",
    requirement: "Deliver 25 dust",
    unlocked: (p: Progress) => p.dust >= 25,
  },
  {
    id: "hotrod",
    name: "Hot Rod",
    color: "#ff493b",
    accent: "#ffda39",
    requirement: "Apartment · 1,000 points",
    unlocked: (p: Progress) => p.best.apartment >= 1000,
  },
  {
    id: "neon",
    name: "Night Rider",
    color: "#b857ff",
    accent: "#64ffea",
    requirement: "House · 1,800 points",
    unlocked: (p: Progress) => p.best.house >= 1800,
  },
  {
    id: "lunar",
    name: "Lunar Patrol",
    color: "#e8eef7",
    accent: "#ff883b",
    requirement: "Cul-de-sac · 2,600 points",
    unlocked: (p: Progress) => p.best.culdesac >= 2600,
  },
  {
    id: "gold",
    name: "Solid Gold",
    color: "#ffce60",
    accent: "#f5f0b0",
    requirement: "Moon · 3,600 points",
    unlocked: (p: Progress) => p.best.moon >= 3600,
  },
] as const;
export type SkinId = (typeof SKINS)[number]["id"];
export const skinInfo = (id: unknown) =>
  SKINS.find((s) => s.id === id) ?? SKINS[0];

export function medals(score: number, target: number): number {
  return Math.min(3, Math.floor(score / target));
}
export function skinProgress(id: SkinId, p: Progress): number {
  if (id === "taxi") return 1;
  if (id === "mint") return Math.min(1, p.dust / 25);
  const stage = STAGES[["hotrod", "neon", "lunar", "gold"].indexOf(id)];
  return Math.min(1, p.best[stage.id] / stage.target);
}
