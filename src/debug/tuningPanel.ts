import { TUNING, type TuningKey } from '../tuning';
import { TUNING_SCHEMA } from '../tuningSchema';

/**
 * Dev-only tuning panel: a stack of sliders that mutate TUNING live (calling
 * the supplied per-key handler so the scene re-applies the value) plus a Save
 * button that writes the current values back into src/tuning.ts via the Vite
 * dev-server endpoint in vite.config.ts.
 */
export type TuningHandlers = Partial<Record<TuningKey, (value: number) => void>>;

const CSS = `
.tuning-panel{position:fixed;top:8px;right:8px;width:228px;max-height:92vh;overflow:auto;
  background:rgba(10,12,16,.88);border:1px solid #2a3344;border-radius:6px;padding:8px 10px;
  font:11px/1.4 ui-monospace,Menlo,monospace;color:#cdd6e4;z-index:9999;
  box-shadow:0 4px 18px rgba(0,0,0,.5);backdrop-filter:blur(2px);}
.tuning-panel h1{font-size:11px;letter-spacing:.12em;margin:0 0 6px;display:flex;
  justify-content:space-between;align-items:center;color:#7fb8d9;cursor:pointer;}
.tuning-panel h2{font-size:10px;letter-spacing:.1em;color:#566;margin:10px 0 4px;
  border-top:1px solid #1d2533;padding-top:6px;}
.tuning-panel .row{display:flex;justify-content:space-between;margin-bottom:1px;}
.tuning-panel .row .val{color:#9fe0ff;}
.tuning-panel input[type=range]{width:100%;margin:0 0 6px;accent-color:#36e0ff;}
.tuning-panel .save{width:100%;margin-top:10px;padding:6px;background:#173042;color:#9fe0ff;
  border:1px solid #2f6080;border-radius:4px;cursor:pointer;font:inherit;letter-spacing:.08em;}
.tuning-panel .save:hover{background:#1d4257;}
.tuning-panel .status{display:block;text-align:center;margin-top:5px;min-height:13px;color:#8aa;}
.tuning-panel.collapsed .body{display:none;}
`;

function fmt(value: number, step: number): string {
  if (step >= 1) return String(value);
  return value.toFixed(step < 0.05 ? 3 : 2);
}

export function createTuningPanel(handlers: TuningHandlers): void {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'tuning-panel';

  const title = document.createElement('h1');
  title.innerHTML = '<span>TUNING</span><span>▾</span>';
  title.onclick = () => panel.classList.toggle('collapsed');
  panel.appendChild(title);

  const body = document.createElement('div');
  body.className = 'body';
  panel.appendChild(body);

  let currentGroup = '';
  for (const param of TUNING_SCHEMA) {
    if (param.group !== currentGroup) {
      currentGroup = param.group;
      const h2 = document.createElement('h2');
      h2.textContent = param.group;
      body.appendChild(h2);
    }

    const row = document.createElement('div');
    row.className = 'row';
    const label = document.createElement('span');
    label.textContent = param.label;
    const valEl = document.createElement('span');
    valEl.className = 'val';
    valEl.textContent = fmt(TUNING[param.key], param.step);
    row.append(label, valEl);
    body.appendChild(row);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(param.min);
    input.max = String(param.max);
    input.step = String(param.step);
    input.value = String(TUNING[param.key]);
    input.oninput = () => {
      const v = parseFloat(input.value);
      TUNING[param.key] = v;
      valEl.textContent = fmt(v, param.step);
      handlers[param.key]?.(v);
    };
    body.appendChild(input);
  }

  const status = document.createElement('span');
  status.className = 'status';

  const save = document.createElement('button');
  save.className = 'save';
  save.textContent = 'SAVE TO CODE';
  save.onclick = async () => {
    status.textContent = 'saving…';
    try {
      const res = await fetch('/__tune/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(TUNING),
      });
      if (!res.ok) throw new Error(await res.text());
      status.textContent = 'saved ✓ src/tuning.ts';
    } catch (err) {
      status.textContent = 'save failed (see console)';
      console.error('[tuning] save failed', err);
    }
    setTimeout(() => (status.textContent = ''), 2500);
  };
  body.append(save, status);

  document.body.appendChild(panel);
}
