import { describe, expect, it, vi } from "vitest";
import { GameAudio } from "./game-audio";
import type { Audio } from "./audio";
import type { Music } from "./music";
import type { Storage } from "./storage";
import type { GameEvent, Simulation } from "./simulation";

function setup() {
  const audio = { enabled: true, play: vi.fn(), stop: vi.fn() };
  const storage = {
    settings: { sound: true, music: true, musicVolume: 0.35 },
    progress: { best: { apartment: 2000 } },
  };
  const sounds = new GameAudio(
    audio as unknown as Audio,
    { duck: vi.fn() } as unknown as Music,
    storage as unknown as Storage,
  );
  const say = vi.spyOn(sounds.voice, "say").mockReturnValue(true);
  const play = vi.spyOn(sounds.voice, "play").mockReturnValue(true);
  const effect = vi.spyOn(sounds.samples, "effect").mockReturnValue(true);
  const sting = vi.spyOn(sounds.samples, "playSting").mockReturnValue(true);
  const s = {
    ticks: 1000,
    remaining: 3600,
    mode: "arcade",
    bin: [],
    boosting: false,
    score: 0,
    level: { id: "apartment" },
  } as unknown as Simulation;
  const event = (kind: GameEvent["kind"], fields = {}) =>
    sounds.event({ kind, x: 0, y: 0, z: 0, value: 0, ...fields }, s);
  return { sounds, say, play, effect, sting, s, event, audio };
}

describe("gameplay audio direction", () => {
  it("warns once near ten seconds, and never announces ten seconds late after a muted interval", () => {
    const { sounds, s, say } = setup();
    s.remaining = 600;
    sounds.update(s);
    sounds.update(s);
    s.remaining = 1000;
    sounds.update(s);
    s.remaining = 599;
    sounds.update(s);
    expect(say).toHaveBeenCalledExactlyOnceWith("low-time", 90);
    sounds.reset();
    say.mockClear();
    say.mockReturnValue(false);
    sounds.update(s);
    say.mockReturnValue(true);
    s.remaining = 300;
    sounds.update(s);
    expect(say).toHaveBeenCalledTimes(1);
  });

  it("detects full-bin and turbo transitions without repeating while held", () => {
    const { sounds, s, say, effect } = setup();
    s.bin = [1, 1, 1, 1, 1];
    s.boosting = true;
    sounds.update(s);
    sounds.update(s);
    expect(say).toHaveBeenCalledExactlyOnceWith("full-bin", 40);
    expect(effect).toHaveBeenCalledExactlyOnceWith("turbo");
    s.boosting = false;
    sounds.update(s);
    s.boosting = true;
    sounds.update(s);
    expect(effect).toHaveBeenCalledTimes(2);
  });

  it("spaces repeated near misses and alternates successful reactions", () => {
    const { event, s, say } = setup();
    event("near-miss");
    s.ticks += 5;
    event("near-miss");
    expect(say).toHaveBeenCalledExactlyOnceWith("near-miss-a", 25);
    s.ticks += 600;
    event("near-miss");
    expect(say).toHaveBeenLastCalledWith("near-miss-b", 25);
  });

  it("reserves stunt praise for completed spins and uses the chain's actual level", () => {
    const { event, s, say, sting } = setup();
    event("land");
    expect(say).not.toHaveBeenCalled();
    event("land", { value: 1 });
    expect(say).toHaveBeenLastCalledWith("stunt-a", 50);
    expect(sting).toHaveBeenCalledWith("big-score");
    event("deposit", { chain: 2 });
    expect(say).toHaveBeenLastCalledWith("combo-two", 55);
    s.ticks += 8 * 60;
    event("deposit", { chain: 3 });
    expect(say).toHaveBeenLastCalledWith("combo-three", 60);
  });

  it("celebrates crossed score milestones once and does not claim arcade records in Daily", () => {
    const { sounds, s, say, sting } = setup();
    s.score = 2500;
    sounds.update(s);
    sounds.update(s);
    expect(say).toHaveBeenCalledExactlyOnceWith("record", 85);
    expect(sting).toHaveBeenCalledOnce();
    sounds.reset();
    say.mockClear();
    sting.mockClear();
    sounds.update({ ...s, mode: "daily" } as Simulation);
    expect(say).not.toHaveBeenCalled();
    expect(sting).not.toHaveBeenCalled();
  });

  it("falls back to synthesized events when samples are missing", () => {
    const { event, effect, audio } = setup();
    effect.mockReturnValue(false);
    event("deposit");
    expect(audio.play).toHaveBeenCalledWith("deposit");
    effect.mockReturnValue(true);
    event("pickup");
    expect(audio.play).toHaveBeenCalledTimes(1);
  });
});
