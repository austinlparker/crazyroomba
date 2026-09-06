import { afterEach, expect, it, vi } from "vitest";
import {
  freshProgress,
  unlockedStage,
  SKINS,
  medals,
  skinProgress,
} from "./progression";
import { Storage } from "./storage";
import { Simulation } from "./simulation";
import { loadLevel } from "./stages/load-data";
afterEach(() => vi.unstubAllGlobals());
it("awards three stage medals at exact milestones and bounds skin progress", () => {
  expect(
    [0, 999, 1000, 1999, 2000, 3000, 99999].map((score) => medals(score, 1000)),
  ).toEqual([0, 0, 1, 1, 2, 3, 3]);
  const p = freshProgress();
  p.dust = 12;
  p.best.apartment = 500;
  expect(skinProgress("mint", p)).toBe(0.48);
  expect(skinProgress("hotrod", p)).toBe(0.5);
  p.best.apartment = 100000;
  expect(skinProgress("hotrod", p)).toBe(1);
});
it("unlocks stages and skins at exact score or delivery milestones", () => {
  const p = freshProgress();
  expect(unlockedStage("apartment", p)).toBe(true);
  expect(unlockedStage("house", p)).toBe(false);
  p.best.apartment = 999;
  expect(unlockedStage("house", p)).toBe(false);
  p.best.apartment = 1000;
  expect(unlockedStage("house", p)).toBe(true);
  expect(unlockedStage("moon", p)).toBe(false);
  p.best.culdesac = 2600;
  expect(unlockedStage("moon", p)).toBe(true);
  expect(SKINS.find((s) => s.id === "lunar")!.unlocked(p)).toBe(true);
  p.dust = 25;
  expect(SKINS.find((s) => s.id === "mint")!.unlocked(p)).toBe(true);
});
it("preserves unlocks after old runs roll out of the 100-run history", async () => {
  let saved = "{}";
  vi.stubGlobal("localStorage", {
    getItem: () => saved,
    setItem: (_k: string, v: string) => {
      saved = v;
    },
  });
  const store = new Storage(),
    s = new Simulation("arcade", 1, await loadLevel("apartment"));
  s.score = 1100;
  s.deposited = 25;
  store.record(s, "2026-09-05");
  s.score = 0;
  s.deposited = 0;
  for (let i = 0; i < 101; i++) store.record(s, "2026-09-05");
  const restored = new Storage();
  expect(restored.runs).toHaveLength(100);
  expect(restored.progress.best.apartment).toBe(1100);
  expect(restored.progress.dust).toBe(25);
});
it("keeps practice scores out of arcade stage unlocks", async () => {
  vi.stubGlobal("localStorage", { getItem: () => "{}", setItem: () => {} });
  const store = new Storage(),
    s = new Simulation("freeroam", 1, await loadLevel("apartment"));
  s.score = 100000;
  store.record(s, "2026-09-05");
  expect(unlockedStage("house", store.progress)).toBe(false);
});
it("migrates older runs to the house and keeps their earned progress", () => {
  vi.stubGlobal("localStorage", {
    getItem: () =>
      JSON.stringify({
        runs: [
          {
            id: "old",
            createdAt: "2026-09-05",
            mode: "arcade",
            score: 1900,
            deposited: 10,
            distance: 100,
            duration: 60,
          },
        ],
      }),
    setItem: () => {},
  });
  const store = new Storage();
  expect(store.runs[0].stage).toBe("house");
  expect(store.progress.best.house).toBe(1900);
  expect(unlockedStage("house", store.progress)).toBe(true);
  expect(unlockedStage("culdesac", store.progress)).toBe(true);
});
