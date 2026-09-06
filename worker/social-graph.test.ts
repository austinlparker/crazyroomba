import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { relationships } from "./social-graph";

const origin = "https://game.example";
const actor = "did:plc:aaaaaaaaaaaaaaaaaaaaaaaa";
const peer = "did:plc:bbbbbbbbbbbbbbbbbbbbbbbb";
const other = "did:plc:cccccccccccccccccccccccc";
const collection = "app.bsky.graph.follow";
const link = (did = peer, rkey = "old") => ({ did, collection, rkey });
const uri = (did = peer, rkey = "old") => `at://${did}/${collection}/${rkey}`;
let appview: Record<string, unknown>;
let pages: Record<string, unknown>[];
let record: (url: URL) => Response;
let calls: URL[];
beforeEach(() => {
  appview = { actor, relationships: [{ did: peer, following: uri(actor) }] };
  pages = [{ total: 1, records: [link()], cursor: null }];
  calls = [];
  record = (url) =>
    Response.json({
      uri: uri(url.searchParams.get("repo")!, url.searchParams.get("rkey")!),
      value: { $type: collection, subject: actor },
    });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL, options: RequestInit) => {
      const url = new URL(input);
      calls.push(url);
      expect(options.redirect).toBe("manual");
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(new Headers(options.headers).has("Authorization")).toBe(false);
      expect(new Headers(options.headers).get("User-Agent")).toContain(
        "CrazyRoomba",
      );
      if (url.hostname === "public.api.bsky.app") return Response.json(appview);
      if (url.hostname === "constellation.microcosm.blue") {
        expect(url.pathname).toBe("/xrpc/blue.microcosm.links.getBacklinks");
        expect(url.searchParams.get("subject")).toBe(actor);
        expect(url.searchParams.get("source")).toBe(`${collection}:subject`);
        expect(url.searchParams.getAll("did")).toEqual([peer]);
        return Response.json(pages.length > 1 ? pages.shift() : pages[0]);
      }
      expect(url.hostname).toBe("slingshot.microcosm.blue");
      return record(url);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
const lookup = () => relationships(origin, actor, [peer]);
describe("Constellation mutual discovery", () => {
  it("finds a reciprocal edge that the AppView does not have, and hydrates its record", async () => {
    expect(await lookup()).toEqual([
      { did: peer, following: true, mutual: true },
    ]);
    expect(calls.map((u) => u.hostname)).toContain("slingshot.microcosm.blue");
  });
  it("backfills old follows absent from Constellation rather than treating empty as no relationship", async () => {
    pages = [{ total: 0, records: [], cursor: null }];
    appview.relationships = [
      { did: peer, following: uri(actor), followedBy: uri() },
    ];
    expect((await lookup())[0].mutual).toBe(true);
    expect(calls).toHaveLength(2);
  });
  it("requires an outgoing follow as well as an incoming backlink", async () => {
    appview.relationships = [{ did: peer }];
    expect(await lookup()).toEqual([
      { did: peer, following: false, mutual: false },
    ]);
    expect(calls).toHaveLength(2);
  });
  it.each([
    "blocking",
    "blockedBy",
    "blockingByList",
    "blockedByList",
    "notFound",
  ])(
    "preserves %s exclusions even when Constellation has a positive backlink",
    async (field) => {
      appview.relationships = [
        { did: peer, actor: peer, following: uri(actor), [field]: true },
      ];
      expect((await lookup())[0].mutual).toBe(false);
      expect(calls).toHaveLength(2);
    },
  );
  it("rejects stale backlinks whose record was deleted, including a stale AppView copy", async () => {
    appview.relationships = [
      { did: peer, following: uri(actor), followedBy: uri() },
    ];
    record = () => Response.json({ error: "RecordNotFound" }, { status: 400 });
    expect((await lookup())[0].mutual).toBe(false);
  });
  it("recovers a refollow with a different record key", async () => {
    appview.relationships = [
      { did: peer, following: uri(actor), followedBy: uri(peer, "new") },
    ];
    record = (url) =>
      url.searchParams.get("rkey") === "old"
        ? Response.json({ error: "RecordNotFound" }, { status: 400 })
        : Response.json({
            uri: uri(peer, "new"),
            value: { $type: collection, subject: actor },
          });
    expect((await lookup())[0].mutual).toBe(true);
  });
  it("does not trust a link whose current subject changed", async () => {
    record = () =>
      Response.json({
        uri: uri(),
        value: { $type: collection, subject: other },
      });
    expect((await lookup())[0].mutual).toBe(false);
  });
  it("follows backlink cursors and deduplicates records before verification", async () => {
    pages = [
      { total: 1, records: [link()], cursor: "next" },
      { total: 1, records: [link()], cursor: null },
    ];
    expect((await lookup())[0].mutual).toBe(true);
    expect(
      calls.filter((u) => u.hostname === "slingshot.microcosm.blue"),
    ).toHaveLength(1);
    expect(calls.some((u) => u.searchParams.get("cursor") === "next")).toBe(
      true,
    );
  });
  it.each([
    "repeated",
    "too-many",
    "wrong-author",
    "wrong-collection",
    "invalid-key",
    "no-cursor",
    "oversized",
  ])("fails closed on %s backlink responses", async (kind) => {
    if (kind === "repeated")
      pages = [{ total: 0, records: [], cursor: "same" }];
    if (kind === "too-many")
      pages = Array.from({ length: 5 }, (_, i) => ({
        total: 0,
        records: [],
        cursor: String(i),
      }));
    if (kind === "wrong-author") pages[0].records = [link(other)];
    if (kind === "wrong-collection")
      pages[0].records = [{ ...link(), collection: "sh.tangled.graph.follow" }];
    if (kind === "invalid-key") pages[0].records = [link(peer, "../../x")];
    if (kind === "no-cursor") delete pages[0].cursor;
    if (kind === "oversized") pages[0].padding = "x".repeat(70000);
    await expect(lookup()).rejects.toMatchObject({ status: 503 });
  });
  it.each([404, 429, 500, 302])(
    "treats a Slingshot HTTP %s as unavailable, not a missing follow",
    async (status) => {
      record = () => Response.json({ error: "Unavailable" }, { status });
      await expect(lookup()).rejects.toMatchObject({ status: 503 });
    },
  );
  it("rejects a mismatched hydration URI", async () => {
    record = () =>
      Response.json({
        uri: uri(other),
        value: { $type: collection, subject: actor },
      });
    await expect(lookup()).rejects.toMatchObject({ status: 503 });
  });
  it("bounds repeated invalid follow verifications", async () => {
    pages[0] = {
      total: 50,
      records: Array.from({ length: 50 }, (_, i) => link(peer, `key${i}`)),
      cursor: null,
    };
    record = () => Response.json({ error: "RecordNotFound" }, { status: 400 });
    await expect(lookup()).rejects.toMatchObject({ status: 503 });
    expect(
      calls.filter((u) => u.hostname === "slingshot.microcosm.blue"),
    ).toHaveLength(40);
  });
  it("does not perform graph requests for a solo board", async () => {
    expect(await relationships(origin, actor, [])).toEqual([]);
    expect(calls).toEqual([]);
  });
});
