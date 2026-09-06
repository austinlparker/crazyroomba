import { escapeHtml as escape, formatNumber as number } from "./html";
import { appShell, icons } from "./app-shell";
import { GameRenderer } from "./renderer";
import { Input } from "./input";
import { Audio } from "./audio";
import { Music } from "./music";
import { watchUtcDay } from "./daily-clock";
import {
  Simulation,
  STEP,
  appendReplay,
  seedForDay,
  utcDay,
  type Mode,
  type Replay,
} from "./simulation";
import { type StageId } from "./level-types";
import type { Hud } from "./hud";
import type { Level } from "./navigation";
import type { StageVisual } from "./stages/visual-types";
import { STAGES, stageInfo, dailyStage } from "./stage-catalog";
import { loadLevel } from "./stages/load-data";
import { loadWorld } from "./stages/load-world";
import { clearModelCache } from "./models";
import type { SkinViewer } from "./skin-viewer";
import {
  SKINS,
  skinInfo,
  unlockedStage,
  medals,
  skinProgress,
  type SkinId,
} from "./progression";
import { Storage, type Run } from "./storage";
import {
  startDaily,
  submitDaily,
  getAccount,
  ApiError,
  type Ticket,
  type AccountProfile,
} from "./api";
import { accountBadge, accountHandle } from "./account-display";
import type { Identity } from "./identity";
import "./style.css";
export class App {
  readonly storage = new Storage();
  readonly audio = new Audio();
  readonly music = new Music(() => this.audio.unlock());
  readonly view: GameRenderer;
  readonly input: Input;
  sim: Simulation;
  selectedStage: StageId;
  private loadingStage = false;
  private stageEpoch = 0;
  state: "menu" | "countdown" | "playing" | "paused" | "results" = "menu";
  selected: Mode = "arcade";
  private replay: Replay = [];
  private ticket: Ticket | null = null;
  private day = utcDay();
  private run: Run | null = null;
  private countdown = 4.5;
  private hudView: Hud | null = null;
  private accum = 0;
  private last = 0;
  private lastUiUpdate = 0;
  private hudClock = 0;
  private toastTimer = 0;
  private startEpoch = 0;
  private starting = false;
  private identity: Identity | null = null;
  private accountPromise: Promise<Identity> | null = null;
  private accountProfile: AccountProfile | null = null;
  private verifiedAccount = false;
  private sessionReady: Promise<void>;
  private submitted = false;
  private dailySubmission: { id: string; promise: Promise<void> } | null = null;
  private dialogCleanup: (() => void) | null = null;
  private dialogFocus: HTMLElement | null = null;
  private skinViewer: SkinViewer | null = null;
  private skinEpoch = 0;
  private dialogEpoch = 0;
  private previewSkin: SkinId = "taxi";
  private lastDraw = 0;
  private earnedSkins: SkinId[] = [];
  private personalBest = false;
  private root = document.getElementById("app")!;
  private modal = document.getElementById("modal")!;
  private hud: HTMLElement;
  constructor(canvas: HTMLCanvasElement, level: Level, visual: StageVisual) {
    this.selectedStage = level.id;
    this.sim = new Simulation("freeroam", seedForDay(utcDay()), level);
    this.view = new GameRenderer(canvas, level, visual);
    const skin = skinInfo(this.storage.settings.skin);
    if (!skin.unlocked(this.storage.progress))
      this.storage.settings.skin = "taxi";
    this.view.skin(skin.unlocked(this.storage.progress) ? skin.id : "taxi");
    this.view.quality(this.storage.settings.quality === "low");
    this.audio.enabled = this.storage.settings.sound;
    this.music.configure(
      this.storage.settings.music,
      this.storage.settings.musicVolume,
    );
    this.music.onChange = () => this.updateRadio();
    this.view.setCamera(this.storage.settings.camera);
    this.input = new Input(
      () => this.pause(),
      () => this.toggleCamera(),
    );
    this.root.innerHTML = appShell();
    document.body.appendChild(document.getElementById("toast")!);
    this.hud = document.getElementById("hud")!;
    this.input.bindTouch(this.root);
    document.addEventListener("click", (e) => {
      const el = (e.target as Element).closest<HTMLElement>(
        "[data-action],[data-mode]",
      );
      if (!el || (el instanceof HTMLButtonElement && el.disabled)) return;
      if (el.dataset.mode) this.select(el.dataset.mode as Mode);
      if (el.dataset.action) void this.action(el.dataset.action, el);
    });
    document.addEventListener("input", (e) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement) || el.id !== "music-volume") return;
      this.storage.settings.musicVolume = el.valueAsNumber / 100;
      this.music.configure(
        this.storage.settings.music,
        this.storage.settings.musicVolume,
      );
      this.hudView?.syncAudio();
      this.storage.save();
      this.updateRadio();
    });
    document.addEventListener(
      "error",
      (e) => {
        if (
          e.target instanceof HTMLImageElement &&
          e.target.closest(".account-avatar")
        )
          e.target.hidden = true;
      },
      true,
    );
    document.addEventListener("pointerup", this.menuMusic);
    document.addEventListener("keydown", this.menuMusic);
    window.addEventListener("focus", this.menuMusic);
    window.addEventListener("resize", () => this.view.resize());
    window.addEventListener("blur", () => {
      this.cancelStart();
      this.music.pause();
      this.hudView?.stopAudio();
      if (this.state === "playing" || this.state === "countdown") this.pause();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.cancelStart();
      if (document.hidden) this.music.pause();
      else this.menuMusic();
      if (
        document.hidden &&
        (this.state === "playing" || this.state === "countdown")
      )
        this.pause();
    });
    document.addEventListener("keydown", (e) => {
      if (
        this.state === "menu" &&
        this.modal.classList.contains("hidden") &&
        !e.repeat &&
        (e.code === "ArrowLeft" || e.code === "ArrowRight")
      ) {
        e.preventDefault();
        void this.action(
          e.code === "ArrowLeft" ? "stage-prev" : "stage-next",
          this.root,
        );
      }
      if (e.key === "Tab" && !this.modal.classList.contains("hidden")) {
        const focusable = Array.from(
          this.modal.querySelectorAll<HTMLElement>(
            "button,input,a[href],select,textarea,summary,[tabindex]",
          ),
        ).filter(
          (el) =>
            !el.matches(":disabled") &&
            el.tabIndex >= 0 &&
            el.getClientRects().length > 0 &&
            getComputedStyle(el).visibility !== "hidden",
        );
        const first = focusable[0],
          last = focusable.at(-1);
        if (!focusable.includes(document.activeElement as HTMLElement)) {
          e.preventDefault();
          (e.shiftKey ? last : first)?.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    });
    this.updateSoundButton();
    this.updateRadio();
    this.updateStageUI();
    watchUtcDay(() => this.refreshDaily());
    this.menuMusic();
    requestAnimationFrame((t) => this.frame(t));
    this.sessionReady = this.restoreAccount(
      /[?&#](code|error)=/.test(location.hash + location.search),
    );
  }
  private menuMusic = (event?: Event): void => {
    if (
      this.state !== "menu" ||
      this.starting ||
      document.hidden ||
      !document.hasFocus() ||
      !this.modal.classList.contains("hidden") ||
      (event?.target instanceof Element &&
        event.target.closest(
          '[data-action="music"], [data-action="start"], [data-action="tutorial"]',
        ))
    )
      return;
    this.music.startMenu();
  };

  private toggleCamera(): void {
    const mode = this.view.cameraMode === "chase" ? "first-person" : "chase";
    this.view.setCamera(mode);
    this.storage.settings.camera = mode;
    this.storage.save();
    this.toast(mode === "first-person" ? "FIRST PERSON" : "CHASE CAM");
    const button = this.modal.querySelector("[data-action='camera']");
    if (button)
      button.textContent = mode === "chase" ? "Chase" : "First person";
    this.updateHUD();
  }
  private select(mode: Mode): void {
    this.cancelStart();
    this.selected = mode;
    document.querySelectorAll<HTMLElement>("[data-mode]").forEach((b) => {
      b.classList.toggle("selected", b.dataset.mode === mode);
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    });
    document.getElementById("mode-description")!.textContent =
      mode === "daily"
        ? `90 seconds · ${this.verifiedAccount ? "Ranked" : "Sign in to rank"}`
        : mode === "freeroam"
          ? "No timer"
          : "60s + time bonuses";
    this.refreshDaily();
    this.updateStageUI();
  }
  private refreshDaily(): void {
    if (
      this.state !== "menu" ||
      this.starting ||
      this.selected !== "daily" ||
      !this.modal.classList.contains("hidden")
    )
      return;
    const stage = dailyStage(utcDay());
    if (
      this.selectedStage !== stage ||
      (!this.loadingStage && this.sim.level.id !== stage)
    )
      void this.setStage(stage);
  }
  private updateStageUI(): void {
    const stage = stageInfo(this.selectedStage),
      stars = medals(this.storage.progress.best[stage.id], stage.target),
      index = STAGES.findIndex((s) => s.id === stage.id);
    const open =
      this.selected !== "arcade" ||
      unlockedStage(stage.id, this.storage.progress);
    document.getElementById("stage-title")!.textContent = stage.name;
    document.getElementById("stage-status")!.textContent = this.loadingStage
      ? "Loading…"
      : this.selected === "daily"
        ? "Resets at 00:00 UTC"
        : !open
          ? `${number(STAGES[index - 1].target)} in ${STAGES[index - 1].name}`
          : this.selected === "freeroam"
            ? ""
            : `${this.storage.progress.best[stage.id] ? `Best ${number(this.storage.progress.best[stage.id])} · ` : ""}${stars < 3 ? `${"★".repeat(stars + 1)} ${number(stage.target * (stars + 1))}` : "★★★"}`;
    document.getElementById("stage-dots")!.innerHTML = STAGES.map(
      (s) => `<span class="${s.id === stage.id ? "selected" : ""}">●</span>`,
    ).join("");
    const start = this.root.querySelector<HTMLButtonElement>(".start-button")!;
    start.disabled = this.starting || this.loadingStage || !open;
    start.querySelector("span")!.textContent =
      this.starting || this.loadingStage
        ? "LOADING"
        : open
          ? this.selected === "daily" && !this.verifiedAccount
            ? "PRACTICE"
            : "PLAY"
          : "LOCKED";
    this.root
      .querySelector(".stage-select")!
      .setAttribute("aria-busy", String(this.loadingStage));
  }
  private async setStage(id: StageId): Promise<void> {
    const epoch = ++this.stageEpoch;
    this.selectedStage = id;
    this.loadingStage = true;
    this.updateStageUI();
    try {
      const [level, build] = await Promise.all([loadLevel(id), loadWorld(id)]);
      if (epoch !== this.stageEpoch) return;
      clearModelCache();
      const visual = build();
      clearModelCache();
      this.view.setStage(level, visual);
      this.sim = new Simulation("freeroam", seedForDay(utcDay()), level);
      this.storage.settings.stage = id;
      this.storage.save();
    } catch {
      if (epoch === this.stageEpoch) {
        this.selectedStage = this.sim.level.id;
        this.toast("Stage could not load. Try again.");
      }
    } finally {
      if (epoch === this.stageEpoch) {
        this.loadingStage = false;
        this.updateStageUI();
      }
    }
  }
  private skins(): void {
    this.previewSkin = this.storage.settings.skin;
    this.dialog(
      "SKINS",
      "",
      `<div class="skin-preview"><canvas id="skin-preview" aria-label="Rotating preview of selected Roomba skin"></canvas></div><button id="equip-skin" class="primary wide" data-action="skin-select"></button><div class="skin-grid">${SKINS.map((s) => `<button class="skin-card" data-action="skin-preview" data-skin="${s.id}" aria-label="Preview ${s.name}" aria-pressed="false"><div class="skin-swatch" style="background:${s.color};border-color:${s.accent}"><span style="color:${s.accent}">${icons.robot}</span></div><strong class="skin-name">${s.name}</strong><span class="skin-requirement">${s.unlocked(this.storage.progress) ? "Unlocked" : s.requirement}</span><span class="skin-progress" aria-hidden="true"><i style="width:${skinProgress(s.id, this.storage.progress) * 100}%"></i></span></button>`).join("")}</div>`,
    );
    this.updateSkinPreview();
    const epoch = this.skinEpoch,
      canvas = document.getElementById("skin-preview") as HTMLCanvasElement;
    void import("./skin-viewer")
      .then(({ SkinViewer }) => {
        if (epoch !== this.skinEpoch || !canvas.isConnected) return;
        this.skinViewer = new SkinViewer(canvas, this.previewSkin);
      })
      .catch(() => {
        if (canvas.isConnected)
          canvas.replaceWith(
            Object.assign(document.createElement("p"), {
              className: "muted",
              textContent: "3D preview unavailable",
            }),
          );
      });
  }
  private updateSkinPreview(): void {
    const s = skinInfo(this.previewSkin),
      b = document.getElementById("equip-skin") as HTMLButtonElement;
    const equipped = s.id === this.storage.settings.skin,
      open = s.unlocked(this.storage.progress);
    this.skinViewer?.setSkin(s.id);
    b.dataset.skin = s.id;
    b.disabled = equipped || !open;
    b.textContent = equipped
      ? `${s.name} · Equipped`
      : open
        ? `EQUIP ${s.name}`
        : s.requirement;
    for (const el of this.modal.querySelectorAll<HTMLElement>(
      '[data-action="skin-preview"]',
    )) {
      const selected = el.dataset.skin === s.id;
      el.classList.toggle("selected", selected);
      el.setAttribute("aria-pressed", String(selected));
    }
  }
  private async action(action: string, button: HTMLElement): Promise<void> {
    this.audio.unlock();
    try {
      switch (action) {
        case "stage-prev":
        case "stage-next": {
          const direction = action === "stage-next" ? 1 : -1;
          this.select("arcade");
          this.view.rotatePreview(direction);
          const index = STAGES.findIndex((s) => s.id === this.selectedStage);
          await this.setStage(
            STAGES[(index + direction + STAGES.length) % STAGES.length].id,
          );
          break;
        }
        case "skins":
          this.skins();
          break;
        case "skin-preview":
          this.previewSkin = skinInfo(button.dataset.skin).id;
          this.updateSkinPreview();
          break;
        case "skin-select": {
          const skin = skinInfo(button.dataset.skin);
          if (!skin.unlocked(this.storage.progress)) return;
          this.storage.settings.skin = skin.id;
          this.storage.save();
          this.view.skin(skin.id);
          this.updateSkinPreview();
          break;
        }
        case "next-stage": {
          this.home();
          this.select("arcade");
          const index = STAGES.findIndex((s) => s.id === this.sim.level.id);
          await this.setStage(
            STAGES[Math.min(index + 1, STAGES.length - 1)].id,
          );
          break;
        }
        case "home":
          this.home();
          break;
        case "start":
          await this.start(this.selected);
          break;
        case "daily":
          this.select("daily");
          break;
        case "tutorial":
          await this.start("tutorial");
          break;
        case "pause":
          this.pause();
          break;
        case "resume":
          this.resume();
          break;
        case "restart":
          await this.start(this.sim.mode);
          break;
        case "finish":
          this.closeDialog();
          this.finish();
          break;
        case "camera":
          this.toggleCamera();
          break;
        case "close":
          if (this.state === "results") this.finish();
          else this.closeDialog();
          break;
        case "board":
          await this.board();
          break;
        case "profile":
          await this.profile();
          break;
        case "account":
          await this.accountDialog();
          break;
        case "signup-info":
          await this.accountDialog(true);
          break;
        case "signup":
          await this.busy(button, async () => {
            const identity = await this.account();
            await this.keepDailyForLogin();
            await identity.signup();
          });
          break;
        case "settings":
          await this.settings();
          break;
        case "sound":
          this.storage.settings.sound = !this.storage.settings.sound;
          this.audio.enabled = this.storage.settings.sound;
          this.hudView?.syncAudio();
          this.storage.save();
          this.updateSoundButton();
          this.toast(this.audio.enabled ? "Sound on" : "Sound off");
          break;
        case "music":
          this.storage.settings.music = !this.storage.settings.music;
          this.music.configure(
            this.storage.settings.music,
            this.storage.settings.musicVolume,
          );
          this.hudView?.syncAudio();
          this.storage.save();
          this.updateRadio();
          break;
        case "music-next":
          this.music.next();
          break;
        case "music-preview":
          if (this.music.status === "playing") this.music.pause();
          else {
            this.storage.settings.music = true;
            this.music.configure(true, this.storage.settings.musicVolume);
            this.storage.save();
            this.music.start();
          }
          this.updateRadio();
          break;
        case "quality":
          this.storage.settings.quality =
            this.storage.settings.quality === "high" ? "low" : "high";
          this.view.quality(this.storage.settings.quality === "low");
          this.storage.save();
          await this.settings();
          break;
        case "login": {
          const handle =
            this.modal.querySelector<HTMLInputElement>("#handle")!.value;
          await this.busy(button, async () => {
            const identity = await this.account();
            await this.keepDailyForLogin();
            await identity.login(handle);
          });
          break;
        }
        case "reconnect":
          await this.busy(button, async () => {
            const identity = await this.account();
            await this.keepDailyForLogin();
            await identity.login(identity.session?.sub || identity.handle);
          });
          break;
        case "logout":
          await this.busy(button, async () => {
            try {
              await this.identity?.logout();
            } finally {
              await this.accountDialog();
            }
          });
          break;
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        this.identity?.invalidate();
        this.verifiedAccount = false;
        this.updateAccountButton();
        if (this.state === "results") this.finish();
      }
      this.toast(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    }
  }
  private async busy(
    button: HTMLElement,
    fn: () => Promise<void>,
  ): Promise<void> {
    const b = button as HTMLButtonElement;
    b.disabled = true;
    const text = b.textContent;
    b.textContent = "Loading…";
    try {
      await fn();
    } finally {
      if (b.textContent === "Loading…") b.textContent = text;
      b.disabled = false;
    }
  }
  private async start(mode: Mode): Promise<void> {
    if (this.loadingStage || this.starting) return;
    if (
      mode === "arcade" &&
      !unlockedStage(this.selectedStage, this.storage.progress)
    ) {
      this.toast("Reach the previous stage’s score target, or try Free roam.");
      return;
    }
    const intendedStage = this.selectedStage;
    this.home(false);
    const epoch = ++this.startEpoch;
    this.starting = true;
    this.updateStageUI();
    try {
      this.input.clear();
      this.audio.unlock();
      this.music.startShift();
      const { Hud } = await import("./hud");
      if (epoch !== this.startEpoch) return;
      this.hudView ??= new Hud(this.audio, this.music, this.storage);
      await this.hudView.prepare();
      if (epoch !== this.startEpoch) return;
      this.ticket = null;
      this.day = utcDay();
      let seed =
        mode === "daily"
          ? seedForDay(this.day)
          : crypto.getRandomValues(new Uint32Array(1))[0];
      if (mode === "daily") {
        await this.sessionReady;
        if (epoch !== this.startEpoch) return;
        if (this.verifiedAccount)
          try {
            this.toast("Loading daily…");
            let ticket: Ticket;
            try {
              ticket = await startDaily();
            } catch (error) {
              if (!(error instanceof ApiError) || error.status !== 401)
                throw error;
              const identity = await this.account();
              identity.invalidate();
              await identity.ensureSession();
              ticket = await startDaily();
            }
            if (epoch !== this.startEpoch) return;
            this.ticket = ticket;
            this.day = ticket.day;
            seed = ticket.seed;
          } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
              this.identity?.invalidate();
              this.verifiedAccount = false;
              this.updateAccountButton();
            }
            this.toast("Practice · Sign in to rank");
          }
        else this.toast("Practice · Sign in to rank");
      }
      if (epoch !== this.startEpoch) return;
      // A slow session/stage download can cross midnight. Practice follows the
      // current day; ranked runs retain the server-issued ticket's day and seed.
      let stage: StageId;
      do {
        if (mode === "daily" && !this.ticket) {
          this.day = utcDay();
          seed = seedForDay(this.day);
        }
        stage =
          mode === "tutorial"
            ? "apartment"
            : mode === "daily"
              ? dailyStage(this.day)
              : intendedStage;
        if (this.sim.level.id !== stage) await this.setStage(stage);
        if (epoch !== this.startEpoch || this.sim.level.id !== stage) return;
      } while (mode === "daily" && !this.ticket && this.day !== utcDay());
      this.sim = new Simulation(mode, seed, this.sim.level);
      this.view.setCamera(this.storage.settings.camera);
      this.replay = [];
      this.run = null;
      this.earnedSkins = [];
      this.personalBest = false;
      this.submitted = false;
      this.accum = 0;
      this.countdown = 4.5;
      this.lastUiUpdate = performance.now();
      this.state = "countdown";
      this.hudView.reset();
      this.input.enabled = false;
      document.body.classList.add("in-game");
      this.hud.classList.remove("hidden");
      document.getElementById("countdown")!.classList.remove("hidden");
      document
        .getElementById("tutorial-card")!
        .classList.toggle("hidden", mode !== "tutorial");
      this.updateHUD();
    } finally {
      if (epoch === this.startEpoch) {
        this.starting = false;
        this.updateStageUI();
        this.menuMusic();
      }
    }
  }
  private cancelStart(): void {
    if (!this.starting) return;
    ++this.startEpoch;
    this.starting = false;
    this.music.pause();
    this.hudView?.stopAudio();
    this.updateStageUI();
    this.menuMusic();
  }
  private home(restoreMusic = true): void {
    this.cancelStart();
    ++this.startEpoch;
    this.state = "menu";
    this.music.pause();
    this.hudView?.stopAudio();
    this.input.enabled = false;
    this.input.clear();
    this.closeDialog(false);
    document.body.classList.remove("in-game");
    this.hud.classList.add("hidden");
    document.getElementById("countdown")!.classList.add("hidden");
    this.updateStageUI();
    if (restoreMusic) {
      this.refreshDaily();
      this.menuMusic();
    }
  }
  private pause(): void {
    if (!this.modal.classList.contains("hidden") && this.state !== "paused") {
      if (this.state === "results") this.finish();
      else this.closeDialog();
      return;
    }
    if (this.state === "paused") {
      this.resume();
      return;
    }
    if (this.state !== "playing" && this.state !== "countdown") return;
    this.state = "paused";
    this.music.pause();
    this.hudView?.stopAudio();
    this.input.enabled = false;
    this.input.clear();
    document.getElementById("countdown")!.classList.add("hidden");
    this.dialog(
      "PAUSED",
      "",
      `<button class="primary" data-action="resume">RESUME ${icons.arrow}</button><div class="button-row"><button class="secondary" data-action="restart">Restart</button><button class="secondary" data-action="finish">End run</button></div><div class="setting-row pause-camera"><span>Camera</span><button class="secondary" data-action="camera" aria-label="Camera view">${this.view.cameraMode === "chase" ? "Chase" : "First person"}</button></div><div id="pause-radio"></div>`,
      false,
    );
    const epoch = this.dialogEpoch;
    void import("./garage-panels")
      .then(({ radioPanel }) => {
        if (this.dialogEpoch !== epoch) return;
        this.modal.querySelector("#pause-radio")!.innerHTML = radioPanel(
          this.storage.settings,
          this.music.track,
        );
        this.updateRadio();
      })
      .catch(() => {});
  }

  private resume(): void {
    this.closeDialog();
    this.state = this.countdown > 0 ? "countdown" : "playing";
    this.music.start();
    this.input.enabled = this.state === "playing";
    this.accum = 0;
    this.lastUiUpdate = performance.now();
    document
      .getElementById("countdown")!
      .classList.toggle("hidden", this.state !== "countdown");
  }
  private finish(): void {
    const firstFinish = this.state !== "results";
    this.state = "results";
    this.music.pause();
    this.hudView?.stopAudio();
    this.input.enabled = false;
    this.input.clear();
    document.getElementById("countdown")!.classList.add("hidden");
    if (firstFinish) this.hudView?.end(this.sim);
    if (this.sim.mode === "tutorial") {
      const completed = this.sim.deposited > 0;
      this.storage.settings.tutorialDone =
        completed || this.storage.settings.tutorialDone;
      this.storage.save();
      this.dialog(
        completed ? "YOU’RE HIRED." : "SHIFT PRACTICE.",
        completed
          ? "Full bins earn double points at the dock."
          : "Collect dust, then return to the green dock.",
        `<button class="primary" data-action="start">PLAY ARCADE ${icons.arrow}</button><button class="secondary wide" data-action="home">Home</button>`,
        false,
      );
      this.select("arcade");
      return;
    }
    const beforeBest = this.storage.progress.best[this.sim.level.id];
    const firstResult = !this.run;
    const beforeUnlocks = new Set(
      SKINS.filter((s) => s.unlocked(this.storage.progress)).map((s) => s.id),
    );
    this.run ??= this.storage.record(this.sim, this.day);
    const earned = SKINS.filter(
      (s) => s.unlocked(this.storage.progress) && !beforeUnlocks.has(s.id),
    );
    if (firstResult) this.earnedSkins = earned.map((s) => s.id);
    const stageIndex = STAGES.findIndex((s) => s.id === this.sim.level.id),
      next = STAGES[stageIndex + 1];
    const cleared =
      this.sim.mode === "arcade" &&
      this.sim.score >= stageInfo(this.sim.level.id).target;
    const rewards = `${cleared ? `<p class="unlock-banner">${next ? `${next.name} unlocked!` : "Moon cleared!"}</p>` : ""}${this.earnedSkins
      .map((id) => skinInfo(id))
      .map((s) => `<p class="unlock-banner">${s.name} unlocked!</p>`)
      .join(
        "",
      )}${next && cleared ? '<button class="primary wide" data-action="next-stage">NEXT STAGE →</button>' : ""}`;
    const previous = this.storage.runs.filter(
      (r) =>
        r.id !== this.run!.id &&
        r.mode === this.run!.mode &&
        r.ruleset === this.run!.ruleset &&
        r.stage === this.run!.stage &&
        (r.mode !== "daily" || r.day === this.day),
    );
    if (firstResult)
      this.personalBest =
        this.sim.score >
        (this.sim.mode === "arcade"
          ? beforeBest
          : Math.max(0, ...previous.map((r) => r.score)));
    const best = this.personalBest;
    const rank =
      this.sim.score >= 8000
        ? "FLOOR LEGEND"
        : this.sim.score >= 4000
          ? "DUST BUSTER"
          : this.sim.score >= 1000
            ? "CLEAN MACHINE"
            : "ROOKIE ROLLER";
    const daily = this.sim.mode === "daily" && this.sim.ended && this.ticket;
    this.dialog(
      cleared ? "STAGE CLEAR!" : "RESULTS",
      `${stageInfo(this.sim.level.id).name} · ${best ? "A NEW PERSONAL BEST" : rank}`,
      `${rewards}<div class="result-score">${number(this.sim.score)}<span>POINTS</span></div><div class="stat-grid"><div><strong>${this.sim.deposited}</strong><span>DUST</span></div><div><strong>${this.sim.deliveries}</strong><span>DELIVERIES</span></div><div><strong>${this.sim.chain.best ? `${2 + Math.max(0, this.sim.chain.best - 1) * 0.5}×` : "–"}</strong><span>BEST COMBO</span></div></div>${daily ? (this.verifiedAccount && this.accountProfile?.did === this.ticket?.did ? '<div id="daily-standing"><p class="loading-copy">Posting score…</p></div>' : '<p class="muted">Sign in with the account that started this run.</p><button class="secondary wide" data-action="account">SIGN IN</button>') : this.sim.mode === "daily" ? `<p class="muted">${this.ticket ? "Finish the run to rank." : "Practice"}</p>${!this.verifiedAccount ? '<button class="secondary wide" data-action="account">SIGN IN TO RANK</button>' : ""}` : ""}<div class="button-row"><button class="primary" data-action="restart">PLAY AGAIN ${icons.arrow}</button><button class="secondary" data-action="home">Garage</button></div>${!this.storage.available ? '<p class="fine">Browser storage is unavailable; this result lasts for this session.</p>' : ""}`,
      false,
    );
    if (daily && this.verifiedAccount && this.accountProfile?.did === daily.did)
      void this.dailyResults(daily, this.replay);
  }
  private async dailyResults(ticket: Ticket, replay: Replay): Promise<void> {
    const epoch = this.dialogEpoch;
    try {
      const { mountDailyResults } = await import("./daily-results");
      if (this.dialogEpoch !== epoch) return;
      const host = this.modal.querySelector<HTMLElement>("#daily-standing");
      if (!host) return;
      this.dialogCleanup = mountDailyResults(host, {
        day: ticket.day,
        did: ticket.did,
        score: this.sim.score,
        save: () => this.postDaily(ticket, replay),
        openBoard: () => void this.board("mutuals", ticket.day),
      });
    } catch {
      if (this.dialogEpoch !== epoch) return;
      const host = this.modal.querySelector<HTMLElement>("#daily-standing");
      if (host) {
        host.innerHTML =
          '<p class="muted">Results unavailable.</p><button class="secondary wide">TRY AGAIN</button>';
        host.querySelector("button")!.onclick = () =>
          void this.dailyResults(ticket, replay);
      }
    }
  }
  private postDaily(ticket: Ticket, replay: Replay): Promise<void> {
    if (this.dailySubmission?.id === ticket.id)
      return this.dailySubmission.promise;
    const promise = (async () => {
      const identity = await this.account();
      const profile = await identity.ensureSession().catch((error) => {
        if (!identity.verified) throw new ApiError("Sign in to rank", 401);
        throw error;
      });
      if (profile.did !== ticket.did)
        throw new ApiError("Account changed", 401);
      await submitDaily(ticket, replay);
      if (this.ticket?.id === ticket.id) this.submitted = true;
    })().catch((error) => {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        this.ticket?.id === ticket.id
      )
        this.identity?.invalidate();
      if (this.dailySubmission?.id === ticket.id) this.dailySubmission = null;
      throw error;
    });
    this.dailySubmission = { id: ticket.id, promise };
    return promise;
  }
  private frame(ms: number): void {
    const dt = Math.min((ms - this.last) / 1000 || STEP, 0.15);
    this.last = ms;
    if (document.hidden) {
      this.accum = 0;
      this.lastUiUpdate = performance.now();
      requestAnimationFrame((t) => this.frame(t));
      return;
    }
    this.input.pollGamepad();
    // UI durations follow elapsed time even when rendering is slow. Physics
    // keeps its bounded catch-up budget; paused time must not advance either.
    const now = performance.now();
    let uiDt = Math.max(0, (now - this.lastUiUpdate) / 1000);
    this.lastUiUpdate = now;
    if (this.state === "countdown") {
      this.countdown -= uiDt;
      this.hudView!.countdown(this.countdown);
      if (this.countdown <= 0) {
        this.state = "playing";
        this.input.enabled = true;
        this.accum = 0;
        // The GO banner starts now, not at the beginning of this slow frame.
        uiDt = 0;
      }
    }
    if (this.state === "playing") {
      this.hudView?.advance(uiDt, this.sim);
      this.accum += dt;
      let steps = 0;
      while (this.accum >= STEP && steps++ < 12) {
        const input = this.input.read();
        this.sim.step(input);
        if (this.sim.mode === "daily") appendReplay(this.replay, input);
        this.accum -= STEP;
        for (const event of this.sim.events) {
          this.view.burst(event);
          this.hudView?.event(event, this.sim);
          if (event.kind === "boost") this.toast("BOOST REFILLED");
          if (event.kind === "stairs")
            this.toast(event.value ? "UPPER FLOOR" : "GROUND FLOOR");
          if (event.kind === "land" && event.value)
            this.toast(`${event.value * 360}° · +${event.value * 25} BOOST`);
          if (event.kind === "near-miss") this.toast("NEAR MISS · +75");
          if (event.kind === "deposit")
            this.toast(
              `+${number(event.value)}${this.sim.chain.count > 1 ? ` · ${2 * this.sim.chain.multiplier}× COMBO` : ""}${event.timeAdded ? ` · +${event.timeAdded}s` : ""}`,
            );
        }
        if (this.sim.mode === "tutorial" && this.sim.deposited > 0) {
          this.finish();
          break;
        }
        if (this.sim.ended) {
          this.finish();
          break;
        }
      }
    }
    this.hudClock += dt;
    if (this.hudClock > 0.08) {
      this.hudClock = 0;
      if (this.state !== "menu") this.updateHUD();
    }
    const moving = this.state === "playing" || this.state === "countdown";
    const menuVisible =
      this.state === "menu" && this.modal.classList.contains("hidden");
    if (
      this.view.dirty ||
      ((moving || menuVisible) &&
        ms - this.lastDraw >= (moving ? 0 : 1000 / 30))
    ) {
      const drawDt = this.lastDraw
        ? Math.min(0.15, (ms - this.lastDraw) / 1000)
        : dt;
      this.lastDraw = ms;
      this.view.render(
        this.sim,
        drawDt,
        ms / 1000,
        this.state === "menu",
        Math.max(0, Math.min(1, 1 - this.countdown / 4.5)),
        this.state === "playing" ? this.accum / STEP : 1,
      );
    }
    requestAnimationFrame((t) => this.frame(t));
  }
  private updateHUD(): void {
    this.hudView?.update(this.sim, this.view.cameraMode, !!this.ticket);
  }

  private dialog(
    title: string,
    subtitle: string,
    body: string,
    close = true,
  ): void {
    this.cancelStart();
    const epoch = ++this.dialogEpoch;
    this.dialogCleanup?.();
    this.dialogCleanup = null;
    this.skinViewer?.dispose();
    this.skinViewer = null;
    ++this.skinEpoch;
    if (this.modal.classList.contains("hidden"))
      this.dialogFocus = document.activeElement as HTMLElement;
    this.modal.innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">${close ? '<button class="close-dialog" data-action="close" aria-label="Close dialog">×</button>' : ""}<h2 id="dialog-title">${title}</h2>${subtitle ? `<p class="dialog-subtitle">${subtitle}</p>` : ""}${body}</section>`;
    this.modal.classList.remove("hidden");
    this.root.inert = true;
    requestAnimationFrame(() => {
      if (this.dialogEpoch === epoch)
        this.modal.querySelector<HTMLElement>("button,input")?.focus();
    });
  }
  private closeDialog(restoreMusic = true): void {
    ++this.dialogEpoch;
    this.dialogCleanup?.();
    this.dialogCleanup = null;
    this.skinViewer?.dispose();
    this.skinViewer = null;
    ++this.skinEpoch;
    this.view.dirty = true;
    if (this.state === "results") this.music.pause();
    this.modal.classList.add("hidden");
    this.modal.innerHTML = "";
    this.root.inert = false;
    this.dialogFocus?.focus();
    this.dialogFocus = null;
    if (restoreMusic) {
      this.refreshDaily();
      this.menuMusic();
    }
  }
  private async board(
    scope: import("../shared/api").BoardScope = "world",
    date?: string,
  ): Promise<void> {
    const day = date ?? utcDay();
    this.dialog(
      "LEADERBOARD",
      `${stageInfo(dailyStage(day)).name} · ${day}${date === undefined ? " · resets 00:00 UTC" : ""}`,
      `<p class="loading-copy">Loading…</p>`,
    );
    const epoch = this.dialogEpoch;
    const [{ mountLeaderboard }] = await Promise.all([
      import("./leaderboard"),
      this.sessionReady,
    ]);
    if (this.dialogEpoch !== epoch) return;
    const host = document.createElement("div");
    this.modal.querySelector(".loading-copy")!.replaceWith(host);
    this.dialogCleanup = mountLeaderboard(
      host,
      day,
      this.storage.runs,
      scope,
      date === undefined
        ? (next) => {
            this.modal.querySelector(".dialog-subtitle")!.textContent =
              `${stageInfo(dailyStage(next)).name} · ${next} · resets 00:00 UTC`;
          }
        : undefined,
    );
    if (this.state !== "results") this.select("daily");
  }
  private async profile(): Promise<void> {
    this.dialog("YOUR STATS", "", '<p class="loading-copy">Loading…</p>');
    const epoch = this.dialogEpoch;
    const { statsPanel } = await import("./garage-panels");
    if (this.dialogEpoch === epoch)
      this.dialog(
        "YOUR STATS",
        "",
        statsPanel(this.storage, !!this.accountProfile),
      );
  }
  private async settings(): Promise<void> {
    this.dialog("SETTINGS", "", '<p class="loading-copy">Loading…</p>');
    const epoch = this.dialogEpoch;
    const { settingsPanel, radioPanel } = await import("./garage-panels");
    if (this.dialogEpoch !== epoch) return;
    this.dialog(
      "SETTINGS",
      "",
      settingsPanel(
        this.storage.settings,
        radioPanel(this.storage.settings, this.music.track, true),
      ),
    );
    this.updateRadio();
  }
  private updateRadio(): void {
    const button = this.root.querySelector<HTMLElement>(
      '#footer [data-action="music"]',
    );
    if (button) {
      button.setAttribute("aria-pressed", String(this.storage.settings.music));
      button.style.opacity = this.storage.settings.music ? "1" : ".4";
    }
    const track = this.music.track;
    const title = this.modal.querySelector<HTMLElement>("[data-radio-title]");
    if (!title) return;
    title.textContent = track.title;
    const artist = this.modal.querySelector<HTMLAnchorElement>(
      "[data-radio-artist]",
    )!;
    artist.textContent = `${track.artist} ↗`;
    artist.href = track.source;
    const toggle = this.modal.querySelector<HTMLElement>(
      '[data-action="music"]',
    )!;
    toggle.textContent = this.storage.settings.music ? "On" : "Off";
    toggle.setAttribute("aria-pressed", String(this.storage.settings.music));
    this.modal.querySelector("#music-volume-value")!.textContent =
      `${Math.round(this.storage.settings.musicVolume * 100)}%`;
    const preview = this.modal.querySelector<HTMLElement>(
      '[data-action="music-preview"]',
    );
    if (preview)
      preview.textContent =
        this.music.status === "playing" ? "Stop preview" : "Play preview";
    this.modal.querySelector("[data-radio-status]")!.textContent =
      this.music.status === "unavailable"
        ? "Track unavailable. Try the next track."
        : this.music.status === "blocked"
          ? preview
            ? "Browser paused audio. Tap Play preview to retry."
            : "Browser paused audio. Resume your shift to retry."
          : "";
  }
  private updateAccountButton(): void {
    const button =
      this.root.querySelector<HTMLButtonElement>(".account-button")!;
    const profile = this.accountProfile;
    button.classList.toggle("connected", !!profile);
    button.classList.toggle("verified", this.verifiedAccount);
    button.innerHTML = profile
      ? `${accountBadge(profile)}<i class="account-check" aria-hidden="true">${this.verifiedAccount ? "✓" : "!"}</i>`
      : '<b aria-hidden="true">@</b> Sign in';
    button.setAttribute(
      "aria-label",
      profile
        ? `${accountHandle(profile)} · ${this.verifiedAccount ? "Signed in" : "Reconnect to rank"}`
        : "Sign in with AT Protocol",
    );
    this.updateStageUI();
    if (this.selected === "daily")
      document.getElementById("mode-description")!.textContent =
        `90 seconds · ${this.verifiedAccount ? "Ranked" : "Sign in to rank"}`;
  }
  private async restoreAccount(callback = false): Promise<void> {
    try {
      if (!callback) {
        const { profile } = await getAccount();
        this.accountProfile = profile;
        this.verifiedAccount = !!profile;
        this.updateAccountButton();
        if (profile) return;
        // The SDK marker also restores sessions created before our account UI
        // existed. It is only a loading hint; it never authorizes submissions.
        let saved = false;
        try {
          saved = !!(
            localStorage.getItem("crazy-roomba-account") ||
            localStorage.getItem("@@atproto/oauth-client-browser(sub)")
          );
        } catch {}
        if (!saved) return;
      }
      const identity = await this.account();
      if (callback) {
        if (identity.verified && identity.profile) {
          const { restorePendingDaily, savePendingDaily } =
            await import("./pending-daily");
          const pending = await restorePendingDaily(identity.profile.did);
          if (pending) {
            await this.setStage(pending.ticket.stage);
            if (this.sim.level.id !== pending.ticket.stage) {
              savePendingDaily(pending.ticket, pending.replay, pending.runId);
              throw new Error("Run saved. Reload to retry loading the stage.");
            }
            this.sim = pending.sim;
            this.ticket = pending.ticket;
            this.replay = pending.replay;
            this.day = pending.ticket.day;
            this.run =
              this.storage.runs.find((r) => r.id === pending.runId) || null;
            this.selected = "daily";
            this.finish();
            this.toast("Run recovered");
            return;
          }
        }
        await this.accountDialog();
      }
    } catch (e) {
      if (callback)
        this.toast(
          e instanceof Error ? e.message : "Could not connect your account.",
        );
    }
  }
  private async keepDailyForLogin(): Promise<void> {
    if (
      this.ticket &&
      this.sim.mode === "daily" &&
      this.sim.ended &&
      !this.submitted
    ) {
      const { savePendingDaily } = await import("./pending-daily");
      savePendingDaily(this.ticket, this.replay, this.run?.id || null);
    }
  }
  private async account(): Promise<Identity> {
    if (!this.accountPromise)
      this.accountPromise = import("./identity")
        .then(async ({ Identity }) => {
          const i = new Identity();
          i.onChange = () => {
            this.accountProfile = i.profile;
            this.verifiedAccount = i.verified;
            this.updateAccountButton();
          };
          await i.init();
          this.identity = i;
          return i;
        })
        .catch((e) => {
          this.accountPromise = null;
          throw e;
        });
    return this.accountPromise;
  }
  private async accountDialog(signup = false): Promise<void> {
    this.dialog("ACCOUNT", "", '<p class="loading-copy">Connecting…</p>');
    const epoch = this.dialogEpoch;
    try {
      const identity = await this.account();
      if (identity.verified) {
        try {
          await identity.ensureSession();
        } catch (e) {
          identity.connectionError =
            e instanceof Error ? e.message : "Reconnect to rank.";
        }
      }
    } catch (e) {
      if (
        this.dialogEpoch === epoch &&
        !this.modal.classList.contains("hidden")
      )
        this.dialog(
          "CAN’T CONNECT",
          "",
          `<p class="muted">${escape(e instanceof Error ? e.message : "Try again shortly.")}</p>`,
        );
      return;
    }
    if (this.dialogEpoch !== epoch || this.modal.classList.contains("hidden"))
      return;
    const identity = this.identity!,
      panel = identity.panel(signup);
    this.dialog(panel.title, "", panel.body);
    if (!identity.profile && !signup)
      this.dialogCleanup = identity.attachTypeahead(this.modal);
  }

  private updateSoundButton(): void {
    this.root
      .querySelectorAll<HTMLElement>('[data-action="sound"]')
      .forEach((b) => {
        b.setAttribute("aria-pressed", String(this.storage.settings.sound));
        b.style.opacity = this.storage.settings.sound ? "1" : ".4";
      });
    const b = this.modal.querySelector<HTMLElement>('[data-action="sound"]');
    if (b) {
      b.textContent = this.storage.settings.sound ? "On" : "Off";
      b.setAttribute("aria-pressed", String(this.storage.settings.sound));
    }
  }
  private toast(message: string): void {
    clearTimeout(this.toastTimer);
    const el = document.getElementById("toast")!;
    el.textContent = message;
    el.classList.add("visible");
    this.toastTimer = window.setTimeout(
      () => el.classList.remove("visible"),
      2200,
    );
  }
}
