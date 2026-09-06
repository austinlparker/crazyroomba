import type { Audio } from "./audio";
import type { Music } from "./music";
import type { Storage } from "./storage";
import { CAPACITY, type GameEvent, type Simulation } from "./simulation";
import { stageInfo } from "./stage-catalog";
import { Announcer, type VoiceLine } from "./announcer";
import { SampleBank } from "./sample-bank";

/** Presentation-only event selection. Never consumes the simulation's RNG. */
export class GameAudio {
  readonly voice: Announcer;
  readonly samples: SampleBank;
  private warned = false;
  private wasFull = false;
  private boosting = false;
  private medal = 0;
  private record = false;
  private lastGroup = new Map<string, number>();
  private variation = new Map<string, number>();
  constructor(
    private audio: Audio,
    music: Music,
    private storage: Storage,
  ) {
    this.samples = new SampleBank(
      () => audio.unlock(),
      storage.settings,
      (active) => music.duck(active, "sting"),
    );
    this.voice = new Announcer(
      () => audio.unlock(),
      () => audio.enabled,
      (active) => {
        music.duck(active);
        this.samples.duckSpeech(active);
      },
    );
  }

  prepare(): Promise<void> {
    return Promise.all([this.voice.prepare(), this.samples.prepare()]).then(
      () => {},
    );
  }

  reset(): void {
    this.stop();
    this.samples.reset();
    this.warned = this.wasFull = this.boosting = this.record = false;
    this.medal = 0;
    this.lastGroup.clear();
  }

  stop(): void {
    this.voice.stop();
    this.samples.stop();
    this.audio.stop();
  }

  sync(): void {
    if (!this.audio.enabled) {
      this.voice.stop();
      this.audio.stop();
    }
    this.samples.sync();
    void this.prepare();
  }

  countdown(phase: string): void {
    const lines = { "3": "three", "2": "two", "1": "one", go: "go" } as const;
    if (phase === "ready")
      this.voice.play(
        this.choose("ready", ["make-a-mess", "clean-house", "ready-rip"]),
      );
    else this.voice.play(lines[phase as keyof typeof lines]);
    if (phase === "go") this.samples.playSting("shift-start");
  }

  update(s: Simulation): void {
    this.samples.sync();
    if (s.boosting && !this.boosting) this.samples.effect("turbo");
    this.boosting = s.boosting;
    const full = s.bin.length === CAPACITY;
    if (full && !this.wasFull) this.call("bin", ["full-bin"], s, 40, 12);
    this.wasFull = full;
    if (!this.warned && s.remaining <= 10 * 60)
      this.warned = s.remaining <= 9 * 60 || this.voice.say("low-time", 90);
    if (s.mode !== "arcade") return;
    const medal = Math.min(
      3,
      Math.floor(s.score / stageInfo(s.level.id).target),
    );
    if (medal > this.medal) {
      this.medal = medal;
      this.samples.playSting("big-score");
    }
    const previous = this.storage.progress.best[s.level.id];
    if (!this.record && previous > 0 && s.score > previous)
      this.record = this.voice.say("record", 85);
  }

  event(event: GameEvent, s: Simulation): void {
    if (!this.samples.effect(event.kind)) this.audio.play(event.kind);
    if (event.kind === "chain-lost") {
      this.call("lost", ["combo-lost"], s, 80, 10);
    } else if (event.kind === "deposit") {
      const chain = event.chain ?? 0;
      if (chain >= 4)
        this.call("combo", ["combo-four", "combo-three"], s, 65, 7);
      else if (chain === 3) this.call("combo", ["combo-three"], s, 60, 7);
      else if (chain === 2) this.call("combo", ["combo-two"], s, 55, 7);
      else if (event.timeAdded)
        this.call("delivery", ["bonus-time", "delivery"], s, 45, 8);
      else this.call("delivery", ["delivery"], s, 40, 8);
    } else if (event.kind === "near-miss") {
      this.call("near", ["near-miss-a", "near-miss-b"], s, 25, 10);
    } else if (event.kind === "land" && event.value > 0) {
      this.call("stunt", ["stunt-a", "stunt-b"], s, 50, 8);
      this.samples.playSting("big-score");
    }
  }

  end(s: Simulation): void {
    this.stop();
    if (s.ended) this.voice.play("times-up");
    else if (s.mode === "tutorial" && s.deposited) this.voice.play("delivery");
    if (
      !this.samples.playSting(
        s.mode === "tutorial" && s.deposited ? "big-score" : "shift-end",
      )
    )
      this.audio.play("end");
  }

  private call(
    group: string,
    choices: readonly VoiceLine[],
    s: Simulation,
    priority: number,
    gap: number,
  ): void {
    if (s.ticks - (this.lastGroup.get(group) ?? -Infinity) < gap * 60) return;
    const index = this.variation.get(group) ?? 0;
    if (this.voice.say(choices[index % choices.length], priority)) {
      this.variation.set(group, index + 1);
      this.lastGroup.set(group, s.ticks);
    }
  }

  private choose(group: string, choices: readonly VoiceLine[]): VoiceLine {
    const index =
      this.variation.get(group) ?? Math.floor(Math.random() * choices.length);
    this.variation.set(group, index + 1);
    return choices[index % choices.length];
  }
}
