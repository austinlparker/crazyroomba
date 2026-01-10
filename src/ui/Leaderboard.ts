import { GameMode } from '../game/GameState';

interface ScoreEntry {
  name: string;
  score: number;
  date: string;
}

interface LeaderboardData {
  timeAttack: ScoreEntry[];
  endless: ScoreEntry[];
}

const STORAGE_KEY = 'crazyRoombaLeaderboard';
const MAX_ENTRIES = 10;

export class Leaderboard {
  private container: HTMLDivElement;
  private data: LeaderboardData;
  private currentMode: GameMode = GameMode.TimeAttack;
  private onBack: () => void;

  constructor(onBack: () => void) {
    this.onBack = onBack;
    this.data = this.loadData();
    this.container = this.createUI();
  }

  private loadData(): LeaderboardData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load leaderboard:', e);
    }

    return {
      timeAttack: [],
      endless: [],
    };
  }

  private saveData(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save leaderboard:', e);
    }
  }

  private createUI(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'leaderboard';
    container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(ellipse at center, #1a1a3e 0%, #0a0a12 100%);
      display: none;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
      z-index: 25;
      overflow-y: auto;
      font-family: 'Press Start 2P', cursive;
    `;

    // Arcade frame
    const frame = document.createElement('div');
    frame.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      bottom: 10px;
      border: 4px solid #ffcc00;
      border-radius: 8px;
      box-shadow:
        0 0 20px rgba(255, 204, 0, 0.3),
        inset 0 0 60px rgba(0, 0, 0, 0.5);
      pointer-events: none;
    `;
    container.appendChild(frame);

    // Title with arcade marquee style
    const title = document.createElement('h1');
    title.textContent = 'HIGH SCORES';
    title.style.cssText = `
      color: #ffcc00;
      font-size: 1.8rem;
      font-weight: bold;
      margin-bottom: 1.5rem;
      text-shadow:
        0 0 10px #ffcc00,
        0 0 20px #ffcc00,
        0 0 40px #ffcc00;
      letter-spacing: 3px;
    `;

    // Mode tabs
    const tabs = document.createElement('div');
    tabs.style.cssText = `
      display: flex;
      gap: 10px;
      margin-bottom: 1.5rem;
    `;

    const timeAttackTab = this.createTab('TIME ATTACK', GameMode.TimeAttack);
    const endlessTab = this.createTab('ENDLESS', GameMode.Endless);

    tabs.appendChild(timeAttackTab);
    tabs.appendChild(endlessTab);

    // Scores container with arcade panel
    const scoresPanel = document.createElement('div');
    scoresPanel.style.cssText = `
      background: #111;
      border: 3px solid #00ffff;
      border-radius: 4px;
      padding: 20px;
      width: 100%;
      max-width: 450px;
      box-shadow:
        0 0 15px rgba(0, 255, 255, 0.3),
        inset 0 0 30px rgba(0, 0, 0, 0.8);
    `;

    const scoresContainer = document.createElement('div');
    scoresContainer.id = 'scores-list';
    scoresContainer.style.cssText = `
      width: 100%;
    `;

    scoresPanel.appendChild(scoresContainer);

    // Back button
    const backBtn = document.createElement('button');
    backBtn.textContent = 'BACK';
    backBtn.style.cssText = `
      background: transparent;
      border: 3px solid #ff3366;
      border-radius: 4px;
      color: #ff3366;
      font-family: 'Press Start 2P', cursive;
      font-size: 0.7rem;
      padding: 12px 30px;
      margin-top: 2rem;
      cursor: pointer;
      transition: all 0.1s;
      box-shadow:
        0 0 10px rgba(255, 51, 102, 0.4),
        inset 0 0 15px rgba(255, 51, 102, 0.1);
      text-shadow: 0 0 10px #ff3366;
    `;

    backBtn.addEventListener('mouseenter', () => {
      backBtn.style.background = '#ff336633';
      backBtn.style.boxShadow = `
        0 0 20px rgba(255, 51, 102, 0.6),
        inset 0 0 20px rgba(255, 51, 102, 0.2)
      `;
      backBtn.style.transform = 'scale(1.05)';
    });

    backBtn.addEventListener('mouseleave', () => {
      backBtn.style.background = 'transparent';
      backBtn.style.boxShadow = `
        0 0 10px rgba(255, 51, 102, 0.4),
        inset 0 0 15px rgba(255, 51, 102, 0.1)
      `;
      backBtn.style.transform = 'scale(1)';
    });

    backBtn.addEventListener('click', () => this.onBack());

    container.appendChild(title);
    container.appendChild(tabs);
    container.appendChild(scoresPanel);
    container.appendChild(backBtn);

    document.body.appendChild(container);

    return container;
  }

  private createTab(text: string, mode: GameMode): HTMLButtonElement {
    const tab = document.createElement('button');
    tab.textContent = text;
    tab.dataset.mode = mode;

    const isActive = mode === this.currentMode;
    const activeColor = mode === GameMode.TimeAttack ? '#00ffff' : '#ff00ff';

    tab.style.cssText = `
      background: ${isActive ? activeColor + '33' : 'transparent'};
      border: 3px solid ${activeColor};
      border-radius: 4px;
      color: ${activeColor};
      font-family: 'Press Start 2P', cursive;
      font-size: 0.55rem;
      padding: 10px 16px;
      cursor: pointer;
      transition: all 0.1s;
      box-shadow: ${isActive
        ? `0 0 15px ${activeColor}, inset 0 0 20px ${activeColor}44`
        : `0 0 5px ${activeColor}66`};
      text-shadow: 0 0 5px ${activeColor};
    `;

    tab.addEventListener('click', () => {
      this.currentMode = mode;
      this.updateTabs();
      this.renderScores();
    });

    tab.addEventListener('mouseenter', () => {
      if (mode !== this.currentMode) {
        tab.style.background = activeColor + '22';
        tab.style.boxShadow = `0 0 10px ${activeColor}`;
      }
    });

    tab.addEventListener('mouseleave', () => {
      if (mode !== this.currentMode) {
        tab.style.background = 'transparent';
        tab.style.boxShadow = `0 0 5px ${activeColor}66`;
      }
    });

    return tab;
  }

  private updateTabs(): void {
    const tabs = this.container.querySelectorAll('[data-mode]');
    tabs.forEach((tab) => {
      const btn = tab as HTMLButtonElement;
      const mode = btn.dataset.mode as GameMode;
      const isActive = mode === this.currentMode;
      const activeColor = mode === GameMode.TimeAttack ? '#00ffff' : '#ff00ff';

      btn.style.background = isActive ? activeColor + '33' : 'transparent';
      btn.style.boxShadow = isActive
        ? `0 0 15px ${activeColor}, inset 0 0 20px ${activeColor}44`
        : `0 0 5px ${activeColor}66`;
    });
  }

  private renderScores(): void {
    const scoresContainer = this.container.querySelector('#scores-list')!;
    scoresContainer.innerHTML = '';

    const scores = this.currentMode === GameMode.TimeAttack
      ? this.data.timeAttack
      : this.data.endless;

    if (scores.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'NO SCORES YET';
      empty.style.cssText = `
        color: rgba(255,255,255,0.4);
        text-align: center;
        font-size: 0.7rem;
        margin: 2rem 0;
        text-shadow: 0 0 5px rgba(255,255,255,0.2);
      `;
      scoresContainer.appendChild(empty);

      const hint = document.createElement('p');
      hint.textContent = 'BE THE FIRST!';
      hint.style.cssText = `
        color: #00ff66;
        text-align: center;
        font-size: 0.6rem;
        animation: hintBlink 1s step-end infinite;
        text-shadow: 0 0 10px #00ff66;
      `;
      scoresContainer.appendChild(hint);

      // Add blink animation if not already added
      if (!document.querySelector('#hint-blink-style')) {
        const style = document.createElement('style');
        style.id = 'hint-blink-style';
        style.textContent = `
          @keyframes hintBlink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      return;
    }

    // Header row
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      margin-bottom: 8px;
      border-bottom: 2px solid #00ffff44;
    `;
    header.innerHTML = `
      <span style="color: #00ffff; font-size: 0.5rem; width: 30px; text-shadow: 0 0 5px #00ffff;">RNK</span>
      <span style="color: #00ffff; font-size: 0.5rem; flex: 1; text-align: center; text-shadow: 0 0 5px #00ffff;">NAME</span>
      <span style="color: #00ffff; font-size: 0.5rem; width: 100px; text-align: right; text-shadow: 0 0 5px #00ffff;">SCORE</span>
    `;
    scoresContainer.appendChild(header);

    scores.forEach((entry, index) => {
      const row = document.createElement('div');
      const isFirst = index === 0;
      const rankColor = isFirst ? '#ffcc00' : index < 3 ? '#00ff66' : '#ffffff';

      row.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px;
        background: ${isFirst ? 'rgba(255, 204, 0, 0.1)' : 'transparent'};
        border-radius: 4px;
        margin-bottom: 4px;
        ${isFirst ? 'border: 1px solid #ffcc00; box-shadow: 0 0 10px rgba(255, 204, 0, 0.2);' : ''}
      `;

      const rank = document.createElement('span');
      rank.textContent = `${(index + 1).toString().padStart(2, '0')}`;
      rank.style.cssText = `
        color: ${rankColor};
        font-size: 0.6rem;
        width: 30px;
        text-shadow: 0 0 5px ${rankColor};
      `;

      const name = document.createElement('span');
      name.textContent = entry.name;
      name.style.cssText = `
        color: ${isFirst ? '#ffcc00' : '#ffffff'};
        font-size: 0.8rem;
        flex: 1;
        text-align: center;
        letter-spacing: 0.2em;
        text-shadow: ${isFirst ? '0 0 10px #ffcc00' : 'none'};
      `;

      const score = document.createElement('span');
      score.textContent = entry.score.toString().padStart(6, '0');
      score.style.cssText = `
        color: ${isFirst ? '#00ff66' : '#00ffff'};
        font-size: 0.7rem;
        width: 100px;
        text-align: right;
        text-shadow: 0 0 5px ${isFirst ? '#00ff66' : '#00ffff'};
      `;

      row.appendChild(rank);
      row.appendChild(name);
      row.appendChild(score);

      scoresContainer.appendChild(row);
    });
  }

  addScore(mode: GameMode, name: string, score: number): void {
    const entry: ScoreEntry = {
      name: name.toUpperCase().substring(0, 3),
      score,
      date: new Date().toISOString().split('T')[0],
    };

    const scores = mode === GameMode.TimeAttack
      ? this.data.timeAttack
      : this.data.endless;

    scores.push(entry);
    scores.sort((a, b) => b.score - a.score);

    // Keep only top entries
    if (mode === GameMode.TimeAttack) {
      this.data.timeAttack = scores.slice(0, MAX_ENTRIES);
    } else {
      this.data.endless = scores.slice(0, MAX_ENTRIES);
    }

    this.saveData();
  }

  isHighScore(mode: GameMode, score: number): boolean {
    const scores = mode === GameMode.TimeAttack
      ? this.data.timeAttack
      : this.data.endless;

    if (scores.length < MAX_ENTRIES) {
      return score > 0;
    }

    return score > scores[scores.length - 1].score;
  }

  getHighScore(mode: GameMode): number {
    const scores = mode === GameMode.TimeAttack
      ? this.data.timeAttack
      : this.data.endless;

    return scores.length > 0 ? scores[0].score : 0;
  }

  show(): void {
    this.renderScores();
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.container.style.display = 'none';
  }
}
