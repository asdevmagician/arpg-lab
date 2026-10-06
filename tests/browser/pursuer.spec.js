import { test, expect } from '@playwright/test';

const PARAMETER_KEY = 'arpg-lab-parameters-v1';
const snapshot = page => page.evaluate(() => window.__arpg.snapshot());

async function openGame(page, params = {}) {
  await page.addInitScript(({ key, values }) => {
    localStorage.setItem(key, JSON.stringify(values));
  }, { key: PARAMETER_KEY, values: { collisionsEnabled: false, spawnInterval: .5, maxEnemies: 1, ...params } });
  await page.goto('/?test=1');
  await expect.poll(() => page.evaluate(() => Boolean(window.__arpg?.portraitReady()))).toBe(true);
  await expect(page.locator('#settings-panel')).toBeHidden();
}

async function worldPoint(page, actor) {
  const state = await snapshot(page);
  return {
    x: state.viewport.width / 2 + (actor.x - state.camera.x) * state.params.cameraZoom,
    y: state.viewport.height / 2 + (actor.y - state.camera.y) * state.params.cameraZoom,
  };
}

async function clickPursuer(page) {
  const state = await snapshot(page);
  const point = await worldPoint(page, state.spawnedEnemies[0]);
  await page.mouse.click(point.x, point.y);
}

test('spawned skeleton arrives from above, attacks once in range, and pauses with the settings menu', async ({ page }) => {
  await openGame(page, { enemyMoveSpeed: 0 });
  await expect.poll(async () => (await snapshot(page)).spawnedEnemies.length).toBe(1);
  const start = await snapshot(page);
  const startPoint = await worldPoint(page, start.spawnedEnemies[0]);
  expect(startPoint.y).toBeLessThan(0);
  expect(start.spawnedEnemies[0]).toMatchObject({ id: 'spawn-1', spawnSide: 'top', hp: 100, layer: 0 });

  await page.locator('#settings-toggle').click();
  await page.locator('details[data-group="enemy"] summary').click();
  await page.locator('#param-enemyMoveSpeed').fill('400');
  await page.locator('#panel-close').click();

  await page.waitForFunction(() => {
    const state = window.__arpg.snapshot();
    return state.spawnedEnemies[0]?.combat.phase === 'windup';
  });
  const arrived = await snapshot(page);
  expect(arrived.spawnedEnemies[0].combat.attackCount).toBe(1);
  expect(Math.hypot(arrived.spawnedEnemies[0].x - arrived.hero.x, arrived.spawnedEnemies[0].y - arrived.hero.y)).toBeLessThanOrEqual(arrived.params.enemyAttackRange);
  await page.locator('#world').screenshot({ path: 'artifacts/pursuer-arrival.png' });
  await expect.poll(async () => (await snapshot(page)).heroStatus.hp).toBe(90);

  await page.locator('#settings-toggle').click();
  await expect.poll(async () => (await snapshot(page)).paused).toBe(true);
  const paused = await snapshot(page);
  await page.waitForTimeout(800);
  const stillPaused = await snapshot(page);
  expect(stillPaused.spawnedEnemies[0]).toMatchObject({ x: paused.spawnedEnemies[0].x, y: paused.spawnedEnemies[0].y });
  expect(stillPaused.spawnedEnemies[0].combat.phase).toBe(paused.spawnedEnemies[0].combat.phase);
  expect(stillPaused.spawnedEnemies[0].combat.elapsed).toBe(paused.spawnedEnemies[0].combat.elapsed);
  expect(stillPaused.heroStatus.hp).toBe(paused.heroStatus.hp);
  await page.locator('#settings-toggle').click();
});

test('spawned skeleton can be killed, walked through as a corpse, and removed by reset', async ({ page }) => {
  await openGame(page, {
    enemyMoveSpeed: 400,
    enemyDamage: 1,
    attackRange: 200,
    damage: 50,
  });
  await expect.poll(async () => {
    const state = await snapshot(page);
    return Boolean(state.spawnedEnemies[0] && Math.hypot(state.spawnedEnemies[0].x - state.hero.x, state.spawnedEnemies[0].y - state.hero.y) <= state.params.attackRange);
  }).toBe(true);

  await clickPursuer(page);
  await expect.poll(async () => (await snapshot(page)).combat.targetId).toBe('spawn-1');
  await expect.poll(async () => (await snapshot(page)).spawnedEnemies[0].hp).toBe(50);
  await expect.poll(async () => (await snapshot(page)).combat.phase).toBe('idle');
  await clickPursuer(page);
  await expect.poll(async () => (await snapshot(page)).combat.targetId).toBe('spawn-1');
  await expect.poll(async () => (await snapshot(page)).spawnedEnemies[0].hp).toBe(0);
  await expect.poll(async () => (await snapshot(page)).spawnedEnemies[0].layer).toBe(-1);

  const dead = await snapshot(page);
  const corpse = await worldPoint(page, dead.spawnedEnemies[0]);
  await page.mouse.click(corpse.x, corpse.y);
  const afterClick = await snapshot(page);
  expect(afterClick.combat.targetId ?? null).toBeNull();
  await expect.poll(async () => {
    const state = await snapshot(page);
    return Math.hypot(state.hero.x - state.spawnedEnemies[0].x, state.hero.y - state.spawnedEnemies[0].y);
  }).toBeLessThan(1);
  expect((await snapshot(page)).spawnedEnemies[0].hp).toBe(0);

  await page.locator('#settings-toggle').click();
  await expect.poll(async () => (await snapshot(page)).paused).toBe(true);
  await page.locator('#reset').click();
  const reset = await snapshot(page);
  expect(reset.hero).toEqual({ x: 0, y: 0 });
  expect(reset.spawnedEnemies).toHaveLength(0);
  expect(reset.spawner).toMatchObject({ elapsed: 0, nextSide: 0, nextId: 1 });
  expect(reset.params).toMatchObject({ enemyMoveSpeed: 400, enemyDamage: 1, attackRange: 200, damage: 50 });
});
