import type { ConsoleMessage, Page } from '@playwright/test';
import { MOCK_GAS } from '../playwright.config';
import type { SurveyRecord } from '../src/shared/record';

export const SHOT = 'screenshots/';

/** GAS のふりをする。受け取ったレコードを返す */
export async function mockGas(page: Page, opts: { count?: number; fail?: boolean } = {}) {
  const received: SurveyRecord[] = [];
  await page.route(MOCK_GAS + '**', async (route) => {
    const req = route.request();
    if (opts.fail) return route.fulfill({ status: 500, body: 'error' });
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}') as { records: SurveyRecord[] };
      received.push(...body.records);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: true, ids: body.records.map((r) => r.id) }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, count: (opts.count ?? 41) + received.length }),
    });
  });
  return received;
}

/** コンソールエラーとページエラーを集める（Google Fonts の読み込み失敗は除外） */
export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text() + (m.location().url || '')))
      errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

export async function fontsReady(page: Page) {
  await page.evaluate(() => document.fonts.ready.then(() => true));
}
