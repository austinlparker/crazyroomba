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
      background: linear-gradient(135deg, #0d0d1a 0%, #1a0a2e 30%, #2a1a0a 70%, #0d0d1a 100%);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 20;
      font-family: 'Russo One', 'Impact', 'Arial Black', sans-serif;
      overflow: hidden;
    `;

    // Dynamic background stripes
    const stripes = document.createElement('div');
    stripes.style.cssText = `
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 40px,
        rgba(255, 102, 0, 0.03) 40px,
        rgba(255, 102, 0, 0.03) 80px
      );
      animation: stripeMove 20s linear infinite;
      pointer-events: none;
    `;
    container.appendChild(stripes);

    // Add stripe animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes stripeMove {
        0% { transform: translate(0, 0); }
        100% { transform: translate(80px, 80px); }
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
      }
      @keyframes slideIn {
        0% { transform: translateX(-100px); opacity: 0; }
        100% { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    // Title with gradient
    const title = document.createElement('h1');
    title.textContent = 'CRAZY ROOMBA';
    title.style.cssText = `
      font-family: 'Bebas Neue', 'Impact', sans-serif;
      font-size: 5rem;
      font-weight: bold;
      background: linear-gradient(180deg, #ffcc00 0%, #ff6600 50%, #ff3300 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: 8px;
      margin-bottom: 0;
      filter: drop-shadow(4px 4px 0px #000) drop-shadow(0 0 30px rgba(255, 102, 0, 0.5));
      position: relative;
      z-index: 1;
    `;

    // Subtitle - extreme tagline
    const subtitle = document.createElement('p');
    subtitle.textContent = 'VACUUM TO THE EXTREME!';
    subtitle.style.cssText = `
      color: #00ccff;
      font-size: 1.4rem;
      margin-bottom: 3rem;
      letter-spacing: 6px;
      text-transform: uppercase;
      text-shadow: 2px 2px 0px #000, 0 0 20px rgba(0, 204, 255, 0.5);
    `;

    // Animated roomba graphic
    const graphic = document.createElement('div');
    graphic.style.cssText = `
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: linear-gradient(135deg, #333 0%, #666 50%, #333 100%);
      border: 6px solid #ff6600;
      margin-bottom: 2rem;
      position: relative;
      box-shadow:
        0 0 30px rgba(255, 102, 0, 0.6),
        inset 0 -20px 40px rgba(0, 0, 0, 0.5);
      animation: pulse 2s ease-in-out infinite;
    `;

    // Direction indicator on roomba
    const indicator = document.createElement('div');
    indicator.style.cssText = `
      position: absolute;
      top: 15px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 15px solid transparent;
      border-right: 15px solid transparent;
      border-bottom: 25px solid #99ff00;
      filter: drop-shadow(0 0 10px rgba(153, 255, 0, 0.8));
    `;
    graphic.appendChild(indicator);

    // Power light
    const light = document.createElement('div');
    light.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 30px;
      height: 30px;
      background: radial-gradient(circle, #99ff00 0%, #66cc00 100%);
      border-radius: 50%;
      box-shadow: 0 0 20px #99ff00;
    `;
    graphic.appendChild(light);

    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 15px;
      align-items: center;
      position: relative;
      z-index: 1;
    `;

    // Buttons with staggered animation
    const timeAttackBtn = this.createExtremeButton('TIME ATTACK', ['#ff6600', '#ffcc00'], 0, () => {
      this.onStartGame(GameMode.TimeAttack);
    });

    const endlessBtn = this.createExtremeButton('ENDLESS MODE', ['#00ccff', '#0066ff'], 1, () => {
      this.onStartGame(GameMode.Endless);
    });

    const leaderboardBtn = this.createExtremeButton('HIGH SCORES', ['#99ff00', '#66cc00'], 2, () => {
      this.onShowLeaderboard();
    });

    buttonsContainer.appendChild(timeAttackBtn);
    buttonsContainer.appendChild(endlessBtn);
    buttonsContainer.appendChild(leaderboardBtn);

    // Controls hint
    const controls = document.createElement('div');
    controls.style.cssText = `
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.9rem;
      margin-top: 2.5rem;
      text-align: center;
      letter-spacing: 2px;
      position: relative;
      z-index: 1;
    `;
    controls.innerHTML = `
      <p style="color: #ff6600; margin-bottom: 8px;">W/S - GAS & REVERSE</p>
      <p style="color: #00ccff;">A/D - STEER</p>
    `;

    // Credits
    const credits = document.createElement('p');
    credits.textContent = '© 2000 EXTREME GAMES';
    credits.style.cssText = `
      position: absolute;
      bottom: 20px;
      color: rgba(255, 255, 255, 0.3);
      font-size: 0.8rem;
      letter-spacing: 3px;
    `;

    container.appendChild(title);
    container.appendChild(subtitle);
    container.appendChild(graphic);
    container.appendChild(buttonsContainer);
    container.appendChild(controls);
    container.appendChild(credits);

    document.body.appendChild(container);

    return container;
  }

  private createExtremeButton(
    text: string,
    colors: string[],
    index: number,
    onClick: () => void
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      background: linear-gradient(90deg, ${colors[0]} 0%, ${colors[1]} 100%);
      border: none;
      color: white;
      font-family: 'Russo One', 'Impact', sans-serif;
      font-size: 1.4rem;
      font-weight: bold;
      padding: 18px 50px;
      cursor: pointer;
      transition: all 0.15s ease-out;
      box-shadow:
        4px 4px 0px #000,
        0 0 20px ${colors[0]}40;
      min-width: 320px;
      text-transform: uppercase;
      letter-spacing: 4px;
      text-shadow: 2px 2px 0px rgba(0, 0, 0, 0.5);
      clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
      position: relative;
      animation: slideIn 0.5s ease-out ${index * 0.1}s both;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateX(10px) scale(1.05)';
      button.style.boxShadow = `
        6px 6px 0px #000,
        0 0 40px ${colors[0]}60
      `;
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateX(0) scale(1)';
      button.style.boxShadow = `
        4px 4px 0px #000,
        0 0 20px ${colors[0]}40
      `;
    });

    button.addEventListener('mousedown', () => {
      button.style.transform = 'translateX(4px) scale(0.98)';
      button.style.boxShadow = `2px 2px 0px #000`;
    });

    button.addEventListener('mouseup', () => {
      button.style.transform = 'translateX(10px) scale(1.05)';
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
