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
  private sideBrush: Mesh;
  private physicsAggregate: PhysicsAggregate;

  // Car-style physics constants
  private maxSpeed: number = 8;
  private maxReverseSpeed: number = 4;        // Half of forward speed
  private acceleration: number = 12;
  private deceleration: number = 8;
  private friction: number = 4;               // Speed reduction when no input
  private turnRate: number = 2.5;             // Base turn rate
  private minSpeedForTurn: number = 0.5;      // Minimum speed needed to turn
  private maxTurnAtSpeed: number = 4;         // Speed at which max turn rate is achieved

  // Car-style state
  private currentSpeed: number = 0;           // Current forward speed (can be negative)
  private rotation: number = 0;
  private velocity: Vector3 = Vector3.Zero();

  private binCapacity: number = 5;
  private binContents: CollectedDust[] = [];
  private collectionRadius: number = 0.8;

  // Roomba size - realistic scale (about 35cm diameter in a ~5m room)
  private diameter: number = 0.5;
  private height: number = 0.12;

  private startPosition: Vector3;

  // Collision stun state
  private isStunned: boolean = false;
  private stunTimer: number = 0;
  private stunDuration: number = 0.8; // seconds
  private wobblePhase: number = 0;
  private wobbleIntensity: number = 0;
  private collisionCooldown: number = 0;

  // Reference to collidable meshes (set from Game.ts)
  private collidableMeshes: Mesh[] = [];

  constructor(scene: Scene, position: Vector3) {
    this.scene = scene;
    this.startPosition = position.clone();
    this.body = null!;
    this.led = null!;
    this.binBar = null!;
    this.binBarFill = null!;
    this.sideBrush = null!;
    this.physicsAggregate = null!;
  }

  setCollidableMeshes(meshes: Mesh[]): void {
    this.collidableMeshes = meshes;
  }

  async create(): Promise<void> {
    // Main body - flat cylinder (this is the physics root)
    this.body = MeshBuilder.CreateCylinder(
      'roombaBody',
      {
        diameter: this.diameter,
        height: this.height,
        tessellation: 48,
      },
      this.scene
    );
    this.body.position = this.startPosition.clone();

    const bodyMaterial = new StandardMaterial('roombaMat', this.scene);
    bodyMaterial.diffuseColor = new Color3(0.15, 0.15, 0.17); // Dark charcoal
    bodyMaterial.specularColor = new Color3(0.4, 0.4, 0.4);
    this.body.material = bodyMaterial;

    // Raised center section (dome-like top)
    const topDome = MeshBuilder.CreateCylinder(
      'roombaTop',
      {
        diameter: this.diameter * 0.75,
        height: this.height * 0.4,
        tessellation: 48,
      },
      this.scene
    );
    topDome.position.y = this.height * 0.35;
    topDome.parent = this.body;

    const topMaterial = new StandardMaterial('roombaTopMat', this.scene);
    topMaterial.diffuseColor = new Color3(0.12, 0.12, 0.14);
    topMaterial.specularColor = new Color3(0.5, 0.5, 0.5);
    topDome.material = topMaterial;

    // Front bumper (curved section)
    const bumper = MeshBuilder.CreateCylinder(
      'roombaBumper',
      {
        diameter: this.diameter * 1.02,
        height: this.height * 0.6,
        tessellation: 48,
        arc: 0.55, // About 200 degrees
      },
      this.scene
    );
    bumper.position.y = -this.height * 0.1;
    bumper.rotation.y = Math.PI; // Face forward
    bumper.parent = this.body;

    const bumperMaterial = new StandardMaterial('bumperMat', this.scene);
    bumperMaterial.diffuseColor = new Color3(0.2, 0.2, 0.22);
    bumperMaterial.specularColor = new Color3(0.3, 0.3, 0.3);
    bumper.material = bumperMaterial;

    // Control panel on top
    const controlPanel = MeshBuilder.CreateBox(
      'controlPanel',
      {
        width: this.diameter * 0.35,
        height: 0.015,
        depth: this.diameter * 0.2,
      },
      this.scene
    );
    controlPanel.position = new Vector3(0, this.height * 0.55, -this.diameter * 0.15);
    controlPanel.parent = this.body;

    const panelMaterial = new StandardMaterial('panelMat', this.scene);
    panelMaterial.diffuseColor = new Color3(0.08, 0.08, 0.1);
    controlPanel.material = panelMaterial;

    // Clean button (large center button)
    const cleanButton = MeshBuilder.CreateCylinder(
      'cleanButton',
      {
        diameter: 0.06,
        height: 0.02,
        tessellation: 24,
      },
      this.scene
    );
    cleanButton.position = new Vector3(0, this.height * 0.58, -this.diameter * 0.15);
    cleanButton.parent = this.body;

    const buttonMaterial = new StandardMaterial('buttonMat', this.scene);
    buttonMaterial.diffuseColor = new Color3(0.1, 0.6, 0.2); // Green button
    buttonMaterial.emissiveColor = new Color3(0.05, 0.3, 0.1);
    cleanButton.material = buttonMaterial;

    // LED indicator light (status)
    this.led = MeshBuilder.CreateSphere(
      'roombaLed',
      { diameter: 0.025 },
      this.scene
    );
    this.led.position = new Vector3(0.04, this.height * 0.58, -this.diameter * 0.15);
    this.led.parent = this.body;

    const ledMaterial = new StandardMaterial('ledMat', this.scene);
    ledMaterial.diffuseColor = new Color3(0, 1, 0);
    ledMaterial.emissiveColor = new Color3(0, 0.7, 0);
    this.led.material = ledMaterial;

    // Side brush (rotating brush on the side)
    this.sideBrush = this.createSideBrush();
    this.sideBrush.position = new Vector3(this.diameter * 0.35, -this.height * 0.4, this.diameter * 0.25);
    this.sideBrush.parent = this.body;

    // Second side brush on other side
    const sideBrush2 = this.createSideBrush();
    sideBrush2.position = new Vector3(-this.diameter * 0.35, -this.height * 0.4, this.diameter * 0.25);
    sideBrush2.parent = this.body;

    // Front roller brush area (visible slot)
    const rollerSlot = MeshBuilder.CreateBox(
      'rollerSlot',
      {
        width: this.diameter * 0.5,
        height: 0.02,
        depth: 0.03,
      },
      this.scene
    );
    rollerSlot.position = new Vector3(0, -this.height * 0.35, this.diameter * 0.3);
    rollerSlot.parent = this.body;

    const slotMaterial = new StandardMaterial('slotMat', this.scene);
    slotMaterial.diffuseColor = new Color3(0.05, 0.05, 0.05);
    rollerSlot.material = slotMaterial;

    // Dust bin indicator (rear section)
    const binSection = MeshBuilder.CreateBox(
      'binSection',
      {
        width: this.diameter * 0.6,
        height: this.height * 0.5,
        depth: 0.04,
      },
      this.scene
    );
    binSection.position = new Vector3(0, 0, -this.diameter * 0.4);
    binSection.parent = this.body;

    const binMaterial = new StandardMaterial('binMat', this.scene);
    binMaterial.diffuseColor = new Color3(0.18, 0.18, 0.2);
    binSection.material = binMaterial;

    // Bin capacity bar (background) - positioned on top of roomba, visible from overhead camera
    this.binBar = MeshBuilder.CreateBox(
      'binBar',
      { width: 0.28, height: 0.015, depth: 0.06 },
      this.scene
    );
    // Position on top of the roomba body, toward the back (negative Z is back)
    this.binBar.position = new Vector3(0, this.height * 0.6, -this.diameter * 0.2);
    // Slight tilt toward camera for better visibility
    this.binBar.rotation.x = -0.3;
    this.binBar.parent = this.body;

    const binBarMaterial = new StandardMaterial('binBarMat', this.scene);
    binBarMaterial.diffuseColor = new Color3(0.15, 0.15, 0.15);
    binBarMaterial.emissiveColor = new Color3(0.05, 0.05, 0.05);
    this.binBar.material = binBarMaterial;

    // Bin capacity bar (fill)
    this.binBarFill = MeshBuilder.CreateBox(
      'binBarFill',
      { width: 0.26, height: 0.02, depth: 0.05 },
      this.scene
    );
    this.binBarFill.position = new Vector3(0, this.height * 0.6 + 0.005, -this.diameter * 0.2);
    this.binBarFill.rotation.x = -0.3;
    this.binBarFill.parent = this.body;

    const fillMaterial = new StandardMaterial('fillMat', this.scene);
    fillMaterial.diffuseColor = new Color3(0.2, 0.8, 0.2);
    fillMaterial.emissiveColor = new Color3(0.1, 0.5, 0.1);
    this.binBarFill.material = fillMaterial;
    this.binBarFill.scaling.x = 0;

    // Infrared sensors (front)
    for (let i = -1; i <= 1; i++) {
      const sensor = MeshBuilder.CreateSphere(
        `sensor_${i}`,
        { diameter: 0.015 },
        this.scene
      );
      sensor.position = new Vector3(i * 0.08, 0, this.diameter * 0.48);
      sensor.parent = this.body;

      const sensorMat = new StandardMaterial(`sensorMat_${i}`, this.scene);
      sensorMat.diffuseColor = new Color3(0.1, 0.1, 0.1);
      sensorMat.emissiveColor = new Color3(0.2, 0, 0); // Faint red IR glow
      sensor.material = sensorMat;
    }

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

  private createSideBrush(): Mesh {
    const brushHub = MeshBuilder.CreateCylinder(
      'brushHub',
      {
        diameter: 0.03,
        height: 0.015,
        tessellation: 12,
      },
      this.scene
    );

    const hubMat = new StandardMaterial('hubMat', this.scene);
    hubMat.diffuseColor = new Color3(0.3, 0.3, 0.3);
    brushHub.material = hubMat;

    // Create brush bristles
    for (let i = 0; i < 3; i++) {
      const bristle = MeshBuilder.CreateBox(
        `bristle_${i}`,
        {
          width: 0.06,
          height: 0.005,
          depth: 0.01,
        },
        this.scene
      );
      bristle.rotation.y = (i * Math.PI * 2) / 3;
      bristle.position = new Vector3(
        Math.cos((i * Math.PI * 2) / 3) * 0.04,
        0,
        Math.sin((i * Math.PI * 2) / 3) * 0.04
      );
      bristle.parent = brushHub;

      const bristleMat = new StandardMaterial(`bristleMat_${i}`, this.scene);
      bristleMat.diffuseColor = new Color3(0.2, 0.5, 0.2); // Green bristles
      bristle.material = bristleMat;
    }

    return brushHub;
  }

  update(deltaTime: number, input: InputState): void {
    // Update collision cooldown
    if (this.collisionCooldown > 0) {
      this.collisionCooldown -= deltaTime;
    }

    // Check for collisions
    this.checkCollisions();

    // Update stun state
    if (this.isStunned) {
      this.stunTimer -= deltaTime;
      this.wobblePhase += deltaTime * 25; // Fast wobble

      // Apply wobble effect
      const wobble = Math.sin(this.wobblePhase) * this.wobbleIntensity;
      this.body.rotation.z = wobble;
      this.body.rotation.x = Math.cos(this.wobblePhase * 0.7) * this.wobbleIntensity * 0.5;

      // Decay wobble intensity
      this.wobbleIntensity *= 0.95;

      if (this.stunTimer <= 0) {
        this.isStunned = false;
        this.body.rotation.z = 0;
        this.body.rotation.x = 0;
      }
    }

    // Rotate side brushes
    if (this.sideBrush) {
      this.sideBrush.rotation.y += deltaTime * 8;
    }

    // Only respond to input if not stunned
    if (!this.isStunned) {
      // Car-style physics: acceleration/deceleration
      if (input.forward > 0) {
        // Accelerate forward
        this.currentSpeed += this.acceleration * input.forward * deltaTime;
      } else if (input.forward < 0) {
        // Brake/reverse
        this.currentSpeed += this.deceleration * input.forward * deltaTime;
      } else {
        // Apply friction when no input
        if (Math.abs(this.currentSpeed) > 0.01) {
          const frictionForce = this.friction * deltaTime;
          if (this.currentSpeed > 0) {
            this.currentSpeed = Math.max(0, this.currentSpeed - frictionForce);
          } else {
            this.currentSpeed = Math.min(0, this.currentSpeed + frictionForce);
          }
        } else {
          this.currentSpeed = 0;
        }
      }

      // Clamp speed
      this.currentSpeed = Math.max(-this.maxReverseSpeed, Math.min(this.maxSpeed, this.currentSpeed));

      // Car-style steering: only turn when moving
      const absSpeed = Math.abs(this.currentSpeed);
      if (absSpeed >= this.minSpeedForTurn && input.turn !== 0) {
        // Turn rate increases with speed up to a point, then stays constant
        const speedFactor = Math.min(absSpeed / this.maxTurnAtSpeed, 1);
        const turnAmount = input.turn * this.turnRate * speedFactor * deltaTime;

        // Reverse steering when going backwards (like a real car)
        if (this.currentSpeed < 0) {
          this.rotation -= turnAmount;
        } else {
          this.rotation += turnAmount;
        }
      }

      // Calculate forward vector based on current rotation
      const forward = new Vector3(
        Math.sin(this.rotation),
        0,
        Math.cos(this.rotation)
      );

      // Apply movement based on current speed
      this.velocity = forward.scale(this.currentSpeed);

      // Update physics body velocity (preserve Y for gravity)
      const currentVel = this.physicsAggregate.body.getLinearVelocity();
      this.physicsAggregate.body.setLinearVelocity(
        new Vector3(this.velocity.x, currentVel.y, this.velocity.z)
      );
    }

    // Update visual rotation (physics handles position)
    this.body.rotation.y = this.rotation;

    // Update bin bar
    this.updateBinBar();

    // Update LED color based on bin status
    this.updateLED();
  }

  private checkCollisions(): void {
    // Skip if in cooldown or already stunned
    if (this.collisionCooldown > 0 || this.isStunned) {
      return;
    }

    const roombaPos = this.body.position;
    const roombaRadius = this.diameter / 2;

    // Check against all collidable meshes
    for (const mesh of this.collidableMeshes) {
      // Get mesh bounding info
      const bounds = mesh.getBoundingInfo();
      const meshMin = bounds.boundingBox.minimumWorld;
      const meshMax = bounds.boundingBox.maximumWorld;

      // Simple AABB + circle collision check
      const closestX = Math.max(meshMin.x, Math.min(roombaPos.x, meshMax.x));
      const closestZ = Math.max(meshMin.z, Math.min(roombaPos.z, meshMax.z));

      const distanceX = roombaPos.x - closestX;
      const distanceZ = roombaPos.z - closestZ;
      const distanceSquared = distanceX * distanceX + distanceZ * distanceZ;

      if (distanceSquared < roombaRadius * roombaRadius) {
        // Collision detected!
        this.triggerCollisionStun();
        return;
      }
    }
  }

  private triggerCollisionStun(): void {
    this.isStunned = true;
    this.stunTimer = this.stunDuration;
    this.collisionCooldown = this.stunDuration + 0.3; // Prevent immediate re-collision
    this.wobbleIntensity = 0.15; // Initial wobble strength
    this.wobblePhase = 0;

    // Apply random bounce direction
    const randomAngle = Math.random() * Math.PI * 2;
    const bounceSpeed = 4 + Math.random() * 3; // Random speed between 4-7
    const bounceVelocity = new Vector3(
      Math.sin(randomAngle) * bounceSpeed,
      0.5, // Small upward pop
      Math.cos(randomAngle) * bounceSpeed
    );

    this.physicsAggregate.body.setLinearVelocity(bounceVelocity);

    // Clear player velocity and speed so they don't immediately resume motion
    this.velocity = Vector3.Zero();
    this.currentSpeed = 0;
  }

  private updateBinBar(): void {
    const fillPercent = this.binContents.length / this.binCapacity;
    this.binBarFill.scaling.x = fillPercent;

    // Adjust position so bar fills from left to right
    const offset = (1 - fillPercent) * 0.165;
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
    if (this.isStunned) {
      // Stunned - flash orange
      const flash = Math.sin(Date.now() * 0.02) > 0;
      ledMaterial.diffuseColor = flash ? new Color3(1, 0.5, 0) : new Color3(0.3, 0.15, 0);
      ledMaterial.emissiveColor = flash ? new Color3(0.7, 0.35, 0) : new Color3(0.1, 0.05, 0);
    } else if (this.binContents.length >= this.binCapacity) {
      // Full - flash red
      const flash = Math.sin(Date.now() * 0.01) > 0;
      ledMaterial.diffuseColor = flash ? new Color3(1, 0, 0) : new Color3(0.3, 0, 0);
      ledMaterial.emissiveColor = flash ? new Color3(0.7, 0, 0) : new Color3(0.1, 0, 0);
    } else {
      // Normal - green
      ledMaterial.diffuseColor = new Color3(0, 1, 0);
      ledMaterial.emissiveColor = new Color3(0, 0.7, 0);
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

  isCurrentlyStunned(): boolean {
    return this.isStunned;
  }

  reset(position: Vector3): void {
    this.body.position = position.clone();
    this.rotation = 0;
    this.currentSpeed = 0;
    this.velocity = Vector3.Zero();
    this.binContents = [];
    this.isStunned = false;
    this.stunTimer = 0;
    this.wobbleIntensity = 0;
    this.body.rotation.z = 0;
    this.body.rotation.x = 0;
    this.collisionCooldown = 0;
    this.physicsAggregate.body.setLinearVelocity(Vector3.Zero());
    this.physicsAggregate.body.setAngularVelocity(Vector3.Zero());
  }
}
