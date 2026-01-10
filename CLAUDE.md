# Claude.md - Development Guide for Crazy Roomba

## Project Overview

Crazy Roomba is a browser-based 3D game inspired by Crazy Taxi. Players control a roomba navigating a house, collecting dust bunnies and returning them to a charging dock for points and time bonuses.

**Tech Stack:**
- **Engine:** Babylon.js 7.x with Havok physics
- **Language:** TypeScript
- **Build:** Vite
- **Audio:** Tone.js (synthesized music and SFX)
- **Pathfinding:** pathfinding.js (A* algorithm)

## Development Setup

```bash
# Install dependencies
npm install

# Start development server (hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The dev server runs at `http://localhost:5173`.

## Project Structure

```
src/
├── main.ts                    # Entry point
├── game/
│   ├── Game.ts               # Main game controller, orchestrates all systems
│   ├── GameState.ts          # State machine (menu/playing/paused/gameover)
│   └── ThirdPersonCamera.ts  # Camera that follows the roomba
├── world/
│   ├── House.ts              # 4-room house layout with furniture obstacles
│   └── NavigationGrid.ts     # A* pathfinding grid for dust spawning
├── entities/
│   ├── Roomba.ts             # Player entity with physics and bin capacity
│   ├── DustBunny.ts          # Collectible dust with particle effects
│   ├── ChargingDock.ts       # Deposit point with glow effects
│   └── DustSpawner.ts        # Procedural spawner using A* for scoring
├── systems/
│   ├── InputSystem.ts        # Keyboard input handling
│   ├── ScoreSystem.ts        # Points and time calculations
│   └── AudioSystem.ts        # Tone.js music and sound effects
├── ui/
│   ├── HUD.ts                # In-game UI (timer, score, pause menu)
│   ├── MainMenu.ts           # Mode selection screen
│   ├── Leaderboard.ts        # localStorage-based high scores
│   └── TouchControls.ts      # Virtual joystick for mobile
└── types/
    └── pathfinding.d.ts      # Type definitions for pathfinding library
```

## Key Concepts

### A* Dust Spawning
Dust bunnies spawn at random walkable positions. The `NavigationGrid` calculates the A* path distance from each spawn point to the charging dock. Rewards scale with distance:
- Close (<10 units): 100 points, +2 seconds
- Medium (10-25): 250 points, +5 seconds
- Far (25-40): 500 points, +8 seconds
- Very Far (>40): 1000 points, +12 seconds

### Physics
The roomba uses Babylon.js Havok physics. Collisions with walls and furniture cause bounce responses (50% velocity reflection).

### Game Modes
- **Time Attack:** Start with 60 seconds, earn time by depositing dust
- **Endless:** No timer, dust respawns infinitely (max 15 on map)

## Testing

### Manual Testing Checklist

**Core Gameplay:**
- [ ] Roomba moves with WASD/arrow keys
- [ ] Roomba bounces off walls and furniture
- [ ] Dust bunnies can be collected (max 5 in bin)
- [ ] Auto-deposit works when entering dock zone
- [ ] Bin capacity bar updates correctly (green → yellow → red)

**Time Attack Mode:**
- [ ] Timer starts at 60 seconds
- [ ] Timer decreases during gameplay
- [ ] Depositing dust adds time based on distance
- [ ] Game ends when timer reaches 0
- [ ] Game over screen shows score and name entry

**Endless Mode:**
- [ ] No timer displayed
- [ ] Dust respawns after collection
- [ ] Score accumulates indefinitely

**UI/UX:**
- [ ] Main menu displays correctly
- [ ] Pause menu works (ESC or pause button)
- [ ] Leaderboard saves and displays scores
- [ ] Touch controls work on mobile (if applicable)

**Audio:**
- [ ] Music plays during gameplay
- [ ] Sound effects for pickup, deposit, collision
- [ ] Low time warning beeps when <10 seconds

### Browser Testing
Test in multiple browsers:
- Chrome (primary)
- Firefox
- Safari
- Mobile browsers (touch controls)

## PR-Based Workflow

### Branch Naming
Create feature branches with descriptive names:
```
feature/add-power-ups
fix/collision-detection-bug
refactor/audio-system
```

### Making Changes

1. **Create a branch** from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and test locally with `npm run dev`

3. **Verify the build passes**:
   ```bash
   npm run build
   ```

4. **Commit with clear messages**:
   ```bash
   git add .
   git commit -m "Add power-up system with speed boost and time freeze"
   ```

5. **Push and create PR**:
   ```bash
   git push -u origin feature/your-feature-name
   ```
   Then create a PR on GitHub.

### PR Description Template
```markdown
## Summary
Brief description of what this PR does.

## Changes
- List of specific changes made
- Another change

## Testing
- [ ] Tested locally with `npm run dev`
- [ ] Build passes with `npm run build`
- [ ] Manual testing completed (list scenarios)

## Screenshots
(If UI changes, include before/after screenshots)
```

### Code Review Guidelines
- Ensure TypeScript compiles without errors
- Check for console errors in browser dev tools
- Verify physics interactions feel correct
- Test both game modes if gameplay is affected

## Deployment

The game auto-deploys to GitHub Pages on push to `main` via GitHub Actions.

**Live URL:** https://austinlparker.github.io/crazyroomba/

To manually trigger a deploy, go to Actions → "Deploy to GitHub Pages" → "Run workflow".

## Common Tasks

### Adding a New Obstacle Type
1. Add obstacle definition in `src/world/House.ts` in the room's `obstacles` array
2. Ensure it has proper collision shape (`box` or `cylinder`)
3. The navigation grid automatically marks it as non-walkable

### Adding a New Sound Effect
1. Create a new synth or sampler in `src/systems/AudioSystem.ts`
2. Add a play method (e.g., `playNewSound()`)
3. Call it from the appropriate game event in `src/game/Game.ts`

### Modifying Scoring
Edit `src/entities/DustSpawner.ts` in the `calculateRewards()` method to adjust point/time values based on path distance.

### Adding UI Elements
1. Create HTML elements in the appropriate UI class (`src/ui/`)
2. Use inline styles for consistency with existing UI
3. Manage visibility with `show()` and `hide()` methods

## Troubleshooting

### "Cannot find module '@babylonjs/havok'"
Run `npm install` to ensure Havok physics engine is installed.

### Physics not working
Ensure the scene has physics enabled. Check `Game.ts` for the Havok initialization.

### Touch controls not showing
Touch controls only appear on devices with touch capability. Test on mobile or use browser dev tools to emulate touch.

### Build fails with type errors
Run `npx tsc --noEmit` to see detailed TypeScript errors before building.
