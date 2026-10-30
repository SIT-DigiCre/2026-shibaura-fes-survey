import { test, expect } from '@playwright/test';
import { SHOT, collectErrors, fontsReady, mockGas } from './helpers';

// 実機に合わせて UA も Android にする（PC の UA だと自動ではスマホ版にならない）
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const SIGNAGE_UA =
  'Mozilla/5.0 (Linux; Android 7.1.2; LG Signage) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.83 Safari/537.36';

test.use({
  userAgent: ANDROID_UA,
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

test('スマホ版: 回答 → お礼（回答 ID は出さない）', async ({ page }) => {
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
  await expect(page.locator('#thanks')).not.toContainText('スタッフ');
  await expect(page.locator('#thanks')).not.toContainText('DC-P-');
  await expect.poll(() => received.length).toBe(1);
  expect(received[0].src).toBe('phone');
  expect(received[0].id).toMatch(/^DC-P-[A-Z0-9]{8}$/);
  expect(received[0].best).toBe('C ゲーム展示');
  await page.waitForTimeout(800);
  await page.screenshot({ path: SHOT + 'phone-05-thanks.png', fullPage: true });

  // スマホ版はお礼画面のまま
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
    userAgent: SIGNAGE_UA,
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

test.describe('タッチ対応の PC（表示倍率 200%）', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    viewport: { width: 960, height: 540 },
    screen: { width: 960, height: 540 },
    hasTouch: true,
    isMobile: false,
  });
  test('/ はスマホ版にならない', async ({ page }) => {
    await mockGas(page);
    await page.goto('/');
    await expect(page.locator('#idle')).toBeVisible();
    await expect(page.locator('html')).not.toHaveClass(/is-phone/);
  });
});
