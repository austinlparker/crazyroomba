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
  private smoothing: number = 0.1;

  // Manual control state
  private isManualControl: boolean = false;
  private manualControlTimeout: number = 0;
  private autoFollowDelay: number = 2000; // ms before auto-follow resumes

  // Control sensitivity
  private rotationSpeed: number = 3;
  private zoomSpeed: number = 5;

  constructor(scene: Scene, canvas: HTMLCanvasElement, roomba: Roomba) {
    this.roomba = roomba;

    // Create arc rotate camera
    this.camera = new ArcRotateCamera(
      'thirdPersonCamera',
      Math.PI, // alpha - horizontal rotation
      Math.PI / 3, // beta - vertical angle (60 degrees from top)
      8, // radius - distance from target
      roomba.getPosition(),
      scene
    );

    // Camera settings - allow zooming to see larger house
    this.camera.lowerRadiusLimit = 3;
    this.camera.upperRadiusLimit = 25;
    this.camera.lowerBetaLimit = Math.PI / 6; // Don't go too low
    this.camera.upperBetaLimit = Math.PI / 2.2; // Don't go directly overhead

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

      this.camera.alpha += normalizedDiff * 0.02; // Very slow follow
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
}
