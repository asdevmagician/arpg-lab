import { test, expect } from '@playwright/test';
const snapshot = page => page.evaluate(() => window.__arpg.snapshot());

async function start(page, params = {}) {
  await page.addInitScript(params => {
    if (!localStorage.getItem('arpg-lab-parameters-v1')) localStorage.setItem('arpg-lab-parameters-v1', JSON.stringify(params));
  }, { spawnersEnabled: false, enemyMoveSpeed: 0, ...params });
  await page.goto('/?test=1');
  await expect.poll(() => page.evaluate(() => window.__arpg?.portraitReady())).toBe(true);
}
async function clickActor(page, actor) {
  const s = await snapshot(page), a = s[actor];
  await page.mouse.click(s.viewport.width / 2 + (a.x - s.camera.x) * s.params.cameraZoom,
    s.viewport.height / 2 + (a.y - s.camera.y) * s.params.cameraZoom);
}

test('a living target blocks a ground command, then remains attackable', async ({ page }) => {
  await start(page);
  await page.mouse.click(1000, 360);
  await expect.poll(async () => (await snapshot(page)).movementBlocked).toBe(true);
  const s = await snapshot(page);
  expect(s.target).toBeNull();
  expect(Math.abs(s.hero.x - 168)).toBeLessThan(0.001);
  await expect(page.locator('#mode')).toHaveText('Преграда');
  await clickActor(page, 'enemy');
  await expect.poll(async () => (await snapshot(page)).enemy.hp).toBe(90);
  expect((await snapshot(page)).movementBlocked).toBe(false);
});

test('dead target loses its collider and its center becomes reachable', async ({ page }) => {
  await start(page, { damage: 50, autoContinueAttack: true });
  await clickActor(page, 'enemy');
  await expect.poll(async () => (await snapshot(page)).enemy.hp).toBe(0);
  await expect.poll(async () => (await snapshot(page)).combat.phase).toBe('idle');
  await clickActor(page, 'enemy');
  await expect.poll(async () => (await snapshot(page)).hero).toEqual({ x: 220, y: 0 });
  expect((await snapshot(page)).enemy.layer).toBe(-1);
});

test('collider switches and radius persist, and disabling allows walking through a living target', async ({ page }) => {
  await start(page);
  await page.locator('#settings-toggle').click();
  await page.locator('details[data-group="collisions"] summary').click();
  await page.locator('#param-collisionsEnabled').uncheck();
  await page.locator('#param-showColliders').check();
  await page.locator('#param-collisionRadius').fill('40');
  await page.locator('#panel-close').click();
  await page.mouse.click(1100, 360);
  await expect.poll(async () => (await snapshot(page)).hero.x).toBe(460);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__arpg?.portraitReady())).toBe(true);
  expect((await snapshot(page)).params).toMatchObject({ collisionsEnabled: false, showColliders: true, collisionRadius: 40 });
});

test('debug circle uses the physical radius despite camera and portrait scale', async ({ page }) => {
  await start(page, { cameraZoom: 0.5, collisionRadius: 40, baseLayerScale: 0.5 });
  await page.locator('#settings-toggle').click();
  await page.locator('details[data-group="collisions"] summary').click();
  await page.locator('#param-showColliders').check();
  await page.locator('#panel-close').click();
  await expect.poll(() => page.evaluate(() => {
    const canvas = document.querySelector('#world'), ctx = canvas.getContext('2d');
    const pixels = ctx.getImageData(Math.round(658 * devicePixelRatio), Math.round(358 * devicePixelRatio),
      Math.round(5 * devicePixelRatio), Math.round(5 * devicePixelRatio)).data;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i + 1] > 80 && pixels[i + 2] > 80 && pixels[i + 2] - pixels[i] > 25) return true;
    return false;
  })).toBe(true);
  await page.locator('#settings-toggle').click();
  await page.screenshot({ path: 'artifacts/circular-colliders.png' });
});
