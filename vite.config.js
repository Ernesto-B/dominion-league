import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps asset URLs relative, so the build works whether Pages serves
// it from /<repo>/ or a custom domain root. Safe because routing is hash-based.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // the libraries change far less often than the app, so they get their own files: a returning visitor re-downloads
        // only the app code after a deploy, not React or the Supabase client again
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (/node_modules\/@supabase\//.test(id)) return 'supabase';
          return undefined;
        },
      },
    },
  },
});
