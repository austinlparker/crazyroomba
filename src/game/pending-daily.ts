import type { Ticket } from "./api";
import {
  RULESET,
  replayDaily,
  seedForDay,
  utcDay,
  validateReplay,
  type Replay,
  type Simulation,
} from "./simulation";
import { dailyStage, isStage } from "./stage-catalog";
import { loadLevel } from "./stages/load-data";

const KEY = "crazy-roomba-pending-daily-v1";
const MAX_AGE = 15 * 60 * 1000;
const MAX_BYTES = 70_000;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DID =
  /^did:(?:plc:[a-z2-7]{24}|web:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63})$/;

interface PendingDaily {
  version: 1;
  savedAt: number;
  ticket: Ticket;
  replay: Replay;
  runId: string | null;
}

function valid(value: unknown): asserts value is PendingDaily {
  if (!value || typeof value !== "object")
    throw new Error("Invalid saved run.");
  const p = value as Partial<PendingDaily>,
    t = p.ticket;
  if (
    p.version !== 1 ||
    !Number.isSafeInteger(p.savedAt) ||
    p.savedAt! > Date.now() ||
    Date.now() - p.savedAt! >= MAX_AGE ||
    !t ||
    typeof t.id !== "string" ||
    !UUID.test(t.id) ||
    t.ruleset !== RULESET ||
    typeof t.did !== "string" ||
    t.did.length > 261 ||
    !DID.test(t.did) ||
    typeof t.day !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(t.day) ||
    !Number.isFinite(Date.parse(`${t.day}T00:00:00Z`)) ||
    utcDay(new Date(`${t.day}T00:00:00Z`)) !== t.day ||
    !Number.isInteger(t.seed) ||
    t.seed !== seedForDay(t.day) ||
    !isStage(t.stage) ||
    t.stage !== dailyStage(t.day) ||
    (p.runId !== null && (typeof p.runId !== "string" || !UUID.test(p.runId)))
  )
    throw new Error("Saved run is invalid or expired.");
  validateReplay(p.replay);
}

/** Save only a complete, account-bound daily before leaving for OAuth. */
export function savePendingDaily(
  ticket: Ticket,
  replay: Replay,
  runId: string | null,
): void {
  const pending: PendingDaily = {
    version: 1,
    savedAt: Date.now(),
    ticket,
    replay,
    runId,
  };
  valid(pending);
  const data = JSON.stringify(pending);
  if (
    data.length > MAX_BYTES ||
    new TextEncoder().encode(data).length > MAX_BYTES
  )
    throw new Error("This replay is too large to keep during sign-in.");
  try {
    sessionStorage.setItem(KEY, data);
  } catch {
    throw new Error(
      "Browser storage is unavailable. Your run cannot be kept through sign-in.",
    );
  }
}

/** The caller must already have verified this DID with the game server. */
export async function restorePendingDaily(did: string): Promise<{
  ticket: Ticket;
  replay: Replay;
  runId: string | null;
  sim: Simulation;
} | null> {
  const data = sessionStorage.getItem(KEY);
  if (!data) return null;
  const discard = () => {
    if (sessionStorage.getItem(KEY) === data) sessionStorage.removeItem(KEY);
  };
  let p: PendingDaily;
  try {
    if (
      data.length > MAX_BYTES ||
      new TextEncoder().encode(data).length > MAX_BYTES
    )
      throw new Error("Oversized saved run.");
    const parsed: unknown = JSON.parse(data);
    valid(parsed);
    p = parsed;
  } catch {
    discard();
    return null;
  }
  if (p.ticket.did !== did)
    throw new Error(
      "This run belongs to another account. Sign in with the account that started it; the run is kept for 15 minutes.",
    );

  // A failed stage download must leave the replay available for another attempt.
  const level = await loadLevel(p.ticket.stage);
  if (sessionStorage.getItem(KEY) !== data) return null;
  try {
    valid(p); // An OAuth callback or stage download can outlast the deadline.
  } catch {
    discard();
    return null;
  }
  // Runtime failures are retryable; only invalid data or a successful replay
  // should consume a saved run.
  const sim = replayDaily(p.ticket.seed, p.replay, level);
  discard();
  return { ticket: p.ticket, replay: p.replay, runId: p.runId, sim };
}
