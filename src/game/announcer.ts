const LINES = [
  "three",
  "two",
  "one",
  "go",
  "make-a-mess",
  "clean-house",
  "combo-lost",
  "times-up",
  "full-bin",
  "delivery",
  "combo-two",
  "combo-three",
  "combo-four",
  "near-miss-a",
  "near-miss-b",
  "stunt-a",
  "stunt-b",
  "low-time",
  "bonus-time",
  "record",
  "ready-rip",
] as const;
export type VoiceLine = (typeof LINES)[number];

/** Pre-rendered synthetic announcer clips; the voice model never ships to players. */
export class Announcer {
  private buffers = new Map<VoiceLine, AudioBuffer>();
  private source: AudioBufferSourceNode | null = null;
  private loading: Promise<void> | null = null;
  private priority = 0;
  private nextComment = 0;
  constructor(
    private context: () => AudioContext | null,
    private enabled: () => boolean,
    private duck: (active: boolean) => void,
  ) {}
  prepare(): Promise<void> {
    if (!this.enabled()) return Promise.resolve();
    if (this.loading) return this.loading;
    const context = this.context();
    if (!context) return Promise.resolve();
    this.loading = Promise.allSettled(
      LINES.filter((line) => !this.buffers.has(line)).map(async (line) => {
        const response = await fetch(
          `${import.meta.env.BASE_URL}voice/${line}.mp3?v=arcade-audio-1`,
          { signal: AbortSignal.timeout(2500) },
        );
        if (!response.ok) return;
        const buffer = await context.decodeAudioData(
          await response.arrayBuffer(),
        );
        this.buffers.set(line, buffer);
      }),
    ).then(() => {
      this.loading = null;
    });
    return this.loading;
  }
  /** Incidental calls leave a gap and cannot interrupt a more important cue. */
  say(line: VoiceLine, priority = 20): boolean {
    if (!this.enabled()) return false;
    if (this.source && priority <= this.priority) return false;
    const context = this.context();
    if (!context || context.state !== "running") return false;
    if (priority < 80 && context.currentTime < this.nextComment) return false;
    return this.play(line, priority);
  }
  play(line: VoiceLine, priority = 100): boolean {
    const buffer = this.buffers.get(line);
    if (!this.enabled() || !buffer) return false;
    const context = this.context();
    if (!context || context.state !== "running") return false;
    this.stop();
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => {
      source.disconnect();
      if (this.source === source) {
        this.source = null;
        this.priority = 0;
        this.duck(false);
      }
    };
    this.source = source;
    this.priority = priority;
    this.nextComment = context.currentTime + buffer.duration + 3.25;
    this.duck(true);
    source.start();
    return true;
  }
  stop(): void {
    if (this.source) {
      this.source.onended = null;
      this.source.stop();
      this.source.disconnect();
      this.source = null;
    }
    this.priority = 0;
    this.duck(false);
  }
}
