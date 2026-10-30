import { resolve } from 'node:path';
import { defineConfig, type Connect, type Plugin } from 'vite';
import legacy from '@vitejs/plugin-legacy';

// /dashboard（末尾 / なし）を開くとアンケートが返ってしまうので /dashboard/ に転送する（GitHub Pages は自前で転送する）
const dashSlash =
  (base: string): Connect.NextHandleFunction =>
  (req, res, next) => {
    const m = /^([^?]*\/dashboard)(\?.*)?$/.exec(req.url || '');
    if (m && m[1] === base + 'dashboard') {
      res.statusCode = 301;
      res.setHeader('Location', m[1] + '/' + (m[2] || ''));
      res.end();
      return;
    }
    next();
  };
const dashboardRedirect = (): Plugin => {
  let base = '/';
  return {
    name: 'dashboard-redirect',
    configResolved(c) {
      base = c.base;
    },
    configureServer(s) {
      s.middlewares.use(dashSlash(base));
    },
    configurePreviewServer(s) {
      s.middlewares.use(dashSlash(base));
    },
  };
};

// アンケートは Android 7.1 内蔵ブラウザ（Chromium 53〜58）で動かすので legacy 版を必ず出す。
// CSS は変換されないので、CSS の禁止事項は stylelint で止める（.stylelintrc.json）。
export default defineConfig({
  // GitHub Pages（https://<org>.github.io/<repo>/）はサブパスで配信されるので、ワークフローから BASE_PATH を渡す
  base: process.env.BASE_PATH || '/',
  plugins: [dashboardRedirect(), legacy({ targets: ['chrome >= 53'], modernPolyfills: true })],
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
