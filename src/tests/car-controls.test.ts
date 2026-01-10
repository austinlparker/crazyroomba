import { describe, it, expect } from 'vitest';

/**
 * Car-Style Control Specification:
 *
 * Unlike tank controls where the vehicle can turn in place,
 * car-style controls require movement for turning:
 * - A/D or Left/Right: Steering angle (how much the wheels are turned)
 * - W/S or Up/Down: Throttle (forward/reverse)
 * - Turning only happens while moving (like a real car)
 * - Turn rate is proportional to speed (faster = tighter turns, up to a limit)
 *
 * Camera Behavior:
 * - Trails behind the roomba with significant lag
 * - Positioned to show what's AHEAD of the roomba
 * - Lower viewing angle (more horizontal) to see the environment
 */

interface InputState {
  forward: number; // -1 to 1 (throttle)
  turn: number;    // -1 to 1 (steering angle)
  active: boolean;
}

interface RoombaState {
  rotation: number;      // Current facing direction (radians)
  speed: number;         // Current speed (can be negative for reverse)
  position: { x: number; z: number };
}

interface CameraState {
  alpha: number;         // Horizontal rotation around target
  beta: number;          // Vertical angle
  radius: number;        // Distance from target
}

// Constants for car physics
const CAR_PHYSICS = {
  maxSpeed: 8,
  acceleration: 12,
  deceleration: 8,
  friction: 4,           // Speed reduction when no input
  turnRate: 2.5,         // Base turn rate
  minSpeedForTurn: 0.5,  // Minimum speed needed to turn
  maxTurnAtSpeed: 4,     // Speed at which max turn rate is achieved
};

// Constants for trailing camera
const CAMERA_SETTINGS = {
  trailingSmoothness: 0.08,  // How slowly camera follows (lower = more lag)
  radius: 2.5,               // Distance behind roomba
  beta: Math.PI / 4,         // 45 degrees from horizontal (looking forward)
  heightOffset: 0.8,         // Camera height above roomba
};

/**
 * Car-style physics update:
 * - Acceleration/deceleration based on throttle
 * - Turning only happens while moving
 * - Turn rate scales with speed
 */
function updateCarPhysics(
  state: RoombaState,
  input: InputState,
  deltaTime: number
): RoombaState {
  let newSpeed = state.speed;

  // Apply throttle (acceleration/deceleration)
  if (input.forward > 0) {
    newSpeed += CAR_PHYSICS.acceleration * input.forward * deltaTime;
  } else if (input.forward < 0) {
    newSpeed += CAR_PHYSICS.deceleration * input.forward * deltaTime;
  } else {
    // Apply friction when no input
    if (Math.abs(newSpeed) > 0.01) {
      const frictionForce = CAR_PHYSICS.friction * deltaTime;
      if (newSpeed > 0) {
        newSpeed = Math.max(0, newSpeed - frictionForce);
      } else {
        newSpeed = Math.min(0, newSpeed + frictionForce);
      }
    } else {
      newSpeed = 0;
    }
  }

  // Clamp speed
  newSpeed = Math.max(-CAR_PHYSICS.maxSpeed * 0.5, Math.min(CAR_PHYSICS.maxSpeed, newSpeed));

  // Calculate turn rate based on speed
  // Only turn if moving above minimum speed
  let newRotation = state.rotation;
  const absSpeed = Math.abs(newSpeed);

  if (absSpeed >= CAR_PHYSICS.minSpeedForTurn && input.turn !== 0) {
    // Turn rate increases with speed up to a point, then stays constant
    const speedFactor = Math.min(absSpeed / CAR_PHYSICS.maxTurnAtSpeed, 1);
    const turnAmount = input.turn * CAR_PHYSICS.turnRate * speedFactor * deltaTime;

    // Reverse steering when going backwards (like a real car)
    if (newSpeed < 0) {
      newRotation -= turnAmount;
    } else {
      newRotation += turnAmount;
    }
  }

  // Calculate new position based on speed and rotation
  const forward = {
    x: Math.sin(newRotation),
    z: Math.cos(newRotation),
  };

  const newPosition = {
    x: state.position.x + forward.x * newSpeed * deltaTime,
    z: state.position.z + forward.z * newSpeed * deltaTime,
  };

  return {
    rotation: newRotation,
    speed: newSpeed,
    position: newPosition,
  };
}

/**
 * Trailing camera update:
 * - Smoothly follows roomba rotation with significant lag
 * - Uses lower beta angle to look ahead
 */
function updateTrailingCamera(
  cameraState: CameraState,
  roombaRotation: number,
  _deltaTime: number
): CameraState {
  // Target alpha is behind the roomba
  const targetAlpha = roombaRotation + Math.PI;

  // Calculate angle difference with wrapping
  let alphaDiff = targetAlpha - cameraState.alpha;
  while (alphaDiff > Math.PI) alphaDiff -= Math.PI * 2;
  while (alphaDiff < -Math.PI) alphaDiff += Math.PI * 2;

  // Apply trailing smoothness (much slower than before)
  const newAlpha = cameraState.alpha + alphaDiff * CAMERA_SETTINGS.trailingSmoothness;

  return {
    alpha: newAlpha,
    beta: CAMERA_SETTINGS.beta,
    radius: CAMERA_SETTINGS.radius,
  };
}

describe('Car-Style Steering Physics', () => {
  describe('Turning requires movement', () => {
    it('should NOT turn when stationary, even with steering input', () => {
      const state: RoombaState = {
        rotation: 0,
        speed: 0,
        position: { x: 0, z: 0 },
      };
      const input: InputState = { forward: 0, turn: 1, active: true };

      const result = updateCarPhysics(state, input, 0.016);

      // Rotation should not change when stationary
      expect(result.rotation).toBe(0);
    });

    it('should NOT turn when moving very slowly (below threshold)', () => {
      const state: RoombaState = {
        rotation: 0,
        speed: 0.3, // Below minSpeedForTurn (0.5)
        position: { x: 0, z: 0 },
      };
      const input: InputState = { forward: 0, turn: 1, active: true };

      const result = updateCarPhysics(state, input, 0.016);

      expect(result.rotation).toBe(0);
    });

    it('should turn when moving above minimum speed', () => {
      const state: RoombaState = {
        rotation: 0,
        speed: 4, // Well above minimum
        position: { x: 0, z: 0 },
      };
      const input: InputState = { forward: 0, turn: 1, active: true };

      const result = updateCarPhysics(state, input, 0.016);

      // Should have turned right (positive rotation)
      expect(result.rotation).toBeGreaterThan(0);
    });

    it('should turn left with negative steering input', () => {
      const state: RoombaState = {
        rotation: 0,
        speed: 4,
        position: { x: 0, z: 0 },
      };
      const input: InputState = { forward: 0, turn: -1, active: true };

      const result = updateCarPhysics(state, input, 0.016);

      expect(result.rotation).toBeLessThan(0);
    });
  });

  describe('Turn rate scales with speed', () => {
    it('should turn faster at higher speeds (up to max)', () => {
      const slowState: RoombaState = {
        rotation: 0,
        speed: 1,
        position: { x: 0, z: 0 },
      };
      const fastState: RoombaState = {
        rotation: 0,
        speed: 4,
        position: { x: 0, z: 0 },
      };
      const input: InputState = { forward: 0, turn: 1, active: true };

      const slowResult = updateCarPhysics(slowState, input, 0.016);
      const fastResult = updateCarPhysics(fastState, input, 0.016);

      // Faster speed = more turning
      expect(Math.abs(fastResult.rotation)).toBeGreaterThan(Math.abs(slowResult.rotation));
    });

    it('should cap turn rate at very high speeds', () => {
      const fastState: RoombaState = {
        rotation: 0,
        speed: 6,
        position: { x: 0, z: 0 },
      };
      const veryFastState: RoombaState = {
        rotation: 0,
        speed: 8, // Max speed
        position: { x: 0, z: 0 },
      };
      const input: InputState = { forward: 0, turn: 1, active: true };

      const fastResult = updateCarPhysics(fastState, input, 0.016);
      const veryFastResult = updateCarPhysics(veryFastState, input, 0.016);

      // Turn rates should be similar at high speeds (capped)
      // Allow for some difference due to speed factor calculation
      const turnDiff = Math.abs(veryFastResult.rotation - fastResult.rotation);
      expect(turnDiff).toBeLessThan(0.01);
    });
  });

  describe('Reverse steering', () => {
    it('should reverse steering direction when going backwards', () => {
      const forwardState: RoombaState = {
        rotation: 0,
        speed: 3,
        position: { x: 0, z: 0 },
      };
      const reverseState: RoombaState = {
        rotation: 0,
        speed: -3,
        position: { x: 0, z: 0 },
      };
      const input: InputState = { forward: 0, turn: 1, active: true }; // Steer right

      const forwardResult = updateCarPhysics(forwardState, input, 0.016);
      const reverseResult = updateCarPhysics(reverseState, input, 0.016);

      // When going forward, steering right = rotate positive
      expect(forwardResult.rotation).toBeGreaterThan(0);
      // When going reverse, steering right = rotate negative (opposite)
      expect(reverseResult.rotation).toBeLessThan(0);
    });
  });

  describe('Acceleration and deceleration', () => {
    it('should accelerate when holding forward', () => {
      const state: RoombaState = {
        rotation: 0,
        speed: 0,
        position: { x: 0, z: 0 },
      };
      const input: InputState = { forward: 1, turn: 0, active: true };

      const result = updateCarPhysics(state, input, 0.1);

      expect(result.speed).toBeGreaterThan(0);
    });

    it('should decelerate (brake/reverse) when holding back', () => {
      const state: RoombaState = {
        rotation: 0,
        speed: 4,
        position: { x: 0, z: 0 },
      };
      const input: InputState = { forward: -1, turn: 0, active: true };

      const result = updateCarPhysics(state, input, 0.1);

      expect(result.speed).toBeLessThan(4);
    });

    it('should apply friction when no throttle input', () => {
      const state: RoombaState = {
        rotation: 0,
        speed: 4,
        position: { x: 0, z: 0 },
      };
      const input: InputState = { forward: 0, turn: 0, active: false };

      const result = updateCarPhysics(state, input, 0.1);

      // Should slow down due to friction
      expect(result.speed).toBeLessThan(4);
      expect(result.speed).toBeGreaterThan(0);
    });

    it('should clamp to max speed', () => {
      const state: RoombaState = {
        rotation: 0,
        speed: 7.9,
        position: { x: 0, z: 0 },
      };
      const input: InputState = { forward: 1, turn: 0, active: true };

      const result = updateCarPhysics(state, input, 1); // Long deltaTime to exceed max

      expect(result.speed).toBeLessThanOrEqual(CAR_PHYSICS.maxSpeed);
    });

    it('should allow reverse but at reduced max speed', () => {
      const state: RoombaState = {
        rotation: 0,
        speed: -3,
        position: { x: 0, z: 0 },
      };
      const input: InputState = { forward: -1, turn: 0, active: true };

      const result = updateCarPhysics(state, input, 1); // Long deltaTime

      // Reverse max is half of forward max
      expect(result.speed).toBeGreaterThanOrEqual(-CAR_PHYSICS.maxSpeed * 0.5);
    });
  });

  describe('Position updates', () => {
    it('should move forward in facing direction', () => {
      const state: RoombaState = {
        rotation: 0, // Facing +Z
        speed: 4,
        position: { x: 0, z: 0 },
      };
      const input: InputState = { forward: 0, turn: 0, active: false };

      const result = updateCarPhysics(state, input, 0.1);

      // Should have moved in +Z direction
      expect(result.position.z).toBeGreaterThan(0);
      expect(result.position.x).toBeCloseTo(0);
    });

    it('should move in rotated direction', () => {
      const state: RoombaState = {
        rotation: Math.PI / 2, // Facing +X
        speed: 4,
        position: { x: 0, z: 0 },
      };
      const input: InputState = { forward: 0, turn: 0, active: false };

      const result = updateCarPhysics(state, input, 0.1);

      // Should have moved in +X direction
      expect(result.position.x).toBeGreaterThan(0);
      expect(result.position.z).toBeCloseTo(0, 1);
    });
  });
});

describe('Trailing Camera', () => {
  describe('Camera lag/trailing', () => {
    it('should follow roomba rotation with significant lag', () => {
      const cameraState: CameraState = {
        alpha: Math.PI, // Behind roomba facing forward
        beta: CAMERA_SETTINGS.beta,
        radius: CAMERA_SETTINGS.radius,
      };
      const roombaRotation = Math.PI / 2; // Roomba turned 90 degrees right

      const result = updateTrailingCamera(cameraState, roombaRotation, 0.016);

      // Camera should have moved toward new position, but not reached it
      const targetAlpha = roombaRotation + Math.PI;
      expect(result.alpha).not.toBeCloseTo(targetAlpha, 1);
      expect(result.alpha).toBeGreaterThan(Math.PI); // Moving toward target
    });

    it('should have much more lag than old camera (0.08 vs 0.25)', () => {
      const cameraState: CameraState = {
        alpha: Math.PI,
        beta: CAMERA_SETTINGS.beta,
        radius: CAMERA_SETTINGS.radius,
      };
      const roombaRotation = Math.PI / 4;

      // Trailing camera update
      const trailingResult = updateTrailingCamera(cameraState, roombaRotation, 0.016);

      // Old tight-follow camera update (0.25 smoothing)
      const targetAlpha = roombaRotation + Math.PI;
      let alphaDiff = targetAlpha - cameraState.alpha;
      while (alphaDiff > Math.PI) alphaDiff -= Math.PI * 2;
      while (alphaDiff < -Math.PI) alphaDiff += Math.PI * 2;
      const oldCameraAlpha = cameraState.alpha + alphaDiff * 0.25;

      // Trailing camera should move less per frame
      const trailingMovement = Math.abs(trailingResult.alpha - cameraState.alpha);
      const oldMovement = Math.abs(oldCameraAlpha - cameraState.alpha);

      expect(trailingMovement).toBeLessThan(oldMovement);
    });

    it('should eventually converge to behind roomba', () => {
      let cameraState: CameraState = {
        alpha: Math.PI,
        beta: CAMERA_SETTINGS.beta,
        radius: CAMERA_SETTINGS.radius,
      };
      const roombaRotation = Math.PI / 2;
      const targetAlpha = roombaRotation + Math.PI;

      // Simulate many frames
      for (let i = 0; i < 200; i++) {
        cameraState = updateTrailingCamera(cameraState, roombaRotation, 0.016);
      }

      // Should be very close to target after many frames
      expect(cameraState.alpha).toBeCloseTo(targetAlpha, 1);
    });
  });

  describe('Camera positioning for environment visibility', () => {
    it('should use a lower beta angle to see ahead (not top-down)', () => {
      // Old camera beta was Math.PI / 3.5 (~51 degrees from vertical = looking down)
      // New camera beta should be Math.PI / 4 (45 degrees = more horizontal)
      expect(CAMERA_SETTINGS.beta).toBeLessThan(Math.PI / 3);
      expect(CAMERA_SETTINGS.beta).toBeCloseTo(Math.PI / 4);
    });

    it('should be further back to show more environment', () => {
      // Old camera radius was 1.2 (very close)
      // New camera should be further back
      expect(CAMERA_SETTINGS.radius).toBeGreaterThan(1.5);
    });

    it('should maintain consistent beta angle (not varying)', () => {
      const cameraState: CameraState = {
        alpha: Math.PI,
        beta: CAMERA_SETTINGS.beta,
        radius: CAMERA_SETTINGS.radius,
      };

      const result = updateTrailingCamera(cameraState, Math.PI / 2, 0.016);

      // Beta should stay constant
      expect(result.beta).toBe(CAMERA_SETTINGS.beta);
    });
  });

  describe('Angle wrapping', () => {
    it('should handle crossing 0/2PI boundary correctly', () => {
      const cameraState: CameraState = {
        alpha: 0.1, // Just past 0
        beta: CAMERA_SETTINGS.beta,
        radius: CAMERA_SETTINGS.radius,
      };
      const roombaRotation = -Math.PI + 0.1; // Target alpha would be 0.1 + PI = just past PI

      const result = updateTrailingCamera(cameraState, roombaRotation, 0.016);

      // Should take the short path
      const movement = Math.abs(result.alpha - cameraState.alpha);
      expect(movement).toBeLessThan(Math.PI);
    });
  });
});

describe('Combined Car Controls + Camera Integration', () => {
  it('should show roomba turning visibly before camera catches up', () => {
    let roombaState: RoombaState = {
      rotation: 0,
      speed: 5,
      position: { x: 0, z: 0 },
    };
    let cameraState: CameraState = {
      alpha: Math.PI,
      beta: CAMERA_SETTINGS.beta,
      radius: CAMERA_SETTINGS.radius,
    };

    const turnInput: InputState = { forward: 1, turn: 1, active: true };

    // Simulate several frames of turning
    for (let i = 0; i < 10; i++) {
      roombaState = updateCarPhysics(roombaState, turnInput, 0.016);
      cameraState = updateTrailingCamera(cameraState, roombaState.rotation, 0.016);
    }

    // The visual angle difference (how rotated the roomba appears on screen)
    // is the difference between where camera thinks "forward" is and where roomba faces
    const cameraForward = cameraState.alpha - Math.PI;
    const visualRotationDiff = roombaState.rotation - cameraForward;

    // Should be significant - player can see the roomba turning
    expect(Math.abs(visualRotationDiff)).toBeGreaterThan(0.1);
  });

  it('should allow player to see where they are going', () => {
    // With the lower beta angle and further back camera,
    // more of the environment ahead should be visible

    // Camera at 45 degrees from horizontal means roughly equal parts
    // ground and horizon are visible
    const horizonVisibility = Math.cos(CAMERA_SETTINGS.beta);
    const groundVisibility = Math.sin(CAMERA_SETTINGS.beta);

    // Should be roughly balanced (within 30% of each other)
    const ratio = horizonVisibility / groundVisibility;
    expect(ratio).toBeGreaterThan(0.7);
    expect(ratio).toBeLessThan(1.3);
  });
});

describe('Input Mapping for Car-Style Controls', () => {
  function mapKeyboardToCarInput(keys: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  }): InputState {
    let turn = 0;
    let forward = 0;

    // A/D = steering angle
    if (keys.left) turn = -1;
    else if (keys.right) turn = 1;

    // W = gas, S = brake/reverse
    if (keys.up) forward = 1;
    else if (keys.down) forward = -1;

    return {
      forward,
      turn,
      active: forward !== 0 || turn !== 0,
    };
  }

  it('should map W to forward throttle', () => {
    const input = mapKeyboardToCarInput({ left: false, right: false, up: true, down: false });
    expect(input.forward).toBe(1);
  });

  it('should map S to reverse/brake', () => {
    const input = mapKeyboardToCarInput({ left: false, right: false, up: false, down: true });
    expect(input.forward).toBe(-1);
  });

  it('should map A to steer left', () => {
    const input = mapKeyboardToCarInput({ left: true, right: false, up: false, down: false });
    expect(input.turn).toBe(-1);
  });

  it('should map D to steer right', () => {
    const input = mapKeyboardToCarInput({ left: false, right: true, up: false, down: false });
    expect(input.turn).toBe(1);
  });

  it('should allow simultaneous steering and throttle', () => {
    const input = mapKeyboardToCarInput({ left: true, right: false, up: true, down: false });
    expect(input.turn).toBe(-1);
    expect(input.forward).toBe(1);
  });
});
