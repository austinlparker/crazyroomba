// Development-only composition using the shipping renderer, stage and robot.
// The exported JPEG is the only part of this tool shipped to players.
import { GameRenderer } from "/src/game/renderer.ts";
import { Simulation } from "/src/game/simulation.ts";
import { loadLevel } from "/src/game/stages/load-data.ts";
import { loadWorld } from "/src/game/stages/load-world.ts";

const level = await loadLevel("culdesac");
const sim = new Simulation("freeroam", 71, level);
Object.assign(sim, {
  x: 0,
  z: 7.2,
  angle: Math.PI,
  y: level.groundHeight(0, 7.2),
});
const build = await loadWorld("culdesac");
const view = new GameRenderer(document.querySelector("#game"), level, build());
view.skin("taxi");
view.renderer.setPixelRatio(2);
view.resize();
view.reducedMotion = true;
view.render(sim, 0, 30, false, 1);

const camera = view.camera;
camera.clearViewOffset();
camera.aspect = 1200 / 630;
camera.fov = 42;
camera.near = 0.025;
camera.position.set(sim.x + 0.37, sim.y + 0.32, sim.z + 0.53);
camera.lookAt(sim.x, sim.y + 0.06, sim.z);
camera.setViewOffset(1200, 630, -270, -36, 1200, 630);
camera.updateProjectionMatrix();
await document.fonts.ready;
view.renderer.render(view.scene, camera);
window.socialCard = { ready: true };
