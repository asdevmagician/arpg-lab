import { createState, createLoop, resize, pointerDown, pointerMove, pointerUp, cancelInput, resetWorld, hitTestEnemy } from './simulation.js';
import { render } from './render.js';
import { loadParameters } from './settings.js';
import { mountSettings } from './ui.js';
import { createFpsCounter } from './fps.js';

const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d');
const state = createState(1280, 720, loadParameters());
const loop = createLoop(state);
const portrait = new Image();
portrait.src = '/assets/hero.svg';
const targetPortrait = new Image();
targetPortrait.src = '/assets/target.svg';
const skeletonPortrait = new Image();
skeletonPortrait.src = '/assets/skeleton.svg';
const fpsCounter = createFpsCounter();
const fpsLabel = document.querySelector('#fps');
const settingsPanel = document.querySelector('#settings-panel');
const coordinates = document.querySelector('#coordinates');
const mode = document.querySelector('#mode');
let activePointer = null;
let previousTime = null;
let pixelRatio = 1;
let focusPaused = false;
let wasPaused = false;

function fit() {
  const rect = canvas.getBoundingClientRect();
  resize(state, rect.width, rect.height);
  pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * pixelRatio);
  canvas.height = Math.round(rect.height * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}
window.addEventListener('resize', fit);
fit();
resetWorld(state);

function position(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || activePointer !== null || state.heroStatus.hp <= 0) return;
  event.preventDefault();
  const point = position(event);
  pointerDown(state, point.x, point.y);
  activePointer = event.pointerId;
  canvas.setPointerCapture(activePointer);
});
canvas.addEventListener('pointermove', event => {
  if (activePointer !== null && event.pointerId !== activePointer) return;
  const point = position(event);
  pointerMove(state, point.x, point.y);
});
window.addEventListener('pointerup', event => {
  if (event.pointerId !== activePointer || event.button !== 0) return;
  pointerUp(state);
  const id = activePointer;
  activePointer = null;
  if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
});
function interrupt() {
  const id = activePointer;
  activePointer = null;
  cancelInput(state);
  loop.reset();
  previousTime = null;
  fpsCounter.reset();
  if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
}
canvas.addEventListener('pointercancel', interrupt);
canvas.addEventListener('lostpointercapture', event => {
  if (event.pointerId === activePointer) interrupt();
});
canvas.addEventListener('contextmenu', event => event.preventDefault());
window.addEventListener('blur', () => { focusPaused = true; interrupt(); });
window.addEventListener('focus', () => { focusPaused = false; interrupt(); });
document.addEventListener('visibilitychange', () => {
  interrupt();
});
document.querySelector('#reset').addEventListener('click', () => {
  interrupt();
  resetWorld(state);
});
mountSettings(state, interrupt);

function frame(timestamp) {
  if (window.devicePixelRatio !== pixelRatio) fit();
  state.paused = focusPaused || document.hidden || !settingsPanel.hidden;
  if (state.paused !== wasPaused) { previousTime = null; loop.reset(); fpsCounter.reset(); }
  wasPaused = state.paused;
  if (!state.paused && previousTime !== null) loop.advance((timestamp - previousTime) / 1000);
  previousTime = timestamp;
  render(ctx, state, portrait, timestamp / 1000, targetPortrait, skeletonPortrait);
  const fps = fpsCounter.sample(timestamp);
  const fpsText = fps === null ? 'FPS —' : `FPS ${fps}`;
  if (fpsLabel.textContent !== fpsText) fpsLabel.textContent = fpsText;
  coordinates.textContent = `${Math.round(state.hero.x)} · ${Math.round(state.hero.y)}`;
  const phases = { approach: 'Подход', windup: 'Замах', swing: 'Удар', recovery: 'Восстановление' };
  mode.textContent = state.heroStatus.hp <= 0 ? 'Погиб' : state.paused ? 'Пауза' : state.movementBlocked ? 'Преграда' : phases[state.combat.phase] || (state.pointer.following ? 'Следование' : state.target ? 'В точку' : Math.hypot(state.velocity.x, state.velocity.y) > 1 ? 'Торможение' : 'Покой');
  canvas.style.cursor = state.heroStatus.hp > 0 && hitTestEnemy(state, state.pointer.x, state.pointer.y) ? 'pointer' : 'crosshair';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (new URLSearchParams(location.search).get('test') === '1') {
  window.__arpg = { snapshot: () => structuredClone(state), portraitReady: () => [portrait, targetPortrait, skeletonPortrait].every(image => image.complete && image.naturalWidth > 0) };
}
