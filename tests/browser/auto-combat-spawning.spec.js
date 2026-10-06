import { test, expect } from '@playwright/test';

const snapshot = page => page.evaluate(() => window.__arpg.snapshot());
async function start(page, params) {
  await page.addInitScript(params => {
    if (!localStorage.getItem('arpg-lab-parameters-v1'))
      localStorage.setItem('arpg-lab-parameters-v1', JSON.stringify(params));
  }, params);
  await page.goto('/?test=1');
  await expect.poll(() => page.evaluate(() => window.__arpg?.portraitReady())).toBe(true);
}
async function clickActor(page, name) {
  const s = await snapshot(page), actor = s[name];
  await page.mouse.click(s.viewport.width / 2 + (actor.x - s.camera.x) * s.params.cameraZoom,
    s.viewport.height / 2 + (actor.y - s.camera.y) * s.params.cameraZoom);
}

test('auto continuation attacks after a short click and a ground command cancels it', async ({ page }) => {
  await start(page, { autoContinueAttack: true, spawnersEnabled: false, enemyMoveSpeed: 0 });
  await clickActor(page, 'enemy');
  await expect.poll(async () => (await snapshot(page)).enemy.hp).toBeLessThanOrEqual(80);
  expect((await snapshot(page)).pointer.down).toBe(false);
  await page.mouse.click(200, 550);
  const hp = (await snapshot(page)).enemy.hp;
  await page.waitForTimeout(800);
  expect((await snapshot(page)).enemy.hp).toBe(hp);
  expect((await snapshot(page)).combat.targetId).toBeNull();
});

test('a received strike triggers an automatic response when enabled', async ({ page }) => {
  await start(page, { autoRetaliate: true, autoContinueAttack: true, spawnersEnabled: true, spawnInterval: .5, maxEnemies: 1,
    enemyMoveSpeed: 400, enemyDamage: 1, collisionsEnabled: false });
  await expect.poll(async () => (await snapshot(page)).combat.targetId).toBe('spawn-1');
  await expect.poll(async () => (await snapshot(page)).spawnedEnemies[0]?.hp).toBeLessThanOrEqual(80);
  expect((await snapshot(page)).heroStatus.hp).toBeLessThan(100);
  expect((await snapshot(page)).pointer.down).toBe(false);
});

test('four sides spawn offscreen, respect the cap, pause in settings and reset cleanly', async ({ page }) => {
  await start(page, { spawnersEnabled: true, spawnInterval: 0.5, maxEnemies: 4, enemyMoveSpeed: 0 });
  await expect.poll(async () => (await snapshot(page)).spawnedEnemies.length).toBe(4);
  const s = await snapshot(page);
  expect(s.spawnedEnemies.map(a => a.spawnSide)).toEqual(['top', 'right', 'bottom', 'left']);
  for (const actor of s.spawnedEnemies) {
    const x = s.viewport.width / 2 + (actor.x - s.camera.x) * s.params.cameraZoom;
    const y = s.viewport.height / 2 + (actor.y - s.camera.y) * s.params.cameraZoom;
    expect(x < 0 || x > s.viewport.width || y < 0 || y > s.viewport.height).toBe(true);
  }
  await page.waitForTimeout(600);
  expect((await snapshot(page)).spawnedEnemies.length).toBe(4);
  await page.locator('#settings-toggle').click();
  await expect.poll(async () => (await snapshot(page)).paused).toBe(true);
  const clock = (await snapshot(page)).spawner.elapsed;
  await page.waitForTimeout(700);
  expect((await snapshot(page)).spawner.elapsed).toBe(clock);
  for (const group of ['attack', 'spawners']) await page.locator(`details[data-group="${group}"] summary`).click();
  await page.screenshot({ path: 'artifacts/auto-combat-spawners.png' });
  await page.locator('#reset').click();
  expect((await snapshot(page)).spawnedEnemies).toHaveLength(0);
  await page.locator('#panel-close').click();
  await page.waitForTimeout(200);
  expect((await snapshot(page)).spawnedEnemies).toHaveLength(0);
  await expect.poll(async () => (await snapshot(page)).spawnedEnemies.length).toBeGreaterThan(0);
});

test('spawner controls are effective and persisted along with combat switches', async ({ page }) => {
  await start(page, { spawnInterval: 0.5, enemyMoveSpeed: 0 });
  await page.locator('#settings-toggle').click();
  await page.locator('details[data-group="spawners"] summary').click();
  await page.locator('#param-spawnersEnabled').uncheck();
  await page.locator('#param-spawnInterval').fill('2');
  await page.locator('#param-maxEnemies').fill('4');
  await page.locator('details[data-group="attack"] summary').click();
  await page.locator('#param-autoContinueAttack').check();
  await page.locator('#param-autoRetaliate').check();
  await page.locator('#panel-close').click();
  await page.waitForTimeout(750);
  expect((await snapshot(page)).spawnedEnemies).toHaveLength(0);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__arpg?.portraitReady())).toBe(true);
  expect((await snapshot(page)).params).toMatchObject({ spawnersEnabled: false,
    spawnInterval: 2, maxEnemies: 4, autoContinueAttack: true, autoRetaliate: true });
  await page.locator('#settings-toggle').click();
  await expect(page.locator('#param-spawnersEnabled')).not.toBeChecked();
  await expect(page.locator('#param-autoContinueAttack')).toBeChecked();
  await expect(page.locator('#param-autoRetaliate')).toBeChecked();
  await expect(page.locator('#param-spawnInterval')).toHaveValue('2.0');
  await expect(page.locator('#param-maxEnemies')).toHaveValue('4');
});
