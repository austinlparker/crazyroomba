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

interface RoomDefinition {
  name: string;
  position: Vector3;
  size: Vector3;
  floorColor: Color3;
  doorways: DoorwayDefinition[];
  obstacles: ObstacleDefinition[];
}

interface DoorwayDefinition {
  position: Vector3;
  width: number;
  direction: 'x' | 'z';
}

interface ObstacleDefinition {
  type: 'box' | 'cylinder' | 'table' | 'chair' | 'couch' | 'bed';
  name: string;
  position: Vector3;
  size: Vector3;
  color: Color3;
  legColor?: Color3;
  legHeight?: number;
}

export class House {
  private scene: Scene;
  private rooms: RoomDefinition[];
  private wallHeight: number = 3;
  private wallThickness: number = 0.2;
  private floorMeshes: Mesh[] = [];
  private wallMeshes: Mesh[] = [];
  private obstacleMeshes: Mesh[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
    this.rooms = this.defineRooms();
  }

  private defineRooms(): RoomDefinition[] {
    // Room size: ~7m x 7m (realistic room size at roomba scale)
    const roomSize = 7;
    const halfRoom = roomSize / 2;

    return [
      // Living Room (bottom-left, contains dock)
      {
        name: 'livingRoom',
        position: new Vector3(-halfRoom, 0, -halfRoom),
        size: new Vector3(roomSize, 0.1, roomSize),
        floorColor: new Color3(0.76, 0.7, 0.6), // Warm beige
        doorways: [
          { position: new Vector3(0, 0, halfRoom), width: 0.9, direction: 'z' }, // To bedroom
          { position: new Vector3(halfRoom, 0, 0), width: 0.9, direction: 'x' }, // To kitchen
        ],
        obstacles: [
          // Couch (3-seater with legs)
          {
            type: 'couch',
            name: 'couch',
            position: new Vector3(-1.9, 0, -1.4),
            size: new Vector3(1.4, 0.23, 0.56),
            color: new Color3(0.4, 0.3, 0.5),
            legColor: new Color3(0.25, 0.2, 0.15),
            legHeight: 0.07,
          },
          // Coffee table with legs
          {
            type: 'table',
            name: 'coffeeTable',
            position: new Vector3(-1.9, 0, -0.47),
            size: new Vector3(0.7, 0.04, 0.37),
            color: new Color3(0.45, 0.35, 0.25),
            legColor: new Color3(0.35, 0.25, 0.15),
            legHeight: 0.16,
          },
          // TV stand (low, no legs needed)
          {
            type: 'box',
            name: 'tvStand',
            position: new Vector3(-1.9, 0.09, 0.93),
            size: new Vector3(0.93, 0.19, 0.23),
            color: new Color3(0.2, 0.2, 0.2),
          },
          // Armchair with legs
          {
            type: 'chair',
            name: 'armchair',
            position: new Vector3(-0.47, 0, -1.4),
            size: new Vector3(0.42, 0.21, 0.42),
            color: new Color3(0.45, 0.35, 0.5),
            legColor: new Color3(0.25, 0.2, 0.15),
            legHeight: 0.06,
          },
          // Side table
          {
            type: 'table',
            name: 'sideTable',
            position: new Vector3(0.23, 0, -1.4),
            size: new Vector3(0.23, 0.02, 0.23),
            color: new Color3(0.5, 0.4, 0.3),
            legColor: new Color3(0.3, 0.2, 0.15),
            legHeight: 0.23,
          },
          // Plant pot (solid, no legs)
          {
            type: 'cylinder',
            name: 'plant',
            position: new Vector3(2.3, 0.19, 1.4),
            size: new Vector3(0.19, 0.37, 0.19),
            color: new Color3(0.6, 0.4, 0.3),
          },
        ],
      },
      // Kitchen (bottom-right)
      {
        name: 'kitchen',
        position: new Vector3(halfRoom, 0, -halfRoom),
        size: new Vector3(roomSize, 0.1, roomSize),
        floorColor: new Color3(0.9, 0.9, 0.85), // White tile
        doorways: [
          { position: new Vector3(-halfRoom, 0, 0), width: 0.9, direction: 'x' }, // To living room
          { position: new Vector3(0, 0, halfRoom), width: 0.9, direction: 'z' }, // To bathroom
        ],
        obstacles: [
          // Kitchen counter along wall (solid, floor-level)
          {
            type: 'box',
            name: 'counter1',
            position: new Vector3(2.3, 0.21, -2.3),
            size: new Vector3(1.9, 0.42, 0.28),
            color: new Color3(0.7, 0.7, 0.7),
          },
          // Counter along side wall
          {
            type: 'box',
            name: 'counter2',
            position: new Vector3(2.6, 0.21, -0.47),
            size: new Vector3(0.28, 0.42, 2.8),
            color: new Color3(0.7, 0.7, 0.7),
          },
          // Kitchen island with legs
          {
            type: 'table',
            name: 'island',
            position: new Vector3(0, 0, -0.93),
            size: new Vector3(0.93, 0.05, 0.56),
            color: new Color3(0.65, 0.65, 0.65),
            legColor: new Color3(0.4, 0.4, 0.4),
            legHeight: 0.37,
          },
          // Kitchen table with legs
          {
            type: 'table',
            name: 'kitchenTable',
            position: new Vector3(-1.4, 0, 1.4),
            size: new Vector3(0.56, 0.02, 0.56),
            color: new Color3(0.5, 0.4, 0.3),
            legColor: new Color3(0.35, 0.25, 0.2),
            legHeight: 0.33,
          },
          // Chair 1
          {
            type: 'chair',
            name: 'chair1',
            position: new Vector3(-1.96, 0, 1.4),
            size: new Vector3(0.21, 0.16, 0.21),
            color: new Color3(0.4, 0.35, 0.3),
            legColor: new Color3(0.3, 0.25, 0.2),
            legHeight: 0.19,
          },
          // Chair 2
          {
            type: 'chair',
            name: 'chair2',
            position: new Vector3(-0.84, 0, 1.4),
            size: new Vector3(0.21, 0.16, 0.21),
            color: new Color3(0.4, 0.35, 0.3),
            legColor: new Color3(0.3, 0.25, 0.2),
            legHeight: 0.19,
          },
          // Trash can (solid)
          {
            type: 'cylinder',
            name: 'trash',
            position: new Vector3(1.4, 0.16, 2.3),
            size: new Vector3(0.12, 0.33, 0.12),
            color: new Color3(0.3, 0.3, 0.35),
          },
        ],
      },
      // Bedroom (top-left)
      {
        name: 'bedroom',
        position: new Vector3(-halfRoom, 0, halfRoom),
        size: new Vector3(roomSize, 0.1, roomSize),
        floorColor: new Color3(0.6, 0.65, 0.75), // Soft blue carpet
        doorways: [
          { position: new Vector3(0, 0, -halfRoom), width: 0.9, direction: 'z' }, // To living room
          { position: new Vector3(halfRoom, 0, 0), width: 0.9, direction: 'x' }, // To bathroom
        ],
        obstacles: [
          // Bed with legs
          {
            type: 'bed',
            name: 'bed',
            position: new Vector3(-1.9, 0, 1.4),
            size: new Vector3(0.93, 0.14, 1.17),
            color: new Color3(0.85, 0.85, 0.9),
            legColor: new Color3(0.4, 0.3, 0.25),
            legHeight: 0.09,
          },
          // Nightstand with legs
          {
            type: 'table',
            name: 'nightstand',
            position: new Vector3(-0.93, 0, 2.1),
            size: new Vector3(0.23, 0.02, 0.23),
            color: new Color3(0.4, 0.35, 0.3),
            legColor: new Color3(0.3, 0.25, 0.2),
            legHeight: 0.21,
          },
          // Dresser (solid, floor-level)
          {
            type: 'box',
            name: 'dresser',
            position: new Vector3(1.4, 0.23, -1.9),
            size: new Vector3(0.84, 0.47, 0.28),
            color: new Color3(0.45, 0.4, 0.35),
          },
          // Wardrobe (solid, floor-level)
          {
            type: 'box',
            name: 'wardrobe',
            position: new Vector3(-2.6, 0.47, -0.93),
            size: new Vector3(0.56, 0.93, 0.28),
            color: new Color3(0.5, 0.45, 0.4),
          },
          // Desk with legs
          {
            type: 'table',
            name: 'desk',
            position: new Vector3(1.9, 0, 0.93),
            size: new Vector3(0.7, 0.02, 0.33),
            color: new Color3(0.55, 0.45, 0.35),
            legColor: new Color3(0.35, 0.25, 0.2),
            legHeight: 0.33,
          },
          // Desk chair
          {
            type: 'chair',
            name: 'deskChair',
            position: new Vector3(1.9, 0, 0.47),
            size: new Vector3(0.23, 0.14, 0.23),
            color: new Color3(0.2, 0.2, 0.25),
            legColor: new Color3(0.15, 0.15, 0.15),
            legHeight: 0.16,
          },
        ],
      },
      // Bathroom (top-right)
      {
        name: 'bathroom',
        position: new Vector3(halfRoom, 0, halfRoom),
        size: new Vector3(roomSize, 0.1, roomSize),
        floorColor: new Color3(0.95, 0.95, 0.95), // White tile
        doorways: [
          { position: new Vector3(-halfRoom, 0, 0), width: 0.9, direction: 'x' }, // To bedroom
          { position: new Vector3(0, 0, -halfRoom), width: 0.9, direction: 'z' }, // To kitchen
        ],
        obstacles: [
          // Bathtub (solid)
          {
            type: 'box',
            name: 'bathtub',
            position: new Vector3(-1.9, 0.16, 1.9),
            size: new Vector3(0.84, 0.33, 1.17),
            color: new Color3(0.95, 0.95, 1),
          },
          // Toilet (solid)
          {
            type: 'box',
            name: 'toilet',
            position: new Vector3(1.9, 0.14, 1.9),
            size: new Vector3(0.23, 0.28, 0.33),
            color: new Color3(1, 1, 1),
          },
          // Sink cabinet (solid)
          {
            type: 'box',
            name: 'sink',
            position: new Vector3(2.3, 0.19, -0.93),
            size: new Vector3(0.56, 0.37, 0.23),
            color: new Color3(0.9, 0.9, 0.9),
          },
          // Laundry basket (solid)
          {
            type: 'cylinder',
            name: 'laundry',
            position: new Vector3(0, 0.16, 2.3),
            size: new Vector3(0.16, 0.33, 0.16),
            color: new Color3(0.6, 0.55, 0.5),
          },
          // Bathroom stool with legs
          {
            type: 'chair',
            name: 'stool',
            position: new Vector3(-0.93, 0, 0.47),
            size: new Vector3(0.16, 0.04, 0.16),
            color: new Color3(0.8, 0.8, 0.8),
            legColor: new Color3(0.6, 0.6, 0.6),
            legHeight: 0.16,
          },
        ],
      },
    ];
  }

  create(): void {
    this.createGroundPlane();
    this.createFloors();
    this.createWalls();
    this.createObstacles();
  }

  private createGroundPlane(): void {
    // Large invisible ground plane as physics backup
    const ground = MeshBuilder.CreateGround(
      'groundPlane',
      { width: 50, height: 50 },
      this.scene
    );
    ground.position.y = -0.1; // Slightly below floor level
    ground.isVisible = false;
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
  }

  private createFloors(): void {
    for (const room of this.rooms) {
      const floor = MeshBuilder.CreateBox(
        `floor_${room.name}`,
        {
          width: room.size.x,
          height: room.size.y,
          depth: room.size.z,
        },
        this.scene
      );

      floor.position = room.position.clone();
      floor.position.y = -room.size.y / 2;

      const material = new StandardMaterial(`floorMat_${room.name}`, this.scene);
      material.diffuseColor = room.floorColor;
      material.specularColor = new Color3(0.1, 0.1, 0.1);
      floor.material = material;
      floor.receiveShadows = true;

      // Add physics to floor so roomba doesn't fall through
      new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0 }, this.scene);

      this.floorMeshes.push(floor);
    }
  }

  private createWalls(): void {
    for (const room of this.rooms) {
      const halfWidth = room.size.x / 2;
      const halfDepth = room.size.z / 2;
      const centerX = room.position.x;
      const centerZ = room.position.z;

      // Create 4 walls per room, with doorway gaps
      this.createWallWithDoorways(
        room,
        'north',
        new Vector3(centerX, this.wallHeight / 2, centerZ + halfDepth),
        room.size.x,
        'z'
      );
      this.createWallWithDoorways(
        room,
        'south',
        new Vector3(centerX, this.wallHeight / 2, centerZ - halfDepth),
        room.size.x,
        'z'
      );
      this.createWallWithDoorways(
        room,
        'east',
        new Vector3(centerX + halfWidth, this.wallHeight / 2, centerZ),
        room.size.z,
        'x'
      );
      this.createWallWithDoorways(
        room,
        'west',
        new Vector3(centerX - halfWidth, this.wallHeight / 2, centerZ),
        room.size.z,
        'x'
      );
    }
  }

  private createWallWithDoorways(
    room: RoomDefinition,
    side: string,
    position: Vector3,
    length: number,
    direction: 'x' | 'z'
  ): void {
    // Check for doorways on this wall
    const doorways = room.doorways.filter((d) => {
      if (direction === 'z') {
        return (
          (side === 'north' && d.direction === 'z' && d.position.z > 0) ||
          (side === 'south' && d.direction === 'z' && d.position.z < 0)
        );
      } else {
        return (
          (side === 'east' && d.direction === 'x' && d.position.x > 0) ||
          (side === 'west' && d.direction === 'x' && d.position.x < 0)
        );
      }
    });

    if (doorways.length === 0) {
      // Solid wall
      this.createWallSegment(room.name, side, position, length, direction);
    } else {
      // Wall with doorway - create segments on either side
      const doorway = doorways[0];
      const halfDoor = doorway.width / 2;
      const halfLength = length / 2;

      // Left segment
      const leftLength = halfLength - halfDoor;
      if (leftLength > 0) {
        const leftPos = position.clone();
        if (direction === 'z') {
          leftPos.x -= halfLength - leftLength / 2;
        } else {
          leftPos.z -= halfLength - leftLength / 2;
        }
        this.createWallSegment(room.name, `${side}_left`, leftPos, leftLength, direction);
      }

      // Right segment
      const rightLength = halfLength - halfDoor;
      if (rightLength > 0) {
        const rightPos = position.clone();
        if (direction === 'z') {
          rightPos.x += halfLength - rightLength / 2;
        } else {
          rightPos.z += halfLength - rightLength / 2;
        }
        this.createWallSegment(room.name, `${side}_right`, rightPos, rightLength, direction);
      }
    }
  }

  private createWallSegment(
    roomName: string,
    side: string,
    position: Vector3,
    length: number,
    direction: 'x' | 'z'
  ): void {
    const wall = MeshBuilder.CreateBox(
      `wall_${roomName}_${side}`,
      {
        width: direction === 'z' ? length : this.wallThickness,
        height: this.wallHeight,
        depth: direction === 'x' ? length : this.wallThickness,
      },
      this.scene
    );

    wall.position = position;

    const material = new StandardMaterial(`wallMat_${roomName}_${side}`, this.scene);
    material.diffuseColor = new Color3(0.85, 0.85, 0.8);
    material.specularColor = new Color3(0.1, 0.1, 0.1);
    wall.material = material;

    // Enable collision detection for camera
    wall.checkCollisions = true;

    // Add physics
    new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, this.scene);

    this.wallMeshes.push(wall);
  }

  private createObstacles(): void {
    for (const room of this.rooms) {
      for (const obs of room.obstacles) {
        switch (obs.type) {
          case 'table':
            this.createTable(room, obs);
            break;
          case 'chair':
            this.createChair(room, obs);
            break;
          case 'couch':
            this.createCouch(room, obs);
            break;
          case 'bed':
            this.createBed(room, obs);
            break;
          case 'cylinder':
            this.createCylinder(room, obs);
            break;
          case 'box':
          default:
            this.createBox(room, obs);
            break;
        }
      }
    }
  }

  private createTable(room: RoomDefinition, obs: ObstacleDefinition): void {
    const legHeight = obs.legHeight || 0.5;
    const legThickness = 0.06;
    const tableTopY = legHeight + obs.size.y / 2;

    // Table top (visual only, no physics - roomba can go under)
    const tableTop = MeshBuilder.CreateBox(
      `obstacle_${room.name}_${obs.name}_top`,
      {
        width: obs.size.x,
        height: obs.size.y,
        depth: obs.size.z,
      },
      this.scene
    );

    tableTop.position = room.position.add(obs.position);
    tableTop.position.y = tableTopY;

    const topMaterial = new StandardMaterial(`obsMat_${room.name}_${obs.name}_top`, this.scene);
    topMaterial.diffuseColor = obs.color;
    topMaterial.specularColor = new Color3(0.3, 0.3, 0.3);
    tableTop.material = topMaterial;
    tableTop.receiveShadows = true;

    // Create 4 legs with physics
    const legOffsetX = obs.size.x / 2 - legThickness;
    const legOffsetZ = obs.size.z / 2 - legThickness;
    const legPositions = [
      new Vector3(-legOffsetX, 0, -legOffsetZ),
      new Vector3(legOffsetX, 0, -legOffsetZ),
      new Vector3(-legOffsetX, 0, legOffsetZ),
      new Vector3(legOffsetX, 0, legOffsetZ),
    ];

    for (let i = 0; i < legPositions.length; i++) {
      const leg = MeshBuilder.CreateBox(
        `obstacle_${room.name}_${obs.name}_leg${i}`,
        {
          width: legThickness,
          height: legHeight,
          depth: legThickness,
        },
        this.scene
      );

      leg.position = room.position.add(obs.position).add(legPositions[i]);
      leg.position.y = legHeight / 2;

      const legMaterial = new StandardMaterial(`legMat_${room.name}_${obs.name}_${i}`, this.scene);
      legMaterial.diffuseColor = obs.legColor || new Color3(0.3, 0.25, 0.2);
      leg.material = legMaterial;

      // Physics on legs only
      new PhysicsAggregate(leg, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
      this.obstacleMeshes.push(leg);
    }
  }

  private createChair(room: RoomDefinition, obs: ObstacleDefinition): void {
    const legHeight = obs.legHeight || 0.4;
    const legThickness = 0.04;
    const seatY = legHeight + obs.size.y / 2;

    // Seat cushion (visual only)
    const seat = MeshBuilder.CreateBox(
      `obstacle_${room.name}_${obs.name}_seat`,
      {
        width: obs.size.x,
        height: obs.size.y,
        depth: obs.size.z,
      },
      this.scene
    );

    seat.position = room.position.add(obs.position);
    seat.position.y = seatY;

    const seatMaterial = new StandardMaterial(`obsMat_${room.name}_${obs.name}_seat`, this.scene);
    seatMaterial.diffuseColor = obs.color;
    seatMaterial.specularColor = new Color3(0.2, 0.2, 0.2);
    seat.material = seatMaterial;
    seat.receiveShadows = true;

    // Chair back
    const backHeight = obs.size.y * 1.5;
    const back = MeshBuilder.CreateBox(
      `obstacle_${room.name}_${obs.name}_back`,
      {
        width: obs.size.x,
        height: backHeight,
        depth: 0.06,
      },
      this.scene
    );

    back.position = room.position.add(obs.position);
    back.position.y = seatY + backHeight / 2;
    back.position.z = -obs.size.z / 2 + 0.03;

    const backMaterial = new StandardMaterial(`obsMat_${room.name}_${obs.name}_back`, this.scene);
    backMaterial.diffuseColor = obs.color;
    back.material = backMaterial;

    // Create 4 legs with physics
    const legOffsetX = obs.size.x / 2 - legThickness;
    const legOffsetZ = obs.size.z / 2 - legThickness;
    const legPositions = [
      new Vector3(-legOffsetX, 0, -legOffsetZ),
      new Vector3(legOffsetX, 0, -legOffsetZ),
      new Vector3(-legOffsetX, 0, legOffsetZ),
      new Vector3(legOffsetX, 0, legOffsetZ),
    ];

    for (let i = 0; i < legPositions.length; i++) {
      const leg = MeshBuilder.CreateCylinder(
        `obstacle_${room.name}_${obs.name}_leg${i}`,
        {
          diameter: legThickness,
          height: legHeight,
          tessellation: 12,
        },
        this.scene
      );

      leg.position = room.position.add(obs.position).add(legPositions[i]);
      leg.position.y = legHeight / 2;

      const legMaterial = new StandardMaterial(`legMat_${room.name}_${obs.name}_${i}`, this.scene);
      legMaterial.diffuseColor = obs.legColor || new Color3(0.3, 0.25, 0.2);
      leg.material = legMaterial;

      // Physics on legs only
      new PhysicsAggregate(leg, PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);
      this.obstacleMeshes.push(leg);
    }
  }

  private createCouch(room: RoomDefinition, obs: ObstacleDefinition): void {
    const legHeight = obs.legHeight || 0.15;
    const legThickness = 0.08;
    const seatY = legHeight + obs.size.y / 2;

    // Main couch body (visual only)
    const body = MeshBuilder.CreateBox(
      `obstacle_${room.name}_${obs.name}_body`,
      {
        width: obs.size.x,
        height: obs.size.y,
        depth: obs.size.z,
      },
      this.scene
    );

    body.position = room.position.add(obs.position);
    body.position.y = seatY;

    const bodyMaterial = new StandardMaterial(`obsMat_${room.name}_${obs.name}_body`, this.scene);
    bodyMaterial.diffuseColor = obs.color;
    bodyMaterial.specularColor = new Color3(0.15, 0.15, 0.15);
    body.material = bodyMaterial;
    body.receiveShadows = true;

    // Backrest
    const backHeight = obs.size.y * 0.8;
    const back = MeshBuilder.CreateBox(
      `obstacle_${room.name}_${obs.name}_back`,
      {
        width: obs.size.x,
        height: backHeight,
        depth: 0.2,
      },
      this.scene
    );

    back.position = room.position.add(obs.position);
    back.position.y = seatY + obs.size.y / 2 + backHeight / 2;
    back.position.z = -obs.size.z / 2 + 0.1;

    const backMaterial = new StandardMaterial(`obsMat_${room.name}_${obs.name}_back`, this.scene);
    backMaterial.diffuseColor = obs.color.scale(0.9);
    back.material = backMaterial;

    // Armrests
    for (let side = -1; side <= 1; side += 2) {
      const armrest = MeshBuilder.CreateBox(
        `obstacle_${room.name}_${obs.name}_arm${side}`,
        {
          width: 0.15,
          height: obs.size.y * 0.6,
          depth: obs.size.z,
        },
        this.scene
      );

      armrest.position = room.position.add(obs.position);
      armrest.position.x += side * (obs.size.x / 2 + 0.05);
      armrest.position.y = seatY + obs.size.y * 0.2;

      const armMaterial = new StandardMaterial(`obsMat_${room.name}_${obs.name}_arm${side}`, this.scene);
      armMaterial.diffuseColor = obs.color.scale(0.95);
      armrest.material = armMaterial;
    }

    // Create 4 legs with physics
    const legOffsetX = obs.size.x / 2 - legThickness / 2;
    const legOffsetZ = obs.size.z / 2 - legThickness / 2;
    const legPositions = [
      new Vector3(-legOffsetX, 0, -legOffsetZ),
      new Vector3(legOffsetX, 0, -legOffsetZ),
      new Vector3(-legOffsetX, 0, legOffsetZ),
      new Vector3(legOffsetX, 0, legOffsetZ),
    ];

    for (let i = 0; i < legPositions.length; i++) {
      const leg = MeshBuilder.CreateBox(
        `obstacle_${room.name}_${obs.name}_leg${i}`,
        {
          width: legThickness,
          height: legHeight,
          depth: legThickness,
        },
        this.scene
      );

      leg.position = room.position.add(obs.position).add(legPositions[i]);
      leg.position.y = legHeight / 2;

      const legMaterial = new StandardMaterial(`legMat_${room.name}_${obs.name}_${i}`, this.scene);
      legMaterial.diffuseColor = obs.legColor || new Color3(0.2, 0.15, 0.1);
      leg.material = legMaterial;

      // Physics on legs only
      new PhysicsAggregate(leg, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
      this.obstacleMeshes.push(leg);
    }
  }

  private createBed(room: RoomDefinition, obs: ObstacleDefinition): void {
    const legHeight = obs.legHeight || 0.2;
    const legThickness = 0.1;
    const bedY = legHeight + obs.size.y / 2;

    // Mattress
    const mattress = MeshBuilder.CreateBox(
      `obstacle_${room.name}_${obs.name}_mattress`,
      {
        width: obs.size.x,
        height: obs.size.y,
        depth: obs.size.z,
      },
      this.scene
    );

    mattress.position = room.position.add(obs.position);
    mattress.position.y = bedY;

    const mattressMaterial = new StandardMaterial(`obsMat_${room.name}_${obs.name}_mattress`, this.scene);
    mattressMaterial.diffuseColor = obs.color;
    mattressMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
    mattress.material = mattressMaterial;
    mattress.receiveShadows = true;

    // Headboard
    const headboard = MeshBuilder.CreateBox(
      `obstacle_${room.name}_${obs.name}_headboard`,
      {
        width: obs.size.x,
        height: obs.size.y * 2,
        depth: 0.1,
      },
      this.scene
    );

    headboard.position = room.position.add(obs.position);
    headboard.position.y = bedY + obs.size.y;
    headboard.position.z = obs.size.z / 2;

    const headboardMaterial = new StandardMaterial(`obsMat_${room.name}_${obs.name}_head`, this.scene);
    headboardMaterial.diffuseColor = obs.legColor || new Color3(0.4, 0.3, 0.25);
    headboard.material = headboardMaterial;

    // Pillow
    const pillow = MeshBuilder.CreateBox(
      `obstacle_${room.name}_${obs.name}_pillow`,
      {
        width: obs.size.x * 0.7,
        height: 0.12,
        depth: 0.4,
      },
      this.scene
    );

    pillow.position = room.position.add(obs.position);
    pillow.position.y = bedY + obs.size.y / 2 + 0.1;
    pillow.position.z = obs.size.z / 2 - 0.3;

    const pillowMaterial = new StandardMaterial(`obsMat_${room.name}_${obs.name}_pillow`, this.scene);
    pillowMaterial.diffuseColor = new Color3(0.95, 0.95, 0.98);
    pillow.material = pillowMaterial;

    // Create 4 legs with physics (roomba can go under bed!)
    const legOffsetX = obs.size.x / 2 - legThickness / 2;
    const legOffsetZ = obs.size.z / 2 - legThickness / 2;
    const legPositions = [
      new Vector3(-legOffsetX, 0, -legOffsetZ),
      new Vector3(legOffsetX, 0, -legOffsetZ),
      new Vector3(-legOffsetX, 0, legOffsetZ),
      new Vector3(legOffsetX, 0, legOffsetZ),
    ];

    for (let i = 0; i < legPositions.length; i++) {
      const leg = MeshBuilder.CreateBox(
        `obstacle_${room.name}_${obs.name}_leg${i}`,
        {
          width: legThickness,
          height: legHeight,
          depth: legThickness,
        },
        this.scene
      );

      leg.position = room.position.add(obs.position).add(legPositions[i]);
      leg.position.y = legHeight / 2;

      const legMaterial = new StandardMaterial(`legMat_${room.name}_${obs.name}_${i}`, this.scene);
      legMaterial.diffuseColor = obs.legColor || new Color3(0.4, 0.3, 0.25);
      leg.material = legMaterial;

      // Physics on legs only
      new PhysicsAggregate(leg, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
      this.obstacleMeshes.push(leg);
    }
  }

  private createCylinder(room: RoomDefinition, obs: ObstacleDefinition): void {
    const mesh = MeshBuilder.CreateCylinder(
      `obstacle_${room.name}_${obs.name}`,
      {
        diameter: obs.size.x * 2,
        height: obs.size.y,
      },
      this.scene
    );

    mesh.position = room.position.add(obs.position);
    mesh.position.y = obs.position.y;

    const material = new StandardMaterial(`obsMat_${room.name}_${obs.name}`, this.scene);
    material.diffuseColor = obs.color;
    material.specularColor = new Color3(0.2, 0.2, 0.2);
    mesh.material = material;
    mesh.receiveShadows = true;

    new PhysicsAggregate(mesh, PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);
    this.obstacleMeshes.push(mesh);
  }

  private createBox(room: RoomDefinition, obs: ObstacleDefinition): void {
    const mesh = MeshBuilder.CreateBox(
      `obstacle_${room.name}_${obs.name}`,
      {
        width: obs.size.x,
        height: obs.size.y,
        depth: obs.size.z,
      },
      this.scene
    );

    mesh.position = room.position.add(obs.position);
    mesh.position.y = obs.position.y;

    const material = new StandardMaterial(`obsMat_${room.name}_${obs.name}`, this.scene);
    material.diffuseColor = obs.color;
    material.specularColor = new Color3(0.2, 0.2, 0.2);
    mesh.material = material;
    mesh.receiveShadows = true;

    new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    this.obstacleMeshes.push(mesh);
  }

  getRooms(): RoomDefinition[] {
    return this.rooms;
  }

  getObstacleMeshes(): Mesh[] {
    return this.obstacleMeshes;
  }

  getWallMeshes(): Mesh[] {
    return this.wallMeshes;
  }

  getBounds(): { min: Vector3; max: Vector3 } {
    return {
      min: new Vector3(-7, 0, -7),
      max: new Vector3(7, 3, 7),
    };
  }
}
