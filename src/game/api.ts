import type {
  AccountProfile,
  BoardPage,
  BoardScope,
  Ticket,
} from "../shared/api";
export type {
  AccountProfile,
  BoardEntry,
  BoardScope,
  BoardPage,
  Ticket,
} from "../shared/api";
import { RULESET, type Replay } from "./simulation";
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
const UNAVAILABLE = "The online service is unavailable. Please try again.";
export async function request<T>(
  path: string,
  body?: unknown,
  options: RequestInit = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(12000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  try {
    const response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      ...options,
      signal,
    });
    let data: unknown;
    if (response.headers.get("content-type")?.includes("application/json"))
      try {
        data = await response.json();
      } catch (error) {
        if (signal.aborted) throw error;
        // A proxy or failed response body must not hide the HTTP status.
      }
    if (!response.ok)
      throw new ApiError(
        data &&
          typeof data === "object" &&
          "error" in data &&
          typeof data.error === "string" &&
          data.error.trim()
          ? data.error
          : UNAVAILABLE,
        response.status,
      );
    if (data === undefined) throw new Error(UNAVAILABLE);
    return data as T;
  } catch (error) {
    if (signal.aborted && signal.reason?.name === "TimeoutError")
      throw new Error("The online request timed out. Please try again.");
    throw error;
  }
}
export const startDaily = () =>
  request<Ticket>("/api/runs", { ruleset: RULESET });
export const getBoard = (
  day: string,
  scope: BoardScope = "world",
  cursor?: string | null,
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams({ day, scope });
  if (cursor) params.set("cursor", cursor);
  return request<BoardPage>(`/api/leaderboard?${params}`, undefined, {
    signal,
  });
};
export const submitDaily = (ticket: Ticket, replay: Replay) =>
  request<{ score: number }>("/api/scores", {
    ticket: ticket.id,
    replay,
    ruleset: RULESET,
  });
export const getAccount = () =>
  request<{ profile: AccountProfile | null }>("/api/session");
