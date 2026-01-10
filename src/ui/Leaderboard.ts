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
      background: linear-gradient(135deg, #0d0d1a 0%, #1a0a2e 30%, #0a1a2e 70%, #0d0d1a 100%);
      display: none;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
      z-index: 25;
      overflow-y: auto;
      font-family: 'Russo One', 'Impact', sans-serif;
    `;

    // Title
    const title = document.createElement('h1');
    title.textContent = 'HIGH SCORES';
    title.style.cssText = `
      font-family: 'Bebas Neue', 'Impact', sans-serif;
      font-size: 3.5rem;
      background: linear-gradient(180deg, #ffcc00 0%, #ff6600 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 1.5rem;
      filter: drop-shadow(3px 3px 0px #000);
      letter-spacing: 6px;
    `;

    // Mode tabs
    const tabs = document.createElement('div');
    tabs.style.cssText = `
      display: flex;
      gap: 10px;
      margin-bottom: 1.5rem;
    `;

    const timeAttackTab = this.createTab('TIME ATTACK', GameMode.TimeAttack, ['#ff6600', '#ffcc00']);
    const endlessTab = this.createTab('ENDLESS', GameMode.Endless, ['#00ccff', '#0066ff']);

    tabs.appendChild(timeAttackTab);
    tabs.appendChild(endlessTab);

    // Scores container
    const scoresPanel = document.createElement('div');
    scoresPanel.style.cssText = `
      background: linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(30,30,60,0.8) 100%);
      border: 4px solid #ff6600;
      padding: 20px;
      width: 100%;
      max-width: 500px;
      box-shadow: 5px 5px 0px #000;
      clip-path: polygon(15px 0, calc(100% - 15px) 0, 100% 15px, 100% calc(100% - 15px), calc(100% - 15px) 100%, 15px 100%, 0 calc(100% - 15px), 0 15px);
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
      background: linear-gradient(90deg, #ff0033 0%, #cc0029 100%);
      border: none;
      color: white;
      font-family: 'Russo One', 'Impact', sans-serif;
      font-size: 1.2rem;
      font-weight: bold;
      padding: 15px 40px;
      margin-top: 2rem;
      cursor: pointer;
      transition: all 0.1s;
      box-shadow: 4px 4px 0px #000;
      text-transform: uppercase;
      letter-spacing: 3px;
      text-shadow: 2px 2px 0px rgba(0, 0, 0, 0.5);
      clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
    `;

    backBtn.addEventListener('mouseenter', () => {
      backBtn.style.transform = 'translateX(5px) scale(1.05)';
      backBtn.style.boxShadow = '6px 6px 0px #000';
    });

    backBtn.addEventListener('mouseleave', () => {
      backBtn.style.transform = 'translateX(0) scale(1)';
      backBtn.style.boxShadow = '4px 4px 0px #000';
    });

    backBtn.addEventListener('click', () => this.onBack());

    container.appendChild(title);
    container.appendChild(tabs);
    container.appendChild(scoresPanel);
    container.appendChild(backBtn);

    document.body.appendChild(container);

    return container;
  }

  private createTab(text: string, mode: GameMode, colors: string[]): HTMLButtonElement {
    const tab = document.createElement('button');
    tab.textContent = text;
    tab.dataset.mode = mode;

    const isActive = mode === this.currentMode;

    tab.style.cssText = `
      background: ${isActive ? `linear-gradient(90deg, ${colors[0]} 0%, ${colors[1]} 100%)` : 'rgba(255,255,255,0.1)'};
      border: none;
      color: white;
      font-family: 'Russo One', 'Impact', sans-serif;
      font-size: 0.9rem;
      padding: 12px 20px;
      cursor: pointer;
      transition: all 0.1s;
      box-shadow: ${isActive ? '3px 3px 0px #000' : 'none'};
      text-transform: uppercase;
      letter-spacing: 2px;
      text-shadow: 1px 1px 0px #000;
      clip-path: polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%);
    `;

    tab.addEventListener('click', () => {
      this.currentMode = mode;
      this.updateTabs();
      this.renderScores();
    });

    return tab;
  }

  private updateTabs(): void {
    const tabs = this.container.querySelectorAll('[data-mode]');
    tabs.forEach((tab) => {
      const btn = tab as HTMLButtonElement;
      const mode = btn.dataset.mode as GameMode;
      const isActive = mode === this.currentMode;
      const colors = mode === GameMode.TimeAttack ? ['#ff6600', '#ffcc00'] : ['#00ccff', '#0066ff'];

      btn.style.background = isActive
        ? `linear-gradient(90deg, ${colors[0]} 0%, ${colors[1]} 100%)`
        : 'rgba(255,255,255,0.1)';
      btn.style.boxShadow = isActive ? '3px 3px 0px #000' : 'none';
    });
  }

  private renderScores(): void {
    const scoresContainer = this.container.querySelector('#scores-list')!;
    scoresContainer.innerHTML = '';

    const scores = this.currentMode === GameMode.TimeAttack
      ? this.data.timeAttack
      : this.data.endless;

    if (scores.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `
        text-align: center;
        padding: 2rem;
      `;
      empty.innerHTML = `
        <p style="color: rgba(255,255,255,0.5); font-size: 1rem; margin-bottom: 1rem;">NO SCORES YET</p>
        <p style="color: #99ff00; font-size: 1.2rem; text-shadow: 2px 2px 0px #000;">BE THE FIRST!</p>
      `;
      scoresContainer.appendChild(empty);
      return;
    }

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      padding: 10px 15px;
      margin-bottom: 10px;
      border-bottom: 3px solid #ff6600;
    `;
    header.innerHTML = `
      <span style="color: #00ccff; font-size: 0.8rem; width: 50px;">RANK</span>
      <span style="color: #00ccff; font-size: 0.8rem; flex: 1; text-align: center;">NAME</span>
      <span style="color: #00ccff; font-size: 0.8rem; width: 120px; text-align: right;">SCORE</span>
    `;
    scoresContainer.appendChild(header);

    scores.forEach((entry, index) => {
      const row = document.createElement('div');
      const isFirst = index === 0;
      const colors = isFirst ? ['#ffcc00', '#ff6600'] : index < 3 ? ['#99ff00', '#66cc00'] : ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.6)'];

      row.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 15px;
        margin-bottom: 5px;
        background: ${isFirst ? 'linear-gradient(90deg, rgba(255, 204, 0, 0.2) 0%, rgba(255, 102, 0, 0.2) 100%)' : 'transparent'};
        ${isFirst ? 'border: 2px solid #ffcc00; box-shadow: 0 0 10px rgba(255, 204, 0, 0.3);' : ''}
      `;

      const rankText = index === 0 ? '1ST' : index === 1 ? '2ND' : index === 2 ? '3RD' : `${index + 1}TH`;
      const rank = document.createElement('span');
      rank.textContent = rankText;
      rank.style.cssText = `
        background: ${isFirst ? 'linear-gradient(180deg, #ffcc00 0%, #ff6600 100%)' : index < 3 ? 'linear-gradient(180deg, #99ff00 0%, #66cc00 100%)' : 'none'};
        -webkit-background-clip: text;
        -webkit-text-fill-color: ${index < 3 ? 'transparent' : colors[0]};
        background-clip: text;
        font-size: 1rem;
        width: 50px;
        font-family: 'Bebas Neue', 'Impact', sans-serif;
        letter-spacing: 1px;
        ${isFirst ? 'filter: drop-shadow(1px 1px 0px #000);' : ''}
      `;

      const name = document.createElement('span');
      name.textContent = entry.name;
      name.style.cssText = `
        color: ${isFirst ? '#ffcc00' : '#ffffff'};
        font-size: 1.3rem;
        flex: 1;
        text-align: center;
        letter-spacing: 0.3em;
        font-family: 'Bebas Neue', 'Impact', sans-serif;
        text-shadow: ${isFirst ? '2px 2px 0px #000' : '1px 1px 0px #000'};
      `;

      const score = document.createElement('span');
      score.textContent = entry.score.toString().padStart(6, '0');
      score.style.cssText = `
        background: ${isFirst ? 'linear-gradient(180deg, #00ccff 0%, #0066ff 100%)' : 'none'};
        -webkit-background-clip: text;
        -webkit-text-fill-color: ${isFirst ? 'transparent' : '#00ccff'};
        background-clip: text;
        font-size: 1.2rem;
        width: 120px;
        text-align: right;
        font-family: 'Bebas Neue', 'Impact', sans-serif;
        letter-spacing: 2px;
        ${isFirst ? 'filter: drop-shadow(1px 1px 0px #000);' : ''}
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
