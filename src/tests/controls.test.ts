import { describe, it, expect } from 'vitest';

/**
 * Twin-Stick Control Specification:
 *
 * The game uses twin-stick controls where:
 * - LEFT stick X axis: Controls roomba ROTATION (turn left/right)
 * - RIGHT stick Y axis: Controls roomba MOVEMENT (forward/backward)
 *
 * The camera should always follow the roomba's rotation,
 * staying behind and pointing in the same direction as the roomba.
 */

// Mock InputState interface matching the game's expected format
interface InputState {
  forward: number; // -1 to 1 (movement: forward/back)
  turn: number;    // -1 to 1 (rotation: left/right)
  active: boolean;
}

// Simulate joystick values
interface JoystickValues {
  x: number; // -1 to 1 horizontal
  y: number; // -1 to 1 vertical
}

/**
 * This function should map twin-stick inputs to game controls:
 * - Left stick X → turn (rotation)
 * - Right stick Y → forward (movement)
 */
function mapTwinStickToInput(
  leftStick: JoystickValues,
  rightStick: JoystickValues
): InputState {
  // Normalize -0 to 0 to avoid JavaScript quirks with Object.is(-0, 0) === false
  const normalizeZero = (n: number) => (n === 0 ? 0 : n);
  return {
    turn: normalizeZero(leftStick.x),        // Left stick horizontal = rotation
    forward: normalizeZero(-rightStick.y),   // Right stick vertical = movement (inverted: up = forward)
    active: Math.abs(leftStick.x) > 0.01 || Math.abs(leftStick.y) > 0.01 ||
            Math.abs(rightStick.x) > 0.01 || Math.abs(rightStick.y) > 0.01,
  };
}

/**
 * This function should map keyboard inputs to game controls:
 * - A/D or Left/Right arrows → turn (rotation)
 * - W/S or Up/Down arrows → forward (movement)
 */
function mapKeyboardToInput(keys: {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}): InputState {
  let turn = 0;
  let forward = 0;

  // A/D or Left/Right = rotation
  if (keys.left) turn = -1;
  else if (keys.right) turn = 1;

  // W/S or Up/Down = movement
  if (keys.up) forward = 1;
  else if (keys.down) forward = -1;

  return {
    forward,
    turn,
    active: forward !== 0 || turn !== 0,
  };
}

describe('Twin-Stick Controls', () => {
  describe('Left Stick (Rotation)', () => {
    it('should turn left when left stick is pushed left', () => {
      const leftStick = { x: -1, y: 0 };
      const rightStick = { x: 0, y: 0 };
      const input = mapTwinStickToInput(leftStick, rightStick);

      expect(input.turn).toBe(-1);
      expect(input.forward).toBe(0);
    });

    it('should turn right when left stick is pushed right', () => {
      const leftStick = { x: 1, y: 0 };
      const rightStick = { x: 0, y: 0 };
      const input = mapTwinStickToInput(leftStick, rightStick);

      expect(input.turn).toBe(1);
      expect(input.forward).toBe(0);
    });

    it('should NOT affect forward/backward when only using left stick', () => {
      const leftStick = { x: 0.5, y: 0.8 };
      const rightStick = { x: 0, y: 0 };
      const input = mapTwinStickToInput(leftStick, rightStick);

      expect(input.turn).toBe(0.5);
      expect(input.forward).toBe(0);
    });
  });

  describe('Right Stick (Movement)', () => {
    it('should move forward when right stick is pushed up', () => {
      const leftStick = { x: 0, y: 0 };
      const rightStick = { x: 0, y: -1 }; // Up = negative Y in screen coords
      const input = mapTwinStickToInput(leftStick, rightStick);

      expect(input.forward).toBe(1);
      expect(input.turn).toBe(0);
    });

    it('should move backward when right stick is pushed down', () => {
      const leftStick = { x: 0, y: 0 };
      const rightStick = { x: 0, y: 1 }; // Down = positive Y in screen coords
      const input = mapTwinStickToInput(leftStick, rightStick);

      expect(input.forward).toBe(-1);
      expect(input.turn).toBe(0);
    });

    it('should NOT affect rotation when only using right stick', () => {
      const leftStick = { x: 0, y: 0 };
      const rightStick = { x: 0.7, y: -0.5 };
      const input = mapTwinStickToInput(leftStick, rightStick);

      expect(input.turn).toBe(0);
      expect(input.forward).toBe(0.5);
    });
  });

  describe('Combined Input', () => {
    it('should handle simultaneous rotation and movement', () => {
      const leftStick = { x: -0.5, y: 0 };  // Half left turn
      const rightStick = { x: 0, y: -0.8 }; // 80% forward
      const input = mapTwinStickToInput(leftStick, rightStick);

      expect(input.turn).toBe(-0.5);
      expect(input.forward).toBe(0.8);
      expect(input.active).toBe(true);
    });

    it('should be inactive when no input', () => {
      const leftStick = { x: 0, y: 0 };
      const rightStick = { x: 0, y: 0 };
      const input = mapTwinStickToInput(leftStick, rightStick);

      expect(input.active).toBe(false);
    });
  });
});

describe('Keyboard Controls', () => {
  describe('Rotation Keys (A/D)', () => {
    it('should turn left when A/Left is pressed', () => {
      const input = mapKeyboardToInput({ left: true, right: false, up: false, down: false });
      expect(input.turn).toBe(-1);
      expect(input.forward).toBe(0);
    });

    it('should turn right when D/Right is pressed', () => {
      const input = mapKeyboardToInput({ left: false, right: true, up: false, down: false });
      expect(input.turn).toBe(1);
      expect(input.forward).toBe(0);
    });
  });

  describe('Movement Keys (W/S)', () => {
    it('should move forward when W/Up is pressed', () => {
      const input = mapKeyboardToInput({ left: false, right: false, up: true, down: false });
      expect(input.forward).toBe(1);
      expect(input.turn).toBe(0);
    });

    it('should move backward when S/Down is pressed', () => {
      const input = mapKeyboardToInput({ left: false, right: false, up: false, down: true });
      expect(input.forward).toBe(-1);
      expect(input.turn).toBe(0);
    });
  });

  describe('Combined Keys', () => {
    it('should handle turn and move simultaneously', () => {
      const input = mapKeyboardToInput({ left: true, right: false, up: true, down: false });
      expect(input.turn).toBe(-1);
      expect(input.forward).toBe(1);
      expect(input.active).toBe(true);
    });
  });
});

describe('Roomba Physics', () => {
  // Simulates Roomba.update() logic
  function updateRoomba(
    currentRotation: number,
    _currentVelocity: { x: number; z: number },
    input: InputState,
    deltaTime: number,
    turnSpeed: number = 3,
    speed: number = 8
  ) {
    // Update rotation based on turn input
    const newRotation = currentRotation + input.turn * turnSpeed * deltaTime;

    // Calculate forward vector based on rotation
    const forward = {
      x: Math.sin(newRotation),
      z: Math.cos(newRotation),
    };

    // Calculate target velocity
    const targetVelocity = {
      x: forward.x * input.forward * speed,
      z: forward.z * input.forward * speed,
    };

    return {
      rotation: newRotation,
      velocity: targetVelocity,
    };
  }

  it('should rotate when turn input is applied', () => {
    const result = updateRoomba(0, { x: 0, z: 0 }, { forward: 0, turn: 1, active: true }, 1);
    expect(result.rotation).toBeCloseTo(3); // turnSpeed * deltaTime * turn
  });

  it('should move in facing direction when forward input is applied', () => {
    // Facing forward (rotation = 0, so forward is +Z direction)
    const result = updateRoomba(0, { x: 0, z: 0 }, { forward: 1, turn: 0, active: true }, 1);
    expect(result.velocity.x).toBeCloseTo(0);
    expect(result.velocity.z).toBeCloseTo(8); // speed * forward
  });

  it('should move in rotated direction after turning', () => {
    // After 90 degree turn (PI/2), forward should be +X direction
    const result = updateRoomba(Math.PI / 2, { x: 0, z: 0 }, { forward: 1, turn: 0, active: true }, 1);
    expect(result.velocity.x).toBeCloseTo(8);
    expect(result.velocity.z).toBeCloseTo(0);
  });

  it('should not move when no forward input', () => {
    const result = updateRoomba(0, { x: 0, z: 0 }, { forward: 0, turn: 1, active: true }, 1);
    expect(result.velocity.x).toBeCloseTo(0);
    expect(result.velocity.z).toBeCloseTo(0);
  });
});

describe('Camera Following', () => {
  // Simulates ThirdPersonCamera auto-follow behavior
  function calculateCameraAlpha(roombaRotation: number): number {
    // Camera should be behind roomba, so alpha = rotation + PI
    return roombaRotation + Math.PI;
  }

  it('should position camera behind roomba (alpha = rotation + PI)', () => {
    expect(calculateCameraAlpha(0)).toBeCloseTo(Math.PI);
    expect(calculateCameraAlpha(Math.PI / 2)).toBeCloseTo(Math.PI * 1.5);
    expect(calculateCameraAlpha(Math.PI)).toBeCloseTo(Math.PI * 2);
  });

  it('should follow roomba as it rotates', () => {
    const rotations = [0, Math.PI / 4, Math.PI / 2, Math.PI];
    for (const rotation of rotations) {
      const cameraAlpha = calculateCameraAlpha(rotation);
      // Camera should always be PI radians behind roomba
      expect(cameraAlpha - rotation).toBeCloseTo(Math.PI);
    }
  });
});
