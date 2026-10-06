import { createSkeleton } from '../src/simulation.js';

let nextActorId = 1;

export function addSkeleton(state, x, y, id = `test-enemy-${nextActorId++}`) {
  const actor = createSkeleton(id, x, y);
  state.spawnedEnemies.push(actor);
  return actor;
}
