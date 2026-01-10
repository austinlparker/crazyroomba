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
      font-family: 'Russo One', 'Impact', 'Arial Black', sans-serif;
      z-index: 10;
      display: none;
    `;
    document.body.appendChild(container);
    return container;
  }

  private createHUD(): void {
    // Top bar with gradient
    const topBar = document.createElement('div');
    topBar.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 15px 20px;
      background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
    `;

    // Timer panel
    const timerContainer = document.createElement('div');
    timerContainer.style.cssText = `
      background: linear-gradient(135deg, rgba(255, 102, 0, 0.9) 0%, rgba(255, 204, 0, 0.9) 100%);
      padding: 10px 20px;
      clip-path: polygon(0 0, 100% 0, calc(100% - 8px) 100%, 8px 100%);
      box-shadow: 3px 3px 0px #000;
    `;
    timerContainer.innerHTML = `
      <div style="
        color: white;
        font-size: 0.7rem;
        text-shadow: 1px 1px 0px #000;
        letter-spacing: 2px;
      ">TIME</div>
      <span id="timer" style="
        color: white;
        font-size: 1.8rem;
        font-family: 'Bebas Neue', 'Impact', sans-serif;
        text-shadow: 2px 2px 0px #000;
        letter-spacing: 3px;
      ">01:00</span>
    `;
    this.timerElement = timerContainer.querySelector('#timer')!;

    // Score panel
    const scoreContainer = document.createElement('div');
    scoreContainer.style.cssText = `
      background: linear-gradient(135deg, rgba(0, 204, 255, 0.9) 0%, rgba(0, 102, 255, 0.9) 100%);
      padding: 10px 20px;
      clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 100%, 0 100%);
      box-shadow: 3px 3px 0px #000;
    `;
    scoreContainer.innerHTML = `
      <div style="
        color: white;
        font-size: 0.7rem;
        text-shadow: 1px 1px 0px #000;
        letter-spacing: 2px;
        text-align: center;
      ">SCORE</div>
      <span id="score" style="
        color: white;
        font-size: 1.8rem;
        font-family: 'Bebas Neue', 'Impact', sans-serif;
        text-shadow: 2px 2px 0px #000;
        letter-spacing: 3px;
      ">000000</span>
    `;
    this.scoreElement = scoreContainer.querySelector('#score')!;

    // Bin indicator
    const binContainer = document.createElement('div');
    binContainer.style.cssText = `
      background: linear-gradient(135deg, rgba(153, 255, 0, 0.9) 0%, rgba(102, 204, 0, 0.9) 100%);
      padding: 10px 20px;
      clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 100%, 0 100%);
      box-shadow: 3px 3px 0px #000;
    `;
    binContainer.innerHTML = `
      <div style="
        color: white;
        font-size: 0.7rem;
        text-shadow: 1px 1px 0px #000;
        letter-spacing: 2px;
        text-align: center;
      ">DUST</div>
      <span id="bin" style="
        color: white;
        font-size: 1.5rem;
        font-family: 'Bebas Neue', 'Impact', sans-serif;
        text-shadow: 2px 2px 0px #000;
        letter-spacing: 2px;
      ">0/5</span>
    `;
    this.binElement = binContainer.querySelector('#bin')!;

    // Pause button
    this.pauseButton = document.createElement('button');
    this.pauseButton.textContent = '||';
    this.pauseButton.style.cssText = `
      pointer-events: auto;
      background: linear-gradient(135deg, #ff0033 0%, #cc0029 100%);
      border: none;
      color: white;
      font-family: 'Russo One', sans-serif;
      font-size: 1.2rem;
      font-weight: bold;
      width: 50px;
      height: 50px;
      cursor: pointer;
      transition: all 0.1s;
      box-shadow: 3px 3px 0px #000;
      clip-path: polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%);
      text-shadow: 1px 1px 0px #000;
    `;
    this.pauseButton.addEventListener('mouseenter', () => {
      this.pauseButton.style.transform = 'scale(1.1)';
    });
    this.pauseButton.addEventListener('mouseleave', () => {
      this.pauseButton.style.transform = 'scale(1)';
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

      // Flash when low on time
      if (time <= 10) {
        this.timerElement.style.color = time % 2 === 0 ? '#ff0033' : '#ffffff';
      } else {
        this.timerElement.style.color = '#ffffff';
      }
    } else {
      this.timerElement.parentElement!.style.display = 'none';
    }

    // Update score
    this.scoreElement.textContent = this.gameState.score.toString().padStart(6, '0');

    // Update bin with color coding
    this.binElement.textContent = `${binCount}/${binCapacity}`;
    const binParent = this.binElement.parentElement!;
    if (binCount >= binCapacity) {
      binParent.style.background = 'linear-gradient(135deg, rgba(255, 0, 51, 0.9) 0%, rgba(204, 0, 41, 0.9) 100%)';
    } else if (binCount >= binCapacity - 1) {
      binParent.style.background = 'linear-gradient(135deg, rgba(255, 204, 0, 0.9) 0%, rgba(255, 153, 0, 0.9) 100%)';
    } else {
      binParent.style.background = 'linear-gradient(135deg, rgba(153, 255, 0, 0.9) 0%, rgba(102, 204, 0, 0.9) 100%)';
    }
  }

  show(): void {
    this.container.style.display = 'block';
    if (this.timerElement.parentElement) {
      this.timerElement.parentElement.style.display = 'block';
    }
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
      background: rgba(0,0,0,0.85);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      pointer-events: auto;
      font-family: 'Russo One', 'Impact', sans-serif;
    `;

    const title = document.createElement('h1');
    title.textContent = 'PAUSED';
    title.style.cssText = `
      font-family: 'Bebas Neue', 'Impact', sans-serif;
      font-size: 4rem;
      background: linear-gradient(180deg, #ffcc00 0%, #ff6600 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 2rem;
      filter: drop-shadow(3px 3px 0px #000);
      letter-spacing: 8px;
    `;

    const resumeBtn = this.createExtremeButton('RESUME', ['#99ff00', '#66cc00'], () => {
      if (this.onResumeCallback) this.onResumeCallback();
    });

    const quitBtn = this.createExtremeButton('QUIT', ['#ff0033', '#cc0029'], () => {
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
      background: linear-gradient(135deg, rgba(0,0,0,0.95) 0%, rgba(51,0,0,0.95) 100%);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      pointer-events: auto;
      font-family: 'Russo One', 'Impact', sans-serif;
    `;

    const title = document.createElement('h1');
    title.textContent = 'GAME OVER';
    title.style.cssText = `
      font-family: 'Bebas Neue', 'Impact', sans-serif;
      font-size: 5rem;
      background: linear-gradient(180deg, #ff0033 0%, #cc0029 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 1rem;
      filter: drop-shadow(4px 4px 0px #000);
      letter-spacing: 8px;
    `;

    const scoreText = document.createElement('div');
    scoreText.style.cssText = `
      text-align: center;
      margin-bottom: 2rem;
    `;
    scoreText.innerHTML = `
      <p style="color: #00ccff; font-size: 1.2rem; margin-bottom: 0.5rem; letter-spacing: 3px;">FINAL SCORE</p>
      <p style="
        font-family: 'Bebas Neue', 'Impact', sans-serif;
        font-size: 3rem;
        background: linear-gradient(180deg, #ffcc00 0%, #ff6600 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        filter: drop-shadow(3px 3px 0px #000);
        letter-spacing: 5px;
      ">${score.toString().padStart(6, '0')}</p>
    `;

    this.gameOverScreen.appendChild(title);
    this.gameOverScreen.appendChild(scoreText);

    if (isHighScore) {
      const highScoreText = document.createElement('p');
      highScoreText.textContent = 'NEW HIGH SCORE!';
      highScoreText.style.cssText = `
        color: #99ff00;
        font-size: 1.5rem;
        margin-bottom: 1.5rem;
        letter-spacing: 4px;
        text-shadow: 2px 2px 0px #000;
        animation: pulse 0.5s ease-in-out infinite;
      `;

      // Add pulse animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `;
      document.head.appendChild(style);

      this.gameOverScreen.appendChild(highScoreText);

      // Name entry
      const nameEntry = this.createNameEntry((name) => {
        onSubmit(name);
      });
      this.gameOverScreen.appendChild(nameEntry);
    } else {
      const continueBtn = this.createExtremeButton('CONTINUE', ['#00ccff', '#0066ff'], () => {
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
    label.textContent = 'ENTER YOUR NAME';
    label.style.cssText = `
      color: #00ccff;
      font-size: 1rem;
      margin-bottom: 1rem;
      letter-spacing: 3px;
    `;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 3;
    input.value = 'AAA';
    input.style.cssText = `
      background: linear-gradient(135deg, #1a1a2e 0%, #2a2a4e 100%);
      border: 4px solid #ff6600;
      color: #ffcc00;
      font-family: 'Bebas Neue', 'Impact', sans-serif;
      font-size: 2.5rem;
      text-align: center;
      width: 150px;
      padding: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5em;
      box-shadow: 4px 4px 0px #000;
    `;

    input.addEventListener('focus', () => {
      input.style.borderColor = '#ffcc00';
    });

    input.addEventListener('blur', () => {
      input.style.borderColor = '#ff6600';
    });

    const submitBtn = this.createExtremeButton('OK', ['#99ff00', '#66cc00'], () => {
      const name = input.value.toUpperCase().padEnd(3, 'A').substring(0, 3);
      onSubmit(name);
    });
    submitBtn.style.marginTop = '1.5rem';

    container.appendChild(label);
    container.appendChild(input);
    container.appendChild(submitBtn);

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

  private createExtremeButton(text: string, colors: string[], onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      background: linear-gradient(90deg, ${colors[0]} 0%, ${colors[1]} 100%);
      border: none;
      color: white;
      font-family: 'Russo One', 'Impact', sans-serif;
      font-size: 1.3rem;
      font-weight: bold;
      padding: 15px 40px;
      margin: 10px;
      cursor: pointer;
      transition: all 0.1s;
      box-shadow: 4px 4px 0px #000;
      text-transform: uppercase;
      letter-spacing: 3px;
      text-shadow: 2px 2px 0px rgba(0, 0, 0, 0.5);
      clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
      min-width: 200px;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateX(5px) scale(1.05)';
      button.style.boxShadow = '6px 6px 0px #000';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateX(0) scale(1)';
      button.style.boxShadow = '4px 4px 0px #000';
    });

    button.addEventListener('mousedown', () => {
      button.style.transform = 'translateX(2px) scale(0.98)';
      button.style.boxShadow = '2px 2px 0px #000';
    });

    button.addEventListener('mouseup', () => {
      button.style.transform = 'translateX(5px) scale(1.05)';
    });

    button.addEventListener('click', onClick);

    return button;
  }

  setPauseCallback(callback: () => void): void {
    this.onPauseCallback = callback;
  }
}
