import { test, expect } from '@playwright/test';

const snapshot = page => page.evaluate(() => window.__arpg.snapshot());
const enemyPoint = async page => {
  const s = await snapshot(page);
  return { x: s.viewport.width / 2 + (s.enemy.x - s.camera.x) * s.params.cameraZoom, y: s.viewport.height / 2 + (s.enemy.y - s.camera.y) * s.params.cameraZoom };
};
const clickEnemy = async page => { const p = await enemyPoint(page); await page.mouse.click(p.x, p.y); };
const openSettings = async page => page.locator('#settings-toggle').click();
const editParam = async (page, id, value) => {
  await openSettings(page);
  const groupName = id === 'cameraZoom' ? 'camera' : 'attack';
  const group = page.locator(`details.parameter-group[data-group="${groupName}"]`);
  if (!(await group.evaluate(node => node.open))) await group.locator('summary').click();
  await page.locator(`#param-${id}`).fill(String(value));
  await page.locator(`#param-${id}`).blur();
  await openSettings(page);
};
const chooseAttackMode = async (page, mode) => {
  await openSettings(page);
  const group = page.locator('details.parameter-group[data-group="attack"]');
  if (!(await group.evaluate(node => node.open))) await group.locator('summary').click();
  await page.locator('#param-autoAttackMode').selectOption(mode);
  await openSettings(page);
};

test.beforeEach(async ({ page }) => {
  await page.goto('/?test=1');
  await expect.poll(() => page.evaluate(() => Boolean(window.__arpg?.portraitReady()))).toBe(true);
  await expect(page.locator('#settings-panel')).toBeHidden();
});

test('clicking target approaches automatically and deals exactly one hit after standing windup', async ({ page }) => {
  const initial = await snapshot(page);
  expect(initial.enemy.hp).toBe(100);
  await clickEnemy(page);
  await page.waitForFunction(() => window.__arpg.snapshot().combat.phase === 'windup');
  const windup = await snapshot(page);
  expect(windup.enemy.hp).toBe(100);
  expect(windup.hero.x).toBeGreaterThan(0);
  expect(Math.hypot(windup.enemy.x - windup.hero.x, windup.enemy.y - windup.hero.y)).toBeLessThanOrEqual(windup.params.attackRange);
  expect(windup.velocity).toEqual({ x: 0, y: 0 });
  await expect.poll(async () => (await snapshot(page)).enemy.hp).toBe(90);
  await expect.poll(async () => (await snapshot(page)).combat.phase).toBe('idle');
  await page.waitForTimeout(700);
  const final = await snapshot(page);
  expect(final.enemy.hp).toBe(90);
  expect(final.combat.attackCount).toBe(1);
  expect(final.hero).toEqual(windup.hero);
});

test('held target produces alternating strikes and release prevents another attack', async ({ page }) => {
  const p = await enemyPoint(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForFunction(() => window.__arpg.snapshot().combat.phase === 'windup');
  expect((await snapshot(page)).combat.side).toBe(1);
  await page.mouse.move(300, 200);
  await page.waitForFunction(() => window.__arpg.snapshot().combat.attackCount === 2);
  expect((await snapshot(page)).combat.side).toBe(-1);
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).combat.phase).toBe('idle');
  const final = await snapshot(page);
  expect(final.enemy.hp).toBe(80);
  expect(final.combat.attackCount).toBe(2);
  await page.waitForTimeout(700);
  expect((await snapshot(page)).combat.attackCount).toBe(2);
});

test('ground command cancels windup and focus loss cancels held attack without damage', async ({ page }) => {
  await clickEnemy(page);
  await page.waitForFunction(() => window.__arpg.snapshot().combat.phase === 'windup');
  await page.mouse.click(400, 200);
  expect((await snapshot(page)).combat.phase).toBe('idle');
  await page.waitForTimeout(500);
  expect((await snapshot(page)).enemy.hp).toBe(100);
  await page.locator('#reset').click();
  const p = await enemyPoint(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForFunction(() => window.__arpg.snapshot().combat.phase === 'windup');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  const stopped = await snapshot(page);
  expect(stopped.combat.phase).toBe('idle');
  expect(stopped.combat.repeat).toBe(false);
  await page.waitForTimeout(700);
  expect((await snapshot(page)).enemy.hp).toBe(100);
  expect((await snapshot(page)).hero).toEqual(stopped.hero);
});

test('dead target is not selectable, can be walked through, and reset restores it and keeps parameters', async ({ page }) => {
  await editParam(page, 'damage', 50);
  const p = await enemyPoint(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).enemy.hp).toBe(0);
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).combat.phase).toBe('idle');
  await expect.poll(async () => (await snapshot(page)).target).toBeNull();
  await expect.poll(async () => (await snapshot(page)).velocity).toEqual({ x: 0, y: 0 });
  const dead = await snapshot(page);
  expect(dead.enemy).toMatchObject({ id: 'target', x: 220, y: 0, hp: 0, maxHp: 100 });
  expect(dead.combat.attackCount).toBe(2);

  const corpse = await enemyPoint(page);
  await page.mouse.click(corpse.x, corpse.y);
  await expect.poll(async () => (await snapshot(page)).hero.x).toBeCloseTo(220, 2);
  const walkedThrough = await snapshot(page);
  expect(walkedThrough.combat.selected).toBe(false);
  expect(walkedThrough.combat.attackCount).toBe(2);
  expect(walkedThrough.enemy.hp).toBe(0);

  await page.locator('#reset').click();
  const reset = await snapshot(page);
  expect(reset.hero).toEqual({ x: 0, y: 0 });
  expect(reset.enemy.hp).toBe(100);
  expect(reset.params.damage).toBe(50);
  expect(reset.combat.attackCount).toBe(0);
});

test('held attack stops after death then resumes cursor following without another strike', async ({ page }) => {
  await editParam(page, 'damage', 50);
  const p = await enemyPoint(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).enemy.hp).toBe(0);
  await expect.poll(async () => (await snapshot(page)).enemy.deathElapsed).toBeGreaterThan(0);
  const death = await snapshot(page);
  await expect.poll(async () => (await snapshot(page)).combat.attackCount).toBe(2);
  await page.waitForFunction(() => window.__arpg.snapshot().pointer.following === true);
  await expect.poll(async () => (await snapshot(page)).hero.x).toBeGreaterThan(death.hero.x);
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).combat.phase).toBe('idle');
  const resumed = await snapshot(page);
  expect(resumed.enemy.hp).toBe(0);
  expect(resumed.combat.attackCount).toBe(2);
  expect(resumed.hero.x).toBeGreaterThan(death.hero.x);
});

test('health ring disappears and portrait becomes grayscale after death', async ({ page }) => {
  await editParam(page, 'damage', 50);
  const point = await enemyPoint(page);
  const livePortrait = await sampleAt(page, point.x + 20, point.y);
  const liveRing = await sampleAt(page, point.x, point.y - 32);
  const liveEdge = await sampleAt(page, point.x + 26, point.y);
  const liveOutside = await sampleAt(page, point.x + 31, point.y);
  await page.locator('canvas').screenshot({ path: 'artifacts/auto-engage-alive.png' });
  await clickEnemy(page);
  await expect.poll(async () => (await snapshot(page)).enemy.hp).toBe(50);
  await expect.poll(async () => (await snapshot(page)).combat.phase).toBe('idle');
  await page.locator('canvas').screenshot({ path: 'artifacts/auto-engage-half-health.png' });
  await clickEnemy(page);
  await expect.poll(async () => (await snapshot(page)).enemy.hp).toBe(0);
  await expect.poll(async () => (await snapshot(page)).enemy.deathElapsed).toBeGreaterThan(0.19);
  const deadPoint = await enemyPoint(page);
  const deadState = await snapshot(page);
  const deadPortrait = await sampleAt(page, deadPoint.x + 20, deadPoint.y);
  const deadRing = await sampleAt(page, deadPoint.x, deadPoint.y - 32);
  const deadEdge = await sampleAt(page, deadPoint.x + 26, deadPoint.y);
  const deadOutside = await sampleAt(page, deadPoint.x + 31, deadPoint.y);
  const heroRing = await sampleAt(page, deadState.viewport.width / 2 + 32 * deadState.params.cameraZoom, deadState.viewport.height / 2);
  await page.locator('canvas').screenshot({ path: 'artifacts/auto-engage-dead.png' });
  expect(Math.max(livePortrait[0], livePortrait[1], livePortrait[2]) - Math.min(livePortrait[0], livePortrait[1], livePortrait[2])).toBeGreaterThan(20);
  expect(Math.max(deadPortrait[0], deadPortrait[1], deadPortrait[2]) - Math.min(deadPortrait[0], deadPortrait[1], deadPortrait[2])).toBeLessThan(8);
  expect(liveRing).not.toEqual(deadRing);
  expect(liveEdge).not.toEqual(liveOutside);
  expect(deadEdge).toEqual(deadOutside);
  expect(heroRing[1]).toBeGreaterThan(heroRing[0]);
  await page.locator('#reset').click();
  const restoredPoint = await enemyPoint(page);
  const restored = await sampleAt(page, restoredPoint.x + 20, restoredPoint.y);
  expect(restored).toEqual(livePortrait);
  expect(await sampleAt(page, restoredPoint.x + 26, restoredPoint.y)).toEqual(liveEdge);
  await page.locator('canvas').screenshot({ path: 'artifacts/auto-engage-restored.png' });
});

async function sampleAt(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const ctx = document.querySelector('canvas').getContext('2d');
    const dpr = devicePixelRatio;
    return [...ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data];
  }, { x, y });
}

test('auto attack modes off, hover, and nearby control acquisition during held following', async ({ page }) => {
  await chooseAttackMode(page, 'off');
  await page.mouse.move(760, 360);
  await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).pointer.following).toBe(true);
  await page.waitForTimeout(1100);
  let state = await snapshot(page);
  expect(state.combat.attackCount).toBe(0);
  expect(state.combat.selected).toBe(false);
  await page.mouse.up();

  await page.locator('#reset').click();
  await chooseAttackMode(page, 'hover');
  await page.mouse.move(760, 360);
  await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).combat.selected).toBe(true);
  await expect.poll(async () => (await snapshot(page)).combat.phase).not.toBe('idle');
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).combat.phase).toBe('idle');
  state = await snapshot(page);
  expect(state.combat.attackCount).toBe(1);

  await page.locator('#reset').click();
  await chooseAttackMode(page, 'nearby');
  await page.mouse.move(900, 360);
  await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).combat.selected).toBe(true);
  await expect.poll(async () => (await snapshot(page)).combat.phase).not.toBe('idle');
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).combat.phase).toBe('idle');
  expect((await snapshot(page)).combat.attackCount).toBeGreaterThanOrEqual(1);
});

test('zoomed target is picked at its rendered location and windup holds hero still', async ({ page }) => {
  await editParam(page, 'cameraZoom', 0.5);
  await editParam(page, 'windup', 0.8);
  await clickEnemy(page);
  await page.waitForFunction(() => window.__arpg.snapshot().combat.phase === 'windup');
  const windup = await snapshot(page);
  await page.waitForTimeout(300);
  expect((await snapshot(page)).hero).toEqual(windup.hero);
  expect((await snapshot(page)).enemy.hp).toBe(100);
  await expect.poll(async () => (await snapshot(page)).enemy.hp).toBe(90);
});
