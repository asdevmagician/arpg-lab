const SKIN = 1e-6;

// Sweep a point against circles expanded by the moving circle's radius.
export function moveCircle(position, delta, radius, obstacles) {
  let x = position.x, y = position.y, dx = delta.x, dy = delta.y;
  const normals = [];
  for (let iteration = 0; iteration < 4; iteration++) {
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < 1e-16) break;
    let contact = null;
    for (const obstacle of obstacles) {
      const ox = x - obstacle.x, oy = y - obstacle.y;
      const combined = radius + obstacle.radius;
      const dot = ox * dx + oy * dy;
      if (dot >= 0) continue;
      const c = ox * ox + oy * oy - combined * combined;
      const discriminant = dot * dot - lengthSquared * c;
      if (discriminant < 0) continue;
      const t = Math.max(0, (-dot - Math.sqrt(discriminant)) / lengthSquared);
      if (t > 1 || (contact && t >= contact.t)) continue;
      const cx = x + dx * t - obstacle.x, cy = y + dy * t - obstacle.y;
      const distance = Math.hypot(cx, cy);
      contact = { t, nx: distance > SKIN ? cx / distance : 1, ny: distance > SKIN ? cy / distance : 0 };
    }
    if (!contact) { x += dx; y += dy; break; }
    const travel = Math.max(0, contact.t - SKIN / Math.sqrt(lengthSquared));
    x += dx * travel; y += dy * travel;
    dx *= 1 - travel; dy *= 1 - travel;
    const inward = dx * contact.nx + dy * contact.ny;
    if (inward < 0) { dx -= inward * contact.nx; dy -= inward * contact.ny; }
    normals.push({ x: contact.nx, y: contact.ny });
  }
  return { x, y, normals };
}

// Fixed targets outrank the hero; the hero outranks mobile enemies.
export function separateCircles(bodies, radius) {
  let unresolved = false;
  for (let iteration = 0; iteration < 12; iteration++) {
    let changed = false;
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      const dx = b.position.x - a.position.x, dy = b.position.y - a.position.y;
      const distance = Math.hypot(dx, dy), overlap = radius * 2 - distance;
      if (overlap <= SKIN || (a.priority === 2 && b.priority === 2)) continue;
      const nx = distance > SKIN ? dx / distance : Math.cos((i + j) * 2.3999632297);
      const ny = distance > SKIN ? dy / distance : Math.sin((i + j) * 2.3999632297);
      const aShare = a.priority > b.priority ? 0 : a.priority < b.priority ? 1 : 0.5;
      a.position.x -= nx * (overlap + SKIN) * aShare;
      a.position.y -= ny * (overlap + SKIN) * aShare;
      b.position.x += nx * (overlap + SKIN) * (1 - aShare);
      b.position.y += ny * (overlap + SKIN) * (1 - aShare);
      changed = true;
    }
    if (!changed) break;
    if (iteration === 11) unresolved = true;
  }
  if (!unresolved) return;
  // Collinear circles can oscillate between two anchors; choose a nearby free boundary point.
  const combined = radius * 2 + SKIN * 2;
  for (const body of bodies) {
    if (body.priority === 2) continue;
    const anchors = bodies.filter(other => other.priority > body.priority);
    if (!anchors.some(other => Math.hypot(body.position.x - other.position.x, body.position.y - other.position.y) < radius * 2 - SKIN)) continue;
    let best = null;
    for (const anchor of anchors) for (let angle = 0; angle < 32; angle++) {
      const x = anchor.position.x + Math.cos(angle * Math.PI / 16) * combined;
      const y = anchor.position.y + Math.sin(angle * Math.PI / 16) * combined;
      if (anchors.some(other => Math.hypot(x - other.position.x, y - other.position.y) < radius * 2)) continue;
      const distance = Math.hypot(x - body.position.x, y - body.position.y);
      if (!best || distance < best.distance) best = { x, y, distance };
    }
    if (best) { body.position.x = best.x; body.position.y = best.y; }
  }
}
