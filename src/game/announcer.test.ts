import { afterEach, describe, expect, it, vi } from "vitest";
import { Announcer } from "./announcer";
function setup() {
  const sources: {
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
    buffer: unknown;
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
  }[] = [];
  const context = {
    state: "running",
    currentTime: 1,
    destination: {},
    decodeAudioData: vi.fn().mockResolvedValue({ duration: 1 }),
    createBufferSource: () => {
      const s = {
        stop: vi.fn(),
        disconnect: vi.fn(),
        onended: null,
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
      };
      sources.push(s);
      return s;
    },
  };
  const duck = vi.fn(),
    enabled = vi.fn(() => true);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    }),
  );
  const voice = new Announcer(
    () => context as unknown as AudioContext,
    enabled,
    duck,
  );
  return { voice, sources, duck, enabled, context };
}
afterEach(() => vi.unstubAllGlobals());
describe("announcer lifecycle", () => {
  it("loads only after prepare, skips muted downloads and reuses decoded clips", async () => {
    const { voice, enabled } = setup();
    expect(fetch).not.toHaveBeenCalled();
    enabled.mockReturnValue(false);
    await voice.prepare();
    expect(fetch).not.toHaveBeenCalled();
    enabled.mockReturnValue(true);
    await voice.prepare();
    await voice.prepare();
    expect(fetch).toHaveBeenCalledTimes(21);
  });
  it("an old cue ending cannot unduck a newer countdown cue", async () => {
    const { voice, sources, duck } = setup();
    await voice.prepare();
    voice.play("three");
    voice.play("two");
    expect(sources[0].stop).toHaveBeenCalledOnce();
    duck.mockClear();
    sources[0].onended?.();
    expect(duck).not.toHaveBeenCalled();
    sources[1].onended?.();
    expect(duck).toHaveBeenLastCalledWith(false);
  });
  it("pause or mute stops the cue and restores music volume", async () => {
    const { voice, sources, duck, enabled } = setup();
    await voice.prepare();
    voice.play("go");
    voice.stop();
    expect(sources[0].stop).toHaveBeenCalledOnce();
    expect(duck).toHaveBeenLastCalledWith(false);
    enabled.mockReturnValue(false);
    voice.play("times-up");
    expect(sources).toHaveLength(1);
  });
  it("missing clips do not prevent gameplay and can retry on a later start", async () => {
    const { voice, sources } = setup();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await voice.prepare();
    voice.play("three");
    expect(sources).toHaveLength(0);
    await voice.prepare();
    voice.play("three");
    expect(sources).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(22);
  });
  it("protects countdown speech and spaces incidental callouts after it ends", async () => {
    const { voice, sources, context } = setup();
    await voice.prepare();
    voice.play("go");
    expect(voice.say("low-time", 90)).toBe(false);
    sources[0].onended?.();
    context.currentTime = 3;
    expect(voice.say("near-miss-a")).toBe(false);
    context.currentTime = 6;
    expect(voice.say("near-miss-a")).toBe(true);
    expect(sources).toHaveLength(2);
  });
  it("lets a time warning interrupt chatter but protects it from lower-priority reactions", async () => {
    const { voice, sources } = setup();
    await voice.prepare();
    expect(voice.say("stunt-a", 50)).toBe(true);
    expect(voice.say("low-time", 90)).toBe(true);
    expect(sources[0].stop).toHaveBeenCalledOnce();
    expect(voice.say("combo-lost", 80)).toBe(false);
    expect(sources[1].stop).not.toHaveBeenCalled();
    voice.stop();
    expect(sources[1].stop).toHaveBeenCalledOnce();
  });
  it("does not cut current speech when the replacement clip is unavailable", async () => {
    const { voice, sources } = setup();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await voice.prepare();
    voice.play("go");
    expect(voice.play("three")).toBe(false);
    expect(sources[0].stop).not.toHaveBeenCalled();
  });
  it("skips suspended cues without interrupting speech or consuming the chatter gap", async () => {
    const { voice, sources, context } = setup();
    await voice.prepare();
    voice.play("go");
    context.state = "suspended";
    expect(voice.play("times-up")).toBe(false);
    expect(voice.say("low-time", 90)).toBe(false);
    expect(sources).toHaveLength(1);
    expect(sources[0].stop).not.toHaveBeenCalled();
    voice.stop();
    context.state = "running";
    context.currentTime = 10;
    expect(voice.say("low-time", 90)).toBe(true);
  });
  it("does not fetch or throw when Web Audio is unavailable", async () => {
    setup();
    const voice = new Announcer(
      () => null,
      () => true,
      vi.fn(),
    );
    await expect(voice.prepare()).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    expect(voice.play("go")).toBe(false);
    expect(voice.say("low-time")).toBe(false);
    expect(() => voice.stop()).not.toThrow();
  });
});
