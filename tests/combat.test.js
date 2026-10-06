import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, createState, worldToScreen, pointerDown, pointerMove, pointerUp, step, resetWorld, hitTestEnemy } from '../src/simulation.js';

function tick(state, seconds) {
  for (let i = 0, count = Math.round(seconds / FIXED_STEP); i < count; i += 1) step(state, FIXED_STEP);
}

function tickUntil(state, predicate, limitSeconds = 8) {
  const limit = Math.ceil(limitSeconds / FIXED_STEP);
  for (let i = 0; i < limit && !predicate(); i += 1) step(state, FIXED_STEP);
  assert.ok(predicate(), `condition was not reached within ${limitSeconds}s; phase=${state.combat.phase}`);
}

function clickEnemy(state) {
  const point = worldToScreen(state, state.enemy.x, state.enemy.y);
  pointerDown(state, point.x, point.y);
}

test('short click auto-approaches, stops in range, then lands one strike', () => {
  const state = createState();
  clickEnemy(state);
  pointerUp(state);
  assert.equal(state.combat.selected, true);
  assert.equal(state.combat.phase, 'approach');
  tickUntil(state, () => state.combat.phase === 'windup');
  tick(state, 0.25);
  assert.equal(state.combat.phase, 'swing');
  assert.equal(state.enemy.hp, 100);
  tick(state, state.combat.swingDuration / 2 + FIXED_STEP);
  assert.equal(state.enemy.hp, 90);
  tickUntil(state, () => state.combat.phase === 'idle');
  assert.equal(state.combat.attackCount, 1);
  assert.equal(state.enemy.hp, 90);
  assert.ok(Math.hypot(state.enemy.x - state.hero.x, state.enemy.y - state.hero.y) <= state.params.attackRange);
  const stoppedAt = { ...state.hero };
  tick(state, 1);
  assert.deepEqual(state.hero, stoppedAt);
});

test('swing damages only once at its middle, after windup', () => {
  const state = createState(1280, 720, { attackRange: 200 });
  clickEnemy(state);
  pointerUp(state);
  tickUntil(state, () => state.combat.phase === 'windup');
  assert.equal(state.enemy.hp, 100);
  tick(state, state.combat.windup - FIXED_STEP);
  assert.equal(state.enemy.hp, 100);
  tickUntil(state, () => state.combat.phase === 'swing');
  assert.equal(state.enemy.hp, 100);
  tick(state, state.combat.swingDuration / 2 + FIXED_STEP);
  assert.equal(state.enemy.hp, 90);
  assert.equal(state.combat.hit, true);
  tick(state, state.combat.swingDuration);
  assert.equal(state.enemy.hp, 90);
});

test('hit rechecks range at strike time', () => {
  const state = createState(1280, 720, { attackRange: 200 });
  clickEnemy(state);
  pointerUp(state);
  tickUntil(state, () => state.combat.phase === 'swing');
  state.enemy.x += 500;
  tick(state, state.combat.swingDuration / 2 + FIXED_STEP);
  assert.equal(state.enemy.hp, 100);
  assert.equal(state.combat.hit, true);
});

test('held target repeats full attacks and release completes current attack only', () => {
  const state = createState(1280, 720, { attackRange: 200 });
  clickEnemy(state);
  tickUntil(state, () => state.combat.attackCount >= 2 && state.combat.phase === 'windup');
  const currentCount = state.combat.attackCount;
  pointerUp(state);
  tick(state, 3);
  assert.equal(state.combat.attackCount, currentCount);
  assert.equal(state.combat.phase, 'idle');
  assert.equal(state.enemy.hp, 100 - currentCount * state.params.damage);
});

test('release between repeated cycles cancels the next strike before it starts', () => {
  const state = createState(1280, 720, { attackRange: 200 });
  clickEnemy(state);
  tickUntil(state, () => state.combat.attackCount === 1 && state.combat.phase === 'recovery');
  tickUntil(state, () => state.combat.phase === 'approach');
  assert.equal(state.combat.attackCount, 1);
  pointerUp(state);
  step(state, FIXED_STEP);
  assert.equal(state.combat.phase, 'idle');
  assert.equal(state.combat.attackCount, 1);
  assert.equal(state.enemy.hp, 90);
});

test('attack sides alternate at each new windup', () => {
  const state = createState(1280, 720, { attackRange: 200 });
  clickEnemy(state);
  tickUntil(state, () => state.combat.phase === 'windup');
  const firstSide = state.combat.side;
  tickUntil(state, () => state.combat.attackCount >= 2 && state.combat.phase === 'windup');
  const secondSide = state.combat.side;
  assert.equal(firstSide, 1);
  assert.equal(secondSide, -1);
  pointerUp(state);
});

test('death immediately deselects target and ends repeats while held input resumes following after recovery', () => {
  const state = createState(1280, 720, { attackRange: 200, damage: 50 });
  // This scenario isolates target death; acquiring a new living enemy is tested separately.
  clickEnemy(state);
  tickUntil(state, () => state.enemy.hp === 0, 8);
  assert.equal(state.enemy.hp, 0);
  assert.equal(state.combat.selected, false);
  assert.equal(state.combat.repeat, false);
  assert.equal(state.enemy.deathElapsed, 0);
  assert.equal(state.combat.phase, 'swing');
  const point = worldToScreen(state, state.enemy.x, state.enemy.y);
  assert.equal(hitTestEnemy(state, point.x, point.y), false);
  const deathPosition = { ...state.hero };
  pointerMove(state, 1100, 360);
  tickUntil(state, () => state.combat.phase === 'idle');
  assert.deepEqual(state.hero, deathPosition);
  assert.equal(state.pointer.mode, 'move');
  tick(state, 2);
  assert.equal(state.enemy.hp, 0);
  assert.equal(state.combat.attackCount, 2);
  assert.equal(state.pointer.following, true);
  assert.ok(state.hero.x > state.enemy.x + state.enemy.radius);
  assert.equal(state.enemy.deathElapsed, state.params.deathDuration);
  pointerUp(state);
});

test('released killing blow finishes standing, corpse click moves to its center, and reset revives target', () => {
  const state = createState(1280, 720, { damage: 50 });
  state.enemy.hp = 50;
  clickEnemy(state); pointerUp(state);
  tickUntil(state, () => state.enemy.hp === 0);
  const position = { ...state.hero };
  tick(state, 2);
  assert.deepEqual(state.hero, position);
  assert.equal(state.combat.attackCount, 1);
  clickEnemy(state); pointerUp(state);
  assert.equal(state.combat.phase, 'idle');
  assert.deepEqual(state.target, { x: state.enemy.x, y: state.enemy.y });
  tickUntil(state, () => state.target === null && state.velocity.x === 0);
  assert.deepEqual(state.hero, { x: state.enemy.x, y: state.enemy.y });
  assert.equal(state.combat.attackCount, 1);
  resetWorld(state);
  assert.equal(state.enemy.hp, 100);
  assert.equal(state.enemy.deathElapsed, 0);
  const point = worldToScreen(state, state.enemy.x, state.enemy.y);
  assert.equal(hitTestEnemy(state, point.x, point.y), true);
});

test('hover capture uses current camera even with a stationary cursor and keeps target after cursor leaves', () => {
  const state = createState();
  pointerDown(state, 760, 360);
  tickUntil(state, () => state.pointer.mode === 'attack');
  assert.equal(state.pointer.x, 760);
  assert.equal(state.combat.selected, true);
  pointerMove(state, 200, 200);
  tickUntil(state, () => state.combat.phase === 'windup');
  assert.equal(state.combat.selected, true);
  pointerUp(state);
  tick(state, 2);
  assert.equal(state.combat.attackCount, 1);
});

test('hover acquisition uses rendered target position at every camera zoom', () => {
  for (const cameraZoom of [0.5, 1, 1.5]) {
    const state = createState(1280, 720, { cameraZoom });
    pointerDown(state, 200, 200);
    tick(state, 0.2);
    const p = worldToScreen(state, state.enemy.x, state.enemy.y);
    pointerMove(state, p.x, p.y);
    step(state, FIXED_STEP);
    assert.equal(state.pointer.mode, 'attack');
    assert.equal(state.combat.selected, true);
  }
});

test('nearby acquisition ignores cursor location and starts only after following threshold', () => {
  const state = createState(1280, 720, { autoAttackMode: 'nearby' });
  state.enemy.x = 80;
  pointerDown(state, 1000, 500);
  tick(state, state.params.holdDelay - FIXED_STEP);
  assert.equal(state.combat.phase, 'idle');
  tickUntil(state, () => state.pointer.mode === 'attack', 0.05);
  assert.equal(state.pointer.mode, 'attack');
  tickUntil(state, () => state.combat.phase === 'windup');
  assert.ok(Math.hypot(state.hero.x - 80, state.hero.y) <= state.params.attackRange);
  assert.deepEqual(state.velocity, { x: 0, y: 0 });
});

test('off retains following over target but explicit click still attacks', () => {
  const state = createState(1280, 720, { autoAttackMode: 'off' });
  pointerDown(state, 200, 200);
  tick(state, 0.2);
  const p = worldToScreen(state, state.enemy.x, state.enemy.y);
  pointerMove(state, p.x, p.y);
  step(state, FIXED_STEP);
  assert.equal(state.pointer.mode, 'move');
  assert.equal(state.combat.phase, 'idle');
  pointerUp(state);
  clickEnemy(state); pointerUp(state);
  tickUntil(state, () => state.combat.phase === 'windup');
  assert.equal(state.combat.attackCount, 1);
});

test('no mode attacks idle nearby targets or intercepts short ground clicks', () => {
  for (const autoAttackMode of ['off', 'hover', 'nearby']) {
    const state = createState(1280, 720, { autoAttackMode });
    state.enemy.x = 80;
    tick(state, 1);
    assert.equal(state.combat.attackCount, 0);
    pointerDown(state, 1000, 500); pointerUp(state);
    tick(state, 3);
    assert.equal(state.combat.attackCount, 0);
  }
});

test('ground click cancels attack phases and reset restores world while preserving parameters', () => {
  const state = createState(1280, 720, { maxSpeed: 180, damage: 25 });
  clickEnemy(state);
  tickUntil(state, () => state.combat.phase === 'windup');
  pointerDown(state, 1000, 600);
  assert.equal(state.combat.phase, 'idle');
  assert.equal(state.combat.selected, false);
  pointerUp(state);
  state.hero.x = -100;
  state.camera.x = -100;
  state.enemy.hp = 5;
  resetWorld(state);
  assert.deepEqual(state.hero, { x: 0, y: 0 });
  assert.deepEqual(state.camera, { x: 0, y: 0 });
  assert.equal(state.enemy.hp, 100);
  assert.equal(state.params.maxSpeed, 180);
  assert.equal(state.params.damage, 25);
  assert.equal(state.combat.attackCount, 0);
  assert.equal(state.combat.phase, 'idle');
});
