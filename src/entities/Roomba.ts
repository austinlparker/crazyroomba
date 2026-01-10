import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  PhysicsAggregate,
  PhysicsShapeType,
} from '@babylonjs/core';
import { CollectedDust } from '../game/GameState';

interface InputState {
  forward: number; // Throttle: -1 to 1
  turn: number; // Steering: -1 to 1
  active?: boolean;
}

export class Roomba {
  private scene: Scene;
  private body: Mesh;
  private led: Mesh;
  private binBar: Mesh;
  private binBarFill: Mesh;
  private physicsAggregate: PhysicsAggregate;

  private speed: number = 8;
  private turnSpeed: number = 3;
  private rotation: number = 0;
  private velocity: Vector3 = Vector3.Zero();

  private binCapacity: number = 5;
  private binContents: CollectedDust[] = [];
  private collectionRadius: number = 0.8;

  // Roomba size - realistic scale (about 35cm diameter in a ~5m room)
  private diameter: number = 0.5;
  private height: number = 0.15;

  private startPosition: Vector3;

  constructor(scene: Scene, position: Vector3) {
    this.scene = scene;
    this.startPosition = position.clone();
    this.body = null!;
    this.led = null!;
    this.binBar = null!;
    this.binBarFill = null!;
    this.physicsAggregate = null!;
  }

  async create(): Promise<void> {
    // Main body - flat cylinder (this is the physics root)
    this.body = MeshBuilder.CreateCylinder(
      'roombaBody',
      {
        diameter: this.diameter,
        height: this.height,
        tessellation: 32,
      },
      this.scene
    );
    this.body.position = this.startPosition.clone();

    const bodyMaterial = new StandardMaterial('roombaMat', this.scene);
    bodyMaterial.diffuseColor = new Color3(0.2, 0.2, 0.22);
    bodyMaterial.specularColor = new Color3(0.3, 0.3, 0.3);
    this.body.material = bodyMaterial;

    // Top accent ring
    const ring = MeshBuilder.CreateTorus(
      'roombaRing',
      {
        diameter: this.diameter * 0.9,
        thickness: 0.025,
        tessellation: 32,
      },
      this.scene
    );
    ring.position.y = this.height * 0.4;
    ring.parent = this.body;

    const ringMaterial = new StandardMaterial('ringMat', this.scene);
    ringMaterial.diffuseColor = new Color3(0.3, 0.3, 0.35);
    ring.material = ringMaterial;

    // LED indicator light
    this.led = MeshBuilder.CreateSphere(
      'roombaLed',
      { diameter: 0.05 },
      this.scene
    );
    this.led.position = new Vector3(this.diameter * 0.35, this.height * 0.5, 0);
    this.led.parent = this.body;

    const ledMaterial = new StandardMaterial('ledMat', this.scene);
    ledMaterial.diffuseColor = new Color3(0, 1, 0);
    ledMaterial.emissiveColor = new Color3(0, 0.5, 0);
    this.led.material = ledMaterial;

    // Direction indicator (front bump)
    const front = MeshBuilder.CreateBox(
      'roombaFront',
      { width: this.diameter * 0.6, height: this.height * 0.6, depth: 0.05 },
      this.scene
    );
    front.position = new Vector3(0, 0, this.diameter * 0.45);
    front.parent = this.body;

    const frontMaterial = new StandardMaterial('frontMat', this.scene);
    frontMaterial.diffuseColor = new Color3(0.15, 0.15, 0.17);
    front.material = frontMaterial;

    // Bin capacity bar (background)
    this.binBar = MeshBuilder.CreateBox(
      'binBar',
      { width: 0.4, height: 0.05, depth: 0.05 },
      this.scene
    );
    this.binBar.position = new Vector3(0, 0.4, 0);
    this.binBar.parent = this.body;

    const binBarMaterial = new StandardMaterial('binBarMat', this.scene);
    binBarMaterial.diffuseColor = new Color3(0.3, 0.3, 0.3);
    this.binBar.material = binBarMaterial;

    // Bin capacity bar (fill)
    this.binBarFill = MeshBuilder.CreateBox(
      'binBarFill',
      { width: 0.38, height: 0.04, depth: 0.04 },
      this.scene
    );
    this.binBarFill.position = new Vector3(0, 0.4, 0);
    this.binBarFill.parent = this.body;

    const fillMaterial = new StandardMaterial('fillMat', this.scene);
    fillMaterial.diffuseColor = new Color3(0.2, 0.8, 0.2);
    fillMaterial.emissiveColor = new Color3(0.1, 0.4, 0.1);
    this.binBarFill.material = fillMaterial;
    this.binBarFill.scaling.x = 0;

    // Add physics to the body mesh directly
    this.physicsAggregate = new PhysicsAggregate(
      this.body,
      PhysicsShapeType.CYLINDER,
      {
        mass: 1,
        friction: 0.8,
        restitution: 0.3,
      },
      this.scene
    );

    // Constrain to only rotate on Y axis (no tipping over)
    this.physicsAggregate.body.setMassProperties({
      inertia: new Vector3(0, 1, 0),
    });
  }

  update(deltaTime: number, input: InputState): void {
    // Update rotation based on turn input (steering)
    this.rotation += input.turn * this.turnSpeed * deltaTime;

    // Calculate forward vector based on current rotation
    const forward = new Vector3(
      Math.sin(this.rotation),
      0,
      Math.cos(this.rotation)
    );

    // Apply forward movement (throttle)
    const targetVelocity = forward.scale(input.forward * this.speed);
    this.velocity = Vector3.Lerp(this.velocity, targetVelocity, 0.1);

    // Update physics body velocity (preserve Y for gravity)
    const currentVel = this.physicsAggregate.body.getLinearVelocity();
    this.physicsAggregate.body.setLinearVelocity(
      new Vector3(this.velocity.x, currentVel.y, this.velocity.z)
    );

    // Update visual rotation (physics handles position)
    this.body.rotation.y = this.rotation;

    // Update bin bar
    this.updateBinBar();

    // Update LED color based on bin status
    this.updateLED();
  }

  private updateBinBar(): void {
    const fillPercent = this.binContents.length / this.binCapacity;
    this.binBarFill.scaling.x = fillPercent;

    // Adjust position so bar fills from left to right
    const offset = (1 - fillPercent) * 0.19;
    this.binBarFill.position.x = -offset;

    // Update color based on fill level
    const fillMaterial = this.binBarFill.material as StandardMaterial;
    if (fillPercent < 0.4) {
      fillMaterial.diffuseColor = new Color3(0.2, 0.8, 0.2); // Green
      fillMaterial.emissiveColor = new Color3(0.1, 0.4, 0.1);
    } else if (fillPercent < 0.8) {
      fillMaterial.diffuseColor = new Color3(0.9, 0.8, 0.1); // Yellow
      fillMaterial.emissiveColor = new Color3(0.4, 0.35, 0.05);
    } else {
      fillMaterial.diffuseColor = new Color3(0.9, 0.2, 0.2); // Red
      fillMaterial.emissiveColor = new Color3(0.4, 0.1, 0.1);
    }
  }

  private updateLED(): void {
    const ledMaterial = this.led.material as StandardMaterial;
    if (this.binContents.length >= this.binCapacity) {
      // Full - flash red
      const flash = Math.sin(Date.now() * 0.01) > 0;
      ledMaterial.diffuseColor = flash ? new Color3(1, 0, 0) : new Color3(0.3, 0, 0);
      ledMaterial.emissiveColor = flash ? new Color3(0.5, 0, 0) : new Color3(0.1, 0, 0);
    } else {
      // Normal - green
      ledMaterial.diffuseColor = new Color3(0, 1, 0);
      ledMaterial.emissiveColor = new Color3(0, 0.5, 0);
    }
  }

  collectDust(dust: CollectedDust): void {
    if (this.canCollect()) {
      this.binContents.push(dust);
    }
  }

  depositDust(): CollectedDust[] {
    const deposited = [...this.binContents];
    this.binContents = [];
    return deposited;
  }

  canCollect(): boolean {
    return this.binContents.length < this.binCapacity;
  }

  getBinCount(): number {
    return this.binContents.length;
  }

  getBinCapacity(): number {
    return this.binCapacity;
  }

  getPosition(): Vector3 {
    return this.body.position.clone();
  }

  getRotation(): number {
    return this.rotation;
  }

  getCollectionRadius(): number {
    return this.collectionRadius;
  }

  getMesh(): Mesh {
    return this.body;
  }

  reset(position: Vector3): void {
    this.body.position = position.clone();
    this.rotation = 0;
    this.velocity = Vector3.Zero();
    this.binContents = [];
    this.physicsAggregate.body.setLinearVelocity(Vector3.Zero());
    this.physicsAggregate.body.setAngularVelocity(Vector3.Zero());
  }
}
