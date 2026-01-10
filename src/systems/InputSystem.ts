import { Scene, KeyboardEventTypes } from '@babylonjs/core';

export interface InputState {
  forward: number; // -1 to 1
  turn: number; // -1 to 1
  pause: boolean;
  active: boolean;
}

export class InputSystem {
  private scene: Scene;
  private canvas: HTMLCanvasElement;

  private keys: Map<string, boolean> = new Map();
  private pausePressed: boolean = false;

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
    // Mouse input could be used for click-to-move
    // For now, we rely on keyboard and touch
  }

  getInput(): InputState {
    let forward = 0;
    let turn = 0;

    // Forward/backward
    if (this.isKeyPressed('w') || this.isKeyPressed('arrowup')) {
      forward = 1;
    } else if (this.isKeyPressed('s') || this.isKeyPressed('arrowdown')) {
      forward = -1;
    }

    // Left/right turn
    if (this.isKeyPressed('a') || this.isKeyPressed('arrowleft')) {
      turn = 1;
    } else if (this.isKeyPressed('d') || this.isKeyPressed('arrowright')) {
      turn = -1;
    }

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
  }
}
