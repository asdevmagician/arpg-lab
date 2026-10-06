import {
  PARAM_SCHEMA, updateParameters, DEFAULT_PARAMS, saveParameters,
  loadInterfaceState, saveInterfaceState,
} from './settings.js';

const GROUPS = [
  ['movement', 'Движение'],
  ['camera', 'Камера'],
  ['attack', 'Атака'],
  ['enemy', 'Враг'],
  ['layers', 'Слои'],
  ['spawners', 'Спавнеры'],
  ['collisions', 'Коллайдеры'],
];
const GROUP_TITLES = new Map(GROUPS);

export function mountSettings(state, onChange = () => {}) {
  const host = document.querySelector('#parameter-fields');
  const panel = document.querySelector('#settings-panel');
  const toggle = document.querySelector('#settings-toggle');
  const status = document.querySelector('#settings-status');
  const groups = new Map();
  const uiState = loadInterfaceState();
  for (const [key, title] of GROUPS) {
    const section = document.createElement('details');
    section.className = 'parameter-group'; section.dataset.group = key; section.open = uiState.sections[key];
    const summary = document.createElement('summary'); summary.textContent = title; section.append(summary); host.append(section); groups.set(key, section);
    section.addEventListener('toggle', () => {
      uiState.sections[key] = section.open;
      updateStatus(saveInterfaceState(uiState) ? '' : 'Настройки не удалось сохранить');
    });
  }
  const controls = new Map();
  const format = (value, step) => Number(value).toFixed(step < 1 ? Math.max(1, String(step).split('.')[1]?.length || 0) : 0);
  const updateStatus = message => { status.textContent = message; };

  for (const item of PARAM_SCHEMA) {
    const row = document.createElement('div'); row.className = 'parameter-row';
    const labelRow = document.createElement('div'); labelRow.className = 'parameter-label-row';
    const label = document.createElement('label'); label.htmlFor = `param-${item.key}`; label.textContent = item.label;
    const reset = document.createElement('button');
    reset.type = 'button'; reset.className = 'parameter-reset'; reset.textContent = '↺';
    reset.setAttribute('aria-label', `Сбросить значение: ${GROUP_TITLES.get(item.group)} — ${item.label}`);
    const defaultValue = item.type === 'boolean'
      ? (DEFAULT_PARAMS[item.key] ? 'включено' : 'выключено')
      : item.type === 'select'
        ? item.options.find(option => option.value === DEFAULT_PARAMS[item.key])?.label ?? DEFAULT_PARAMS[item.key]
        : `${format(DEFAULT_PARAMS[item.key], Number(item.step))}${item.unit ? ` ${item.unit}` : ''}`;
    reset.title = `По умолчанию: ${defaultValue}`;
    labelRow.append(label, reset);
    const inputRow = document.createElement('div'); inputRow.className = 'parameter-inputs';
    let range = null;
    if (item.type === 'select') {
      const select = document.createElement('select'); select.id = `param-${item.key}`; select.setAttribute('aria-label', item.label);
      for (const option of item.options) { const node = document.createElement('option'); node.value = option.value; node.textContent = option.label; select.append(node); }
      label.htmlFor = select.id; inputRow.append(select); controls.set(item.key, { select, item });
      select.addEventListener('change', () => {
        updateParameters(state, { [item.key]: select.value }); onChange(state.params);
        updateStatus(saveParameters(state.params) ? '' : 'Настройки не удалось сохранить');
      });
    } else if (item.type === 'boolean') {
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = `param-${item.key}`; checkbox.setAttribute('aria-label', item.label);
      label.htmlFor = checkbox.id; inputRow.append(checkbox); controls.set(item.key, { checkbox, item });
      checkbox.addEventListener('change', () => {
        updateParameters(state, { [item.key]: checkbox.checked }); onChange(state.params);
        updateStatus(saveParameters(state.params) ? '' : 'Настройки не удалось сохранить');
      });
    } else {
      const numeric = document.createElement('input'); numeric.type = 'number'; numeric.id = `param-${item.key}`; numeric.min = item.min; numeric.max = item.max; numeric.step = item.step; numeric.setAttribute('aria-label', item.label);
      range = document.createElement('input'); range.type = 'range'; range.id = `range-${item.key}`; range.min = item.min; range.max = item.max; range.step = item.step; range.setAttribute('aria-label', `${item.label}, шкала`);
      const unit = document.createElement('span'); unit.className = 'unit'; unit.textContent = item.unit || '';
      inputRow.append(range, numeric, unit); controls.set(item.key, { range, numeric, item });
      const commit = (source, finish = false) => {
        const n = source.valueAsNumber; if (!Number.isFinite(n)) { if (finish) sync(); return; }
        updateParameters(state, { [item.key]: n });
        const value = state.params[item.key];
        range.value = value;
        if (source === range || finish) numeric.value = format(value, Number(item.step));
        onChange(state.params); updateStatus(saveParameters(state.params) ? '' : 'Настройки не удалось сохранить');
      };
      range.addEventListener('input', () => commit(range));
      numeric.addEventListener('input', () => commit(numeric));
      numeric.addEventListener('change', () => commit(numeric, true));
    }
    reset.addEventListener('click', () => {
      updateParameters(state, { [item.key]: DEFAULT_PARAMS[item.key] });
      sync(item.key);
      onChange(state.params);
      updateStatus(saveParameters(state.params) ? '' : 'Настройки не удалось сохранить');
    });
    row.append(labelRow, inputRow); groups.get(item.group)?.append(row);
  }

  function sync(onlyKey = null) {
    for (const [key, control] of controls) {
      if (onlyKey !== null && key !== onlyKey) continue;
      if (control.select) control.select.value = state.params[key];
      else if (control.checkbox) control.checkbox.checked = state.params[key];
      else {
        const value = format(state.params[key], Number(control.item.step));
        control.range.value = value; control.numeric.value = value;
      }
    }
  }
  const setOpen = (open, interrupt = true) => {
    if (open && interrupt) onChange(state.params);
    panel.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); uiState.visible = open;
    updateStatus(saveInterfaceState(uiState) ? '' : 'Настройки не удалось сохранить');
  };
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  document.querySelector('#panel-close').addEventListener('click', () => setOpen(false));
  document.querySelector('#settings-defaults').addEventListener('click', () => {
    updateParameters(state, DEFAULT_PARAMS); updateStatus(saveParameters(state.params) ? '' : 'Настройки не удалось сохранить'); sync(); onChange(state.params);
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { setOpen(false); toggle.focus(); } });
  panel.addEventListener('pointerdown', event => { event.stopPropagation(); onChange(state.params); });
  sync(); panel.hidden = !uiState.visible; toggle.setAttribute('aria-expanded', String(uiState.visible));
}
