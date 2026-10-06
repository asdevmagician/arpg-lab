import { test, expect } from '@playwright/test';

const snapshot = page => page.evaluate(() => window.__arpg.snapshot());

test('a diagonal approach starts an attack and accepts another attack without resetting', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('arpg-lab-parameters-v1', JSON.stringify({
    spawnersEnabled: false, enemyMoveSpeed: 0,
  })));
  await page.goto('/?test=1');
  await expect.poll(() => page.evaluate(() => window.__arpg?.portraitReady())).toBe(true);
  // Move to (390, -64); the camera then puts the original target at (470, 424).
  await page.mouse.click(1030, 296);
  await expect.poll(async () => (await snapshot(page)).hero).toEqual({ x: 390, y: -64 });
  await page.mouse.click(470, 424);
  await expect.poll(async () => (await snapshot(page)).enemy.hp).toBe(90);
  await expect.poll(async () => (await snapshot(page)).combat.phase).toBe('idle');
  expect((await snapshot(page)).heroStatus.hp).toBeGreaterThan(0);
  const s = await snapshot(page);
  await page.mouse.click(s.viewport.width / 2 + s.enemy.x - s.camera.x,
    s.viewport.height / 2 + s.enemy.y - s.camera.y);
  await expect.poll(async () => (await snapshot(page)).enemy.hp).toBe(80);
  await page.screenshot({ path: 'artifacts/approach-fixed.png' });
});
