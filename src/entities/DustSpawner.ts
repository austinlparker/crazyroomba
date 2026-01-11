import { Scene, Vector3 } from '@babylonjs/core';
import { NavigationGrid } from '../world/NavigationGrid';
import { DustBunny, DustBunnyData } from './DustBunny';
import { CollectedDust } from '../game/GameState';
import { DUST_SPAWN_CONFIG, calculateDustRewards } from '../config/GameConfig';

export class DustSpawner {
  private scene: Scene;
  private navigationGrid: NavigationGrid;
  private dockPosition: Vector3;
  private dustBunnies: Map<string, DustBunny> = new Map();
  private maxDust: number = DUST_SPAWN_CONFIG.maxDust;
  private minDust: number = DUST_SPAWN_CONFIG.minDust;
  private spawnCooldown: number = 0;
  private spawnInterval: number = DUST_SPAWN_CONFIG.spawnInterval;
  private idCounter: number = 0;

  // Queue for respawning dust when collected
  private respawnQueue: number = 0;

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

    // Ensure minimum distance from dock (scale-aware)
    const distanceFromDock = Vector3.Distance(position, this.dockPosition);
    if (distanceFromDock < DUST_SPAWN_CONFIG.minDistanceFromDock) {
      return null; // Too close to dock, try again next frame
    }

    // Calculate path distance using A*
    const pathDistance = this.navigationGrid.getPathDistance(position, this.dockPosition);

    // Calculate rewards based on path distance (scale-aware via GameConfig)
    const { pointValue, timeValue } = calculateDustRewards(pathDistance);

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

  update(isEndlessMode: boolean): void {
    this.spawnCooldown -= 1 / 60; // Approximate delta time

    if (isEndlessMode) {
      // Endless mode: respawn when count drops below minimum
      if (this.spawnCooldown <= 0 && this.dustBunnies.size < this.minDust) {
        this.spawnDust();
        this.spawnCooldown = this.spawnInterval;
      }
    } else {
      // Time Attack mode: process respawn queue
      if (this.spawnCooldown <= 0 && this.respawnQueue > 0) {
        if (this.spawnDust()) {
          this.respawnQueue--;
        }
        this.spawnCooldown = this.spawnInterval;
      }
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

  /**
   * Queue a dust bunny for respawning (used when dust is collected in Time Attack)
   */
  queueRespawn(count: number = 1): void {
    this.respawnQueue += count;
  }

  reset(): void {
    for (const dustBunny of this.dustBunnies.values()) {
      dustBunny.dispose();
    }
    this.dustBunnies.clear();
    this.spawnCooldown = 0;
    this.respawnQueue = 0;
    this.idCounter = 0;
  }

  getDustCount(): number {
    return this.dustBunnies.size;
  }

  getAllDust(): DustBunny[] {
    return Array.from(this.dustBunnies.values());
  }
}
