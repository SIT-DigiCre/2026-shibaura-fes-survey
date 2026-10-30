import { test, expect } from '@playwright/test';
import { SHOT, collectErrors, fontsReady, mockGas } from './helpers';

test.use({ viewport: { width: 540, height: 1920 } });

test('待ち受け → Q1〜Q7（★BEST 含む）→ 送信 → お礼 → 待ち受け', async ({ page }) => {
  const errors = collectErrors(page);
  const received = await mockGas(page, { count: 41 });
  await page.goto('/');
  await fontsReady(page);

  // 待ち受け: ボタンは 1 つ、回答数を表示
  await expect(page.locator('#idle')).toBeVisible();
  await expect(page.locator('#idle button')).toHaveCount(1);
  await expect(page.locator('#idle .js-total')).toHaveText('41');
  await page.screenshot({ path: SHOT + 'signage-01-idle.png' });

  await page.getByRole('button', { name: 'タッチしてスタート' }).click();
  await expect(page.locator('.q-num')).toHaveText('Q1');
  await expect(page.locator('#next')).toHaveText('えらんでね');
  await page.waitForTimeout(400);
  await page.screenshot({ path: SHOT + 'signage-02-q1.png' });

  // 必須の Q1 は選ばないと進めない
  await page.locator('#next').click();
  await expect(page.locator('.q-num')).toHaveText('Q1');

  const opt = (v: string) => page.locator('.o[data-v="' + v + '"]');
  await opt('A').click();
  await page.waitForTimeout(400);
  await opt('D').click();
  // 2回タップで ★BEST
  await opt('C').dblclick();
  await expect(opt('C')).toHaveClass(/best/);
  // 長押しで ★BEST を付け替え
  await opt('E').hover();
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(opt('E')).toHaveClass(/best/);
  await expect(opt('C')).toHaveClass(/\bon\b/);
  // C に戻す
  await page.waitForTimeout(400);
  await opt('C').dblclick();
  await expect(opt('C')).toHaveClass(/best/);
  await expect(opt('E')).toHaveClass(/\bon\b/);
  await page.waitForTimeout(1200);
  await expect(page.locator('#chips .chip:not(.out)')).toHaveCount(4);
  await expect(page.locator('#chips .chip.best')).toContainText('C ゲーム展示 ★BEST');
  // 飛行中のチップはタップを横取りしない
  await expect(page.locator('#fly')).toHaveCSS('pointer-events', 'none');
  await page.screenshot({ path: SHOT + 'signage-03-q1-best.png' });

  await page.locator('#next').click();
  await expect(page.locator('.q-num')).toHaveText('Q2');
  await expect(page.locator('#next')).toHaveText('スキップ ▶');
  await page.locator('.o', { hasText: '面白かった' }).click();
  await page.locator('.o', { hasText: '体験できるのが良かった' }).click();
  await page.locator('#next').click();

  // 単一選択は選ぶと自動で次へ
  await expect(page.locator('.q-num')).toHaveText('Q3');
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOT + 'signage-04-q3.png' });
  await page.locator('.o', { hasText: '大変良かった' }).click();
  await expect(page.locator('.q-num')).toHaveText('Q4');
  await page.locator('.o', { hasText: 'フレンドリー' }).click();
  await page.locator('#next').click();
  await expect(page.locator('.q-num')).toHaveText('Q5');
  await page.locator('.o', { hasText: '20代' }).click();
  await expect(page.locator('.q-num')).toHaveText('Q6');
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOT + 'signage-05-q6.png' });
  await page.locator('.o', { hasText: '他大学の学生' }).click();
  await expect(page.locator('.q-num')).toHaveText('Q7');

  // Q7: 送信ボタンは設問カードの中
  await expect(page.locator('#card #next')).toHaveText('送信する');
  await page.locator('.o', { hasText: 'また来たい！' }).click();
  await page.locator('#cm').fill('DTM体験が楽しかった');
  await page.locator('.q-title').click(); // キーボードを閉じる
  await page.waitForTimeout(1200);
  await page.screenshot({ path: SHOT + 'signage-06-q7.png' });

  // チップをタッチすると、その設問に戻れる
  await page.locator('#chips .chip[data-k="q5"]').click();
  await expect(page.locator('.q-num')).toHaveText('Q5');
  await page.locator('#chips .chip[data-k="q7"]').click();
  await expect(page.locator('.q-num')).toHaveText('Q7');

  await page.locator('#next').click();
  await expect(page.locator('#thanks')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#thanks')).not.toContainText('DC-');
  await expect(page.locator('.ty-staff')).toBeHidden();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: SHOT + 'signage-07-thanks.png' });

  // 送信内容
  await expect.poll(() => received.length).toBe(1);
  const r = received[0];
  expect(r.id).toBe('DC-S1-0001');
  expect(r.src).toBe('signage');
  expect(r.q1).toBe('A イラスト / C ゲーム展示 / D VTuber / E DTM体験');
  expect(r.best).toBe('C ゲーム展示');
  expect(r.q2).toBe('面白かった / 体験できるのが良かった');
  expect(r.q3).toBe('大変良かった');
  expect(r.q5).toBe('20代');
  expect(r.q6).toBe('他大学の学生');
  expect(r.q7).toBe('また来たい！');
  expect(r.text).toBe('DTM体験が楽しかった');

  // 5 秒で待ち受けへ
  await expect(page.locator('#idle')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#thanks')).toBeHidden();
  await expect(page.locator('#idle .js-total')).toHaveText('42');
  await page.screenshot({ path: SHOT + 'signage-08-idle-again.png' });

  // 送れたものは送信済み
  const unsent = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('digicre_survey_2026.records') || '[]').filter((s: { sent: boolean }) => !s.sent)
        .length,
  );
  expect(unsent).toBe(0);
  expect(errors).toEqual([]);
});

test('送信に失敗しても来場者には見せず、あとで再送する', async ({ page }) => {
  const errors = collectErrors(page);
  await mockGas(page, { fail: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'タッチしてスタート' }).click();
  await page.locator('.o[data-v="B"]').click();
  for (let i = 0; i < 6; i++) await page.locator('#next').click();
  await expect(page.locator('#next')).toHaveText('送信する');
  await page.locator('#next').click();
  await expect(page.locator('#thanks')).toBeVisible();
  await expect(page.locator('#thanks')).not.toContainText('失敗');
  await expect(page.locator('#idle')).toBeVisible({ timeout: 8000 });

  // 復旧後のリロード（起動時の再送）で送られる
  await page.unrouteAll();
  const received = await mockGas(page);
  await page.reload();
  await expect.poll(() => received.length).toBe(1);
  expect(received[0].q1).toBe('B MV');
  expect(errors.filter((e) => !/500/.test(e))).toEqual([]);
});

test('放置警告（20 秒延長できる）', async ({ page }) => {
  const errors = collectErrors(page);
  await page.clock.install();
  await mockGas(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'タッチしてスタート' }).click();
  await page.locator('.o[data-v="A"]').click();
  await page.clock.runFor(61000);
  await expect(page.locator('#warn')).toBeVisible();
  await page.screenshot({ path: SHOT + 'signage-09-warn.png' });
  await page.getByRole('button', { name: '回答をつづける' }).click();
  await expect(page.locator('#warn')).toBeHidden();
  await expect(page.locator('.o[data-v="A"]')).toHaveClass(/on/);

  // 放置しつづけると待ち受けに戻る
  await page.clock.runFor(61000 + 21000);
  await expect(page.locator('#idle')).toBeVisible();
  expect(errors).toEqual([]);
});

test('タッチで全画面になり、管理画面で OFF にできる', async ({ page }) => {
  const errors = collectErrors(page);
  await mockGas(page);
  await page.goto('/');
  expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await page.getByRole('button', { name: 'タッチしてスタート' }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await expect(page.locator('.q-num')).toHaveText('Q1');

  // 抜けても次のタッチで戻る
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await page.locator('.q-title').click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);

  // 管理画面で OFF
  for (let i = 0; i < 5; i++) await page.locator('#main .logo-hit').click();
  for (const k of ['2', '0', '2', '6']) await page.locator('.pk[data-k="' + k + '"]').click();
  await page.getByRole('button', { name: 'タッチで自動的に全画面 ON' }).click();
  await expect(page.getByRole('button', { name: 'タッチで自動的に全画面 OFF' })).toBeVisible();
  await page.getByRole('button', { name: '閉じてアンケートに戻る' }).click();
  await page.evaluate(() => (document.fullscreenElement ? document.exitFullscreen() : undefined));
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await page.locator('.q-title').click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  expect(errors).toEqual([]);
});

test('管理画面: ロゴ 5 回 → PIN 2026', async ({ page }) => {
  const errors = collectErrors(page);
  await mockGas(page);
  await page.goto('/');
  await fontsReady(page);
  const logo = page.locator('#idle .logo-hit');
  for (let i = 0; i < 5; i++) await logo.click();
  await expect(page.locator('#pin')).toBeVisible();
  for (const k of ['1', '1', '1', '1']) await page.locator('.pk[data-k="' + k + '"]').click();
  await page.waitForTimeout(500);
  await expect(page.locator('#admin')).toBeHidden();
  for (const k of ['2', '0', '2', '6']) await page.locator('.pk[data-k="' + k + '"]').click();
  await expect(page.locator('#admin')).toBeVisible();
  await page.locator('#adDev').fill('K2');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('#adMsg')).toContainText('K2');
  await page.screenshot({ path: SHOT + 'signage-10-admin.png' });
  await page.getByRole('button', { name: '閉じてアンケートに戻る' }).click();
  await expect(page.locator('#admin')).toBeHidden();
  await expect(page.locator('#idle')).toBeVisible();
  expect(errors).toEqual([]);
});
