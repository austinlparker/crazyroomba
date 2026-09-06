import { afterEach, describe, expect, it, vi } from "vitest";
import { Storage } from "./storage";

afterEach(() => vi.unstubAllGlobals());

const savedRun = {
  id: "saved-run",
  createdAt: "2026-09-05T12:00:00Z",
  ruleset: "2.9.0",
  mode: "arcade",
  stage: "apartment",
  day: "2026-09-05",
  score: 2100,
  deposited: 25,
  deliveries: 5,
  distance: 120,
  duration: 90,
  seed: 123,
};

describe("saved-data recovery", () => {
  it("isolates malformed rows while preserving valid history, progress and preferences", () => {
    const setItem = vi.fn();
    const removeItem = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({
          runs: [
            savedRun,
            null,
            [],
            "broken",
            7,
            {},
            { ...savedRun, id: "second" },
          ],
          progress: { dust: 500, shifts: 150, best: { apartment: 4000 } },
          settings: {
            skin: "mint",
            sound: false,
            stage: "moon",
            name: "Pilot",
          },
        }),
      setItem,
      removeItem,
    });
    const storage = new Storage();
    expect(storage.runs).toEqual([savedRun, { ...savedRun, id: "second" }]);
    expect(storage.progress).toMatchObject({
      dust: 500,
      shifts: 150,
      best: { apartment: 4000 },
    });
    expect(storage.settings).toMatchObject({
      skin: "mint",
      sound: false,
      stage: "moon",
      name: "Pilot",
    });
    expect(storage.available).toBe(true);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it.each(["score", "deposited", "distance", "duration"])(
    "rejects unsafe %s values without poisoning earned progress",
    (field) => {
      vi.stubGlobal("localStorage", {
        getItem: () =>
          JSON.stringify({
            runs: [
              ...[-1, null, "1000", Number.MAX_VALUE].map((value) => ({
                ...savedRun,
                [field]: value,
              })),
              savedRun,
            ],
          }),
      });
      const storage = new Storage();
      expect(storage.runs).toEqual([savedRun]);
      expect(storage.progress).toMatchObject({
        dust: 25,
        shifts: 1,
        best: { apartment: 2100 },
      });
    },
  );

  it("repairs only invalid progress fields from valid history", () => {
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({
          runs: [savedRun],
          progress: {
            dust: -1,
            shifts: 900,
            best: { apartment: null, house: 5000, moon: Number.MAX_VALUE },
          },
        }),
    });
    expect(new Storage().progress).toEqual({
      dust: 25,
      shifts: 900,
      best: { apartment: 2100, house: 5000, culdesac: 0, moon: 0 },
    });
  });

  it("keeps legacy house runs without modern optional metadata", () => {
    const { id, createdAt, mode, score, deposited, distance, duration } =
      savedRun;
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({
          runs: [{ id, createdAt, mode, score, deposited, distance, duration }],
        }),
    });
    const storage = new Storage();
    expect(storage.runs[0]).toMatchObject({
      id,
      stage: "house",
      ruleset: "2.0.0",
      day: "",
      deliveries: 0,
      seed: 0,
    });
    expect(storage.progress.best.house).toBe(score);
  });

  it("retains the first 100 valid runs in saved order", () => {
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({
          runs: Array.from({ length: 110 }, (_, i) => [
            null,
            { ...savedRun, id: `${i}` },
          ]).flat(),
        }),
    });
    const storage = new Storage();
    expect(storage.runs).toHaveLength(100);
    expect(storage.runs[0].id).toBe("0");
    expect(storage.runs[99].id).toBe("99");
  });

  it.each(["{broken json", "null", "[]", "42", "true"])(
    "does not confuse malformed data %s with blocked storage or overwrite it on read",
    (raw) => {
      const setItem = vi.fn();
      const removeItem = vi.fn();
      vi.stubGlobal("localStorage", {
        getItem: () => raw,
        setItem,
        removeItem,
      });
      const storage = new Storage();
      expect(storage.available).toBe(true);
      expect(storage.runs).toEqual([]);
      expect(storage.settings.skin).toBe("taxi");
      expect(setItem).not.toHaveBeenCalled();
      expect(removeItem).not.toHaveBeenCalled();
    },
  );

  it("reports real access failures and recovers after a successful save", () => {
    const setItem = vi.fn().mockImplementationOnce(() => {
      throw new Error("Quota exceeded");
    });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("Storage blocked");
      },
      setItem,
    });
    const storage = new Storage();
    expect(storage.available).toBe(false);
    storage.settings.music = false;
    storage.save();
    expect(storage.available).toBe(false);
    expect(storage.settings.music).toBe(false);
    storage.save();
    expect(storage.available).toBe(true);
    expect(JSON.parse(setItem.mock.calls[1][1]).settings.music).toBe(false);
  });
});

describe("music preferences", () => {
  it("migrates older settings without losing sound, camera or tutorial preferences", () => {
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({
          settings: {
            sound: false,
            camera: "first-person",
            tutorialDone: true,
          },
        }),
    });
    const storage = new Storage();
    expect(storage.settings).toMatchObject({
      sound: false,
      camera: "first-person",
      tutorialDone: true,
      music: true,
      musicVolume: 0.35,
    });
  });

  it("persists music mute and volume separately from sound effects", () => {
    let saved = "{}";
    vi.stubGlobal("localStorage", {
      getItem: () => saved,
      setItem: (_key: string, value: string) => {
        saved = value;
      },
    });
    const storage = new Storage();
    storage.settings.music = false;
    storage.settings.musicVolume = 0.17;
    storage.save();
    expect(new Storage().settings).toMatchObject({
      sound: true,
      music: false,
      musicVolume: 0.17,
    });
  });

  it.each([
    [9, 1],
    [-1, 0],
    ["loud", 0.35],
    [null, 0.35],
  ])("handles invalid saved volume %s", (value, expected) => {
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify({ settings: { musicVolume: value } }),
    });
    expect(new Storage().settings.musicVolume).toBe(expected);
  });
});
