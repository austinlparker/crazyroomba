/** Public discovery only. OAuth resolves and verifies the handle independently. */
export const TYPEAHEAD_URL =
  "https://typeahead.waow.tech/xrpc/tech.waow.typeahead.searchActors";
export interface ActorSuggestion {
  handle: string;
  displayName: string;
  avatar: string | null;
}
export interface SearchState {
  actors: ActorSuggestion[];
  status: "idle" | "loading" | "ready" | "unavailable";
}
function avatarUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function parseActors(value: unknown): ActorSuggestion[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("actors" in value) ||
    !Array.isArray(value.actors)
  )
    throw new Error("Invalid typeahead response");
  const actors: ActorSuggestion[] = [];
  const seen = new Set<string>();
  for (const actor of value.actors) {
    if (!actor || typeof actor !== "object" || typeof actor.handle !== "string")
      continue;
    const handle = actor.handle.toLowerCase();
    // Show valid DNS handles; display names remain plain text.
    if (
      handle.length > 253 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
        handle,
      ) ||
      handle.split(".").some((label: string) => label.length > 63) ||
      !/^[a-z]/.test(handle.split(".").at(-1)!) ||
      handle.endsWith(".invalid") ||
      seen.has(handle)
    )
      continue;
    seen.add(handle);
    actors.push({
      handle,
      displayName:
        typeof actor.displayName === "string"
          ? actor.displayName.slice(0, 100)
          : "",
      avatar: avatarUrl(actor.avatar),
    });
    if (actors.length === 5) break;
  }
  return actors;
}
export class HandleSearch {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private request: AbortController | undefined;
  private revision = 0;
  private disposed = false;
  private cache = new Map<string, { at: number; actors: ActorSuggestion[] }>();
  constructor(
    private readonly update: (state: SearchState) => void,
    private readonly fetcher: typeof fetch = fetch.bind(globalThis),
  ) {}
  cancel(): void {
    this.revision++;
    clearTimeout(this.timer);
    this.request?.abort();
    this.request = undefined;
  }
  query(value: string): void {
    if (this.disposed) return;
    this.cancel();
    const q = value.trim().replace(/^@/, "").toLowerCase();
    const revision = this.revision;
    this.update({ actors: [], status: "idle" });
    if (
      q.length < 2 ||
      q.length > 100 ||
      q.startsWith("did:") ||
      q.includes("://")
    )
      return;
    const cached = this.cache.get(q);
    if (cached && Date.now() - cached.at < 60000) {
      this.update({ actors: cached.actors, status: "ready" });
      return;
    }
    this.timer = setTimeout(() => void this.search(q, revision), 400);
  }
  private async search(q: string, revision: number): Promise<void> {
    const request = new AbortController();
    this.request = request;
    const timeout = setTimeout(() => request.abort(), 5000);
    this.update({ actors: [], status: "loading" });
    try {
      const url = new URL(TYPEAHEAD_URL);
      url.searchParams.set("q", q);
      url.searchParams.set("limit", "5");
      const response = await this.fetcher(url, {
        signal: request.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: { "X-Client": "crazy-roomba" },
      });
      if (!response.ok) throw new Error("Typeahead unavailable");
      const actors = parseActors(await response.json());
      if (this.disposed || revision !== this.revision) return;
      if (this.cache.size >= 24)
        this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(q, { at: Date.now(), actors });
      this.update({ actors, status: "ready" });
    } catch {
      if (!this.disposed && revision === this.revision)
        this.update({ actors: [], status: "unavailable" });
    } finally {
      clearTimeout(timeout);
      if (this.request === request) this.request = undefined;
    }
  }
  dispose(): void {
    this.disposed = true;
    this.cancel();
    this.cache.clear();
  }
}
