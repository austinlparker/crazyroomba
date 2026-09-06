import { describe, expect, it } from "vitest";
import { StandingScan } from "./daily-standing";
import type { BoardEntry, BoardPage } from "../shared/api";
const day = "2026-09-05",
  viewer = "did:plc:viewer";
const row = (
  rank: number,
  did = `did:plc:peer${rank}`,
  score = 5000 - rank,
): BoardEntry => ({
  rank,
  did,
  score,
  name: "Driver",
  handle: "driver.example",
  displayName: "Driver",
  avatar: null,
  deposited: 1,
  created_at: "2026-09-05T00:00:00Z",
});
const page = (
  entries: BoardEntry[],
  cursor: string | null = null,
): BoardPage => ({
  day,
  viewer,
  scope: "mutuals",
  entries,
  nextCursor: cursor,
});
describe("daily results standing", () => {
  it("finds the player and immediate neighbors across a page boundary", () => {
    const scan = new StandingScan(day, viewer);
    scan.accept(page([row(1), row(2, viewer, 4200)], "next"));
    expect(scan.ready).toBe(false);
    scan.accept(page([row(3), row(4)], "more"));
    expect(scan.ready).toBe(true);
    expect(scan.own?.rank).toBe(2);
    expect(scan.own?.score).toBe(4200);
    expect(scan.above?.rank).toBe(1);
    expect(scan.below?.rank).toBe(3);
  });
  it("continues through empty candidate pages without inventing a rank", () => {
    const scan = new StandingScan(day, viewer);
    scan.accept(page([], "first"));
    scan.accept(page([], "second"));
    expect(scan.ready).toBe(false);
    expect(scan.own).toBeNull();
    scan.accept(page([row(1, viewer)]));
    expect(scan.ready).toBe(true);
    expect(scan.solo).toBe(true);
  });
  it("handles first and last place, without claiming the only player is a contested winner", () => {
    const first = new StandingScan(day, viewer);
    first.accept(page([row(1, viewer), row(2)]));
    expect(first.above).toBeNull();
    expect(first.solo).toBe(false);
    const last = new StandingScan(day, viewer);
    last.accept(page([row(1), row(2, viewer)]));
    expect(last.below).toBeNull();
    expect(last.ready).toBe(true);
    expect(last.solo).toBe(false);
  });
  it.each(["day", "viewer", "scope"])(
    "rejects changed %s without mutating the scan",
    (field) => {
      const scan = new StandingScan(day, viewer);
      expect(() =>
        scan.accept({ ...page([row(1, viewer)]), [field]: "wrong" }),
      ).toThrow();
      expect(scan.own).toBeNull();
      expect(scan.complete).toBe(false);
    },
  );
  it("preserves progress after an invalid continuation so it can be retried", () => {
    const scan = new StandingScan(day, viewer);
    scan.accept(page([row(1)], "next"));
    expect(() => scan.accept(page([row(2, viewer), row(9)]))).toThrow();
    expect(scan.own).toBeNull();
    expect(scan.cursor).toBe("next");
    scan.accept(page([row(2, viewer)]));
    expect(scan.own?.rank).toBe(2);
  });
  it("rejects repeated cursors and leaves absence unranked", () => {
    const scan = new StandingScan(day, viewer);
    scan.accept(page([], "next"));
    expect(() => scan.accept(page([], "next"))).toThrow();
    scan.accept(page([]));
    expect(scan.complete).toBe(true);
    expect(scan.ready).toBe(false);
    expect(scan.own).toBeNull();
  });
});
