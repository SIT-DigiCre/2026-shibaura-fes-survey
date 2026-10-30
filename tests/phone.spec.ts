import { test, expect } from '@playwright/test';
import { SHOT, collectErrors, fontsReady, mockGas } from './helpers';

test.use({
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

test('スマホ版: 回答 → お礼に「スタッフに見せて」＋回答 ID', async ({ page }) => {
  const errors = collectErrors(page);
  const received = await mockGas(page, { count: 41 });
  await page.goto('/?m=phone');
  await fontsReady(page);
  await expect(page.locator('html')).toHaveClass(/is-phone/);
  await expect(page.locator('#idle .js-total')).toHaveText('41');
  // 横スクロールが出ない
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: SHOT + 'phone-01-idle.png' });

  await page.getByRole('button', { name: 'タッチしてスタート' }).tap();
  await expect(page.locator('.q-num')).toHaveText('Q1');
  const opt = (v: string) => page.locator('.o[data-v="' + v + '"]');
  // スマホ版は勝手に全画面にしない
  expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await opt('A').tap();
  await page.waitForTimeout(400);
  await opt('F').tap();
  // 2回タップで ★BEST
  await page.waitForTimeout(400);
  await opt('C').tap();
  await opt('C').tap();
  await expect(opt('C')).toHaveClass(/best/);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: SHOT + 'phone-02-q1.png', fullPage: true });

  await page.locator('#next').tap();
  await page.locator('.o', { hasText: '感動した' }).tap();
  await page.locator('#next').tap();
  await page.locator('.o', { hasText: '良いと思う' }).tap();
  await page.locator('#next').tap();
  await expect(page.locator('.q-num')).toHaveText('Q4');
  await page.locator('#next').tap();
  await page.getByRole('button', { name: '10代', exact: true }).tap();
  await page.locator('#next').tap();
  await expect(page.locator('.q-num')).toHaveText('Q6');
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOT + 'phone-03-q6.png', fullPage: true });
  await page.getByRole('button', { name: '高校生', exact: true }).tap();
  await page.locator('#next').tap();
  await expect(page.locator('.q-num')).toHaveText('Q7');
  await page.locator('.o', { hasText: 'ゲームが面白い' }).tap();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: SHOT + 'phone-04-q7.png', fullPage: true });
  await page.locator('#next').tap();

  await expect(page.locator('#thanks')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.ty-staff')).toBeVisible();
  await expect(page.locator('.ty-staff')).toContainText('スタッフに見せて');
  await expect(page.locator('#tyId')).toHaveText(/^DC-P-[A-Z0-9]{8}$/);
  await expect.poll(() => received.length).toBe(1);
  expect(received[0].src).toBe('phone');
  expect(received[0].id).toBe(await page.locator('#tyId').textContent());
  expect(received[0].best).toBe('C ゲーム展示');
  await page.waitForTimeout(800);
  await page.screenshot({ path: SHOT + 'phone-05-thanks.png', fullPage: true });

  // スマホ版はお礼画面のまま（スタッフに見せるため）
  await page.waitForTimeout(6000);
  await expect(page.locator('#thanks')).toBeVisible();
  expect(errors).toEqual([]);
});

test('スマホ版: ロゴを 5 回タップしても管理画面は開かない', async ({ page }) => {
  await mockGas(page);
  await page.goto('/?m=phone');
  for (let i = 0; i < 5; i++) await page.locator('#idle .logo-hit').tap();
  await expect(page.locator('#pin')).toBeHidden();
});

test('スマホで / を開くと自動でスマホ版になる', async ({ page }) => {
  const errors = collectErrors(page);
  await mockGas(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/is-phone/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: SHOT + 'phone-00-auto.png' });
  expect(errors).toEqual([]);
});

test('?m=signage を付けると、その端末はスマホ幅でもサイネージ版のまま', async ({ page }) => {
  await mockGas(page);
  await page.goto('/?m=signage');
  await expect(page.locator('html')).not.toHaveClass(/is-phone/);
  // 記憶されるので、次から / でもサイネージ版
  await page.goto('/');
  await expect(page.locator('#idle')).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/is-phone/);
  // ?m=phone は記憶より優先
  await page.goto('/?m=phone');
  await expect(page.locator('html')).toHaveClass(/is-phone/);
});

test.describe('サイネージ実機相当（タッチ・540×1920）', () => {
  test.use({
    viewport: { width: 540, height: 1920 },
    screen: { width: 540, height: 1920 },
    hasTouch: true,
    isMobile: true,
  });
  test('/ はサイネージ版のまま', async ({ page }) => {
    await mockGas(page);
    await page.goto('/');
    await expect(page.locator('#idle')).toBeVisible();
    await expect(page.locator('html')).not.toHaveClass(/is-phone/);
  });
});
