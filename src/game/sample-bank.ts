import type { Settings } from "./storage";

const EFFECTS = {
  pickup: 0.09,
  deposit: 0.35,
  bump: 0.3,
  boost: 0.7,
  turbo: 1.6,
  hop: 0.25,
  land: 0.3,
  "near-miss": 0.5,
} as const;
export type Effect = keyof typeof EFFECTS;
const STINGS = ["shift-start", "big-score", "shift-end"] as const;
export type Sting = (typeof STINGS)[number];
type Sample = Effect | Sting;
type Playing = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  context: AudioContext;
};

/** Lazy one-shots, with bounded polyphony and separate sound/music controls. */
export class SampleBank {
  private buffers = new Map<Sample, AudioBuffer>();
  private loading = new Map<Sample, Promise<void>>();
  private effects = new Set<Playing>();
  private sting: Playing | null = null;
  private last = new Map<Sample, number>();
  private speech = false;
  private volume = -1;
  constructor(
    private context: () => AudioContext | null,
    private settings: Settings,
    private duckMusic: (active: boolean) => void,
  ) {}

  prepare(): Promise<void> {
    const names: Sample[] = [
      ...(this.settings.sound ? (Object.keys(EFFECTS) as Effect[]) : []),
      ...(this.settings.music ? STINGS : []),
    ];
    if (!names.length) return Promise.resolve();
    const context = this.context();
    if (!context) return Promise.resolve();
    return Promise.allSettled(
      names.map((name) => {
        if (this.buffers.has(name)) return;
        let loading = this.loading.get(name);
        if (!loading) {
          loading = (async () => {
            const response = await fetch(
              `${import.meta.env.BASE_URL}audio/${name}.mp3?v=arcade-audio-1`,
              { signal: AbortSignal.timeout(2500) },
            );
            if (response.ok)
              this.buffers.set(
                name,
                await context.decodeAudioData(await response.arrayBuffer()),
              );
          })().finally(() => this.loading.delete(name));
          this.loading.set(name, loading);
        }
        return loading;
      }),
    ).then(() => {});
  }

  effect(name: string): boolean {
    if (!(name in EFFECTS) || !this.settings.sound) return false;
    const kind = name as Effect;
    const buffer = this.buffers.get(kind);
    if (!buffer) return false;
    const context = this.context();
    if (!context || context.state !== "running") return false;
    const now = context.currentTime;
    if (now - (this.last.get(kind) ?? -Infinity) < EFFECTS[kind]) return true;
    this.last.set(kind, now);
    if (this.effects.size >= 4)
      this.finish(this.effects.values().next().value!);
    const playing = this.play(context, buffer, kind === "pickup" ? 0.45 : 0.55);
    this.effects.add(playing);
    playing.source.onended = () => {
      this.effects.delete(playing);
      playing.source.disconnect();
      playing.gain.disconnect();
    };
    return true;
  }

  playSting(name: Sting): boolean {
    if (!this.settings.music || this.settings.musicVolume <= 0) return false;
    const buffer = this.buffers.get(name);
    if (!buffer) return false;
    const context = this.context();
    if (!context || context.state !== "running") return false;
    const now = context.currentTime;
    if (name === "big-score" && now - (this.last.get(name) ?? -Infinity) < 12)
      return true;
    this.last.set(name, now);
    this.stopSting();
    this.volume = this.stingVolume();
    const playing = this.play(context, buffer, this.volume);
    this.sting = playing;
    this.duckMusic(true);
    playing.source.onended = () => {
      playing.source.disconnect();
      playing.gain.disconnect();
      if (this.sting !== playing) return;
      this.sting = null;
      this.duckMusic(false);
    };
    return true;
  }

  private play(
    context: AudioContext,
    buffer: AudioBuffer,
    volume: number,
  ): Playing {
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain).connect(context.destination);
    source.start();
    return { source, gain, context };
  }

  private stingVolume(): number {
    return this.settings.musicVolume * (this.speech ? 0.4 : 1);
  }

  duckSpeech(active: boolean): void {
    this.speech = active;
    this.sync();
  }

  sync(): void {
    if (!this.settings.sound)
      for (const effect of this.effects) this.finish(effect);
    if (!this.settings.music || this.settings.musicVolume <= 0)
      this.stopSting();
    const volume = this.stingVolume();
    if (this.sting && volume !== this.volume) {
      this.volume = volume;
      this.sting.gain.gain.setTargetAtTime(
        volume,
        this.sting.context.currentTime,
        0.04,
      );
    }
  }

  private finish(playing: Playing): void {
    playing.source.onended = null;
    playing.source.stop();
    playing.source.disconnect();
    playing.gain.disconnect();
    this.effects.delete(playing);
  }

  private stopSting(): void {
    if (this.sting) this.finish(this.sting);
    this.sting = null;
    this.duckMusic(false);
  }

  stop(): void {
    for (const effect of this.effects) this.finish(effect);
    this.stopSting();
  }

  reset(): void {
    this.stop();
    this.last.clear();
  }
}
