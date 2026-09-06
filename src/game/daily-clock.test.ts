import { afterEach, describe, expect, it, vi } from "vitest";
import { watchUtcDay } from "./daily-clock";
import { dailyStage, STAGES } from "./stage-catalog";
import { seedForDay, utcDay } from "./simulation";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("UTC daily rotation", () => {
  it("uses the same date, stage and seed for the same instant in any timezone", () => {
    const times = [
      "2026-09-07T00:00:00Z",
      "2026-09-06T20:00:00-04:00",
      "2026-09-07T09:00:00+09:00",
    ];
    const days = times.map((time) => utcDay(new Date(time)));
    expect(new Set(days)).toEqual(new Set(["2026-09-07"]));
    expect(new Set(days.map(dailyStage)).size).toBe(1);
    expect(new Set(days.map(seedForDay)).size).toBe(1);
    expect(utcDay(new Date("2026-09-06T19:59:59.999-04:00"))).toBe(
      "2026-09-06",
    );
  });

  it.each(["2026-12-31", "2028-02-28", "2026-03-08", "2026-11-01"])(
    "advances daily through month, year, leap day and DST boundaries from %s",
    (start) => {
      const days = Array.from({ length: 5 }, (_, i) =>
        utcDay(new Date(Date.parse(`${start}T00:00:00Z`) + i * 86400000)),
      );
      const stages = days.map(dailyStage);
      expect(new Set(stages.slice(0, 4)).size).toBe(STAGES.length);
      expect(stages[0]).toBe(stages[4]);
      expect(new Set(days.map(seedForDay)).size).toBe(5);
    },
  );

  it("refreshes once at midnight, catches a sleeping tab, and cancels on disposal", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T23:59:59Z"));
    const doc = Object.assign(new EventTarget(), { hidden: false });
    const win = Object.assign(new EventTarget(), {
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
    });
    vi.stubGlobal("document", doc);
    vi.stubGlobal("window", win);
    const changed = vi.fn();
    const stop = watchUtcDay(changed);
    vi.advanceTimersByTime(999);
    expect(changed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(changed).toHaveBeenLastCalledWith("2026-09-07");
    vi.advanceTimersByTime(60000);
    expect(changed).toHaveBeenCalledTimes(1);
    doc.hidden = true;
    vi.setSystemTime(new Date("2026-09-10T01:00:00Z"));
    vi.advanceTimersByTime(1000);
    expect(changed).toHaveBeenCalledTimes(1);
    doc.hidden = false;
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(changed).toHaveBeenLastCalledWith("2026-09-10");
    win.dispatchEvent(new Event("focus"));
    expect(changed).toHaveBeenCalledTimes(2);
    stop();
    vi.setSystemTime(new Date("2026-09-11T01:00:00Z"));
    vi.advanceTimersByTime(1000);
    win.dispatchEvent(new Event("focus"));
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(changed).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
