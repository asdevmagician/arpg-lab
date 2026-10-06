import test from 'node:test';
import assert from 'node:assert/strict';
import { createFpsCounter } from '../src/fps.js';

function measureRate(rate, seconds = 1) {
  const counter = createFpsCounter();
  const readings = [];
  const frames = Math.round(rate * seconds);
  for (let frame = 0; frame <= frames; frame += 1) {
    const reading = counter.sample(frame * 1000 / rate);
    if (reading !== null) readings.push({ time: frame * 1000 / rate, fps: reading });
  }
  return readings;
}

test('measures synthetic 30, 60, and 144 FPS from timestamp windows', () => {
  for (const rate of [30, 60, 144]) {
    const readings = measureRate(rate);
    assert.ok(readings.length >= 1);
    assert.equal(readings[0].fps, rate);
    assert.equal(readings.at(-1).fps, rate);
  }
});

test('waits for a complete first interval and ignores invalid, repeated, and backwards timestamps', () => {
  const counter = createFpsCounter();
  assert.equal(counter.sample(Number.NaN), null);
  assert.equal(counter.sample(0), null);
  assert.equal(counter.sample(0), null);
  assert.equal(counter.sample(-1), null);
  for (let time = 1000 / 60; time < 500; time += 1000 / 60) assert.equal(counter.sample(time), null);
  assert.equal(counter.sample(500), 60);
  assert.equal(counter.sample(Number.NaN), 60);
  assert.equal(counter.sample(500), 60);
  assert.equal(counter.sample(499), 60);
});

test('keeps last reading between publications', () => {
  const counter = createFpsCounter();
  let reading = null;
  for (let frame = 0; frame <= 30; frame += 1) reading = counter.sample(frame * 1000 / 60);
  assert.equal(reading, 60);
  for (let frame = 31; frame <= 60; frame += 1) {
    const time = frame * 1000 / 60;
    reading = counter.sample(time);
    if (frame === 42 || frame === 43 || frame === 44) assert.equal(reading, 60);
  }
  assert.equal(reading, 60);
});

test('long gaps clear history and begin a fresh measurement window', () => {
  const counter = createFpsCounter();
  for (let frame = 0; frame <= 30; frame += 1) counter.sample(frame * 1000 / 60);
  assert.equal(counter.sample(1601), null);
  let reading = null;
  for (let frame = 1; frame <= 30; frame += 1) reading = counter.sample(1601 + frame * 1000 / 60) ?? reading;
  assert.equal(reading, 60);
});

test('reset clears samples and publication timing', () => {
  const counter = createFpsCounter();
  for (let frame = 0; frame <= 30; frame += 1) counter.sample(frame * 1000 / 60);
  counter.reset();
  assert.equal(counter.sample(1000), null);
  let reading = null;
  for (let frame = 1; frame <= 30; frame += 1) reading = counter.sample(1000 + frame * 1000 / 60) ?? reading;
  assert.equal(reading, 60);
});
