type Sound =
  | "chain-lost"
  | "pickup"
  | "deposit"
  | "bump"
  | "countdown"
  | "near-miss"
  | "end"
  | "boost"
  | "stairs"
  | "hop"
  | "land";
type Note = {
  frequency: number;
  delay?: number;
  duration?: number;
  volume?: number;
  wave?: OscillatorType;
  slideTo?: number;
};

/** Short, synthesized arcade cues; no downloads or continuous engine drone. */
export class Audio {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private sources = new Map<OscillatorNode, GainNode>();
  enabled = true;

  stop(): void {
    for (const [source, gain] of this.sources) {
      source.onended = null;
      source.stop();
      source.disconnect();
      gain.disconnect();
    }
    this.sources.clear();
  }

  unlock(): AudioContext | null {
    try {
      if (!this.context) {
        const context = new AudioContext();
        const output = context.createGain();
        output.gain.value = 0.45;
        output.connect(context.destination);
        this.context = context;
        this.output = output;
      }
      if (this.context.state === "closed") return null;
      if (this.context.state !== "running")
        void this.context.resume().catch(() => {});
      return this.context;
    } catch {
      // Audio availability must never prevent a run or a menu action.
      return null;
    }
  }

  play(kind: Sound): void {
    if (!this.enabled || this.context?.state !== "running" || !this.output)
      return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const notes: Note[] = [];
    switch (kind) {
      case "chain-lost":
        notes.push({
          frequency: 330,
          slideTo: 100,
          duration: 0.3,
          volume: 0.12,
          wave: "sawtooth",
        });
        break;
      case "hop":
        notes.push({
          frequency: 220,
          slideTo: 660,
          duration: 0.15,
          volume: 0.08,
          wave: "triangle",
        });
        break;
      case "land":
        notes.push({
          frequency: 110,
          slideTo: 45,
          duration: 0.12,
          volume: 0.12,
          wave: "triangle",
        });
        break;
      case "near-miss":
        notes.push({
          frequency: 784,
          slideTo: 1568,
          duration: 0.16,
          volume: 0.07,
        });
        break;
      case "pickup":
        notes.push(
          { frequency: 1047, duration: 0.075, volume: 0.08 },
          { frequency: 1568, delay: 0.055, duration: 0.11, volume: 0.06 },
        );
        break;
      case "deposit":
        [523, 659, 784, 1047].forEach((frequency, i) =>
          notes.push({
            frequency,
            delay: i * 0.065,
            duration: 0.16,
            volume: 0.1,
          }),
        );
        notes.push({
          frequency: 131,
          duration: 0.32,
          wave: "triangle",
          volume: 0.15,
        });
        break;
      case "bump":
        notes.push({
          frequency: 130,
          slideTo: 48,
          duration: 0.14,
          wave: "triangle",
          volume: 0.22,
        });
        break;
      case "boost":
        notes.push(
          {
            frequency: 105,
            slideTo: 630,
            duration: 0.26,
            wave: "sawtooth",
            volume: 0.07,
          },
          {
            frequency: 210,
            slideTo: 1260,
            delay: 0.03,
            duration: 0.21,
            wave: "triangle",
            volume: 0.08,
          },
        );
        break;
      case "stairs":
        [392, 523, 659, 784, 1047].forEach((frequency, i) =>
          notes.push({
            frequency,
            delay: i * 0.045,
            duration: 0.11,
            volume: 0.075,
          }),
        );
        break;
      case "end":
        [784, 659, 523, 392].forEach((frequency, i) =>
          notes.push({
            frequency,
            delay: i * 0.115,
            duration: i === 3 ? 0.3 : 0.15,
            volume: 0.09,
          }),
        );
        break;
      case "countdown":
        notes.push({ frequency: 784, duration: 0.1, volume: 0.1 });
        break;
    }
    for (const note of notes) {
      const start = now + (note.delay ?? 0);
      const duration = note.duration ?? 0.15;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.wave ?? "square";
      osc.frequency.setValueAtTime(note.frequency, start);
      if (note.slideTo)
        osc.frequency.exponentialRampToValueAtTime(
          note.slideTo,
          start + duration,
        );
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(note.volume ?? 0.08, start + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain).connect(this.output);
      this.sources.set(osc, gain);
      osc.start(start);
      osc.stop(start + duration + 0.015);
      osc.onended = () => {
        this.sources.delete(osc);
        osc.disconnect();
        gain.disconnect();
      };
    }
  }
}
