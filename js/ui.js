// ======= ui.js — sheets, forms, toasts, tap handling and screen navigation =======
// Every screen renders HTML with data-act="name" on tappable elements. One delegated
// listener per stable root (the view, each sheet) calls the matching handler, so taps
// never "die" after a re-render.

const UI = {
  _stack: [],

  // Delegated taps: handlers[name](element, event). Also data-change for inputs/selects.
  on(root, handlers) {
    root.onclick = (e) => {
      const t = e.target.closest('[data-act]');
      if (!t || !root.contains(t)) return;
      const fn = handlers[t.dataset.act];
      if (fn) { e.stopPropagation(); fn(t, e); }
    };
    root.onchange = (e) => {
      const t = e.target.closest('[data-change]');
      if (!t || !root.contains(t)) return;
      const fn = handlers[t.dataset.change];
      if (fn) fn(t, e);
    };
  },

  // Bottom sheet. Returns { el, close }. Sheets stack (a confirm can open over an editor).
  sheet({ title = '', html = '', onMount, onClose, tall = false } = {}) {
    const host = document.getElementById('sheet-host');
    const wrap = document.createElement('div');
    wrap.className = 'sheet-overlay';
    wrap.innerHTML = `
      <div class="sheet ${tall ? 'sheet-tall' : ''}" role="dialog" aria-modal="true" aria-label="${U.esc(title)}">
        <div class="sheet-grip"></div>
        <div class="sheet-head">
          <h2 class="sheet-title">${U.esc(title)}</h2>
          <button class="icon-btn" data-sheet-close aria-label="Close"><i class="ph ph-x"></i></button>
        </div>
        <div class="sheet-body">${html}</div>
      </div>`;
    host.appendChild(wrap);
    document.body.classList.add('sheet-open');
    const entry = { wrap, onClose };
    UI._stack.push(entry);
    const close = () => UI._closeEntry(entry);
    entry.close = close;
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-sheet-close]')) close();
    });
    requestAnimationFrame(() => wrap.classList.add('open'));
    const body = wrap.querySelector('.sheet-body');
    if (onMount) onMount(body, close);
    return { el: body, close };
  },
  _closeEntry(entry) {
    const i = UI._stack.indexOf(entry);
    if (i === -1) return;
    UI._stack.splice(i, 1);
    entry.wrap.classList.remove('open');
    setTimeout(() => entry.wrap.remove(), 220);
    if (!UI._stack.length) document.body.classList.remove('sheet-open');
    if (entry.onClose) entry.onClose();
  },
  closeAll() { [...UI._stack].reverse().forEach(e => UI._closeEntry(e)); },

  confirm(message, { ok = 'OK', cancel = 'Cancel', danger = false, title = 'Are you sure?' } = {}) {
    return new Promise(resolve => {
      let done = false;
      const s = UI.sheet({
        title,
        html: `<p class="sheet-text">${U.esc(message)}</p>
          <div class="btn-row">
            <button class="btn btn-ghost" data-act="no">${U.esc(cancel)}</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="yes">${U.esc(ok)}</button>
          </div>`,
        onClose: () => { if (!done) resolve(false); },
        onMount: (el, close) => UI.on(el, {
          yes: () => { done = true; resolve(true); close(); },
          no: () => { done = true; resolve(false); close(); }
        })
      });
      return s;
    });
  },

  // A list of big buttons; resolves to the chosen value, or null if dismissed.
  choose(title, options, { text = '' } = {}) {
    return new Promise(resolve => {
      let done = false;
      UI.sheet({
        title,
        html: `${text ? `<p class="sheet-text">${U.esc(text)}</p>` : ''}
          <div class="choice-list">${options.map((o, i) => `
            <button class="choice ${o.danger ? 'choice-danger' : ''}" data-act="pick" data-i="${i}">
              ${o.icon ? `<i class="ph ${o.icon}"></i>` : ''}
              <span><b>${U.esc(o.label)}</b>${o.sub ? `<small>${U.esc(o.sub)}</small>` : ''}</span>
            </button>`).join('')}</div>`,
        onClose: () => { if (!done) resolve(null); },
        onMount: (el, close) => UI.on(el, {
          pick: (t) => { done = true; resolve(options[Number(t.dataset.i)].value); close(); }
        })
      });
    });
  },

  // Generic form sheet. fields: [{name,label,type,value,options,placeholder,hint,required,min,max,step,rows}]
  // Resolves to an object of values, or null if dismissed. Extra buttons: [{label, value, danger}] resolve {_button: value}.
  form(title, fields, { submit = 'Save', validate, buttons = [], intro = '', onMount: onFormMount } = {}) {
    return new Promise(resolve => {
      let done = false;
      UI.sheet({
        title,
        tall: fields.length > 5,
        html: `${intro}<form class="form" novalidate>
          ${fields.map(UI.fieldHtml).join('')}
          <p class="form-error" hidden></p>
          <button class="btn btn-primary btn-block" type="submit">${U.esc(submit)}</button>
          ${buttons.map((b, i) => `<button type="button" class="btn ${b.danger ? 'btn-danger-ghost' : 'btn-ghost'} btn-block" data-act="extra" data-i="${i}">${U.esc(b.label)}</button>`).join('')}
        </form>`,
        onClose: () => { if (!done) resolve(null); },
        onMount: (el, close) => {
          const form = el.querySelector('form');
          UI.wireQuickDurations(form);
          if (onFormMount) onFormMount(form);
          UI.on(el, {
            extra: (t) => { done = true; resolve({ _button: buttons[Number(t.dataset.i)].value }); close(); }
          });
          form.onsubmit = (e) => {
            e.preventDefault();
            const values = UI.readForm(form, fields);
            const missing = fields.find(f => f.required && (values[f.name] === '' || values[f.name] == null));
            let err = missing ? `Please fill in "${missing.label}".` : (validate ? validate(values) : null);
            const errEl = form.querySelector('.form-error');
            if (err) { errEl.textContent = err; errEl.hidden = false; return; }
            done = true; resolve(values); close();
          };
          const first = form.querySelector('input[type=text],textarea');
          if (first && !first.value && fields.length < 6) setTimeout(() => first.focus(), 250);
        }
      });
    });
  },
  fieldHtml(f) {
    const id = `f_${f.name}`;
    const v = f.value ?? '';
    const lab = f.label ? `<label for="${id}">${U.esc(f.label)}</label>` : '';
    const hint = f.hint ? `<small class="hint">${U.esc(f.hint)}</small>` : '';
    switch (f.type) {
      case 'textarea':
        return `<div class="field">${lab}<textarea id="${id}" name="${f.name}" rows="${f.rows || 3}" placeholder="${U.esc(f.placeholder || '')}">${U.esc(v)}</textarea>${hint}</div>`;
      case 'select':
        return `<div class="field">${lab}<select id="${id}" name="${f.name}">${f.options.map(o =>
          `<option value="${U.esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${U.esc(o.label)}</option>`).join('')}</select>${hint}</div>`;
      case 'checkbox':
        return `<label class="check-row" for="${id}"><input type="checkbox" id="${id}" name="${f.name}" ${v ? 'checked' : ''}><span>${U.esc(f.label)}</span></label>${hint}`;
      case 'checks': // multiple checkboxes: options [{value,label}], value = array
        return `<div class="field">${lab}<div class="checks">${f.options.map(o =>
          `<label class="check-pill"><input type="checkbox" name="${f.name}" value="${U.esc(o.value)}" ${(v || []).map(String).includes(String(o.value)) ? 'checked' : ''}><span>${U.esc(o.label)}</span></label>`).join('')}</div>${hint}</div>`;
      case 'durations': // quick-duration buttons that set the end time from the start time
        return `<div class="quick-durs" data-start="${f.start}" data-end="${f.end}">${[15, 30, 45, 60, 90].map(m =>
          `<button type="button" class="chip" data-dur="${m}">${m} min</button>`).join('')}</div>`;
      case 'html':
        return f.html;
      default:
        return `<div class="field">${lab}<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${U.esc(v)}"
          ${f.placeholder ? `placeholder="${U.esc(f.placeholder)}"` : ''} ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''}
          ${f.step != null ? `step="${f.step}"` : ''} ${f.type === 'number' ? 'inputmode="decimal"' : ''}>${hint}</div>`;
    }
  },
  wireQuickDurations(root) {
    root.querySelectorAll('.quick-durs').forEach(box => {
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-dur]');
        if (!b) return;
        const start = root.querySelector(`[name="${box.dataset.start}"]`);
        const end = root.querySelector(`[name="${box.dataset.end}"]`);
        if (start && end && start.value) end.value = U.fromMin(U.toMin(start.value) + Number(b.dataset.dur));
      });
    });
  },
  readForm(form, fields) {
    const out = {};
    for (const f of fields) {
      if (!f.name || f.type === 'html' || f.type === 'durations') continue;
      if (f.type === 'checkbox') out[f.name] = form.querySelector(`[name="${f.name}"]`).checked;
      else if (f.type === 'checks') out[f.name] = [...form.querySelectorAll(`[name="${f.name}"]:checked`)].map(i => i.value);
      else {
        const el = form.querySelector(`[name="${f.name}"]`);
        let val = el ? el.value : '';
        if (f.type === 'number') val = val === '' ? '' : Number(val);
        else if (typeof val === 'string' && f.type !== 'textarea') val = val.trim();
        out[f.name] = val;
      }
    }
    return out;
  },

  toast(msg, icon = 'ph-check-circle') {
    const host = document.getElementById('toast-host');
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<i class="ph-fill ${icon}"></i><span>${U.esc(msg)}</span>`;
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
  },

  // ---- small HTML builders used by many screens ----
  header(title, { back = true, right = '' } = {}) {
    return `<header class="view-head">
      ${back ? `<button class="icon-btn" data-nav-back aria-label="Back"><i class="ph ph-caret-left"></i></button>` : '<span class="icon-spacer"></span>'}
      <h1>${U.esc(title)}</h1>
      <div class="view-head-right">${right}</div>
    </header>`;
  },
  row({ icon = '', title, sub = '', act = '', data = {}, right = '<i class="ph ph-caret-right row-caret"></i>', color = '', cls = '' }) {
    const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${U.esc(v)}"`).join(' ');
    return `<button class="row ${cls}" ${act ? `data-act="${act}"` : ''} ${attrs} ${color ? `style="--row-color:${color}"` : ''}>
      ${icon ? `<span class="row-icon"><i class="ph ${icon}"></i></span>` : ''}
      <span class="row-main"><span class="row-title">${title}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</span>
      ${right}
    </button>`;
  },
  empty(text, icon = 'ph-sparkle') { return `<div class="empty"><i class="ph ${icon}"></i><p>${U.esc(text)}</p></div>`; },
  progress(value, max, color = 'var(--accent)') {
    const pct = max > 0 ? U.clamp(Math.round(value / max * 100), 0, 100) : 0;
    return `<div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div style="width:${pct}%;background:${color}"></div></div>`;
  },
  areaOptions(withNone = true, noneLabel = 'No area') {
    const list = (App.areas || []).filter(a => !a.archived);
    return [...(withNone ? [{ value: '', label: noneLabel }] : []), ...list.map(a => ({ value: a.id, label: a.name }))];
  },
  areaDot(areaId) {
    const a = App.areaById(areaId);
    return a ? `<span class="dot" style="background:${a.color}"></span>` : '';
  }
};
window.UI = UI;

// ---- Navigation between screens. Tabs reset the stack; sub-screens push onto it. ----
const Nav = {
  views: {},
  stack: [],
  register(name, def) { Nav.views[name] = def; },
  current() { return Nav.stack[Nav.stack.length - 1]; },
  async go(name, params = {}, { root = false, replace = false } = {}) {
    if (!Nav.views[name]) { console.error('Unknown screen', name); return; }
    if (root) Nav.stack = [];
    if (replace) Nav.stack.pop();
    Nav.stack.push({ name, params });
    await Nav.render(true);
  },
  async back() {
    if (Nav.stack.length > 1) { Nav.stack.pop(); await Nav.render(true); }
    else await Nav.go(Nav.views[Nav.current().name].tab || 'today', {}, { root: true });
  },
  async refresh() { await Nav.render(false); },
  _renderToken: 0,
  async render(scrollTop) {
    const cur = Nav.current();
    if (!cur) return;
    const def = Nav.views[cur.name];
    const el = document.getElementById('view');
    const token = ++Nav._renderToken;
    const y = window.scrollY;
    try {
      const html = await def.render(cur.params);
      if (token !== Nav._renderToken) return; // a newer render started
      el.innerHTML = html;
      el.dataset.view = cur.name;
      UI.on(el, def.actions ? def.actions(cur.params) : {});
      el.querySelectorAll('[data-nav-back]').forEach(b => b.addEventListener('click', () => Nav.back()));
      if (def.mounted) await def.mounted(el, cur.params);
    } catch (err) {
      console.error(err);
      el.innerHTML = `<div class="error-box"><h3>Something went wrong on this screen</h3><p>${U.esc(err.message)}</p>
        <button class="btn btn-primary" onclick="Nav.go('today',{}, {root:true})">Back to Today</button></div>`;
    }
    document.querySelectorAll('#tabbar [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === (def.tab || cur.name)));
    window.scrollTo(0, scrollTop ? 0 : y);
  }
};
window.Nav = Nav;
