import { clipCamera } from "/src/game/camera.ts";

// Promo-only coverage. Each row is a hard cut; values within a row move continuously.
// Orbit rigs: [bearing, distance, height, vertical FOV, forward aim].
// Bearings are relative to heading except for the two stunts, which keep a world axis.
const track = (at, name, from, to, world = false) => ({
  at,
  name,
  from,
  to,
  world,
});
const game = (at, name, from, to) => ({ at, name, from, to, game: true });
export const COVERAGE = {
  drive: [
    track(
      0,
      "rear push",
      [3.3, 1.9, 0.85, 72, 0.2],
      [3.05, 1.35, 0.65, 62, 0.1],
    ),
    track(
      1.1,
      "front tracking pan",
      [0.9, 1.4, 0.54, 66, 0],
      [0.5, 1.15, 0.4, 61, 0],
    ),
    track(
      1.85,
      "drift sweep",
      [4.5, 1.8, 1.15, 68, 0],
      [3.7, 1.5, 0.65, 59, 0],
    ),
  ],
  air: [
    track(
      0,
      "takeoff push",
      [0.85, 1.75, 0.75, 64, 0],
      [0.65, 1.35, 0.52, 58, 0],
      true,
    ),
    track(
      0.62,
      "airborne pan",
      [1.5, 1.45, 0.5, 64, 0],
      [0.8, 1.65, 0.75, 62, 0],
      true,
    ),
    track(
      1.3,
      "landing close",
      [0.35, 1.5, 0.6, 62, 0],
      [0.6, 1.15, 0.45, 57, 0],
      true,
    ),
  ],
  stairs: [
    game(0, "stair climb push", [102, -0.03], [83, 0.025]),
    game(1.48, "landing punch-in", [78, -0.06], [87, 0.06]),
  ],
  crawl: [game(0, "under-bed push and pan", [106, -0.08], [85, 0.08])],
  collect: [
    game(0, "pickup push", [95, -0.04], [79, 0.025]),
    track(
      1.38,
      "full-bin tracking",
      [3.4, 1.25, 0.65, 70, 0],
      [3.8, 1.6, 1.2, 60, 0],
    ),
  ],
  deliver: [
    track(
      0,
      "dock crane down",
      [2.75, 2.0, 1.65, 65, 0],
      [2.45, 1.65, 1.2, 60, 0],
      true,
    ),
    track(
      0.74,
      "payout punch-in",
      [2.65, 1.6, 1.3, 58, 0],
      [2.9, 1.8, 1.6, 64, 0],
      true,
    ),
  ],
  crater: [game(0, "crater rush", [108, -0.04], [89, 0.035])],
  launch: [
    track(
      0,
      "lunar launch push",
      [-0.67, 2.0, 0.9, 66, 0],
      [-0.4, 1.55, 0.65, 59, 0],
      true,
    ),
    track(
      0.78,
      "lunar arc pan",
      [-1.15, 1.8, 0.85, 66, 0],
      [-0.25, 2.1, 1.2, 63, 0],
      true,
    ),
    track(
      2.23,
      "lunar landing close",
      [-0.5, 1.5, 0.7, 58, 0],
      [-0.85, 1.2, 0.5, 61, 0],
      true,
    ),
  ],
  daily: [
    track(
      0,
      "daily chase push",
      [3.3, 1.8, 0.9, 69, 0.1],
      [3.0, 1.35, 0.6, 60, 0.05],
    ),
    track(
      1.3,
      "daily front pan",
      [0.65, 1.4, 0.48, 64, 0],
      [1.1, 1.7, 0.85, 59, 0],
    ),
    track(
      2.55,
      "daily drift sweep",
      [4.2, 1.8, 1.3, 65, 0],
      [3.25, 1.25, 0.6, 62, 0],
    ),
  ],
};

export function directCamera(camera, shot, local, sim, robot) {
  const rows = COVERAGE[shot.id];
  const i = rows.findLastIndex((r) => local >= r.at);
  const row = rows[i],
    end = rows[i + 1]?.at ?? shot.duration;
  const p = Math.max(0, Math.min(1, (local - row.at) / (end - row.at)));
  const t = p * p * (3 - 2 * p);
  const values = row.from.map((n, k) => n + (row.to[k] - n) * t);
  camera.clearViewOffset();
  camera.aspect = innerWidth / innerHeight;
  if (row.game) {
    // Keep the shipping collision-aware camera while pushing its lens and panning.
    camera.fov = values[0];
    camera.setViewOffset(
      innerWidth,
      innerHeight,
      values[1] * innerWidth,
      0,
      innerWidth,
      innerHeight,
    );
  } else {
    const [bearing, distance, height, fov, lead] = values;
    const a = bearing + (row.world ? 0 : sim.angle);
    const target = { x: sim.x, y: robot.position.y + 0.12, z: sim.z };
    const position = clipCamera(
      target,
      {
        x: sim.x + Math.sin(a) * distance,
        y: robot.position.y + height,
        z: sim.z + Math.cos(a) * distance,
      },
      sim.level,
    );
    camera.position.set(position.x, position.y, position.z);
    camera.lookAt(
      target.x + Math.sin(sim.angle) * lead,
      target.y,
      target.z + Math.cos(sim.angle) * lead,
    );
    camera.fov = fov;
  }
  if (["drive", "air", "launch", "daily"].includes(shot.id)) {
    // A small changing Dutch angle echoes 1990s skate-video coverage.
    camera.rotateZ(((i % 2 ? 1 : -1) * (3.5 - t * 5) * Math.PI) / 180);
  }
  camera.updateProjectionMatrix();
  return row.name;
}
