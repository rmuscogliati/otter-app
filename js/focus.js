// ======= focus.js — focus timer, rest timer, time per area, energy check-in, sleep log, burnout guard =======

const Focus = {
  KEY: 'otter.timer', // the running timer survives a reload (per-device convenience; logged time goes to IndexedDB)
  state: null, tick: null,

  load() { try { const s = JSON.parse(localStorage.getItem(Focus.KEY) || 'null'); if (s && s.end) Focus.state = s; } catch (e) { Focus.state = null; } },
  persist() { try { if (Focus.state) localStorage.setItem(Focus.KEY, JSON.stringify(Focus.state)); else localStorage.removeItem(Focus.KEY); } catch (e) { /* storage unavailable */ } },
  // While paused, the time left is frozen in pausedLeft (ms).
  remaining() { const s = Focus.state; if (!s) return 0; return s.pausedLeft != null ? s.pausedLeft : Math.max(0, s.end - Date.now()); },

  async start({ task = null, date = U.todayStr(), minutes = null, areaId = null } = {}) {
    if (Focus.state && Focus.state.kind === 'focus' && !(await UI.confirm('A focus timer is already running. Stop it and start a new one?', { ok: 'Start new', title: 'Timer running' }))) return;
    if (Focus.state && Focus.state.kind === 'focus') await Focus.stop(true);
    const m = minutes || Number(App.settings.focus.minutes) || 25;
    Focus.state = { kind: 'focus', start: Date.now(), end: Date.now() + m * 60000, minutes: m, areaId: task ? task.areaId : areaId, title: task ? task.title : 'Focus session', date, taskId: task ? task.id : '' };
    Focus.persist(); Focus.run();
    UI.toast(`Focus: ${m} minutes. You've got this.`, 'ph-timer');
  },
  rest(sec) {
    if (Focus.state && Focus.state.kind === 'focus') return; // never interrupt a focus session
    Focus.state = { kind: 'rest', start: Date.now(), end: Date.now() + sec * 1000, title: 'Rest' };
    Focus.persist(); Focus.run();
  },
  run() {
    clearInterval(Focus.tick);
    Focus.render();
    if (!Focus.state) return;
    Focus.tick = setInterval(() => { if (Focus.state.pausedLeft == null && Focus.remaining() <= 0) Focus.finish(); else Focus.render(); }, 1000);
  },
  render() {
    const bar = document.getElementById('timer-bar');
    if (!bar) return;
    const s = Focus.state;
    if (!s) { bar.innerHTML = ''; return; }
    const r = Math.ceil(Focus.remaining() / 1000);
    const a = App.areaById(s.areaId);
    bar.innerHTML = `<div class="timer" style="${s.kind === 'rest' ? 'background:#E8590C;color:#fff' : ''}">
      <i class="ph ${s.kind === 'rest' ? 'ph-hourglass-medium' : 'ph-timer'}" style="font-size:1.3rem"></i>
      <span class="clock">${U.pad(Math.floor(r / 60))}:${U.pad(r % 60)}</span>
      <span class="lbl">${s.kind === 'rest' ? 'Rest between sets' : `${U.esc(s.title)}${a ? ` · ${U.esc(a.name)}` : ''}`}</span>
      ${s.kind === 'focus' ? `<button data-timer="pause" aria-label="${s.pausedLeft != null ? 'Resume' : 'Pause'}"><i class="ph ${s.pausedLeft != null ? 'ph-play' : 'ph-pause'}"></i></button>` : '<button data-timer="plus" aria-label="Add 30 seconds">+30</button>'}
      <button data-timer="stop" aria-label="Stop"><i class="ph ph-stop"></i></button></div>`;
    bar.onclick = (e) => {
      const b = e.target.closest('[data-timer]');
      if (!b) return;
      if (b.dataset.timer === 'pause') Focus.togglePause();
      else if (b.dataset.timer === 'plus') { Focus.state.end += 30000; Focus.persist(); Focus.render(); }
      else Focus.stop(false);
    };
  },
  togglePause() {
    const s = Focus.state;
    if (s.pausedLeft != null) { s.end = Date.now() + s.pausedLeft; delete s.pausedLeft; }
    else s.pausedLeft = Math.max(0, s.end - Date.now());
    Focus.persist(); Focus.render();
  },
  async log({ date, areaId, minutes, title, source = 'timer', taskId = '' }) {
    if (!(minutes > 0)) return;
    await Repo.put('timeLog', { id: U.uid('tl'), date, areaId: areaId || null, minutes: Math.round(minutes), title: title || '', source, taskId });
  },
  async finish() {
    const s = Focus.state;
    clearInterval(Focus.tick); Focus.state = null; Focus.persist(); Focus.render();
    U.vibrate([200, 100, 200]);
    if (s.kind === 'rest') { UI.toast('Rest over — next set!', 'ph-barbell'); return; }
    await Focus.log({ date: s.date, areaId: s.areaId, minutes: s.minutes, title: s.title, taskId: s.taskId });
    await App.changed();
    const a = App.areaById(s.areaId);
    await Otto.celebrate({ title: `${s.minutes} focused minutes!`, sub: a ? `Logged to ${a.name}.` : 'Logged (no area).', big: false, kind: a ? a.mascot : 'otter', button: 'Nice' });
  },
  async stop(silent) {
    const s = Focus.state;
    if (!s) return;
    clearInterval(Focus.tick); Focus.state = null; Focus.persist(); Focus.render();
    if (s.kind !== 'focus' || silent) return;
    const left = s.pausedLeft != null ? s.pausedLeft : Math.max(0, s.end - Date.now());
    const done = Math.floor((s.minutes * 60000 - left) / 60000);
    if (done >= 1 && await UI.confirm(`Log the ${done} minute${done === 1 ? '' : 's'} you did?`, { ok: 'Log time', cancel: 'Discard', title: 'Timer stopped' })) {
      await Focus.log({ date: s.date, areaId: s.areaId, minutes: done, title: s.title, taskId: s.taskId });
      UI.toast(`${done} minutes logged`, 'ph-clock'); await App.changed();
    }
  },
  async manual(preset = {}) {
    const f = await UI.form('Log time manually', [
      { name: 'date', type: 'date', label: 'Date', value: preset.date || U.todayStr(), required: true },
      { name: 'areaId', type: 'select', label: 'Area', value: preset.areaId || '', options: UI.areaOptions(true) },
      { name: 'minutes', type: 'number', label: 'Minutes', value: 30, min: 1, max: 1440, required: true },
      { name: 'title', label: 'What did you work on?', value: preset.title || '' }
    ], { submit: 'Log time' });
    if (!f) return;
    await Focus.log({ ...f, minutes: Number(f.minutes), source: 'manual' });
    UI.toast(`${f.minutes} minutes logged`, 'ph-clock'); await App.changed();
  },

  // ---------- time per area vs plan ----------
  async renderStats({ week } = {}) {
    const ws = week || U.weekStart(U.todayStr());
    const we = U.addDays(ws, 6);
    const logs = (await Repo.all('timeLog')).filter(l => l.date >= ws && l.date <= we);
    const days = (await DB.getAll('dayInstances')).filter(d => d.date >= ws && d.date <= we);
    const prios = (await Repo.all('weekPriority')).filter(p => p.week === ws);
    const planned = {}, actual = {};
    for (let i = 0; i < 7; i++) {
      const d = U.addDays(ws, i);
      const day = days.find(x => x.date === d);
      const tasks = day ? day.tasks : ((Days.defaultTemplateFor(d) || {}).tasks || []);
      tasks.filter(t => !t.infoOnly && t.areaId).forEach(t => { planned[t.areaId] = (planned[t.areaId] || 0) + U.durMin(t); });
    }
    logs.forEach(l => { const k = l.areaId || '_none'; actual[k] = (actual[k] || 0) + (Number(l.minutes) || 0); });
    const areas = App.visibleAreas();
    const max = Math.max(1, ...areas.map(a => Math.max(planned[a.id] || 0, actual[a.id] || 0)));
    return `${UI.header('Time per area', { right: '<button class="icon-btn" data-act="manual" aria-label="Log time"><i class="ph ph-plus"></i></button>' })}
      <div class="cal-head card"><button class="icon-btn" data-act="week" data-v="${U.addDays(ws, -7)}" aria-label="Previous week"><i class="ph ph-caret-left"></i></button>
        <b>Week of ${U.fmtDate(ws, { year: true })}</b><button class="icon-btn" data-act="week" data-v="${U.addDays(ws, 7)}" aria-label="Next week"><i class="ph ph-caret-right"></i></button></div>
      <div class="card"><h3>Logged vs planned</h3><p class="muted tiny">Bar = time logged (focus timer + manual). Black mark = time planned in that week's tasks.</p>
        <div class="bars" style="margin-top:8px">${areas.map(a => `<div class="bar-row"><span>${U.esc(a.name)}</span><span class="track"><span class="fill" style="width:${Math.round(100 * (actual[a.id] || 0) / max)}%;background:${a.color}"></span>
          ${planned[a.id] ? `<span class="plan" style="left:calc(${Math.min(100, Math.round(100 * planned[a.id] / max))}% - 2px)"></span>` : ''}</span><span>${U.fmtDur(actual[a.id] || 0)}</span></div>`).join('')}</div>
        <p class="small muted" style="margin-top:8px">Total logged: ${U.fmtDur(U.sum(Object.values(actual)))} · planned: ${U.fmtDur(U.sum(Object.values(planned)))}</p></div>
      ${prios.length ? `<div class="card"><h3>This week's priorities</h3>${areas.filter(a => prios.some(p => p.areaId === a.id)).map(a => `<div class="small" style="margin-top:4px"><b>${U.esc(a.name)}</b> (${U.fmtDur(actual[a.id] || 0)} logged): ${prios.filter(p => p.areaId === a.id).map(p => `${p.done ? '✓ ' : ''}${U.esc(p.text)}`).join(' · ')}</div>`).join('')}</div>` : ''}
      <div class="section-title">Entries</div>
      ${logs.sort(U.by(l => l.date)).reverse().map(l => UI.row({ icon: l.source === 'manual' ? 'ph-pencil-simple' : 'ph-timer', color: (App.areaById(l.areaId) || {}).color || '', cls: 'card',
        title: `${U.fmtDur(l.minutes)} · ${U.esc((App.areaById(l.areaId) || {}).name || 'No area')}`, sub: `${U.fmtDate(l.date)}${l.title ? ` · ${U.esc(l.title)}` : ''}`, act: 'edit', data: { id: l.id } })).join('') || UI.empty('No time logged this week.', 'ph-clock')}`;
  },
  statsActions(p = {}) {
    return {
      week: (el) => Nav.go('timeStats', { week: el.dataset.v }, { replace: true }),
      manual: () => Focus.manual({}),
      edit: async (el) => {
        const l = await Repo.get('timeLog', el.dataset.id);
        const f = await UI.form('Time entry', [{ name: 'date', type: 'date', label: 'Date', value: l.date }, { name: 'areaId', type: 'select', label: 'Area', value: l.areaId || '', options: UI.areaOptions(true) },
          { name: 'minutes', type: 'number', label: 'Minutes', value: l.minutes, min: 1 }, { name: 'title', label: 'Note', value: l.title }], { buttons: [{ label: 'Delete', value: 'del', danger: true }] });
        if (!f) return;
        if (f._button === 'del') await Repo.del('timeLog', l.id); else await Repo.put('timeLog', { ...l, ...f, areaId: f.areaId || null, minutes: Number(f.minutes) || 0 });
        await App.changed({ celebrate: false });
      }
    };
  }
};
window.Focus = Focus;

const Energy = {
  FACES: { 1: 'tired', 2: 'sleepy', 3: 'idle', 4: 'hopeful', 5: 'celebrate' },
  LABEL: { 1: 'Running on empty', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Full of beans' },
  async list() { return (await Repo.all('energy')).sort(U.by(e => e.date)); },
  async sleepList() { return (await Repo.all('sleep')).sort(U.by(e => e.date)); },
  // Burnout guard: average of the last N check-ins at or below the threshold.
  async burnout() {
    const e = App.settings.energy;
    const n = Number(e.burnoutDays) || 5;
    const last = (await Energy.list()).slice(-n);
    if (last.length < n) return null;
    const avg = U.sum(last, x => x.value) / n;
    return avg <= (Number(e.burnoutAvg) || 2) ? { avg, n } : null;
  },
  async ask(date = U.todayStr()) {
    const v = await new Promise(resolve => {
      let done = false;
      UI.sheet({ title: `Energy check-in`, html: `<p class="sheet-text">How's your energy right now, 1–5?</p>
        <div class="energy-row">${[1, 2, 3, 4, 5].map(n => `<button class="energy-btn" data-act="pick" data-v="${n}" aria-label="${n}: ${Energy.LABEL[n]}">
          <span class="mascot-slot">${Otto.show() ? Mascot.svg('otter', { face: true, size: 52, state: Energy.FACES[n], cls: 'm-static' }) : ''}</span><b>${n}</b></button>`).join('')}</div>
        <p class="muted tiny" style="text-align:center;margin-top:6px">1 = running on empty · 5 = full of beans</p>`,
      onClose: () => { if (!done) resolve(null); },
      onMount: (el, close) => UI.on(el, { pick: (t) => { done = true; resolve(Number(t.dataset.v)); close(); } }) });
    });
    App.settings.energy.lastAsked = date; await App.saveSettings();
    if (!v) return;
    await Repo.put('energy', { id: `en_${date}`, date, value: v, time: U.fromMin(U.nowMin()) });
    await App.changed({ celebrate: false });
    if (v <= 2) {
      const day = await Days.ensure(date);
      const min = App.modes.find(m => m.isMinimum);
      if (min && day.modeId !== min.id) {
        const yes = await new Promise(resolve => {
          let done = false;
          UI.sheet({ title: 'Take it easy?', html: `<div style="display:grid;place-items:center">${Otto.html('sleepy', 120)}</div>
            <p class="sheet-text" style="text-align:center">Low battery is okay. ${U.esc(min.name)} keeps your streak with just a few minutes.</p>
            <button class="btn btn-primary btn-block" data-act="yes"><i class="ph ph-moon"></i> Switch to ${U.esc(min.name)}</button>
            <button class="btn btn-ghost btn-block" data-act="no">Keep today's plan</button>`,
          onClose: () => { if (!done) resolve(false); },
          onMount: (el, close) => UI.on(el, { yes: () => { done = true; resolve(true); close(); }, no: () => { done = true; resolve(false); close(); } }) });
        });
        if (yes) { await Days.setMode(date, min.id); UI.toast(`Switched to ${min.name}. Rest well.`, 'ph-moon'); await App.changed(); }
      }
    } else UI.toast(v >= 4 ? 'Love that energy!' : 'Thanks for checking in', 'ph-battery-medium');
  },
  async maybeAsk() {
    const e = App.settings.energy;
    const today = U.todayStr();
    if (!e.enabled || e.lastAsked === today) return;
    if (U.nowMin() < U.toMin(e.time || '17:00')) return;
    if (await Repo.get('energy', `en_${today}`)) return;
    await Energy.ask(today);
  },
  async maybeAskSleep() {
    if (!App.settings.sleep.enabled) return;
    const today = U.todayStr();
    if (U.nowMin() >= 12 * 60 || App.settings.sleep.lastAsked === today || await Repo.get('sleep', `sl_${today}`)) return;
    App.settings.sleep.lastAsked = today; await App.saveSettings();
    await Energy.logSleep(today);
  },
  async logSleep(date, rec = null) {
    const f = await UI.form('Sleep log', [{ type: 'html', html: '<div class="two">' },
      { name: 'bed', type: 'time', label: 'Went to bed', value: rec ? rec.bed : '00:00', required: true },
      { name: 'wake', type: 'time', label: 'Woke up', value: rec ? rec.wake : U.fromMin(Math.min(U.nowMin(), 9 * 60)), required: true },
      { type: 'html', html: '</div>' }, { name: 'date', type: 'date', label: 'Morning of', value: date }], { submit: 'Save', buttons: rec ? [{ label: 'Delete', value: 'del', danger: true }] : [{ label: 'Skip today', value: 'skip' }] });
    if (!f || f._button === 'skip') return;
    if (f._button === 'del') { await Repo.del('sleep', rec.id); await App.changed({ celebrate: false }); return; }
    let mins = U.toMin(f.wake) - U.toMin(f.bed); if (mins <= 0) mins += 1440;
    await Repo.put('sleep', { id: `sl_${f.date}`, date: f.date, bed: f.bed, wake: f.wake, hours: Math.round(mins / 6) / 10 });
    UI.toast(`${Math.round(mins / 6) / 10} hours of sleep logged`, 'ph-bed'); await App.changed({ celebrate: false });
  },
  async startRecoveryWeek() {
    const mode = App.modes.find(m => m.id === 'm_recovery') || App.modes.find(m => /recovery/i.test(m.name));
    if (!mode) { UI.toast('Create a "Recovery week" day mode first (Plan › Day modes)', 'ph-warning'); return; }
    if (!(await UI.confirm(`Switch the next 7 days to "${mode.name}"? It protects your streaks; you can change any day afterwards.`, { ok: 'Start recovery week', title: 'Lighter week' }))) return;
    const today = U.todayStr();
    for (let i = 0; i < 7; i++) {
      const d = U.addDays(today, i);
      if (!App.shifts.find(s => s.date === d)) await Repo.put('shifts', { date: d, modeId: mode.id, label: 'Recovery week' });
    }
    await App.loadCore();
    // Days already planned switch now (even today with ticks: this mode keeps the plan, it only protects the streak).
    for (let i = 0; i < 7; i++) { const d = U.addDays(today, i); const day = await Days.get(d); if (day && day.modeId !== mode.id) await Days.setMode(d, mode.id); }
    App.settings.energy.recoveryFrom = today; await App.saveSettings();
    UI.toast('Recovery week on. Be gentle with yourself.', 'ph-heart'); await App.changed();
  },
  async render() {
    const en = await Energy.list(), sl = await Energy.sleepList();
    const days = [...Array(28)].map((_, i) => U.addDays(U.todayStr(), i - 27));
    const bo = await Energy.burnout();
    const avg = (arr) => arr.length ? (U.sum(arr, x => x.value ?? x.hours) / arr.length).toFixed(1) : '–';
    const last7 = (arr) => arr.filter(x => x.date > U.addDays(U.todayStr(), -7));
    return `${UI.header('Energy & sleep', { right: '<button class="icon-btn" data-act="log" aria-label="Check in now"><i class="ph ph-plus"></i></button>' })}
      ${bo ? `<div class="card" style="box-shadow:0 0 0 2px var(--warn)"><div class="hero" style="box-shadow:none;padding:0;margin:0"><div class="mascot-slot">${Otto.html('tired', 90)}</div>
        <div><b>Your energy has averaged ${bo.avg.toFixed(1)} over the last ${bo.n} check-ins.</b><p class="small muted">How about a lighter week? A recovery week protects all your streaks.</p></div></div>
        <button class="btn btn-primary btn-block" data-act="recovery"><i class="ph ph-heart"></i> Start a recovery week</button></div>` : ''}
      <div class="card"><div class="cal-head"><h3>Energy (last 28 days)</h3><span class="muted small">7-day avg ${avg(last7(en))}</span></div>
        <div class="vbars" style="height:110px">${days.map(d => { const e = en.find(x => x.date === d); return `<div class="vb" style="--c:${e ? ['#FA5252', '#FF922B', '#FCC419', '#94D82D', '#40C057'][e.value - 1] : 'transparent'}" title="${U.fmtDate(d)}"><div style="height:${e ? e.value * 20 : 0}%"></div></div>`; }).join('')}</div>
        <p class="tiny muted">${U.fmtDate(days[0])} → today</p></div>
      <div class="card"><div class="cal-head"><h3>Sleep</h3><span class="muted small">7-day avg ${avg(last7(sl))} h</span></div>
        ${sl.length ? `<div class="vbars" style="height:110px">${days.map(d => { const s = sl.find(x => x.date === d); return `<div class="vb" style="--c:#748FFC"><div style="height:${s ? Math.min(100, s.hours * 10) : 0}%"></div></div>`; }).join('')}</div>` : '<p class="muted small">No sleep logged. Turn on the optional sleep log in Settings › Energy, or log a night here.</p>'}
        <button class="btn btn-small btn-ghost" data-act="sleep" style="margin-top:8px"><i class="ph ph-bed"></i> Log a night</button></div>
      <div class="section-title">Recent check-ins</div>
      ${[...en].reverse().slice(0, 14).map(e => UI.row({ icon: 'ph-battery-medium', title: `${e.value} · ${Energy.LABEL[e.value]}`, sub: `${U.fmtDate(e.date)}${e.time ? ` at ${e.time}` : ''}`, act: 'editE', data: { id: e.id }, cls: 'card' })).join('') || UI.empty('No check-ins yet.', 'ph-battery-medium')}
      ${!bo ? '<button class="btn btn-ghost btn-block" data-act="recovery"><i class="ph ph-heart"></i> Start a recovery week anyway</button>' : ''}`;
  },
  actions() {
    return {
      log: () => Energy.ask(U.todayStr()),
      sleep: () => Energy.logSleep(U.todayStr()),
      recovery: () => Energy.startRecoveryWeek(),
      editE: async (el) => {
        const e = await Repo.get('energy', el.dataset.id);
        const f = await UI.form('Check-in', [{ name: 'value', type: 'select', label: 'Energy', value: e.value, options: [1, 2, 3, 4, 5].map(n => ({ value: n, label: `${n} · ${Energy.LABEL[n]}` })) }], { buttons: [{ label: 'Delete', value: 'del', danger: true }] });
        if (!f) return;
        if (f._button === 'del') await Repo.del('energy', e.id); else await Repo.put('energy', { ...e, value: Number(f.value) });
        await App.changed({ celebrate: false });
      }
    };
  }
};
window.Energy = Energy;

App.openHooks.push(() => Energy.maybeAskSleep(), () => Energy.maybeAsk());
document.addEventListener('visibilitychange', () => { if (!document.hidden && App.settings) Energy.maybeAsk(); });
Focus.load();
document.addEventListener('DOMContentLoaded', () => Focus.run());

Today.bannerHooks.push(async (day) => {
  if (day.date !== U.todayStr()) return [];
  const bo = await Energy.burnout();
  const key = `burnout_${U.weekStart(U.todayStr())}`;
  if (!bo || App.settings.reminders.dismissed[key] || (App.settings.energy.recoveryFrom && U.diffDays(App.settings.energy.recoveryFrom, U.todayStr()) < 7)) return [];
  return [{ cls: 'warn', icon: 'ph-heart', text: `Energy has been low lately (avg ${bo.avg.toFixed(1)}). A lighter week?`, act: 'go', data: { view: 'energy' }, dismiss: key }];
});

Nav.register('timeStats', { tab: 'more', render: (p) => Focus.renderStats(p), actions: (p) => Focus.statsActions(p) });
Nav.register('energy', { tab: 'more', render: () => Energy.render(), actions: () => Energy.actions() });
