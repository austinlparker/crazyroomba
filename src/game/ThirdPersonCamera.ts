import {
  Scene,
  Vector3,
  ArcRotateCamera,
} from '@babylonjs/core';
import { Roomba } from '../entities/Roomba';

export class ThirdPersonCamera {
  private camera: ArcRotateCamera;
  private roomba: Roomba;
  private targetOffset: Vector3 = new Vector3(0, 0.3, 0); // Offset for target point (raised)
  private currentAlpha: number = Math.PI; // Smoothed camera rotation

  // Trailing camera settings for car-style controls
  private rotationSmoothing: number = 0.08; // Much slower follow for trailing effect (was 0.25)
  private cameraRadius: number = 2.5;       // Further back to see environment (was 1.2)
  private cameraBeta: number = Math.PI / 4; // 45 degrees - more horizontal to see ahead (was PI/3.5)

  constructor(scene: Scene, canvas: HTMLCanvasElement, roomba: Roomba) {
    this.roomba = roomba;

    // Create arc rotate camera - trailing view behind roomba for car-style controls
    this.camera = new ArcRotateCamera(
      'thirdPersonCamera',
      Math.PI, // alpha - horizontal rotation (behind roomba)
      this.cameraBeta, // beta - 45 degrees for better forward visibility
      this.cameraRadius, // radius - further back to see environment
      roomba.getPosition(),
      scene
    );

    // Fixed camera settings - no zoom allowed
    this.camera.lowerRadiusLimit = this.cameraRadius;
    this.camera.upperRadiusLimit = this.cameraRadius;
    this.camera.lowerBetaLimit = this.cameraBeta;
    this.camera.upperBetaLimit = this.cameraBeta;

    // Enable camera collision detection
    this.camera.checkCollisions = true;
    this.camera.collisionRadius = new Vector3(0.3, 0.3, 0.3);
    scene.collisionsEnabled = true;

    // Disable all default controls - camera follows roomba exactly
    this.camera.attachControl(canvas, false);
    this.camera.inputs.clear();

    // Set as active camera
    scene.activeCamera = this.camera;
  }

  update(_deltaTime: number = 0.016): void {
    const roombaPos = this.roomba.getPosition();
    const roombaRotation = this.roomba.getRotation();

    // Target alpha is behind the roomba
    const targetAlpha = roombaRotation + Math.PI;

    // Smoothly interpolate camera rotation to follow roomba
    // This allows you to briefly see the roomba turn before camera catches up
    let alphaDiff = targetAlpha - this.currentAlpha;

    // Normalize angle difference to -PI to PI range
    while (alphaDiff > Math.PI) alphaDiff -= Math.PI * 2;
    while (alphaDiff < -Math.PI) alphaDiff += Math.PI * 2;

    this.currentAlpha += alphaDiff * this.rotationSmoothing;

    // Calculate offset position based on current camera angle (not roomba rotation)
    // This keeps the target centered as camera rotates
    const cameraDirection = this.currentAlpha - Math.PI;
    const backOffset = new Vector3(
      -Math.sin(cameraDirection) * 0.15,
      0,
      -Math.cos(cameraDirection) * 0.15
    );

    // Set camera target to roomba position with offset
    this.camera.target = roombaPos.add(this.targetOffset).add(backOffset);

    // Apply smoothed camera rotation
    this.camera.alpha = this.currentAlpha;
  }

  getCamera(): ArcRotateCamera {
    return this.camera;
  }

  setRadius(radius: number): void {
    this.cameraRadius = radius;
    this.camera.radius = radius;
    this.camera.lowerRadiusLimit = radius;
    this.camera.upperRadiusLimit = radius;
  }

  // Reset camera to behind roomba
  resetToFollow(): void {
    const roombaRotation = this.roomba.getRotation();
    this.currentAlpha = roombaRotation + Math.PI;
    this.camera.alpha = this.currentAlpha;
  }

  // Get camera's horizontal angle for movement-relative input
  getHorizontalAngle(): number {
    return this.camera.alpha;
  }
}
