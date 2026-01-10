import {
  Scene,
  Vector3,
  ArcRotateCamera,
} from '@babylonjs/core';
import { Roomba } from '../entities/Roomba';

export interface CameraInput {
  x: number; // Horizontal rotation (-1 to 1)
  y: number; // Vertical tilt/zoom (-1 to 1)
}

export class ThirdPersonCamera {
  private camera: ArcRotateCamera;
  private roomba: Roomba;
  private targetPosition: Vector3 = Vector3.Zero();
  private smoothing: number = 0.15; // Slightly faster position follow

  // Manual control state
  private isManualControl: boolean = false;
  private manualControlTimeout: number = 0;
  private autoFollowDelay: number = 1000; // ms before auto-follow resumes (faster)

  // Control sensitivity
  private rotationSpeed: number = 3;
  private zoomSpeed: number = 5;

  constructor(scene: Scene, canvas: HTMLCanvasElement, roomba: Roomba) {
    this.roomba = roomba;

    // Create arc rotate camera - close behind for "piloting" feel
    this.camera = new ArcRotateCamera(
      'thirdPersonCamera',
      Math.PI, // alpha - horizontal rotation (behind roomba)
      Math.PI / 2.5, // beta - low angle, just above and behind (~72 degrees)
      2.5, // radius - close to roomba for immersive feel
      roomba.getPosition(),
      scene
    );

    // Camera settings - tight range for close piloting view
    this.camera.lowerRadiusLimit = 1.5;
    this.camera.upperRadiusLimit = 10;
    this.camera.lowerBetaLimit = Math.PI / 4; // Can go fairly low (45 degrees)
    this.camera.upperBetaLimit = Math.PI / 2.1; // Almost horizontal but not quite

    // Enable camera collision detection
    this.camera.checkCollisions = true;
    this.camera.collisionRadius = new Vector3(0.5, 0.5, 0.5);
    scene.collisionsEnabled = true;

    // Disable all default controls - we handle everything manually
    this.camera.attachControl(canvas, false);
    this.camera.inputs.clear();

    // Set as active camera
    scene.activeCamera = this.camera;
  }

  update(deltaTime: number = 0.016, cameraInput?: CameraInput): void {
    const roombaPos = this.roomba.getPosition();
    const roombaRotation = this.roomba.getRotation();

    // Handle camera input
    if (cameraInput && (Math.abs(cameraInput.x) > 0.01 || Math.abs(cameraInput.y) > 0.01)) {
      this.isManualControl = true;
      this.manualControlTimeout = Date.now() + this.autoFollowDelay;

      // Apply horizontal rotation
      this.camera.alpha += cameraInput.x * this.rotationSpeed * deltaTime;

      // Apply vertical tilt (beta)
      this.camera.beta += cameraInput.y * this.zoomSpeed * deltaTime * 0.3;

      // Apply zoom (also from Y input)
      this.camera.radius += cameraInput.y * this.zoomSpeed * deltaTime;
    }

    // Check if manual control has timed out
    if (this.isManualControl && Date.now() > this.manualControlTimeout) {
      this.isManualControl = false;
    }

    // Smoothly follow roomba position
    this.targetPosition = Vector3.Lerp(
      this.targetPosition,
      roombaPos,
      this.smoothing
    );
    this.camera.target = this.targetPosition;

    // Auto-follow rotation when not in manual control
    if (!this.isManualControl) {
      const targetAlpha = roombaRotation + Math.PI;
      const alphaDiff = targetAlpha - this.camera.alpha;

      // Normalize angle difference
      let normalizedDiff = alphaDiff;
      while (normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2;
      while (normalizedDiff < -Math.PI) normalizedDiff += Math.PI * 2;

      this.camera.alpha += normalizedDiff * 0.08; // Faster follow for tight piloting feel
    }

    // Clamp beta
    this.camera.beta = Math.max(this.camera.lowerBetaLimit!, Math.min(this.camera.upperBetaLimit!, this.camera.beta));

    // Clamp radius
    this.camera.radius = Math.max(this.camera.lowerRadiusLimit!, Math.min(this.camera.upperRadiusLimit!, this.camera.radius));
  }

  getCamera(): ArcRotateCamera {
    return this.camera;
  }

  setRadius(radius: number): void {
    this.camera.radius = radius;
  }

  // Reset camera to behind roomba
  resetToFollow(): void {
    this.isManualControl = false;
  }

  // Get camera's horizontal angle for movement-relative input
  getHorizontalAngle(): number {
    // Alpha is the horizontal rotation around the target
    // We need to return the direction the camera is facing
    return this.camera.alpha;
  }
}
