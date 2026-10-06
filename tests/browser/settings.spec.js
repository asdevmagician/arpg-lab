import { test, expect } from '@playwright/test';

const STORAGE_KEY = 'arpg-lab-parameters-v1';
const UI_STORAGE_KEY = 'arpg-lab-interface-v2';
const snapshot = page => page.evaluate(() => window.__arpg.snapshot());
const section = (page, name) => page.locator(`details[data-group="${name}"]`);

test.beforeEach(async ({ page }) => {
  await page.goto('/?test=1');
  await expect.poll(() => page.evaluate(() => Boolean(window.__arpg?.portraitReady()))).toBe(true);
});

test('starts hidden with every section collapsed and exposes all setting controls', async ({ page }) => {
  await expect(page.locator('#settings-panel')).toBeHidden();
  await expect(page.locator('#settings-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(section(page, 'movement')).not.toHaveAttribute('open', '');
  await expect(section(page, 'camera')).not.toHaveAttribute('open', '');
  await expect(section(page, 'attack')).not.toHaveAttribute('open', '');
  await expect(section(page, 'enemy')).not.toHaveAttribute('open', '');
  await expect(section(page, 'layers')).not.toHaveAttribute('open', '');
  await expect(section(page, 'spawners')).not.toHaveAttribute('open', '');
  await expect(section(page, 'collisions')).not.toHaveAttribute('open', '');
  await page.locator('#settings-toggle').click();
  await expect(page.locator('#parameter-fields input[type="number"]')).toHaveCount(24);
  await expect(page.locator('#parameter-fields input[type="range"]')).toHaveCount(24);
  await expect(page.locator('#parameter-fields input[type="checkbox"]')).toHaveCount(5);
  await expect(page.locator('#param-autoAttackMode')).toHaveCount(1);

  await page.locator('details[data-group="attack"] > summary').click();
  await page.locator('#param-damage').fill('23');
  await expect(page.locator('#range-damage')).toHaveValue('23');
  await expect.poll(async () => (await snapshot(page)).params.damage).toBe(23);
  await page.locator('details[data-group="camera"] > summary').click();
  await page.locator('#range-cameraZoom').fill('1.5');
  await expect(page.locator('#param-cameraZoom')).toHaveValue('1.50');
  await page.locator('#param-autoAttackMode').selectOption('nearby');
  await page.locator('#param-deathDuration').fill('0.45');
  await page.locator('#param-autoContinueAttack').check();
  await page.locator('#param-autoRetaliate').check();
  await expect.poll(async () => (await snapshot(page)).params.autoAttackMode).toBe('nearby');
  await expect.poll(async () => (await snapshot(page)).params.deathDuration).toBe(0.45);
  await page.locator('details[data-group="enemy"] > summary').click();
  await page.locator('#param-enemyAttackRange').fill('180');
  await page.locator('#param-enemyWindup').fill('0.55');
  await page.locator('#param-enemyMoveSpeed').fill('170');
  await expect.poll(async () => (await snapshot(page)).params.enemyAttackRange).toBe(180);
  await expect.poll(async () => (await snapshot(page)).params.enemyWindup).toBe(0.55);
  await expect.poll(async () => (await snapshot(page)).params.enemyMoveSpeed).toBe(170);
  await page.locator('details[data-group="layers"] > summary').click();
  await page.locator('#param-baseLayerScale').fill('1.25');
  await page.locator('#param-floorLayerScale').fill('0.75');
  await expect.poll(async () => (await snapshot(page)).params.baseLayerScale).toBe(1.25);
  await expect.poll(async () => (await snapshot(page)).params.floorLayerScale).toBe(0.75);
  await page.locator('details[data-group="spawners"] > summary').click();
  await page.locator('#param-spawnersEnabled').uncheck();
  await page.locator('#param-spawnInterval').fill('12.5');
  await page.locator('#param-maxEnemies').fill('5.6');
  await expect.poll(async () => (await snapshot(page)).params.spawnersEnabled).toBe(false);
  await expect.poll(async () => (await snapshot(page)).params.spawnInterval).toBe(12.5);
  await expect.poll(async () => (await snapshot(page)).params.maxEnemies).toBe(6);
  await page.locator('details[data-group="collisions"] > summary').click();
  await expect(page.locator('#param-collisionsEnabled')).toBeChecked();
  await expect(page.locator('#param-showColliders')).not.toBeChecked();
  await page.locator('#param-collisionsEnabled').uncheck();
  await page.locator('#param-showColliders').check();
  await page.locator('#param-collisionRadius').fill('34');
  await expect.poll(async () => (await snapshot(page)).params.collisionsEnabled).toBe(false);
  await expect.poll(async () => (await snapshot(page)).params.showColliders).toBe(true);
  await expect.poll(async () => (await snapshot(page)).params.collisionRadius).toBe(34);
});

test('persists menu visibility and independent section state across reloads', async ({ page }) => {
  await page.locator('#settings-toggle').click();
  await page.locator('details[data-group="camera"] > summary').click();
  await page.locator('details[data-group="attack"] > summary').click();
  await page.locator('details[data-group="enemy"] > summary').click();
  await page.locator('details[data-group="layers"] > summary').click();
  await page.locator('details[data-group="spawners"] > summary').click();
  await page.locator('details[data-group="collisions"] > summary').click();
  await page.locator('#panel-close').click();
  await expect(page.locator('#settings-panel')).toBeHidden();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), UI_STORAGE_KEY);
  expect(saved).toEqual({ visible: false, sections: { movement: false, camera: true, attack: true, enemy: true, layers: true, spawners: true, collisions: true } });

  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.__arpg?.portraitReady()))).toBe(true);
  await expect(page.locator('#settings-panel')).toBeHidden();
  await page.locator('#settings-toggle').click();
  await expect(section(page, 'movement')).not.toHaveAttribute('open', '');
  await expect(section(page, 'camera')).toHaveAttribute('open', '');
  await expect(section(page, 'attack')).toHaveAttribute('open', '');
  await expect(section(page, 'enemy')).toHaveAttribute('open', '');
  await expect(section(page, 'layers')).toHaveAttribute('open', '');
  await expect(section(page, 'spawners')).toHaveAttribute('open', '');
  await expect(section(page, 'collisions')).toHaveAttribute('open', '');
});

test('version 2 interface state keeps new collision section collapsed by default', async ({ page }) => {
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ visible: false, sections: { movement: true, camera: false, attack: false, enemy: false, layers: false, spawners: false } })), UI_STORAGE_KEY);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.__arpg?.portraitReady()))).toBe(true);
  await page.locator('#settings-toggle').click();
  await expect(section(page, 'movement')).toHaveAttribute('open', '');
  await expect(section(page, 'collisions')).not.toHaveAttribute('open', '');
});

test('menu and section disclosure work with keyboard', async ({ page }) => {
  await page.locator('#settings-toggle').click();
  const cameraSummary = page.locator('details[data-group="camera"] > summary');
  await cameraSummary.focus();
  await page.keyboard.press('Enter');
  await expect(section(page, 'camera')).toHaveAttribute('open', '');
  await page.keyboard.press('Enter');
  await expect(section(page, 'camera')).not.toHaveAttribute('open', '');
  const enemySummary = page.locator('details[data-group="enemy"] > summary');
  await enemySummary.focus();
  await page.keyboard.press('Space');
  await expect(section(page, 'enemy')).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings-panel')).toBeHidden();
  await expect(page.locator('#settings-toggle')).toBeFocused();
});

test('persists changed settings across reload while resetting hero and target', async ({ page }) => {
  await page.locator('#settings-toggle').click();
  await page.locator('details[data-group="attack"] > summary').click();
  await page.locator('#param-damage').fill('17');
  await page.locator('#param-attackRange').fill('200');
  await page.locator('details[data-group="enemy"] > summary').click();
  await page.locator('#param-enemyAttackRange').fill('175');
  await page.locator('#param-enemyMoveSpeed').fill('220');
  await page.locator('#settings-toggle').click();
  await page.mouse.click(860, 360);
  await expect.poll(async () => (await snapshot(page)).enemy.hp).toBe(83);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.__arpg?.portraitReady()))).toBe(true);
  const state = await snapshot(page);
  expect(state.params.damage).toBe(17);
  expect(state.params.attackRange).toBe(200);
  expect(state.params.enemyAttackRange).toBe(175);
  expect(state.params.enemyMoveSpeed).toBe(220);
  expect(state.hero).toEqual({ x: 0, y: 0 });
  expect(state.enemy.hp).toBe(100);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).damage, STORAGE_KEY)).toBe(17);
});

test('restores default values without changing the separate interface state', async ({ page }) => {
  await page.locator('#settings-toggle').click();
  await page.locator('details[data-group="attack"] > summary').click();
  await page.locator('details[data-group="enemy"] > summary').click();
  await page.locator('details[data-group="layers"] > summary').click();
  await page.locator('details[data-group="spawners"] > summary').click();
  await page.locator('details[data-group="movement"] > summary').click();
  await page.locator('#param-maxSpeed').fill('310');
  await page.locator('#param-damage').fill('25');
  await page.locator('#param-autoAttackMode').selectOption('off');
  await page.locator('#param-autoContinueAttack').check();
  await page.locator('#param-autoRetaliate').check();
  await page.locator('#param-spawnersEnabled').uncheck();
  await page.locator('#param-spawnInterval').fill('12');
  await page.locator('#param-maxEnemies').fill('21');
  await page.locator('#settings-defaults').click();
  const state = await snapshot(page);
  expect(state.params.maxSpeed).toBe(240);
  expect(state.params.damage).toBe(10);
  expect(state.params.autoAttackMode).toBe('hover');
  expect(state.params.deathDuration).toBe(0.2);
  expect(state.params.enemyAttackRange).toBe(120);
  expect(state.params.enemyWindup).toBe(0.35);
  expect(state.params.baseLayerScale).toBe(1);
  expect(state.params.floorLayerScale).toBe(0.9);
  expect(state.params.autoContinueAttack).toBe(false);
  expect(state.params.autoRetaliate).toBe(false);
  expect(state.params.spawnersEnabled).toBe(true);
  expect(state.params.spawnInterval).toBe(6);
  expect(state.params.maxEnemies).toBe(8);
  expect(await page.locator('#param-maxSpeed').inputValue()).toBe('240');
  await expect(page.locator('#param-autoContinueAttack')).not.toBeChecked();
  await expect(page.locator('#param-autoRetaliate')).not.toBeChecked();
  await expect(page.locator('#param-spawnersEnabled')).toBeChecked();
  const ui = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), UI_STORAGE_KEY);
  expect(ui.sections.attack).toBe(true);
  expect(ui.sections.spawners).toBe(true);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).damage, STORAGE_KEY)).toBe(10);
});

test('malformed saved settings and UI state fall back to usable defaults', async ({ page }) => {
  await page.addInitScript(({ paramsKey, uiKey }) => {
    localStorage.setItem(paramsKey, '{malformed');
    localStorage.setItem(uiKey, JSON.stringify({ visible: 'yes', sections: { movement: 1, attack: true, layers: true } }));
  }, { paramsKey: STORAGE_KEY, uiKey: UI_STORAGE_KEY });
  await page.goto('/?test=1');
  await expect.poll(() => page.evaluate(() => Boolean(window.__arpg?.portraitReady()))).toBe(true);
  const state = await snapshot(page);
  expect(state.params.maxSpeed).toBe(240);
  expect(state.params.autoAttackMode).toBe('hover');
  expect(state.params.deathDuration).toBe(0.2);
  await expect(page.locator('#settings-panel')).toBeHidden();
  await expect(section(page, 'movement')).not.toHaveAttribute('open', '');
  await expect(section(page, 'attack')).toHaveAttribute('open', '');
  await expect(section(page, 'layers')).toHaveAttribute('open', '');
  await expect(section(page, 'enemy')).not.toHaveAttribute('open', '');
});

test('storage failures leave parameter editing and menu controls usable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = function () { throw new Error('storage disabled'); };
    Storage.prototype.setItem = function () { throw new Error('storage disabled'); };
  });
  await page.goto('/?test=1');
  await expect.poll(() => page.evaluate(() => Boolean(window.__arpg?.portraitReady()))).toBe(true);
  await expect(page.locator('#settings-panel')).toBeHidden();
  await page.locator('#settings-toggle').click();
  await expect(page.locator('#settings-status')).toHaveText('Настройки не удалось сохранить');
  await page.locator('details[data-group="movement"] > summary').click();
  await page.locator('#param-maxSpeed').fill('310');
  await expect.poll(async () => (await snapshot(page)).params.maxSpeed).toBe(310);
  await expect(page.locator('#settings-status')).toHaveText('Настройки не удалось сохранить');
  await page.locator('details[data-group="camera"] > summary').click();
  await expect(section(page, 'camera')).toHaveAttribute('open', '');
  await page.locator('details[data-group="enemy"] > summary').click();
  await page.locator('#param-enemyDamage').fill('22');
  await expect.poll(async () => (await snapshot(page)).params.enemyDamage).toBe(22);
  await page.locator('#settings-toggle').click();
  await expect(page.locator('#settings-panel')).toBeHidden();
});

test('zoomed target hit testing preserves its world position', async ({ page }) => {
  await page.locator('#settings-toggle').click();
  await page.locator('details[data-group="camera"] > summary').click();
  await page.locator('#range-cameraZoom').fill('1.5');
  const before = await snapshot(page);
  expect(before.hero).toEqual({ x: 0, y: 0 });
  expect(before.enemy.x).toBe(220);
  await page.locator('#settings-toggle').click();
  const enemyScreenX = before.viewport.width / 2 + (before.enemy.x - before.camera.x) * before.params.cameraZoom;
  const enemyScreenY = before.viewport.height / 2 + (before.enemy.y - before.camera.y) * before.params.cameraZoom;
  await page.mouse.click(enemyScreenX, enemyScreenY);
  await expect.poll(async () => (await snapshot(page)).combat.selected).toBe(true);
  const after = await snapshot(page);
  expect(after.enemy.x).toBe(before.enemy.x);
  expect(after.enemy.y).toBe(before.enemy.y);
});

test('menu opening cancels movement and attack, and its fields do not issue world commands', async ({ page }) => {
  await page.mouse.click(1100, 360);
  await expect.poll(async () => (await snapshot(page)).target).not.toBeNull();
  await expect.poll(async () => (await snapshot(page)).hero.x).toBeGreaterThan(0);
  await page.locator('#settings-toggle').click();
  let state = await snapshot(page);
  expect(state.target).toBeNull();
  expect(state.velocity).toEqual({ x: 0, y: 0 });

  await page.locator('details[data-group="attack"] > summary').click();
  await page.locator('#param-damage').fill('19');
  await expect.poll(async () => (await snapshot(page)).params.damage).toBe(19);
  state = await snapshot(page);
  expect(state.target).toBeNull();
  expect(state.pointer.down).toBe(false);
  expect(state.combat.phase).toBe('idle');

  await page.locator('#settings-toggle').click();
  await page.locator('#reset').click();
  await page.mouse.click(860, 360);
  await expect.poll(async () => (await snapshot(page)).combat.phase).toBe('approach');
  await page.locator('#settings-toggle').click();
  state = await snapshot(page);
  expect(state.combat.phase).toBe('idle');
  expect(state.combat.selected).toBe(false);
  expect(state.target).toBeNull();
});

test('narrow browser keeps hero and target visible above the open settings panel', async ({ page }) => {
  await page.setViewportSize({ width: 659, height: 760 });
  await page.locator('#settings-toggle').click();
  await expect(page.locator('#settings-panel')).toBeVisible();
  const panel = await page.locator('#settings-panel').boundingBox();
  const state = await snapshot(page);
  const heroY = state.viewport.height / 2;
  const targetX = state.viewport.width / 2 + (state.enemy.x - state.camera.x) * state.params.cameraZoom;
  expect(panel.y).toBeGreaterThan(heroY + 60);
  expect(targetX + state.enemy.radius * state.params.cameraZoom).toBeLessThan(state.viewport.width);
  await page.locator('details[data-group="movement"] > summary').click();
  await page.locator('details[data-group="attack"] > summary').click();
  await page.locator('#param-autoAttackMode').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/auto-engage-parameters.png' });
});
