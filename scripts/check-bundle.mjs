import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
const manifest = JSON.parse(readFileSync("dist/.vite/manifest.json", "utf8"));
const graph = (roots) => {
  const seen = new Set();
  const visit = (key) => {
    if (seen.has(key)) return;
    assert.ok(manifest[key], `Missing chunk ${key}`);
    seen.add(key);
    for (const dep of manifest[key].imports ?? []) visit(dep);
  };
  roots.forEach(visit);
  return seen;
};
const eager = graph(["index.html"]);
const worlds = ["apartment", "house", "culdesac", "moon"].map(
  (id) => `src/game/stages/${id}-world.ts`,
);
for (const key of [
  ...worlds,
  "src/game/level.ts",
  "src/game/identity.ts",
  "src/game/skin-viewer.ts",
  "src/game/postprocessing.ts",
  "src/game/hud.ts",
  "src/game/daily-results.ts",
  "src/game/leaderboard.ts",
]) {
  assert.ok(
    manifest[key]?.isDynamicEntry,
    `${key} must remain independently loaded`,
  );
  assert.ok(!eager.has(key), `${key} leaked into the eager dependency graph`);
}
const first = graph(["index.html", worlds[0], "src/game/postprocessing.ts"]);
for (const key of worlds.slice(1))
  assert.ok(!first.has(key), `Apartment loads ${key}`);
assert.ok(!first.has("src/game/identity.ts"), "OAuth SDK loads before sign-in");
assert.ok(
  !first.has("src/game/skin-viewer.ts"),
  "Garage preview loads before opening skins",
);
const files = new Set(["index.html"]);
for (const key of first) {
  files.add(manifest[key].file);
  for (const css of manifest[key].css ?? []) files.add(css);
}
const gz = (file) => gzipSync(readFileSync(`dist/${file}`)).length;
const initial = [...files].reduce((n, file) => n + gz(file), 0);
assert.ok(
  initial < 185 * 1024,
  `Initial high-quality apartment payload exceeds 185 KiB gzip: ${initial}`,
);
console.log(
  `Initial apartment + high-quality effects: ${(initial / 1024).toFixed(1)} KiB gzip; ${files.size} files.`,
);
const fontFiles = [
  "fonts/racing-sans-one-latin.woff2",
  "fonts/chakra-petch-600-latin.woff2",
];
const fontBytes = fontFiles.reduce(
  (n, file) => n + readFileSync(`dist/${file}`).length,
  0,
);
assert.ok(fontBytes < 20 * 1024, "Self-hosted fonts exceed 20 KiB");
assert.ok(
  initial + fontBytes < 205 * 1024,
  "Combined startup + fonts exceeds 205 KiB",
);
console.log(
  `Fonts: ${(fontBytes / 1024).toFixed(1)} KiB; combined startup: ${((initial + fontBytes) / 1024).toFixed(1)} KiB.`,
);
for (const world of worlds) {
  const additions = [...graph([world])].filter((key) => !first.has(key));
  console.log(
    `${world.split("/").at(-1)} additional JS: ${(additions.reduce((n, key) => n + gz(manifest[key].file), 0) / 1024).toFixed(1)} KiB gzip.`,
  );
}
console.log(
  "Passed lazy stage, OAuth, garage, postprocessing, and startup-size guards.",
);
