import { escapeHtml as escape, formatNumber as number } from "./html";
import type { Music } from "./music";
import type { Storage, Settings } from "./storage";
import { stageInfo } from "./stage-catalog";
const modeNames = {
  arcade: "Arcade",
  daily: "Daily",
  freeroam: "Free roam",
  tutorial: "Tutorial",
};
export function statsPanel(storage: Storage, connected: boolean): string {
  const { runs, progress } = storage,
    best = Math.max(0, ...Object.values(progress.best));
  return `<div class="stat-grid"><div><strong>${number(progress.shifts)}</strong><span>SHIFTS</span></div><div><strong>${number(progress.dust)}</strong><span>DUST</span></div><div><strong>${number(best)}</strong><span>ARCADE BEST</span></div></div><h3>Recent shifts</h3>${
    runs.length
      ? runs
          .slice(0, 5)
          .map(
            (r) =>
              `<div class="record-row"><span>${escape(stageInfo(r.stage).name)}<small>${modeNames[r.mode]} · ${escape(r.createdAt.slice(0, 10))}</small></span><strong>${number(r.score)}</strong></div>`,
          )
          .join("")
      : '<p class="muted">Complete a run to see your scores here.</p>'
  }<p class="fine">${storage.available ? "Stats saved on this device." : "Stats last for this session; browser storage is unavailable."}</p><button class="secondary wide" data-action="account">${connected ? "Your account" : "Sign in"}</button>`;
}
export function settingsPanel(settings: Settings, radio: string): string {
  const touch =
    typeof matchMedia === "function" &&
    matchMedia("(pointer: coarse), (max-width: 600px)").matches;
  return `${radio}<div class="setting-row"><span>Sound + voice</span><button class="secondary" data-action="sound" aria-label="Sound + voice" aria-pressed="${settings.sound}">${settings.sound ? "On" : "Off"}</button></div><div class="setting-row"><span>Graphics</span><button class="secondary" data-action="quality">${settings.quality === "high" ? "High" : "Performance"}</button></div><h3>Controls</h3><div class="controls-touch"><p>Drag the stick up to drive, down to reverse, and sideways to steer.</p><p>Hold Boost for speed or Drift while steering. Tap Hop to jump.</p><p>Open Pause to change the camera.</p></div><details class="controls-keyboard" ${touch ? "" : "open"}><summary>Keyboard &amp; gamepad</summary><div class="controls-list"><span>Drive / reverse</span><kbd>W / S or ↑ / ↓</kbd><span>Steer</span><kbd>A / D or ← / →</kbd><span>Boost</span><kbd>SHIFT</kbd><span>Drift</span><kbd>SPACE + STEER</kbd><span>Hop</span><kbd>E</kbd><span>Air spin</span><kbd>SPACE + STEER IN AIR</kbd><span>Camera / pause</span><kbd>C / ESC</kbd><span>Gamepad</span><span>Left stick to drive · A boost · B drift · X hop · Start pause</span></div></details><button class="secondary wide" data-action="tutorial">Tutorial</button><p class="fine"><a href="${import.meta.env.BASE_URL}music/CREDITS.txt" target="_blank" rel="noopener noreferrer">Credits ↗</a></p>`;
}

export function radioPanel(
  settings: Settings,
  track: Music["track"],
  preview = false,
): string {
  return `<section class="radio" aria-label="Dust FM soundtrack">
      <div class="radio-heading"><strong>♫ DUST FM</strong><span></span></div>
      <div class="radio-track"><span class="radio-disc" aria-hidden="true">●</span><div><strong data-radio-title>${escape(track.title)}</strong><a data-radio-artist href="${track.source}" target="_blank" rel="noopener noreferrer">${escape(track.artist)} ↗</a></div></div>
      <div class="radio-buttons"><button class="secondary" data-action="music" aria-label="Music" aria-pressed="${settings.music}">${settings.music ? "On" : "Off"}</button><button class="secondary" data-action="music-next" aria-label="Next music track">Next ▷</button>${preview ? '<button class="secondary" data-action="music-preview">Preview</button>' : ""}</div>
      <label class="radio-volume" for="music-volume"><span>Volume <output id="music-volume-value">${Math.round(settings.musicVolume * 100)}%</output></span><input id="music-volume" type="range" min="0" max="100" step="1" value="${Math.round(settings.musicVolume * 100)}"/></label>
      <small data-radio-status>${settings.music ? "" : "Off"}</small>
    </section>`;
}
