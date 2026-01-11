import {
  Scene,
  Vector3,
  FreeCamera,
  Camera,
} from '@babylonjs/core';
import { Roomba } from '../entities/Roomba';

export class ThirdPersonCamera {
  private camera: FreeCamera;
  private roomba: Roomba;

  // Fixed overhead camera settings
  private cameraHeight: number = 3.5;     // Height above roomba
  private cameraOffsetZ: number = -1.5;   // Offset behind (negative Z = camera sees more ahead)
  private lookAheadDistance: number = 2;  // How far ahead of roomba to look

  constructor(scene: Scene, _canvas: HTMLCanvasElement, roomba: Roomba) {
    this.roomba = roomba;

    const roombaPos = roomba.getPosition();

    // Create a free camera positioned above and slightly behind the roomba
    this.camera = new FreeCamera(
      'overheadCamera',
      new Vector3(roombaPos.x, roombaPos.y + this.cameraHeight, roombaPos.z + this.cameraOffsetZ),
      scene
    );

    // Point camera forward (positive Z direction) and down at the roomba
    // This creates a fixed orientation - "up" on screen is always +Z in world
    this.camera.setTarget(new Vector3(roombaPos.x, roombaPos.y, roombaPos.z + this.lookAheadDistance));

    // Disable all inputs - camera position is controlled programmatically
    this.camera.inputs.clear();

    // Set as active camera
    scene.activeCamera = this.camera;
  }

  update(_deltaTime: number = 0.016): void {
    const roombaPos = this.roomba.getPosition();

    // Move camera to stay above roomba (fixed offset, no rotation)
    this.camera.position.x = roombaPos.x;
    this.camera.position.y = roombaPos.y + this.cameraHeight;
    this.camera.position.z = roombaPos.z + this.cameraOffsetZ;

    // Always look ahead in the +Z direction from the roomba's position
    // This keeps the camera orientation fixed - world +Z is always "up" on screen
    this.camera.setTarget(new Vector3(roombaPos.x, roombaPos.y, roombaPos.z + this.lookAheadDistance));
  }

  getCamera(): Camera {
    return this.camera;
  }

  setRadius(radius: number): void {
    // Adjust height based on "radius" for compatibility
    this.cameraHeight = radius * 1.4;
  }

  // Reset camera - no rotation to reset since camera is fixed
  resetToFollow(): void {
    // No-op for fixed camera
  }

  // Get camera's horizontal angle - fixed at 0 (facing +Z)
  getHorizontalAngle(): number {
    return 0;
  }
}
