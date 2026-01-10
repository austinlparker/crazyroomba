import { GameState, GameMode } from '../game/GameState';

export class HUD {
  private gameState: GameState;
  private container: HTMLDivElement;
  private timerElement: HTMLSpanElement;
  private scoreElement: HTMLSpanElement;
  private binElement: HTMLSpanElement;
  private pauseButton: HTMLButtonElement;
  private pauseMenu: HTMLDivElement | null = null;
  private gameOverScreen: HTMLDivElement | null = null;

  private onPauseCallback: (() => void) | null = null;
  private onResumeCallback: (() => void) | null = null;
  private onQuitCallback: (() => void) | null = null;

  constructor(gameState: GameState) {
    this.gameState = gameState;
    this.container = this.createContainer();
    this.timerElement = null!;
    this.scoreElement = null!;
    this.binElement = null!;
    this.pauseButton = null!;
    this.createHUD();
  }

  private createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'hud-container';
    container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      z-index: 10;
      display: none;
    `;
    document.body.appendChild(container);
    return container;
  }

  private createHUD(): void {
    // Top bar
    const topBar = document.createElement('div');
    topBar.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 20px;
      background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent);
    `;

    // Timer
    const timerContainer = document.createElement('div');
    timerContainer.style.cssText = `
      color: white;
      font-size: 1.5rem;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
    `;
    timerContainer.innerHTML = 'TIME: <span id="timer">01:00</span>';
    this.timerElement = timerContainer.querySelector('#timer')!;

    // Score
    const scoreContainer = document.createElement('div');
    scoreContainer.style.cssText = `
      color: white;
      font-size: 1.5rem;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
    `;
    scoreContainer.innerHTML = 'SCORE: <span id="score">0</span>';
    this.scoreElement = scoreContainer.querySelector('#score')!;

    // Bin indicator
    const binContainer = document.createElement('div');
    binContainer.style.cssText = `
      color: white;
      font-size: 1.2rem;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
    `;
    binContainer.innerHTML = 'BIN: <span id="bin">0/5</span>';
    this.binElement = binContainer.querySelector('#bin')!;

    // Pause button
    this.pauseButton = document.createElement('button');
    this.pauseButton.textContent = '⏸';
    this.pauseButton.style.cssText = `
      pointer-events: auto;
      background: rgba(255,255,255,0.2);
      border: 2px solid white;
      border-radius: 8px;
      color: white;
      font-size: 1.5rem;
      width: 50px;
      height: 50px;
      cursor: pointer;
      transition: background 0.2s;
    `;
    this.pauseButton.addEventListener('mouseenter', () => {
      this.pauseButton.style.background = 'rgba(255,255,255,0.3)';
    });
    this.pauseButton.addEventListener('mouseleave', () => {
      this.pauseButton.style.background = 'rgba(255,255,255,0.2)';
    });
    this.pauseButton.addEventListener('click', () => {
      if (this.onPauseCallback) this.onPauseCallback();
    });

    topBar.appendChild(timerContainer);
    topBar.appendChild(scoreContainer);
    topBar.appendChild(binContainer);
    topBar.appendChild(this.pauseButton);

    this.container.appendChild(topBar);
  }

  update(binCount: number, binCapacity: number): void {
    // Update timer
    if (this.gameState.mode === GameMode.TimeAttack) {
      const time = Math.max(0, Math.ceil(this.gameState.timeRemaining));
      const minutes = Math.floor(time / 60);
      const seconds = time % 60;
      this.timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

      // Flash red when low on time
      if (time <= 10) {
        this.timerElement.style.color = time % 2 === 0 ? '#ff4444' : '#ffffff';
      } else {
        this.timerElement.style.color = '#ffffff';
      }
    } else {
      this.timerElement.parentElement!.style.display = 'none';
    }

    // Update score
    this.scoreElement.textContent = this.gameState.score.toLocaleString();

    // Update bin
    this.binElement.textContent = `${binCount}/${binCapacity}`;
    if (binCount >= binCapacity) {
      this.binElement.style.color = '#ff4444';
    } else if (binCount >= binCapacity - 1) {
      this.binElement.style.color = '#ffaa00';
    } else {
      this.binElement.style.color = '#ffffff';
    }
  }

  show(): void {
    this.container.style.display = 'block';
    this.timerElement.parentElement!.style.display = 'block';
  }

  hide(): void {
    this.container.style.display = 'none';
    this.hidePauseMenu();
    this.hideGameOver();
  }

  showPauseMenu(onResume: () => void, onQuit: () => void): void {
    this.onResumeCallback = onResume;
    this.onQuitCallback = onQuit;

    if (this.pauseMenu) return;

    this.pauseMenu = document.createElement('div');
    this.pauseMenu.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      pointer-events: auto;
    `;

    const title = document.createElement('h1');
    title.textContent = 'PAUSED';
    title.style.cssText = `
      color: white;
      font-size: 3rem;
      margin-bottom: 2rem;
    `;

    const resumeBtn = this.createMenuButton('RESUME', () => {
      if (this.onResumeCallback) this.onResumeCallback();
    });

    const quitBtn = this.createMenuButton('QUIT TO MENU', () => {
      if (this.onQuitCallback) this.onQuitCallback();
    });

    this.pauseMenu.appendChild(title);
    this.pauseMenu.appendChild(resumeBtn);
    this.pauseMenu.appendChild(quitBtn);

    this.container.appendChild(this.pauseMenu);
  }

  hidePauseMenu(): void {
    if (this.pauseMenu) {
      this.pauseMenu.remove();
      this.pauseMenu = null;
    }
  }

  showGameOver(
    score: number,
    isHighScore: boolean,
    onSubmit: (name: string) => void
  ): void {
    this.hideGameOver();

    this.gameOverScreen = document.createElement('div');
    this.gameOverScreen.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      pointer-events: auto;
    `;

    const title = document.createElement('h1');
    title.textContent = 'GAME OVER';
    title.style.cssText = `
      color: #ff6b6b;
      font-size: 3rem;
      margin-bottom: 1rem;
    `;

    const scoreText = document.createElement('p');
    scoreText.textContent = `SCORE: ${score.toLocaleString()}`;
    scoreText.style.cssText = `
      color: white;
      font-size: 2rem;
      margin-bottom: 1rem;
    `;

    this.gameOverScreen.appendChild(title);
    this.gameOverScreen.appendChild(scoreText);

    if (isHighScore) {
      const highScoreText = document.createElement('p');
      highScoreText.textContent = 'NEW HIGH SCORE!';
      highScoreText.style.cssText = `
        color: #4ecca3;
        font-size: 1.5rem;
        margin-bottom: 1rem;
      `;
      this.gameOverScreen.appendChild(highScoreText);

      // Name entry
      const nameEntry = this.createNameEntry((name) => {
        onSubmit(name);
      });
      this.gameOverScreen.appendChild(nameEntry);
    } else {
      const continueBtn = this.createMenuButton('CONTINUE', () => {
        onSubmit('');
      });
      this.gameOverScreen.appendChild(continueBtn);
    }

    this.container.appendChild(this.gameOverScreen);
  }

  private createNameEntry(onSubmit: (name: string) => void): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 1rem;
    `;

    const label = document.createElement('p');
    label.textContent = 'ENTER YOUR NAME:';
    label.style.cssText = `
      color: white;
      font-size: 1.2rem;
      margin-bottom: 0.5rem;
    `;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 3;
    input.value = 'AAA';
    input.style.cssText = `
      background: rgba(255,255,255,0.1);
      border: 2px solid #4ecca3;
      border-radius: 8px;
      color: white;
      font-size: 2rem;
      text-align: center;
      width: 100px;
      padding: 10px;
      text-transform: uppercase;
      letter-spacing: 0.3em;
    `;

    const submitBtn = this.createMenuButton('SUBMIT', () => {
      const name = input.value.toUpperCase().padEnd(3, 'A').substring(0, 3);
      onSubmit(name);
    });
    submitBtn.style.marginTop = '1rem';

    container.appendChild(label);
    container.appendChild(input);
    container.appendChild(submitBtn);

    // Auto-focus and select
    setTimeout(() => input.focus(), 100);

    return container;
  }

  hideGameOver(): void {
    if (this.gameOverScreen) {
      this.gameOverScreen.remove();
      this.gameOverScreen = null;
    }
  }

  private createMenuButton(text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      background: linear-gradient(to bottom, #4ecca3, #3db892);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 1.2rem;
      font-weight: bold;
      padding: 15px 40px;
      margin: 10px;
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.1s;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
      button.style.boxShadow = '0 6px 10px rgba(0,0,0,0.4)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
    });

    button.addEventListener('click', onClick);

    return button;
  }

  setPauseCallback(callback: () => void): void {
    this.onPauseCallback = callback;
  }
}
