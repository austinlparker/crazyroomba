import { formatNumber as number } from "./html";
import {
  CAPACITY,
  distance,
  type Simulation,
  type GameEvent,
} from "./simulation";
import { stageInfo } from "./stage-catalog";
import { medals } from "./progression";
import { returnTarget } from "./guidance";
import { CHAIN_WINDOW } from "./driving-rewards";
import { GameAudio } from "./game-audio";
import type { Audio } from "./audio";
import type { Music } from "./music";
import type { Storage } from "./storage";
import "./play-effects.css";
import "./hud.css";
const modeNames = {
  arcade: "ARCADE",
  daily: "DAILY",
  freeroam: "FREE ROAM",
  tutorial: "TUTORIAL",
};
export class Hud {
  private tutorialStep = 0;
  private phase = "";
  private goTime = 0;
  private comboLostUntil = 0;
  private sounds: GameAudio;
  constructor(audio: Audio, music: Music, storage: Storage) {
    this.sounds = new GameAudio(audio, music, storage);
  }
  prepare() {
    return this.sounds.prepare();
  }
  reset() {
    this.tutorialStep = 0;
    this.phase = "";
    this.goTime = 0;
    this.comboLostUntil = 0;
    document.getElementById("haul-meter")!.className = "haul-meter";
    this.sounds.reset();
    this.countdown(4.5);
  }
  stopAudio() {
    this.sounds.stop();
  }
  syncAudio() {
    this.sounds.sync();
  }
  end(s: Simulation) {
    this.sounds.end(s);
  }
  countdown(seconds: number) {
    const phase =
      seconds > 3 ? "ready" : seconds > 0 ? String(Math.ceil(seconds)) : "go";
    if (phase === this.phase) return;
    this.phase = phase;
    const el = document.getElementById("countdown")!;
    el.className = `countdown ${phase === "go" ? "launch" : ""}`;
    el.innerHTML = `<i></i><strong>${phase === "ready" ? "READY?" : phase === "go" ? "GO!" : phase}</strong>`;
    if (phase === "go") this.goTime = 0.7;
    this.sounds.countdown(phase);
  }
  advance(dt: number, s: Simulation) {
    this.sounds.update(s);
    if (this.goTime > 0 && (this.goTime -= dt) <= 0)
      document.getElementById("countdown")!.classList.add("hidden");
  }
  event(event: GameEvent, s: Simulation) {
    this.sounds.event(event, s);
    const haul = document.getElementById("haul-meter")!;
    if (event.kind === "chain-lost") {
      this.comboLostUntil = s.ticks + 150;
    } else if (event.kind === "deposit" && event.chain) {
      this.comboLostUntil = 0;
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
        haul.animate([{ scale: "1.04" }, { scale: "1" }], { duration: 220 });
    }
  }

  update(s: Simulation, camera: string, ranked: boolean): void {
    const touch = matchMedia("(pointer: coarse), (max-width: 600px)").matches;
    const pad = navigator.getGamepads?.()?.some((p) => p?.connected);
    document.body.dataset.camera = camera;
    document.body.dataset.help = String(s.mode === "tutorial" || s.ticks < 720);
    document.body.dataset.boosting = String(s.boosting);
    document
      .querySelector('[data-action="camera"]')
      ?.setAttribute(
        "aria-label",
        camera === "chase"
          ? "Switch to first person"
          : "Switch to chase camera",
      );
    const score = document.getElementById("score")!;
    const scoreText = number(s.score);
    score.textContent = scoreText;
    score.style.setProperty(
      "--score-digits",
      String(Math.max(5, scoreText.length)),
    );
    const target = stageInfo(s.level.id).target,
      stars = medals(s.score, target),
      goal = target * Math.min(3, stars + 1);
    document.getElementById("score-goal")!.textContent =
      s.mode === "arcade"
        ? stars === 3
          ? "★★★"
          : `/ ${number(goal)} · ${"★".repeat(stars + 1)}`
        : "";
    document
      .querySelector(".score-goal-track")!
      .classList.toggle("hidden", s.mode !== "arcade");
    document.getElementById("score-goal-fill")!.style.width =
      `${s.mode === "arcade" ? Math.min(100, (s.score / goal) * 100) : 0}%`;
    document.getElementById("hud-mode")!.textContent =
      modeNames[s.mode].toUpperCase() +
      (s.mode === "daily" && !ranked ? " · PRACTICE" : "");
    const remaining = Number.isFinite(s.remaining)
      ? Math.max(0, s.remaining / 60)
      : Infinity;
    document.getElementById("timer")!.textContent =
      remaining === Infinity ? "∞" : remaining.toFixed(1);
    document
      .querySelector(".timer-card")!
      .classList.toggle("urgent", remaining < 15);
    document
      .querySelector(".timer-card")!
      .classList.toggle("hidden", remaining === Infinity);
    document.getElementById("timer-label")!.textContent = "TIME";
    const full = s.bin.length === CAPACITY;
    const lost = this.comboLostUntil > s.ticks;
    const active = !lost && s.chain.count > 0;
    const left = active
      ? Math.max(0, (s.chain.expires - s.ticks) / CHAIN_WINDOW)
      : 0;
    const haul = document.getElementById("haul-meter")!;
    haul.classList.toggle("full", full);
    haul.classList.toggle("chained", active);
    haul.classList.toggle("urgent", active && left < 0.2);
    haul.classList.toggle("lost", lost);
    document.getElementById("cargo-label")!.textContent = full
      ? "CASH IT IN!"
      : "DUST BIN";
    document.getElementById("cargo-count")!.textContent =
      `${s.bin.length} / ${CAPACITY}`;
    document
      .querySelectorAll("#cargo-slots i")
      .forEach((el, i) => el.classList.toggle("filled", i < s.bin.length));
    document.getElementById("combo-label")!.textContent = lost
      ? "COMBO LOST"
      : active
        ? "COMBO"
        : "FULL BIN";
    document.getElementById("combo-value")!.textContent = lost
      ? "—"
      : `${active ? 2 * s.chain.multiplier : 2}×`;
    document.getElementById("combo-fill")!.style.transform = `scaleX(${left})`;
    const meter = document.getElementById("combo-meter")!;
    meter.classList.toggle("hidden", !active);
    meter.setAttribute(
      "aria-valuenow",
      String(Math.ceil((left * CHAIN_WINDOW) / 60)),
    );
    haul.setAttribute(
      "aria-label",
      `Dust bin ${s.bin.length} of ${CAPACITY}. ${lost ? "Combo lost." : active ? `${2 * s.chain.multiplier} times combo, ${Math.ceil((left * CHAIN_WINDOW) / 60)} seconds left.` : "Full bin earns double points."}`,
    );
    document.getElementById("touch-boost-fill")!.style.strokeDashoffset =
      String(100 - s.boost);
    document
      .querySelector("[data-control='boost']")!
      .setAttribute("aria-label", `Boost, ${Math.round(s.boost)}% energy`);
    document.getElementById("boost-fill")!.style.width = `${s.boost}%`;
    document.getElementById("speed")!.textContent = String(
      Math.round(Math.hypot(s.vx, s.vz) * 3.6),
    );
    document.getElementById("boost-label")!.textContent = !s.grounded
      ? "AIRBORNE"
      : s.stairBlocked
        ? "BOOST ↑"
        : s.boosting
          ? "TURBO"
          : s.drifting
            ? "DRIFT"
            : s.boost < 20
              ? "RECHARGING"
              : touch
                ? "BOOST"
                : pad
                  ? "A · BOOST"
                  : "SHIFT · BOOST";
    const objective = document.getElementById("objective")!;
    const arrow = document.getElementById("dock-arrow")!;
    const destination = returnTarget(s);
    arrow.classList.toggle("hidden", s.bin.length === 0 || s.stairBlocked);
    arrow.style.transform = `rotate(${-90 - ((Math.atan2(destination.x - s.x, destination.z - s.z) - s.angle) * 180) / Math.PI}deg)`;
    const route = s.stairBlocked
      ? "Boost to climb"
      : s.bin.length === 0
        ? ""
        : s.floor === 1 || !!s.ramp
          ? s.level.id === "moon"
            ? "Ramp to dock"
            : "Stairs to dock"
          : `Dock · ${Math.round(distance(s, s.level.DOCK))} m`;
    document.getElementById("objective-text")!.textContent = route;
    objective.classList.toggle("hidden", !route);
    if (s.mode === "tutorial") {
      if (s.distanceDriven > 1.2)
        this.tutorialStep = Math.max(1, this.tutorialStep);
      if (s.boostTicks > 15 && this.tutorialStep >= 1)
        this.tutorialStep = Math.max(2, this.tutorialStep);
      if (s.bin.length > 0 && this.tutorialStep >= 2) this.tutorialStep = 3;
      const steps = [
        [
          "DRIVE",
          touch
            ? "Drag the stick to drive."
            : pad
              ? "Use the left stick to drive."
              : "W / S drive · A / D steer",
        ],
        [
          "BOOST",
          touch
            ? "Hold BOOST."
            : pad
              ? "Hold A to boost."
              : "Hold SHIFT to boost.",
        ],
        ["COLLECT", "Drive over dust."],
        ["DELIVER", "Drive into the green dock to score."],
      ];
      document.getElementById("tutorial-card")!.innerHTML =
        `<strong>${steps[this.tutorialStep][0]}</strong><p>${steps[this.tutorialStep][1]}</p>`;
    }
  }
}
