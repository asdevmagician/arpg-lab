import test from 'node:test';
import assert from 'node:assert/strict';
import { getLayerScale, getActorScale, sortActorsByLayer } from '../src/layers.js';

test('layer scale uses configurable base and floor values', () => {
  assert.equal(getLayerScale(0), 1);
  assert.equal(getLayerScale(-1), 0.9);
  assert.equal(getLayerScale(1, { baseLayerScale: 1.2, floorLayerScale: 0.7 }), 1.2);
  assert.equal(getLayerScale(-1, { baseLayerScale: 1.2, floorLayerScale: 0.7 }), 0.7);
});

test('living actors use their layer scale and corpses ease from captured scale to floor', () => {
  const params = { baseLayerScale: 1.1, floorLayerScale: 0.8, deathDuration: 0.4 };
  const living = { id: 'skeleton', hp: 100, layer: 0, radius: 26 };
  assert.equal(getActorScale(living, params), 1.1);

  const corpse = { id: 'skeleton', hp: 0, layer: -1, deathStartScale: 1.1, deathElapsed: 0, radius: 26 };
  assert.equal(getActorScale(corpse, params), 1.1);
  corpse.deathElapsed = 0.2;
  assert.ok(Math.abs(getActorScale(corpse, params) - 0.95) < 1e-12);
  corpse.deathElapsed = 0.4;
  assert.equal(getActorScale(corpse, params), 0.8);
  corpse.deathElapsed = 2;
  assert.equal(getActorScale(corpse, params), 0.8);
  assert.equal(corpse.radius, 26, 'presentation scaling does not mutate hit radius');
});

test('a corpse with no remaining animation time uses floor scale immediately', () => {
  const corpse = { id: 'hero', hp: 0, layer: -1, deathElapsed: 0 };
  assert.equal(getActorScale(corpse, { baseLayerScale: 1, floorLayerScale: 0.9, deathDuration: 0 }), 0.9);
});

test('actors draw in ascending layers, with hero last among ties and corpses first', () => {
  const actors = [
    { id: 'hero', layer: 0 },
    { id: 'target', layer: 0 },
    { id: 'skeleton', layer: -1 },
    { id: 'targetCorpse', layer: -1 },
  ];
  const order = sortActorsByLayer(actors).map(actor => actor.id);
  assert.deepEqual(order, ['skeleton', 'targetCorpse', 'target', 'hero']);
  assert.deepEqual(actors.map(actor => actor.id), ['hero', 'target', 'skeleton', 'targetCorpse'], 'sorting leaves caller order intact');
});
