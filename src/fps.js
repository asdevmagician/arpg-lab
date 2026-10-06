export function createFpsCounter(sampleWindowMs = 500) {
  const windowMs = Number.isFinite(sampleWindowMs) && sampleWindowMs > 0 ? sampleWindowMs : 500;
  let timestamps = [];
  let lastSample = null;
  let lastPublished = null;
  let lastFps = null;

  function reset() {
    timestamps = [];
    lastSample = null;
    lastPublished = null;
    lastFps = null;
  }

  function sample(timestampMs) {
    if (!Number.isFinite(timestampMs)) return lastFps;
    if (lastSample !== null && timestampMs <= lastSample) return lastFps;
    if (lastSample !== null && timestampMs - lastSample > 1000) {
      timestamps = [timestampMs];
      lastSample = timestampMs;
      lastPublished = timestampMs;
      lastFps = null;
      return null;
    }

    if (lastPublished === null) lastPublished = timestampMs;
    timestamps.push(timestampMs);
    lastSample = timestampMs;
    const cutoff = timestampMs - windowMs;
    while (timestamps.length && timestamps[0] < cutoff) timestamps.shift();

    if (timestampMs - lastPublished < windowMs || timestamps.length < 2) return lastFps;
    const first = timestamps[0];
    const elapsed = timestampMs - first;
    if (elapsed <= 0) return lastFps;
    lastPublished = timestampMs;
    lastFps = Math.round((timestamps.length - 1) * 1000 / elapsed);
    return lastFps;
  }

  return { sample, reset };
}
