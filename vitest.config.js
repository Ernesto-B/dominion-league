import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

// Reuses vite.config.js (the React plugin, so .jsx test subjects compile). Tests are plain Node — no browser.
export default mergeConfig(viteConfig, defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.{js,jsx}'], reporters: 'default' },
}));
