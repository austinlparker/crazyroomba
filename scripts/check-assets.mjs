import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const pkg = json("package.json");
const ruleset = readFileSync("src/game/simulation.ts", "utf8").match(
  /export const RULESET = "([^"]+)"/,
)?.[1];
assert.equal(
  ruleset,
  pkg.version,
  "Package and replay ruleset versions differ",
);

const expected = new Set();
function verify(file, metadata) {
  assert.ok(!file.includes(".."), `Asset path escapes public/: ${file}`);
  const data = readFileSync(join("public", file));
  assert.equal(data.length, Number(metadata.size), `${file}: size changed`);
  assert.equal(
    createHash("sha256").update(data).digest("hex"),
    metadata.sha256,
    `${file}: content differs from its provenance manifest`,
  );
  expected.add(file);
}
for (const clip of Object.values(json("public/voice/manifest.json").voices)) {
  assert.equal(basename(clip.file), clip.file);
  verify(`voice/${clip.file}`, clip);
}
for (const clip of Object.values(json("public/audio/manifest.json").assets))
  verify(clip.file, clip);
for (const track of Object.values(json("public/music/manifest.json").tracks)) {
  assert.equal(basename(track.file), track.file);
  verify(`music/${track.file}`, track);
}
for (const directory of ["voice", "audio", "music"])
  for (const name of readdirSync(`public/${directory}`))
    if (name.endsWith(".mp3"))
      assert.ok(
        expected.has(`${directory}/${name}`),
        `Unlisted audio: ${directory}/${name}`,
      );

console.log(
  `Verified ${expected.size} shipped audio files and ruleset ${ruleset}.`,
);
