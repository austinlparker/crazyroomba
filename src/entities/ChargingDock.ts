import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  GlowLayer,
  Animation,
} from '@babylonjs/core';

export class ChargingDock {
  private scene: Scene;
  private position: Vector3;
  private baseMesh: Mesh;
  private ringMesh: Mesh;
  private glowRing: Mesh;
  private depositRange: number = 1.5;
  private glowLayer: GlowLayer;

  constructor(scene: Scene, position: Vector3) {
    this.scene = scene;
    this.position = position;
    this.baseMesh = null!;
    this.ringMesh = null!;
    this.glowRing = null!;
    this.glowLayer = null!;
  }

  create(): void {
    // Create glow layer for emissive effects
    this.glowLayer = new GlowLayer('dockGlow', this.scene);
    this.glowLayer.intensity = 0.5;

    // Base platform
    this.baseMesh = MeshBuilder.CreateCylinder(
      'dockBase',
      {
        diameter: 2,
        height: 0.1,
        tessellation: 32,
      },
      this.scene
    );
    this.baseMesh.position = this.position.clone();
    this.baseMesh.position.y = 0.05;

    const baseMaterial = new StandardMaterial('dockBaseMat', this.scene);
    baseMaterial.diffuseColor = new Color3(0.2, 0.2, 0.25);
    baseMaterial.specularColor = new Color3(0.3, 0.3, 0.3);
    this.baseMesh.material = baseMaterial;

    // Inner charging pad
    const pad = MeshBuilder.CreateCylinder(
      'dockPad',
      {
        diameter: 1.5,
        height: 0.12,
        tessellation: 32,
      },
      this.scene
    );
    pad.position = this.position.clone();
    pad.position.y = 0.06;

    const padMaterial = new StandardMaterial('dockPadMat', this.scene);
    padMaterial.diffuseColor = new Color3(0.1, 0.1, 0.12);
    pad.material = padMaterial;

    // Glowing ring indicator
    this.ringMesh = MeshBuilder.CreateTorus(
      'dockRing',
      {
        diameter: 1.8,
        thickness: 0.08,
        tessellation: 32,
      },
      this.scene
    );
    this.ringMesh.position = this.position.clone();
    this.ringMesh.position.y = 0.12;

    const ringMaterial = new StandardMaterial('dockRingMat', this.scene);
    ringMaterial.diffuseColor = new Color3(0.2, 0.8, 0.3);
    ringMaterial.emissiveColor = new Color3(0.1, 0.4, 0.15);
    this.ringMesh.material = ringMaterial;

    // Add to glow layer
    this.glowLayer.addIncludedOnlyMesh(this.ringMesh);

    // Outer range indicator (subtle)
    this.glowRing = MeshBuilder.CreateTorus(
      'dockGlowRing',
      {
        diameter: this.depositRange * 2,
        thickness: 0.02,
        tessellation: 64,
      },
      this.scene
    );
    this.glowRing.position = this.position.clone();
    this.glowRing.position.y = 0.01;

    const glowRingMaterial = new StandardMaterial('glowRingMat', this.scene);
    glowRingMaterial.diffuseColor = new Color3(0.1, 0.5, 0.2);
    glowRingMaterial.emissiveColor = new Color3(0.05, 0.25, 0.1);
    glowRingMaterial.alpha = 0.5;
    this.glowRing.material = glowRingMaterial;

    // Create pulsing animation for ring
    this.createPulseAnimation();
  }

  private createPulseAnimation(): void {
    const pulseAnimation = new Animation(
      'ringPulse',
      'material.emissiveColor',
      30,
      Animation.ANIMATIONTYPE_COLOR3,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );

    const keys = [
      { frame: 0, value: new Color3(0.1, 0.4, 0.15) },
      { frame: 30, value: new Color3(0.15, 0.6, 0.25) },
      { frame: 60, value: new Color3(0.1, 0.4, 0.15) },
    ];

    pulseAnimation.setKeys(keys);
    this.ringMesh.animations.push(pulseAnimation);
    this.scene.beginAnimation(this.ringMesh, 0, 60, true);
  }

  isInRange(position: Vector3): boolean {
    const distance = Vector3.Distance(
      new Vector3(position.x, 0, position.z),
      new Vector3(this.position.x, 0, this.position.z)
    );
    return distance <= this.depositRange;
  }

  playDepositEffect(): void {
    // Flash the ring brighter
    const ringMaterial = this.ringMesh.material as StandardMaterial;
    const originalEmissive = ringMaterial.emissiveColor.clone();

    ringMaterial.emissiveColor = new Color3(0.3, 1, 0.5);

    // Reset after short delay
    setTimeout(() => {
      ringMaterial.emissiveColor = originalEmissive;
    }, 200);

    // Scale pulse effect
    const originalScale = this.ringMesh.scaling.clone();
    this.ringMesh.scaling = new Vector3(1.2, 1, 1.2);

    setTimeout(() => {
      this.ringMesh.scaling = originalScale;
    }, 150);
  }

  getPosition(): Vector3 {
    return this.position.clone();
  }

  getDepositRange(): number {
    return this.depositRange;
  }
}
