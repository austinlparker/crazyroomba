/** Meters, shared by the renderer and the replay verifier. Y is the floor surface. */
export interface Point {
  x: number;
  z: number;
  y?: number;
}
export interface Furniture {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  kind: string;
  floor: 0 | 1;
  bottom: number;
  top: number;
}
export interface Collider extends Furniture {}
export const FLOOR_HEIGHT = 2.8;
export const ROBOT_RADIUS = 0.18;
export const ROBOT_HEIGHT = 0.13;
export const CRUISE_SPEED = 1.45;
export const TURBO_SPEED = 3.2;
export interface FloorRegion {
  floor: 0 | 1;
  x: number;
  z: number;
  w: number;
  d: number;
  finish: "wood" | "tile" | "terrace";
}
export interface Room extends FloorRegion {
  id: string;
  name: string;
  color: string;
}
export interface Wall extends Furniture {
  exterior: boolean;
}
export interface Opening {
  id: string;
  floor: 0 | 1;
  axis: "x" | "z";
  at: number;
  center: number;
  width: number;
  bottom: number;
  top: number;
  type: "door" | "window";
}

export type StageId = "apartment" | "house" | "culdesac" | "moon";
export interface Ramp {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  bottomZ: number;
  topZ: number;
  fromY: number;
  toY: number;
  steps?: boolean;
}
export interface BoostPad {
  id: string;
  x: number;
  z: number;
  y: number;
  w: number;
  d: number;
}
export const STAIR_STEPS = 16;
