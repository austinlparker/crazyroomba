import { Vector3 } from '@babylonjs/core';
import { Grid, AStarFinder } from 'pathfinding';
import { House } from './House';

export class NavigationGrid {
  private house: House;
  private grid: Grid;
  private finder: AStarFinder;
  private cellSize: number = 0.5;
  private offsetX: number = 15; // Offset to convert world coords to grid coords
  private offsetZ: number = 15;
  private gridWidth: number;
  private gridHeight: number;

  constructor(house: House) {
    this.house = house;
    const bounds = house.getBounds();
    this.gridWidth = Math.ceil((bounds.max.x - bounds.min.x) / this.cellSize);
    this.gridHeight = Math.ceil((bounds.max.z - bounds.min.z) / this.cellSize);
    this.grid = new Grid(this.gridWidth, this.gridHeight);
    this.finder = new AStarFinder({
      allowDiagonal: true,
      dontCrossCorners: true,
    });
  }

  generate(): void {
    // Start with all cells walkable
    for (let x = 0; x < this.gridWidth; x++) {
      for (let z = 0; z < this.gridHeight; z++) {
        this.grid.setWalkableAt(x, z, true);
      }
    }

    // Mark walls as non-walkable
    for (const wall of this.house.getWallMeshes()) {
      this.markMeshAsBlocked(wall);
    }

    // Mark obstacles as non-walkable
    for (const obstacle of this.house.getObstacleMeshes()) {
      this.markMeshAsBlocked(obstacle);
    }

    // Mark out-of-bounds areas as non-walkable
    this.markOutOfBounds();
  }

  private markMeshAsBlocked(mesh: { position: Vector3; getBoundingInfo: () => { boundingBox: { minimumWorld: Vector3; maximumWorld: Vector3 } } }): void {
    const bounds = mesh.getBoundingInfo().boundingBox;
    const min = bounds.minimumWorld;
    const max = bounds.maximumWorld;

    // Add padding around obstacles
    const padding = 0.3;
    const minX = Math.floor((min.x - padding + this.offsetX) / this.cellSize);
    const maxX = Math.ceil((max.x + padding + this.offsetX) / this.cellSize);
    const minZ = Math.floor((min.z - padding + this.offsetZ) / this.cellSize);
    const maxZ = Math.ceil((max.z + padding + this.offsetZ) / this.cellSize);

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (this.isValidCell(x, z)) {
          this.grid.setWalkableAt(x, z, false);
        }
      }
    }
  }

  private markOutOfBounds(): void {
    // Mark exterior walls (areas outside the house)
    const bounds = this.house.getBounds();

    for (let x = 0; x < this.gridWidth; x++) {
      for (let z = 0; z < this.gridHeight; z++) {
        const worldX = x * this.cellSize - this.offsetX;
        const worldZ = z * this.cellSize - this.offsetZ;

        // Check if cell is outside house bounds
        if (
          worldX < bounds.min.x + 0.5 ||
          worldX > bounds.max.x - 0.5 ||
          worldZ < bounds.min.z + 0.5 ||
          worldZ > bounds.max.z - 0.5
        ) {
          this.grid.setWalkableAt(x, z, false);
        }
      }
    }
  }

  private isValidCell(x: number, z: number): boolean {
    return x >= 0 && x < this.gridWidth && z >= 0 && z < this.gridHeight;
  }

  worldToGrid(worldPos: Vector3): { x: number; z: number } {
    return {
      x: Math.floor((worldPos.x + this.offsetX) / this.cellSize),
      z: Math.floor((worldPos.z + this.offsetZ) / this.cellSize),
    };
  }

  gridToWorld(gridX: number, gridZ: number): Vector3 {
    return new Vector3(
      gridX * this.cellSize - this.offsetX + this.cellSize / 2,
      0,
      gridZ * this.cellSize - this.offsetZ + this.cellSize / 2
    );
  }

  findPath(from: Vector3, to: Vector3): Vector3[] {
    const startGrid = this.worldToGrid(from);
    const endGrid = this.worldToGrid(to);

    // Clamp to valid range
    const clampedStart = {
      x: Math.max(0, Math.min(this.gridWidth - 1, startGrid.x)),
      z: Math.max(0, Math.min(this.gridHeight - 1, startGrid.z)),
    };
    const clampedEnd = {
      x: Math.max(0, Math.min(this.gridWidth - 1, endGrid.x)),
      z: Math.max(0, Math.min(this.gridHeight - 1, endGrid.z)),
    };

    // Clone grid for pathfinding (finder modifies grid)
    const gridClone = this.grid.clone();

    const path = this.finder.findPath(
      clampedStart.x,
      clampedStart.z,
      clampedEnd.x,
      clampedEnd.z,
      gridClone
    );

    return path.map((point) => this.gridToWorld(point[0], point[1]));
  }

  getPathDistance(from: Vector3, to: Vector3): number {
    const path = this.findPath(from, to);

    if (path.length < 2) {
      // No path found or same cell, use direct distance
      return Vector3.Distance(from, to);
    }

    // Calculate total path length
    let distance = 0;
    for (let i = 0; i < path.length - 1; i++) {
      distance += Vector3.Distance(path[i], path[i + 1]);
    }

    return distance;
  }

  isWalkable(worldPos: Vector3): boolean {
    const gridPos = this.worldToGrid(worldPos);
    if (!this.isValidCell(gridPos.x, gridPos.z)) {
      return false;
    }
    return this.grid.isWalkableAt(gridPos.x, gridPos.z);
  }

  getRandomWalkablePosition(): Vector3 | null {
    const maxAttempts = 100;

    for (let i = 0; i < maxAttempts; i++) {
      const x = Math.floor(Math.random() * this.gridWidth);
      const z = Math.floor(Math.random() * this.gridHeight);

      if (this.grid.isWalkableAt(x, z)) {
        return this.gridToWorld(x, z);
      }
    }

    return null;
  }

  getCellSize(): number {
    return this.cellSize;
  }
}
