import {
  Scene,
  Vector3,
  FreeCamera,
  Camera,
  Mesh,
  Ray,
} from '@babylonjs/core';
import { Roomba } from '../entities/Roomba';
import { getCameraSettings } from '../config/GameConfig';

export class ThirdPersonCamera {
  private camera: FreeCamera;
  private roomba: Roomba;

  // Third-person chase camera settings (computed from roomba scale)
  private cameraHeight: number;
  private cameraDistance: number;
  private lookAheadHeight: number;
  private wallBuffer: number;

  // Wall meshes for collision detection
  private wallMeshes: Mesh[] = [];

  constructor(scene: Scene, _canvas: HTMLCanvasElement, roomba: Roomba) {
    this.roomba = roomba;

    // Get scale-aware camera settings based on roomba dimensions
    const roombaDiameter = roomba.getDiameter();
    const settings = getCameraSettings(roombaDiameter);

    this.cameraHeight = settings.height;
    this.cameraDistance = settings.distance;
    this.lookAheadHeight = settings.lookAheadHeight;
    this.wallBuffer = settings.wallBuffer;

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

  setWallMeshes(meshes: Mesh[]): void {
    this.wallMeshes = meshes;
  }

  update(_deltaTime: number = 0.016): void {
    const roombaPos = this.roomba.getPosition();
    const roombaRotation = this.roomba.getRotation();

    // Calculate desired camera position behind the roomba based on its rotation
    // Negative sin/cos to position camera BEHIND the roomba (opposite of forward direction)
    const offsetX = -Math.sin(roombaRotation) * this.cameraDistance;
    const offsetZ = -Math.cos(roombaRotation) * this.cameraDistance;

    let cameraX = roombaPos.x + offsetX;
    let cameraY = roombaPos.y + this.cameraHeight;
    let cameraZ = roombaPos.z + offsetZ;

    // Apply wall collision to prevent camera from going through walls
    const adjustedPos = this.applyWallCollision(
      new Vector3(cameraX, cameraY, cameraZ),
      roombaPos
    );
    cameraX = adjustedPos.x;
    cameraY = adjustedPos.y;
    cameraZ = adjustedPos.z;

    // Position camera behind and above the roomba
    this.camera.position.x = cameraX;
    this.camera.position.y = cameraY;
    this.camera.position.z = cameraZ;

    // Look at the roomba (slightly above center for better view of what's ahead)
    this.camera.setTarget(new Vector3(
      roombaPos.x,
      roombaPos.y + this.lookAheadHeight,
      roombaPos.z
    ));
  }

  private applyWallCollision(cameraPos: Vector3, targetPos: Vector3): Vector3 {
    if (this.wallMeshes.length === 0) {
      return cameraPos;
    }

    // Cast a ray from the target (roomba) to the desired camera position
    const direction = cameraPos.subtract(targetPos).normalize();
    const maxDistance = Vector3.Distance(cameraPos, targetPos);
    const ray = new Ray(targetPos, direction, maxDistance);

    // Check for intersections with wall meshes
    let closestHit: { distance: number; point: Vector3 } | null = null;

    for (const wall of this.wallMeshes) {
      const pickInfo = ray.intersectsMesh(wall);
      if (pickInfo.hit && pickInfo.pickedPoint) {
        const distance = Vector3.Distance(targetPos, pickInfo.pickedPoint);
        if (!closestHit || distance < closestHit.distance) {
          closestHit = { distance, point: pickInfo.pickedPoint };
        }
      }
    }

    // If we hit a wall, position camera in front of the wall with a buffer
    if (closestHit && closestHit.distance < maxDistance) {
      // Move camera back from wall by buffer amount
      const adjustedDistance = Math.max(closestHit.distance - this.wallBuffer, 0.5);
      return targetPos.add(direction.scale(adjustedDistance));
    }

    return cameraPos;
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
