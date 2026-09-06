import { App } from "./game/app";
import { Storage } from "./game/storage";
import { loadLevel } from "./game/stages/load-data";
import { loadWorld } from "./game/stages/load-world";
import { clearModelCache } from "./game/models";
const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
async function boot() {
  try {
    const id = new Storage().settings.stage;
    const [level, build] = await Promise.all([loadLevel(id), loadWorld(id)]);
    const visual = build();
    clearModelCache();
    const app = new App(canvas, level, visual);
    if (import.meta.env.DEV) Object.assign(window, { roomba: app });
    document.getElementById("loading")?.remove();
  } catch (error) {
    console.error("Could not start Crazy Roomba", error);
    document.getElementById("loading")!.innerHTML =
      '<h1>LOAD FAILED</h1><p>Check your connection and WebGL support.</p><button onclick="location.reload()">Retry</button>';
  }
}
void boot();
