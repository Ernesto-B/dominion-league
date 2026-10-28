/* The site wired to dev/fakeSupabase.js instead of the real Supabase project — see that file.
     npm run dev:fake      dev server, http://localhost:5199
     npm run build:fake    a static build into dist-fake/ (for scripted browser tests) */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
// A plain alias would miss relative imports ("../lib/supabase.js"), so resolve first and swap the FILE.
const fakeSupabase = {
  name: 'fake-supabase', enforce: 'pre',
  async resolveId(source, importer, opts) {
    if (!/supabase\.js$/.test(source) || !importer) return null;
    const r = await this.resolve(source, importer, { ...opts, skipSelf: true });
    return r && r.id.endsWith('/src/lib/supabase.js') ? path.join(here, 'dev', 'fakeSupabase.js') : null;
  },
};
export default defineConfig({
  base: './', plugins: [fakeSupabase, react()], server: { port: 5199, fs: { allow: [here] } },
  build: { outDir: 'dist-fake', emptyOutDir: true },
});
