import * as Tone from 'tone';

export class AudioSystem {
  private musicPlayer: Tone.Player | null = null;
  private isPlaying: boolean = false;
  private volume: number = 0.5;

  // Synths for sound effects
  private pickupSynth: Tone.Synth;
  private depositSynth: Tone.PolySynth;
  private bumpSynth: Tone.NoiseSynth;
  private warningSynth: Tone.Synth;
  private gameOverSynth: Tone.PolySynth;

  private warningPlaying: boolean = false;
  private warningInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Create synths for sound effects
    this.pickupSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.05, release: 0.1 },
    }).toDestination();
    this.pickupSynth.volume.value = -10;

    this.depositSynth = new Tone.PolySynth(Tone.Synth).toDestination();
    this.depositSynth.volume.value = -8;

    this.bumpSynth = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 },
    }).toDestination();
    this.bumpSynth.volume.value = -20;

    this.warningSynth = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.05, sustain: 0.1, release: 0.05 },
    }).toDestination();
    this.warningSynth.volume.value = -15;

    this.gameOverSynth = new Tone.PolySynth(Tone.Synth).toDestination();
    this.gameOverSynth.volume.value = -8;
  }

  async startMusic(): Promise<void> {
    // Start Tone.js audio context (required for browser autoplay policy)
    await Tone.start();

    // For now, create a simple looping synthesized beat
    // In production, this would load the actual MIDI file
    if (!this.musicPlayer) {
      await this.createSynthMusic();
    }

    this.isPlaying = true;
  }

  private async createSynthMusic(): Promise<void> {
    // Create a driving beat similar to "All I Want" energy
    // This is a placeholder - real implementation would use MIDI

    const synth = new Tone.PolySynth(Tone.Synth).toDestination();
    synth.volume.value = -12;

    const bass = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.1 },
    }).toDestination();
    bass.volume.value = -10;

    const drums = new Tone.MembraneSynth().toDestination();
    drums.volume.value = -8;

    const hihat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
    }).toDestination();
    hihat.volume.value = -20;

    // Power chord progression (punk rock style)
    const chordLoop = new Tone.Loop((time) => {
      const chords = [
        ['E3', 'B3', 'E4'],
        ['E3', 'B3', 'E4'],
        ['A3', 'E4', 'A4'],
        ['D3', 'A3', 'D4'],
      ];

      const measure = Math.floor((Tone.Transport.seconds / 2) % 4);
      synth.triggerAttackRelease(chords[measure], '4n', time);
    }, '2n');

    // Bass line
    const bassLoop = new Tone.Loop((time) => {
      const notes = ['E2', 'E2', 'A2', 'D2'];
      const measure = Math.floor((Tone.Transport.seconds / 2) % 4);
      bass.triggerAttackRelease(notes[measure], '4n', time);
    }, '4n');

    // Kick drum on beats
    const kickLoop = new Tone.Loop((time) => {
      drums.triggerAttackRelease('C1', '8n', time);
    }, '4n');

    // Hi-hat on off-beats
    const hihatLoop = new Tone.Loop((time) => {
      hihat.triggerAttackRelease('16n', time);
    }, '8n');

    // Start the loops
    chordLoop.start(0);
    bassLoop.start(0);
    kickLoop.start(0);
    hihatLoop.start('8n');

    Tone.Transport.bpm.value = 160;
    Tone.Transport.start();
  }

  pauseMusic(): void {
    if (this.isPlaying) {
      Tone.Transport.pause();
      this.isPlaying = false;
    }
  }

  resumeMusic(): void {
    if (!this.isPlaying) {
      Tone.Transport.start();
      this.isPlaying = true;
    }
  }

  stopMusic(): void {
    Tone.Transport.stop();
    this.isPlaying = false;
    this.stopWarning();
  }

  playPickup(): void {
    // Quick ascending tone for dust pickup
    this.pickupSynth.triggerAttackRelease('C5', '16n');
    setTimeout(() => {
      this.pickupSynth.triggerAttackRelease('E5', '16n');
    }, 50);
  }

  playDeposit(): void {
    // Satisfying chord for deposit
    const now = Tone.now();
    this.depositSynth.triggerAttackRelease(['C4', 'E4', 'G4'], '8n', now);
    this.depositSynth.triggerAttackRelease(['C5', 'E5', 'G5'], '8n', now + 0.1);
  }

  playBump(): void {
    // Short noise burst for collision
    this.bumpSynth.triggerAttackRelease('16n');
  }

  playLowTimeWarning(): void {
    if (this.warningPlaying) return;

    this.warningPlaying = true;
    this.warningInterval = setInterval(() => {
      this.warningSynth.triggerAttackRelease('A5', '16n');
    }, 500);
  }

  stopWarning(): void {
    if (this.warningInterval) {
      clearInterval(this.warningInterval);
      this.warningInterval = null;
    }
    this.warningPlaying = false;
  }

  playGameOver(): void {
    this.stopWarning();

    // Descending sad chord
    const now = Tone.now();
    this.gameOverSynth.triggerAttackRelease(['E4', 'G4', 'B4'], '4n', now);
    this.gameOverSynth.triggerAttackRelease(['D4', 'F4', 'A4'], '4n', now + 0.3);
    this.gameOverSynth.triggerAttackRelease(['C4', 'E4', 'G4'], '2n', now + 0.6);
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    Tone.Destination.volume.value = Tone.gainToDb(this.volume);
  }

  getVolume(): number {
    return this.volume;
  }

  dispose(): void {
    this.stopMusic();
    this.pickupSynth.dispose();
    this.depositSynth.dispose();
    this.bumpSynth.dispose();
    this.warningSynth.dispose();
    this.gameOverSynth.dispose();
  }
}
