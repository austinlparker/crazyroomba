# Crazy Roomba - Implementation Plan

A browser-based 3D game inspired by Crazy Taxi where the player controls a roomba navigating a multi-room house, collecting dust bunnies and returning them to a charging dock.

## Tech Stack

| Component | Technology |
|-----------|------------|
| 3D Engine | Babylon.js 7.x |
| Build Tool | Vite |
| Language | TypeScript |
| Audio | Tone.js (MIDI playback) |
| Pathfinding | pathfinding.js (A* implementation) |
| Storage | localStorage (leaderboard) |

---

## Game Design

### Core Loop

1. Player controls a roomba in a 3D house
2. Navigate to dust bunnies scattered across rooms
3. Collect dust (limited bin capacity of 5)
4. Return to charging dock to auto-deposit
5. Earn points/time based on A* distance traveled

### Game Modes

#### Time Attack
- **Starting Time:** 60 seconds
- **Objective:** Score as many points as possible before time runs out
- **Time Bonus:** Depositing dust at dock adds time based on path distance from where dust was collected
- **Game Over:** Timer reaches 0

#### Endless
- **No Timer:** Play indefinitely
- **Infinite Dust:** Dust respawns continuously (max 15 on map)
- **Objective:** Accumulate the highest score possible
- **Session End:** Player quits manually

### Scoring System (A* Distance Based)

| Distance from Dock | Time Bonus | Points |
|--------------------|------------|--------|
| Close (< 10 units) | +2 sec | 100 |
| Medium (10-25 units) | +5 sec | 250 |
| Far (25-40 units) | +8 sec | 500 |
| Very Far (> 40 units) | +12 sec | 1000 |

Points and time are calculated per dust bunny based on where it was picked up.

---

## Technical Design

### Project Structure

```
src/
├── main.ts                 # Entry point
├── game/
│   ├── Game.ts            # Main game controller
│   ├── GameState.ts       # State machine (menu/playing/paused/gameover)
│   └── modes/
│       ├── TimeAttackMode.ts
│       └── EndlessMode.ts
├── world/
│   ├── House.ts           # House layout & room management
│   ├── Room.ts            # Individual room with obstacles
│   ├── Obstacle.ts        # Furniture, shoes, etc.
│   └── NavigationGrid.ts  # A* grid for pathfinding
├── entities/
│   ├── Roomba.ts          # Player-controlled roomba
│   ├── DustBunny.ts       # Collectible dust
│   ├── ChargingDock.ts    # Deposit point
│   └── DustSpawner.ts     # Procedural dust placement with A* scoring
├── systems/
│   ├── PhysicsSystem.ts   # Collision & bounce handling
│   ├── InputSystem.ts     # Keyboard, mouse, touch unified input
│   ├── ScoreSystem.ts     # Points & time calculations
│   └── AudioSystem.ts     # MIDI playback & SFX
├── ui/
│   ├── HUD.ts             # Timer, score, bin capacity
│   ├── MainMenu.ts        # Mode selection
│   ├── Leaderboard.ts     # Local high scores
│   └── TouchControls.ts   # Virtual joystick overlay
└── utils/
    ├── PathfindingUtils.ts # A* distance calculations
    └── MathUtils.ts
```

### House Layout

```
┌─────────────┬─────────────┐
│   BEDROOM   │  BATHROOM   │
│             │             │
├──────┐ ┌────┼──────┐ ┌────┤
│      │ │    │      │ │    │
│ LIVING ROOM │   KITCHEN   │
│    [DOCK]   │             │
│             │             │
└─────────────┴─────────────┘
```

- **4 rooms** connected by doorways
- Each room approximately 10x10 units
- Charging dock fixed in living room
- Obstacles placed procedurally within each room

### Navigation Grid

- Overlaid on entire house for A* pathfinding
- Cell size: 0.5 units
- Used to calculate path distance for scoring
- Obstacles marked as non-walkable cells

### Roomba Specifications

| Property | Value |
|----------|-------|
| Movement Speed | 5 units/sec |
| Turn Speed | 180°/sec |
| Bin Capacity | 5 dust bunnies |
| Collision Response | 50% velocity reflection (bounce) |
| Collider Shape | Cylinder |

### Camera

- **Type:** Third-person follow camera
- **Position:** Behind and above the roomba
- **Behavior:** Smooth follow with slight lag for game feel

### Controls

#### Keyboard
- **WASD / Arrow Keys:** Movement (forward/back/turn)
- **Space:** Pause menu

#### Mouse
- **Click & Drag:** Direction control (optional alternative)

#### Touch (Mobile)
- **Virtual Joystick:** Bottom-left of screen
- **Pause Button:** Top-right corner

### Bin Capacity Display

- Small 3D bar floating above the roomba
- Fills up as dust is collected (0-5 segments)
- Color changes: Green → Yellow → Red as it fills
- Empties on dock deposit

### Collision System

- Babylon.js physics engine (Havok preferred, Ammo.js fallback)
- Roomba bounces off obstacles and walls
- No damage/penalty for collisions (just physics response)
- Obstacles are static, roomba is dynamic

### Dust Spawner (A* Algorithm)

1. Generate random position in walkable area
2. Validate position is not inside obstacle
3. Calculate A* path from spawn point to dock
4. Assign point/time value based on path length
5. Instantiate dust bunny with stored reward values

**Endless Mode Respawning:**
- Maximum 15 dust bunnies on map at once
- New dust spawns when count drops below threshold
- Spawn locations weighted toward rooms with fewer dust

### Auto-Deposit Mechanic

- Trigger zone around charging dock (radius: 1.5 units)
- When roomba enters zone with dust in bin:
  - All dust automatically deposited
  - Points awarded (sum of all collected dust values)
  - Time added (Time Attack mode only)
  - Bin capacity reset to 0
  - Visual/audio feedback plays

---

## Visual Design (Low-Poly Prototype)

### Assets

| Object | Description |
|--------|-------------|
| Roomba | Flat cylinder, dark gray, small LED indicator light |
| Dust Bunny | Fuzzy gray sphere with subtle particle effect |
| Charging Dock | Small platform with glowing ring indicator |
| Couch | Rectangular box with cushion indents |
| Table | Flat top with cylinder legs |
| Chairs | Simple box seats with back |
| Bed | Large rectangular prism with pillow bump |
| Shoes | Paired low boxes scattered randomly |
| Toilet/Sink | Simple geometric bathroom fixtures |
| Kitchen Counter | L-shaped box formation |

### Materials

- Flat shaded / low-poly aesthetic
- Distinct colors per room for visual navigation:
  - Living Room: Warm beige floor
  - Kitchen: Tile pattern (checkerboard)
  - Bedroom: Carpet texture (soft blue)
  - Bathroom: White tile

### Lighting

- Single directional light (sun through windows)
- Ambient light for shadow fill
- Emissive materials on dock and dust for visibility

---

## Audio Design

### Music

- **Track:** "All I Want" by The Offspring (MIDI version)
- **Playback:** Tone.js MIDI player
- **Loop:** Continuous during gameplay
- **Note:** Personal use only (not for public distribution)

### Sound Effects

| Event | Sound |
|-------|-------|
| Dust Pickup | Soft "whoosh" vacuum sound |
| Dock Deposit | Satisfying "cha-ching" or beep |
| Collision | Soft bump/thud |
| Low Time Warning | Urgent beeping (< 10 seconds) |
| Game Over | Descending tone |
| Mode Start | Upbeat jingle |

---

## UI Design

### Main Menu

```
┌────────────────────────────┐
│                            │
│      🤖 CRAZY ROOMBA 🤖     │
│                            │
│      [ TIME ATTACK ]       │
│      [   ENDLESS   ]       │
│      [ LEADERBOARD ]       │
│                            │
└────────────────────────────┘
```

### HUD (During Gameplay)

```
┌────────────────────────────────────────┐
│ TIME: 00:45      SCORE: 12,500    [⏸] │
│                                        │
│                                        │
│                                        │
│                                        │
│                                        │
│                                        │
│  ┌───┐                                 │
│  │ 🕹 │  (touch joystick area)         │
│  └───┘                                 │
└────────────────────────────────────────┘
```

- Timer (top-left, hidden in Endless mode)
- Score (top-center)
- Pause button (top-right)
- Touch joystick (bottom-left, mobile only)
- Bin capacity shown on roomba in 3D

### Game Over Screen

```
┌────────────────────────────┐
│                            │
│        GAME OVER!          │
│                            │
│     SCORE: 25,000          │
│     NEW HIGH SCORE!        │
│                            │
│   Enter Name: A A A        │
│              ↑             │
│                            │
│      [ PLAY AGAIN ]        │
│      [ MAIN MENU  ]        │
│                            │
└────────────────────────────┘
```

- 3-character arcade-style name entry
- Shows if new high score achieved
- Options to replay or return to menu

### Leaderboard

```
┌────────────────────────────┐
│       LEADERBOARD          │
│    [ TIME ATTACK | ENDLESS ]│
│                            │
│  1. AAA .......... 50,000  │
│  2. BBB .......... 42,000  │
│  3. CCC .......... 38,500  │
│  ...                       │
│ 10. JJJ .......... 12,000  │
│                            │
│       [ BACK ]             │
└────────────────────────────┘
```

- Toggle between modes
- Top 10 scores displayed
- Stored in localStorage

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Initialize project (Vite + Babylon.js + TypeScript)
- [ ] Create basic scene with lighting and camera
- [ ] Build house geometry (4 rooms with walls and doorways)
- [ ] Implement third-person follow camera
- [ ] Generate navigation grid for A* pathfinding

### Phase 2: Core Gameplay
- [ ] Create roomba model with movement physics
- [ ] Implement keyboard and touch input handling
- [ ] Add collision detection with bounce response
- [ ] Create charging dock with trigger zone
- [ ] Build dust bunny entity with pickup mechanics
- [ ] Implement A* dust spawner with distance-based scoring
- [ ] Add auto-deposit at dock with reward calculation

### Phase 3: Game Modes & State
- [ ] Create game state machine (menu/playing/paused/gameover)
- [ ] Implement Time Attack mode (timer, time bonuses)
- [ ] Implement Endless mode (infinite respawning dust)
- [ ] Add bin capacity system with 3D bar indicator
- [ ] Build score tracking system

### Phase 4: User Interface
- [ ] Create main menu with mode selection
- [ ] Build HUD (timer, score display)
- [ ] Implement touch controls (virtual joystick)
- [ ] Create game over screen with name entry
- [ ] Build leaderboard with localStorage persistence
- [ ] Add pause menu functionality

### Phase 5: Audio & Polish
- [ ] Integrate Tone.js for MIDI playback
- [ ] Add "All I Want" MIDI track
- [ ] Implement sound effects
- [ ] Add particle effects (dust collection, deposit)
- [ ] Create obstacle variety (furniture assets)
- [ ] Add visual feedback (low time warning, score popups)
- [ ] Performance optimization and testing

---

## Data Structures

### Leaderboard (localStorage)

```json
{
  "crazyRoomba": {
    "timeAttack": [
      { "name": "AAA", "score": 50000, "date": "2025-01-10" },
      { "name": "BBB", "score": 42000, "date": "2025-01-09" }
    ],
    "endless": [
      { "name": "CCC", "score": 125000, "date": "2025-01-10" }
    ]
  }
}
```

### Dust Bunny Data

```typescript
interface DustBunny {
  id: string;
  position: Vector3;
  pathDistanceToDock: number;
  pointValue: number;
  timeValue: number;
  collected: boolean;
  collectedBy?: string; // roomba id if multiplayer later
}
```

### Game State

```typescript
interface GameState {
  mode: 'timeAttack' | 'endless';
  status: 'menu' | 'playing' | 'paused' | 'gameOver';
  score: number;
  timeRemaining: number; // seconds, only for timeAttack
  binContents: DustBunny[];
  binCapacity: number; // max 5
  totalDustDeposited: number;
}
```

---

## Future Enhancements (Post-Prototype)

- [ ] Multiple house layouts / procedural generation
- [ ] Power-ups (speed boost, vacuum range, time freeze)
- [ ] Hazards (pet that chases roomba, water spills)
- [ ] Multiplayer (local split-screen or online)
- [ ] Achievements system
- [ ] Daily challenges
- [ ] Custom roomba skins
- [ ] Online leaderboard integration
