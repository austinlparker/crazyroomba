import { describe, it, expect, vi } from "vitest";
import { Music, TRACKS } from "./music";

function fixture(random = () => 0) {
  const player = {
    src: "",
    preload: "",
    loop: false,
    currentTime: 12,
    paused: true,
    onended: null as (() => void) | null,
    onerror: null as (() => void) | null,
    play: vi.fn(() => {
      player.paused = false;
      return Promise.resolve();
    }),
    pause: vi.fn(() => {
      player.paused = true;
    }),
  };
  const gain = {
    gain: { value: 1, setTargetAtTime: vi.fn() },
    connect: vi.fn(),
  };
  const source = { connect: vi.fn() };
  const context = {
    currentTime: 1,
    state: "running",
    destination: {},
    createGain: vi.fn(() => gain),
    createMediaElementSource: vi.fn(() => source),
    addEventListener: vi.fn(),
  };
  const unlock = vi.fn(() => context as unknown as AudioContext);
  const create = vi.fn(() => player as unknown as HTMLAudioElement);
  return {
    music: new Music(unlock, create, random),
    player,
    create,
    unlock,
    gain,
    context,
  };
}

describe("Dust FM playback", () => {
  it("loops Overdrive on the menu and restores the selected shift track using one player", async () => {
    const { music, player, create } = fixture(() => 0.72);
    const shift = music.track;
    music.startMenu();
    await Promise.resolve();
    expect(music.track).toBe(TRACKS[0]);
    expect(player.loop).toBe(true);
    expect(player.src).toContain("dust-fm-overdrive.mp3");
    const plays = player.play.mock.calls.length;
    music.startMenu();
    player.onended!();
    expect(player.play).toHaveBeenCalledTimes(plays);
    expect(music.track).toBe(TRACKS[0]);
    music.startShift();
    expect(music.track).toBe(shift);
    expect(player.loop).toBe(false);
    music.pause();
    music.start();
    expect(music.track).toBe(shift);
    music.startMenu();
    expect(music.track).toBe(TRACKS[0]);
    expect(player.loop).toBe(true);
    expect(create).toHaveBeenCalledOnce();
  });

  it("lets preview skips leave the menu loop and restores Overdrive when closing preview", () => {
    const { music, player } = fixture(() => 0.72);
    music.startMenu();
    music.next();
    expect(music.track).toBe(TRACKS[1]);
    expect(player.loop).toBe(false);
    music.startMenu();
    expect(music.track).toBe(TRACKS[0]);
    expect(player.loop).toBe(true);
  });

  it("keeps a muted menu lazy, respects volume, and retries a suspended audio context on interaction", async () => {
    const { music, player, create, context, gain } = fixture();
    music.configure(false, 0.2);
    music.startMenu();
    expect(create).not.toHaveBeenCalled();
    context.state = "suspended";
    music.configure(true, 0.2);
    await Promise.resolve();
    expect(music.status).toBe("blocked");
    expect(gain.gain.value).toBeCloseTo(0.2);
    context.state = "running";
    music.startMenu();
    await Promise.resolve();
    expect(music.status).toBe("playing");
    expect(player.play).toHaveBeenCalledTimes(2);
    music.configure(false, 0.2);
    expect(player.paused).toBe(true);
    music.startMenu();
    expect(player.paused).toBe(true);
  });

  it("does not create or download media before an enabled start", () => {
    const { music, create, unlock } = fixture();
    music.configure(false, 0.2);
    music.start();
    music.next();
    expect(create).not.toHaveBeenCalled();
    expect(unlock).not.toHaveBeenCalled();
    music.configure(true, 0.2);
    expect(create).toHaveBeenCalledOnce();
  });

  it("pauses immediately, resumes at the same position, and shares one audio graph", async () => {
    const { music, player, context } = fixture();
    music.start();
    await Promise.resolve();
    expect(music.status).toBe("playing");
    music.pause();
    expect(player.paused).toBe(true);
    expect(music.active).toBe(false);
    music.start();
    await Promise.resolve();
    expect(player.currentTime).toBe(12);
    expect(player.paused).toBe(false);
    expect(context.createMediaElementSource).toHaveBeenCalledOnce();
    expect(player.preload).toBe("none");
  });

  it("mutes without forgetting a shift, and never starts music from a paused volume change", () => {
    const { music, player, gain } = fixture();
    music.start();
    music.configure(false, 0.2);
    expect(player.paused).toBe(true);
    music.configure(true, 0.2);
    expect(player.paused).toBe(false);
    music.pause();
    const plays = player.play.mock.calls.length;
    music.configure(true, 0.8);
    expect(player.play).toHaveBeenCalledTimes(plays);
    expect(gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.8, 1, 0.05);
    music.configure(true, 5);
    expect(gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 1, 0.05);
  });

  it("rotates the playlist on end and skips while paused without playing", () => {
    const { music, player } = fixture();
    music.start();
    expect(player.src).toContain(TRACKS[0].file);
    player.onended!();
    expect(player.src).toContain(TRACKS[1].file);
    expect(player.play).toHaveBeenCalledTimes(2);
    music.pause();
    for (let i = 1; i < TRACKS.length; i++) music.next();
    expect(music.track).toBe(TRACKS[0]);
    expect(player.play).toHaveBeenCalledTimes(2);
    player.onended!();
    expect(music.track).toBe(TRACKS[0]);
  });

  it("chooses a varied first track once and preserves it through pause and resume", () => {
    const random = vi.fn(() => 0.72);
    const { music, player } = fixture(random);
    const initial = music.track;
    expect(initial).toBe(TRACKS[Math.floor(0.72 * TRACKS.length)]);
    music.start();
    music.pause();
    music.start();
    expect(music.track).toBe(initial);
    expect(player.currentTime).toBe(12);
    expect(random).toHaveBeenCalledOnce();
  });

  it("ducks beneath speech, respects volume changes while ducked and restores the latest volume", () => {
    const { music, gain, create } = fixture();
    music.duck(true);
    expect(create).not.toHaveBeenCalled();
    music.start();
    expect(gain.gain.value).toBeCloseTo(0.35 * 0.32);
    music.configure(true, 0.7);
    expect(gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0.7 * 0.32,
      1,
      0.05,
    );
    music.duck(false);
    expect(gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.7, 1, 0.18);
    music.duck(true);
    expect(gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0.7 * 0.32,
      1,
      0.025,
    );
    music.pause();
    music.duck(false);
    expect(music.active).toBe(false);
  });

  it("keeps the radio ducked until both speech and the musical sting have ended", () => {
    const { music, gain } = fixture();
    music.start();
    music.duck(true);
    music.duck(true, "sting");
    music.duck(false);
    expect(gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0.35 * 0.32,
      1,
      0.025,
    );
    music.duck(false, "sting");
    expect(gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.35, 1, 0.18);
  });

  it("ignores a late play rejection after pause, then can resume", async () => {
    const { music, player } = fixture();
    let reject!: (error: Error) => void;
    player.play.mockImplementationOnce(
      () =>
        new Promise<void>((_, no) => {
          reject = no;
        }),
    );
    music.start();
    music.pause();
    reject(new Error("Playback aborted"));
    await Promise.resolve();
    expect(music.status).toBe("idle");
    music.start();
    await Promise.resolve();
    expect(music.status).toBe("playing");
  });

  it("reports autoplay or asset failures without throwing or retrying forever", async () => {
    const { music, player } = fixture();
    player.play.mockRejectedValueOnce(
      Object.assign(new Error("Blocked"), { name: "NotAllowedError" }),
    );
    music.start();
    await Promise.resolve();
    expect(music.status).toBe("blocked");
    music.start();
    await Promise.resolve();
    player.onerror!();
    expect(music.status).toBe("unavailable");
    expect(player.play).toHaveBeenCalledTimes(2);
    music.next();
    await Promise.resolve();
    expect(music.status).toBe("playing");
  });

  it("ignores completion of an older play request after a track skip", async () => {
    const { music, player } = fixture();
    let finishOld!: () => void;
    player.play.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishOld = resolve;
        }),
    );
    music.start();
    music.next();
    music.pause();
    finishOld();
    await Promise.resolve();
    expect(music.track).toBe(TRACKS[1]);
    expect(player.paused).toBe(true);
    expect(music.status).toBe("idle");
  });

  it("pauses an inaudible stream during context suspension and resumes the same track", async () => {
    const { music, player, context, create } = fixture();
    music.start();
    await Promise.resolve();
    const change = context.addEventListener.mock.calls[0][1] as () => void;
    context.state = "suspended";
    change();
    expect(music.status).toBe("blocked");
    expect(player.paused).toBe(true);
    expect(music.active).toBe(true);
    context.state = "running";
    change();
    await Promise.resolve();
    expect(music.status).toBe("playing");
    expect(player.currentTime).toBe(12);
    expect(create).toHaveBeenCalledOnce();
    music.pause();
    context.state = "suspended";
    change();
    context.state = "running";
    change();
    expect(player.paused).toBe(true);
    expect(music.status).toBe("idle");
  });

  it("does not let a late play completion overwrite an asset failure", async () => {
    const { music, player } = fixture();
    let finish!: () => void;
    player.play.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    music.start();
    player.onerror!();
    finish();
    await Promise.resolve();
    expect(music.status).toBe("unavailable");
    expect(player.paused).toBe(true);
    music.next();
    await Promise.resolve();
    expect(music.status).toBe("playing");
  });

  it("stays lazy when Web Audio is unavailable and allows a later retry", async () => {
    const { music, create, unlock, context } = fixture();
    unlock.mockReturnValueOnce(null as unknown as AudioContext);
    music.start();
    expect(music.status).toBe("unavailable");
    expect(create).not.toHaveBeenCalled();
    expect(context.createMediaElementSource).not.toHaveBeenCalled();
    music.start();
    await Promise.resolve();
    expect(music.status).toBe("playing");
    expect(create).toHaveBeenCalledOnce();
  });
});
