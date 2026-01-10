import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  ParticleSystem,
  Texture,
  Color4,
} from '@babylonjs/core';

export interface DustBunnyData {
  id: string;
  position: Vector3;
  pathDistance: number;
  pointValue: number;
  timeValue: number;
}

export class DustBunny {
  private scene: Scene;
  private mesh: Mesh;
  private particleSystem: ParticleSystem;
  private data: DustBunnyData;
  private bobOffset: number = 0;
  private baseY: number;

  constructor(scene: Scene, data: DustBunnyData) {
    this.scene = scene;
    this.data = data;
    this.baseY = data.position.y + 0.2;
    this.mesh = null!;
    this.particleSystem = null!;
  }

  create(): void {
    // Create fuzzy dust bunny (icosphere for irregular look)
    this.mesh = MeshBuilder.CreateIcoSphere(
      `dustBunny_${this.data.id}`,
      {
        radius: 0.2,
        subdivisions: 1,
      },
      this.scene
    );

    this.mesh.position = this.data.position.clone();
    this.mesh.position.y = this.baseY;

    // Material - gray fuzzy appearance
    const material = new StandardMaterial(`dustMat_${this.data.id}`, this.scene);

    // Color based on value (higher value = darker/rarer dust)
    if (this.data.pointValue >= 1000) {
      material.diffuseColor = new Color3(0.2, 0.15, 0.25); // Purple-ish rare dust
      material.emissiveColor = new Color3(0.1, 0.05, 0.15);
    } else if (this.data.pointValue >= 500) {
      material.diffuseColor = new Color3(0.3, 0.25, 0.2); // Brown dust
      material.emissiveColor = new Color3(0.05, 0.04, 0.03);
    } else if (this.data.pointValue >= 250) {
      material.diffuseColor = new Color3(0.5, 0.5, 0.45); // Gray dust
      material.emissiveColor = new Color3(0.05, 0.05, 0.04);
    } else {
      material.diffuseColor = new Color3(0.65, 0.65, 0.6); // Light gray dust
      material.emissiveColor = new Color3(0.05, 0.05, 0.05);
    }

    material.specularColor = new Color3(0.1, 0.1, 0.1);
    this.mesh.material = material;

    // Add subtle particle effect
    this.createParticles();

    // Random starting bob offset for variety
    this.bobOffset = Math.random() * Math.PI * 2;
  }

  private createParticles(): void {
    this.particleSystem = new ParticleSystem(
      `dustParticles_${this.data.id}`,
      20,
      this.scene
    );

    // Create a simple circular texture procedurally
    this.particleSystem.particleTexture = new Texture(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYxIDY0LjE0MDk0OSwgMjAxMC8xMi8wNy0xMDo1NzowMSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBXaW5kb3dzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjE2MENCRkExNzVBQjExRTQ5NDBGRTUzMzQyMDVDNzFFIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjE2MENCRkEyNzVBQjExRTQ5NDBGRTUzMzQyMDVDNzFFIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6MTYwQ0JGOUY3NUFCMTFFNDk0MEZFNTMzNDIwNUM3MUUiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6MTYwQ0JGQTA3NUFCMTFFNDk0MEZFNTMzNDIwNUM3MUUiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz7xo/jjAAAAlElEQVR42mL8//8/AwMDAwMTAwMDE8MgACyMDIMBMDIMVsCCy3RGRkYmJiYmFgYGBhYwD4kPFwNjDmZGBobBB1gYBhtgYWIYbIBl0AEWJmYGhhEFWBkYBltdwMTMNNLqAhaWERYFLEyjNgpGFWAYJqkYG4YOGuwBjUYMpgYDAyMjA4rLBnmuxQZGAzHD4AVAAQYAvW4HB/aU8TgAAAAASUVORK5CYII=',
      this.scene
    );

    this.particleSystem.emitter = this.mesh;
    this.particleSystem.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
    this.particleSystem.maxEmitBox = new Vector3(0.1, 0.1, 0.1);

    this.particleSystem.color1 = new Color4(0.7, 0.7, 0.65, 0.3);
    this.particleSystem.color2 = new Color4(0.5, 0.5, 0.48, 0.2);
    this.particleSystem.colorDead = new Color4(0.4, 0.4, 0.38, 0);

    this.particleSystem.minSize = 0.02;
    this.particleSystem.maxSize = 0.06;

    this.particleSystem.minLifeTime = 0.5;
    this.particleSystem.maxLifeTime = 1.5;

    this.particleSystem.emitRate = 5;

    this.particleSystem.gravity = new Vector3(0, 0.02, 0);

    this.particleSystem.direction1 = new Vector3(-0.5, 0.5, -0.5);
    this.particleSystem.direction2 = new Vector3(0.5, 1, 0.5);

    this.particleSystem.minEmitPower = 0.05;
    this.particleSystem.maxEmitPower = 0.1;

    this.particleSystem.start();
  }

  update(deltaTime: number): void {
    // Gentle bobbing animation
    this.bobOffset += deltaTime * 2;
    this.mesh.position.y = this.baseY + Math.sin(this.bobOffset) * 0.05;

    // Slow rotation
    this.mesh.rotation.y += deltaTime * 0.5;
  }

  getData(): DustBunnyData {
    return this.data;
  }

  getPosition(): Vector3 {
    return this.mesh.position.clone();
  }

  dispose(): void {
    this.particleSystem.stop();
    this.particleSystem.dispose();
    this.mesh.dispose();
  }
}
