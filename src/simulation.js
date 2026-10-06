import { DEFAULT_PARAMS, sanitizeParameters } from './settings.js';
import { moveCircle, separateCircles } from './collisions.js';

export const SPEED = DEFAULT_PARAMS.maxSpeed;
export const HOLD_DELAY = DEFAULT_PARAMS.holdDelay;
export const DEAD_ZONE = DEFAULT_PARAMS.deadZone;
export const FIXED_STEP = 1 / 120;
const POSITION_EPSILON = 1e-5;

function freshCombat() {
  return { phase: 'idle', elapsed: 0, selected: false, repeat: false, queued: false,
    side: 1, nextSide: 1, angle: 0, range: 100, windup: 0.2, swingDuration: 0.16,
    recovery: 0.24, damage: 10, hit: false, attackCount: 0, targetId: null, autoRepeat: false };
}

function freshActor(id, x = 0, y = 0) {
  return { id, x, y, radius: 26, hp: 100, maxHp: 100, layer: 0, hitFlash: 0, deathElapsed: 0 };
}

export function createSkeleton(id, x, y) {
  return { ...freshActor(id, x, y), combat: freshCombat(), mobile: true };
}

export function getEnemies(state) { return [state.enemy, ...attackers(state)]; }
function attackers(state) { return state.spawnedEnemies; }
function freshSpawner() { return { elapsed: 0, nextSide: 0, nextId: 1 }; }
function selectedEnemy(state) { return getEnemies(state).find(actor => actor.id === state.combat.targetId); }

function moveActor(state, position, id, delta) {
  if (!state.params.collisionsEnabled) return { x: position.x + delta.x, y: position.y + delta.y, normals: [] };
  const radius = state.params.collisionRadius;
  const obstacles = getEnemies(state).filter(actor => actor.id !== id && actor.hp > 0)
    .map(actor => ({ x: actor.x, y: actor.y, radius }));
  if (id !== 'hero' && state.heroStatus.hp > 0) obstacles.push({ ...state.hero, radius });
  return moveCircle(position, delta, radius, obstacles);
}

function separateActors(state) {
  if (!state.params.collisionsEnabled) return;
  const bodies = getEnemies(state).filter(actor => actor.hp > 0)
    .map(actor => ({ position: actor, priority: actor.mobile ? 0 : 2 }));
  if (state.heroStatus.hp > 0) bodies.unshift({ position: state.hero, priority: 1 });
  separateCircles(bodies, state.params.collisionRadius);
}

export function createState(width = 1280, height = 720, params = DEFAULT_PARAMS) {
  const parameters = sanitizeParameters(params);
  return {
    hero: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, camera: { x: 0, y: 0 }, movementBlocked: false,
    heroStatus: freshActor('hero'),
    viewport: { width, height }, params: parameters, target: null,
    pointer: { x: 0, y: 0, down: false, elapsed: 0, following: false, mode: 'move' },
    enemy: freshActor('target', 220, 0),
    spawnedEnemies: [], spawner: freshSpawner(),
    combat: freshCombat(),
  };
}

export function screenToWorld(state, x, y) {
  const zoom = state.params.cameraZoom;
  return { x: state.camera.x + (x - state.viewport.width / 2) / zoom,
    y: state.camera.y + (y - state.viewport.height / 2) / zoom };
}

export function worldToScreen(state, x, y) {
  const zoom = state.params.cameraZoom;
  return { x: (x - state.camera.x) * zoom + state.viewport.width / 2,
    y: (y - state.camera.y) * zoom + state.viewport.height / 2 };
}

export function resize(state, width, height) { state.viewport = { width, height }; }

export function findEnemyAt(state, x, y) {
  const point = screenToWorld(state, x, y);
  return getEnemies(state).slice().reverse().find(actor => actor.hp > 0 && Math.hypot(point.x - actor.x, point.y - actor.y) <= actor.radius);
}
export function hitTestEnemy(state, x, y) { return Boolean(findEnemyAt(state, x, y)); }

function clearCombat(state) {
  Object.assign(state.combat, { phase: 'idle', elapsed: 0, selected: false, repeat: false, queued: false, hit: false, targetId: null, autoRepeat: false });
}

function selectEnemy(state, actor) {
  state.pointer.mode = 'attack';
  state.pointer.following = false;
  Object.assign(state.combat, { phase: 'approach', elapsed: 0, selected: true,
    autoRepeat: state.params.autoContinueAttack, repeat: state.pointer.down || state.params.autoContinueAttack,
    queued: true, targetId: actor.id });
  state.target = null;
}

export function pointerDown(state, x, y, button = 0) {
  if (button !== 0 || state.heroStatus.hp <= 0) return;
  state.movementBlocked = false;
  clearCombat(state);
  const attack = findEnemyAt(state, x, y);
  state.pointer = { x, y, down: true, elapsed: 0, following: false, mode: attack ? 'attack' : 'move' };
  if (attack) {
    selectEnemy(state, attack);
  } else { state.target = screenToWorld(state, x, y); }
}

export function pointerMove(state, x, y) { state.pointer.x = x; state.pointer.y = y; }

export function pointerUp(state) {
  state.pointer.down = false;
  state.pointer.following = false;
  state.pointer.elapsed = 0;
  state.combat.repeat = Boolean(state.combat.autoRepeat && state.params.autoContinueAttack && selectedEnemy(state)?.hp > 0);
  if (state.movementBlocked && state.pointer.mode === 'move') state.target = null;
}

export function cancelInput(state) {
  pointerUp(state);
  clearCombat(state);
  state.target = null;
  state.velocity = { x: 0, y: 0 };
  state.movementBlocked = false;
}

export function resetWorld(state) {
  cancelInput(state);
  state.hero = { x: 0, y: 0 };
  state.camera = { x: 0, y: 0 };
  state.heroStatus = freshActor('hero');
  state.enemy = freshActor('target', 220, 0);
  state.spawnedEnemies = []; state.spawner = freshSpawner();
  state.combat = freshCombat();
}

function startAttack(state) {
  state.movementBlocked = false;
  const c = state.combat;
  const p = state.params;
  const actor = selectedEnemy(state);
  Object.assign(c, { phase: 'windup', elapsed: 0, queued: false, hit: false,
    side: c.nextSide, nextSide: -c.nextSide,
    angle: Math.atan2(actor.y - state.hero.y, actor.x - state.hero.x),
    range: p.attackRange, windup: p.windup, swingDuration: p.swingDuration,
    recovery: p.recovery, damage: p.damage, attackCount: c.attackCount + 1 });
  state.target = null;
  state.velocity = { x: 0, y: 0 };
}

function attackDistance(state, actor = selectedEnemy(state)) { return actor ? Math.hypot(actor.x - state.hero.x, actor.y - state.hero.y) : Infinity; }

function damageActor(actor, amount, params) {
  actor.hp = Math.max(0, actor.hp - amount);
  actor.hitFlash = 0.12;
  if (actor.hp === 0) {
    actor.layer = -1; actor.deathElapsed = 0; actor.hitFlash = 0;
    actor.deathStartScale = params.baseLayerScale;
  }
}

function updateCombat(state, dt) {
  const c = state.combat;
  if (!state.params.autoContinueAttack) {
    c.autoRepeat = false;
    if (!state.pointer.down) c.repeat = false;
  }
  const actor = selectedEnemy(state);
  if (!actor || actor.hp <= 0) {
    c.selected = false; c.repeat = false; c.queued = false; c.autoRepeat = false;
    if (c.phase === 'approach') { clearCombat(state); state.target = null; }
  }
  if (c.phase === 'approach') {
    if (!c.queued && !c.repeat) { clearCombat(state); state.target = null; return; }
    const distance = attackDistance(state);
    const stopAt = state.params.attackRange - 2;
    // Use the movement arrival tolerance: a rounding-sized goal must not block windup.
    if (distance > stopAt + POSITION_EPSILON) {
      const dx = (actor.x - state.hero.x) / distance;
      const dy = (actor.y - state.hero.y) / distance;
      state.target = { x: actor.x - dx * stopAt, y: actor.y - dy * stopAt };
    } else { state.target = null; }
    if (distance <= state.params.attackRange && Math.hypot(state.velocity.x, state.velocity.y) < 1 && !state.target) startAttack(state);
    return;
  }
  if (c.phase === 'idle') return;
  c.elapsed += dt;
  // Consume phase boundaries with remainder, so phase timing does not drift.
  while (c.phase !== 'idle' && c.phase !== 'approach') {
    if (c.phase === 'windup') {
      if (c.elapsed + 1e-10 < c.windup) break;
      c.elapsed = Math.max(0, c.elapsed - c.windup);
      c.phase = 'swing';
    } else if (c.phase === 'swing') {
      if (!c.hit && c.elapsed + 1e-10 >= c.swingDuration / 2) {
        c.hit = true;
        if (actor?.hp > 0 && attackDistance(state) <= c.range + 1e-8) {
          damageActor(actor, c.damage, state.params);
          if (actor.hp === 0) {
            c.selected = false; c.repeat = false; c.queued = false; c.autoRepeat = false;
          }
        }
      }
      if (c.elapsed + 1e-10 < c.swingDuration) break;
      c.elapsed = Math.max(0, c.elapsed - c.swingDuration);
      c.phase = 'recovery';
    } else {
      if (c.elapsed + 1e-10 < c.recovery) break;
      c.elapsed = 0;
      if (c.repeat || c.queued) { c.phase = 'approach'; }
      else { clearCombat(state); }
      break;
    }
  }
}

function updateEnemyCombat(state, actor, dt) {
  const c = actor.combat;
  if (actor.hp <= 0 || state.heroStatus.hp <= 0) {
    c.phase = 'idle'; c.elapsed = 0; return;
  }
  if (c.phase === 'idle') {
    const p = state.params;
    if (actor.mobile) {
      const distance = attackDistance(state, actor);
      const stopAt = p.enemyAttackRange - 2;
      if (distance > stopAt) {
        const travel = Math.min(distance - stopAt, p.enemyMoveSpeed * dt);
        const moved = moveActor(state, actor, actor.id, {
          x: (state.hero.x - actor.x) / distance * travel,
          y: (state.hero.y - actor.y) / distance * travel,
        });
        actor.x = moved.x; actor.y = moved.y;
        if (travel > 0 && attackDistance(state, actor) > stopAt + 1e-8) return;
      }
    }
    if (attackDistance(state, actor) <= p.enemyAttackRange) {
      Object.assign(c, { phase: 'windup', elapsed: 0, hit: false, side: c.nextSide, nextSide: -c.nextSide,
        angle: Math.atan2(state.hero.y - actor.y, state.hero.x - actor.x), range: p.enemyAttackRange,
        damage: p.enemyDamage, windup: p.enemyWindup, swingDuration: p.enemySwingDuration,
        recovery: p.enemyRecovery, attackCount: c.attackCount + 1 });
    }
    return;
  }
  c.elapsed += dt;
  while (c.phase !== 'idle') {
    if (c.phase === 'windup') {
      if (c.elapsed + 1e-10 < c.windup) break;
      c.elapsed = Math.max(0, c.elapsed - c.windup); c.phase = 'swing';
    } else if (c.phase === 'swing') {
      if (!c.hit && c.elapsed + 1e-10 >= c.swingDuration / 2) {
        c.hit = true;
        if (attackDistance(state, actor) <= c.range + 1e-8) {
          damageActor(state.heroStatus, c.damage, state.params);
          if (state.heroStatus.hp === 0) {
            cancelInput(state);
            for (const enemy of attackers(state)) { enemy.combat.phase = 'idle'; enemy.combat.elapsed = 0; }
            return;
          }
          if (state.params.autoRetaliate && state.combat.phase === 'idle' && !state.pointer.down &&
            !state.target && Math.hypot(state.velocity.x, state.velocity.y) < 1) selectEnemy(state, actor);
        }
      }
      if (c.elapsed + 1e-10 < c.swingDuration) break;
      c.elapsed = Math.max(0, c.elapsed - c.swingDuration); c.phase = 'recovery';
    } else {
      if (c.elapsed + 1e-10 < c.recovery) break;
      c.elapsed = 0; c.phase = 'idle'; break;
    }
  }
}

function updateSpawners(state, dt) {
  const clock = state.spawner;
  const p = state.params;
  if (!p.spawnersEnabled) { clock.elapsed = 0; return; }
  if (state.heroStatus.hp <= 0) return;
  clock.elapsed = Math.min(p.spawnInterval, clock.elapsed + dt);
  if (clock.elapsed + 1e-10 < p.spawnInterval || attackers(state).filter(actor => actor.hp > 0).length >= p.maxEnemies) return;
  const halfWidth = state.viewport.width / (2 * p.cameraZoom);
  const halfHeight = state.viewport.height / (2 * p.cameraZoom);
  const offset = Math.sin(clock.nextId * 2.3999632297) * 0.65;
  const side = clock.nextSide;
  const positions = [
    { x: state.camera.x + halfWidth * offset, y: state.camera.y - halfHeight - 96 },
    { x: state.camera.x + halfWidth + 96, y: state.camera.y + halfHeight * offset },
    { x: state.camera.x + halfWidth * offset, y: state.camera.y + halfHeight + 96 },
    { x: state.camera.x - halfWidth - 96, y: state.camera.y + halfHeight * offset },
  ];
  const position = positions[side];
  state.spawnedEnemies.push({ ...createSkeleton(`spawn-${clock.nextId}`, position.x, position.y),
    spawnSide: ['top', 'right', 'bottom', 'left'][side] });
  clock.elapsed = 0; clock.nextId += 1; clock.nextSide = (side + 1) % 4;
}

function updateMovement(state, dt) {
  const p = state.params;
  const velocity = state.velocity;
  let desiredX = 0; let desiredY = 0; let distance = 0;
  if (state.target) {
    const dx = state.target.x - state.hero.x;
    const dy = state.target.y - state.hero.y;
    distance = Math.hypot(dx, dy);
    if (distance < POSITION_EPSILON) {
      state.hero = { ...state.target }; state.target = null;
      state.velocity = { x: 0, y: 0 }; return;
    }
    const braking = p.maxSpeed / p.brakingTime;
    const following = state.pointer.following && state.pointer.mode === 'move';
    const desiredSpeed = following ? p.maxSpeed : Math.min(p.maxSpeed, Math.sqrt(2 * braking * distance));
    desiredX = dx / distance * desiredSpeed; desiredY = dy / distance * desiredSpeed;
  }
  const speed = Math.hypot(velocity.x, velocity.y);
  const desiredSpeed = Math.hypot(desiredX, desiredY);
  const cross = Math.abs(velocity.x * desiredY - velocity.y * desiredX);
  const dot = velocity.x * desiredX + velocity.y * desiredY;
  const turning = speed > 1 && desiredSpeed > 1 && (dot < 0 || cross > speed * desiredSpeed * 0.05);
  const rate = turning ? 2 * p.maxSpeed / p.turnTime : p.maxSpeed / (desiredSpeed < speed ? p.brakingTime : p.accelerationTime);
  const changeX = desiredX - velocity.x; const changeY = desiredY - velocity.y;
  const change = Math.hypot(changeX, changeY);
  const fraction = change === 0 ? 0 : Math.min(1, rate * dt / change);
  velocity.x += changeX * fraction; velocity.y += changeY * fraction;
  const newSpeed = Math.hypot(velocity.x, velocity.y);
  if (newSpeed > p.maxSpeed) { velocity.x *= p.maxSpeed / newSpeed; velocity.y *= p.maxSpeed / newSpeed; }
  let travelX = velocity.x * dt; let travelY = velocity.y * dt;
  const travel = Math.hypot(travelX, travelY);
  if (state.target && travel >= distance && (travelX * (state.target.x - state.hero.x) + travelY * (state.target.y - state.hero.y)) > 0) {
    travelX = state.target.x - state.hero.x; travelY = state.target.y - state.hero.y;
  }
  const moved = moveActor(state, state.hero, 'hero', { x: travelX, y: travelY });
  const actualTravel = Math.hypot(moved.x - state.hero.x, moved.y - state.hero.y);
  state.hero = { x: moved.x, y: moved.y };
  for (const normal of moved.normals) {
    const inward = state.velocity.x * normal.x + state.velocity.y * normal.y;
    if (inward < 0) { state.velocity.x -= inward * normal.x; state.velocity.y -= inward * normal.y; }
  }
  if (state.target) {
    state.movementBlocked = moved.normals.length > 0 && actualTravel < POSITION_EPSILON;
    if (Math.hypot(state.hero.x - state.target.x, state.hero.y - state.target.y) < POSITION_EPSILON) {
      state.target = null; state.velocity = { x: 0, y: 0 };
    } else if (state.movementBlocked && !state.pointer.down && state.pointer.mode === 'move') {
      state.target = null; state.velocity = { x: 0, y: 0 };
    }
  }
  if (!state.target && Math.hypot(state.velocity.x, state.velocity.y) < POSITION_EPSILON) state.velocity = { x: 0, y: 0 };
}

export function step(state, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  separateActors(state);
  for (const actor of [state.heroStatus, ...getEnemies(state)]) {
    actor.hitFlash = Math.max(0, actor.hitFlash - dt);
    if (actor.hp <= 0) {
      actor.layer = -1;
      actor.deathElapsed = Math.min(state.params.deathDuration, actor.deathElapsed + dt);
    }
  }
  if (state.heroStatus.hp <= 0) {
    cancelInput(state);
    for (const enemy of attackers(state)) updateEnemyCombat(state, enemy, dt);
    return;
  }
  if (state.pointer.down && state.pointer.mode === 'move') {
    state.pointer.elapsed += dt;
    if (state.pointer.elapsed + 1e-10 >= state.params.holdDelay) {
      state.pointer.following = true;
      const dx = state.pointer.x - state.viewport.width / 2;
      const dy = state.pointer.y - state.viewport.height / 2;
      state.target = Math.hypot(dx, dy) <= state.params.deadZone ? null : screenToWorld(state, state.pointer.x, state.pointer.y);
      const mode = state.params.autoAttackMode;
      const actor = mode === 'hover' ? findEnemyAt(state, state.pointer.x, state.pointer.y) : mode === 'nearby'
        ? getEnemies(state).filter(enemy => enemy.hp > 0 && attackDistance(state, enemy) <= state.params.attackRange)
          .sort((a, b) => attackDistance(state, a) - attackDistance(state, b))[0] : null;
      if (actor) selectEnemy(state, actor);
    }
  }
  const actor = selectedEnemy(state);
  updateCombat(state, dt);
  if (actor?.hp <= 0 && state.combat.phase === 'idle' && state.pointer.mode === 'attack') {
    state.pointer.mode = 'move';
    state.pointer.following = state.pointer.down;
    state.pointer.elapsed = state.pointer.down ? state.params.holdDelay : 0;
    state.target = null;
  }
  if (['windup', 'swing', 'recovery'].includes(state.combat.phase)) state.velocity = { x: 0, y: 0 };
  else updateMovement(state, dt);
  state.camera = { ...state.hero };
  for (const enemy of attackers(state)) updateEnemyCombat(state, enemy, dt);
  updateSpawners(state, dt);
}

export function createLoop(state) {
  let accumulator = 0;
  return {
    advance(deltaSeconds) {
      if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
      accumulator += Math.min(deltaSeconds, 0.1);
      while (accumulator + 1e-10 >= FIXED_STEP) {
        step(state, FIXED_STEP); accumulator = Math.max(0, accumulator - FIXED_STEP);
      }
    },
    reset() { accumulator = 0; },
  };
}
