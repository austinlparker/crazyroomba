import { defineConfig } from 'vite';

export default defineConfig({
  // Base path for GitHub Pages (repository name)
  base: '/crazyroomba/',
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ['@babylonjs/havok'],
  },
});
