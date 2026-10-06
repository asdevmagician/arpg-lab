import test from 'node:test';
import { addSkeleton } from './helpers.js';
import assert from 'node:assert/strict';
import { createState, pointerDown, pointerMove, pointerUp, worldToScreen, step, FIXED_STEP } from '../src/simulation.js';

function runUntil(state, predicate, seconds = 4) {
  for (let i = 0; i < seconds / FIXED_STEP && !predicate(); i++) step(state, FIXED_STEP);
  return predicate();
}
function scenario(angle, radius, params = {}) {
  const state = createState(1280, 720, { spawnersEnabled: false, enemyMoveSpeed: 0, ...params });
  state.enemy.x = Math.cos(angle * Math.PI / 180) * radius;
  state.enemy.y = Math.sin(angle * Math.PI / 180) * radius;
  return state;
}

test('a live hero completes approach and attacks from every direction without resetting', () => {
  const failed = [];
  for (let angle = 0; angle < 360; angle++) {
    const state = scenario(angle, 220);
    const p = worldToScreen(state, state.enemy.x, state.enemy.y);
    pointerDown(state, p.x, p.y); pointerUp(state);
    if (!runUntil(state, () => state.enemy.hp < 100)) failed.push(angle);
    assert.equal(state.heroStatus.hp, 100);
  }
  assert.deepEqual(failed, [], `Approach stalled at angles: ${failed.join(', ')}`);
});

test('diagonal approach remains stable after hover, nearby and retaliation acquisition', () => {
  for (const mode of ['hover', 'nearby', 'retaliation']) {
    for (const angle of [42, 48, 127, 132, 222, 228, 312, 318]) {
      const state = scenario(angle, mode === 'nearby' ? 99.5 : 220,
        { autoAttackMode: mode, autoContinueAttack: true, autoRetaliate: true });
      if (mode === 'retaliation') {
        addSkeleton(state, state.enemy.x, state.enemy.y, 'test-attacker');
        state.enemy.x = 10000;
        state.params.enemyAttackRange = 240;
        assert.ok(runUntil(state, () => state.combat.targetId === 'test-attacker'));
      } else {
        pointerDown(state, 640, 360);
        if (mode === 'hover') {
          const p = worldToScreen(state, state.enemy.x, state.enemy.y);
          pointerMove(state, p.x, p.y);
        }
        assert.ok(runUntil(state, () => state.combat.selected));
        pointerUp(state);
      }
      const actor = mode === 'retaliation' ? state.spawnedEnemies[0] : state.enemy;
      assert.ok(runUntil(state, () => actor.hp <= 80), `${mode} stalled at ${angle} degrees`);
    }
  }
});
