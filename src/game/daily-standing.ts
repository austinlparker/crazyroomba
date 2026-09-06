import type { BoardEntry, BoardPage } from "../shared/api";

/** A bounded scan of the same best-per-DID board used by the full leaderboard. */
export class StandingScan {
  cursor: string | null = null;
  own: BoardEntry | null = null;
  above: BoardEntry | null = null;
  below: BoardEntry | null = null;
  complete = false;
  private previous: BoardEntry | null = null;
  private cursors = new Set<string>();
  private lastRank = 0;
  constructor(
    readonly day: string,
    readonly viewer: string,
  ) {}

  get ready(): boolean {
    return !!this.own && (!!this.below || this.complete);
  }
  get solo(): boolean {
    return this.complete && !!this.own && !this.above && !this.below;
  }

  accept(page: BoardPage): void {
    if (
      page.day !== this.day ||
      page.scope !== "mutuals" ||
      page.viewer !== this.viewer
    )
      throw new Error("Account or challenge changed");
    if (page.nextCursor && this.cursors.has(page.nextCursor))
      throw new Error("Repeated board cursor");
    let expectedRank = this.lastRank;
    for (const entry of page.entries) {
      if (
        entry.rank !== ++expectedRank ||
        !Number.isSafeInteger(entry.score) ||
        entry.score < 0
      )
        throw new Error("Invalid board rank");
    }
    // Validate the whole response before committing any progress, so a retry is safe.
    for (const entry of page.entries) {
      if (entry.did === this.viewer) {
        this.own = entry;
        this.above = this.previous;
      } else if (this.own && !this.below) this.below = entry;
      this.previous = entry;
    }
    this.lastRank = expectedRank;
    this.cursor = page.nextCursor;
    if (this.cursor) this.cursors.add(this.cursor);
    this.complete = !this.cursor;
  }
}
