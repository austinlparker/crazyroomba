import { GameRenderer } from "/src/game/renderer.ts";
import { clearModelCache } from "/src/game/models.ts";
import { loadWorld } from "/src/game/stages/load-world.ts";
import { RULESET } from "/src/game/simulation.ts";
import { SHOTS, DURATION, input, createShot } from "./story.js";
import { PromoStudio } from "./studio.js";
import { directCamera, COVERAGE } from "./camera.js";
const FPS = Number(new URLSearchParams(location.search).get("fps") || 60),
  W = innerWidth,
  H = innerHeight;
if (![30, 60].includes(FPS)) throw Error("Capture supports 30 or 60 fps");
const output = document.querySelector("#output");
output.width = W;
output.height = H;
const ctx = output.getContext("2d", { alpha: false }),
  game = document.querySelector("#game");
let sim,
  view,
  studio,
  current = -1,
  last = -1,
  time = 0,
  local = 0,
  shot,
  boosting = false,
  latestEvent = null,
  simulationSteps = 0,
  cameraName = "",
  lastCamera = "";
const eventLog = [],
  states = [],
  cuts = [];
const C = {
  yellow: "#ffe52b",
  cream: "#fff5d7",
  ink: "#0c1719",
  orange: "#ff793d",
  mint: "#6affd7",
};
const clamp = (n) => Math.max(0, Math.min(1, n)),
  ease = (n) => 1 - Math.pow(1 - clamp(n), 3);
for (const [name, url] of [
  ["PromoRace", "/fonts/racing-sans-one-latin.woff2"],
  ["PromoUI", "/fonts/chakra-petch-600-latin.woff2"],
]) {
  const font = new FontFace(name, `url(${url})`);
  await font.load();
  document.fonts.add(font);
}
async function start(index) {
  shot = SHOTS[index];
  const previous = sim?.level.id;
  sim = await createShot(shot, sim);
  if (!view || previous !== shot.stage) {
    clearModelCache();
    const build = await loadWorld(shot.stage),
      visual = build();
    if (!view) {
      view = new GameRenderer(game, sim.level, visual);
      view.renderer.setPixelRatio(1);
      view.resize();
      view.quality(false);
      const draw = view.renderer.render.bind(view.renderer);
      view.renderer.render = (scene, camera) => {
        if (scene === view.scene) captureCamera(camera);
        return draw(scene, camera);
      };
      for (let n = 0; n < 100 && !view.post; n++)
        await new Promise((r) => setTimeout(r, 20));
      studio = new PromoStudio(view.renderer);
    } else view.setStage(sim.level, visual);
  }
  view.skin(shot.skin);
  view.setCamera(shot.camera === "first-person" ? "first-person" : "chase");
  current = index;
  latestEvent = null;
  boosting = false;
  simulationSteps = 0;
}
function captureCamera(camera) {
  cameraName = directCamera(camera, shot, local, sim, view.robot);
}

function text(
  value,
  x,
  y,
  size,
  color = C.cream,
  align = "left",
  stroke = 0,
  font = "PromoRace",
) {
  ctx.save();
  ctx.font = `${size}px ${font},sans-serif`;
  ctx.textAlign = align;
  ctx.lineJoin = "round";
  if (stroke) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = stroke;
    ctx.strokeText(value, x + 3, y + 6);
  }
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
  ctx.restore();
}
function fit(value, size, max = 940, font = "PromoRace") {
  ctx.font = `${size}px ${font}`;
  return Math.min(size, (size * max) / ctx.measureText(value).width);
}
function rect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function composite() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter =
    time < 3.24
      ? "saturate(.18) contrast(.95)"
      : "saturate(1.25) contrast(1.08)";
  ctx.drawImage(game, 0, 0, W, H);
  ctx.filter = "none";
  ctx.save();
  ctx.scale(W / 1080, H / 1920);
  // A trace of analog texture; gameplay and typography stay readable.
  for (let y = 0; y < 1920; y += 5) rect(0, y, 1080, 1, "rgba(6,9,16,.045)");
  const grit = Math.floor(time * 24);
  for (let i = 0; i < 90; i++) {
    const x = (i * 167 + grit * 59) % 1080;
    const y = (i * 293 + grit * 97) % 1920;
    rect(x, y, 2, 1, i % 2 ? "rgba(255,253,229,.045)" : "rgba(0,0,0,.05)");
  }
  // Short tracking tears on the attitude switch and the lunar reveal.
  for (const edit of [3.24, 15.6]) {
    const age = time - edit;
    if (age >= 0 && age < 0.12) {
      const y = 340 + Math.floor(age * 60) * 210;
      ctx.save();
      ctx.globalAlpha = 0.7 * (1 - age / 0.12);
      rect(0, y, 1080, 5, "#f835af");
      rect(35, y + 10, 990, 3, "#caff32");
      ctx.restore();
    }
  }
  // Keep gameplay open. Only the score event, a small bin meter, and one Daily
  // line remain; the voice carries the feature descriptions.
  if (shot.id === "end") {
    const top = ctx.createLinearGradient(0, 0, 0, 700);
    top.addColorStop(0, "rgba(4,12,15,.65)");
    top.addColorStop(1, "rgba(4,12,15,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, 1080, 700);
    const bottom = ctx.createLinearGradient(0, 1310, 0, 1920);
    bottom.addColorStop(0, "rgba(4,12,15,0)");
    bottom.addColorStop(1, "rgba(4,12,15,.8)");
    ctx.fillStyle = bottom;
    ctx.fillRect(0, 1310, 1080, 610);
    const enter = ease(local / 0.24);
    ctx.globalAlpha = enter;
    ctx.save();
    ctx.translate(540, 335);
    ctx.rotate(-0.055);
    ctx.scale(1 + (1 - enter) * 0.22, 1 + (1 - enter) * 0.22);
    ctx.translate(-540, -335);
    // Chunky offset ink feels like an arcade-box logo, with a restrained neon fringe.
    text("CRAZY", 557, 332, 204, "#b41569", "center", 15);
    text("ROOMBA", 557, 532, 213, "#b41569", "center", 15);
    text("CRAZY", 540, 315 - (1 - enter) * 40, 204, C.yellow, "center", 10);
    text("ROOMBA", 540, 515 - (1 - enter) * 40, 213, C.orange, "center", 10);
    ctx.restore();
    text("ALL GUTS. NO DUST.", 540, 637, 59, "#caff32", "center", 8, "PromoUI");
    text("PLAY FREE", 540, 1510, 65, C.yellow, "center", 7, "PromoUI");
    text("roomba.aparker.io", 540, 1620, 79, C.cream, "center", 7, "PromoUI");
  } else if (shot.id === "daily") {
    text(
      "DAILY · BRING YOUR FRIENDS",
      540,
      1610,
      fit("DAILY · BRING YOUR FRIENDS", 49, 935, "PromoUI"),
      C.cream,
      "center",
      7,
      "PromoUI",
    );
  } else if (["collect", "deliver"].includes(shot.id)) {
    for (let i = 0; i < 5; i++) {
      rect(394 + i * 61, 1633, 49, 18, "rgba(12,23,25,.8)");
      if (i < sim.bin.length) rect(397 + i * 61, 1636, 43, 12, C.yellow);
    }
  }
  if (latestEvent?.kind === "deposit" && time - latestEvent.at < 0.9) {
    const age = (time - latestEvent.at) / 0.9;
    ctx.globalAlpha = 1 - age * age;
    text(
      `+${latestEvent.value}`,
      540,
      1370 - age * 60,
      106,
      C.yellow,
      "center",
      8,
    );
  }
  ctx.restore();
}

async function frame(index, image = true) {
  if (index < last) throw Error("Capture frames must be sequential");
  for (let i = last + 1; i <= index; i++) {
    time = i / FPS;
    const n = SHOTS.findLastIndex((s) => time >= s.start);
    if (n < 0 || time >= DURATION) break;
    if (n !== current) await start(n);
    local = time - shot.start;
    const speed = shot.speed ?? 1;
    if (shot.camera !== "studio") {
      const targetSteps = Math.floor((local + 1 / FPS) * speed * 60 + 1e-7);
      for (; simulationSteps < targetSteps; simulationSteps++) {
        const simulationTime = simulationSteps / 60;
        const at = shot.start + simulationTime / speed;
        sim.step(input(shot, sim, simulationTime));
        for (const event of sim.events) {
          view.burst(event);
          eventLog.push({ ...event, at, shot: shot.id, bin: sim.bin.length });
          if (event.kind === "deposit") latestEvent = { ...event, at };
        }
        if (sim.boosting && !boosting)
          eventLog.push({ kind: "turbo", at, shot: shot.id });
        boosting = sim.boosting;
      }
    }
    if (shot.camera === "studio")
      cameraName = studio.render(shot.id, local, time, shot.duration);
    else view.render(sim, speed / FPS, time + 30, false, 1);
    const cameraKey = `${shot.id}/${cameraName}`;
    if (cameraKey !== lastCamera) {
      cuts.push({ at: time, shot: shot.id, camera: cameraName });
      lastCamera = cameraKey;
    }
    if (i % Math.max(1, FPS / 5) === 0)
      states.push({
        at: time,
        shot: shot.id,
        x: sim.x,
        y: sim.y,
        z: sim.z,
        grounded: sim.grounded,
        bin: sim.bin.length,
        score: sim.score,
        floor: sim.floor,
        camera: cameraName,
        fov: shot.camera === "studio" ? studio.camera.fov : view.camera.fov,
        cameraPosition: (shot.camera === "studio"
          ? studio.camera
          : view.camera
        ).position.toArray(),
      });
    composite();
    last = i;
  }
  return image
    ? output.toDataURL("image/jpeg", 0.96).split(",")[1]
    : {
        time,
        shot: shot.id,
        x: sim.x,
        y: sim.y,
        z: sim.z,
        score: sim.score,
        bin: sim.bin.length,
      };
}
window.promo = {
  frame,
  SHOTS,
  FPS,
  DURATION,
  RULESET,
  COVERAGE,
  get cuts() {
    return cuts;
  },
  get events() {
    return eventLog;
  },
  get states() {
    return states;
  },
};
await frame(0, false);
window.promo.ready = true;
