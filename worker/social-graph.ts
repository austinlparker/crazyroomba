import { HttpError, readJson } from "./http";

export type Relationship = { did: string; following: boolean; mutual: boolean };
const FOLLOW = "app.bsky.graph.follow";
const TTL = 120;
const HEADERS = {
  Accept: "application/json",
  "User-Agent": "CrazyRoomba/2.10 (+https://roomba.aparker.io/)",
};
type Link = { did: string; collection: string; rkey: string };

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid graph object");
  return value as Record<string, unknown>;
}
function followUri(value: unknown, author: string): value is string {
  if (typeof value !== "string") return false;
  const prefix = `at://${author}/${FOLLOW}/`;
  return (
    value.startsWith(prefix) &&
    /^[a-zA-Z0-9._~:-]{1,512}$/.test(value.slice(prefix.length))
  );
}
async function get(
  url: URL,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  return readJson(
    await fetch(url, { headers: HEADERS, redirect: "manual", signal }),
  );
}

/** Constellation is a backlink index: these are the candidates who follow the viewer. */
async function incoming(
  actor: string,
  others: string[],
  signal: AbortSignal,
): Promise<Map<string, Link[]>> {
  const url = new URL(
    "https://constellation.microcosm.blue/xrpc/blue.microcosm.links.getBacklinks",
  );
  url.searchParams.set("subject", actor);
  url.searchParams.set("source", `${FOLLOW}:subject`);
  url.searchParams.set("limit", "100");
  others.forEach((did) => url.searchParams.append("did", did));
  const wanted = new Set(others),
    seen = new Set<string>(),
    cursors = new Set<string>();
  const result = new Map<string, Link[]>();
  for (let page = 0; page < 4; page++) {
    const data = await get(url, signal);
    if (
      !Array.isArray(data.records) ||
      data.records.length > 100 ||
      !Number.isSafeInteger(data.total) ||
      (data.total as number) < 0
    )
      throw new Error("Invalid backlink page");
    for (const item of data.records) {
      const record = object(item);
      if (
        typeof record.did !== "string" ||
        !wanted.has(record.did) ||
        record.collection !== FOLLOW ||
        typeof record.rkey !== "string" ||
        !followUri(`at://${record.did}/${FOLLOW}/${record.rkey}`, record.did)
      )
        throw new Error("Unexpected backlink author or record");
      const link: Link = {
        did: record.did,
        collection: FOLLOW,
        rkey: record.rkey,
      };
      const key = `${link.did}/${link.rkey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const links = result.get(link.did) || [];
      links.push(link);
      result.set(link.did, links);
    }
    if (data.cursor === null) return result;
    if (
      typeof data.cursor !== "string" ||
      !data.cursor ||
      data.cursor.length > 2048 ||
      cursors.has(data.cursor)
    )
      throw new Error("Invalid backlink cursor");
    cursors.add(data.cursor);
    url.searchParams.set("cursor", data.cursor);
  }
  throw new Error("Backlink scan incomplete");
}

/** Hydrate a discovered link through Microcosm's record cache, without following arbitrary URLs. */
async function currentFollow(
  link: Link,
  actor: string,
  signal: AbortSignal,
): Promise<boolean> {
  const url = new URL(
    "https://slingshot.microcosm.blue/xrpc/com.atproto.repo.getRecord",
  );
  url.search = new URLSearchParams({
    repo: link.did,
    collection: FOLLOW,
    rkey: link.rkey,
  }).toString();
  const response = await fetch(url, {
    headers: HEADERS,
    redirect: "manual",
    signal,
  });
  // Only an explicit RecordNotFound is a negative. A gateway 404 or timeout is unknown.
  if (response.status === 400 || response.status === 404) {
    const error = await readJson(new Response(response.body, { status: 200 }));
    if (error.error === "RecordNotFound") return false;
    throw new Error("Record lookup unavailable");
  }
  const data = await readJson(response);
  if (data.uri !== `at://${link.did}/${FOLLOW}/${link.rkey}`)
    throw new Error("Mismatched follow record");
  const record = object(data.value);
  if (record.$type !== FOLLOW || typeof record.subject !== "string")
    throw new Error("Invalid follow record");
  return record.subject === actor;
}

/**
 * Constellation supplies reciprocal follows. The public AppView supplies outgoing
 * follows, account/block exclusions, and historical edges missing from the index.
 * This intentionally remains a hybrid until Constellation's backfill is complete.
 */
export async function relationships(
  origin: string,
  actor: string,
  others: string[],
): Promise<Relationship[]> {
  if (!others.length) return [];
  if (
    others.length > 30 ||
    new Set(others).size !== others.length ||
    others.includes(actor)
  )
    throw new Error("Invalid relationship batch");
  const params = new URLSearchParams({ actor });
  others.forEach((did) => params.append("others", did));
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(params.toString()),
      ),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  const key = new Request(
    `${origin}/api/_cache/relationships/constellation-v1/${hash}`,
  );
  const cache = typeof caches !== "undefined" ? caches.default : undefined;
  try {
    const hit = await cache?.match(key);
    if (hit) return await hit.json<Relationship[]>();
  } catch {
    /* Cache outages must not prevent fresh lookups. */
  }
  const controller = new AbortController();
  const signal = AbortSignal.any([
    controller.signal,
    AbortSignal.timeout(8000),
  ]);
  try {
    const [data, backlinks] = await Promise.all([
      get(
        new URL(
          `https://public.api.bsky.app/xrpc/app.bsky.graph.getRelationships?${params}`,
        ),
        signal,
      ),
      incoming(actor, others, signal),
    ]);
    if (
      data.actor !== actor ||
      !Array.isArray(data.relationships) ||
      data.relationships.length !== others.length
    )
      throw new Error("Invalid relationship response");
    const requested = new Set(others),
      seen = new Set<string>();
    const result: Relationship[] = [];
    const work: { result: Relationship; links: Link[] }[] = [];
    for (const item of data.relationships) {
      const r = object(item),
        did = r.notFound === true ? r.actor : r.did;
      if (typeof did !== "string" || !requested.has(did) || seen.has(did))
        throw new Error("Mismatched graph participants");
      seen.add(did);
      const excluded = !!(
        r.notFound ||
        r.blocking ||
        r.blockedBy ||
        r.blockingByList ||
        r.blockedByList
      );
      const following = !excluded && followUri(r.following, actor);
      const discovered = backlinks.get(did);
      const links = discovered ? [...discovered] : undefined;
      // A refollow can have a new key before the backlink index catches up.
      if (links && followUri(r.followedBy, did)) {
        const rkey = r.followedBy.split("/").at(-1)!;
        if (!links.some((link) => link.rkey === rkey))
          links.push({ did, collection: FOLLOW, rkey });
      }
      const relation = {
        did,
        following,
        mutual: following && !links && followUri(r.followedBy, did),
      };
      result.push(relation);
      if (following && links) work.push({ result: relation, links });
    }
    // At most three record requests per batch at a time; all share a total deadline.
    let index = 0,
      hydrated = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, work.length) }, async () => {
        while (index < work.length) {
          const item = work[index++];
          for (const link of item.links) {
            if (++hydrated > 40)
              throw new Error("Follow verification budget exhausted");
            if (await currentFollow(link, actor, signal)) {
              item.result.mutual = true;
              break;
            }
          }
        }
      }),
    );
    try {
      await cache?.put(
        key,
        Response.json(result, {
          headers: { "Cache-Control": `public, max-age=${TTL}` },
        }),
      );
    } catch {
      /* Best-effort cache; no graph tables or OAuth tokens. */
    }
    return result;
  } catch (error) {
    controller.abort();
    console.warn(
      JSON.stringify({
        event: "social_graph_unavailable",
        message: error instanceof Error ? error.message : "Invalid response",
      }),
    );
    throw new HttpError("Connections unavailable. Try again.", 503);
  }
}
