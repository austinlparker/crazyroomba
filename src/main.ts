import { Game } from './game/Game';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const loading = document.getElementById('loading');

  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  try {
    // Initialize the game
    const game = new Game(canvas);
    await game.initialize();

    // Hide loading screen
    if (loading) {
      loading.style.display = 'none';
    }

    // Start the game loop
    game.start();

    // Handle window resize
    window.addEventListener('resize', () => {
      game.resize();
    });

    // Expose game instance for debugging
    (window as unknown as { game: Game }).game = game;
  } catch (error) {
    console.error('Failed to initialize game:', error);
    if (loading) {
      loading.innerHTML = `
        <h1>CRAZY ROOMBA</h1>
        <p style="color: #ff6b6b;">Failed to load game</p>
        <p style="font-size: 0.9rem; opacity: 0.5;">${error}</p>
      `;
    }
  }
});
