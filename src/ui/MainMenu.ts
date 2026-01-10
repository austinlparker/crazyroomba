import { GameMode } from '../game/GameState';

export class MainMenu {
  private container: HTMLDivElement;
  private onStartGame: (mode: GameMode) => void;
  private onShowLeaderboard: () => void;

  constructor(
    onStartGame: (mode: GameMode) => void,
    onShowLeaderboard: () => void
  ) {
    this.onStartGame = onStartGame;
    this.onShowLeaderboard = onShowLeaderboard;
    this.container = this.createMenu();
  }

  private createMenu(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'main-menu';
    container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(ellipse at center, #1a1a3e 0%, #0a0a12 100%);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 20;
      font-family: 'Press Start 2P', cursive;
    `;

    // Arcade cabinet border effect
    const cabinetFrame = document.createElement('div');
    cabinetFrame.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      bottom: 10px;
      border: 4px solid #00ffff;
      border-radius: 8px;
      box-shadow:
        0 0 20px rgba(0, 255, 255, 0.3),
        inset 0 0 60px rgba(0, 0, 0, 0.5);
      pointer-events: none;
    `;
    container.appendChild(cabinetFrame);

    // Corner decorations
    const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    corners.forEach(corner => {
      const cornerEl = document.createElement('div');
      const [vertical, horizontal] = corner.split('-');
      cornerEl.style.cssText = `
        position: absolute;
        ${vertical}: 20px;
        ${horizontal}: 20px;
        width: 30px;
        height: 30px;
        border-${vertical}: 3px solid #ff00ff;
        border-${horizontal}: 3px solid #ff00ff;
        pointer-events: none;
      `;
      container.appendChild(cornerEl);
    });

    // Title with neon effect
    const title = document.createElement('h1');
    title.textContent = 'CRAZY ROOMBA';
    title.style.cssText = `
      color: #00ffff;
      font-size: 2.5rem;
      font-weight: bold;
      text-shadow:
        0 0 10px #00ffff,
        0 0 20px #00ffff,
        0 0 40px #00ffff,
        0 0 80px #00ffff;
      margin-bottom: 0.5rem;
      letter-spacing: 4px;
      animation: titleGlow 2s ease-in-out infinite;
    `;

    // Add title animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes titleGlow {
        0%, 100% {
          text-shadow:
            0 0 10px #00ffff,
            0 0 20px #00ffff,
            0 0 40px #00ffff,
            0 0 80px #00ffff;
        }
        50% {
          text-shadow:
            0 0 5px #00ffff,
            0 0 10px #00ffff,
            0 0 20px #00ffff,
            0 0 40px #00ffff;
        }
      }
      @keyframes blink {
        0%, 50%, 100% { opacity: 1; }
        25%, 75% { opacity: 0.7; }
      }
      @keyframes buttonPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
      }
    `;
    document.head.appendChild(style);

    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.textContent = '- VACUUM LIKE YOU MEAN IT -';
    subtitle.style.cssText = `
      color: #ffcc00;
      font-size: 0.6rem;
      margin-bottom: 2rem;
      text-shadow: 0 0 10px #ffcc00;
      letter-spacing: 2px;
    `;

    // Animated roomba icon using ASCII-style box
    const icon = document.createElement('div');
    icon.innerHTML = `
      <div style="
        width: 80px;
        height: 80px;
        border: 4px solid #00ff66;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 20px #00ff66, inset 0 0 20px rgba(0, 255, 102, 0.2);
        animation: robotSpin 4s linear infinite;
        position: relative;
      ">
        <div style="
          width: 20px;
          height: 20px;
          background: #00ff66;
          border-radius: 50%;
          box-shadow: 0 0 10px #00ff66;
        "></div>
        <div style="
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-bottom: 12px solid #00ff66;
        "></div>
      </div>
    `;
    icon.style.cssText = `
      margin-bottom: 2rem;
    `;

    // Add robot spin animation
    const robotStyle = document.createElement('style');
    robotStyle.textContent = `
      @keyframes robotSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(robotStyle);

    // Insert coin text (blinking)
    const insertCoin = document.createElement('p');
    insertCoin.textContent = 'INSERT COIN';
    insertCoin.style.cssText = `
      color: #ffcc00;
      font-size: 0.75rem;
      margin-bottom: 2rem;
      animation: blink 1s step-end infinite;
      text-shadow: 0 0 10px #ffcc00;
    `;

    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
    `;

    // Buttons
    const timeAttackBtn = this.createArcadeButton('1P - TIME ATTACK', '#00ffff', () => {
      this.onStartGame(GameMode.TimeAttack);
    });

    const endlessBtn = this.createArcadeButton('2P - ENDLESS MODE', '#ff00ff', () => {
      this.onStartGame(GameMode.Endless);
    });

    const leaderboardBtn = this.createArcadeButton('HIGH SCORES', '#ffcc00', () => {
      this.onShowLeaderboard();
    });

    buttonsContainer.appendChild(timeAttackBtn);
    buttonsContainer.appendChild(endlessBtn);
    buttonsContainer.appendChild(leaderboardBtn);

    // Controls hint
    const controls = document.createElement('div');
    controls.style.cssText = `
      color: rgba(255,255,255,0.5);
      font-size: 0.5rem;
      margin-top: 2rem;
      text-align: center;
      line-height: 2;
    `;
    controls.innerHTML = `
      <p style="color: #00ff66; text-shadow: 0 0 5px #00ff66;">WASD - MOVE</p>
      <p style="color: #00ff66; text-shadow: 0 0 5px #00ff66;">Q/E - CAMERA</p>
    `;

    // Credit text
    const credits = document.createElement('p');
    credits.textContent = 'CREDITS: 99';
    credits.style.cssText = `
      position: absolute;
      bottom: 30px;
      color: #00ff66;
      font-size: 0.5rem;
      text-shadow: 0 0 5px #00ff66;
    `;

    container.appendChild(title);
    container.appendChild(subtitle);
    container.appendChild(icon);
    container.appendChild(insertCoin);
    container.appendChild(buttonsContainer);
    container.appendChild(controls);
    container.appendChild(credits);

    document.body.appendChild(container);

    return container;
  }

  private createArcadeButton(
    text: string,
    color: string,
    onClick: () => void
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      background: transparent;
      border: 3px solid ${color};
      border-radius: 0;
      color: ${color};
      font-family: 'Press Start 2P', cursive;
      font-size: 0.75rem;
      padding: 15px 30px;
      cursor: pointer;
      transition: all 0.1s;
      box-shadow:
        0 0 10px ${color}66,
        inset 0 0 20px ${color}22;
      text-shadow: 0 0 10px ${color};
      min-width: 280px;
      position: relative;
      overflow: hidden;
    `;

    // Hover effect
    button.addEventListener('mouseenter', () => {
      button.style.background = `${color}33`;
      button.style.boxShadow = `
        0 0 20px ${color},
        0 0 40px ${color}66,
        inset 0 0 30px ${color}44
      `;
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = 'transparent';
      button.style.boxShadow = `
        0 0 10px ${color}66,
        inset 0 0 20px ${color}22
      `;
      button.style.transform = 'scale(1)';
    });

    button.addEventListener('mousedown', () => {
      button.style.transform = 'scale(0.95)';
      button.style.background = `${color}66`;
    });

    button.addEventListener('mouseup', () => {
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('click', onClick);

    return button;
  }

  show(): void {
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.container.style.display = 'none';
  }
}
