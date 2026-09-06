import { RULESET, utcDay } from "../src/game/simulation";
import { dailyStage } from "../src/game/stage-catalog";
import type { BoardEntry, BoardScope } from "../src/shared/api";
import { getSession } from "./auth";
import { HttpError, json } from "./http";
import { relationships, type Relationship } from "./social-graph";

const PAGE_SIZE = 25;
const SCAN_SIZE = 120;
type Cursor = {
  day: string;
  scope: BoardScope;
  viewer: string | null;
  at: string;
  offset: number;
  rank: number;
};

// Rank one best run per DID before paging, including deterministic score ties.
const BEST_RUNS = `WITH runs AS (
  SELECT name, did, handle, display_name AS displayName, avatar, score,
    deposited, created_at, id,
    ROW_NUMBER() OVER (PARTITION BY did ORDER BY score DESC, created_at ASC, id ASC) AS best
  FROM scores WHERE day = ? AND ruleset = ? AND did IS NOT NULL AND created_at <= ?
)
SELECT name, did, handle, displayName, avatar, score, deposited, created_at
FROM runs WHERE best = 1 ORDER BY score DESC, created_at ASC, id ASC LIMIT ? OFFSET ?`;

function position(
  url: URL,
  scope: BoardScope,
  day: string,
  viewer: string | null,
): Cursor {
  const initial: Cursor = {
    day,
    scope,
    viewer,
    at: new Date(Date.now()).toISOString(),
    offset: 0,
    rank: 0,
  };
  const raw = url.searchParams.get("cursor");
  if (!raw) return initial;
  try {
    if (raw.length > 2048) throw new Error();
    const c = JSON.parse(atob(raw)) as Cursor;
    if (
      !c ||
      c.day !== day ||
      c.scope !== scope ||
      c.viewer !== viewer ||
      typeof c.at !== "string" ||
      new Date(c.at).toISOString() !== c.at ||
      Date.parse(c.at) > Date.now() ||
      !Number.isSafeInteger(c.offset) ||
      c.offset < 0 ||
      !Number.isSafeInteger(c.rank) ||
      c.rank < 0 ||
      c.rank > c.offset
    )
      throw new Error();
    if (Date.now() - Date.parse(c.at) > 600000)
      throw new HttpError("Refresh the board for the latest scores.", 409);
    return c;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError("Invalid leaderboard cursor");
  }
}

export async function leaderboard(
  request: Request,
  db: D1Database,
): Promise<Response> {
  const url = new URL(request.url);
  const day = url.searchParams.get("day") || utcDay();
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(Date.parse(day)) ||
    utcDay(new Date(day)) !== day
  )
    throw new HttpError("Invalid challenge date");
  const scope = url.searchParams.get("scope") || "world";
  if (scope !== "world" && scope !== "following" && scope !== "mutuals")
    throw new HttpError("Invalid leaderboard scope");
  const viewer = (await getSession(request, db))?.profile.did || null;
  if (scope !== "world" && !viewer)
    throw new HttpError("Sign in to see your people.", 401);
  const cursor = position(url, scope, day, viewer);
  const limit = scope === "world" ? PAGE_SIZE : SCAN_SIZE;
  const { results } = await db
    .prepare(BEST_RUNS)
    .bind(day, RULESET, cursor.at, limit + 1, cursor.offset)
    .all<BoardEntry>();
  const candidates = results.slice(0, limit);
  const graph = new Map<string, Relationship>();
  if (scope !== "world") {
    const others = candidates
      .map((entry) => entry.did)
      .filter((did) => did !== viewer);
    const batches: Promise<Relationship[]>[] = [];
    for (let i = 0; i < others.length; i += 30)
      batches.push(relationships(url.origin, viewer!, others.slice(i, i + 30)));
    for (const group of await Promise.all(batches))
      for (const r of group) graph.set(r.did, r);
  }
  const entries: BoardEntry[] = [];
  let consumed = 0;
  for (const entry of candidates) {
    consumed++;
    const relation = graph.get(entry.did);
    if (
      scope === "world" ||
      entry.did === viewer ||
      (scope === "mutuals" ? relation?.mutual : relation?.following)
    ) {
      entries.push({ ...entry, rank: cursor.rank + entries.length + 1 });
      if (entries.length === PAGE_SIZE) break;
    }
  }
  const nextCursor =
    results.length > consumed
      ? btoa(
          JSON.stringify({
            ...cursor,
            offset: cursor.offset + consumed,
            rank: cursor.rank + entries.length,
          }),
        )
      : null;
  return json({
    day,
    stage: dailyStage(day),
    scope,
    viewer,
    entries,
    nextCursor,
  });
}
