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
  private coreMesh: Mesh;
  private wisps: Mesh[] = [];
  private particleSystem: ParticleSystem;
  private data: DustBunnyData;
  private bobOffset: number = 0;
  private baseY: number;

  constructor(scene: Scene, data: DustBunnyData) {
    this.scene = scene;
    this.data = data;
    this.baseY = data.position.y + 0.15;
    this.mesh = null!;
    this.coreMesh = null!;
    this.particleSystem = null!;
  }

  create(): void {
    // Create the main dust bunny body - a fuzzy irregular sphere
    this.mesh = MeshBuilder.CreateIcoSphere(
      `dustBunny_${this.data.id}`,
      {
        radius: 0.15,
        subdivisions: 1,
      },
      this.scene
    );

    this.mesh.position = this.data.position.clone();
    this.mesh.position.y = this.baseY;

    // Get colors based on value
    const { mainColor, emissiveColor } = this.getColors();

    const mainMaterial = new StandardMaterial(`dustMat_${this.data.id}`, this.scene);
    mainMaterial.diffuseColor = mainColor;
    mainMaterial.emissiveColor = emissiveColor;
    mainMaterial.specularColor = new Color3(0.05, 0.05, 0.05);
    this.mesh.material = mainMaterial;

    // Create inner core (slightly darker)
    this.coreMesh = MeshBuilder.CreateSphere(
      `dustCore_${this.data.id}`,
      { diameter: 0.12, segments: 8 },
      this.scene
    );
    this.coreMesh.parent = this.mesh;
    this.coreMesh.position = Vector3.Zero();

    const coreMaterial = new StandardMaterial(`coreMat_${this.data.id}`, this.scene);
    coreMaterial.diffuseColor = mainColor.scale(0.7);
    coreMaterial.alpha = 0.6;
    this.coreMesh.material = coreMaterial;

    // Create wispy strands radiating outward (hair-like appearance)
    this.createWisps(mainColor);

    // Add subtle particle effect
    this.createParticles();

    // Random starting bob offset for variety
    this.bobOffset = Math.random() * Math.PI * 2;
  }

  private getColors(): { mainColor: Color3; emissiveColor: Color3 } {
    // Color based on value (higher value = rarer, more distinctive dust)
    if (this.data.pointValue >= 1000) {
      // Rare dust - purple/grey with shimmer
      return {
        mainColor: new Color3(0.35, 0.28, 0.4),
        emissiveColor: new Color3(0.15, 0.08, 0.2),
      };
    } else if (this.data.pointValue >= 500) {
      // Far dust - brown/tan
      return {
        mainColor: new Color3(0.45, 0.38, 0.3),
        emissiveColor: new Color3(0.08, 0.06, 0.04),
      };
    } else if (this.data.pointValue >= 250) {
      // Medium dust - grey
      return {
        mainColor: new Color3(0.55, 0.55, 0.5),
        emissiveColor: new Color3(0.06, 0.06, 0.05),
      };
    } else {
      // Common dust - light grey
      return {
        mainColor: new Color3(0.7, 0.7, 0.65),
        emissiveColor: new Color3(0.08, 0.08, 0.07),
      };
    }
  }

  private createWisps(baseColor: Color3): void {
    const wispCount = 8;

    for (let i = 0; i < wispCount; i++) {
      // Random direction for each wisp
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      const direction = new Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi)
      );

      // Create a thin elongated box as a wisp
      const wispLength = 0.08 + Math.random() * 0.06;
      const wispThickness = 0.01 + Math.random() * 0.01;

      const wisp = MeshBuilder.CreateBox(
        `wisp_${this.data.id}_${i}`,
        {
          width: wispThickness,
          height: wispLength,
          depth: wispThickness,
        },
        this.scene
      );

      // Position at surface of main sphere, pointing outward
      wisp.position = direction.scale(0.12);

      // Orient to point outward
      wisp.lookAt(direction.scale(2));
      wisp.rotation.x += Math.PI / 2;

      wisp.parent = this.mesh;

      const wispMaterial = new StandardMaterial(`wispMat_${this.data.id}_${i}`, this.scene);
      wispMaterial.diffuseColor = baseColor.scale(0.8 + Math.random() * 0.4);
      wispMaterial.alpha = 0.7;
      wisp.material = wispMaterial;

      this.wisps.push(wisp);
    }
  }

  private createParticles(): void {
    this.particleSystem = new ParticleSystem(
      `dustParticles_${this.data.id}`,
      30,
      this.scene
    );

    // Create a simple circular texture procedurally
    this.particleSystem.particleTexture = new Texture(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYxIDY0LjE0MDk0OSwgMjAxMC8xMi8wNy0xMDo1NzowMSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBXaW5kb3dzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjE2MENCRkExNzVBQjExRTQ5NDBGRTUzMzQyMDVDNzFFIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjE2MENCRkEyNzVBQjExRTQ5NDBGRTUzMzQyMDVDNzFFIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6MTYwQ0JGOUY3NUFCMTFFNDk0MEZFNTMzNDIwNUM3MUUiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6MTYwQ0JGQTA3NUFCMTFFNDk0MEZFNTMzNDIwNUM3MUUiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz7xo/jjAAAAlElEQVR42mL8//8/AwMDAwMTAwMDE8MgACyMDIMBMDIMVsCCy3RGRkYmJiYmFgYGBhYwD4kPFwNjDmZGBobBB1gYBhtgYWIYbIBl0AEWJmYGhhEFWBkYBltdwMTMNNLqAhaWERYFLEyjNgpGFWAYJqkYG4YOGuwBjUYMpgYDAyMjA4rLBnmuxQZGAzHD4AVAAQYAvW4HB/aU8TgAAAAASUVORK5CYII=',
      this.scene
    );

    this.particleSystem.emitter = this.mesh;
    this.particleSystem.minEmitBox = new Vector3(-0.08, -0.08, -0.08);
    this.particleSystem.maxEmitBox = new Vector3(0.08, 0.08, 0.08);

    this.particleSystem.color1 = new Color4(0.75, 0.72, 0.68, 0.25);
    this.particleSystem.color2 = new Color4(0.6, 0.58, 0.55, 0.15);
    this.particleSystem.colorDead = new Color4(0.5, 0.48, 0.45, 0);

    this.particleSystem.minSize = 0.015;
    this.particleSystem.maxSize = 0.04;

    this.particleSystem.minLifeTime = 0.8;
    this.particleSystem.maxLifeTime = 2.0;

    this.particleSystem.emitRate = 8;

    this.particleSystem.gravity = new Vector3(0, 0.01, 0);

    this.particleSystem.direction1 = new Vector3(-0.3, 0.3, -0.3);
    this.particleSystem.direction2 = new Vector3(0.3, 0.8, 0.3);

    this.particleSystem.minEmitPower = 0.02;
    this.particleSystem.maxEmitPower = 0.06;

    this.particleSystem.start();
  }

  update(deltaTime: number): void {
    // Gentle bobbing animation
    this.bobOffset += deltaTime * 1.5;
    this.mesh.position.y = this.baseY + Math.sin(this.bobOffset) * 0.04;

    // Slow tumbling rotation
    this.mesh.rotation.y += deltaTime * 0.4;
    this.mesh.rotation.x += deltaTime * 0.15;

    // Animate wisps slightly
    for (let i = 0; i < this.wisps.length; i++) {
      const wisp = this.wisps[i];
      const waveOffset = this.bobOffset + i * 0.5;
      wisp.scaling.y = 1 + Math.sin(waveOffset * 2) * 0.15;
    }
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
    for (const wisp of this.wisps) {
      wisp.dispose();
    }
    this.coreMesh.dispose();
    this.mesh.dispose();
  }
}
