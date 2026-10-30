import { defineConfig, devices } from '@playwright/test';

// 本番ビルド（legacy 込み）を preview で配信して確認する。
// 送信先はダミー URL にして、テスト内で page.route で受ける。
export const MOCK_GAS = 'https://script.google.com/macros/s/TEST/exec';

export default defineConfig({
  testDir: 'tests',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173', ...devices['Desktop Chrome'] },
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 180000,
    env: { VITE_GAS_URL: MOCK_GAS },
  },
});
