// Start isolated local services so API/browser checks run the same way in CI.
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const suite = process.argv[2];
if (!["api", "browser"].includes(suite))
  throw new Error("Usage: node scripts/test-local.mjs api|browser");
const temp = await mkdtemp(join(tmpdir(), `roomba-${suite}-`));
const env = {
  ...process.env,
  WRANGLER_LOG_PATH: join(temp, "wrangler.log"),
  WRANGLER_SEND_METRICS: "false",
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
};
const children = new Set();
function start(command, args) {
  const child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
  children.add(child);
  const exited = new Promise((resolve, reject) => {
    child.once("error", (error) => {
      children.delete(child);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      children.delete(child);
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${signal || code}`));
    });
  });
  // A long-running server may exit before the readiness poll or cleanup awaits it.
  void exited.catch(() => {});
  return { child, exited };
}
const run = (command, args) => start(command, args).exited;
const cli = (name, args) =>
  run(process.execPath, [join(root, "node_modules", name), ...args]);
async function port() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const value = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return value;
}
async function ready(origin, server) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.child.exitCode !== null || server.child.signalCode)
      await server.exited;
    try {
      const response = await fetch(origin, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return;
    } catch {
      /* Server still starting. */
    }
    await delay(500);
  }
  throw new Error(`Local server did not become ready: ${origin}`);
}
function stop() {
  for (const child of children) child.kill("SIGTERM");
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

try {
  const localPort = await port();
  const origin = `http://127.0.0.1:${localPort}`;
  if (suite === "api") {
    env.TEST_ORIGIN = origin;
    env.TEST_PERSIST_TO = join(temp, "state");
    await cli("wrangler/bin/wrangler.js", [
      "d1",
      "migrations",
      "apply",
      "crazy-roomba-v2",
      "--local",
      "--persist-to",
      env.TEST_PERSIST_TO,
    ]);
    const server = start(process.execPath, [
      join(root, "node_modules/wrangler/bin/wrangler.js"),
      "dev",
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      String(localPort),
      "--local-upstream",
      `127.0.0.1:${localPort}`,
      "--upstream-protocol",
      "http",
      "--persist-to",
      env.TEST_PERSIST_TO,
    ]);
    await ready(`${origin}/api/session`, server);
    await run(process.execPath, ["tests/api.integration.mjs"]);
  } else {
    const python = process.env.PYTHON || "python3";
    if (!process.argv.includes("--production-only")) {
      const server = start(process.execPath, [
        join(root, "node_modules/vite/bin/vite.js"),
        "--host",
        "127.0.0.1",
        "--port",
        String(localPort),
        "--strictPort",
      ]);
      await ready(origin, server);
      for (const [test, ...args] of [
        [
          "mobile-controls.browser.py",
          "--width",
          "390",
          "--width",
          "320",
          "--width",
          "844",
        ],
        ["daily-rotation.browser.py"],
        ["audio-unavailable.browser.py"],
        ["menu-music.browser.py", "--autoplay", "blocked"],
        ["game-audio.browser.py"],
      ])
        await run(python, [join("tests", test), "--url", origin, ...args]);
    }
    const previewPort = await port();
    const previewOrigin = `http://127.0.0.1:${previewPort}`;
    const preview = start(process.execPath, [
      join(root, "node_modules/vite/bin/vite.js"),
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(previewPort),
      "--strictPort",
    ]);
    await ready(previewOrigin, preview);
    await run(python, ["tests/stages.browser.py", "--url", previewOrigin]);
  }
} finally {
  stop();
  // Give services time to release SQLite files before deleting this run's state.
  await Promise.all(
    [...children].map(
      (child) =>
        new Promise((resolve) => {
          const timer = setTimeout(() => {
            child.kill("SIGKILL");
            resolve();
          }, 5000);
          child.once("exit", () => {
            clearTimeout(timer);
            resolve();
          });
        }),
    ),
  );
  await rm(temp, { recursive: true, force: true });
}
