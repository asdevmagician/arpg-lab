import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, pointerDown, pointerUp, cancelInput, step, FIXED_STEP } from '../src/simulation.js';
import {
  DEFAULT_PARAMS,
  PARAM_SCHEMA,
  sanitizeParameters,
  updateParameters,
  loadParameters,
  saveParameters,
  STORAGE_KEY,
  AUTO_ATTACK_MODES,
  UI_STORAGE_KEY,
  DEFAULT_UI_STATE,
  loadInterfaceState,
  saveInterfaceState,
  sanitizeInterfaceState,
} from '../src/settings.js';

function memoryStorage(initial = null) {
  const data = new Map();
  if (initial !== null) data.set(STORAGE_KEY, initial);
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
  };
}

test('defaults and schema cover movement, camera, attack modes, and death timing', () => {
  assert.deepEqual(DEFAULT_PARAMS, {
    maxSpeed: 240,
    accelerationTime: 0.3,
    brakingTime: 0.2,
    turnTime: 0.2,
    cameraZoom: 1,
    windup: 0.2,
    swingDuration: 0.16,
    recovery: 0.24,
    attackRange: 100,
    damage: 10,
    autoAttackMode: 'hover',
    deathDuration: 0.2,
    enemyAttackRange: 120,
    enemyDamage: 10,
    enemyWindup: 0.35,
    enemySwingDuration: 0.18,
    enemyRecovery: 0.6,
    enemyMoveSpeed: 110,
    collisionsEnabled: true,
    showColliders: false,
    collisionRadius: 26,
    baseLayerScale: 1,
    floorLayerScale: 0.9,
    autoContinueAttack: false,
    autoRetaliate: false,
    spawnersEnabled: true,
    spawnInterval: 6,
    maxEnemies: 8,
    holdDelay: 0.16,
    deadZone: 12,
  });
  const keys = PARAM_SCHEMA.map(({ key }) => key);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(new Set(keys), new Set(Object.keys(DEFAULT_PARAMS)));
  for (const field of PARAM_SCHEMA) {
    assert.ok(field.label && field.group);
    if (field.type === 'select') assert.deepEqual(field.options.map(option => option.value), AUTO_ATTACK_MODES);
    else if (field.type !== 'boolean') assert.ok(Number.isFinite(field.min) && Number.isFinite(field.max) && field.min <= field.max);
  }
  const deathDuration = PARAM_SCHEMA.find(field => field.key === 'deathDuration');
  assert.deepEqual([deathDuration.min, deathDuration.max, deathDuration.step, deathDuration.group], [0.05, 1, 0.01, 'attack']);
  const fields = Object.fromEntries(PARAM_SCHEMA.map(field => [field.key, field]));
  assert.deepEqual([fields.enemyAttackRange.min, fields.enemyAttackRange.max, fields.enemyAttackRange.step, DEFAULT_PARAMS.enemyAttackRange], [40, 240, 5, 120]);
  assert.deepEqual([fields.enemyDamage.min, fields.enemyDamage.max, fields.enemyDamage.step], [1, 50, 1]);
  assert.deepEqual([fields.enemyWindup.min, fields.enemyWindup.max, fields.enemyWindup.step, DEFAULT_PARAMS.enemyWindup], [0.05, 2, 0.01, 0.35]);
  assert.deepEqual([fields.enemySwingDuration.min, fields.enemySwingDuration.max, fields.enemySwingDuration.step, DEFAULT_PARAMS.enemySwingDuration], [0.05, 1, 0.01, 0.18]);
  assert.deepEqual([fields.enemyRecovery.min, fields.enemyRecovery.max, fields.enemyRecovery.step, DEFAULT_PARAMS.enemyRecovery], [0.05, 3, 0.01, 0.6]);
  assert.deepEqual([fields.enemyMoveSpeed.min, fields.enemyMoveSpeed.max, fields.enemyMoveSpeed.step, fields.enemyMoveSpeed.group, DEFAULT_PARAMS.enemyMoveSpeed], [0, 400, 10, 'enemy', 110]);
  assert.equal(fields.collisionsEnabled.type, 'boolean');
  assert.equal(fields.showColliders.type, 'boolean');
  assert.deepEqual([fields.collisionRadius.group, fields.collisionRadius.min, fields.collisionRadius.max, fields.collisionRadius.step, fields.collisionRadius.unit, DEFAULT_PARAMS.collisionRadius], ['collisions', 8, 40, 1, 'ед', 26]);
  assert.deepEqual([fields.baseLayerScale.min, fields.baseLayerScale.max, fields.baseLayerScale.step, DEFAULT_PARAMS.baseLayerScale], [0.5, 1.5, 0.05, 1]);
  assert.deepEqual([fields.floorLayerScale.min, fields.floorLayerScale.max, fields.floorLayerScale.step, DEFAULT_PARAMS.floorLayerScale], [0.5, 1.5, 0.05, 0.9]);
  assert.equal(fields.autoContinueAttack.type, 'boolean');
  assert.equal(fields.autoRetaliate.type, 'boolean');
  assert.equal(fields.spawnersEnabled.type, 'boolean');
  assert.deepEqual([fields.spawnInterval.group, fields.spawnInterval.min, fields.spawnInterval.max, fields.spawnInterval.step, DEFAULT_PARAMS.spawnInterval], ['spawners', 0.5, 60, 0.5, 6]);
  assert.deepEqual([fields.maxEnemies.group, fields.maxEnemies.min, fields.maxEnemies.max, fields.maxEnemies.step, fields.maxEnemies.integer, DEFAULT_PARAMS.maxEnemies], ['spawners', 0, 50, 1, true, 8]);
});

test('sanitize ignores unknown and non-finite values and clamps numeric bounds', () => {
  const params = sanitizeParameters({
    maxSpeed: -10,
    damage: 1000,
    accelerationTime: Number.NaN,
    cameraZoom: '2',
    autoAttackMode: 'invalid',
    deathDuration: 5,
    enemyAttackRange: 0,
    enemyDamage: 70,
    enemyWindup: -1,
    enemyMoveSpeed: 999,
    collisionsEnabled: false,
    showColliders: true,
    collisionRadius: 100,
    baseLayerScale: 9,
    floorLayerScale: '0.2',
    autoContinueAttack: 'true',
    autoRetaliate: true,
    spawnersEnabled: false,
    spawnInterval: 100,
    maxEnemies: 5.6,
    unknownSetting: 999,
  });
  const schema = Object.fromEntries(PARAM_SCHEMA.map((field) => [field.key, field]));
  assert.equal(params.maxSpeed, schema.maxSpeed.min);
  assert.equal(params.damage, schema.damage.max);
  assert.equal(params.accelerationTime, DEFAULT_PARAMS.accelerationTime);
  assert.equal(params.cameraZoom, DEFAULT_PARAMS.cameraZoom);
  assert.equal(params.autoAttackMode, 'hover');
  assert.equal(params.deathDuration, 1);
  assert.equal(params.enemyAttackRange, 40);
  assert.equal(params.enemyDamage, 50);
  assert.equal(params.enemyWindup, 0.05);
  assert.equal(params.enemyMoveSpeed, 400);
  assert.equal(params.collisionsEnabled, false);
  assert.equal(params.showColliders, true);
  assert.equal(params.collisionRadius, 40);
  assert.equal(sanitizeParameters({ collisionRadius: 1 }).collisionRadius, 8);
  assert.equal(sanitizeParameters({ enemyMoveSpeed: -10 }).enemyMoveSpeed, 0);
  assert.equal(params.baseLayerScale, 1.5);
  assert.equal(params.floorLayerScale, 0.9);
  assert.equal(params.autoContinueAttack, false);
  assert.equal(params.autoRetaliate, true);
  assert.equal(params.spawnersEnabled, false);
  assert.equal(params.spawnInterval, 60);
  assert.equal(params.maxEnemies, 6);
  assert.equal(Object.hasOwn(params, 'unknownSetting'), false);
  assert.equal(sanitizeParameters({ maxEnemies: -2 }).maxEnemies, 0);
  assert.equal(sanitizeParameters({ maxEnemies: 70 }).maxEnemies, 50);
});

test('sanitize can layer partial settings over a provided base', () => {
  const params = sanitizeParameters({ damage: 17 }, { ...DEFAULT_PARAMS, maxSpeed: 123 });
  assert.equal(params.damage, 17);
  assert.equal(params.maxSpeed, 123);
});

test('updating settings applies validated values and the settings action can interrupt movement', () => {
  const state = createState();
  pointerDown(state, 1000, 360);
  pointerUp(state);
  step(state, FIXED_STEP);
  assert.notEqual(state.target, null);
  updateParameters(state, { maxSpeed: 180, damage: -1, ignored: 4 });
  assert.equal(state.params.maxSpeed, 180);
  assert.equal(state.params.damage, PARAM_SCHEMA.find((field) => field.key === 'damage').min);
  assert.equal(Object.hasOwn(state.params, 'ignored'), false);
  assert.notEqual(state.target, null);
  cancelInput(state);
  assert.equal(state.target, null);
  assert.deepEqual(state.velocity, { x: 0, y: 0 });
});

test('settings save and load round-trip through local storage', () => {
  const storage = memoryStorage();
  const params = { ...DEFAULT_PARAMS, maxSpeed: 180, damage: 23, enemyMoveSpeed: 210, autoContinueAttack: true, autoRetaliate: true, spawnersEnabled: false, spawnInterval: 12.5, maxEnemies: 17, collisionsEnabled: false, showColliders: true, collisionRadius: 33 };
  assert.equal(saveParameters(params, storage), true);
  const loaded = loadParameters(storage);
  assert.equal(loaded.maxSpeed, 180);
  assert.equal(loaded.damage, 23);
  assert.equal(loaded.enemyMoveSpeed, 210);
  assert.equal(loaded.autoContinueAttack, true);
  assert.equal(loaded.autoRetaliate, true);
  assert.equal(loaded.spawnersEnabled, false);
  assert.equal(loaded.spawnInterval, 12.5);
  assert.equal(loaded.maxEnemies, 17);
  assert.equal(loaded.collisionsEnabled, false);
  assert.equal(loaded.showColliders, true);
  assert.equal(loaded.collisionRadius, 33);
  assert.equal(loaded.cameraZoom, DEFAULT_PARAMS.cameraZoom);
});

test('missing, corrupt, and partial saved settings recover to valid values', () => {
  assert.deepEqual(loadParameters(memoryStorage()), DEFAULT_PARAMS);
  assert.deepEqual(loadParameters(memoryStorage('{broken')), DEFAULT_PARAMS);
  const partial = memoryStorage(JSON.stringify({ maxSpeed: 99999, unknown: 42, damage: 7 }));
  const loaded = loadParameters(partial);
  assert.equal(loaded.maxSpeed, PARAM_SCHEMA.find((field) => field.key === 'maxSpeed').max);
  assert.equal(loaded.damage, 7);
  assert.equal(Object.hasOwn(loaded, 'unknown'), false);
});

test('accepts each automatic attack mode and rejects corrupted stored modes', () => {
  for (const mode of AUTO_ATTACK_MODES) assert.equal(sanitizeParameters({ autoAttackMode: mode }).autoAttackMode, mode);
  assert.equal(loadParameters(memoryStorage(JSON.stringify({ autoAttackMode: 'teleport' }))).autoAttackMode, 'hover');
  const legacy = loadParameters(memoryStorage(JSON.stringify({ maxSpeed: 180, damage: 13 })));
  assert.equal(legacy.maxSpeed, 180);
  assert.equal(legacy.damage, 13);
  assert.equal(legacy.autoAttackMode, 'hover');
  assert.equal(legacy.deathDuration, 0.2);
  assert.equal(legacy.enemyMoveSpeed, 110);
  assert.equal(legacy.autoContinueAttack, false);
  assert.equal(legacy.autoRetaliate, false);
  assert.equal(legacy.spawnersEnabled, true);
  assert.equal(legacy.spawnInterval, 6);
  assert.equal(legacy.maxEnemies, 8);
  assert.equal(legacy.collisionsEnabled, true);
  assert.equal(legacy.showColliders, false);
  assert.equal(legacy.collisionRadius, 26);
});

test('interface visibility and collapsed sections persist independently', () => {
  const storage = {
    values: new Map(),
    getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { this.values.set(key, String(value)); },
  };
  assert.deepEqual(loadInterfaceState(storage), DEFAULT_UI_STATE);
  storage.setItem('arpg-lab-interface-v1', JSON.stringify({ visible: true, sections: { movement: true } }));
  assert.deepEqual(loadInterfaceState(storage), DEFAULT_UI_STATE);
  const ui = { visible: true, sections: { movement: false, camera: true, attack: true, enemy: false, layers: false, spawners: true, collisions: false } };
  assert.equal(saveInterfaceState(ui, storage), true);
  assert.deepEqual(loadInterfaceState(storage), ui);
  assert.equal(storage.values.has(STORAGE_KEY), false);
  assert.equal(storage.values.has(UI_STORAGE_KEY), true);
});

test('corrupt UI state falls back and sanitizes invalid properties', () => {
  const storage = { getItem() { return '{broken'; } };
  assert.deepEqual(loadInterfaceState(storage), DEFAULT_UI_STATE);
  assert.deepEqual(sanitizeInterfaceState({ visible: 'yes', sections: { movement: false, camera: 1, extra: true, enemy: true } }), {
    visible: false, sections: { movement: false, camera: false, attack: false, enemy: true, layers: false, spawners: false, collisions: false },
  });
});

test('storage failures do not prevent valid in-session parameter use', () => {
  const unavailable = {
    getItem() { throw new Error('storage disabled'); },
    setItem() { throw new Error('storage disabled'); },
  };
  assert.deepEqual(loadParameters(unavailable), DEFAULT_PARAMS);
  assert.equal(saveParameters({ ...DEFAULT_PARAMS, maxSpeed: 190 }, unavailable), false);
  assert.deepEqual(loadInterfaceState(unavailable), DEFAULT_UI_STATE);
  assert.equal(saveInterfaceState({ visible: true }, unavailable), false);
  const state = createState();
  updateParameters(state, { maxSpeed: 190 });
  assert.equal(state.params.maxSpeed, 190);
});
