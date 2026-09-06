import { isStage } from "./stage-catalog";
import {
  freshProgress,
  skinInfo,
  type Progress,
  type SkinId,
} from "./progression";
import type { StageId } from "./level-types";
import { RULESET, type Mode, type Simulation } from "./simulation";
export interface Run {
  id: string;
  ruleset: string;
  stage: StageId;
  mode: Mode;
  day: string;
  score: number;
  deposited: number;
  deliveries: number;
  distance: number;
  duration: number;
  createdAt: string;
  seed: number;
}
export interface Settings {
  stage: StageId;
  skin: SkinId;
  sound: boolean;
  music: boolean;
  musicVolume: number;
  camera: "chase" | "first-person";
  quality: "high" | "low";
  tutorialDone: boolean;
  name: string;
}
const STORAGE = "crazy-roomba-v2";
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const nonnegative = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= Number.MAX_SAFE_INTEGER;
const count = (value: unknown, fallback = 0) =>
  nonnegative(value) ? Math.floor(value) : fallback;

function readRun(value: unknown): Run | null {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    typeof value.createdAt !== "string" ||
    !nonnegative(value.score) ||
    !nonnegative(value.deposited) ||
    !nonnegative(value.distance) ||
    !nonnegative(value.duration) ||
    (value.mode !== "daily" &&
      value.mode !== "arcade" &&
      value.mode !== "freeroam")
  )
    return null;
  return {
    id: value.id,
    createdAt: value.createdAt,
    score: value.score,
    deposited: value.deposited,
    distance: value.distance,
    duration: value.duration,
    mode: value.mode,
    stage: isStage(value.stage) ? value.stage : "house",
    ruleset: typeof value.ruleset === "string" ? value.ruleset : "2.0.0",
    day: typeof value.day === "string" ? value.day : "",
    deliveries: count(value.deliveries),
    seed: count(value.seed),
  };
}

export class Storage {
  runs: Run[] = [];
  progress: Progress = freshProgress();
  settings: Settings = {
    stage: "apartment",
    skin: "taxi",
    sound: true,
    music: true,
    musicVolume: 0.35,
    camera: "chase",
    quality: "high",
    tutorialDone: false,
    name: "Dust driver",
  };
  available = true;
  constructor() {
    let raw: string | null;
    try {
      raw = localStorage.getItem(STORAGE);
    } catch {
      this.available = false;
      return;
    }
    let data: unknown;
    try {
      data = JSON.parse(raw || "{}");
    } catch {
      // Damaged saved data is not a storage-access failure. Never rewrite on read.
      return;
    }
    if (!object(data)) return;
    if (Array.isArray(data.runs))
      for (const value of data.runs) {
        const run = readRun(value);
        if (run) this.runs.push(run);
        if (this.runs.length === 100) break;
      }
    for (const run of this.runs) this.advance(run);
    const saved = data.progress;
    if (object(saved)) {
      this.progress.dust = count(saved.dust, this.progress.dust);
      this.progress.shifts = count(saved.shifts, this.progress.shifts);
      if (object(saved.best))
        for (const id of Object.keys(this.progress.best) as StageId[])
          this.progress.best[id] = count(
            saved.best[id],
            this.progress.best[id],
          );
    }
    const s = data.settings;
    if (object(s))
      this.settings = {
        stage: isStage(s.stage) ? s.stage : "apartment",
        skin: skinInfo(s.skin).id,
        sound: s.sound !== false,
        music: s.music !== false,
        musicVolume:
          typeof s.musicVolume === "number" && Number.isFinite(s.musicVolume)
            ? Math.max(0, Math.min(1, s.musicVolume))
            : 0.35,
        camera: s.camera === "first-person" ? "first-person" : "chase",
        quality: s.quality === "low" ? "low" : "high",
        tutorialDone: s.tutorialDone === true,
        name: typeof s.name === "string" ? s.name.slice(0, 20) : "Dust driver",
      };
  }
  save(): void {
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify({
          runs: this.runs,
          settings: this.settings,
          progress: this.progress,
        }),
      );
      this.available = true;
    } catch {
      this.available = false;
    }
  }
  private advance(run: Run): void {
    this.progress.dust = Math.min(
      Number.MAX_SAFE_INTEGER,
      this.progress.dust + run.deposited,
    );
    this.progress.shifts = Math.min(
      Number.MAX_SAFE_INTEGER,
      this.progress.shifts + 1,
    );
    if (run.mode === "arcade")
      this.progress.best[run.stage] = Math.max(
        this.progress.best[run.stage],
        run.score,
      );
  }
  record(sim: Simulation, day: string): Run {
    const run: Run = {
      id: crypto.randomUUID(),
      ruleset: RULESET,
      stage: sim.level.id,
      mode: sim.mode,
      day,
      score: sim.score,
      deposited: sim.deposited,
      deliveries: sim.deliveries,
      distance: Math.round(sim.distanceDriven),
      duration: Math.round(sim.ticks / 60),
      createdAt: new Date().toISOString(),
      seed: sim.seed,
    };
    if (sim.mode !== "tutorial") {
      this.advance(run);
      this.runs.unshift(run);
      this.runs = this.runs.slice(0, 100);
      this.save();
    }
    return run;
  }
}
