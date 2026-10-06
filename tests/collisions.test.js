import test from 'node:test';
import { addSkeleton } from './helpers.js';
import assert from 'node:assert/strict';
import { moveCircle, separateCircles } from '../src/collisions.js';
import { createState, step, FIXED_STEP, pointerDown, pointerUp, worldToScreen, getEnemies } from '../src/simulation.js';

const tick = (state, seconds) => { for (let i = 0; i < seconds / FIXED_STEP; i++) step(state, FIXED_STEP); };
function world(params = {}) {
  const s = createState(1280, 720, { spawnersEnabled: false, enemyMoveSpeed: 0, ...params });
  s.enemy.x = 100; s.enemy.y = 0;
  return s;
}
function clickGround(s, x, y) {
  const p = worldToScreen(s, x, y); pointerDown(s, p.x, p.y); pointerUp(s);
}

test('sweep blocks a path crossing an entire circle, including a long frame', () => {
  const result = moveCircle({ x: 0, y: 0 }, { x: 1000, y: 0 }, 26, [{ x: 100, y: 0, radius: 26 }]);
  assert.ok(Math.abs(result.x - 48) < 1e-5);
  assert.equal(result.y, 0);
  const s = world({ maxSpeed: 600, accelerationTime: 0.05 });
  clickGround(s, 500, 0); step(s, 0.5);
  assert.ok(s.hero.x <= 48 && s.hero.x > 47.99);
  step(s, 0.5);
  assert.equal(s.movementBlocked, true); assert.equal(s.target, null);
  assert.deepEqual(s.velocity, { x: 0, y: 0 });
});

test('an oblique contact preserves tangent travel without penetrating the circle', () => {
  const result = moveCircle({ x: 0, y: 0 }, { x: 200, y: 40 }, 26, [{ x: 100, y: 0, radius: 26 }]);
  assert.ok(result.y > 40);
  assert.ok(Math.hypot(result.x - 100, result.y) >= 52 - 1e-5);
  assert.ok(result.x > 48);
});

test('multiple contacts do not tunnel through a closed gap', () => {
  const obstacles = [{ x: 100, y: -40, radius: 26 }, { x: 100, y: 40, radius: 26 }];
  const result = moveCircle({ x: 0, y: 0 }, { x: 400, y: 0 }, 26, obstacles);
  for (const actor of obstacles) assert.ok(Math.hypot(result.x - actor.x, result.y - actor.y) >= 52 - 1e-5);
  assert.ok(result.x < 100);
});

test('overlap correction preserves anchored targets and does not push a stationary hero with enemies', () => {
  const hero = { x: 0, y: 0 }, enemy = { x: 0, y: 0 }, fixed = { x: 10, y: 0 };
  separateCircles([{ position: hero, priority: 1 }, { position: enemy, priority: 0 }], 26);
  assert.deepEqual(hero, { x: 0, y: 0 });
  assert.ok(Math.hypot(enemy.x, enemy.y) >= 52);
  separateCircles([{ position: hero, priority: 1 }, { position: fixed, priority: 2 }], 26);
  assert.deepEqual(fixed, { x: 10, y: 0 });
  assert.ok(Math.hypot(hero.x - fixed.x, hero.y - fixed.y) >= 52);
});

test('corpse circles disappear immediately and disabled collisions restore free movement', () => {
  for (const condition of ['dead', 'disabled']) {
    const s = world();
    if (condition === 'dead') s.enemy.hp = 0;
    else s.params.collisionsEnabled = false;
    clickGround(s, 200, 0); tick(s, 2);
    assert.deepEqual(s.hero, { x: 200, y: 0 });
  }
});

test('living target attacks work before physical contact and remain cancellable after a blocked move', () => {
  const s = world();
  clickGround(s, 300, 0); tick(s, 2);
  assert.equal(s.movementBlocked, true);
  const p = worldToScreen(s, s.enemy.x, s.enemy.y);
  pointerDown(s, p.x, p.y); pointerUp(s); tick(s, 1);
  assert.equal(s.enemy.hp, 90);
  assert.equal(s.movementBlocked, false);
  assert.ok(Math.hypot(s.hero.x - s.enemy.x, s.hero.y - s.enemy.y) >= 52 - 1e-5);
});

test('twenty pursuing enemies remain separated from each other and the hero', () => {
  const s = world({ enemyMoveSpeed: 400, enemyDamage: 1 }); s.enemy.x = 10000;
  for (let i = 0; i < 20; i++) addSkeleton(s, Math.cos(i * Math.PI / 10) * 300, Math.sin(i * Math.PI / 10) * 300);
  for (let i = 0; i < 360; i++) {
    step(s, FIXED_STEP);
    const actors = [s.hero, ...getEnemies(s).filter(actor => actor.hp > 0)];
    for (let a = 0; a < actors.length; a++) for (let b = a + 1; b < actors.length; b++)
      assert.ok(Math.hypot(actors[a].x - actors[b].x, actors[a].y - actors[b].y) >= 52 - 1e-5, `overlap at frame ${i}`);
  }
  assert.deepEqual(s.hero, { x: 0, y: 0 });
});

test('radius changes and re-enabling collisions separate living actors without moving fixed targets', () => {
  const s = world({ collisionsEnabled: false });
  const attacker = addSkeleton(s, 20, 0); step(s, FIXED_STEP);
  s.params.collisionsEnabled = true; s.params.collisionRadius = 40;
  tick(s, 0.2);
  assert.equal(s.enemy.x, 100);
  assert.ok(Math.hypot(s.hero.x - attacker.x, s.hero.y - attacker.y) >= 80 - 1e-5);
});

test('camera and portrait scales leave physical radius and collision paths unchanged', () => {
  const positions = [];
  for (const zoom of [0.5, 1, 1.5]) {
    const s = world({ cameraZoom: zoom, baseLayerScale: 1.5, floorLayerScale: 0.5 });
    clickGround(s, 300, 0); tick(s, 2); positions.push(s.hero);
    assert.equal(s.enemy.radius, 26);
  }
  assert.deepEqual(positions[0], positions[1]); assert.deepEqual(positions[1], positions[2]);
});
