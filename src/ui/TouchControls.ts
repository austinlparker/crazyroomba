export interface TouchInput {
  forward: number;
  turn: number;
  cameraX: number; // Camera horizontal rotation
  cameraY: number; // Camera vertical (zoom/tilt)
  active: boolean;
}

interface Joystick {
  outer: HTMLDivElement;
  inner: HTMLDivElement;
  isActive: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  touchId: number | null;
}

export class TouchControls {
  private container: HTMLDivElement;
  private leftStick: Joystick;
  private rightStick: Joystick;

  private maxDistance: number = 50;

  private input: TouchInput = {
    forward: 0,
    turn: 0,
    cameraX: 0,
    cameraY: 0,
    active: false,
  };

  constructor(_canvas: HTMLCanvasElement) {
    this.container = null!;
    this.leftStick = this.createEmptyJoystick();
    this.rightStick = this.createEmptyJoystick();

    this.createControls();
    this.setupTouchEvents();
  }

  private createEmptyJoystick(): Joystick {
    return {
      outer: null!,
      inner: null!,
      isActive: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      touchId: null,
    };
  }

  private createControls(): void {
    // Main container
    this.container = document.createElement('div');
    this.container.id = 'touch-controls';
    this.container.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 200px;
      display: none;
      z-index: 15;
      pointer-events: none;
    `;

    // Left joystick (movement)
    const leftContainer = this.createJoystickContainer('left');
    leftContainer.style.left = '30px';
    this.leftStick = this.createJoystick(leftContainer);
    this.container.appendChild(leftContainer);

    // Right joystick (camera)
    const rightContainer = this.createJoystickContainer('right');
    rightContainer.style.right = '30px';
    this.rightStick = this.createJoystick(rightContainer);
    this.container.appendChild(rightContainer);

    // Labels
    const leftLabel = this.createLabel('MOVE');
    leftContainer.appendChild(leftLabel);

    const rightLabel = this.createLabel('CAMERA');
    rightContainer.appendChild(rightLabel);

    document.body.appendChild(this.container);
  }

  private createJoystickContainer(id: string): HTMLDivElement {
    const container = document.createElement('div');
    container.id = `joystick-${id}`;
    container.style.cssText = `
      position: absolute;
      bottom: 20px;
      width: 140px;
      height: 140px;
      pointer-events: auto;
    `;
    return container;
  }

  private createJoystick(container: HTMLDivElement): Joystick {
    // Outer ring
    const outer = document.createElement('div');
    outer.style.cssText = `
      position: absolute;
      width: 120px;
      height: 120px;
      border: 3px solid rgba(255,255,255,0.4);
      border-radius: 50%;
      background: rgba(0,0,0,0.3);
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
    `;

    // Inner stick
    const inner = document.createElement('div');
    inner.style.cssText = `
      position: absolute;
      width: 50px;
      height: 50px;
      background: rgba(78, 204, 163, 0.8);
      border-radius: 50%;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      transition: none;
    `;

    outer.appendChild(inner);
    container.appendChild(outer);

    return {
      outer,
      inner,
      isActive: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      touchId: null,
    };
  }

  private createLabel(text: string): HTMLDivElement {
    const label = document.createElement('div');
    label.textContent = text;
    label.style.cssText = `
      position: absolute;
      bottom: -25px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(255,255,255,0.5);
      font-size: 12px;
      font-family: monospace;
      text-transform: uppercase;
      letter-spacing: 2px;
    `;
    return label;
  }

  private setupTouchEvents(): void {
    // Use document-level touch events for better tracking
    document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    document.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
    document.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });
  }

  private handleTouchStart(e: TouchEvent): void {
    if (!this.isVisible()) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const joystick = this.getJoystickForTouch(touch);

      if (joystick && joystick.touchId === null) {
        e.preventDefault();
        const rect = joystick.outer.getBoundingClientRect();
        joystick.isActive = true;
        joystick.touchId = touch.identifier;
        joystick.startX = rect.left + rect.width / 2;
        joystick.startY = rect.top + rect.height / 2;
        joystick.currentX = touch.clientX;
        joystick.currentY = touch.clientY;
        this.updateJoystickVisual(joystick);
      }
    }

    this.updateInput();
  }

  private handleTouchMove(e: TouchEvent): void {
    if (!this.isVisible()) return;

    let handled = false;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      // Check left stick
      if (this.leftStick.touchId === touch.identifier) {
        this.leftStick.currentX = touch.clientX;
        this.leftStick.currentY = touch.clientY;
        this.updateJoystickVisual(this.leftStick);
        handled = true;
      }

      // Check right stick
      if (this.rightStick.touchId === touch.identifier) {
        this.rightStick.currentX = touch.clientX;
        this.rightStick.currentY = touch.clientY;
        this.updateJoystickVisual(this.rightStick);
        handled = true;
      }
    }

    if (handled) {
      e.preventDefault();
      this.updateInput();
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      // Check left stick
      if (this.leftStick.touchId === touch.identifier) {
        this.resetJoystick(this.leftStick);
      }

      // Check right stick
      if (this.rightStick.touchId === touch.identifier) {
        this.resetJoystick(this.rightStick);
      }
    }

    this.updateInput();
  }

  private getJoystickForTouch(touch: Touch): Joystick | null {
    const leftRect = this.leftStick.outer.getBoundingClientRect();
    const rightRect = this.rightStick.outer.getBoundingClientRect();

    // Expand touch area slightly
    const padding = 30;

    if (
      touch.clientX >= leftRect.left - padding &&
      touch.clientX <= leftRect.right + padding &&
      touch.clientY >= leftRect.top - padding &&
      touch.clientY <= leftRect.bottom + padding
    ) {
      return this.leftStick;
    }

    if (
      touch.clientX >= rightRect.left - padding &&
      touch.clientX <= rightRect.right + padding &&
      touch.clientY >= rightRect.top - padding &&
      touch.clientY <= rightRect.bottom + padding
    ) {
      return this.rightStick;
    }

    return null;
  }

  private resetJoystick(joystick: Joystick): void {
    joystick.isActive = false;
    joystick.touchId = null;
    joystick.inner.style.transform = 'translate(-50%, -50%)';
  }

  private updateJoystickVisual(joystick: Joystick): void {
    const deltaX = joystick.currentX - joystick.startX;
    const deltaY = joystick.currentY - joystick.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    let clampedX = deltaX;
    let clampedY = deltaY;

    if (distance > this.maxDistance) {
      const angle = Math.atan2(deltaY, deltaX);
      clampedX = Math.cos(angle) * this.maxDistance;
      clampedY = Math.sin(angle) * this.maxDistance;
    }

    joystick.inner.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;
  }

  private getJoystickValues(joystick: Joystick): { x: number; y: number } {
    if (!joystick.isActive) {
      return { x: 0, y: 0 };
    }

    const deltaX = joystick.currentX - joystick.startX;
    const deltaY = joystick.currentY - joystick.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    let normalizedX = deltaX / this.maxDistance;
    let normalizedY = deltaY / this.maxDistance;

    if (distance > this.maxDistance) {
      const angle = Math.atan2(deltaY, deltaX);
      normalizedX = Math.cos(angle);
      normalizedY = Math.sin(angle);
    }

    return { x: normalizedX, y: normalizedY };
  }

  private updateInput(): void {
    const left = this.getJoystickValues(this.leftStick);
    const right = this.getJoystickValues(this.rightStick);

    this.input = {
      forward: -left.y, // Negative because Y is inverted
      turn: -left.x, // Negative for correct turn direction
      cameraX: right.x, // Camera horizontal
      cameraY: -right.y, // Camera vertical (inverted)
      active: this.leftStick.isActive || this.rightStick.isActive,
    };
  }

  getInput(): TouchInput {
    return { ...this.input };
  }

  show(): void {
    // Only show on touch devices
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      this.container.style.display = 'block';
    }
  }

  hide(): void {
    this.container.style.display = 'none';
    this.resetJoystick(this.leftStick);
    this.resetJoystick(this.rightStick);
    this.input = { forward: 0, turn: 0, cameraX: 0, cameraY: 0, active: false };
  }

  isVisible(): boolean {
    return this.container.style.display !== 'none';
  }
}
