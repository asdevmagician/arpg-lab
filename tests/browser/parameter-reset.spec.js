import { test, expect } from '@playwright/test';
import { PARAM_SCHEMA } from '../../src/settings.js';

const STORAGE_KEY = 'arpg-lab-parameters-v1';
const snapshot = page => page.evaluate(() => window.__arpg.snapshot());
const group = (page, name) => page.locator(`details[data-group="${name}"]`);
const openGroup = async (page, name) => {
  const section = group(page, name);
  if (!(await section.evaluate(node => node.open))) await section.locator('summary').click();
};

test.beforeEach(async ({ page }) => {
  await page.goto('/?test=1');
  await expect.poll(() => page.evaluate(() => Boolean(window.__arpg?.portraitReady()))).toBe(true);
  await page.locator('#settings-toggle').click();
});

test('per-parameter reset restores number, select, and checkbox only, then persists after reload', async ({ page }) => {
  await openGroup(page, 'camera');
  await openGroup(page, 'attack');

  await page.locator('#param-cameraZoom').fill('1.25');
  await page.locator('#param-autoAttackMode').selectOption('nearby');
  await page.locator('#param-autoContinueAttack').check();
  await page.locator('#param-damage').fill('23');

  const resetZoom = page.getByRole('button', { name: 'Сбросить значение: Камера — Масштаб камеры' });
  const resetMode = page.getByRole('button', { name: 'Сбросить значение: Атака — Автопереход к атаке' });
  const resetRepeat = page.getByRole('button', { name: 'Сбросить значение: Атака — Продолжать атаку автоматически' });
  await expect(resetZoom).toHaveAttribute('title', 'По умолчанию: 1.00 ×');
  await expect(resetMode).toHaveAttribute('title', 'По умолчанию: Курсор над целью');
  await expect(resetRepeat).toHaveAttribute('title', 'По умолчанию: выключено');
  const labels = await page.locator('.parameter-reset').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
  expect(labels).toHaveLength(PARAM_SCHEMA.length);
  expect(new Set(labels).size).toBe(labels.length);

  await resetZoom.click();
  await expect(page.locator('#param-cameraZoom')).toHaveValue('1.00');
  await expect(page.locator('#range-cameraZoom')).toHaveValue('1');
  await expect(group(page, 'camera')).toHaveAttribute('open', '');
  await expect(group(page, 'attack')).toHaveAttribute('open', '');
  await expect.poll(async () => (await snapshot(page)).params.cameraZoom).toBe(1);
  expect((await snapshot(page)).params).toMatchObject({ autoAttackMode: 'nearby', autoContinueAttack: true, damage: 23 });

  await resetMode.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#param-autoAttackMode')).toHaveValue('hover');
  await resetRepeat.click();
  await expect(page.locator('#param-autoContinueAttack')).not.toBeChecked();
  await expect.poll(async () => {
    const { params } = await snapshot(page);
    return [params.autoAttackMode, params.autoContinueAttack, params.damage];
  }).toEqual(['hover', false, 23]);

  await page.locator('#settings-toggle').click();
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.__arpg?.portraitReady()))).toBe(true);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved).toMatchObject({ cameraZoom: 1, autoAttackMode: 'hover', autoContinueAttack: false, damage: 23 });
});

test('global defaults action still resets all parameters', async ({ page }) => {
  await openGroup(page, 'attack');
  await page.locator('#param-damage').fill('31');
  await page.locator('#param-autoAttackMode').selectOption('off');
  await page.locator('#settings-defaults').click();
  await expect.poll(async () => {
    const { params } = await snapshot(page);
    return [params.damage, params.autoAttackMode, params.collisionRadius];
  }).toEqual([10, 'hover', 26]);
});
