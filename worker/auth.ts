import type { AccountProfile } from "../src/shared/api";
export type { AccountProfile } from "../src/shared/api";
import { verifySignature } from "@atproto/crypto";
import { HttpError, readJson } from "./http";

export const AUTH_METHOD = "io.github.austinlparker.crazyroombaLogin";
const SESSION_SECONDS = 12 * 60 * 60;
const AUTH_COOKIE = "__Host-roomba-session";
const LOCAL_COOKIE = "roomba-session-local";

interface StoredSession {
  did: string;
  handle: string;
  display_name: string;
  avatar: string | null;
  expires_at: number;
}
interface ServiceProof {
  did: string;
  jti: string;
  expiresAt: number;
}

function loopbackHost(url: URL): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

export function localHttp(url: URL): boolean {
  return url.protocol === "http:" && loopbackHost(url);
}

export function authConfig(url: URL) {
  // Local development uses the special localhost DID allowed by atproto.
  const host = loopbackHost(url)
    ? `localhost${url.port ? `%3A${url.port}` : ""}`
    : url.hostname;
  const did = `did:web:${host}`;
  const audience = `${did}#crazy_roomba`;
  return {
    audience,
    legacyAudience: did,
    lxm: AUTH_METHOD,
    // Older PDS getServiceAuth schemas require a bare DID, while their OAuth
    // scopes require a fragment. A wildcard audience bridges that mismatch;
    // the method stays exact and verifyServiceProof pins the game audience.
    scope: `atproto rpc:${AUTH_METHOD}?aud=*`,
  };
}

export function serviceDocument(url: URL) {
  const { audience } = authConfig(url);
  const did = audience.split("#")[0];
  const endpoint = new URL(url.origin);
  if (!localHttp(endpoint)) endpoint.protocol = "https:";
  return {
    "@context": ["https://www.w3.org/ns/did/v1"],
    id: did,
    service: [
      {
        id: audience,
        type: "CrazyRoombaGame",
        serviceEndpoint: endpoint.origin,
      },
    ],
  };
}

function decodePart(part: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(part))
    throw new HttpError("Invalid sign-in proof.", 401);
  try {
    return Uint8Array.from(
      atob(part.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
  } catch {
    throw new HttpError("Invalid sign-in proof.", 401);
  }
}
function decodeObject(part: string): Record<string, unknown> {
  try {
    const data: unknown = JSON.parse(
      new TextDecoder().decode(decodePart(part)),
    );
    if (data && typeof data === "object" && !Array.isArray(data))
      return data as Record<string, unknown>;
  } catch {
    /* Fall through to a uniform authentication error. */
  }
  throw new HttpError("Invalid sign-in proof.", 401);
}
function didDocumentUrl(did: string): string {
  if (/^did:plc:[a-z2-7]{24}$/.test(did)) return `https://plc.directory/${did}`;
  const domain = did.startsWith("did:web:") ? did.slice(8) : "";
  // Only hostname-level, public HTTPS did:web identifiers are supported.
  if (
    domain.length <= 253 &&
    /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) &&
    !/\.(?:localhost|local|internal|arpa|home|lan)$/.test(domain)
  )
    return `https://${domain}/.well-known/did.json`;
  throw new HttpError("This account DID is not supported.", 401);
}

export async function verifyServiceProof(
  token: string,
  url: URL,
  now = Date.now(),
): Promise<ServiceProof> {
  if (token.length > 8192) throw new HttpError("Invalid sign-in proof.", 401);
  const parts = token.split(".");
  if (parts.length !== 3) throw new HttpError("Invalid sign-in proof.", 401);
  const header = decodeObject(parts[0]),
    claims = decodeObject(parts[1]);
  const { audience, legacyAudience, lxm } = authConfig(url);
  const seconds = Math.floor(now / 1000);
  if (
    (header.alg !== "ES256" && header.alg !== "ES256K") ||
    header.typ !== "JWT" ||
    header.crit !== undefined ||
    typeof claims.iss !== "string" ||
    (claims.aud !== audience && claims.aud !== legacyAudience) ||
    claims.lxm !== lxm ||
    typeof claims.iat !== "number" ||
    !Number.isInteger(claims.iat) ||
    claims.iat > seconds + 10 ||
    claims.iat < seconds - 120 ||
    typeof claims.exp !== "number" ||
    !Number.isInteger(claims.exp) ||
    claims.exp <= seconds ||
    claims.exp <= claims.iat ||
    claims.exp > claims.iat + 120 ||
    typeof claims.jti !== "string" ||
    claims.jti.length < 8 ||
    claims.jti.length > 256 ||
    (claims.nbf !== undefined &&
      (typeof claims.nbf !== "number" || claims.nbf > seconds)) ||
    (header.kid !== undefined &&
      header.kid !== "#atproto" &&
      header.kid !== `${claims.iss}#atproto`)
  ) {
    throw new HttpError(
      "Sign-in proof expired or belongs to another service. Sign in again.",
      401,
    );
  }
  const document = await readJson(
    await fetch(didDocumentUrl(claims.iss), {
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/did+json, application/json" },
    }),
  );
  if (document.id !== claims.iss || !Array.isArray(document.verificationMethod))
    throw new HttpError("Unable to verify this account.", 401);
  const key = document.verificationMethod.find((entry: unknown) => {
    if (!entry || typeof entry !== "object") return false;
    const candidate = entry as Record<string, unknown>;
    return (
      (candidate.id === "#atproto" ||
        candidate.id === `${claims.iss}#atproto`) &&
      candidate.controller === claims.iss &&
      candidate.type === "Multikey" &&
      typeof candidate.publicKeyMultibase === "string"
    );
  }) as Record<string, unknown> | undefined;
  if (
    !key ||
    typeof key.publicKeyMultibase !== "string" ||
    key.publicKeyMultibase.length > 128
  )
    throw new HttpError("Unable to verify this account key.", 401);
  let valid = false;
  try {
    valid = await verifySignature(
      `did:key:${key.publicKeyMultibase}`,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
      decodePart(parts[2]),
      { jwtAlg: header.alg },
    );
  } catch {
    /* Malformed keys and signatures are authentication failures. */
  }
  if (!valid) throw new HttpError("Unable to verify this sign-in proof.", 401);
  return { did: claims.iss, jti: claims.jti, expiresAt: claims.exp * 1000 };
}

export async function resolveProfile(did: string): Promise<AccountProfile> {
  const fallback = { did, handle: did, displayName: "", avatar: null };
  try {
    // The DID comes only from the verified proof. Profile metadata never establishes identity.
    const profile = await readJson(
      await fetch(
        `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
        {
          redirect: "manual",
          signal: AbortSignal.timeout(5000),
          headers: { Accept: "application/json" },
        },
      ),
    );
    if (profile.did !== did) return fallback;
    const handle =
      typeof profile.handle === "string" &&
      profile.handle.length <= 253 &&
      /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(
        profile.handle,
      ) &&
      !profile.handle.endsWith(".invalid")
        ? profile.handle
        : did;
    const displayName =
      typeof profile.displayName === "string"
        ? profile.displayName.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 128)
        : "";
    let avatar: string | null = null;
    if (typeof profile.avatar === "string" && profile.avatar.length < 2048) {
      try {
        const image = new URL(profile.avatar);
        if (
          image.protocol === "https:" &&
          image.hostname === "cdn.bsky.app" &&
          !image.username &&
          !image.password &&
          !image.port
        )
          avatar = image.href;
      } catch {
        /* An unavailable avatar does not invalidate a profile. */
      }
    }
    return { did, handle, displayName, avatar };
  } catch {
    return fallback;
  }
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
function cookieName(url: URL) {
  return localHttp(url) ? LOCAL_COOKIE : AUTH_COOKIE;
}
function sessionToken(request: Request): string | null {
  const name = cookieName(new URL(request.url));
  const parts =
    request.headers
      .get("Cookie")
      ?.split(";")
      .map((value) => value.trim()) || [];
  const found = parts.filter((part) => part.startsWith(`${name}=`));
  if (found.length !== 1) return null;
  const token = found[0].slice(name.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export function sessionCookie(
  url: URL,
  token: string,
  maxAge = SESSION_SECONDS,
): string {
  return `${cookieName(url)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${localHttp(url) ? "" : "; Secure"}`;
}

export async function getSession(
  request: Request,
  db: D1Database,
): Promise<{ profile: AccountProfile; expiresAt: number } | null> {
  const token = sessionToken(request);
  if (!token) return null;
  const session = await db
    .prepare(
      "SELECT did, handle, display_name, avatar, expires_at FROM auth_sessions WHERE token_hash = ? AND expires_at > ?",
    )
    .bind(await hashToken(token), Date.now())
    .first<StoredSession>();
  if (!session) return null;
  return {
    profile: {
      did: session.did,
      handle: session.handle,
      displayName: session.display_name,
      avatar: session.avatar,
    },
    expiresAt: session.expires_at,
  };
}

export async function requireAccount(
  request: Request,
  db: D1Database,
): Promise<AccountProfile> {
  const session = await getSession(request, db);
  if (!session) throw new HttpError("Sign in to post a daily score.", 401);
  return session.profile;
}

export async function createSession(
  request: Request,
  db: D1Database,
): Promise<{ profile: AccountProfile; expiresAt: number; cookie: string }> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer "))
    throw new HttpError("Sign in to connect your account.", 401);
  const now = Date.now();
  const proof = await verifyServiceProof(
    auth.slice(7),
    new URL(request.url),
    now,
  );
  const proofHash = await hashToken(`${proof.did}:${proof.jti}`);
  // Consume the proof atomically before a session exists. A retry needs a fresh PDS proof.
  const nonce = await db.batch([
    db.prepare("DELETE FROM auth_proofs WHERE expires_at < ?").bind(now),
    db
      .prepare(
        "INSERT OR IGNORE INTO auth_proofs (proof_hash, expires_at) VALUES (?, ?)",
      )
      .bind(proofHash, proof.expiresAt),
  ]);
  if (nonce[1].meta.changes !== 1)
    throw new HttpError("This sign-in proof was already used. Try again.", 401);
  const profile = await resolveProfile(proof.did);
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const expiresAt = now + SESSION_SECONDS * 1000;
  await db.batch([
    db.prepare("DELETE FROM auth_sessions WHERE expires_at < ?").bind(now),
    db
      .prepare(
        "INSERT INTO auth_sessions (token_hash,did,handle,display_name,avatar,created_at,expires_at) VALUES (?,?,?,?,?,?,?)",
      )
      .bind(
        await hashToken(token),
        profile.did,
        profile.handle,
        profile.displayName,
        profile.avatar,
        now,
        expiresAt,
      ),
  ]);
  // Reconnecting in the same browser replaces its previous session.
  await revokeSession(request, db);
  return {
    profile,
    expiresAt,
    cookie: sessionCookie(new URL(request.url), token),
  };
}

export async function revokeSession(
  request: Request,
  db: D1Database,
): Promise<void> {
  const token = sessionToken(request);
  if (token)
    await db
      .prepare("DELETE FROM auth_sessions WHERE token_hash = ?")
      .bind(await hashToken(token))
      .run();
}
