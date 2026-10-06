import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPEED,
  HOLD_DELAY,
  DEAD_ZONE,
  FIXED_STEP,
  createState as createWorld,
  screenToWorld,
  worldToScreen,
  resize,
  pointerDown,
  pointerMove,
  pointerUp,
  cancelInput,
  step,
  createLoop,
} from '../src/simulation.js';

// Movement dynamics are exercised in free space; physical blockers have their own suite.
function createState(...args) {
  const state = createWorld(...args);
  state.enemy.x = 10000;
  return state;
}

function tick(state, seconds) {
  for (let i = 0, count = Math.round(seconds / FIXED_STEP); i < count; i += 1) step(state, FIXED_STEP);
}

test('click target stays fixed in world as camera follows hero', () => {
  const state = createState();
  pointerDown(state, 640 + SPEED * 2, 360);
  pointerUp(state);
  const goal = { ...state.target };
  tick(state, 0.5);
  assert.ok(state.hero.x > 0 && state.hero.x < goal.x);
  assert.equal(state.camera.x, state.hero.x);
  assert.deepEqual(state.target, goal);
  tick(state, 4);
  assert.deepEqual(state.hero, goal);
  assert.equal(state.target, null);
});

test('movement accelerates, brakes before target, and stops without overshoot', () => {
  const state = createState();
  pointerDown(state, 900, 360);
  pointerUp(state);
  tick(state, 0.1);
  assert.ok(state.velocity.x > 0 && state.velocity.x < SPEED);
  tick(state, 4);
  const goal = { x: 260, y: 0 };
  assert.deepEqual(state.hero, goal);
  assert.deepEqual(state.velocity, { x: 0, y: 0 });
  assert.equal(state.target, null);
  tick(state, 1);
  assert.deepEqual(state.hero, goal);
});

test('new ground click redirects movement and non-left buttons are ignored', () => {
  const state = createState();
  pointerDown(state, 1000, 360);
  pointerUp(state);
  tick(state, 0.5);
  const previous = { ...state.hero };
  pointerDown(state, 640, 160);
  pointerUp(state);
  const goal = { ...state.target };
  assert.ok(goal.y < previous.y);
  tick(state, 4);
  assert.deepEqual(state.hero, goal);

  pointerDown(state, 1000, 360, 2);
  assert.equal(state.target, null);
});

test('held cursor follows after delay, keeps moving while stationary, then brakes in dead zone', () => {
  const state = createState(1280, 720, { autoAttackMode: 'off' });
  pointerDown(state, 760, 360);
  const initial = { ...state.target };
  tick(state, HOLD_DELAY - FIXED_STEP);
  assert.deepEqual(state.target, initial);
  tick(state, 2);
  assert.equal(state.pointer.following, true);
  assert.ok(state.hero.x > SPEED * 0.5);
  assert.equal(state.camera.x, state.hero.x);
  pointerMove(state, 640 + DEAD_ZONE, 360);
  tick(state, 2);
  assert.ok(Math.abs(state.velocity.x) < SPEED * 0.02);
});

test('held cursor reverses direction with gradual turn and release freezes last goal', () => {
  const state = createState(1280, 720, { autoAttackMode: 'off' });
  pointerDown(state, 760, 360);
  tick(state, 1);
  pointerMove(state, 520, 360);
  tick(state, 1);
  assert.ok(state.velocity.x < 0);
  pointerUp(state);
  const frozen = { ...state.target };
  pointerMove(state, 760, 360);
  tick(state, 4);
  assert.deepEqual(state.hero, frozen);
  assert.equal(state.target, null);
});

test('cancel immediately stops movement and clears input and target', () => {
  const state = createState();
  pointerDown(state, 1000, 360);
  pointerUp(state);
  tick(state, 0.5);
  cancelInput(state);
  const position = { ...state.hero };
  assert.equal(state.target, null);
  assert.equal(state.pointer.down, false);
  assert.deepEqual(state.velocity, { x: 0, y: 0 });
  tick(state, 1);
  assert.deepEqual(state.hero, position);
});

test('screen/world transforms account for zoom, negative coordinates, and resize', () => {
  const state = createState(800, 600, { cameraZoom: 1.75 });
  state.camera.x = -325.5;
  state.camera.y = -900.25;
  const world = { x: -1200.75, y: -18.5 };
  const screen = worldToScreen(state, world.x, world.y);
  const result = screenToWorld(state, screen.x, screen.y);
  assert.ok(Math.abs(result.x - world.x) < 1e-9);
  assert.ok(Math.abs(result.y - world.y) < 1e-9);
  pointerDown(state, screen.x, screen.y);
  pointerUp(state);
  const target = { ...state.target };
  resize(state, 1200, 900);
  assert.deepEqual(state.target, target);
  assert.deepEqual(screenToWorld(state, 600, 450), { x: -325.5, y: -900.25 });
});

test('movement distance is frame-rate independent and diagonal travel is normalized', () => {
  const distances = [];
  for (const fps of [30, 60, 144]) {
    const state = createState();
    pointerDown(state, 640 + 2000, 360);
    pointerUp(state);
    const loop = createLoop(state);
    for (let i = 0; i < fps; i += 1) loop.advance(1 / fps);
    distances.push(Math.hypot(state.hero.x, state.hero.y));
  }
  assert.ok(Math.max(...distances) - Math.min(...distances) <= SPEED * FIXED_STEP + 1e-6);

  const axial = createState();
  const diagonal = createState();
  pointerDown(axial, 2640, 360);
  pointerUp(axial);
  pointerDown(diagonal, 2640, 2360);
  pointerUp(diagonal);
  tick(axial, 1);
  tick(diagonal, 1);
  assert.ok(Math.abs(Math.hypot(axial.hero.x, axial.hero.y) - Math.hypot(diagonal.hero.x, diagonal.hero.y)) <= SPEED * FIXED_STEP + 1e-6);
});

test('loop caps long frame gaps and reset discards fractional accumulated time', () => {
  const state = createState();
  pointerDown(state, 2640, 360);
  pointerUp(state);
  const loop = createLoop(state);
  loop.advance(1);
  assert.ok(state.hero.x < SPEED * 0.1);

  const resetState = createState();
  pointerDown(resetState, 900, 360);
  const resetLoop = createLoop(resetState);
  resetLoop.advance(FIXED_STEP / 2);
  cancelInput(resetState);
  resetLoop.reset();
  const position = { ...resetState.hero };
  resetLoop.advance(FIXED_STEP / 2);
  assert.deepEqual(resetState.hero, position);
});
