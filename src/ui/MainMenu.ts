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
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 20;
    `;

    // Title
    const title = document.createElement('h1');
    title.textContent = 'CRAZY ROOMBA';
    title.style.cssText = `
      color: #4ecca3;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 4rem;
      font-weight: bold;
      text-shadow: 0 0 20px rgba(78, 204, 163, 0.5);
      margin-bottom: 0.5rem;
    `;

    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Vacuum like you mean it!';
    subtitle.style.cssText = `
      color: rgba(255,255,255,0.7);
      font-size: 1.2rem;
      margin-bottom: 3rem;
    `;

    // Roomba icon (simple ASCII art style)
    const icon = document.createElement('div');
    icon.innerHTML = '🤖';
    icon.style.cssText = `
      font-size: 5rem;
      margin-bottom: 2rem;
      animation: bounce 1s ease-in-out infinite;
    `;

    // Add bounce animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
    `;
    document.head.appendChild(style);

    // Buttons
    const timeAttackBtn = this.createButton('TIME ATTACK', '#4ecca3', () => {
      this.onStartGame(GameMode.TimeAttack);
    });

    const endlessBtn = this.createButton('ENDLESS', '#7b68ee', () => {
      this.onStartGame(GameMode.Endless);
    });

    const leaderboardBtn = this.createButton('LEADERBOARD', '#f9a825', () => {
      this.onShowLeaderboard();
    });

    // Mode descriptions
    const timeAttackDesc = document.createElement('p');
    timeAttackDesc.textContent = 'Race against time! Collect dust to earn bonus seconds.';
    timeAttackDesc.style.cssText = `
      color: rgba(255,255,255,0.5);
      font-size: 0.9rem;
      margin-top: -5px;
      margin-bottom: 15px;
    `;

    const endlessDesc = document.createElement('p');
    endlessDesc.textContent = 'No time limit. Clean forever!';
    endlessDesc.style.cssText = `
      color: rgba(255,255,255,0.5);
      font-size: 0.9rem;
      margin-top: -5px;
      margin-bottom: 15px;
    `;

    // Controls hint
    const controls = document.createElement('div');
    controls.style.cssText = `
      color: rgba(255,255,255,0.4);
      font-size: 0.9rem;
      margin-top: 2rem;
      text-align: center;
    `;
    controls.innerHTML = `
      <p>Controls: WASD or Arrow Keys to move</p>
      <p>Collect dust and return to the dock!</p>
    `;

    container.appendChild(title);
    container.appendChild(subtitle);
    container.appendChild(icon);
    container.appendChild(timeAttackBtn);
    container.appendChild(timeAttackDesc);
    container.appendChild(endlessBtn);
    container.appendChild(endlessDesc);
    container.appendChild(leaderboardBtn);
    container.appendChild(controls);

    document.body.appendChild(container);

    return container;
  }

  private createButton(
    text: string,
    color: string,
    onClick: () => void
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      background: ${color};
      border: none;
      border-radius: 12px;
      color: white;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 1.3rem;
      font-weight: bold;
      padding: 18px 60px;
      margin: 8px;
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.2s;
      box-shadow: 0 4px 15px ${color}40;
      min-width: 280px;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
      button.style.boxShadow = `0 6px 25px ${color}60`;
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = `0 4px 15px ${color}40`;
    });

    button.addEventListener('mousedown', () => {
      button.style.transform = 'scale(0.98)';
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
