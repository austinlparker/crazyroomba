import { Scene, Vector3 } from '@babylonjs/core';
import { NavigationGrid } from '../world/NavigationGrid';
import { DustBunny, DustBunnyData } from './DustBunny';
import { CollectedDust } from '../game/GameState';

export class DustSpawner {
  private scene: Scene;
  private navigationGrid: NavigationGrid;
  private dockPosition: Vector3;
  private dustBunnies: Map<string, DustBunny> = new Map();
  private maxDust: number = 15;
  private minDust: number = 8;
  private spawnCooldown: number = 0;
  private spawnInterval: number = 2; // seconds between spawns
  private idCounter: number = 0;

  constructor(scene: Scene, navigationGrid: NavigationGrid, dockPosition: Vector3) {
    this.scene = scene;
    this.navigationGrid = navigationGrid;
    this.dockPosition = dockPosition;
  }

  spawnInitialDust(count: number): void {
    for (let i = 0; i < count; i++) {
      this.spawnDust();
    }
  }

  spawnDust(): DustBunny | null {
    if (this.dustBunnies.size >= this.maxDust) {
      return null;
    }

    // Get random walkable position
    const position = this.navigationGrid.getRandomWalkablePosition();
    if (!position) {
      return null;
    }

    // Ensure minimum distance from dock
    const distanceFromDock = Vector3.Distance(position, this.dockPosition);
    if (distanceFromDock < 3) {
      return null; // Too close to dock, try again next frame
    }

    // Calculate path distance using A*
    const pathDistance = this.navigationGrid.getPathDistance(position, this.dockPosition);

    // Calculate rewards based on path distance
    const { pointValue, timeValue } = this.calculateRewards(pathDistance);

    // Create dust bunny data
    const id = `dust_${this.idCounter++}`;
    const data: DustBunnyData = {
      id,
      position,
      pathDistance,
      pointValue,
      timeValue,
    };

    // Create and add dust bunny
    const dustBunny = new DustBunny(this.scene, data);
    dustBunny.create();
    this.dustBunnies.set(id, dustBunny);

    return dustBunny;
  }

  private calculateRewards(pathDistance: number): { pointValue: number; timeValue: number } {
    // Rewards based on A* path distance from dock
    if (pathDistance >= 40) {
      return { pointValue: 1000, timeValue: 12 };
    } else if (pathDistance >= 25) {
      return { pointValue: 500, timeValue: 8 };
    } else if (pathDistance >= 10) {
      return { pointValue: 250, timeValue: 5 };
    } else {
      return { pointValue: 100, timeValue: 2 };
    }
  }

  update(isEndlessMode: boolean): void {
    // Only respawn in endless mode
    if (!isEndlessMode) {
      return;
    }

    this.spawnCooldown -= 1 / 60; // Approximate delta time

    if (this.spawnCooldown <= 0 && this.dustBunnies.size < this.minDust) {
      this.spawnDust();
      this.spawnCooldown = this.spawnInterval;
    }
  }

  updateVisuals(deltaTime: number): void {
    for (const dustBunny of this.dustBunnies.values()) {
      dustBunny.update(deltaTime);
    }
  }

  checkCollection(roombaPosition: Vector3, collectionRadius: number): CollectedDust[] {
    const collected: CollectedDust[] = [];

    for (const [, dustBunny] of this.dustBunnies) {
      const distance = Vector3.Distance(roombaPosition, dustBunny.getPosition());

      if (distance <= collectionRadius) {
        const data = dustBunny.getData();
        collected.push({
          id: data.id,
          pointValue: data.pointValue,
          timeValue: data.timeValue,
          pathDistance: data.pathDistance,
        });
      }
    }

    return collected;
  }

  removeDust(dust: CollectedDust): void {
    const dustBunny = this.dustBunnies.get(dust.id);
    if (dustBunny) {
      dustBunny.dispose();
      this.dustBunnies.delete(dust.id);
    }
  }

  reset(): void {
    for (const dustBunny of this.dustBunnies.values()) {
      dustBunny.dispose();
    }
    this.dustBunnies.clear();
    this.spawnCooldown = 0;
    this.idCounter = 0;
  }

  getDustCount(): number {
    return this.dustBunnies.size;
  }

  getAllDust(): DustBunny[] {
    return Array.from(this.dustBunnies.values());
  }
}
