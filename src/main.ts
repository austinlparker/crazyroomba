import { Game } from './game/Game';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const loading = document.getElementById('loading');

  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  // Set canvas size explicitly before creating engine
  const resizeCanvas = () => {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  };

  // Initial resize
  resizeCanvas();

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

    // Resize immediately after start to ensure proper dimensions
    game.resize();

    // Handle window resize
    window.addEventListener('resize', () => {
      resizeCanvas();
      game.resize();
    });

    // Handle orientation change on mobile
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        resizeCanvas();
        game.resize();
      }, 100);
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
