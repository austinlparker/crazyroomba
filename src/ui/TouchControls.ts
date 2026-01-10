export interface TouchInput {
  forward: number;
  turn: number;
  active: boolean;
}

export class TouchControls {
  private container: HTMLDivElement;
  private joystickOuter: HTMLDivElement;
  private joystickInner: HTMLDivElement;

  private isActive: boolean = false;
  private startX: number = 0;
  private startY: number = 0;
  private currentX: number = 0;
  private currentY: number = 0;
  private maxDistance: number = 50;

  private input: TouchInput = {
    forward: 0,
    turn: 0,
    active: false,
  };

  constructor(_canvas: HTMLCanvasElement) {
    this.container = null!;
    this.joystickOuter = null!;
    this.joystickInner = null!;

    this.createJoystick();
    this.setupTouchEvents();
  }

  private createJoystick(): void {
    // Container for touch area
    this.container = document.createElement('div');
    this.container.id = 'touch-controls';
    this.container.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 20px;
      width: 150px;
      height: 150px;
      display: none;
      z-index: 15;
    `;

    // Outer ring
    this.joystickOuter = document.createElement('div');
    this.joystickOuter.style.cssText = `
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
    this.joystickInner = document.createElement('div');
    this.joystickInner.style.cssText = `
      position: absolute;
      width: 50px;
      height: 50px;
      background: rgba(78, 204, 163, 0.8);
      border-radius: 50%;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      transition: transform 0.05s;
    `;

    this.joystickOuter.appendChild(this.joystickInner);
    this.container.appendChild(this.joystickOuter);
    document.body.appendChild(this.container);
  }

  private setupTouchEvents(): void {
    // Touch start
    this.container.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.joystickOuter.getBoundingClientRect();

      this.isActive = true;
      this.startX = rect.left + rect.width / 2;
      this.startY = rect.top + rect.height / 2;
      this.currentX = touch.clientX;
      this.currentY = touch.clientY;

      this.updateJoystick();
    });

    // Touch move
    this.container.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.isActive) return;

      const touch = e.touches[0];
      this.currentX = touch.clientX;
      this.currentY = touch.clientY;

      this.updateJoystick();
    });

    // Touch end
    this.container.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.isActive = false;
      this.input = { forward: 0, turn: 0, active: false };
      this.joystickInner.style.transform = 'translate(-50%, -50%)';
    });

    // Also handle touch cancel
    this.container.addEventListener('touchcancel', () => {
      this.isActive = false;
      this.input = { forward: 0, turn: 0, active: false };
      this.joystickInner.style.transform = 'translate(-50%, -50%)';
    });
  }

  private updateJoystick(): void {
    const deltaX = this.currentX - this.startX;
    const deltaY = this.currentY - this.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Clamp to max distance
    let clampedX = deltaX;
    let clampedY = deltaY;

    if (distance > this.maxDistance) {
      const angle = Math.atan2(deltaY, deltaX);
      clampedX = Math.cos(angle) * this.maxDistance;
      clampedY = Math.sin(angle) * this.maxDistance;
    }

    // Update visual position
    this.joystickInner.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;

    // Update input values (-1 to 1)
    this.input = {
      forward: -clampedY / this.maxDistance, // Negative because Y is inverted
      turn: -clampedX / this.maxDistance, // Negative for correct turn direction
      active: true,
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
    this.isActive = false;
    this.input = { forward: 0, turn: 0, active: false };
  }

  isVisible(): boolean {
    return this.container.style.display !== 'none';
  }
}
