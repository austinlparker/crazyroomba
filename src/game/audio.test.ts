import { afterEach, describe, expect, it, vi } from "vitest";
import { Audio } from "./audio";

function setup(state = "running") {
  const sources: {
    onended: (() => void) | null;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  const gains: { disconnect: ReturnType<typeof vi.fn> }[] = [];
  const context = {
    state,
    currentTime: 10,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    createGain: vi.fn(() => {
      const gain = {
        gain: {
          value: 0,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn((node) => node),
        disconnect: vi.fn(),
      };
      gains.push(gain);
      return gain;
    }),
    createOscillator: vi.fn(() => {
      const source = {
        type: "square",
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        onended: null,
        connect: vi.fn((node) => node),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      };
      sources.push(source);
      return source;
    }),
  };
  const create = vi.fn(function () {
    return context;
  });
  vi.stubGlobal("AudioContext", create);
  return { audio: new Audio(), context, create, sources, gains };
}

afterEach(() => vi.unstubAllGlobals());

describe("synth audio lifecycle", () => {
  it("keeps gameplay safe without Web Audio and can retry after availability changes", () => {
    const { audio, create } = setup();
    vi.stubGlobal("AudioContext", undefined);
    expect(audio.unlock()).toBeNull();
    expect(() => {
      audio.play("hop");
      audio.stop();
    }).not.toThrow();
    vi.stubGlobal("AudioContext", create);
    expect(audio.unlock()).not.toBeNull();
    expect(create).toHaveBeenCalledOnce();
  });

  it("shares one context and permits a trusted retry while an earlier resume is pending", async () => {
    const { audio, context, create } = setup("suspended");
    let resumed!: () => void;
    context.resume.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resumed = resolve;
        }),
    );
    audio.unlock();
    audio.unlock();
    expect(create).toHaveBeenCalledOnce();
    expect(context.resume).toHaveBeenCalledTimes(2);
    audio.play("hop");
    expect(context.createOscillator).not.toHaveBeenCalled();
    context.state = "running";
    resumed();
    await Promise.resolve();
    audio.unlock();
    audio.play("hop");
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(context.createOscillator).toHaveBeenCalledOnce();
    context.state = "closed";
    expect(audio.unlock()).toBeNull();
    audio.play("hop");
    expect(context.createOscillator).toHaveBeenCalledOnce();
  });

  it("disconnects pending notes immediately on stop and cleans each graph once", () => {
    const { audio, sources, gains } = setup();
    audio.unlock();
    audio.play("deposit");
    expect(sources).toHaveLength(5);
    for (const source of sources) source.stop.mockClear();
    audio.stop();
    audio.stop();
    for (const source of sources) {
      expect(source.stop).toHaveBeenCalledOnce();
      expect(source.disconnect).toHaveBeenCalledOnce();
      expect(source.onended).toBeNull();
    }
    for (const gain of gains.slice(1))
      expect(gain.disconnect).toHaveBeenCalledOnce();
    expect(gains[0].disconnect).not.toHaveBeenCalled();
  });

  it("can retry a rejected browser resume and recover an interrupted context", async () => {
    const { audio, context, create } = setup("suspended");
    context.resume.mockRejectedValueOnce(new Error("Gesture required"));
    expect(audio.unlock()).not.toBeNull();
    await Promise.resolve();
    await Promise.resolve();
    context.state = "interrupted";
    expect(audio.unlock()).not.toBeNull();
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledOnce();
  });
});
