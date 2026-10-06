import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIXED_STEP,
  createState as createBaseState,
  createLoop,
  step,
  getEnemies,
  findEnemyAt,
  worldToScreen,
  pointerDown,
  pointerMove,
  pointerUp,
  resize,
  resetWorld,
} from '../src/simulation.js';
import { addSkeleton } from './helpers.js';
function createState(width, height, params) {
  const state = createBaseState(width, height, { spawnersEnabled: false, ...params });
  addSkeleton(state, width / (2 * state.params.cameraZoom) + 240, 0, 'test-attacker');
  return state;
}

function tick(state, seconds) {
  for (let i = 0, count = Math.round(seconds / FIXED_STEP); i < count; i += 1) step(state, FIXED_STEP);
}

function until(state, predicate, seconds = 6) {
  for (let i = 0, limit = Math.ceil(seconds / FIXED_STEP); i < limit && !predicate(); i += 1) step(state, FIXED_STEP);
  assert.ok(predicate(), `condition not reached in ${seconds}s; pursuer phase=${state.spawnedEnemies[0].combat.phase}`);
}

function click(state, actor) {
  const point = worldToScreen(state, actor.x, actor.y);
  pointerDown(state, point.x, point.y);
}

function distanceToHero(state) {
  return Math.hypot(state.spawnedEnemies[0].x - state.hero.x, state.spawnedEnemies[0].y - state.hero.y);
}

test('initial world contains only the target at every viewport and zoom', () => {
  for (const [width, zoom] of [[800, .5], [1280, 1], [1600, 1.5]]) {
    const state = createBaseState(width, 720, { cameraZoom: zoom, spawnersEnabled: false });
    tick(state, 10);
    assert.deepEqual(getEnemies(state).map(actor => actor.id), ['target']);
    assert.equal('skeleton' in state, false); assert.equal('pursuer' in state, false);
  }
});

test('pursuer speed is normalized and frame-rate independent', () => {
  const traveled = [];
  for (const fps of [30, 60, 144]) {
    const state = createState(1280, 720, { enemyMoveSpeed: 110, enemyAttackRange: 40 });
    state.spawnedEnemies[0].x = 500;
    state.spawnedEnemies[0].y = 300;
    const start = { x: state.spawnedEnemies[0].x, y: state.spawnedEnemies[0].y };
    const loop = createLoop(state);
    for (let i = 0; i < fps / 2; i += 1) loop.advance(1 / fps);
    traveled.push(Math.hypot(state.spawnedEnemies[0].x - start.x, state.spawnedEnemies[0].y - start.y));
    assert.ok(Math.abs(traveled.at(-1) - 55) <= 110 * FIXED_STEP + 1e-6);
  }
  assert.ok(Math.max(...traveled) - Math.min(...traveled) <= 110 * FIXED_STEP + 1e-6);
});

test('pursuer approaches to attack range without overshooting and stays put during attacks', () => {
  const state = createState(1280, 720, { enemyAttackRange: 60, enemyMoveSpeed: 110 });
  state.enemy.y = 10000;
  state.spawnedEnemies[0].x = 300;
  state.spawnedEnemies[0].y = 0;
  until(state, () => state.spawnedEnemies[0].combat.phase === 'windup');
  assert.ok(Math.abs(distanceToHero(state) - (state.params.enemyAttackRange - 2)) < 1e-8);
  const arrived = { x: state.spawnedEnemies[0].x, y: state.spawnedEnemies[0].y };
  tick(state, state.params.enemyWindup + state.params.enemySwingDuration + state.params.enemyRecovery / 2);
  assert.deepEqual({ x: state.spawnedEnemies[0].x, y: state.spawnedEnemies[0].y }, arrived);

  state.hero = { x: 400, y: 0 };
  state.camera = { ...state.hero };
  until(state, () => state.spawnedEnemies[0].x > arrived.x + 1, 3);
  assert.ok(state.spawnedEnemies[0].x < state.hero.x, 'pursuer resumes direct approach toward the moved hero');
});

test('pursuer hit checks range again and follows after the hero leaves', () => {
  const state = createState(1280, 720, {
    enemyAttackRange: 120,
    enemyMoveSpeed: 400,
    enemyDamage: 10,
    enemyWindup: 0.1,
    enemySwingDuration: 0.2,
    enemyRecovery: 0.1,
  });
  state.spawnedEnemies[0].x = 120;
  until(state, () => state.spawnedEnemies[0].combat.phase === 'swing');
  tick(state, state.spawnedEnemies[0].combat.swingDuration / 2 + FIXED_STEP);
  assert.equal(state.heroStatus.hp, 90);

  until(state, () => state.spawnedEnemies[0].combat.attackCount >= 2 && state.spawnedEnemies[0].combat.phase === 'windup');
  const beforeEscape = state.spawnedEnemies[0].x;
  state.hero = { x: 500, y: 0 };
  state.camera = { ...state.hero };
  const current = state.spawnedEnemies[0].combat;
  tick(state, current.windup + current.swingDuration / 2 + FIXED_STEP);
  assert.equal(state.heroStatus.hp, 90);
  until(state, () => state.spawnedEnemies[0].x > beforeEscape + 1, 3);
});

test('pursuer is selectable by ID, dies through combat, becomes a walk-through corpse, and resets', () => {
  const state = createState(1280, 720, {
    damage: 50,
    attackRange: 200,
    enemyAttackRange: 40,
    enemyMoveSpeed: 0,
  });
  state.enemy.x = 10000;
  state.spawnedEnemies[0].x = 80;
  state.spawnedEnemies[0].y = 0;
  assert.ok(getEnemies(state).includes(state.spawnedEnemies[0]));
  const point = worldToScreen(state, state.spawnedEnemies[0].x, state.spawnedEnemies[0].y);
  assert.equal(findEnemyAt(state, point.x, point.y)?.id, 'test-attacker');

  click(state, state.spawnedEnemies[0]);
  assert.equal(state.combat.targetId, 'test-attacker');
  pointerUp(state);
  until(state, () => state.spawnedEnemies[0].hp === 50);
  until(state, () => state.combat.phase === 'idle');
  click(state, state.spawnedEnemies[0]);
  assert.equal(state.combat.targetId, 'test-attacker');
  pointerUp(state);
  until(state, () => state.spawnedEnemies[0].hp === 0);
  assert.equal(state.spawnedEnemies[0].layer, -1);
  assert.equal(findEnemyAt(state, point.x, point.y), undefined);
  const deadAt = { x: state.spawnedEnemies[0].x, y: state.spawnedEnemies[0].y };
  tick(state, 0.5);
  assert.deepEqual({ x: state.spawnedEnemies[0].x, y: state.spawnedEnemies[0].y }, deadAt);
  assert.equal(state.spawnedEnemies[0].combat.phase, 'idle');

  const corpsePoint = worldToScreen(state, state.spawnedEnemies[0].x, state.spawnedEnemies[0].y);
  pointerDown(state, corpsePoint.x, corpsePoint.y);
  pointerUp(state);
  until(state, () => state.target === null && Math.hypot(state.velocity.x, state.velocity.y) === 0);
  assert.deepEqual(state.hero, { x: state.spawnedEnemies[0].x, y: state.spawnedEnemies[0].y });
  assert.equal(state.spawnedEnemies[0].hp, 0);
  resetWorld(state);
  assert.deepEqual(state.spawnedEnemies, []);
  assert.deepEqual(state.hero, { x: 0, y: 0 });
});

test('zero movement speed holds outside range but still attacks a nearby hero', () => {
  const state = createState(1280, 720, { enemyMoveSpeed: 0, enemyAttackRange: 60 });
  state.spawnedEnemies[0].x = 500;
  const farPosition = { ...state.spawnedEnemies[0] };
  tick(state, 2);
  assert.deepEqual({ x: state.spawnedEnemies[0].x, y: state.spawnedEnemies[0].y }, { x: farPosition.x, y: farPosition.y });
  assert.equal(state.spawnedEnemies[0].combat.phase, 'idle');

  state.spawnedEnemies[0].x = 55;
  tick(state, FIXED_STEP);
  assert.equal(state.spawnedEnemies[0].combat.phase, 'windup');
  assert.equal(state.spawnedEnemies[0].combat.attackCount, 1);
  assert.equal(state.spawnedEnemies[0].x, 55);
});

test('hero death caused by pursuer clears both attacker cycles', () => {
  const state = createState(1280, 720, {
    enemyAttackRange: 120,
    enemyDamage: 10,
    enemyWindup: 0.05,
    enemySwingDuration: 0.05,
    enemyRecovery: 0.1,
    enemyMoveSpeed: 400,
  });
  state.enemy.x = 10000;
  const other = addSkeleton(state, 1000, 0, 'other-attacker');
  other.combat.phase = 'windup';
  other.combat.windup = 2;
  state.heroStatus.hp = 10;
  state.spawnedEnemies[0].x = 300;
  until(state, () => state.spawnedEnemies[0].combat.phase === 'windup');
  until(state, () => state.heroStatus.hp === 0, 1);
  assert.equal(other.combat.phase, 'idle');
  assert.equal(state.spawnedEnemies[0].combat.phase, 'idle');
  assert.equal(state.heroStatus.hp, 0);
  const deadPosition = { x: state.spawnedEnemies[0].x, y: state.spawnedEnemies[0].y };
  tick(state, 2);
  assert.deepEqual({ x: state.spawnedEnemies[0].x, y: state.spawnedEnemies[0].y }, deadPosition);
  assert.equal(other.combat.phase, 'idle');
  assert.equal(state.spawnedEnemies[0].combat.phase, 'idle');
});

test('resize and zoom leave existing enemy coordinates unchanged; reset removes it', () => {
  const state = createState(1280, 720, { cameraZoom: 1 });
  const initial = { x: state.spawnedEnemies[0].x, y: state.spawnedEnemies[0].y };
  state.params.cameraZoom = 0.75;
  resize(state, 900, 500);
  assert.deepEqual({ x: state.spawnedEnemies[0].x, y: state.spawnedEnemies[0].y }, initial);
  resetWorld(state);
  assert.deepEqual(state.spawnedEnemies, []);
});

test('hover and nearby auto-acquisition select the pursuer by ID', () => {
  for (const autoAttackMode of ['hover', 'nearby']) {
    const state = createState(1280, 720, { autoAttackMode, enemyAttackRange: 40, attackRange: 100 });
    state.spawnedEnemies[0].x = 80;
    const pursuerPoint = worldToScreen(state, state.spawnedEnemies[0].x, state.spawnedEnemies[0].y);
    pointerDown(state, autoAttackMode === 'hover' ? 640 : 1000, autoAttackMode === 'hover' ? 360 : 600);
    if (autoAttackMode === 'hover') pointerMove(state, pursuerPoint.x, pursuerPoint.y);
    until(state, () => state.combat.targetId === 'test-attacker', 0.5);
    assert.equal(state.combat.selected, true);
    pointerUp(state);
  }
});
