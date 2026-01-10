declare module 'pathfinding' {
  export class Grid {
    constructor(width: number, height: number);
    setWalkableAt(x: number, y: number, walkable: boolean): void;
    isWalkableAt(x: number, y: number): boolean;
    clone(): Grid;
  }

  export interface FinderOptions {
    allowDiagonal?: boolean;
    dontCrossCorners?: boolean;
    heuristic?: (dx: number, dy: number) => number;
    weight?: number;
  }

  export class AStarFinder {
    constructor(options?: FinderOptions);
    findPath(
      startX: number,
      startY: number,
      endX: number,
      endY: number,
      grid: Grid
    ): number[][];
  }

  export class BestFirstFinder extends AStarFinder {}
  export class BreadthFirstFinder extends AStarFinder {}
  export class DijkstraFinder extends AStarFinder {}
  export class BiAStarFinder extends AStarFinder {}
  export class BiBestFirstFinder extends AStarFinder {}
  export class BiBreadthFirstFinder extends AStarFinder {}
  export class BiDijkstraFinder extends AStarFinder {}
  export class JumpPointFinder extends AStarFinder {}

  const PF: {
    Grid: typeof Grid;
    AStarFinder: typeof AStarFinder;
    BestFirstFinder: typeof BestFirstFinder;
    BreadthFirstFinder: typeof BreadthFirstFinder;
    DijkstraFinder: typeof DijkstraFinder;
    BiAStarFinder: typeof BiAStarFinder;
    BiBestFirstFinder: typeof BiBestFirstFinder;
    BiBreadthFirstFinder: typeof BiBreadthFirstFinder;
    BiDijkstraFinder: typeof BiDijkstraFinder;
    JumpPointFinder: typeof JumpPointFinder;
  };

  export default PF;
}
