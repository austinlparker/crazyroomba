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
      font-family: 'Press Start 2P', cursive;
      z-index: 10;
      display: none;
    `;
    document.body.appendChild(container);
    return container;
  }

  private createHUD(): void {
    // Top bar with arcade panel styling
    const topBar = document.createElement('div');
    topBar.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 15px 20px;
      background: linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.3), transparent);
    `;

    // Timer panel (LED style)
    const timerContainer = document.createElement('div');
    timerContainer.style.cssText = `
      background: #111;
      border: 3px solid #00ffff;
      border-radius: 4px;
      padding: 8px 15px;
      box-shadow:
        0 0 10px rgba(0, 255, 255, 0.3),
        inset 0 0 20px rgba(0, 0, 0, 0.8);
    `;
    timerContainer.innerHTML = `
      <div style="
        color: #00ffff;
        font-size: 0.5rem;
        margin-bottom: 4px;
        text-shadow: 0 0 5px #00ffff;
      ">TIME</div>
      <span id="timer" style="
        color: #00ff66;
        font-size: 1.2rem;
        text-shadow:
          0 0 10px #00ff66,
          0 0 20px #00ff66;
        letter-spacing: 2px;
      ">01:00</span>
    `;
    this.timerElement = timerContainer.querySelector('#timer')!;

    // Score panel (LED style)
    const scoreContainer = document.createElement('div');
    scoreContainer.style.cssText = `
      background: #111;
      border: 3px solid #ffcc00;
      border-radius: 4px;
      padding: 8px 15px;
      box-shadow:
        0 0 10px rgba(255, 204, 0, 0.3),
        inset 0 0 20px rgba(0, 0, 0, 0.8);
    `;
    scoreContainer.innerHTML = `
      <div style="
        color: #ffcc00;
        font-size: 0.5rem;
        margin-bottom: 4px;
        text-shadow: 0 0 5px #ffcc00;
      ">SCORE</div>
      <span id="score" style="
        color: #ffcc00;
        font-size: 1.2rem;
        text-shadow:
          0 0 10px #ffcc00,
          0 0 20px #ffcc00;
        letter-spacing: 2px;
      ">0</span>
    `;
    this.scoreElement = scoreContainer.querySelector('#score')!;

    // Bin indicator (LED bar style)
    const binContainer = document.createElement('div');
    binContainer.style.cssText = `
      background: #111;
      border: 3px solid #ff00ff;
      border-radius: 4px;
      padding: 8px 15px;
      box-shadow:
        0 0 10px rgba(255, 0, 255, 0.3),
        inset 0 0 20px rgba(0, 0, 0, 0.8);
    `;
    binContainer.innerHTML = `
      <div style="
        color: #ff00ff;
        font-size: 0.5rem;
        margin-bottom: 4px;
        text-shadow: 0 0 5px #ff00ff;
      ">DUST BIN</div>
      <span id="bin" style="
        color: #00ff66;
        font-size: 1rem;
        text-shadow:
          0 0 10px #00ff66,
          0 0 20px #00ff66;
        letter-spacing: 2px;
      ">0/5</span>
    `;
    this.binElement = binContainer.querySelector('#bin')!;

    // Pause button (arcade style)
    this.pauseButton = document.createElement('button');
    this.pauseButton.textContent = 'II';
    this.pauseButton.style.cssText = `
      pointer-events: auto;
      background: #111;
      border: 3px solid #ff3366;
      border-radius: 4px;
      color: #ff3366;
      font-family: 'Press Start 2P', cursive;
      font-size: 0.8rem;
      width: 50px;
      height: 50px;
      cursor: pointer;
      transition: all 0.1s;
      box-shadow:
        0 0 10px rgba(255, 51, 102, 0.3),
        inset 0 0 10px rgba(0, 0, 0, 0.5);
      text-shadow: 0 0 5px #ff3366;
    `;
    this.pauseButton.addEventListener('mouseenter', () => {
      this.pauseButton.style.background = '#ff336633';
      this.pauseButton.style.boxShadow = `
        0 0 20px rgba(255, 51, 102, 0.5),
        inset 0 0 15px rgba(0, 0, 0, 0.5)
      `;
    });
    this.pauseButton.addEventListener('mouseleave', () => {
      this.pauseButton.style.background = '#111';
      this.pauseButton.style.boxShadow = `
        0 0 10px rgba(255, 51, 102, 0.3),
        inset 0 0 10px rgba(0, 0, 0, 0.5)
      `;
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
        const flash = time % 2 === 0;
        this.timerElement.style.color = flash ? '#ff3366' : '#00ff66';
        this.timerElement.style.textShadow = flash
          ? '0 0 10px #ff3366, 0 0 20px #ff3366, 0 0 30px #ff3366'
          : '0 0 10px #00ff66, 0 0 20px #00ff66';
      } else {
        this.timerElement.style.color = '#00ff66';
        this.timerElement.style.textShadow = '0 0 10px #00ff66, 0 0 20px #00ff66';
      }
    } else {
      this.timerElement.parentElement!.parentElement!.style.display = 'none';
    }

    // Update score with arcade formatting
    this.scoreElement.textContent = this.gameState.score.toString().padStart(6, '0');

    // Update bin with color coding
    this.binElement.textContent = `${binCount}/${binCapacity}`;
    if (binCount >= binCapacity) {
      this.binElement.style.color = '#ff3366';
      this.binElement.style.textShadow = '0 0 10px #ff3366, 0 0 20px #ff3366, 0 0 30px #ff3366';
    } else if (binCount >= binCapacity - 1) {
      this.binElement.style.color = '#ffcc00';
      this.binElement.style.textShadow = '0 0 10px #ffcc00, 0 0 20px #ffcc00';
    } else {
      this.binElement.style.color = '#00ff66';
      this.binElement.style.textShadow = '0 0 10px #00ff66, 0 0 20px #00ff66';
    }
  }

  show(): void {
    this.container.style.display = 'block';
    this.timerElement.parentElement!.parentElement!.style.display = 'block';
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
      background: rgba(0,0,0,0.9);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      pointer-events: auto;
      font-family: 'Press Start 2P', cursive;
    `;

    // Arcade frame
    const frame = document.createElement('div');
    frame.style.cssText = `
      border: 4px solid #00ffff;
      border-radius: 8px;
      padding: 40px 60px;
      background: rgba(0, 0, 0, 0.8);
      box-shadow:
        0 0 30px rgba(0, 255, 255, 0.3),
        inset 0 0 30px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      align-items: center;
    `;

    const title = document.createElement('h1');
    title.textContent = 'PAUSED';
    title.style.cssText = `
      color: #ffcc00;
      font-size: 2rem;
      margin-bottom: 2rem;
      text-shadow:
        0 0 10px #ffcc00,
        0 0 20px #ffcc00,
        0 0 40px #ffcc00;
      animation: pausePulse 1s ease-in-out infinite;
    `;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pausePulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    `;
    document.head.appendChild(style);

    const resumeBtn = this.createArcadeButton('RESUME', '#00ff66', () => {
      if (this.onResumeCallback) this.onResumeCallback();
    });

    const quitBtn = this.createArcadeButton('QUIT', '#ff3366', () => {
      if (this.onQuitCallback) this.onQuitCallback();
    });

    frame.appendChild(title);
    frame.appendChild(resumeBtn);
    frame.appendChild(quitBtn);
    this.pauseMenu.appendChild(frame);

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
      background: rgba(0,0,0,0.95);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      pointer-events: auto;
      font-family: 'Press Start 2P', cursive;
    `;

    // Arcade frame
    const frame = document.createElement('div');
    frame.style.cssText = `
      border: 4px solid #ff3366;
      border-radius: 8px;
      padding: 40px 60px;
      background: rgba(0, 0, 0, 0.8);
      box-shadow:
        0 0 30px rgba(255, 51, 102, 0.3),
        inset 0 0 30px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      align-items: center;
    `;

    const title = document.createElement('h1');
    title.textContent = 'GAME OVER';
    title.style.cssText = `
      color: #ff3366;
      font-size: 2rem;
      margin-bottom: 1rem;
      text-shadow:
        0 0 10px #ff3366,
        0 0 20px #ff3366,
        0 0 40px #ff3366;
      animation: gameOverFlash 0.5s ease-in-out infinite;
    `;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes gameOverFlash {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.8; }
      }
    `;
    document.head.appendChild(style);

    const scoreText = document.createElement('p');
    scoreText.innerHTML = `FINAL SCORE<br><span style="font-size: 1.5rem; color: #ffcc00; text-shadow: 0 0 10px #ffcc00;">${score.toString().padStart(6, '0')}</span>`;
    scoreText.style.cssText = `
      color: #00ffff;
      font-size: 0.8rem;
      margin-bottom: 1.5rem;
      text-align: center;
      line-height: 2;
      text-shadow: 0 0 5px #00ffff;
    `;

    frame.appendChild(title);
    frame.appendChild(scoreText);

    if (isHighScore) {
      const highScoreText = document.createElement('p');
      highScoreText.textContent = 'NEW HIGH SCORE!';
      highScoreText.style.cssText = `
        color: #00ff66;
        font-size: 0.9rem;
        margin-bottom: 1.5rem;
        text-shadow:
          0 0 10px #00ff66,
          0 0 20px #00ff66;
        animation: highScoreBlink 0.3s step-end infinite;
      `;

      const blinkStyle = document.createElement('style');
      blinkStyle.textContent = `
        @keyframes highScoreBlink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `;
      document.head.appendChild(blinkStyle);

      frame.appendChild(highScoreText);

      // Name entry
      const nameEntry = this.createArcadeNameEntry((name) => {
        onSubmit(name);
      });
      frame.appendChild(nameEntry);
    } else {
      const continueBtn = this.createArcadeButton('CONTINUE', '#00ffff', () => {
        onSubmit('');
      });
      frame.appendChild(continueBtn);
    }

    this.gameOverScreen.appendChild(frame);
    this.container.appendChild(this.gameOverScreen);
  }

  private createArcadeNameEntry(onSubmit: (name: string) => void): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 1rem;
    `;

    const label = document.createElement('p');
    label.textContent = 'ENTER NAME';
    label.style.cssText = `
      color: #00ffff;
      font-size: 0.6rem;
      margin-bottom: 0.8rem;
      text-shadow: 0 0 5px #00ffff;
    `;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 3;
    input.value = 'AAA';
    input.style.cssText = `
      background: #111;
      border: 3px solid #00ff66;
      border-radius: 4px;
      color: #00ff66;
      font-family: 'Press Start 2P', cursive;
      font-size: 1.5rem;
      text-align: center;
      width: 120px;
      padding: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5em;
      text-shadow: 0 0 10px #00ff66;
      box-shadow:
        0 0 10px rgba(0, 255, 102, 0.3),
        inset 0 0 20px rgba(0, 0, 0, 0.8);
    `;

    input.addEventListener('focus', () => {
      input.style.boxShadow = `
        0 0 20px rgba(0, 255, 102, 0.5),
        inset 0 0 20px rgba(0, 0, 0, 0.8)
      `;
    });

    input.addEventListener('blur', () => {
      input.style.boxShadow = `
        0 0 10px rgba(0, 255, 102, 0.3),
        inset 0 0 20px rgba(0, 0, 0, 0.8)
      `;
    });

    const submitBtn = this.createArcadeButton('OK', '#ffcc00', () => {
      const name = input.value.toUpperCase().padEnd(3, 'A').substring(0, 3);
      onSubmit(name);
    });
    submitBtn.style.marginTop = '1rem';

    container.appendChild(label);
    container.appendChild(input);
    container.appendChild(submitBtn);

    // Auto-focus and select
    setTimeout(() => {
      input.focus();
      input.select();
    }, 100);

    return container;
  }

  hideGameOver(): void {
    if (this.gameOverScreen) {
      this.gameOverScreen.remove();
      this.gameOverScreen = null;
    }
  }

  private createArcadeButton(text: string, color: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      background: transparent;
      border: 3px solid ${color};
      border-radius: 4px;
      color: ${color};
      font-family: 'Press Start 2P', cursive;
      font-size: 0.7rem;
      padding: 12px 30px;
      margin: 8px;
      cursor: pointer;
      transition: all 0.1s;
      box-shadow:
        0 0 10px ${color}66,
        inset 0 0 15px ${color}22;
      text-shadow: 0 0 10px ${color};
      min-width: 160px;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = `${color}33`;
      button.style.boxShadow = `
        0 0 20px ${color},
        inset 0 0 20px ${color}44
      `;
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = 'transparent';
      button.style.boxShadow = `
        0 0 10px ${color}66,
        inset 0 0 15px ${color}22
      `;
      button.style.transform = 'scale(1)';
    });

    button.addEventListener('mousedown', () => {
      button.style.transform = 'scale(0.95)';
    });

    button.addEventListener('mouseup', () => {
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('click', onClick);

    return button;
  }

  setPauseCallback(callback: () => void): void {
    this.onPauseCallback = callback;
  }
}
