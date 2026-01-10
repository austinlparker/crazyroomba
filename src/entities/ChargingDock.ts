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
  private backPanel: Mesh;
  private ringMesh: Mesh;
  private glowRing: Mesh;
  private depositRange: number = 1.5;
  private glowLayer: GlowLayer;

  constructor(scene: Scene, position: Vector3) {
    this.scene = scene;
    this.position = position;
    this.baseMesh = null!;
    this.backPanel = null!;
    this.ringMesh = null!;
    this.glowRing = null!;
    this.glowLayer = null!;
  }

  create(): void {
    // Create glow layer for emissive effects
    this.glowLayer = new GlowLayer('dockGlow', this.scene);
    this.glowLayer.intensity = 0.6;

    // Base platform - wider and flatter like real dock
    this.baseMesh = MeshBuilder.CreateBox(
      'dockBase',
      {
        width: 1.2,
        height: 0.04,
        depth: 0.8,
      },
      this.scene
    );
    this.baseMesh.position = this.position.clone();
    this.baseMesh.position.y = 0.02;

    const baseMaterial = new StandardMaterial('dockBaseMat', this.scene);
    baseMaterial.diffuseColor = new Color3(0.12, 0.12, 0.15);
    baseMaterial.specularColor = new Color3(0.3, 0.3, 0.3);
    this.baseMesh.material = baseMaterial;

    // Back panel (upright piece where roomba docks)
    this.backPanel = MeshBuilder.CreateBox(
      'dockBack',
      {
        width: 1.0,
        height: 0.3,
        depth: 0.08,
      },
      this.scene
    );
    this.backPanel.position = this.position.clone();
    this.backPanel.position.y = 0.15;
    this.backPanel.position.z = -0.35;

    const backMaterial = new StandardMaterial('dockBackMat', this.scene);
    backMaterial.diffuseColor = new Color3(0.15, 0.15, 0.18);
    backMaterial.specularColor = new Color3(0.25, 0.25, 0.25);
    this.backPanel.material = backMaterial;

    // Charging contacts (metal strips)
    for (let i = -1; i <= 1; i += 2) {
      const contact = MeshBuilder.CreateBox(
        `contact_${i}`,
        {
          width: 0.08,
          height: 0.15,
          depth: 0.02,
        },
        this.scene
      );
      contact.position = this.position.clone();
      contact.position.x += i * 0.25;
      contact.position.y = 0.1;
      contact.position.z = -0.32;

      const contactMaterial = new StandardMaterial(`contactMat_${i}`, this.scene);
      contactMaterial.diffuseColor = new Color3(0.7, 0.65, 0.5); // Brass/copper color
      contactMaterial.specularColor = new Color3(0.8, 0.75, 0.6);
      contact.material = contactMaterial;
    }

    // IR beacon on top (how roomba finds the dock)
    const beacon = MeshBuilder.CreateCylinder(
      'beacon',
      {
        diameter: 0.12,
        height: 0.04,
        tessellation: 16,
      },
      this.scene
    );
    beacon.position = this.position.clone();
    beacon.position.y = 0.32;
    beacon.position.z = -0.35;

    const beaconMaterial = new StandardMaterial('beaconMat', this.scene);
    beaconMaterial.diffuseColor = new Color3(0.2, 0.2, 0.25);
    beacon.material = beaconMaterial;

    // IR emitter window (dark red/black lens)
    const irWindow = MeshBuilder.CreateCylinder(
      'irWindow',
      {
        diameter: 0.08,
        height: 0.02,
        tessellation: 16,
      },
      this.scene
    );
    irWindow.position = this.position.clone();
    irWindow.position.y = 0.34;
    irWindow.position.z = -0.35;

    const irMaterial = new StandardMaterial('irMat', this.scene);
    irMaterial.diffuseColor = new Color3(0.15, 0.05, 0.05);
    irMaterial.emissiveColor = new Color3(0.3, 0.05, 0.05);
    irWindow.material = irMaterial;

    // Status LED ring
    this.ringMesh = MeshBuilder.CreateTorus(
      'dockRing',
      {
        diameter: 0.6,
        thickness: 0.03,
        tessellation: 32,
      },
      this.scene
    );
    this.ringMesh.position = this.position.clone();
    this.ringMesh.position.y = 0.05;
    this.ringMesh.rotation.x = Math.PI / 2;

    const ringMaterial = new StandardMaterial('dockRingMat', this.scene);
    ringMaterial.diffuseColor = new Color3(0.2, 0.8, 0.3);
    ringMaterial.emissiveColor = new Color3(0.1, 0.5, 0.15);
    this.ringMesh.material = ringMaterial;

    // Add to glow layer
    this.glowLayer.addIncludedOnlyMesh(this.ringMesh);

    // Outer range indicator (subtle floor ring)
    this.glowRing = MeshBuilder.CreateTorus(
      'dockGlowRing',
      {
        diameter: this.depositRange * 2,
        thickness: 0.015,
        tessellation: 64,
      },
      this.scene
    );
    this.glowRing.position = this.position.clone();
    this.glowRing.position.y = 0.005;
    this.glowRing.rotation.x = Math.PI / 2;

    const glowRingMaterial = new StandardMaterial('glowRingMat', this.scene);
    glowRingMaterial.diffuseColor = new Color3(0.1, 0.5, 0.2);
    glowRingMaterial.emissiveColor = new Color3(0.05, 0.3, 0.1);
    glowRingMaterial.alpha = 0.4;
    this.glowRing.material = glowRingMaterial;

    // Small "HOME" text area on back panel
    const label = MeshBuilder.CreateBox(
      'dockLabel',
      {
        width: 0.3,
        height: 0.06,
        depth: 0.01,
      },
      this.scene
    );
    label.position = this.position.clone();
    label.position.y = 0.22;
    label.position.z = -0.3;

    const labelMaterial = new StandardMaterial('labelMat', this.scene);
    labelMaterial.diffuseColor = new Color3(0.9, 0.9, 0.9);
    label.material = labelMaterial;

    // Rubber feet/grip strips
    for (let i = -1; i <= 1; i += 2) {
      const grip = MeshBuilder.CreateBox(
        `grip_${i}`,
        {
          width: 0.8,
          height: 0.01,
          depth: 0.04,
        },
        this.scene
      );
      grip.position = this.position.clone();
      grip.position.y = 0.005;
      grip.position.z = i * 0.25;

      const gripMaterial = new StandardMaterial(`gripMat_${i}`, this.scene);
      gripMaterial.diffuseColor = new Color3(0.08, 0.08, 0.08);
      grip.material = gripMaterial;
    }

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
      { frame: 0, value: new Color3(0.1, 0.5, 0.15) },
      { frame: 30, value: new Color3(0.2, 0.8, 0.3) },
      { frame: 60, value: new Color3(0.1, 0.5, 0.15) },
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

    ringMaterial.emissiveColor = new Color3(0.4, 1, 0.6);

    // Reset after short delay
    setTimeout(() => {
      ringMaterial.emissiveColor = originalEmissive;
    }, 200);

    // Scale pulse effect
    const originalScale = this.ringMesh.scaling.clone();
    this.ringMesh.scaling = new Vector3(1.3, 1, 1.3);

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
