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
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      display: none;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
      z-index: 25;
      overflow-y: auto;
    `;

    // Title
    const title = document.createElement('h1');
    title.textContent = 'LEADERBOARD';
    title.style.cssText = `
      color: #f9a825;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 2.5rem;
      font-weight: bold;
      margin-bottom: 1.5rem;
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

    // Scores container
    const scoresContainer = document.createElement('div');
    scoresContainer.id = 'scores-list';
    scoresContainer.style.cssText = `
      width: 100%;
      max-width: 400px;
    `;

    // Back button
    const backBtn = document.createElement('button');
    backBtn.textContent = 'BACK';
    backBtn.style.cssText = `
      background: rgba(255,255,255,0.1);
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 8px;
      color: white;
      font-size: 1.1rem;
      font-weight: bold;
      padding: 12px 40px;
      margin-top: 2rem;
      cursor: pointer;
      transition: background 0.2s;
    `;

    backBtn.addEventListener('mouseenter', () => {
      backBtn.style.background = 'rgba(255,255,255,0.2)';
    });

    backBtn.addEventListener('mouseleave', () => {
      backBtn.style.background = 'rgba(255,255,255,0.1)';
    });

    backBtn.addEventListener('click', () => this.onBack());

    container.appendChild(title);
    container.appendChild(tabs);
    container.appendChild(scoresContainer);
    container.appendChild(backBtn);

    document.body.appendChild(container);

    return container;
  }

  private createTab(text: string, mode: GameMode): HTMLButtonElement {
    const tab = document.createElement('button');
    tab.textContent = text;
    tab.dataset.mode = mode;
    tab.style.cssText = `
      background: ${mode === this.currentMode ? '#4ecca3' : 'rgba(255,255,255,0.1)'};
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 1rem;
      font-weight: bold;
      padding: 12px 24px;
      cursor: pointer;
      transition: background 0.2s;
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
      btn.style.background =
        mode === this.currentMode ? '#4ecca3' : 'rgba(255,255,255,0.1)';
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
      empty.textContent = 'No scores yet. Be the first!';
      empty.style.cssText = `
        color: rgba(255,255,255,0.5);
        text-align: center;
        font-size: 1.1rem;
        margin-top: 2rem;
      `;
      scoresContainer.appendChild(empty);
      return;
    }

    scores.forEach((entry, index) => {
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: rgba(255,255,255,${index === 0 ? 0.15 : 0.05});
        border-radius: 8px;
        margin-bottom: 8px;
        ${index === 0 ? 'border: 2px solid #f9a825;' : ''}
      `;

      const rank = document.createElement('span');
      rank.textContent = `${index + 1}.`;
      rank.style.cssText = `
        color: ${index === 0 ? '#f9a825' : 'rgba(255,255,255,0.7)'};
        font-weight: bold;
        width: 30px;
      `;

      const name = document.createElement('span');
      name.textContent = entry.name;
      name.style.cssText = `
        color: white;
        font-weight: bold;
        font-size: 1.2rem;
        letter-spacing: 0.1em;
      `;

      const score = document.createElement('span');
      score.textContent = entry.score.toLocaleString();
      score.style.cssText = `
        color: ${index === 0 ? '#4ecca3' : 'white'};
        font-weight: bold;
        font-size: 1.1rem;
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
