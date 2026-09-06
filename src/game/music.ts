export const TRACKS = [
  {
    title: "Dust FM: Overdrive",
    artist: "Crazy Roomba",
    file: "dust-fm-overdrive.mp3",
    source: "https://elevenlabs.io/music",
  },
  {
    title: "Curbside Riot",
    artist: "Crazy Roomba",
    file: "curbside-riot.mp3",
    source: "https://elevenlabs.io/music",
  },
  {
    title: "Kickflip Static",
    artist: "Crazy Roomba",
    file: "kickflip-static.mp3",
    source: "https://elevenlabs.io/music",
  },
  {
    title: "Garage Afterburner",
    artist: "Crazy Roomba",
    file: "garage-afterburner.mp3",
    source: "https://elevenlabs.io/music",
  },
  {
    title: "Brass & Burnouts",
    artist: "Crazy Roomba",
    file: "brass-and-burnouts.mp3",
    source: "https://elevenlabs.io/music",
  },
] as const;

/** One lazy, streamed player. Music never participates in simulation/replay state. */
export class Music {
  private player: HTMLAudioElement | null = null;
  private gain: GainNode | null = null;
  private context: AudioContext | null = null;
  private index = 0;
  private menu = false;
  private epoch = 0;
  private enabled = true;
  private volume = 0.35;
  private ducking = new Set<string>();
  active = false;
  status: "idle" | "playing" | "blocked" | "unavailable" = "idle";
  onChange = () => {};

  constructor(
    private unlock: () => AudioContext | null,
    private createPlayer = () => new window.Audio(),
    random = Math.random,
  ) {
    // Pick once per visit; pause/resume and subsequent shifts keep the station's place.
    this.index = Math.floor(random() * TRACKS.length) % TRACKS.length;
  }

  get track() {
    return TRACKS[this.menu ? 0 : this.index];
  }

  configure(enabled: boolean, volume: number): void {
    const changed = this.enabled !== enabled;
    this.enabled = enabled;
    this.volume = Number.isFinite(volume)
      ? Math.max(0, Math.min(1, volume))
      : 0.35;
    if (this.gain && this.context)
      this.gain.gain.setTargetAtTime(
        this.effectiveVolume(),
        this.context.currentTime,
        0.05,
      );
    if (!enabled) this.stopPlayback();
    else if (changed && this.active) this.play();
  }

  duck(active: boolean, source = "voice"): void {
    if (active) this.ducking.add(source);
    else this.ducking.delete(source);
    if (this.gain && this.context)
      this.gain.gain.setTargetAtTime(
        this.effectiveVolume(),
        this.context.currentTime,
        this.ducking.size ? 0.025 : 0.18,
      );
  }

  private effectiveVolume(): number {
    return this.volume * (this.ducking.size ? 0.32 : 1);
  }

  start(): void {
    this.active = true;
    if (this.enabled) this.play();
  }

  startMenu(): void {
    this.setMenu(true);
    if (
      !this.active ||
      this.status !== "playing" ||
      this.context?.state !== "running"
    )
      this.start();
  }

  startShift(): void {
    this.setMenu(false);
    this.start();
  }

  private setMenu(menu: boolean): void {
    if (this.menu === menu) return;
    this.stopPlayback();
    this.menu = menu;
    if (this.player) {
      this.player.loop = menu;
      this.player.src = this.url();
    }
  }

  pause(): void {
    this.active = false;
    this.stopPlayback();
  }

  next(): void {
    this.stopPlayback();
    this.index = ((this.menu ? 0 : this.index) + 1) % TRACKS.length;
    this.menu = false;
    if (this.player) {
      this.player.loop = false;
      this.player.src = this.url();
    }
    if (this.active && this.enabled) this.play();
    this.onChange();
  }

  private url(): string {
    return `${import.meta.env.BASE_URL}music/${this.track.file}`;
  }

  private stopPlayback(): void {
    ++this.epoch;
    this.player?.pause();
    this.status = "idle";
    this.onChange();
  }

  private play(): void {
    const epoch = ++this.epoch;
    try {
      // The menu may attempt autoplay; a trusted gesture retries if it is blocked.
      this.context = this.unlock();
      if (!this.context) throw new Error("Web Audio unavailable");
      if (!this.player) {
        this.player = this.createPlayer();
        this.player.preload = "none";
        this.player.loop = this.menu;
        this.player.src = this.url();
        this.gain = this.context.createGain();
        this.gain.gain.value = this.effectiveVolume();
        this.context.createMediaElementSource(this.player).connect(this.gain);
        this.gain.connect(this.context.destination);
        this.player.onended = () => {
          if (!this.menu && this.active && this.enabled) this.next();
        };
        this.player.onerror = () => {
          if (!this.active || !this.enabled) return;
          ++this.epoch;
          this.status = "unavailable";
          this.player?.pause();
          this.onChange();
        };
        this.context.addEventListener("statechange", () => {
          if (!this.active || !this.enabled || this.status === "unavailable")
            return;
          if (this.context?.state === "running") {
            if (this.status === "blocked") this.play();
          } else {
            ++this.epoch;
            this.player?.pause();
            this.status =
              this.context?.state === "closed" ? "unavailable" : "blocked";
            this.onChange();
          }
        });
      }
      void this.player.play().then(
        () => {
          if (epoch !== this.epoch) return;
          this.status =
            this.context?.state !== "running" ? "blocked" : "playing";
          if (this.status === "blocked") this.player?.pause();
          this.onChange();
        },
        (error: unknown) => this.failed(epoch, error),
      );
    } catch (error) {
      this.failed(epoch, error);
    }
  }

  private failed(epoch: number, error: unknown): void {
    if (epoch !== this.epoch) return;
    this.status =
      error instanceof Error && error.name === "NotAllowedError"
        ? "blocked"
        : "unavailable";
    this.onChange();
  }
}
