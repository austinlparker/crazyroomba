import { ApiError, getBoard } from "./api";
import { boardRows } from "./leaderboard";
import { StandingScan } from "./daily-standing";
import "./daily-results.css";

export function mountDailyResults(
  root: HTMLElement,
  options: {
    day: string;
    did: string;
    score: number;
    save: () => Promise<void>;
    openBoard: () => void;
  },
): () => void {
  let disposed = false,
    saved = false,
    busy = false;
  let scan = new StandingScan(options.day, options.did);
  let pending: AbortController | null = null;
  let action: "retry" | "more" | "refresh" | "signin" | null = null;
  root.className = "daily-standing";
  root.innerHTML =
    '<div class="standing-content"></div><p class="standing-status" role="status" aria-live="polite"></p><div class="standing-actions"></div>';
  const content = root.querySelector<HTMLElement>(".standing-content")!;
  const status = root.querySelector<HTMLElement>(".standing-status")!;
  const actions = root.querySelector<HTMLElement>(".standing-actions")!;
  const buttons = () => {
    actions.innerHTML =
      action === "signin"
        ? '<button class="secondary wide" data-action="account">SIGN IN</button>'
        : action
          ? `<button class="secondary wide" data-standing="${action}" ${busy ? "disabled" : ""}>${action === "more" ? "KEEP CHECKING" : action === "refresh" ? "REFRESH RANK" : "TRY AGAIN"}</button>`
          : scan.ready
            ? '<button class="secondary wide" data-standing="board">MUTUALS BOARD →</button>'
            : "";
  };
  const draw = () => {
    if (!scan.own || !scan.ready) return;
    const own = scan.own;
    const headline = scan.solo ? "FIRST IN YOUR CIRCLE" : "AMONG MUTUALS";
    const best =
      own.score > options.score
        ? `Your daily best · ${own.score.toLocaleString("en-US")}`
        : "Your daily best";
    content.innerHTML = `<div class="standing-hero"><strong>#${own.rank.toLocaleString("en-US")}</strong><div><h3>${headline}</h3><p>${best}</p></div></div>${
      scan.solo
        ? '<p class="standing-solo">No scores from your mutuals yet. Set the pace.</p>'
        : `<div class="standing-neighbors" role="table" aria-label="Your rank among mutuals">${boardRows(
            [scan.above, own, scan.below].filter((e) => e !== null),
            options.did,
          )}</div>`
    }`;
  };
  const load = async (reset = false) => {
    if (busy || disposed) return;
    if (reset) {
      scan = new StandingScan(options.day, options.did);
      content.innerHTML = "";
    }
    busy = true;
    action = null;
    const controller = new AbortController();
    pending = controller;
    root.setAttribute("aria-busy", "true");
    status.textContent = saved
      ? "Finding your rank among mutuals…"
      : "Posting score…";
    buttons();
    try {
      // Submission is deliberately not aborted on dismissal: a verified run must
      // survive leaving the results screen. Only the read-only rank scan is aborted.
      if (!saved) {
        await options.save();
        saved = true;
      }
      if (disposed) return;
      status.textContent = "Finding your rank among mutuals…";
      for (let page = 0; page < 8 && !scan.ready && !scan.complete; page++) {
        const result = await getBoard(
          options.day,
          "mutuals",
          scan.cursor,
          controller.signal,
        );
        if (disposed || controller.signal.aborted) return;
        if (result.viewer !== options.did)
          throw new ApiError("Account changed", 401);
        scan.accept(result);
      }
      if (scan.ready) {
        draw();
        status.textContent = "";
      } else if (scan.complete) {
        status.textContent = "Score posted. Rank is updating.";
        action = "refresh";
      } else {
        status.textContent = "Score posted. Keep checking to find your rank.";
        action = "more";
      }
    } catch (error) {
      if (disposed || controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) {
        status.textContent = saved
          ? "Score posted. Sign in to see your rank."
          : "Sign in to post your score.";
        action = "signin";
      } else if (
        error instanceof ApiError &&
        (error.status === 400 || error.status === 409) &&
        saved
      ) {
        status.textContent = "Refresh for the latest scores.";
        action = "refresh";
      } else {
        status.textContent = saved
          ? "Score posted. Rank unavailable."
          : "Score not posted. Try again.";
        action = "retry";
      }
    } finally {
      if (!disposed) {
        busy = false;
        pending = null;
        root.setAttribute("aria-busy", "false");
        buttons();
      }
    }
  };
  const click = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLElement>(
      "[data-standing]",
    );
    if (!button || !root.contains(button)) return;
    if (button.dataset.standing === "board") options.openBoard();
    else void load(button.dataset.standing === "refresh");
  };
  root.addEventListener("click", click);
  void load();
  return () => {
    disposed = true;
    pending?.abort();
    root.removeEventListener("click", click);
  };
}
