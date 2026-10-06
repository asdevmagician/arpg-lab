const GRID = 64;
import { getActorScale, sortActorsByLayer } from './layers.js';

export function render(ctx, state, portrait, time = 0, targetPortrait, skeletonPortrait) {
  const { width, height } = state.viewport;
  const zoom = state.params?.cameraZoom ?? 1;
  const scale = value => value * zoom;
  const screen = (x, y) => ({ x: width / 2 + (x - state.camera.x) * zoom, y: height / 2 + (y - state.camera.y) * zoom });
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#141e1c'; ctx.fillRect(0, 0, width, height);
  const left = state.camera.x - width / (2 * zoom), top = state.camera.y - height / (2 * zoom);
  const startX = Math.floor(left / GRID) * GRID, startY = Math.floor(top / GRID) * GRID;
  for (let x = startX; x < left + width / zoom + GRID; x += GRID) {
    for (let y = startY; y < top + height / zoom + GRID; y += GRID) {
      const p = screen(x, y);
      if ((Math.floor(x / GRID) + Math.floor(y / GRID)) % 2 === 0) { ctx.fillStyle = '#17211e'; ctx.fillRect(p.x, p.y, scale(GRID), scale(GRID)); }
      const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, noise = seed - Math.floor(seed);
      if (noise > 0.55) { ctx.fillStyle = '#52604b35'; ctx.beginPath(); ctx.ellipse(p.x + scale(10 + noise * 36), p.y + scale(14 + noise * 29), scale(2 + noise * 2), scale(1.4), noise * 3, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  for (const major of [false, true]) {
    ctx.beginPath(); ctx.strokeStyle = major ? '#87947b18' : '#87947b0c'; ctx.lineWidth = 1;
    for (let x = startX; x <= left + width / zoom; x += GRID) { if ((x % 256 === 0) !== major) continue; const p = screen(x, 0); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, height); }
    for (let y = startY; y <= top + height / zoom; y += GRID) { if ((y % 256 === 0) !== major) continue; const p = screen(0, y); ctx.moveTo(0, p.y); ctx.lineTo(width, p.y); }
    ctx.stroke();
  }
  ctx.font = `${Math.max(8, scale(9))}px Consolas, monospace`;
  for (let x = Math.floor(left / 512) * 512; x <= left + width / zoom; x += 512) for (let y = Math.floor(top / 512) * 512; y <= top + height / zoom; y += 512) {
    const p = screen(x, y); ctx.strokeStyle = '#a5ad8040'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x - scale(7), p.y); ctx.lineTo(p.x + scale(7), p.y); ctx.moveTo(p.x, p.y - scale(7)); ctx.lineTo(p.x, p.y + scale(7)); ctx.stroke(); ctx.fillStyle = '#8e9b7766'; ctx.fillText(`${x} / ${y}`, p.x + scale(11), p.y + scale(16));
  }
  if (state.target) {
    const p = screen(state.target.x, state.target.y); ctx.strokeStyle = '#c8c79580'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, scale(7), 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x - scale(11), p.y); ctx.lineTo(p.x - scale(4), p.y); ctx.moveTo(p.x + scale(4), p.y); ctx.lineTo(p.x + scale(11), p.y); ctx.moveTo(p.x, p.y - scale(11)); ctx.lineTo(p.x, p.y - scale(4)); ctx.moveTo(p.x, p.y + scale(4)); ctx.lineTo(p.x, p.y + scale(11)); ctx.stroke();
  }
  const heroStatus = state.heroStatus ?? { id: 'hero', hp: 100, maxHp: 100, layer: 0, radius: 26 };
  const actors = [];
  if (state.enemy) actors.push({ ...state.enemy, kind: 'target', image: targetPortrait, label: 'Мишень', state });
  for (const enemy of state.spawnedEnemies ?? []) actors.push({ ...enemy, kind: 'skeleton', image: skeletonPortrait, label: 'Скелет', combat: enemy.combat, state });
  actors.push({ ...heroStatus, ...state.hero, id: 'hero', kind: 'hero', image: portrait, label: 'Герой', combat: state.combat, state });
  for (const actor of sortActorsByLayer(actors)) drawActor(ctx, actor, screen, zoom, time, state);
  if (state.params.showColliders) {
    ctx.save(); ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
    ctx.strokeStyle = state.params.collisionsEnabled ? '#8fe6edcc' : '#8fe6ed55';
    for (const actor of actors) if (actor.hp > 0) {
      const p = screen(actor.x, actor.y);
      ctx.beginPath(); ctx.arc(p.x, p.y, state.params.collisionRadius * zoom, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawAttack(ctx, point, combat, zoom, kind) {
  if (!['windup', 'swing', 'recovery'].includes(combat.phase)) return;
  const base = combat.angle;
  const reach = combat.range * zoom;
  const side = combat.side;
  const start = base + side * 80 * Math.PI / 180;
  const end = base - side * 80 * Math.PI / 180;
  const inner = 30 * zoom;
  const colors = kind === 'skeleton'
    ? { guide: '#db646435', aim: '#ee817cbb', trail0: '#750e0e00', trail1: '#be252544', trail2: '#ff655faa', edge: '#f04a43', tip: '#ffd0ca' }
    : { guide: '#dcc98a35', aim: '#ecd79688', trail0: '#e9d58a00', trail1: '#d8c47844', trail2: '#f2e4a0aa', edge: '#f1d87c', tip: '#fff1c1' };
  ctx.save();
  ctx.lineCap = 'round';
  if (combat.phase === 'windup') {
    ctx.strokeStyle = colors.guide; ctx.lineWidth = zoom;
    ctx.beginPath(); ctx.arc(point.x, point.y, reach, start, end, side > 0); ctx.stroke();
    ctx.strokeStyle = colors.aim; ctx.lineWidth = 2 * zoom;
    ctx.beginPath(); ctx.moveTo(point.x + Math.cos(start) * inner, point.y + Math.sin(start) * inner);
    ctx.lineTo(point.x + Math.cos(start) * reach, point.y + Math.sin(start) * reach); ctx.stroke();
    ctx.restore(); return;
  }
  const progress = combat.phase === 'swing' ? Math.min(1, combat.elapsed / combat.swingDuration) : 1;
  const tailProgress = Math.max(0, progress - 0.32);
  const head = start + (end - start) * progress;
  const tail = start + (end - start) * tailProgress;
  ctx.globalAlpha = combat.phase === 'swing' ? 0.75 + 0.25 * Math.sin(progress * Math.PI) : Math.max(0, 1 - combat.elapsed / Math.min(0.12, combat.recovery)) * 0.45;
  ctx.beginPath(); ctx.arc(point.x, point.y, reach, tail, head, side > 0);
  ctx.arc(point.x, point.y, inner, head, tail, side < 0); ctx.closePath();
  const gradient = ctx.createRadialGradient(point.x, point.y, inner, point.x, point.y, reach);
  gradient.addColorStop(0, colors.trail0); gradient.addColorStop(0.7, colors.trail1); gradient.addColorStop(1, colors.trail2);
  ctx.fillStyle = gradient; ctx.fill();
  ctx.strokeStyle = colors.edge; ctx.lineWidth = 2.5 * zoom;
  ctx.beginPath(); ctx.arc(point.x, point.y, reach, tail, head, side > 0); ctx.stroke();
  ctx.strokeStyle = colors.tip; ctx.lineWidth = 2 * zoom;
  ctx.beginPath(); ctx.moveTo(point.x + Math.cos(head) * inner, point.y + Math.sin(head) * inner);
  ctx.lineTo(point.x + Math.cos(head) * reach, point.y + Math.sin(head) * reach); ctx.stroke();
  ctx.restore();
}

function drawPortrait(ctx, image, x, y, radius, border, fallback = '#5f735b') {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip();
  if (image?.complete && image.naturalWidth) ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
  else { ctx.fillStyle = fallback; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2); }
  ctx.restore(); ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, radius + 1, 0, Math.PI * 2); ctx.stroke();
}

function drawActor(ctx, actor, screen, zoom, time, state) {
  const point = screen(actor.x, actor.y), scale = getActorScale(actor, state.params) * zoom;
  const alive = actor.hp > 0;
  const flash = Math.max(0, actor.hitFlash ?? 0);
  const combat = actor.kind === 'hero' ? actor.combat : actor.kind === 'skeleton' ? actor.combat : null;
  if (alive && combat) drawAttack(ctx, point, combat, zoom, actor.kind);

  ctx.save();
  ctx.translate(point.x, point.y); ctx.scale(scale, scale);
  if (!alive) ctx.filter = 'grayscale(1)';
  if (actor.kind !== 'target') {
    const shadow = ctx.createRadialGradient(0, 5, 18, 0, 5, 48);
    shadow.addColorStop(0, '#050b08a0'); shadow.addColorStop(1, '#050b0800');
    ctx.fillStyle = shadow; ctx.beginPath(); ctx.arc(0, 5, 48, 0, Math.PI * 2); ctx.fill();
  }

  const selected = actor.kind !== 'hero' && state.combat?.selected && state.combat.targetId === actor.id;
  if (alive && selected) { ctx.strokeStyle = '#c8c79599'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, (actor.radius ?? 26) + 8, 0, Math.PI * 2); ctx.stroke(); }
  if (alive && flash) { ctx.fillStyle = `rgba(255,220,150,${Math.min(.55, flash * 2)})`; ctx.beginPath(); ctx.arc(0, 0, (actor.radius ?? 26) + 4, 0, Math.PI * 2); ctx.fill(); }

  const border = actor.kind === 'hero' ? '#beb58a' : actor.kind === 'skeleton' ? '#bd7770' : '#a78870';
  const fallback = actor.kind === 'skeleton' ? '#77736d' : actor.kind === 'hero' ? '#5f735b' : '#745c4c';
  drawPortrait(ctx, actor.image, 0, 0, actor.radius ?? 26, alive ? border : '#77736d', fallback);
  if (alive) {
    const ratio = actor.maxHp > 0 ? Math.max(0, Math.min(1, actor.hp / actor.maxHp)) : 0;
    if (ratio > 0) {
      ctx.save();
      ctx.strokeStyle = actor.kind === 'hero' ? '#8fca8c' : actor.kind === 'skeleton' ? '#df5550' : '#c87565';
      ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, (actor.radius ?? 26) + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio); ctx.stroke();
      ctx.restore();
    }
  }
  if (actor.kind === 'hero' && state.pointer.following && alive) {
    ctx.strokeStyle = '#c3dba025'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 37 + Math.sin(time * 3) * .8, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#c7d1bd'; ctx.font = `11px 'Segoe UI', sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(actor.label, 0, (actor.radius ?? 26) + 15);
  ctx.font = '9px Consolas, monospace'; ctx.fillStyle = '#bdc2ad';
  ctx.fillText(`${Math.max(0, actor.hp)} / ${actor.maxHp}`, 0, (actor.radius ?? 26) + 29);
  ctx.restore();
}
