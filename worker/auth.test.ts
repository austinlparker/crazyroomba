import type { AccountProfile, BoardPage, Ticket } from "../src/shared/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync } from "node:fs";
import { URL as NodeURL } from "node:url";
import { P256Keypair, Secp256k1Keypair, type Keypair } from "@atproto/crypto";
import {
  authConfig,
  AUTH_METHOD,
  sessionCookie,
  verifyServiceProof,
  serviceDocument,
} from "./auth";
import worker from "./index";
import { RULESET, utcDay, seedForDay } from "../src/game/simulation";
import { dailyStage } from "../src/game/stage-catalog";

type ApiBody<Path extends string> = Path extends `/api/leaderboard${string}`
  ? BoardPage
  : Path extends "/api/runs"
    ? Ticket
    : Path extends "/api/scores"
      ? { score: number }
      : Path extends "/api/session"
        ? { profile: AccountProfile | null }
        : Path extends "/api/auth-config"
          ? ReturnType<typeof authConfig>
          : Path extends "/.well-known/did.json"
            ? ReturnType<typeof serviceDocument>
            : Path extends "/client-metadata.json"
              ? { scope: string }
              : unknown;
type JsonResponse<Body> = Omit<Response, "json"> & {
  json<T = Body>(): Promise<T>;
};
function testEnv(): Env {
  return {
    DB: db,
    ASSETS: {
      fetch: vi.fn(),
      connect() {
        throw new Error("Unused by Worker");
      },
    },
  };
}

const origin = "https://crazy-roomba-v2.austin-855.workers.dev";
const did = "did:plc:aaaaaaaaaaaaaaaaaaaaaaaa";
const otherDid = "did:plc:bbbbbbbbbbbbbbbbbbbbbbbb";
const { audience, legacyAudience } = authConfig(new URL(origin));
const now = Date.parse("2026-09-05T12:00:00Z");

// Execute the actual migrations and SQL using SQLite; only the D1 transport is adapted.
class TestStatement implements D1PreparedStatement {
  private values: SQLInputValue[] = [];
  constructor(
    readonly sqlite: DatabaseSync,
    readonly query: string,
  ) {}
  bind(...values: unknown[]) {
    this.values = values as SQLInputValue[];
    return this;
  }
  async first<T>(column?: string): Promise<T | null> {
    const row = this.sqlite.prepare(this.query).get(...this.values);
    return row ? ((column ? row[column] : row) as T) : null;
  }
  execute<T>(): D1Result<T> {
    const result = this.sqlite.prepare(this.query).run(...this.values);
    return {
      success: true,
      results: [],
      meta: {
        changes: Number(result.changes),
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid),
        changed_db: !!result.changes,
      },
    };
  }
  async run<T>() {
    return this.execute<T>();
  }
  async all<T>(): Promise<D1Result<T>> {
    const rows = this.sqlite.prepare(this.query).all(...this.values) as T[];
    return {
      success: true,
      results: rows,
      meta: {
        changes: 0,
        duration: 0,
        size_after: 0,
        rows_read: rows.length,
        rows_written: 0,
        last_row_id: 0,
        changed_db: false,
      },
    };
  }
  raw(): never {
    throw new Error("Unused by Worker");
  }
}
class TestDatabase implements D1Database {
  readonly sqlite = new DatabaseSync(":memory:");
  constructor() {
    for (const name of [
      "0001_leaderboard.sql",
      "0002_authenticated_scores.sql",
    ])
      this.sqlite.exec(
        readFileSync(
          new NodeURL(`../migrations/${name}`, import.meta.url),
          "utf8",
        ),
      );
  }
  prepare(query: string) {
    return new TestStatement(this.sqlite, query);
  }
  async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    this.sqlite.exec("BEGIN");
    try {
      const results = statements.map((statement) => {
        if (!(statement instanceof TestStatement))
          throw new Error("Invalid test statement");
        return statement.execute<T>();
      });
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
  async exec(query: string) {
    this.sqlite.exec(query);
    return { count: 0, duration: 0 };
  }
  withSession(): never {
    throw new Error("Unused by Worker");
  }
  dump(): never {
    throw new Error("Unused by Worker");
  }
}

let key: Keypair;
let db: TestDatabase;
let fetchMock: ReturnType<typeof vi.fn>;
let documents: Record<string, unknown>;
let publicProfile: Record<string, unknown>;
function document(account = did, pair = key) {
  return {
    id: account,
    verificationMethod: [
      {
        id: `${account}#atproto`,
        controller: account,
        type: "Multikey",
        publicKeyMultibase: pair.did().slice(8),
      },
    ],
  };
}
async function proof(
  claims: Record<string, unknown> = {},
  header: Record<string, unknown> = {},
  pair = key,
) {
  const part = (data: unknown) =>
    Buffer.from(JSON.stringify(data)).toString("base64url");
  const input = `${part({ typ: "JWT", alg: pair.jwtAlg, ...header })}.${part({ iss: did, aud: audience, lxm: AUTH_METHOD, iat: Date.now() / 1000, exp: Date.now() / 1000 + 60, jti: crypto.randomUUID(), ...claims })}`;
  return `${input}.${Buffer.from(await pair.sign(new TextEncoder().encode(input))).toString("base64url")}`;
}
async function call<Path extends string>(
  path: Path,
  options: {
    method?: string;
    data?: unknown;
    cookie?: string;
    authorization?: string;
    origin?: string;
  } = {},
) {
  const method =
    options.method || (options.data === undefined ? "GET" : "POST");
  const headers = new Headers({ Origin: options.origin ?? origin });
  if (options.data !== undefined)
    headers.set("Content-Type", "application/json");
  if (options.cookie) headers.set("Cookie", options.cookie);
  if (options.authorization)
    headers.set("Authorization", options.authorization);
  return worker.fetch(
    new Request(`${origin}${path}`, {
      method,
      headers,
      body:
        options.data === undefined ? undefined : JSON.stringify(options.data),
    }),
    testEnv(),
  ) as Promise<JsonResponse<ApiBody<Path>>>;
}
async function signIn(account = did) {
  const response = await call("/api/session", {
    data: {},
    authorization: `Bearer ${await proof({ iss: account })}`,
  });
  expect(response.status).toBe(200);
  return response.headers.get("Set-Cookie")!.split(";")[0];
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  key = await Secp256k1Keypair.create();
  db = new TestDatabase();
  documents = { [did]: document(), [otherDid]: document(otherDid) };
  publicProfile = {
    did,
    handle: "player.bsky.social",
    displayName: "Player One",
    avatar: "https://cdn.bsky.app/img/avatar/plain/did:plc:aaa/avatar@jpeg",
  };
  fetchMock = vi.fn(
    async (input: string | URL | Request, options?: RequestInit) => {
      expect(options?.redirect).toBe("manual");
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      if (url.hostname === "plc.directory")
        return Response.json(documents[url.pathname.slice(1)]);
      if (url.hostname === "player.example.com")
        return Response.json(documents["did:web:player.example.com"]);
      if (url.hostname === "public.api.bsky.app")
        return Response.json(publicProfile);
      throw new Error(`Unexpected fetch: ${url}`);
    },
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  db.sqlite.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("PDS service proof verification", () => {
  it.each(["ES256", "ES256K"])(
    "verifies %s signatures against the account's DID key",
    async (algorithm) => {
      const pair = algorithm === "ES256" ? await P256Keypair.create() : key;
      documents[did] = document(did, pair);
      expect(
        (
          await verifyServiceProof(
            await proof({}, {}, pair),
            new URL(origin),
            now,
          )
        ).did,
      ).toBe(did);
    },
  );
  it("supports public hostname did:web identities", async () => {
    const account = "did:web:player.example.com";
    documents[account] = document(account);
    expect(
      (
        await verifyServiceProof(
          await proof({ iss: account }),
          new URL(origin),
          now,
        )
      ).did,
    ).toBe(account);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://player.example.com/.well-known/did.json",
    );
  });
  it.each(["ES256", "ES256K"])(
    "verifies legacy bare-DID proofs with %s signatures",
    async (algorithm) => {
      const pair = algorithm === "ES256" ? await P256Keypair.create() : key;
      documents[did] = document(did, pair);
      expect(
        (
          await verifyServiceProof(
            await proof({ aud: legacyAudience }, {}, pair),
            new URL(origin),
            now,
          )
        ).did,
      ).toBe(did);
    },
  );
  it.each([
    { aud: "did:web:other.example.com#crazy_roomba" },
    { aud: "did:web:other.example.com" },
    { aud: `${legacyAudience}#another_service` },
    { aud: `${legacyAudience}#` },
    { aud: `${legacyAudience}%23crazy_roomba` },
    { aud: legacyAudience, lxm: "app.bsky.feed.post" },
    { aud: legacyAudience, exp: now / 1000 + 121 },
    { lxm: "app.bsky.feed.post" },
    { exp: now / 1000 },
    { exp: now / 1000 + 121 },
    { iat: now / 1000 + 11 },
    { iat: now / 1000 - 121 },
    { jti: "" },
    { nbf: now / 1000 + 1 },
    { iss: "did:web:127.0.0.1" },
    { iss: "did:web:localhost" },
    { iss: "did:web:site.internal" },
    { iss: "did:web:site.example.com%3A443" },
    { iss: "did:plc:invalid" },
  ])("rejects invalid claims before fetching: %j", async (claims) => {
    await expect(
      verifyServiceProof(await proof(claims), new URL(origin), now),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    { alg: "none" },
    { alg: "HS256" },
    { typ: "dpop+jwt" },
    { kid: "#atproto_label" },
    { crit: ["extension"] },
  ])("rejects JWT confusion: %j", async (header) => {
    await expect(
      verifyServiceProof(await proof({}, header), new URL(origin), now),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("rejects a signed token with a tampered payload", async () => {
    const parts = (await proof()).split(".");
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    parts[1] = Buffer.from(
      JSON.stringify({ ...claims, jti: "tampered-proof-identifier" }),
    ).toString("base64url");
    await expect(
      verifyServiceProof(parts.join("."), new URL(origin), now),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("rejects another account's DID document and a foreign key controller", async () => {
    const token = await proof();
    documents[did] = document(otherDid);
    await expect(
      verifyServiceProof(token, new URL(origin), now),
    ).rejects.toMatchObject({ status: 401 });
    documents[did] = {
      id: did,
      verificationMethod: [
        { ...document().verificationMethod[0], controller: otherDid },
      ],
    };
    await expect(
      verifyServiceProof(token, new URL(origin), now),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe("authenticated leaderboard", () => {
  it.each([
    "crazy-roomba-v2.austin-855.workers.dev",
    "roomba.aparker.io",
    "game.example.com",
  ])(
    "redirects safe HTTP requests and rejects HTTP credentials on %s",
    async (host) => {
      const address = `http://${host}/api/session`;
      const env = testEnv();
      const redirect = await worker.fetch(new Request(address), env);
      expect(redirect.status).toBe(308);
      expect(redirect.headers.get("Location")).toBe(
        `https://${host}/api/session`,
      );
      for (const method of ["POST", "DELETE"]) {
        const response = await worker.fetch(
          new Request(address, {
            method,
            headers: {
              Origin: `http://${host}`,
              Authorization: "Bearer must-not-be-forwarded",
            },
          }),
          env,
        );
        expect(response.status).toBe(426);
        expect(response.headers.get("Location")).toBeNull();
        expect(response.headers.get("Set-Cookie")).toBeNull();
      }
      expect(fetchMock).not.toHaveBeenCalled();
      expect(authConfig(new URL(address)).audience).toBe(
        `did:web:${host}#crazy_roomba`,
      );
      expect(sessionCookie(new URL(address), "token")).toContain(
        "__Host-roomba-session=",
      );
      expect(sessionCookie(new URL(address), "token")).toContain("; Secure");
    },
  );
  it.each(["localhost", "127.0.0.1", "[::1]"])(
    "keeps local HTTP development available only at %s",
    async (host) => {
      const address = new URL(`http://${host}:8787/api/session`);
      const response = await worker.fetch(new Request(address), testEnv());
      expect(response.status).toBe(200);
      expect(authConfig(address).audience).toBe(
        "did:web:localhost%3A8787#crazy_roomba",
      );
      expect(sessionCookie(address, "token")).toContain(
        "roomba-session-local=",
      );
      expect(sessionCookie(address, "token")).not.toContain("; Secure");
    },
  );
  it("advertises a narrow game permission and DID service, without repository permissions", async () => {
    const config = await (await call("/api/auth-config")).json();
    const metadata = await (await call("/client-metadata.json")).json();
    const service = await (await call("/.well-known/did.json")).json();
    expect(config.scope).toBe(metadata.scope);
    expect(config.legacyAudience).toBe(service.id);
    expect(config.scope.split(" ")).toEqual([
      "atproto",
      `rpc:${AUTH_METHOD}?aud=*`,
    ]);
    expect(service.service[0].id).toBe(config.audience);
  });
  it("supports custom-domain OAuth without accepting proofs for the old hostname", async () => {
    const customOrigin = "https://roomba.aparker.io";
    const customAudience = "did:web:roomba.aparker.io#crazy_roomba";
    const env = testEnv();
    const read = async <Path extends string>(path: Path) =>
      (await worker.fetch(new Request(`${customOrigin}${path}`), env)).json<
        ApiBody<Path>
      >();
    const config = await read("/api/auth-config");
    const metadata = await read("/client-metadata.json");
    const service = await read("/.well-known/did.json");
    expect(config.audience).toBe(customAudience);
    expect(metadata).toMatchObject({
      client_id: `${customOrigin}/client-metadata.json`,
      client_uri: customOrigin,
      redirect_uris: [`${customOrigin}/`],
      scope: config.scope,
    });
    expect(service.id).toBe("did:web:roomba.aparker.io");
    expect(service.service[0]).toMatchObject({
      id: customAudience,
      serviceEndpoint: customOrigin,
    });
    const exchange = async (token: string) =>
      worker.fetch(
        new Request(`${customOrigin}/api/session`, {
          method: "POST",
          headers: {
            Origin: customOrigin,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        }),
        env,
      );
    expect((await exchange(await proof())).status).toBe(401);
    const token = await proof({ aud: customAudience });
    const signedIn = await exchange(token);
    expect(signedIn.status).toBe(200);
    expect(
      (await signedIn.json<{ profile: AccountProfile }>()).profile!.did,
    ).toBe(did);
    expect(signedIn.headers.get("Set-Cookie")).toContain(
      "__Host-roomba-session=",
    );
    expect(signedIn.headers.get("Set-Cookie")).not.toContain("Domain=");
    expect(
      (
        await call("/api/session", {
          data: {},
          authorization: `Bearer ${await proof({ aud: customAudience })}`,
        })
      ).status,
    ).toBe(401);
  });
  it("rejects guests and ignores a caller-supplied DID as authentication", async () => {
    expect(
      (await call("/api/runs", { data: { ruleset: RULESET, did } })).status,
    ).toBe(401);
    expect(
      (
        await call("/api/scores", {
          data: { ruleset: RULESET, did, name: "fake" },
        })
      ).status,
    ).toBe(401);
    expect((await (await call("/api/session")).json()).profile).toBeNull();
  });
  it("uses an HttpOnly secure session and server profile, with no raw token in storage or JSON", async () => {
    const response = await call("/api/session", {
      data: { did: otherDid, handle: "fake.example.com" },
      authorization: `Bearer ${await proof()}`,
    });
    const cookie = response.headers.get("Set-Cookie")!;
    expect(cookie).toContain("__Host-roomba-session=");
    expect(cookie).toContain("HttpOnly; SameSite=Lax;");
    expect(cookie).toContain("; Secure");
    const result = await response.json();
    expect(result.profile).toMatchObject({
      did,
      handle: "player.bsky.social",
      displayName: "Player One",
    });
    const stored = db.sqlite
      .prepare("SELECT token_hash FROM auth_sessions")
      .get()!;
    expect(cookie).not.toContain(String(stored.token_hash));
    expect(JSON.stringify(result)).not.toContain(
      cookie.split("=")[1].split(";")[0],
    );
    expect(
      (
        await (
          await call("/api/session", { cookie: cookie.split(";")[0] })
        ).json()
      ).profile!.did,
    ).toBe(did);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("consumes each signed proof once even when exchanged concurrently", async () => {
    const token = await proof();
    const responses = await Promise.all([
      call("/api/session", { data: {}, authorization: `Bearer ${token}` }),
      call("/api/session", { data: {}, authorization: `Bearer ${token}` }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 401,
    ]);
    expect(
      db.sqlite.prepare("SELECT count(*) AS n FROM auth_sessions").get()!.n,
    ).toBe(1);
  });
  it("shares nonce replay protection across modern and legacy audiences", async () => {
    const jti = crypto.randomUUID();
    for (const [aud, expectedStatus] of [
      [legacyAudience, 200],
      [audience, 401],
    ] as const) {
      const response = await call("/api/session", {
        data: {},
        authorization: `Bearer ${await proof({ aud, jti })}`,
      });
      expect(response.status).toBe(expectedStatus);
    }
    expect(
      db.sqlite.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get()
        ?.count,
    ).toBe(1);
  });
  it("requires same origin for sign-in, score changes, and logout", async () => {
    const cookie = await signIn();
    for (const path of ["/api/session", "/api/runs", "/api/scores"])
      expect(
        (
          await call(path, {
            data: {},
            cookie,
            origin: "https://other.example.com",
          })
        ).status,
      ).toBe(403);
    expect(
      (
        await call("/api/session", {
          method: "DELETE",
          cookie,
          origin: "https://other.example.com",
        })
      ).status,
    ).toBe(403);
    expect(
      (await (await call("/api/session", { cookie })).json()).profile!.did,
    ).toBe(did);
  });
  it("revokes logout sessions and expires old sessions", async () => {
    const cookie = await signIn();
    expect(
      (await call("/api/session", { method: "DELETE", cookie })).headers.get(
        "Set-Cookie",
      ),
    ).toContain("Max-Age=0");
    expect(
      (await call("/api/runs", { data: { ruleset: RULESET }, cookie })).status,
    ).toBe(401);
    const second = await signIn();
    db.sqlite.exec(`UPDATE auth_sessions SET expires_at = ${now - 1}`);
    expect(
      (await call("/api/runs", { data: { ruleset: RULESET }, cookie: second }))
        .status,
    ).toBe(401);
  });
  it("binds tickets to the signed-in DID, derives scores, and ignores fabricated identity fields", async () => {
    const cookie = await signIn();
    const response = await call("/api/runs", {
      data: { ruleset: RULESET, did: otherDid },
      cookie,
    });
    expect(response.status).toBe(201);
    const ticket = await response.json();
    expect(ticket.did).toBe(did);
    const payload = {
      ticket: ticket.id,
      ruleset: RULESET,
      replay: [
        [64, 1],
        [0, 5399],
      ],
      score: 999999,
      did: otherDid,
      name: "Impersonator",
      avatar: "https://evil.example/pixel",
    };
    expect((await call("/api/scores", { data: payload, cookie })).status).toBe(
      400,
    );
    db.sqlite
      .prepare("UPDATE tickets SET created_at = ? WHERE id = ?")
      .run(now - 90001, ticket.id);
    const other = await signIn(otherDid);
    expect(
      (await call("/api/scores", { data: payload, cookie: other })).status,
    ).toBe(403);
    const race = await Promise.all([
      call("/api/scores", { data: payload, cookie }),
      call("/api/scores", { data: payload, cookie }),
    ]);
    expect(race.map((response) => response.status).sort()).toEqual([200, 201]);
    const board = await (
      await call(`/api/leaderboard?day=${ticket.day}`)
    ).json();
    expect(board.entries).toHaveLength(1);
    expect(board.entries[0]).toMatchObject({
      did,
      handle: "player.bsky.social",
      name: "Player One",
      displayName: "Player One",
      score: 0,
      avatar: publicProfile.avatar,
    });
    const originalScore = board.entries[0].score;
    const retry = await call("/api/scores", {
      data: { ...payload, replay: "changed", score: 999999 },
      cookie,
    });
    expect(retry.status).toBe(200);
    expect((await retry.json()).score).toBe(originalScore);
    expect(
      (await call("/api/scores", { data: payload, cookie: other })).status,
    ).toBe(403);
    db.sqlite.prepare("DELETE FROM tickets WHERE id = ?").run(ticket.id);
    expect((await call("/api/scores", { data: payload, cookie })).status).toBe(
      200,
    );
    expect(
      db.sqlite
        .prepare("SELECT COUNT(*) AS n FROM scores WHERE id = ?")
        .get(ticket.id)?.n,
    ).toBe(1);
  });
  it("rotates server-issued daily tickets exactly at UTC midnight, ignoring client dates", async () => {
    vi.setSystemTime(new Date("2026-09-05T23:59:59Z"));
    const cookie = await signIn();
    const issue = () =>
      call("/api/runs", {
        data: { ruleset: RULESET, day: "1999-01-01", seed: 1, stage: "moon" },
        cookie,
      });
    vi.setSystemTime(new Date("2026-09-05T23:59:59.999Z"));
    const before = await issue();
    const old = await before.json();
    expect(before.status).toBe(201);
    expect(before.headers.get("Cache-Control")).toBe("no-store");
    expect(old).toMatchObject({
      day: "2026-09-05",
      seed: seedForDay("2026-09-05"),
      stage: dailyStage("2026-09-05"),
    });
    vi.setSystemTime(new Date("2026-09-06T00:00:00.000Z"));
    const current = await (await issue()).json();
    expect(current).toMatchObject({
      day: "2026-09-06",
      seed: seedForDay("2026-09-06"),
      stage: dailyStage("2026-09-06"),
    });
    expect(current.seed).not.toBe(old.seed);
    expect(current.stage).not.toBe(old.stage);
    expect(await (await issue()).json()).toMatchObject({
      day: current.day,
      seed: current.seed,
      stage: current.stage,
    });
  });

  it("accepts a run finishing after midnight on its original board and starts a fresh current board", async () => {
    vi.setSystemTime(new Date("2026-09-05T23:59:30Z"));
    const cookie = await signIn();
    const ticket = await (
      await call("/api/runs", { data: { ruleset: RULESET }, cookie })
    ).json();
    vi.setSystemTime(new Date("2026-09-06T00:01:00Z"));
    const result = await call("/api/scores", {
      data: { ticket: ticket.id, ruleset: RULESET, replay: [[0, 5400]] },
      cookie,
    });
    expect(result.status).toBe(201);
    const today = await call("/api/leaderboard");
    expect(today.headers.get("Cache-Control")).toBe("no-store");
    expect(await today.json()).toMatchObject({
      day: "2026-09-06",
      stage: dailyStage("2026-09-06"),
      entries: [],
    });
    const yesterday = await (
      await call("/api/leaderboard?day=2026-09-05")
    ).json();
    expect(yesterday.entries).toHaveLength(1);
    expect(yesterday.entries[0]).toMatchObject({ did, score: 0 });
    expect(
      db.sqlite.prepare("SELECT day FROM scores WHERE id = ?").get(ticket.id)
        ?.day,
    ).toBe("2026-09-05");
  });

  it("rejects incomplete/invalid replays, old rulesets and malformed dates", async () => {
    const cookie = await signIn();
    expect(
      (await call("/api/runs", { data: { ruleset: "old" }, cookie })).status,
    ).toBe(409);
    const ticket = await (
      await call("/api/runs", { data: { ruleset: RULESET }, cookie })
    ).json();
    db.sqlite
      .prepare("UPDATE tickets SET created_at = ? WHERE id = ?")
      .run(now - 90001, ticket.id);
    for (const replay of [[[0, 5399]], [[128, 5400]]])
      expect(
        (
          await call("/api/scores", {
            data: { ticket: ticket.id, ruleset: RULESET, replay },
            cookie,
          })
        ).status,
      ).toBe(400);
    expect((await call("/api/leaderboard?day=2026-99-99")).status).toBe(400);
  });
  it("retains historical anonymous rows without presenting them as verified ranked accounts", async () => {
    db.sqlite
      .prepare(
        "INSERT INTO scores (id,day,ruleset,name,score,deposited,created_at) VALUES ('legacy',?,?, 'Unverified',999,0,?)",
      )
      .run(utcDay(), RULESET, new Date().toISOString());
    expect((await (await call("/api/leaderboard")).json()).entries).toEqual([]);
    expect(
      db.sqlite.prepare("SELECT name FROM scores WHERE id='legacy'").get()!
        .name,
    ).toBe("Unverified");
  });
  it("falls back to the verified DID when the profile is missing, mismatched, or has no valid handle", async () => {
    publicProfile = {
      did: otherDid,
      handle: "impersonator.bsky.social",
      avatar: "https://evil.example/avatar",
    };
    const cookie = await signIn();
    expect(
      (await (await call("/api/session", { cookie })).json()).profile,
    ).toEqual({ did, handle: did, displayName: "", avatar: null });
  });
  it("preserves the atomic 30-start rate limit for authenticated accounts", async () => {
    const cookie = await signIn();
    const responses = await Promise.all(
      Array.from({ length: 35 }, () =>
        call("/api/runs", { data: { ruleset: RULESET }, cookie }),
      ),
    );
    expect(
      responses.filter((response) => response.status === 201),
    ).toHaveLength(30);
    expect(
      responses.filter((response) => response.status === 429),
    ).toHaveLength(5);
  });
});

// Social boards use public relationships and the verified cookie, never a caller-supplied DID.
describe("social leaderboards", () => {
  const day = utcDay(new Date(now));
  const player = (i: number) => `did:plc:${String(i).padStart(24, "a")}`;
  function score(
    account: string,
    points: number,
    id: string = crypto.randomUUID(),
    at = now - 1000,
  ) {
    db.sqlite
      .prepare(
        "INSERT INTO scores (id,day,ruleset,name,score,deposited,created_at,did,handle,display_name,avatar) VALUES (?,?,?,?,?,0,?,?,?,?,NULL)",
      )
      .run(
        id,
        day,
        RULESET,
        account,
        points,
        new Date(at).toISOString(),
        account,
        "player.example",
        "Driver",
      );
    return id;
  }
  function mockGraph(
    relations: Record<string, Record<string, unknown>>,
    actor = did,
  ) {
    fetchMock.mockImplementation(
      async (input: string | URL, options?: RequestInit) => {
        expect(options?.redirect).toBe("manual");
        expect(new Headers(options?.headers).has("Authorization")).toBe(false);
        const url = new URL(input);
        if (url.origin === "https://constellation.microcosm.blue") {
          expect(url.searchParams.get("subject")).toBe(did);
          expect(url.searchParams.get("source")).toBe(
            "app.bsky.graph.follow:subject",
          );
          return Response.json({ total: 0, records: [], cursor: null });
        }
        expect(url.origin).toBe("https://public.api.bsky.app");
        expect(url.pathname).toBe("/xrpc/app.bsky.graph.getRelationships");
        expect(url.searchParams.get("actor")).toBe(did);
        const others = url.searchParams.getAll("others");
        expect(others.length).toBeLessThanOrEqual(30);
        expect(others).not.toContain(did);
        return Response.json({
          actor,
          relationships: others.map((id) => ({ did: id, ...relations[id] })),
        });
      },
    );
    fetchMock.mockClear();
  }
  const following = () => ({
    following: `at://${did}/app.bsky.graph.follow/1`,
  });
  const mutual = (account: string) => ({
    ...following(),
    followedBy: `at://${account}/app.bsky.graph.follow/2`,
  });
  async function board(
    scope = "world",
    cookie?: string,
    cursor?: string | null,
  ) {
    return call(
      `/api/leaderboard?day=${day}&scope=${scope}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      { cookie },
    );
  }
  it("keeps World public, with one best run per DID and deterministic ties", async () => {
    score(did, 100, "earlier", now - 2000);
    score(did, 90, "worse");
    score(did, 100, "later");
    score(otherDid, 100, "other", now - 1000);
    const response = await board();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const data = await response.json();
    expect(
      data.entries.map((e: { did: string; rank: number }) => [e.did, e.rank]),
    ).toEqual([
      [did, 1],
      [otherDid, 2],
    ]);
    expect(data.entries[0].created_at).toBe(new Date(now - 2000).toISOString());
    expect(data.viewer).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["following", "mutuals"])(
    "requires a real session for %s, ignoring a forged viewer",
    async (scope) => {
      const response = await call(
        `/api/leaderboard?day=${day}&scope=${scope}&viewer=${did}&did=${did}`,
      );
      expect(response.status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it("distinguishes following from mutuals, includes yourself, and ignores inbound-only follows", async () => {
    const cookie = await signIn();
    const outbound = player(1),
      inbound = player(2),
      both = player(3),
      stranger = player(4);
    [outbound, inbound, both, stranger, did].forEach((id, i) =>
      score(id, 500 - i * 10),
    );
    mockGraph({
      [outbound]: following(),
      [inbound]: { followedBy: `at://${inbound}/app.bsky.graph.follow/2` },
      [both]: mutual(both),
    });
    const follow = await (await board("following", cookie)).json();
    expect(follow.viewer).toBe(did);
    expect(follow.entries.map((e: { did: string }) => e.did)).toEqual([
      outbound,
      both,
      did,
    ]);
    const mutuals = await (await board("mutuals", cookie)).json();
    expect(
      mutuals.entries.map((e: { did: string; rank: number }) => [
        e.did,
        e.rank,
      ]),
    ).toEqual([
      [both, 1],
      [did, 2],
    ]);
  });
  it("finds friends outside the global top 25 and continues beyond bounded scans", async () => {
    const cookie = await signIn();
    for (let i = 1; i <= 131; i++) score(player(i), 1000 - i);
    mockGraph({ [player(130)]: mutual(player(130)) });
    const first = await (await board("mutuals", cookie)).json();
    expect(first.entries).toEqual([]);
    expect(first.nextCursor).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(8);
    const second = await (
      await board("mutuals", cookie, first.nextCursor)
    ).json();
    expect(second.entries).toMatchObject([{ did: player(130), rank: 1 }]);
    expect(second.nextCursor).toBeNull();
  });
  it("does not lose matches at a page boundary or duplicate a player's multiple runs", async () => {
    const cookie = await signIn();
    const graph: Record<string, Record<string, unknown>> = {};
    for (let i = 1; i <= 34; i++) {
      score(player(i), 1000 - i);
      graph[player(i)] = mutual(player(i));
    }
    score(player(1), 5);
    mockGraph(graph);
    const first = await (await board("mutuals", cookie)).json();
    expect(first.entries).toHaveLength(25);
    const next = await (
      await board("mutuals", cookie, first.nextCursor)
    ).json();
    expect(next.entries).toHaveLength(9);
    expect(next.entries[0]).toMatchObject({ did: player(26), rank: 26 });
    expect(next.nextCursor).toBeNull();
  });
  it("holds a stable score snapshot while new scores arrive between pages", async () => {
    for (let i = 1; i <= 30; i++) score(player(i), 1000 - i);
    const first = await (await board()).json();
    score(player(30), 2000, "new-run", now + 1);
    score(player(999), 9000, "new-player", now + 1);
    vi.spyOn(Date, "now").mockReturnValue(now + 2000);
    const next = await (
      await board("world", undefined, first.nextCursor)
    ).json();
    expect(
      next.entries.map((e: { did: string; score: number }) => [e.did, e.score]),
    ).toEqual(Array.from({ length: 5 }, (_, i) => [player(i + 26), 974 - i]));
    expect((await (await board()).json()).entries[0].did).toBe(player(999));
  });
  it("binds cursor to date, filter, viewer, and a ten-minute lifetime", async () => {
    const cookie = await signIn();
    for (let i = 1; i <= 26; i++) score(player(i), i);
    const first = await (await board("world", cookie)).json();
    expect((await board("following", cookie, first.nextCursor)).status).toBe(
      400,
    );
    expect((await board("world", undefined, first.nextCursor)).status).toBe(
      400,
    );
    expect(
      (
        await call(
          `/api/leaderboard?day=2026-09-04&cursor=${encodeURIComponent(first.nextCursor!)}`,
          { cookie },
        )
      ).status,
    ).toBe(400);
    expect((await board("world", cookie, "garbage")).status).toBe(400);
    vi.spyOn(Date, "now").mockReturnValue(now + 600001);
    expect((await board("world", cookie, first.nextCursor)).status).toBe(409);
  });
  it.each(["blocking", "blockedBy", "blockingByList", "blockedByList"])(
    "excludes %s relationships even if stale follow records remain",
    async (field) => {
      const cookie = await signIn();
      score(otherDid, 100);
      mockGraph({ [otherDid]: { ...mutual(otherDid), [field]: "at://block" } });
      expect((await (await board("mutuals", cookie)).json()).entries).toEqual(
        [],
      );
    },
  );
  it("handles deleted participants without dropping valid mutuals", async () => {
    const cookie = await signIn();
    score(otherDid, 100);
    score(player(2), 50);
    mockGraph({
      [otherDid]: { actor: otherDid, notFound: true },
      [player(2)]: mutual(player(2)),
    });
    expect(
      (await (await board("mutuals", cookie)).json()).entries,
    ).toMatchObject([{ did: player(2) }]);
  });
  it.each([
    "failure",
    "redirect",
    "wrong-actor",
    "missing",
    "duplicate",
    "oversized",
  ])(
    "returns a retryable error for %s instead of a misleading empty social board",
    async (failure) => {
      const cookie = await signIn();
      score(otherDid, 100);
      score(player(2), 50);
      fetchMock.mockImplementation(async () => {
        if (failure === "redirect")
          return new Response(null, {
            status: 302,
            headers: { Location: "https://other.example" },
          });
        if (failure === "failure")
          return new Response("Rate limited", { status: 429 });
        if (failure === "oversized")
          return Response.json({ padding: "x".repeat(70000) });
        return Response.json({
          actor: failure === "wrong-actor" ? otherDid : did,
          relationships:
            failure === "missing" ? [] : [{ did: otherDid }, { did: otherDid }],
        });
      });
      const response = await board("mutuals", cookie);
      expect(response.status).toBe(503);
      expect((await response.json<{ error: string }>()).error).toContain(
        "Connections unavailable",
      );
    },
  );
  it("shares only a short-lived, actor-bound cache between the two social filters", async () => {
    const cookie = await signIn();
    score(otherDid, 100);
    const stored = new Map<string, Response>();
    const put = vi.fn(async (key: Request, value: Response) => {
      stored.set(key.url, value.clone());
    });
    vi.stubGlobal("caches", {
      default: {
        match: async (key: Request) => stored.get(key.url)?.clone(),
        put,
      },
    });
    mockGraph({ [otherDid]: mutual(otherDid) });
    await board("following", cookie);
    await board("mutuals", cookie);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(put).toHaveBeenCalledTimes(1);
    const [key, cached] = put.mock.calls[0];
    expect(key.url).not.toContain(did);
    expect(cached.headers.get("Cache-Control")).toBe("public, max-age=120");
    expect(await cached.json()).toEqual([
      { did: otherDid, following: true, mutual: true },
    ]);
    expect((await call(new URL(key.url).pathname)).status).toBe(404);
  });
  it("continues without an edge cache, and never caches an upstream error", async () => {
    const cookie = await signIn();
    score(otherDid, 100);
    const put = vi.fn(async () => {
      throw new Error("cache offline");
    });
    vi.stubGlobal("caches", {
      default: {
        match: async () => {
          throw new Error();
        },
        put,
      },
    });
    mockGraph({ [otherDid]: mutual(otherDid) });
    expect((await board("mutuals", cookie)).status).toBe(200);
    put.mockClear();
    fetchMock.mockRejectedValue(new Error("offline"));
    expect((await board("mutuals", cookie)).status).toBe(503);
    expect(put).not.toHaveBeenCalled();
  });
  it("validates scope and calendar dates", async () => {
    expect((await board("followers")).status).toBe(400);
    expect((await call("/api/leaderboard?day=2026-02-30")).status).toBe(400);
  });
});
