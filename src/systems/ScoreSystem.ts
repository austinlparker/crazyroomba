import { GameState, GameMode, CollectedDust } from '../game/GameState';

export class ScoreSystem {
  private gameState: GameState;
  private comboMultiplier: number = 1;
  private lastDepositTime: number = 0;
  private comboTimeout: number = 5000; // 5 seconds to maintain combo

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  addDeposit(dustList: CollectedDust[]): void {
    if (dustList.length === 0) return;

    const now = Date.now();

    // Check for combo
    if (now - this.lastDepositTime < this.comboTimeout) {
      this.comboMultiplier = Math.min(this.comboMultiplier + 0.25, 3);
    } else {
      this.comboMultiplier = 1;
    }
    this.lastDepositTime = now;

    // Calculate total points and time
    let totalPoints = 0;
    let totalTime = 0;

    for (const dust of dustList) {
      totalPoints += dust.pointValue;
      totalTime += dust.timeValue;
    }

    // Apply combo multiplier to points
    const finalPoints = Math.floor(totalPoints * this.comboMultiplier);

    // Bonus for full bin deposits
    const binBonus = dustList.length >= 5 ? 500 : 0;

    // Add to game state
    this.gameState.addScore(finalPoints + binBonus);

    // Add time only in Time Attack mode
    if (this.gameState.mode === GameMode.TimeAttack) {
      this.gameState.addTime(totalTime);
    }

    this.gameState.incrementDustDeposited(dustList.length);
  }

  getComboMultiplier(): number {
    // Check if combo is still active
    if (Date.now() - this.lastDepositTime > this.comboTimeout) {
      this.comboMultiplier = 1;
    }
    return this.comboMultiplier;
  }

  isComboActive(): boolean {
    return (
      Date.now() - this.lastDepositTime < this.comboTimeout &&
      this.comboMultiplier > 1
    );
  }

  reset(): void {
    this.comboMultiplier = 1;
    this.lastDepositTime = 0;
  }
}
