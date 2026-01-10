import { Scene, KeyboardEventTypes } from '@babylonjs/core';

export interface InputState {
  forward: number; // -1 to 1 (throttle: forward/back)
  turn: number; // -1 to 1 (steering: left/right)
  pause: boolean;
  active: boolean;
}

export class InputSystem {
  private scene: Scene;
  private canvas: HTMLCanvasElement;

  private keys: Map<string, boolean> = new Map();
  private pausePressed: boolean = false;

  // Mouse drag state
  private isDragging: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private mouseDeltaX: number = 0;
  private mouseDeltaY: number = 0;
  private mouseWheelDelta: number = 0;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.canvas = canvas;

    this.setupKeyboardInput();
    this.setupMouseInput();
  }

  private setupKeyboardInput(): void {
    this.scene.onKeyboardObservable.add((kbInfo) => {
      const key = kbInfo.event.key.toLowerCase();

      if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
        this.keys.set(key, true);

        // Handle pause separately (single press)
        if (key === 'escape' || key === 'p') {
          this.pausePressed = true;
        }
      } else if (kbInfo.type === KeyboardEventTypes.KEYUP) {
        this.keys.set(key, false);
      }
    });

    // Also handle arrow keys with event.code
    this.canvas.addEventListener('keydown', (e) => {
      this.keys.set(e.code.toLowerCase(), true);
    });

    this.canvas.addEventListener('keyup', (e) => {
      this.keys.set(e.code.toLowerCase(), false);
    });
  }

  private setupMouseInput(): void {
    // Right-click drag for camera rotation
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) { // Right mouse button
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        e.preventDefault();
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.mouseDeltaX += (e.clientX - this.lastMouseX) * 0.01;
        this.mouseDeltaY += (e.clientY - this.lastMouseY) * 0.01;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        this.isDragging = false;
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.isDragging = false;
    });

    // Prevent context menu on right-click
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Mouse wheel for zoom
    this.canvas.addEventListener('wheel', (e) => {
      this.mouseWheelDelta += e.deltaY * 0.001;
      e.preventDefault();
    }, { passive: false });
  }

  getInput(): InputState {
    let forward = 0;
    let turn = 0;

    // Forward/backward (W/S or Up/Down arrows)
    if (this.isKeyPressed('w') || this.isKeyPressed('arrowup')) {
      forward = 1;
    } else if (this.isKeyPressed('s') || this.isKeyPressed('arrowdown')) {
      forward = -1;
    }

    // Turn left/right (A/D or Left/Right arrows)
    if (this.isKeyPressed('a') || this.isKeyPressed('arrowleft')) {
      turn = 1; // Turn left (positive rotation)
    } else if (this.isKeyPressed('d') || this.isKeyPressed('arrowright')) {
      turn = -1; // Turn right (negative rotation)
    }

    // Reset mouse deltas (not used for movement anymore)
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.mouseWheelDelta = 0;

    // Get and reset pause state
    const pause = this.pausePressed;
    this.pausePressed = false;

    return {
      forward,
      turn,
      pause,
      active: forward !== 0 || turn !== 0,
    };
  }

  private isKeyPressed(key: string): boolean {
    return this.keys.get(key) === true;
  }

  reset(): void {
    this.keys.clear();
    this.pausePressed = false;
    this.isDragging = false;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.mouseWheelDelta = 0;
  }
}
