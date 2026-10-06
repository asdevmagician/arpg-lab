import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, pointerDown, pointerUp, worldToScreen, resetWorld, FIXED_STEP, findEnemyAt } from '../src/simulation.js';
import { addSkeleton } from './helpers.js';

function tick(state, seconds) { for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) step(state, FIXED_STEP); }
function until(state, predicate, seconds = 6) {
  for (let i = 0; i < seconds / FIXED_STEP && !predicate(); i++) step(state, FIXED_STEP);
  assert.ok(predicate());
}
function click(state, actor) { const p = worldToScreen(state, actor.x, actor.y); pointerDown(state, p.x, p.y); }

test('two selectable enemies use world radii at every zoom and ignore corpses', () => {
  for (const cameraZoom of [0.5, 1, 1.5]) {
    const state = createState(1280, 720, { cameraZoom, baseLayerScale: 1.5 });
    const skeleton = addSkeleton(state, 160, -140); skeleton.mobile = false;
    for (const actor of [state.enemy, skeleton]) {
      const p = worldToScreen(state, actor.x, actor.y);
      assert.equal(findEnemyAt(state, p.x, p.y).id, actor.id);
      click(state, actor); pointerUp(state);
      assert.equal(state.combat.targetId, actor.id);
      actor.hp = 0;
      assert.equal(findEnemyAt(state, p.x, p.y), undefined);
    }
  }
});

test('nearby mode chooses closest living enemy and keeps it after cursor leaves', () => {
  const state = createState(1280, 720, { autoAttackMode: 'nearby' });
  state.enemy.x = 90; const skeleton = addSkeleton(state, 60, 0);
  pointerDown(state, 100, 600); until(state, () => state.combat.targetId !== null, 0.3);
  assert.equal(state.combat.targetId, skeleton.id);
  state.pointer.x = 1000; state.pointer.y = 600; tick(state, 0.1);
  assert.equal(state.combat.targetId, skeleton.id);
});

test('stationary spawned enemy telegraphs, hits once at midpoint, alternates and repeats', () => {
  const state = createState();
  const skeleton = addSkeleton(state, 160, -140); skeleton.mobile = false;
  state.hero = { x: skeleton.x - 100, y: skeleton.y };
  const position = { x: skeleton.x, y: skeleton.y };
  step(state, FIXED_STEP);
  assert.equal(skeleton.combat.phase, 'windup');
  assert.equal(skeleton.combat.side, 1);
  tick(state, state.params.enemyWindup - FIXED_STEP);
  assert.equal(state.heroStatus.hp, 100);
  until(state, () => skeleton.combat.phase === 'swing');
  tick(state, state.params.enemySwingDuration / 2 + FIXED_STEP);
  assert.equal(state.heroStatus.hp, 90);
  tick(state, state.params.enemySwingDuration / 2);
  assert.equal(state.heroStatus.hp, 90);
  until(state, () => skeleton.combat.attackCount === 2);
  assert.equal(skeleton.combat.side, -1);
  assert.deepEqual({ x: skeleton.x, y: skeleton.y }, position);
});

test('skeleton remains idle outside range and rechecks range after windup', () => {
  const state = createState();
  const skeleton = addSkeleton(state, 160, -140); skeleton.mobile = false;
  tick(state, 2);
  assert.equal(skeleton.combat.attackCount, 0);
  state.hero = { x: skeleton.x - 100, y: skeleton.y };
  step(state, FIXED_STEP);
  state.hero = { x: -500, y: -500 };
  tick(state, 2);
  assert.equal(state.heroStatus.hp, 100);
  assert.equal(skeleton.combat.attackCount, 1);
});

test('skeleton captures attack parameters and stops immediately upon death', () => {
  const state = createState();
  const skeleton = addSkeleton(state, 160, -140); skeleton.mobile = false;
  state.hero = { x: skeleton.x - 100, y: skeleton.y };
  step(state, FIXED_STEP);
  state.params.enemyDamage = 50; state.params.enemyAttackRange = 40;
  until(state, () => state.heroStatus.hp < 100);
  assert.equal(state.heroStatus.hp, 90);
  skeleton.hp = 0;
  tick(state, 2);
  assert.equal(skeleton.layer, -1);
  assert.equal(skeleton.combat.phase, 'idle');
  assert.equal(state.heroStatus.hp, 90);
});

test('hero death clears input and attacks, rejects movement, reset revives everyone', () => {
  const state = createState(1280, 720, { enemyDamage: 50 });
  const skeleton = addSkeleton(state, 160, -140); skeleton.mobile = false;
  state.hero = { x: skeleton.x - 100, y: skeleton.y };
  until(state, () => state.heroStatus.hp === 0);
  const position = { ...state.hero };
  assert.equal(state.heroStatus.layer, -1);
  assert.equal(state.heroStatus.deathElapsed, 0);
  assert.equal(state.pointer.down, false);
  assert.equal(state.combat.phase, 'idle');
  pointerDown(state, 1000, 500); tick(state, 3);
  assert.deepEqual(state.hero, position);
  assert.deepEqual(state.velocity, { x: 0, y: 0 });
  assert.equal(skeleton.combat.phase, 'idle');
  state.enemy.hp = 0;
  resetWorld(state);
  assert.deepEqual(state.hero, { x: 0, y: 0 });
  assert.equal(state.spawnedEnemies.length, 0);
  for (const actor of [state.heroStatus, state.enemy]) {
    assert.equal(actor.hp, 100); assert.equal(actor.layer, 0); assert.equal(actor.deathElapsed, 0);
  }
  assert.equal(state.params.enemyDamage, 50);
});

test('killing skeleton lowers its layer without cancelling player finishing trail', () => {
  const state = createState(1280, 720, { damage: 50, baseLayerScale: 1.2 });
  const skeleton = addSkeleton(state, 160, -140); skeleton.mobile = false;
  skeleton.hp = 50;
  click(state, skeleton); pointerUp(state);
  until(state, () => skeleton.hp === 0);
  assert.equal(skeleton.layer, -1);
  assert.equal(skeleton.deathStartScale, 1.2);
  assert.equal(state.combat.phase, 'swing');
  assert.equal(state.combat.repeat, false);
  assert.equal(skeleton.combat.phase, 'idle');
  until(state, () => state.combat.phase === 'idle');
  click(state, skeleton); pointerUp(state);
  until(state, () => state.target === null && Math.hypot(state.velocity.x, state.velocity.y) === 0);
  assert.deepEqual(state.hero, { x: skeleton.x, y: skeleton.y });
});
