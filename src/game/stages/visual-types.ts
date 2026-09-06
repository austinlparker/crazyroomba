import type { Group } from "three";
export interface StageVisual {
  group: Group;
  backdrop?: Group;
  hideGround?: boolean;
  background: string;
  ground: string;
  sun: string;
  sunElevation?: number;
  ambient: string;
  extent: number;
  animate?: (time: number, dt: number) => void;
}
