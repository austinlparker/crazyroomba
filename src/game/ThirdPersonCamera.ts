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

  // Third-person chase camera settings
  private cameraHeight: number = 1.2;      // Height above roomba
  private cameraDistance: number = 2.5;    // Distance behind roomba
  private lookAheadHeight: number = 0.3;   // How high to look (slightly above roomba)

  constructor(scene: Scene, _canvas: HTMLCanvasElement, roomba: Roomba) {
    this.roomba = roomba;

    const roombaPos = roomba.getPosition();
    const roombaRotation = roomba.getRotation();

    // Calculate initial camera position behind the roomba
    const offsetX = -Math.sin(roombaRotation) * this.cameraDistance;
    const offsetZ = -Math.cos(roombaRotation) * this.cameraDistance;

    // Create a free camera positioned behind the roomba
    this.camera = new FreeCamera(
      'chaseCamera',
      new Vector3(
        roombaPos.x + offsetX,
        roombaPos.y + this.cameraHeight,
        roombaPos.z + offsetZ
      ),
      scene
    );

    // Point camera at the roomba
    this.camera.setTarget(new Vector3(roombaPos.x, roombaPos.y + this.lookAheadHeight, roombaPos.z));

    // Disable all inputs - camera position is controlled programmatically
    this.camera.inputs.clear();

    // Set as active camera
    scene.activeCamera = this.camera;
  }

  update(_deltaTime: number = 0.016): void {
    const roombaPos = this.roomba.getPosition();
    const roombaRotation = this.roomba.getRotation();

    // Calculate camera position behind the roomba based on its rotation
    // Negative sin/cos to position camera BEHIND the roomba (opposite of forward direction)
    const offsetX = -Math.sin(roombaRotation) * this.cameraDistance;
    const offsetZ = -Math.cos(roombaRotation) * this.cameraDistance;

    // Position camera behind and above the roomba
    this.camera.position.x = roombaPos.x + offsetX;
    this.camera.position.y = roombaPos.y + this.cameraHeight;
    this.camera.position.z = roombaPos.z + offsetZ;

    // Look at the roomba (slightly above center for better view of what's ahead)
    this.camera.setTarget(new Vector3(
      roombaPos.x,
      roombaPos.y + this.lookAheadHeight,
      roombaPos.z
    ));
  }

  getCamera(): Camera {
    return this.camera;
  }

  setRadius(radius: number): void {
    // Adjust distance based on "radius" for compatibility
    this.cameraDistance = radius;
  }

  // Reset camera - snap to current roomba position
  resetToFollow(): void {
    this.update(0);
  }

  // Get camera's horizontal angle (matches roomba rotation)
  getHorizontalAngle(): number {
    return this.roomba.getRotation();
  }
}
