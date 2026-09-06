// Run against `npm run dev:worker`, after `npm run db:local`.
// The test inserts a session directly into LOCAL D1 only. Production has no test auth endpoint.
// PDS proof verification is exercised separately in worker/auth.test.ts with signed keys.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:8787";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))
  throw new Error("Integration test requires a local Worker.");
const ruleset = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;
const post = (path, data, extra = {}) =>
  fetch(`${origin}${path}`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", ...extra },
    body: JSON.stringify(data),
  });
assert.equal(
  (await post("/api/runs", { ruleset })).status,
  401,
  "Guest cannot start a ranked run",
);
assert.equal(
  (await post("/api/scores", { ruleset, did: "did:web:fake.example" })).status,
  401,
  "Client DID is not authentication",
);
assert.equal(
  (
    await post(
      "/api/runs",
      { ruleset },
      { Origin: "https://untrusted.example" },
    )
  ).status,
  403,
);
assert.equal(
  (await fetch(`${origin}/api/leaderboard?day=2026-99-99`)).status,
  400,
);
const metadata = await (await fetch(`${origin}/client-metadata.json`)).json();
const config = await (await fetch(`${origin}/api/auth-config`)).json();
assert.equal(metadata.client_id, `${origin}/client-metadata.json`);
assert.equal(metadata.scope, config.scope);
assert.ok(config.scope.startsWith("atproto rpc:"));
assert.ok(!config.scope.includes("repo:"));

const fixtureDir = mkdtempSync(join(tmpdir(), "roomba-api-qa-"));
const fixtureDid = `did:web:qa-${randomUUID()}.example`;
const otherDid = `did:web:other-${randomUUID()}.example`;
const token = randomBytes(32).toString("hex");
const otherToken = randomBytes(32).toString("hex");
const tokenHash = (value) => createHash("sha256").update(value).digest("hex");
const cookie = `roomba-session-local=${token}`;
const otherCookie = `roomba-session-local=${otherToken}`;
const sqlFile = join(fixtureDir, "fixture.sql");
function localSql(sql) {
  writeFileSync(sqlFile, sql);
  execFileSync(
    process.execPath,
    [
      join(root, "node_modules/wrangler/bin/wrangler.js"),
      "d1",
      "execute",
      "crazy-roomba-v2",
      "--local",
      ...(process.env.TEST_PERSIST_TO
        ? ["--persist-to", process.env.TEST_PERSIST_TO]
        : []),
      "--file",
      sqlFile,
      "--yes",
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        WRANGLER_LOG_PATH: join(fixtureDir, "wrangler.log"),
        WRANGLER_SEND_METRICS: "false",
      },
      stdio: "pipe",
      timeout: 30000,
    },
  );
}
try {
  for (const [did, secret] of [
    [fixtureDid, token],
    [otherDid, otherToken],
  ])
    localSql(
      `INSERT INTO auth_sessions (token_hash,did,handle,display_name,avatar,created_at,expires_at) VALUES ('${tokenHash(secret)}','${did}','qa.example','Local QA',NULL,${Date.now()},${Date.now() + 3600000});`,
    );
  const authed = (path, data, extra = {}) =>
    post(path, data, { Cookie: cookie, ...extra });
  const profile = await (
    await fetch(`${origin}/api/session`, { headers: { Cookie: cookie } })
  ).json();
  assert.equal(profile.profile.did, fixtureDid);
  assert.equal((await authed("/api/runs", { ruleset: "old" })).status, 409);
  const response = await authed("/api/runs", { ruleset });
  assert.equal(response.status, 201);
  const ticket = await response.json();
  assert.equal(ticket.did, fixtureDid);
  assert.ok(["apartment", "house", "culdesac", "moon"].includes(ticket.stage));
  const payload = {
    ticket: ticket.id,
    name: "Fake callsign",
    did: otherDid,
    ruleset,
    replay: [
      [64, 1],
      [0, 5399],
    ],
    score: 999999999,
  };
  assert.equal(
    (await authed("/api/scores", payload)).status,
    400,
    "Cannot finish faster than real time",
  );
  assert.equal(
    (await authed("/api/scores", payload, { Cookie: otherCookie })).status,
    403,
    "Ticket belongs to its original account",
  );
  console.log(
    "Passed guest rejection, identity binding, origin, metadata, ruleset, and early-submit checks. Waiting for the real 90-second challenge window.",
  );
  await new Promise((resolve) => setTimeout(resolve, 90500));
  assert.equal(
    (await authed("/api/scores", { ...payload, replay: [[0, 5399]] })).status,
    400,
    "Reject incomplete replay",
  );
  assert.equal(
    (await authed("/api/scores", { ...payload, replay: [[128, 5400]] })).status,
    400,
    "Reject impossible input",
  );
  const race = await Promise.all([
    authed("/api/scores", payload),
    authed("/api/scores", payload),
  ]);
  assert.deepEqual(
    race.map((response) => response.status).sort(),
    [200, 201],
    "Exactly one concurrent submission creates a score; the retry returns it",
  );
  const saved = await race.find((response) => response.status === 201).json();
  assert.equal(saved.score, 0, "Server ignores a fabricated client score");
  assert.equal(
    (await authed("/api/scores", payload)).status,
    200,
    "Return the original verified score for a repeated ticket",
  );
  const board = await (
    await fetch(`${origin}/api/leaderboard?day=${ticket.day}`)
  ).json();
  assert.ok(
    board.entries.some(
      (entry) =>
        entry.did === fixtureDid &&
        entry.name === "Local QA" &&
        entry.handle === "qa.example" &&
        entry.score === 0,
    ),
  );
  console.log(
    "Passed replay derivation, spoofed identity rejection, idempotent submission and verified leaderboard persistence.",
  );
  const rateClient = `rate-test-${randomUUID()}`;
  const burst = await Promise.all(
    Array.from({ length: 35 }, () =>
      authed("/api/runs", { ruleset }, { "CF-Connecting-IP": rateClient }),
    ),
  );
  assert.equal(burst.filter((response) => response.status === 201).length, 30);
  assert.equal(burst.filter((response) => response.status === 429).length, 5);
  assert.equal(
    (
      await fetch(`${origin}/api/session`, {
        method: "DELETE",
        headers: { Origin: origin, Cookie: cookie },
      })
    ).status,
    200,
  );
  assert.equal(
    (await authed("/api/runs", { ruleset })).status,
    401,
    "Logout revokes server access",
  );
  console.log(
    "Passed atomic rate limit and server-side logout. Cleaning up local QA rows.",
  );
} finally {
  localSql(
    `DELETE FROM scores WHERE did IN ('${fixtureDid}','${otherDid}'); DELETE FROM tickets WHERE account_did IN ('${fixtureDid}','${otherDid}'); DELETE FROM auth_sessions WHERE did IN ('${fixtureDid}','${otherDid}');`,
  );
  rmSync(fixtureDir, { recursive: true, force: true });
}
