import { afterEach, describe, expect, it, vi } from "vitest";
import { SampleBank } from "./sample-bank";
import type { Settings } from "./storage";

function setup() {
  const sources: {
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
    start: ReturnType<typeof vi.fn>;
    buffer: unknown;
  }[] = [];
  const gains: {
    gain: { value: number; setTargetAtTime: ReturnType<typeof vi.fn> };
    disconnect: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
  }[] = [];
  const context = {
    state: "running",
    currentTime: 10,
    destination: {},
    decodeAudioData: vi.fn().mockResolvedValue({ duration: 0.7 }),
    createBufferSource: () => {
      const source = {
        stop: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        onended: null,
        buffer: null,
        connect: vi.fn((node) => node),
      };
      sources.push(source);
      return source;
    },
    createGain: () => {
      const gain = {
        gain: { value: 0, setTargetAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      gains.push(gain);
      return gain;
    },
  };
  const settings = { sound: true, music: true, musicVolume: 0.4 } as Settings;
  const duck = vi.fn();
  const bank = new SampleBank(
    () => context as unknown as AudioContext,
    settings,
    duck,
  );
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1),
    }),
  );
  return { bank, settings, context, sources, gains, duck };
}
afterEach(() => vi.unstubAllGlobals());

describe("generated audio samples", () => {
  it("loads only enabled groups and can add effects while an earlier music-only load is pending", async () => {
    const { bank, settings } = setup();
    expect(fetch).not.toHaveBeenCalled();
    settings.sound = settings.music = false;
    await bank.prepare();
    expect(fetch).not.toHaveBeenCalled();
    settings.music = true;
    const music = bank.prepare();
    settings.sound = true;
    await Promise.all([music, bank.prepare()]);
    expect(fetch).toHaveBeenCalledTimes(11);
    await bank.prepare();
    expect(fetch).toHaveBeenCalledTimes(11);
  });

  it("suppresses rapid duplicate impacts and limits overlapping effects", async () => {
    const { bank, context, sources } = setup();
    await bank.prepare();
    expect(bank.effect("bump")).toBe(true);
    expect(bank.effect("bump")).toBe(true);
    expect(sources).toHaveLength(1);
    for (const name of ["pickup", "hop", "land", "deposit"]) bank.effect(name);
    expect(sources).toHaveLength(5);
    expect(sources[0].stop).toHaveBeenCalledOnce();
    context.currentTime += 0.4;
    bank.effect("bump");
    expect(sources).toHaveLength(6);
  });

  it("stops everything on pause and ignores the old sting's completion", async () => {
    const { bank, sources, duck } = setup();
    await bank.prepare();
    bank.effect("hop");
    bank.playSting("shift-start");
    const ended = sources[1].onended;
    bank.stop();
    expect(sources.every((source) => source.stop.mock.calls.length === 1)).toBe(
      true,
    );
    bank.playSting("shift-end");
    duck.mockClear();
    ended?.();
    expect(duck).not.toHaveBeenCalled();
    sources[2].onended?.();
    expect(duck).toHaveBeenCalledWith(false);
  });

  it("keeps sound and music mute independent, and ducks stings beneath speech", async () => {
    const { bank, settings, sources, gains, context } = setup();
    await bank.prepare();
    bank.effect("pickup");
    bank.playSting("shift-start");
    bank.duckSpeech(true);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0.4 * 0.4,
      context.currentTime,
      0.04,
    );
    settings.sound = false;
    bank.sync();
    expect(sources[0].stop).toHaveBeenCalledOnce();
    expect(sources[1].stop).not.toHaveBeenCalled();
    settings.musicVolume = 0.2;
    bank.duckSpeech(false);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0.2,
      context.currentTime,
      0.04,
    );
    settings.music = false;
    bank.sync();
    expect(sources[1].stop).toHaveBeenCalledOnce();
  });

  it("leaves unavailable effects to the synth fallback and retries on a later prepare", async () => {
    const { bank, sources } = setup();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await bank.prepare();
    expect(bank.effect("pickup")).toBe(false);
    expect(bank.effect("stairs")).toBe(false);
    expect(sources).toHaveLength(0);
    await bank.prepare();
    expect(bank.effect("pickup")).toBe(true);
  });
  it("does not queue old effects or stings while audio is suspended", async () => {
    const { bank, context, sources, duck } = setup();
    await bank.prepare();
    context.state = "suspended";
    expect(bank.effect("bump")).toBe(false);
    expect(bank.playSting("big-score")).toBe(false);
    expect(sources).toHaveLength(0);
    expect(duck).not.toHaveBeenCalled();
    context.state = "running";
    expect(bank.effect("bump")).toBe(true);
    expect(bank.playSting("big-score")).toBe(true);
    expect(sources).toHaveLength(2);
  });
  it("skips downloads and remains safe when Web Audio is unavailable", async () => {
    const { settings, duck } = setup();
    const bank = new SampleBank(() => null, settings, duck);
    await expect(bank.prepare()).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    expect(bank.effect("pickup")).toBe(false);
    expect(bank.playSting("shift-start")).toBe(false);
    expect(() => {
      bank.sync();
      bank.reset();
    }).not.toThrow();
  });
});
