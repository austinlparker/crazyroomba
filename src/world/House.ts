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
  type: 'box' | 'cylinder';
  name: string;
  position: Vector3;
  size: Vector3;
  color: Color3;
}

export class House {
  private scene: Scene;
  private rooms: RoomDefinition[];
  private wallHeight: number = 3;
  private wallThickness: number = 0.3;
  private floorMeshes: Mesh[] = [];
  private wallMeshes: Mesh[] = [];
  private obstacleMeshes: Mesh[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
    this.rooms = this.defineRooms();
  }

  private defineRooms(): RoomDefinition[] {
    const roomSize = 10;
    const halfRoom = roomSize / 2;

    return [
      // Living Room (bottom-left, contains dock)
      {
        name: 'livingRoom',
        position: new Vector3(-halfRoom, 0, -halfRoom),
        size: new Vector3(roomSize, 0.1, roomSize),
        floorColor: new Color3(0.76, 0.7, 0.6), // Warm beige
        doorways: [
          { position: new Vector3(0, 0, halfRoom), width: 2.5, direction: 'z' }, // To bedroom
          { position: new Vector3(halfRoom, 0, 0), width: 2.5, direction: 'x' }, // To kitchen
        ],
        obstacles: [
          // Couch
          {
            type: 'box',
            name: 'couch',
            position: new Vector3(-3, 0.4, -2),
            size: new Vector3(4, 0.8, 1.2),
            color: new Color3(0.4, 0.3, 0.5),
          },
          // Coffee table
          {
            type: 'box',
            name: 'coffeeTable',
            position: new Vector3(-3, 0.25, -0.5),
            size: new Vector3(2, 0.5, 1),
            color: new Color3(0.45, 0.35, 0.25),
          },
          // TV stand
          {
            type: 'box',
            name: 'tvStand',
            position: new Vector3(-3, 0.3, 2),
            size: new Vector3(3, 0.6, 0.8),
            color: new Color3(0.2, 0.2, 0.2),
          },
          // Shoes
          {
            type: 'box',
            name: 'shoes1',
            position: new Vector3(2, 0.1, -3),
            size: new Vector3(0.5, 0.2, 0.3),
            color: new Color3(0.3, 0.15, 0.1),
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
          { position: new Vector3(-halfRoom, 0, 0), width: 2.5, direction: 'x' }, // To living room
          { position: new Vector3(0, 0, halfRoom), width: 2.5, direction: 'z' }, // To bathroom
        ],
        obstacles: [
          // Kitchen counter (L-shaped)
          {
            type: 'box',
            name: 'counter1',
            position: new Vector3(3, 0.5, -3),
            size: new Vector3(4, 1, 0.8),
            color: new Color3(0.7, 0.7, 0.7),
          },
          {
            type: 'box',
            name: 'counter2',
            position: new Vector3(3.5, 0.5, 0),
            size: new Vector3(0.8, 1, 5),
            color: new Color3(0.7, 0.7, 0.7),
          },
          // Kitchen island
          {
            type: 'box',
            name: 'island',
            position: new Vector3(-1, 0.5, -1),
            size: new Vector3(2, 1, 1.5),
            color: new Color3(0.65, 0.65, 0.65),
          },
          // Kitchen table
          {
            type: 'cylinder',
            name: 'kitchenTable',
            position: new Vector3(-2, 0.4, 2),
            size: new Vector3(1.2, 0.8, 1.2),
            color: new Color3(0.5, 0.4, 0.3),
          },
          // Trash can
          {
            type: 'cylinder',
            name: 'trash',
            position: new Vector3(2, 0.4, 3),
            size: new Vector3(0.4, 0.8, 0.4),
            color: new Color3(0.3, 0.3, 0.35),
          },
        ],
      },
      // Bedroom (top-left)
      {
        name: 'bedroom',
        position: new Vector3(-halfRoom, 0, halfRoom + roomSize),
        size: new Vector3(roomSize, 0.1, roomSize),
        floorColor: new Color3(0.6, 0.65, 0.75), // Soft blue carpet
        doorways: [
          { position: new Vector3(0, 0, -halfRoom), width: 2.5, direction: 'z' }, // To living room
          { position: new Vector3(halfRoom, 0, 0), width: 2.5, direction: 'x' }, // To bathroom
        ],
        obstacles: [
          // Bed
          {
            type: 'box',
            name: 'bed',
            position: new Vector3(-2, 0.35, 2),
            size: new Vector3(4, 0.7, 5),
            color: new Color3(0.85, 0.85, 0.9),
          },
          // Nightstand
          {
            type: 'box',
            name: 'nightstand',
            position: new Vector3(1.5, 0.3, 3),
            size: new Vector3(0.8, 0.6, 0.8),
            color: new Color3(0.4, 0.35, 0.3),
          },
          // Dresser
          {
            type: 'box',
            name: 'dresser',
            position: new Vector3(2, 0.5, -2),
            size: new Vector3(2.5, 1, 0.8),
            color: new Color3(0.45, 0.4, 0.35),
          },
          // Shoes
          {
            type: 'box',
            name: 'shoes2',
            position: new Vector3(-3.5, 0.1, -2),
            size: new Vector3(0.5, 0.2, 0.3),
            color: new Color3(0.1, 0.1, 0.15),
          },
        ],
      },
      // Bathroom (top-right)
      {
        name: 'bathroom',
        position: new Vector3(halfRoom, 0, halfRoom + roomSize),
        size: new Vector3(roomSize, 0.1, roomSize),
        floorColor: new Color3(0.95, 0.95, 0.95), // White tile
        doorways: [
          { position: new Vector3(-halfRoom, 0, 0), width: 2.5, direction: 'x' }, // To bedroom
          { position: new Vector3(0, 0, -halfRoom), width: 2.5, direction: 'z' }, // To kitchen
        ],
        obstacles: [
          // Bathtub
          {
            type: 'box',
            name: 'bathtub',
            position: new Vector3(-3, 0.4, 2),
            size: new Vector3(2, 0.8, 4),
            color: new Color3(0.95, 0.95, 1),
          },
          // Toilet
          {
            type: 'box',
            name: 'toilet',
            position: new Vector3(2, 0.35, 3),
            size: new Vector3(0.8, 0.7, 1.2),
            color: new Color3(1, 1, 1),
          },
          // Sink
          {
            type: 'box',
            name: 'sink',
            position: new Vector3(3, 0.5, -1),
            size: new Vector3(1.5, 1, 0.8),
            color: new Color3(0.9, 0.9, 0.9),
          },
          // Bath mat
          {
            type: 'box',
            name: 'bathMat',
            position: new Vector3(-1, 0.05, 2),
            size: new Vector3(1.5, 0.1, 1),
            color: new Color3(0.4, 0.6, 0.7),
          },
        ],
      },
    ];
  }

  create(): void {
    this.createFloors();
    this.createWalls();
    this.createObstacles();
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

    // Add physics
    new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, this.scene);

    this.wallMeshes.push(wall);
  }

  private createObstacles(): void {
    for (const room of this.rooms) {
      for (const obs of room.obstacles) {
        let mesh: Mesh;

        if (obs.type === 'cylinder') {
          mesh = MeshBuilder.CreateCylinder(
            `obstacle_${room.name}_${obs.name}`,
            {
              diameter: obs.size.x * 2,
              height: obs.size.y,
            },
            this.scene
          );
        } else {
          mesh = MeshBuilder.CreateBox(
            `obstacle_${room.name}_${obs.name}`,
            {
              width: obs.size.x,
              height: obs.size.y,
              depth: obs.size.z,
            },
            this.scene
          );
        }

        // Position relative to room center
        mesh.position = room.position.add(obs.position);
        mesh.position.y = obs.position.y;

        const material = new StandardMaterial(`obsMat_${room.name}_${obs.name}`, this.scene);
        material.diffuseColor = obs.color;
        material.specularColor = new Color3(0.2, 0.2, 0.2);
        mesh.material = material;
        mesh.receiveShadows = true;

        // Add physics
        new PhysicsAggregate(
          mesh,
          obs.type === 'cylinder' ? PhysicsShapeType.CYLINDER : PhysicsShapeType.BOX,
          { mass: 0 },
          this.scene
        );

        this.obstacleMeshes.push(mesh);
      }
    }
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
      min: new Vector3(-10, 0, -10),
      max: new Vector3(10, 3, 20),
    };
  }
}
