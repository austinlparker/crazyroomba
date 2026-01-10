import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';

export class AudioSystem {
  private isPlaying: boolean = false;
  private volume: number = 0.5;
  private midiLoaded: boolean = false;
  private midiSynths: Tone.PolySynth[] = [];
  private scheduledEvents: number[] = [];

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

    if (!this.midiLoaded) {
      await this.loadMidi();
    }

    Tone.Transport.start();
    this.isPlaying = true;
  }

  private async loadMidi(): Promise<void> {
    try {
      // Fetch the MIDI file (use base URL for GitHub Pages compatibility)
      const baseUrl = import.meta.env.BASE_URL || '/';
      const response = await fetch(`${baseUrl}music.mid`);
      const arrayBuffer = await response.arrayBuffer();
      const midi = new Midi(arrayBuffer);

      console.log('MIDI loaded:', midi.name, 'Tracks:', midi.tracks.length);

      // Set tempo from MIDI
      if (midi.header.tempos.length > 0) {
        Tone.Transport.bpm.value = midi.header.tempos[0].bpm;
      }

      // Create a synth for each track with notes
      midi.tracks.forEach((track, index) => {
        if (track.notes.length === 0) return;

        // Use different synth types for variety
        const synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: index % 2 === 0 ? 'sawtooth' : 'square' },
          envelope: {
            attack: 0.02,
            decay: 0.1,
            sustain: 0.3,
            release: 0.2,
          },
        }).toDestination();

        // Adjust volume per track (lower for background tracks)
        synth.volume.value = -12 - (index * 2);
        this.midiSynths.push(synth);

        // Schedule all notes for this track
        track.notes.forEach((note) => {
          const eventId = Tone.Transport.schedule((time) => {
            synth.triggerAttackRelease(
              note.name,
              note.duration,
              time,
              note.velocity
            );
          }, note.time);
          this.scheduledEvents.push(eventId);
        });
      });

      // Set up looping - get the total duration
      const duration = midi.duration;
      Tone.Transport.loop = true;
      Tone.Transport.loopStart = 0;
      Tone.Transport.loopEnd = duration;

      this.midiLoaded = true;
      console.log('MIDI scheduled, duration:', duration, 'seconds');
    } catch (error) {
      console.error('Failed to load MIDI:', error);
      // Fallback to synth music
      await this.createFallbackMusic();
    }
  }

  private async createFallbackMusic(): Promise<void> {
    // Simple fallback beat if MIDI fails to load
    const synth = new Tone.PolySynth(Tone.Synth).toDestination();
    synth.volume.value = -12;
    this.midiSynths.push(synth);

    const bass = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.1 },
    }).toDestination();
    bass.volume.value = -10;

    const drums = new Tone.MembraneSynth().toDestination();
    drums.volume.value = -8;

    // Power chord progression
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

    const bassLoop = new Tone.Loop((time) => {
      const notes = ['E2', 'E2', 'A2', 'D2'];
      const measure = Math.floor((Tone.Transport.seconds / 2) % 4);
      bass.triggerAttackRelease(notes[measure], '4n', time);
    }, '4n');

    const kickLoop = new Tone.Loop((time) => {
      drums.triggerAttackRelease('C1', '8n', time);
    }, '4n');

    chordLoop.start(0);
    bassLoop.start(0);
    kickLoop.start(0);

    Tone.Transport.bpm.value = 160;
    this.midiLoaded = true;
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
    Tone.Transport.position = 0;
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

    // Clear scheduled events
    this.scheduledEvents.forEach((id) => Tone.Transport.clear(id));
    this.scheduledEvents = [];

    // Dispose synths
    this.midiSynths.forEach((synth) => synth.dispose());
    this.midiSynths = [];

    this.pickupSynth.dispose();
    this.depositSynth.dispose();
    this.bumpSynth.dispose();
    this.warningSynth.dispose();
    this.gameOverSynth.dispose();
  }
}
