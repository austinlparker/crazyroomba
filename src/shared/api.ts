import type { StageId } from "../game/level-types";

export interface Ticket {
  id: string;
  day: string;
  seed: number;
  ruleset: string;
  stage: StageId;
  did: string;
}
export interface AccountProfile {
  did: string;
  handle: string;
  displayName: string;
  avatar: string | null;
}
export interface BoardEntry {
  rank: number;
  name: string;
  score: number;
  deposited: number;
  created_at: string;
  did: string;
  handle: string;
  displayName: string;
  avatar: string | null;
}
export type BoardScope = "world" | "following" | "mutuals";
export interface BoardPage {
  entries: BoardEntry[];
  day: string;
  scope: BoardScope;
  viewer: string | null;
  nextCursor: string | null;
}
