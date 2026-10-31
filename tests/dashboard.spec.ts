import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { MOCK_GAS } from '../playwright.config';
import { SHOT, collectErrors, fontsReady } from './helpers';

for (const w of [1440, 390]) {
  test(`ダッシュボード ?demo=1（${w} 幅）`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto('/dashboard/?demo=1');
    await fontsReady(page);
    await expect(page.locator('#demoBadge')).toBeVisible();
    await expect(page.locator('.kpi')).toHaveCount(4);
    await expect(page.locator('.kpi').first()).toContainText('128');
    await expect(page.locator('.genre')).toHaveCount(10);
    // 年齢は表示しない
    await expect(page.locator('.panel.small h2')).toHaveText(['良かった理由', '部員の対応', '職業・属性']);
    await expect(page.locator('#export')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
    await page.screenshot({ path: SHOT + `dashboard-${w}-locked.png`, fullPage: true });

    // 合言葉で解除 → コメントと CSV
    await page.locator('#dash-key').fill('demo');
    await page.getByRole('button', { name: '解除' }).click();
    await expect(page.locator('#export')).toBeVisible();
    await expect(page.locator('#locked')).toBeHidden();
    await expect(page.locator('#csv')).toHaveText('CSVをダウンロード（全128件）');
    await expect(page.locator('.cm')).toHaveCount(20);
    await page.locator('#more').click();
    await expect(page.locator('.cm')).toHaveCount(70);
    await page.screenshot({ path: SHOT + `dashboard-${w}-unlocked.png`, fullPage: true });

    const dl = page.waitForEvent('download');
    await page.locator('#csv').click();
    const file = await dl;
    expect(file.suggestedFilename()).toMatch(/^デジクリアンケート_\d{8}_\d{4}\.csv$/);
    const csv = readFileSync(await file.path(), 'utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.split('\r\n')).toHaveLength(129);
    expect(csv).toContain('"ID","回答日時","回答元"');

    await page.getByRole('button', { name: 'ロックする' }).click();
    await expect(page.locator('#export')).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test('ダッシュボード: 印刷・PDF 保存', async ({ page }) => {
  const errors = collectErrors(page);
  // A4 縦の印字幅（余白 10mm）
  await page.setViewportSize({ width: 718, height: 1046 });
  await page.goto('/dashboard/?demo=1');
  await expect(page.locator('.kpi')).toHaveCount(4);
  await fontsReady(page);
  await page.evaluate(() => {
    const w = window as unknown as { printed: number };
    w.printed = 0;
    window.print = () => {
      w.printed++;
    };
  });
  await page.locator('#print').click();
  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);

  const beforePrint = () => page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  const afterPrint = () => page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

  // ロック中: 集計だけが載り、操作部とコメントは載らない
  await beforePrint();
  await page.emulateMedia({ media: 'print' });
  await expect(page).toHaveTitle(/^デジクリアンケート集計_\d{8}_\d{4}$/);
  for (const sel of ['#print', '#fs', '#locked', '#notice']) await expect(page.locator(sel)).toBeHidden();
  await expect(page.locator('#export')).toBeHidden();
  await expect(page.locator('#printedAt')).toBeVisible();
  await expect(page.locator('#demoBadge')).toBeVisible();
  // 用紙幅で KPI が 1 列に並び、右にはみ出さない
  const tops = await page.locator('.kpi').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  expect(new Set(tops).size).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(718);
  await page.pdf({ path: SHOT + 'dashboard-print-locked.pdf', preferCSSPageSize: true, printBackground: true });
  await afterPrint();
  await page.emulateMedia({ media: 'screen' });
  await expect(page).toHaveTitle(/^アンケート集計/);
  await expect(page.locator('#print')).toBeVisible();

  // 解除中: コメントを全件載せ、印刷後は画面の表示件数に戻す
  await page.locator('#dash-key').fill('demo');
  await page.getByRole('button', { name: '解除' }).click();
  await expect(page.locator('.cm')).toHaveCount(20);
  await beforePrint();
  await page.emulateMedia({ media: 'print' });
  expect(await page.locator('.cm').count()).toBeGreaterThan(70);
  await expect(page.locator('#more')).toHaveCount(0);
  await expect(page.locator('#csv')).toBeHidden();
  await page.pdf({ path: SHOT + 'dashboard-print-unlocked.pdf', preferCSSPageSize: true, printBackground: true });
  await afterPrint();
  await page.emulateMedia({ media: 'screen' });
  await expect(page.locator('.cm')).toHaveCount(20);
  expect(errors).toEqual([]);
});

test('ダッシュボード: GAS から取得し、合言葉が違えばロックのまま', async ({ page }) => {
  const errors = collectErrors(page);
  const rows = [
    {
      id: 'DC-S1-0001',
      at: '2026-10-31T11:05:00+09:00',
      src: 'signage',
      device: 'S1',
      q1: 'A イラスト / C ゲーム展示',
      best: 'C ゲーム展示',
      q2: '面白かった',
      q3: '大変良かった',
      q4: '',
      q5: '20代',
      q6: '高校生',
      q7: 'また来たい！',
      received: '',
    },
    {
      id: 'DC-P-ABCD2345',
      at: '2026-10-31T13:40:00+09:00',
      src: 'phone',
      device: 'phone',
      q1: 'C ゲーム展示',
      best: '',
      q2: '',
      q3: '良いと思う',
      q4: '',
      q5: '10代',
      q6: '中学生',
      q7: '',
      received: '',
    },
  ];
  const keys: string[] = [];
  await page.route(MOCK_GAS + '**', (route) => {
    const k = new URL(route.request().url()).searchParams.get('key') || '';
    keys.push(k);
    const ok = k === 'secret';
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        ok: true,
        auth: ok,
        updated: '',
        rows: rows.map((r) => (ok ? { ...r, text: 'DTM が楽しかった' } : r)),
      }),
    });
  });
  await page.goto('/dashboard/');
  await expect(page.locator('.kpi').first()).toContainText('2');
  await expect(page.locator('.kpi').nth(2)).toContainText('4.50');
  await page.locator('#dash-key').fill('nope');
  await page.getByRole('button', { name: '解除' }).click();
  await expect(page.locator('#keyErr')).toHaveText('合言葉が違います');
  await expect(page.locator('#export')).toBeHidden();
  await page.locator('#dash-key').fill('secret');
  await page.getByRole('button', { name: '解除' }).click();
  await expect(page.locator('#export')).toBeVisible();
  await expect(page.locator('.cm')).toHaveCount(2);
  await expect(page.locator('.cm').first()).toContainText('スマホ');
  await expect(page.locator('.cm').nth(1)).toContainText('「また来たい！」 ／ DTM が楽しかった');
  expect(keys).toContain('secret');
  expect(errors).toEqual([]);
});

test('ダッシュボード: /dashboard（末尾 / なし）でもダッシュボードが PC 表示で開く', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/dashboard?demo=1');
  await expect(page).toHaveURL(/\/dashboard\/\?demo=1$/);
  await expect(page.locator('.kpi')).toHaveCount(4);
  await expect(page.locator('html')).not.toHaveClass(/is-phone/);
  // KPI が横 1 列に並ぶ（スマホ幅だと縦積み）
  const tops = await page.locator('.kpi').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  expect(new Set(tops).size).toBe(1);
  expect(errors).toEqual([]);
});

for (const w of [1093, 853]) {
  test(`ダッシュボード: PC で表示倍率を上げても（${w} 幅）横並びのまま`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto('/dashboard/?demo=1');
    await expect(page.locator('.kpi')).toHaveCount(4);
    const top = (sel: string) => page.locator(sel).evaluate((e) => Math.round(e.getBoundingClientRect().top));
    // 「良いと思った展示・体験」と右の列が同じ高さに並ぶ
    expect(await top('.panel.grow')).toBe(await top('.side'));
    await page.screenshot({ path: SHOT + `dashboard-${w}-locked.png`, fullPage: true });
  });
}
