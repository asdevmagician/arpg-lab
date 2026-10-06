export const STORAGE_KEY = 'arpg-lab-parameters-v1';
export const UI_STORAGE_KEY = 'arpg-lab-interface-v2';
export const AUTO_ATTACK_MODES = Object.freeze(['off', 'hover', 'nearby']);
export const DEFAULT_UI_STATE = Object.freeze({
  visible: false,
  sections: Object.freeze({ movement: false, camera: false, attack: false, enemy: false, layers: false, spawners: false, collisions: false }),
});
export const DEFAULT_PARAMS = Object.freeze({
  maxSpeed: 240, accelerationTime: 0.3, brakingTime: 0.2, turnTime: 0.2,
  cameraZoom: 1, holdDelay: 0.16, deadZone: 12,
  windup: 0.2, swingDuration: 0.16, recovery: 0.24, attackRange: 100, damage: 10,
  autoAttackMode: 'hover', deathDuration: 0.2,
  enemyAttackRange: 120, enemyDamage: 10, enemyWindup: 0.35, enemySwingDuration: 0.18, enemyRecovery: 0.6,
  enemyMoveSpeed: 110,
  collisionsEnabled: true, showColliders: false, collisionRadius: 26,
  baseLayerScale: 1, floorLayerScale: 0.9,
  autoContinueAttack: false, autoRetaliate: false,
  spawnersEnabled: true, spawnInterval: 6, maxEnemies: 8,
});

export const PARAM_SCHEMA = [
  { key: 'maxSpeed', label: 'Максимальная скорость', group: 'movement', min: 60, max: 600, step: 10, unit: 'ед/с' },
  { key: 'accelerationTime', label: 'Время разгона', group: 'movement', min: 0.05, max: 2, step: 0.05, unit: 'с' },
  { key: 'brakingTime', label: 'Время торможения', group: 'movement', min: 0.05, max: 2, step: 0.05, unit: 'с' },
  { key: 'turnTime', label: 'Время поворота', group: 'movement', min: 0.05, max: 2, step: 0.05, unit: 'с' },
  { key: 'holdDelay', label: 'Порог удержания', group: 'movement', min: 0.05, max: 0.5, step: 0.01, unit: 'с' },
  { key: 'deadZone', label: 'Радиус покоя', group: 'movement', min: 0, max: 40, step: 1, unit: 'px' },
  { key: 'cameraZoom', label: 'Масштаб камеры', group: 'camera', min: 0.5, max: 1.5, step: 0.05, unit: '×' },
  { key: 'autoAttackMode', label: 'Автопереход к атаке', group: 'attack', type: 'select', options: [
    { value: 'off', label: 'Выкл' },
    { value: 'hover', label: 'Курсор над целью' },
    { value: 'nearby', label: 'При сближении' },
  ] },
  { key: 'windup', label: 'Замах', group: 'attack', min: 0.05, max: 1, step: 0.01, unit: 'с' },
  { key: 'swingDuration', label: 'Время удара', group: 'attack', min: 0.05, max: 0.6, step: 0.01, unit: 'с' },
  { key: 'recovery', label: 'Восстановление', group: 'attack', min: 0.05, max: 1, step: 0.01, unit: 'с' },
  { key: 'attackRange', label: 'Дистанция атаки', group: 'attack', min: 60, max: 240, step: 5, unit: 'ед' },
  { key: 'damage', label: 'Урон', group: 'attack', min: 1, max: 50, step: 1, unit: 'HP' },
  { key: 'deathDuration', label: 'Время визуализации смерти', group: 'attack', min: 0.05, max: 1, step: 0.01, unit: 'с' },
  { key: 'autoContinueAttack', label: 'Продолжать атаку автоматически', group: 'attack', type: 'boolean' },
  { key: 'autoRetaliate', label: 'Отвечать на полученный удар', group: 'attack', type: 'boolean' },
  { key: 'enemyAttackRange', label: 'Дистанция атаки', group: 'enemy', min: 40, max: 240, step: 5, unit: 'ед' },
  { key: 'enemyDamage', label: 'Урон', group: 'enemy', min: 1, max: 50, step: 1, unit: 'HP' },
  { key: 'enemyWindup', label: 'Замах', group: 'enemy', min: 0.05, max: 2, step: 0.01, unit: 'с' },
  { key: 'enemySwingDuration', label: 'Время удара', group: 'enemy', min: 0.05, max: 1, step: 0.01, unit: 'с' },
  { key: 'enemyRecovery', label: 'Восстановление', group: 'enemy', min: 0.05, max: 3, step: 0.01, unit: 'с' },
  { key: 'enemyMoveSpeed', label: 'Скорость преследования', group: 'enemy', min: 0, max: 400, step: 10, unit: 'ед/с' },
  { key: 'collisionsEnabled', label: 'Коллизии включены', group: 'collisions', type: 'boolean' },
  { key: 'showColliders', label: 'Показывать коллайдеры', group: 'collisions', type: 'boolean' },
  { key: 'collisionRadius', label: 'Радиус коллайдера', group: 'collisions', min: 8, max: 40, step: 1, unit: 'ед' },
  { key: 'baseLayerScale', label: 'Масштаб базового слоя', group: 'layers', min: 0.5, max: 1.5, step: 0.05, unit: '×' },
  { key: 'floorLayerScale', label: 'Масштаб пола', group: 'layers', min: 0.5, max: 1.5, step: 0.05, unit: '×' },
  { key: 'spawnersEnabled', label: 'Спавнеры включены', group: 'spawners', type: 'boolean' },
  { key: 'spawnInterval', label: 'Интервал появления', group: 'spawners', min: 0.5, max: 60, step: 0.5, unit: 'с' },
  { key: 'maxEnemies', label: 'Максимум врагов', group: 'spawners', min: 0, max: 50, step: 1, unit: 'врагов', integer: true },
];

export function sanitizeParameters(value, base = DEFAULT_PARAMS) {
  const result = { ...base };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const field of PARAM_SCHEMA) {
    if (!Object.hasOwn(value, field.key)) continue;
    if (field.type === 'boolean') {
      if (typeof value[field.key] === 'boolean') result[field.key] = value[field.key];
    } else if (field.type === 'select') {
      if (field.options.some(option => option.value === value[field.key])) result[field.key] = value[field.key];
    } else if (typeof value[field.key] === 'number' && Number.isFinite(value[field.key])) {
      const bounded = Math.min(field.max, Math.max(field.min, value[field.key]));
      result[field.key] = field.integer ? Math.round(bounded) : bounded;
    }
  }
  return result;
}

export function sanitizeInterfaceState(value) {
  const sections = { ...DEFAULT_UI_STATE.sections };
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of Object.keys(sections)) if (typeof value.sections?.[key] === 'boolean') sections[key] = value.sections[key];
    return { visible: typeof value.visible === 'boolean' ? value.visible : DEFAULT_UI_STATE.visible, sections };
  }
  return { visible: DEFAULT_UI_STATE.visible, sections };
}

export function loadInterfaceState(storage) {
  try { return sanitizeInterfaceState(JSON.parse((storage ?? globalThis.localStorage).getItem(UI_STORAGE_KEY))); }
  catch { return sanitizeInterfaceState(null); }
}

export function saveInterfaceState(value, storage) {
  try { (storage ?? globalThis.localStorage).setItem(UI_STORAGE_KEY, JSON.stringify(sanitizeInterfaceState(value))); return true; }
  catch { return false; }
}

export function updateParameters(state, patch) {
  Object.assign(state.params, sanitizeParameters(patch, state.params));
}

export function loadParameters(storage) {
  try {
    return sanitizeParameters(JSON.parse((storage ?? globalThis.localStorage).getItem(STORAGE_KEY)));
  } catch { return { ...DEFAULT_PARAMS }; }
}

export function saveParameters(params, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(STORAGE_KEY, JSON.stringify(sanitizeParameters(params)));
    return true;
  } catch { return false; }
}
