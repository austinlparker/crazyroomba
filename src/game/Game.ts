import {
  Engine,
  Scene,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  Color3,
  Color4,
  ShadowGenerator,
} from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { GameState, GameStatus, GameMode } from './GameState';
import { House } from '../world/House';
import { NavigationGrid } from '../world/NavigationGrid';
import { Roomba } from '../entities/Roomba';
import { ChargingDock } from '../entities/ChargingDock';
import { DustSpawner } from '../entities/DustSpawner';
import { InputSystem } from '../systems/InputSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { HUD } from '../ui/HUD';
import { MainMenu } from '../ui/MainMenu';
import { Leaderboard } from '../ui/Leaderboard';
import { TouchControls } from '../ui/TouchControls';
import { ThirdPersonCamera } from './ThirdPersonCamera';

export class Game {
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene: Scene;
  private shadowGenerator: ShadowGenerator | null = null;

  // Game systems
  private gameState: GameState;
  private inputSystem: InputSystem;
  private scoreSystem: ScoreSystem;
  private audioSystem: AudioSystem;

  // World
  private house: House;
  private navigationGrid: NavigationGrid;

  // Entities
  private roomba: Roomba;
  private chargingDock: ChargingDock;
  private dustSpawner: DustSpawner;

  // Camera
  private thirdPersonCamera: ThirdPersonCamera;

  // UI
  private hud: HUD;
  private mainMenu: MainMenu;
  private leaderboard: Leaderboard;
  private touchControls: TouchControls;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);

    // Initialize game state
    this.gameState = new GameState();

    // Initialize systems (will be properly set up in initialize())
    this.inputSystem = null!;
    this.scoreSystem = null!;
    this.audioSystem = null!;

    // World components
    this.house = null!;
    this.navigationGrid = null!;

    // Entities
    this.roomba = null!;
    this.chargingDock = null!;
    this.dustSpawner = null!;

    // Camera
    this.thirdPersonCamera = null!;

    // UI
    this.hud = null!;
    this.mainMenu = null!;
    this.leaderboard = null!;
    this.touchControls = null!;
  }

  async initialize(): Promise<void> {
    console.log('Initializing physics...');

    // Initialize physics with error handling
    try {
      const havokInstance = await HavokPhysics();
      console.log('Havok WASM loaded successfully');
      const havokPlugin = new HavokPlugin(true, havokInstance);
      this.scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin);
      console.log('Physics enabled');
    } catch (error) {
      console.error('Failed to initialize Havok physics:', error);
      throw new Error(`Physics initialization failed: ${error}`);
    }

    // Set up lighting
    console.log('Setting up lighting...');
    this.setupLighting();

    // Create world
    console.log('Creating house...');
    this.house = new House(this.scene);
    this.house.create();
    console.log('House created');

    // Generate navigation grid based on house layout
    this.navigationGrid = new NavigationGrid(this.house);
    this.navigationGrid.generate();

    // Create charging dock in living room corner (against wall, realistic positioning)
    this.chargingDock = new ChargingDock(this.scene, new Vector3(-6.5, 0, -6.6));
    this.chargingDock.create();

    // Create roomba at dock position (in front of dock)
    this.roomba = new Roomba(this.scene, new Vector3(-6.5, 0.05, -6.0));
    await this.roomba.create();

    // Pass collidable meshes to roomba for collision detection
    const collidableMeshes = [
      ...this.house.getObstacleMeshes(),
      ...this.house.getWallMeshes(),
    ];
    this.roomba.setCollidableMeshes(collidableMeshes);

    // Set up third-person camera
    this.thirdPersonCamera = new ThirdPersonCamera(this.scene, this.canvas, this.roomba);
    // Pass wall meshes for camera collision detection
    this.thirdPersonCamera.setWallMeshes(this.house.getWallMeshes());

    // Create dust spawner
    this.dustSpawner = new DustSpawner(
      this.scene,
      this.navigationGrid,
      this.chargingDock.getPosition()
    );

    // Initialize systems
    this.inputSystem = new InputSystem(this.scene, this.canvas);
    this.scoreSystem = new ScoreSystem(this.gameState);
    this.audioSystem = new AudioSystem();

    // Initialize UI
    this.hud = new HUD(this.gameState);
    this.mainMenu = new MainMenu(
      (mode: GameMode) => this.startGame(mode),
      () => this.showLeaderboard()
    );
    this.leaderboard = new Leaderboard(() => this.showMainMenu());
    this.touchControls = new TouchControls(this.canvas);

    // Add shadow caster
    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(this.roomba.getMesh());
    }

    // Set up game loop logic
    this.scene.onBeforeRenderObservable.add(() => {
      this.update();
    });

    // Show main menu
    this.showMainMenu();
  }

  private setupLighting(): void {
    // Ambient light
    const ambient = new HemisphericLight(
      'ambient',
      new Vector3(0, 1, 0),
      this.scene
    );
    ambient.intensity = 0.4;
    ambient.groundColor = new Color3(0.2, 0.2, 0.25);

    // Main directional light (sun)
    const sun = new DirectionalLight(
      'sun',
      new Vector3(-1, -2, -1).normalize(),
      this.scene
    );
    sun.intensity = 0.8;
    sun.position = new Vector3(10, 20, 10);

    // Shadow generator
    this.shadowGenerator = new ShadowGenerator(1024, sun);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 32;
  }

  private update(): void {
    if (this.gameState.status !== GameStatus.Playing) {
      return;
    }

    const deltaTime = this.engine.getDeltaTime() / 1000;

    // Get input from keyboard and touch
    const input = this.inputSystem.getInput();
    const touchInput = this.touchControls.getInput();

    // Combine inputs: touch overrides keyboard if active, otherwise add them
    const finalInput = {
      forward: touchInput.active ? touchInput.forward : input.forward,
      turn: touchInput.active ? touchInput.turn : input.turn,
      active: touchInput.active || input.active,
    };

    // Update roomba with twin-stick controls
    this.roomba.update(deltaTime, finalInput);

    // Update camera (auto-follow, no manual input needed)
    this.thirdPersonCamera.update(deltaTime);

    // Check for dust collection
    const collectedDust = this.dustSpawner.checkCollection(
      this.roomba.getPosition(),
      this.roomba.getCollectionRadius()
    );

    for (const dust of collectedDust) {
      if (this.roomba.canCollect()) {
        this.roomba.collectDust(dust);
        this.dustSpawner.removeDust(dust);
        // Queue a replacement dust bunny to spawn
        this.dustSpawner.queueRespawn();
      }
    }

    // Check for dock deposit
    if (this.chargingDock.isInRange(this.roomba.getPosition())) {
      const deposited = this.roomba.depositDust();
      if (deposited.length > 0) {
        this.scoreSystem.addDeposit(deposited);
        this.chargingDock.playDepositEffect();
        this.audioSystem.playDeposit();
      }
    }

    // Update dust spawner (respawn in endless mode)
    this.dustSpawner.update(this.gameState.mode === GameMode.Endless);

    // Update timer (Time Attack mode)
    if (this.gameState.mode === GameMode.TimeAttack) {
      this.gameState.timeRemaining -= deltaTime;

      // Low time warning
      if (this.gameState.timeRemaining <= 10 && this.gameState.timeRemaining > 0) {
        this.audioSystem.playLowTimeWarning();
      }

      // Game over check
      if (this.gameState.timeRemaining <= 0) {
        this.gameState.timeRemaining = 0;
        this.endGame();
      }
    }

    // Update HUD
    this.hud.update(this.roomba.getBinCount(), this.roomba.getBinCapacity());

    // Update dust spawner visualization
    this.dustSpawner.updateVisuals(deltaTime);
  }

  private startGame(mode: GameMode): void {
    this.gameState.reset(mode);
    this.roomba.reset(new Vector3(-10, 0.1, -8));
    this.dustSpawner.reset();

    // Spawn initial dust
    this.dustSpawner.spawnInitialDust(mode === GameMode.Endless ? 15 : 10);

    // Hide menu, show HUD
    this.mainMenu.hide();
    this.leaderboard.hide();
    this.hud.show();
    this.touchControls.show();

    // Start music
    this.audioSystem.startMusic();

    this.gameState.status = GameStatus.Playing;
  }

  private endGame(): void {
    this.gameState.status = GameStatus.GameOver;
    this.audioSystem.stopMusic();
    this.audioSystem.playGameOver();

    // Check for high score
    const isHighScore = this.leaderboard.isHighScore(
      this.gameState.mode,
      this.gameState.score
    );

    // Show game over UI
    this.hud.showGameOver(this.gameState.score, isHighScore, (name: string) => {
      if (isHighScore) {
        this.leaderboard.addScore(this.gameState.mode, name, this.gameState.score);
      }
      this.showMainMenu();
    });

    this.touchControls.hide();
  }

  private showMainMenu(): void {
    this.gameState.status = GameStatus.Menu;
    this.hud.hide();
    this.leaderboard.hide();
    this.mainMenu.show();
    this.touchControls.hide();
  }

  private showLeaderboard(): void {
    this.mainMenu.hide();
    this.leaderboard.show();
  }

  pauseGame(): void {
    if (this.gameState.status === GameStatus.Playing) {
      this.gameState.status = GameStatus.Paused;
      this.audioSystem.pauseMusic();
      this.hud.showPauseMenu(
        () => this.resumeGame(),
        () => this.showMainMenu()
      );
    }
  }

  resumeGame(): void {
    if (this.gameState.status === GameStatus.Paused) {
      this.gameState.status = GameStatus.Playing;
      this.audioSystem.resumeMusic();
      this.hud.hidePauseMenu();
    }
  }

  start(): void {
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }

  resize(): void {
    this.engine.resize();
  }

  dispose(): void {
    this.audioSystem.dispose();
    this.engine.dispose();
  }
}
