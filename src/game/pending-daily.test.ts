import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { restorePendingDaily, savePendingDaily } from "./pending-daily";
import type { Ticket } from "./api";
import { dailyStage } from "./stage-catalog";
import {
  Keys,
  RULESET,
  replayDaily,
  seedForDay,
  type Replay,
} from "./simulation";
import * as levels from "./stages/load-data";
import * as rules from "./simulation";

const KEY = "crazy-roomba-pending-daily-v1";
const did = "did:plc:aaaaaaaaaaaaaaaaaaaaaaaa";
const otherDid = "did:plc:bbbbbbbbbbbbbbbbbbbbbbbb";
const runId = "cafedead-0000-4000-8000-000000000001";
const day = "2026-09-05";
const replay: Replay = [
  [Keys.forward | Keys.boost, 100],
  [Keys.forward | Keys.left, 350],
  [0, 4950],
];
const ticket = (): Ticket => ({
  id: "cafedead-0000-4000-8000-000000000002",
  day,
  seed: seedForDay(day),
  ruleset: RULESET,
  stage: dailyStage(day),
  did,
});
let values: Map<string, string>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${day}T23:58:00Z`));
  values = new Map();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const changeSaved = (change: (value: any) => void) => {
  const data = JSON.parse(values.get(KEY)!);
  change(data);
  values.set(KEY, JSON.stringify(data));
};

describe("pending ranked daily recovery", () => {
  it("reconstructs the actual completed simulation across UTC midnight and consumes it once", async () => {
    const t = ticket();
    savePendingDaily(t, replay, runId);
    vi.setSystemTime(new Date("2026-09-06T00:02:00Z"));
    const restored = await restorePendingDaily(did);
    const expected = replayDaily(
      t.seed,
      replay,
      await levels.loadLevel(t.stage),
    );
    expect(restored).toMatchObject({ ticket: t, replay, runId });
    for (const key of [
      "x",
      "y",
      "z",
      "angle",
      "score",
      "deposited",
      "deliveries",
      "distanceDriven",
      "dust",
      "bin",
    ] as const)
      expect(restored!.sim[key]).toEqual(expected[key]);
    expect(restored!.sim.ended).toBe(true);
    expect(restored!.sim.ticks).toBe(5400);
    expect(values.has(KEY)).toBe(false);
    expect(await restorePendingDaily(did)).toBeNull();
  });

  it("keeps a different account's run so the player can reconnect correctly", async () => {
    savePendingDaily(ticket(), replay, null);
    const saved = values.get(KEY);
    await expect(restorePendingDaily(otherDid)).rejects.toThrow(
      "account that started it",
    );
    expect(values.get(KEY)).toBe(saved);
    expect((await restorePendingDaily(did))?.ticket.did).toBe(did);
  });

  it("allows verified hostname did:web accounts", async () => {
    const t = { ...ticket(), did: "did:web:player.example.com" };
    savePendingDaily(t, replay, null);
    expect((await restorePendingDaily(t.did))?.ticket.did).toBe(t.did);
  });

  it.each([
    ["missing account", (p: any) => delete p.ticket.did],
    ["guest account", (p: any) => (p.ticket.did = "guest")],
    ["malformed DID", (p: any) => (p.ticket.did = "did:plc:abc")],
    ["malformed ticket ID", (p: any) => (p.ticket.id = "test-ticket")],
    ["malformed run ID", (p: any) => (p.runId = "old-run")],
    ["old ruleset", (p: any) => (p.ticket.ruleset = "2.0.0")],
    ["invalid date", (p: any) => (p.ticket.day = "2026-02-30")],
    ["wrong daily seed", (p: any) => (p.ticket.seed += 1)],
    ["fractional seed", (p: any) => (p.ticket.seed += 0.5)],
    [
      "wrong daily stage",
      (p: any) =>
        (p.ticket.stage = p.ticket.stage === "moon" ? "house" : "moon"),
    ],
    ["unknown stage", (p: any) => (p.ticket.stage = "mars")],
    ["incomplete replay", (p: any) => (p.replay = [[0, 5399]])],
    ["invalid input", (p: any) => (p.replay = [[128, 5400]])],
    [
      "overlong replay",
      (p: any) =>
        (p.replay = [
          [0, 5400],
          [0, 1],
        ]),
    ],
    ["future saved time", (p: any) => (p.savedAt += 1)],
    ["old format", (p: any) => (p.version = 0)],
  ])("discards %s before loading any level", async (_label, change) => {
    savePendingDaily(ticket(), replay, runId);
    changeSaved(change);
    const load = vi.spyOn(levels, "loadLevel");
    expect(await restorePendingDaily(did)).toBeNull();
    expect(values.has(KEY)).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it("expires after 15 minutes even when the returning account differs", async () => {
    savePendingDaily(ticket(), replay, null);
    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(await restorePendingDaily(otherDid)).toBeNull();
    expect(values.has(KEY)).toBe(false);
  });

  it.each(["{broken json", "x".repeat(70_001)])(
    "discards corrupt or oversized session data",
    async (data) => {
      values.set(KEY, data);
      expect(await restorePendingDaily(did)).toBeNull();
      expect(values.has(KEY)).toBe(false);
    },
  );

  it("retains the run when the stage download fails", async () => {
    savePendingDaily(ticket(), replay, null);
    vi.spyOn(levels, "loadLevel").mockRejectedValueOnce(new Error("Offline"));
    await expect(restorePendingDaily(did)).rejects.toThrow("Offline");
    expect(values.has(KEY)).toBe(true);
    expect((await restorePendingDaily(did))?.sim.ended).toBe(true);
  });

  it("retains a valid run after an unexpected replay failure", async () => {
    savePendingDaily(ticket(), replay, null);
    vi.spyOn(rules, "replayDaily").mockImplementationOnce(() => {
      throw new Error("Simulation unavailable");
    });
    await expect(restorePendingDaily(did)).rejects.toThrow(
      "Simulation unavailable",
    );
    expect(values.has(KEY)).toBe(true);
    expect((await restorePendingDaily(did))?.sim.ended).toBe(true);
  });

  it("does not restore a run that expires during its stage download", async () => {
    savePendingDaily(ticket(), replay, null);
    const level = await levels.loadLevel(ticket().stage);
    vi.spyOn(levels, "loadLevel").mockImplementationOnce(async () => {
      vi.advanceTimersByTime(15 * 60 * 1000);
      return level;
    });
    expect(await restorePendingDaily(did)).toBeNull();
    expect(values.has(KEY)).toBe(false);
  });

  it("does not consume or display a newer pending run written during a download", async () => {
    savePendingDaily(ticket(), replay, null);
    const level = await levels.loadLevel(ticket().stage);
    vi.spyOn(levels, "loadLevel").mockImplementationOnce(async () => {
      savePendingDaily({ ...ticket(), id: runId }, replay, null);
      return level;
    });
    expect(await restorePendingDaily(did)).toBeNull();
    expect(JSON.parse(values.get(KEY)!).ticket.id).toBe(runId);
  });

  it("blocks an OAuth redirect if the run cannot be saved", () => {
    vi.stubGlobal("sessionStorage", {
      setItem: () => {
        throw new Error("Quota");
      },
    });
    expect(() => savePendingDaily(ticket(), replay, runId)).toThrow(
      "cannot be kept through sign-in",
    );
  });

  it("will not save a guest or an unfinished replay", () => {
    expect(() =>
      savePendingDaily({ ...ticket(), did: "" }, replay, null),
    ).toThrow();
    expect(() => savePendingDaily(ticket(), [[0, 120]], null)).toThrow(
      "full daily challenge",
    );
    expect(values.has(KEY)).toBe(false);
  });
});
