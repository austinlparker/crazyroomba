export enum GameStatus {
  Menu = 'menu',
  Playing = 'playing',
  Paused = 'paused',
  GameOver = 'gameOver',
}

export enum GameMode {
  TimeAttack = 'timeAttack',
  Endless = 'endless',
}

export interface CollectedDust {
  id: string;
  pointValue: number;
  timeValue: number;
  pathDistance: number;
}

export class GameState {
  status: GameStatus = GameStatus.Menu;
  mode: GameMode = GameMode.TimeAttack;
  score: number = 0;
  timeRemaining: number = 60;
  totalDustDeposited: number = 0;

  reset(mode: GameMode): void {
    this.status = GameStatus.Menu;
    this.mode = mode;
    this.score = 0;
    this.timeRemaining = mode === GameMode.TimeAttack ? 60 : Infinity;
    this.totalDustDeposited = 0;
  }

  addScore(points: number): void {
    this.score += points;
  }

  addTime(seconds: number): void {
    if (this.mode === GameMode.TimeAttack) {
      this.timeRemaining += seconds;
    }
  }

  incrementDustDeposited(count: number): void {
    this.totalDustDeposited += count;
  }
}
