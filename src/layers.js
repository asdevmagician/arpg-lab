const DEFAULT_BASE_SCALE = 1;
const DEFAULT_FLOOR_SCALE = 0.9;

export function getLayerScale(layer, params = {}) {
  return layer < 0
    ? (params.floorLayerScale ?? DEFAULT_FLOOR_SCALE)
    : (params.baseLayerScale ?? DEFAULT_BASE_SCALE);
}

export function getActorScale(actor, params = {}) {
  const floorScale = params.floorLayerScale ?? DEFAULT_FLOOR_SCALE;
  if (actor.hp > 0) return getLayerScale(actor.layer ?? 0, params);

  const startScale = actor.deathStartScale ?? (params.baseLayerScale ?? DEFAULT_BASE_SCALE);
  const duration = params.deathDuration ?? 0.2;
  const progress = duration > 0
    ? Math.max(0, Math.min(1, (actor.deathElapsed ?? 0) / duration))
    : 1;
  const eased = progress * progress * (3 - 2 * progress);
  return startScale + (floorScale - startScale) * eased;
}

export function sortActorsByLayer(actors) {
  return [...actors].sort((a, b) => {
    const layerOrder = (a.layer ?? 0) - (b.layer ?? 0);
    if (layerOrder) return layerOrder;
    if (a.id === 'hero' && b.id !== 'hero') return 1;
    if (b.id === 'hero' && a.id !== 'hero') return -1;
    return 0;
  });
}
