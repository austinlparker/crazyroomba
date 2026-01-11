/**
 * Central game configuration for scale-aware constants.
 * All distance-based calculations should reference this config
 * so that when we change world/entity scale, everything scales together.
 */

// Base world scale factor - 1.0 = realistic scale (1 unit = 1 meter)
export const WORLD_SCALE = 1.0;

// Roomba physical dimensions (realistic Roomba i7: 35cm diameter, 9cm height)
export const ROOMBA_CONFIG = {
  diameter: 0.35 * WORLD_SCALE,
  height: 0.09 * WORLD_SCALE,
  collectionRadius: 0.8 * WORLD_SCALE,
  binCapacity: 5,
};

// Camera settings relative to roomba scale
// These multipliers are applied to roomba diameter to keep camera proportional
export const CAMERA_CONFIG = {
  // Distance behind roomba (multiplied by roomba diameter)
  distanceMultiplier: 4.0,  // 4x roomba diameter = ~1.4 units
  // Height above roomba (multiplied by roomba diameter)
  heightMultiplier: 3.0,    // 3x roomba diameter = ~1.05 units
  // Look-ahead height above roomba center
  lookAheadHeightMultiplier: 1.0,  // 1x roomba diameter
  // Minimum distance from walls (for collision avoidance)
  wallBuffer: 0.3 * WORLD_SCALE,
};

// Computed camera values (for convenience)
export function getCameraSettings(roombaDiameter: number) {
  return {
    distance: roombaDiameter * CAMERA_CONFIG.distanceMultiplier,
    height: roombaDiameter * CAMERA_CONFIG.heightMultiplier,
    lookAheadHeight: roombaDiameter * CAMERA_CONFIG.lookAheadHeightMultiplier,
    wallBuffer: CAMERA_CONFIG.wallBuffer,
  };
}

// Dust spawner distance thresholds (for reward calculation)
// These scale with the world so rewards stay proportional
export const DUST_SPAWN_CONFIG = {
  maxDust: 15,
  minDust: 8,
  spawnInterval: 2, // seconds
  // Minimum distance from dock for spawning
  minDistanceFromDock: 3 * WORLD_SCALE,
  // Distance thresholds for rewards (A* path distance)
  // These are scaled by WORLD_SCALE to maintain proportions
  distanceThresholds: {
    veryFar: 40 * WORLD_SCALE,   // 1000 points, +12 seconds
    far: 25 * WORLD_SCALE,       // 500 points, +8 seconds
    medium: 10 * WORLD_SCALE,    // 250 points, +5 seconds
    // Below medium = close: 100 points, +2 seconds
  },
  rewards: {
    veryFar: { pointValue: 1000, timeValue: 12 },
    far: { pointValue: 500, timeValue: 8 },
    medium: { pointValue: 250, timeValue: 5 },
    close: { pointValue: 100, timeValue: 2 },
  },
};

// Calculate rewards based on path distance (scale-aware)
export function calculateDustRewards(pathDistance: number): { pointValue: number; timeValue: number } {
  const thresholds = DUST_SPAWN_CONFIG.distanceThresholds;
  const rewards = DUST_SPAWN_CONFIG.rewards;

  if (pathDistance >= thresholds.veryFar) {
    return rewards.veryFar;
  } else if (pathDistance >= thresholds.far) {
    return rewards.far;
  } else if (pathDistance >= thresholds.medium) {
    return rewards.medium;
  } else {
    return rewards.close;
  }
}

// House/world dimensions (expanded layout with hallway and more rooms)
export const WORLD_CONFIG = {
  roomSize: 5 * WORLD_SCALE, // Varied room sizes now
  wallHeight: 3 * WORLD_SCALE,
  wallThickness: 0.2 * WORLD_SCALE,
  bounds: {
    min: { x: -9 * WORLD_SCALE, y: 0, z: -7 * WORLD_SCALE },
    max: { x: 10 * WORLD_SCALE, y: 3 * WORLD_SCALE, z: 8 * WORLD_SCALE },
  },
};

// Charging dock config
export const DOCK_CONFIG = {
  depositRange: 0.7 * WORLD_SCALE,
};
