import { test, expect } from '@playwright/test';

const snapshot = page => page.evaluate(() => window.__arpg.snapshot());
const waitForRest = async page => {
  await expect.poll(async () => (await snapshot(page)).target).toBeNull();
  await expect.poll(async () => { const v = (await snapshot(page)).velocity; return Math.hypot(v.x, v.y); }).toBe(0);
};

test.beforeEach(async ({ page }) => {
  // Compare the original free movement experiment; collision behavior has a dedicated suite.
  await page.addInitScript(() => localStorage.setItem('arpg-lab-parameters-v1', JSON.stringify({ collisionsEnabled: false })));
  await page.goto('/?test=1');
  await expect.poll(() => page.evaluate(() => Boolean(window.__arpg?.portraitReady()))).toBe(true);
  await expect(page.locator('#settings-panel')).toBeHidden();
  await page.locator('#settings-toggle').click();
  const attackGroup = page.locator('details.parameter-group[data-group="attack"]');
  if (!(await attackGroup.evaluate(node => node.open))) await attackGroup.locator('summary').click();
  await page.locator('#param-autoAttackMode').selectOption('off');
  await page.locator('#settings-toggle').click();
});

test('loads locally, draws portrait and health ring, has no external requests or errors', async ({ page }) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.__arpg?.portraitReady()))).toBe(true);
  await expect(page.locator('#mode')).toHaveText('Покой');
  const pixels = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const dpr = devicePixelRatio;
    const pixel = (x, y) => [...ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data];
    return { portrait: pixel(640, 360), health: pixel(672, 360), ground: pixel(720, 360) };
  });
  expect(pixels.portrait).not.toEqual(pixels.ground);
  expect(pixels.health[1]).toBeGreaterThan(150);
  expect(errors).toEqual([]);
  expect(requests.every(url => new URL(url).hostname === '127.0.0.1')).toBe(true);
});

test('short click reaches fixed world goal, camera follows, moving mouse does not move the goal', async ({ page }) => {
  await page.mouse.click(860, 450);
  await page.mouse.move(250, 250);
  await expect.poll(async () => (await snapshot(page)).hero.x).toBe(220);
  await waitForRest(page);
  const state = await snapshot(page);
  expect(state.hero).toEqual({ x: 220, y: 90 });
  expect(state.camera).toEqual(state.hero);
  await page.mouse.click(500, 260);
  await waitForRest(page);
  expect((await snapshot(page)).hero).toEqual({ x: 80, y: -10 });
});

test('stationary held cursor keeps walking, turning changes direction, center stops, release freezes target', async ({ page }) => {
  await page.mouse.move(760, 360);
  await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).pointer.following).toBe(true);
  await expect.poll(async () => (await snapshot(page)).hero.x).toBeGreaterThan(180);
  const before = (await snapshot(page)).hero.x;
  await page.mouse.move(520, 360);
  await expect.poll(async () => (await snapshot(page)).hero.x).toBeLessThan(before - 20);
  await page.mouse.move(640, 360);
  await waitForRest(page);
  const rest = (await snapshot(page)).hero;
  await page.waitForTimeout(150);
  expect((await snapshot(page)).hero).toEqual(rest);
  await page.mouse.move(760, 360);
  await expect.poll(async () => (await snapshot(page)).target !== null).toBe(true);
  await page.mouse.up();
  const goal = (await snapshot(page)).target;
  expect(goal).not.toBeNull();
  await page.mouse.move(200, 200);
  await waitForRest(page);
  expect((await snapshot(page)).hero).toEqual(goal);
  expect((await snapshot(page)).pointer.down).toBe(false);
});

test('blur stops motion, clears holding and focus return requires a new press', async ({ page }) => {
  await page.mouse.move(900, 280);
  await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).pointer.following).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const stopped = await snapshot(page);
  expect(stopped.target).toBeNull();
  expect(stopped.pointer.down).toBe(false);
  await page.mouse.up();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(200);
  expect((await snapshot(page)).hero).toEqual(stopped.hero);
  await page.mouse.click(800, 360);
  await expect.poll(async () => (await snapshot(page)).hero.x).toBeGreaterThan(stopped.hero.x);
});

test('capture handles release outside the canvas, pointer cancellation stops movement', async ({ page }) => {
  await page.mouse.move(760, 360);
  await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).pointer.following).toBe(true);
  await page.mouse.move(-20, 360);
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).pointer.down).toBe(false);
  await page.mouse.move(520, 250);
  await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).pointer.following).toBe(true);
  await page.locator('#world').dispatchEvent('pointercancel');
  const stopped = await snapshot(page);
  expect(stopped.pointer.down).toBe(false);
  expect(stopped.target).toBeNull();
  await page.mouse.up();
  await page.waitForTimeout(100);
  expect((await snapshot(page)).hero).toEqual(stopped.hero);
});

test('resize preserves world goal and centers camera at negative coordinates', async ({ page }) => {
  await page.mouse.click(140, 160);
  await page.setViewportSize({ width: 900, height: 600 });
  await waitForRest(page);
  const state = await snapshot(page);
  expect(state.hero).toEqual({ x: -500, y: -200 });
  expect(state.camera).toEqual(state.hero);
  expect(state.viewport).toEqual({ width: 900, height: 600 });
  const centerIsPortrait = await page.evaluate(() => {
    const ctx = document.querySelector('canvas').getContext('2d');
    const rgba = ctx.getImageData(450 * devicePixelRatio, 300 * devicePixelRatio, 1, 1).data;
    return rgba[0] > 35 && rgba[1] > 35;
  });
  expect(centerIsPortrait).toBe(true);
  await page.locator('#reset').click();
  expect((await snapshot(page)).hero).toEqual({ x: 0, y: 0 });
});

test('right mouse button does not move hero and test interface is absent in normal play', async ({ page }) => {
  await page.mouse.click(900, 500, { button: 'right' });
  await page.waitForTimeout(200);
  expect((await snapshot(page)).hero).toEqual({ x: 0, y: 0 });
  await page.goto('/');
  expect(await page.evaluate(() => window.__arpg)).toBeUndefined();
});

test('hidden tab clears input and does not resume movement', async ({ page }) => {
  await page.mouse.click(1100, 360);
  await expect.poll(async () => (await snapshot(page)).hero.x).toBeGreaterThan(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const stopped = await snapshot(page);
  expect(stopped.target).toBeNull();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(200);
  expect((await snapshot(page)).hero).toEqual(stopped.hero);
});
