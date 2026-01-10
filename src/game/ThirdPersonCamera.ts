import {
  Scene,
  Vector3,
  ArcRotateCamera,
} from '@babylonjs/core';
import { Roomba } from '../entities/Roomba';

export class ThirdPersonCamera {
  private camera: ArcRotateCamera;
  private roomba: Roomba;
  private targetPosition: Vector3 = Vector3.Zero();
  private smoothing: number = 0.1;

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

    // Disable default controls - we'll handle following manually
    this.camera.attachControl(canvas, false);

    // Allow some manual camera rotation
    this.camera.panningSensibility = 0; // Disable panning
    this.camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');

    // Set as active camera
    scene.activeCamera = this.camera;
  }

  update(): void {
    const roombaPos = this.roomba.getPosition();
    const roombaRotation = this.roomba.getRotation();

    // Smoothly follow roomba position
    this.targetPosition = Vector3.Lerp(
      this.targetPosition,
      roombaPos,
      this.smoothing
    );
    this.camera.target = this.targetPosition;

    // Optionally rotate camera to follow roomba heading
    // This creates a more dynamic "behind the vehicle" feel
    const targetAlpha = roombaRotation + Math.PI;
    const alphaDiff = targetAlpha - this.camera.alpha;

    // Normalize angle difference
    let normalizedDiff = alphaDiff;
    while (normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2;
    while (normalizedDiff < -Math.PI) normalizedDiff += Math.PI * 2;

    this.camera.alpha += normalizedDiff * 0.02; // Very slow follow
  }

  getCamera(): ArcRotateCamera {
    return this.camera;
  }

  setRadius(radius: number): void {
    this.camera.radius = radius;
  }
}
