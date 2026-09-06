import { ApiError, getBoard, type BoardEntry, type BoardScope } from "./api";
import { accountBadge } from "./account-display";
import { watchUtcDay } from "./daily-clock";
import { RULESET } from "./simulation";
import type { Run } from "./storage";
import "./leaderboard.css";

const scopes: BoardScope[] = ["world", "following", "mutuals"];
export function boardRows(
  entries: BoardEntry[],
  viewer: string | null,
): string {
  return entries
    .map(
      (e) =>
        `<div class="board-row${e.did === viewer ? " board-you" : ""}" role="row"><span class="rank" role="cell">${e.did === "local" ? "–" : String(e.rank).padStart(2, "0")}</span>${e.did === "local" ? '<span role="cell">You</span>' : `<a role="cell" class="board-driver account-summary" href="https://bsky.app/profile/${encodeURIComponent(e.did)}" target="_blank" rel="noopener noreferrer">${accountBadge({ did: e.did, handle: e.handle || e.did, displayName: e.displayName || e.name, avatar: e.avatar || null })}${e.did === viewer ? '<span class="you-tag">YOU</span>' : ""}</a>`}<strong role="cell">${e.score.toLocaleString("en-US")}</strong></div>`,
    )
    .join("");
}

/** Owns requests and events so closing the dialog or changing scope cancels stale results. */
export function mountLeaderboard(
  root: HTMLElement,
  day: string,
  runs: Run[],
  initialScope: BoardScope = "world",
  followToday?: (day: string) => void,
): () => void {
  let scope: BoardScope = initialScope;
  let entries: BoardEntry[] = [];
  let viewer: string | null = null;
  let cursor: string | null = null;
  let pending: AbortController | null = null;
  let disposed = false;
  let busy = false;
  let message = "";
  let action: "retry" | "signin" | "refresh" | "more" | null = null;
  let local = false;

  root.innerHTML = `<div class="board-scopes" role="group" aria-label="Leaderboard filter">${scopes.map((s) => `<button class="secondary" data-board-scope="${s}" aria-pressed="${s === scope}">${s.toUpperCase()}</button>`).join("")}</div><p class="board-context"></p><div class="board-table" role="table" aria-label="Daily high scores"><div class="board-row table-head" role="row"><span role="columnheader">#</span><span role="columnheader">DRIVER</span><span role="columnheader">POINTS</span></div><div class="board-entries" role="rowgroup"></div></div><p class="board-message" role="status" aria-live="polite"></p><div class="board-actions"></div><button class="primary wide" data-action="start">PLAY DAILY</button>`;
  const rows = root.querySelector<HTMLElement>(".board-entries")!;
  const status = root.querySelector<HTMLElement>(".board-message")!;
  const actions = root.querySelector<HTMLElement>(".board-actions")!;
  const context = root.querySelector<HTMLElement>(".board-context")!;
  const draw = () => {
    if (disposed) return;
    const focus = document.activeElement;
    const hadActionFocus =
      focus instanceof HTMLElement && actions.contains(focus);
    for (const button of root.querySelectorAll<HTMLElement>(
      "[data-board-scope]",
    ))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.boardScope === scope),
      );
    context.textContent = local
      ? "Your best on this device · Rank unavailable"
      : scope === "world"
        ? "Each player’s best Daily score"
        : scope === "following"
          ? "You + people you follow"
          : "You + people you follow who also follow you";
    rows.innerHTML = boardRows(entries, viewer);
    root.querySelector(".board-table")!.setAttribute("aria-busy", String(busy));
    status.textContent = message;
    actions.innerHTML =
      action === "signin"
        ? '<button class="secondary wide" data-action="account">SIGN IN</button>'
        : `<button class="secondary" data-board-action="refresh" ${busy ? "disabled" : ""}>REFRESH</button>${action && action !== "refresh" ? `<button class="secondary" data-board-action="${action}" ${busy ? "disabled" : ""}>${action === "more" ? "MORE" : "TRY AGAIN"}</button>` : ""}`;
    if (hadActionFocus)
      (
        actions.querySelector<HTMLButtonElement>("button:not(:disabled)") ||
        root.querySelector<HTMLButtonElement>(
          '[data-board-scope][aria-pressed="true"]',
        )
      )?.focus();
  };
  const load = async (reset: boolean) => {
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    if (reset) {
      entries = [];
      cursor = null;
      viewer = null;
    }
    busy = true;
    local = false;
    action = null;
    message =
      scope === "world" ? "Loading scores…" : "Loading this group’s scores…";
    draw();
    const target = entries.length + 25;
    try {
      // Continue past ranks with no matches. Bound each interaction for very large boards;
      // MORE resumes the scan instead of silently dropping lower-ranked friends.
      for (let page = 0; page < 8; page++) {
        const result = await getBoard(day, scope, cursor, controller.signal);
        if (disposed || controller.signal.aborted) return;
        if (result.scope !== scope) throw new Error("Mismatched board");
        viewer = result.viewer;
        entries.push(...result.entries);
        cursor = result.nextCursor;
        draw();
        if (!cursor || entries.length >= target) break;
      }
      action = cursor ? "more" : null;
      const others = entries.some((e) => e.did !== viewer);
      message =
        cursor && entries.length < target
          ? "More players to check."
          : !entries.length
            ? scope === "world"
              ? "No scores yet. Set the pace."
              : "No scores in this group yet."
            : !others && scope !== "world" && !cursor
              ? "Only your score is in this group so far."
              : "";
    } catch (error) {
      if (disposed || controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) {
        entries = [];
        viewer = null;
        cursor = null;
        message =
          "Sign in with Bluesky to compare scores with people you follow.";
        action = "signin";
      } else if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 400)
      ) {
        message = "Refresh for the latest scores.";
        action = "refresh";
      } else {
        message =
          scope === "world"
            ? "Board unavailable. Try again."
            : "This group’s scores are unavailable. Try again.";
        action = "retry";
        if (scope === "world" && !entries.length) {
          const best = runs
            .filter(
              (r) =>
                r.mode === "daily" && r.day === day && r.ruleset === RULESET,
            )
            .sort((a, b) => b.score - a.score)[0];
          if (best) {
            local = true;
            viewer = "local";
            entries = [
              {
                rank: 1,
                name: "You",
                score: best.score,
                deposited: best.deposited,
                created_at: "",
                did: "local",
                handle: "On this device",
                displayName: "You",
                avatar: null,
              },
            ];
          }
        }
      }
    } finally {
      if (pending === controller && !disposed && !controller.signal.aborted) {
        busy = false;
        pending = null;
        draw();
      }
    }
  };
  const click = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLElement>(
      "[data-board-scope],[data-board-action]",
    );
    if (!button || !root.contains(button)) return;
    const next = button.dataset.boardScope as BoardScope | undefined;
    if (next && scopes.includes(next)) {
      scope = next;
      void load(true);
    } else if (!busy)
      void load(button.dataset.boardAction === "refresh" || local);
  };
  root.addEventListener("click", click);
  const stopClock = followToday
    ? watchUtcDay((next) => {
        day = next;
        followToday(next);
        void load(true);
      }, day)
    : undefined;
  void load(true);
  return () => {
    disposed = true;
    stopClock?.();
    pending?.abort();
    root.removeEventListener("click", click);
  };
}
