import {
  RULESET,
  replayDaily,
  seedForDay,
  utcDay,
} from "../src/game/simulation";
import { dailyStage } from "../src/game/stage-catalog";
import { loadLevel } from "../src/game/stages/load-data";
import { HttpError, json } from "./http";
import { leaderboard } from "./leaderboard";
import {
  authConfig,
  createSession,
  getSession,
  localHttp,
  requireAccount,
  revokeSession,
  serviceDocument,
  sessionCookie,
} from "./auth";
async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError("JSON required", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError("Missing body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 70000) {
      await reader.cancel();
      throw new HttpError("Replay payload too large", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
      throw new Error();
    return parsed;
  } catch {
    throw new HttpError("Invalid JSON");
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.protocol === "http:" && !localHttp(url)) {
        if (request.method !== "GET" && request.method !== "HEAD")
          throw new HttpError("Use HTTPS to connect to this game.", 426);
        url.protocol = "https:";
        return new Response(null, {
          status: 308,
          headers: { Location: url.href, "Cache-Control": "no-store" },
        });
      }
      if (url.pathname === "/.well-known/did.json" && request.method === "GET")
        return json(serviceDocument(url));
      if (url.pathname === "/client-metadata.json")
        return json({
          client_id: `${url.origin}/client-metadata.json`,
          client_name: "Crazy Roomba",
          client_uri: url.origin,
          redirect_uris: [`${url.origin}/`],
          scope: authConfig(url).scope,
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
          application_type: "web",
          dpop_bound_access_tokens: true,
        });
      if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
      if (
        !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
        request.headers.get("Origin") !== url.origin
      )
        throw new HttpError("Origin not allowed", 403);
      if (url.pathname === "/api/auth-config" && request.method === "GET")
        return json(authConfig(url));
      if (url.pathname === "/api/session") {
        if (request.method === "GET")
          return json((await getSession(request, env.DB)) || { profile: null });
        if (request.method === "POST") {
          await body(request);
          const { cookie, ...session } = await createSession(request, env.DB);
          return json(session, 200, { "Set-Cookie": cookie });
        }
        if (request.method === "DELETE") {
          await revokeSession(request, env.DB);
          return json({ profile: null }, 200, {
            "Set-Cookie": sessionCookie(url, "", 0),
          });
        }
      }
      if (url.pathname === "/api/leaderboard" && request.method === "GET")
        return await leaderboard(request, env.DB);
      if (url.pathname === "/api/runs" && request.method === "POST") {
        const account = await requireAccount(request, env.DB);
        const data = await body(request);
        if (data.ruleset !== RULESET)
          throw new HttpError("Reload to play the latest game rules.", 409);
        const now = Date.now(),
          day = utcDay(new Date(now)),
          id = crypto.randomUUID(),
          seed = seedForDay(day);
        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(
            `${day}:${request.headers.get("CF-Connecting-IP") || "local"}`,
          ),
        );
        const client = Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
        const count = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM tickets WHERE client_hash = ? AND created_at > ?",
        )
          .bind(client, now - 3600000)
          .first<{ n: number }>();
        if ((count?.n || 0) >= 30)
          throw new HttpError(
            "Daily start limit reached. Try again in an hour, or play Arcade.",
            429,
          );
        const issued = await env.DB.batch([
          env.DB.prepare("DELETE FROM tickets WHERE expires_at < ?").bind(now),
          env.DB.prepare(
            "INSERT INTO tickets (id,day,seed,ruleset,created_at,expires_at,client_hash,account_did) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM tickets WHERE client_hash = ? AND created_at > ?) < 30",
          ).bind(
            id,
            day,
            seed,
            RULESET,
            now,
            now + 3600000,
            client,
            account.did,
            client,
            now - 3600000,
          ),
        ]);
        if (issued[1].meta.changes !== 1)
          throw new HttpError(
            "Daily start limit reached. Try again in an hour, or play Arcade.",
            429,
          );
        return json(
          {
            id,
            day,
            stage: dailyStage(day),
            seed,
            ruleset: RULESET,
            did: account.did,
          },
          201,
        );
      }
      if (url.pathname === "/api/scores" && request.method === "POST") {
        const account = await requireAccount(request, env.DB);
        const data = await body(request);
        if (data.ruleset !== RULESET)
          throw new HttpError(
            "Rules have changed; start a new daily run.",
            409,
          );
        if (typeof data.ticket !== "string" || data.ticket.length > 50)
          throw new HttpError("Invalid ticket");
        // A retry after a lost response returns the already-verified score. Never
        // replay or overwrite a submitted ticket, and never return another DID's run.
        const savedScore = () =>
          env.DB.prepare(
            "SELECT score FROM scores WHERE id = ? AND did = ? AND ruleset = ?",
          )
            .bind(data.ticket, account.did, RULESET)
            .first<{ score: number }>();
        const existing = await savedScore();
        if (existing) return json(existing);
        const ticket = await env.DB.prepare(
          "SELECT * FROM tickets WHERE id = ?",
        )
          .bind(data.ticket)
          .first<{
            id: string;
            day: string;
            seed: number;
            created_at: number;
            expires_at: number;
            submitted: number;
            ruleset: string;
            account_did: string | null;
          }>();
        if (!ticket || ticket.expires_at < Date.now())
          throw new HttpError(
            "This run ticket expired. Start another daily challenge.",
            410,
          );
        if (ticket.account_did !== account.did)
          throw new HttpError(
            "This run belongs to a different account. Start a new daily challenge.",
            403,
          );
        if (ticket.submitted)
          throw new HttpError("This run is already on the board.", 409);
        if (
          ticket.ruleset !== RULESET ||
          Date.now() - ticket.created_at < 90000
        )
          throw new HttpError("Finish the 90-second challenge first.");
        let sim;
        try {
          sim = replayDaily(
            ticket.seed,
            data.replay,
            await loadLevel(dailyStage(ticket.day)),
          );
        } catch (error) {
          throw new HttpError(
            error instanceof Error ? error.message : "Invalid replay",
          );
        }
        // The insert and consume are transactional. The primary key rejects concurrent duplicates.
        try {
          const result = await env.DB.batch([
            env.DB.prepare(
              "INSERT INTO scores (id,day,ruleset,name,score,deposited,created_at,did,handle,display_name,avatar) SELECT id,day,ruleset,?,?,?,?,?,?,?,? FROM tickets WHERE id = ? AND submitted = 0 AND account_did = ?",
            ).bind(
              account.displayName || account.handle,
              sim.score,
              sim.deposited,
              new Date(Date.now()).toISOString(),
              account.did,
              account.handle,
              account.displayName,
              account.avatar,
              ticket.id,
              account.did,
            ),
            env.DB.prepare(
              "UPDATE tickets SET submitted = 1 WHERE id = ? AND submitted = 0",
            ).bind(ticket.id),
          ]);
          if (result[0].meta.changes !== 1)
            throw new HttpError("This run is already on the board.", 409);
        } catch {
          const saved = await savedScore();
          if (saved) return json(saved);
          throw new HttpError(
            "Unable to submit this run; it may already be on the board.",
            409,
          );
        }
        return json({ score: sim.score }, 201);
      }
      return json({ error: "Not found" }, 404);
    } catch (error) {
      if (error instanceof HttpError)
        return json({ error: error.message }, error.status);
      console.error(
        JSON.stringify({
          event: "api_error",
          path: url.pathname,
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      );
      return json(
        {
          error:
            "Online services are unavailable. Your local records are safe.",
        },
        503,
      );
    }
  },
} satisfies ExportedHandler<Env>;
