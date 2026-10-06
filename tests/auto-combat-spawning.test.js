import test from 'node:test';
import { addSkeleton } from './helpers.js';
import assert from 'node:assert/strict';
import { createState, step, FIXED_STEP, pointerDown, pointerMove, pointerUp, cancelInput, resetWorld, worldToScreen, getEnemies } from '../src/simulation.js';

const tick = (state, seconds) => { for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) step(state, FIXED_STEP); };
function until(state, predicate, seconds = 6) {
  for (let i = 0; i < seconds / FIXED_STEP && !predicate(); i++) step(state, FIXED_STEP);
  assert.ok(predicate(), `unreached condition: ${state.combat.phase}`);
}
function click(state, actor) { const p = worldToScreen(state, actor.x, actor.y); pointerDown(state, p.x, p.y); }
function isolated(params = {}) {
  const state = createState(1280, 720, { spawnersEnabled: false, ...params });
  return state;
}

test('auto continuation survives release after click, hover and nearby acquisition', () => {
  for (const mode of ['click', 'hover', 'nearby']) {
    const state = isolated({ autoContinueAttack: true, autoAttackMode: mode === 'click' ? 'off' : mode });
    state.enemy.x = 80;
    if (mode === 'click') click(state, state.enemy);
    else {
      pointerDown(state, 640, 360);
      if (mode === 'hover') { const p = worldToScreen(state, 80, 0); pointerMove(state, p.x, p.y); }
      until(state, () => state.combat.selected);
    }
    pointerUp(state);
    until(state, () => state.enemy.hp <= 80);
    assert.equal(state.pointer.down, false);
    assert.equal(state.combat.targetId, 'target');
    assert.ok(state.combat.attackCount >= 2);
  }
});

test('auto continuation stops on ground command, cancellation, disabling and target death', () => {
  for (const action of ['ground', 'cancel', 'disable', 'death']) {
    const state = isolated({ autoContinueAttack: true, damage: 50 }); state.enemy.x = 80;
    click(state, state.enemy); pointerUp(state);
    until(state, () => state.combat.phase === 'windup');
    if (action === 'ground') { pointerDown(state, 100, 600); pointerUp(state); }
    else if (action === 'cancel') cancelInput(state);
    else if (action === 'disable') state.params.autoContinueAttack = false;
    tick(state, 2);
    assert.equal(state.combat.phase, 'idle');
    if (action === 'death') { assert.equal(state.enemy.hp, 0); assert.equal(state.combat.attackCount, 2); }
    else assert.equal(state.combat.attackCount, 1);
  }
});

test('retaliation chooses the damaging enemy, optionally repeats, and does not require continuation', () => {
  for (const autoContinueAttack of [false, true]) {
    const state = isolated({ autoRetaliate: true, autoContinueAttack, enemyMoveSpeed: 0, enemyDamage: 1, enemyRecovery: 3 });
    const attacker = addSkeleton(state, 110, 0, 'test-attacker');
    until(state, () => state.heroStatus.hp < 100);
    assert.equal(state.combat.targetId, 'test-attacker');
    until(state, () => attacker.hp === 90);
    tick(state, 1);
    if (autoContinueAttack) assert.ok(state.combat.attackCount > 1);
    else assert.equal(state.combat.attackCount, 1);
  }
});

test('received damage respects disabled retaliation, movement, held input and existing target', () => {
  for (const mode of ['disabled', 'movement', 'held', 'attacking']) {
    const state = isolated({ autoRetaliate: mode !== 'disabled', enemyMoveSpeed: 0, enemyWindup: 0.05, enemySwingDuration: 0.05 });
    addSkeleton(state, 100, 0, 'test-attacker');
    if (mode === 'movement') { pointerDown(state, 1100, 360); pointerUp(state); }
    if (mode === 'held') pointerDown(state, 640, 360);
    if (mode === 'attacking') { state.enemy.x = -80; click(state, state.enemy); pointerUp(state); }
    until(state, () => state.heroStatus.hp < 100, 1);
    assert.notEqual(state.combat.targetId, 'test-attacker');
    if (mode === 'attacking') assert.equal(state.combat.targetId, 'target');
  }
});

test('spawns rotate all four sides outside the current camera at every zoom', () => {
  for (const cameraZoom of [0.5, 1, 1.5]) {
    const state = createState(700, 500, { spawnInterval: 0.5, enemyMoveSpeed: 0, maxEnemies: 8, cameraZoom });
    state.hero = { x: -1000, y: 800 }; state.camera = { ...state.hero };
    tick(state, 0.5 - FIXED_STEP); assert.equal(state.spawnedEnemies.length, 0);
    tick(state, FIXED_STEP);
    tick(state, 1.5);
    assert.deepEqual(state.spawnedEnemies.map(a => a.spawnSide), ['top', 'right', 'bottom', 'left']);
    for (const actor of state.spawnedEnemies) {
      const p = worldToScreen(state, actor.x, actor.y);
      const extent = (actor.radius + 8) * cameraZoom;
      assert.ok(p.x + extent < 0 || p.x - extent > 700 || p.y + extent < 0 || p.y - extent > 500);
    }
    assert.equal(new Set(getEnemies(state).map(a => a.id)).size, 5);
  }
});

test('cap counts spawned living attackers only, excludes corpses/target, and never queues a burst', () => {
  const state = createState(1280, 720, { spawnInterval: 0.5, enemyMoveSpeed: 0, maxEnemies: 3 });
  tick(state, 5); assert.equal(state.spawnedEnemies.length, 3);
  state.spawnedEnemies[0].hp = 0;
  step(state, FIXED_STEP); assert.equal(state.spawnedEnemies.length, 4);
  tick(state, 0.2); assert.equal(state.spawnedEnemies.length, 4);
  state.params.maxEnemies = 0;
  tick(state, 2); assert.equal(state.spawnedEnemies.length, 4);
  assert.equal(state.enemy.hp, 100);
});

test('spawner disable, hero death and reset stop timers and clear the generated world', () => {
  const state = createState(1280, 720, { spawnInterval: 0.5, enemyMoveSpeed: 0 });
  tick(state, 0.3); state.params.spawnersEnabled = false;
  tick(state, 1); assert.equal(state.spawner.elapsed, 0); assert.equal(state.spawnedEnemies.length, 0);
  state.params.spawnersEnabled = true;
  tick(state, 0.5); assert.equal(state.spawnedEnemies.length, 1);
  state.heroStatus.hp = 0;
  tick(state, 2); assert.equal(state.spawnedEnemies.length, 1);
  resetWorld(state);
  assert.equal(state.spawnedEnemies.length, 0); assert.equal(state.spawner.elapsed, 0);
  tick(state, 0.5);
  assert.equal(state.spawnedEnemies[0].id, 'spawn-1'); assert.equal(state.spawnedEnemies[0].spawnSide, 'top');
});

test('spawned actors chase, can be selected, and stop moving after death', () => {
  const state = isolated({ spawnersEnabled: true, spawnInterval: 0.5, maxEnemies: 8 });
  tick(state, 0.5);
  const actor = state.spawnedEnemies[0]; const start = { x: actor.x, y: actor.y };
  tick(state, 0.1); assert.ok(Math.hypot(actor.x - start.x, actor.y - start.y) > 0);
  click(state, actor); pointerUp(state); assert.equal(state.combat.targetId, actor.id);
  actor.hp = 0; const deadPosition = { x: actor.x, y: actor.y };
  tick(state, 1); assert.deepEqual({ x: actor.x, y: actor.y }, deadPosition);
  assert.equal(actor.layer, -1); assert.equal(actor.combat.phase, 'idle');
});
