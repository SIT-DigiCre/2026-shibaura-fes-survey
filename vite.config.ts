import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

// アンケートは Android 7.1 内蔵ブラウザ（Chromium 53〜58）で動かすので legacy 版を必ず出す。
// CSS は変換されないので、CSS の禁止事項は stylelint で止める（.stylelintrc.json）。
export default defineConfig({
  plugins: [legacy({ targets: ['chrome >= 53'], modernPolyfills: true })],
  build: {
    cssTarget: ['chrome53'],
    rollupOptions: {
      input: {
        survey: resolve(import.meta.dirname, 'index.html'),
        dashboard: resolve(import.meta.dirname, 'dashboard/index.html'),
      },
    },
  },
});
