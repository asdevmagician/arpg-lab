import { test, expect } from '@playwright/test';

const snapshot = page => page.evaluate(() => window.__arpg.snapshot());
async function start(page, params) {
  await page.addInitScript(values => localStorage.setItem('arpg-lab-parameters-v1', JSON.stringify(values)),
    { spawnInterval: .5, maxEnemies: 1, enemyMoveSpeed: 400, ...params });
  await page.goto('/?test=1');
  await expect.poll(() => page.evaluate(() => window.__arpg?.portraitReady())).toBe(true);
}

test('spawned skeleton kills the hero, dead input is rejected, and reset clears all enemies', async ({ page }) => {
  await start(page, { enemyDamage: 50, enemyWindup: .05, enemySwingDuration: .05, enemyRecovery: .05 });
  await expect.poll(async () => (await snapshot(page)).heroStatus.hp).toBe(0);
  const dead = await snapshot(page);
  expect(dead.heroStatus.layer).toBe(-1);
  expect(dead.spawnedEnemies[0].combat.phase).toBe('idle');
  await page.mouse.click(900, 550);
  await page.waitForTimeout(150);
  expect((await snapshot(page)).hero).toEqual(dead.hero);
  expect((await snapshot(page)).combat.targetId).toBeNull();
  await page.locator('#settings-toggle').click();
  await page.locator('#reset').click();
  const reset = await snapshot(page);
  expect(reset.heroStatus).toMatchObject({ hp: 100, layer: 0 });
  expect(reset.enemy).toMatchObject({ hp: 100, x: 220, y: 0 });
  expect(reset.spawnedEnemies).toHaveLength(0);
});

test('FPS continues rendering while settings pause a spawned enemy attack', async ({ page }) => {
  await start(page, { enemyWindup: 2 });
  await page.waitForFunction(() => window.__arpg.snapshot().spawnedEnemies[0]?.combat.phase === 'windup');
  await page.locator('#settings-toggle').click();
  await expect.poll(async () => (await snapshot(page)).paused).toBe(true);
  const paused = await snapshot(page);
  await page.waitForTimeout(700);
  await expect(page.locator('#fps')).toHaveText(/^FPS \d+/);
  const after = await snapshot(page);
  expect(after.spawnedEnemies).toEqual(paused.spawnedEnemies);
  expect(after.spawner).toEqual(paused.spawner);
  expect(after.heroStatus.hp).toBe(paused.heroStatus.hp);
});
