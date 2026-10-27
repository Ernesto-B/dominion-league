import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps asset URLs relative, so the build works whether Pages serves
// it from /<repo>/ or a custom domain root. Safe because routing is hash-based.
export default defineConfig({
  base: './',
  plugins: [react()],
});
