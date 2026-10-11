// ======= health.js — daily numbers from Apple Health (steps, food, weight, Forest focus minutes) =======
// iPhone web apps cannot read Apple Health. A free Shortcut (Shortcuts app) reads today's numbers from Health
// and copies them; "Sync from Health" here pastes them in. Lifesum writes food to Health, Forest writes its
// focus time as Mindful Minutes, the Apple Watch writes steps. Everything is stored on this device only.

const Health = {
  // [key, label, unit, input step]
  FIELDS: [['steps', 'Steps', '', 1], ['kcal', 'Calories eaten', 'kcal', 1], ['protein', 'Protein', 'g', 0.1], ['carbs', 'Carbohydrate', 'g', 0.1],
    ['fat', 'Fat', 'g', 0.1], ['weight', 'Weight', 'kg', 0.1], ['forest', 'Forest focus time', 'min', 1]],
  KEYS: [['steps', /^steps?\b/], ['kcal', /^(calories|dietary energy|energy|kcal)\b/], ['protein', /^protein\b/], ['carbs', /^carb/],
    ['fat', /^(fat|total fat)\b/], ['weight', /^(weight|body mass)\b/], ['forest', /^(forest|mindful|focus)\b/]],
  STEP_GOAL: 8000,
  SYNC_TIME: '23:15', // when the Shortcut automation runs; the Today reminder appears after this

  // ---------- reading the Shortcut's text ----------
  // "8,234" → 8234 · "64.5" → 64.5 · "64,5" → 64.5
  num(s) {
    const m = String(s).match(/-?\d[\d,]*(?:\.\d+)?/);
    if (!m) return null;
    const t = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(m[0]) ? m[0].replace(/,/g, '') : m[0].replace(',', '.');
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  },
  // Durations as Shortcuts may print them: "1 hr 35 min", "95 min", "5700 s", "1:35:00", or a bare number.
  minutes(s) {
    const str = String(s).toLowerCase();
    const hms = str.match(/(\d+):(\d{2})(?::(\d{2}))?/);
    if (hms) return hms[3] != null ? Number(hms[1]) * 60 + Number(hms[2]) + Number(hms[3]) / 60 : Number(hms[1]) * 60 + Number(hms[2]);
    let total = 0, any = false;
    for (const [, n, u] of str.matchAll(/(\d+(?:[.,]\d+)?)\s*(h(?:ou)?rs?|h|min(?:ute)?s?|m|s(?:ec(?:ond)?s?)?)\b/g)) {
      const v = Number(n.replace(',', '.')); any = true;
      total += /^h/.test(u) ? v * 60 : /^m/.test(u) ? v : v / 60;
    }
    if (any) return total;
    const n = Health.num(str);
    if (n == null) return null;
    return n > 1440 ? n / 60 : n; // more than a day's worth of minutes must be seconds
  },
  weightKg(s) {
    const str = String(s).toLowerCase();
    const st = str.match(/(\d+(?:\.\d+)?)\s*st(?:one)?s?\b(?:\s*(\d+(?:\.\d+)?)\s*lbs?)?/);
    if (st) return Number(st[1]) * 6.35029 + (st[2] ? Number(st[2]) * 0.453592 : 0);
    const n = Health.num(str);
    if (n == null) return null;
    return /lb|pound/.test(str) ? n * 0.453592 : n;
  },
  parseDate(s) {
    const iso = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const uk = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return uk ? `${uk[3]}-${uk[2].padStart(2, '0')}-${uk[1].padStart(2, '0')}` : null;
  },
  parse(text) {
    const values = {};
    let date = null;
    for (const raw of String(text || '').split(/\r?\n/)) {
      const m = raw.match(/^\s*([A-Za-z][A-Za-z ]*?)\s*[:=]\s*(.*)$/);
      if (!m || !m[2].trim()) continue;
      const key = m[1].toLowerCase().trim(), val = m[2].trim();
      if (key === 'date') { date = Health.parseDate(val) || date; continue; }
      const f = Health.KEYS.find(([, re]) => re.test(key));
      if (!f) continue;
      let v = f[0] === 'forest' ? Health.minutes(val) : f[0] === 'weight' ? Health.weightKg(val) : Health.num(val);
      if (v == null) continue;
      if (f[0] === 'kcal' && /kj/i.test(val)) v /= 4.184;
      values[f[0]] = Math.round(v * (['weight', 'protein', 'carbs', 'fat'].includes(f[0]) ? 10 : 1)) / (['weight', 'protein', 'carbs', 'fat'].includes(f[0]) ? 10 : 1);
    }
    return { date: date || U.todayStr(), values, found: Object.keys(values).length > 0 };
  },

  // ---------- syncing ----------
  async sync() {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch (e) { /* not allowed or empty: ask to paste instead */ }
    let p = Health.parse(text);
    if (!p.found) {
      const f = await UI.form('Paste from the Shortcut', [{ name: 'text', type: 'textarea', label: 'The text your "Otter Health" Shortcut copied', rows: 8 }],
        { submit: 'Read', intro: '<p class="sheet-text">Otter could not read your clipboard. Run the Shortcut, then press and hold below and tap Paste.</p>' });
      if (!f) return;
      p = Health.parse(f.text);
      if (!p.found) { await UI.confirm('No numbers were found. The text should have lines such as "Steps: 8234".', { ok: 'OK', title: 'Nothing to sync' }); return; }
    }
    return Health.edit(p.date, p.values, 'Check these match your Health app, then save.');
  },
  async edit(date, values, introText = '') {
    const f = await UI.form(`Health · ${U.fmtDate(date)}`, [
      { name: 'date', type: 'date', label: 'Date', value: date, required: true },
      ...Health.FIELDS.map(([k, l, u, step]) => ({ name: k, type: 'number', step, min: 0, label: u ? `${l} (${u})` : l, value: values[k] ?? '' }))
    ], { submit: 'Save', intro: introText ? `<p class="sheet-text">${U.esc(introText)}</p>` : '' });
    if (f) await Health.save(f);
  },
  async save(f) {
    const date = f.date || U.todayStr();
    const old = await Repo.get('health', `hl_${date}`);
    const rec = { ...(old || { id: `hl_${date}` }), date, syncedAt: new Date().toISOString() };
    for (const [k] of Health.FIELDS) rec[k] = f[k] === '' || f[k] == null ? null : Number(f[k]);
    await Repo.put('health', rec);
    const s = App.settings;
    s.health = { ...(s.health || {}), lastSync: rec.syncedAt };
    // Forest focus time counts as one Medical study session for that day (replaced on a re-sync).
    if (rec.forest > 0) {
      const id = `ss_forest_${date}`;
      await Repo.put('studySession', { ...((await Repo.get('studySession', id)) || { id }), date, resource: 'Forest', minutes: Math.round(rec.forest),
        questions: 0, correct: 0, topicId: '', note: 'From Apple Health (Forest focus time)' });
      if (s.study && Array.isArray(s.study.resources) && !s.study.resources.includes('Forest')) s.study.resources.push('Forest');
    }
    await App.saveSettings();
    // Tick that day's weigh-in and food log.
    const day = await Days.get(date);
    let ticked = 0;
    if (day) for (const [k, ok] of [['weigh', rec.weight > 0], ['food', rec.kcal > 0]]) {
      const t = day.tasks.find(x => x.id === `pg_${k}_${date}`);
      if (ok && t && !Days.isDone(day, t.id)) { await Days.toggleTask(date, t.id); ticked++; }
    }
    UI.toast(`Health saved for ${U.fmtDate(date)}${ticked ? ` · ${ticked} task${ticked > 1 ? 's' : ''} ticked` : ''}`, 'ph-heartbeat');
    await App.changed();
  },

  // ---------- summary ----------
  async records() { return (await Repo.all('health')).sort(U.by(r => r.date)); },
  avg(list, k) { const v = list.map(r => r[k]).filter(x => x > 0); return v.length ? U.sum(v) / v.length : null; },
  async render() {
    const all = await Health.records();
    const today = U.todayStr();
    const inRange = (from, to) => all.filter(r => r.date >= from && r.date <= to);
    const wk = inRange(U.addDays(today, -6), today), prev = inRange(U.addDays(today, -13), U.addDays(today, -7));
    const steps = Health.avg(wk, 'steps'), kcal = Health.avg(wk, 'kcal'), protein = Health.avg(wk, 'protein');
    const w1 = Health.avg(wk, 'weight'), w0 = Health.avg(prev, 'weight');
    const latestW = ([...all].reverse().find(r => r.weight > 0) || {}).weight;
    const forest = U.sum(wk.map(r => r.forest || 0));
    const pct = w1 && w0 ? (w1 - w0) / w0 * 100 : null;
    const r1 = (n) => Math.round(n * 10) / 10;
    const stat = (label, value, sub, cls = '') => `<div class="row"><span class="row-main"><span class="row-title">${label}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</span><b class="${cls}">${value}</b></div>`;
    const summary = all.length ? `<div class="section-title">Last 7 days</div><div class="list">
        ${stat('Steps (daily average)', steps ? Math.round(steps).toLocaleString('en-GB') : '—', `Goal: ${Health.STEP_GOAL.toLocaleString('en-GB')} weekly average, then 8,500–9,000`, steps ? (steps >= Health.STEP_GOAL ? 'good' : 'warn') : '')}
        ${stat('Calories eaten (average)', kcal ? `${Math.round(kcal)} kcal` : '—', 'From Lifesum')}
        ${stat('Protein (average)', protein ? `${Math.round(protein)} g` : '—', latestW ? `Target 1.6–2.0 g/kg: ${Math.round(1.6 * latestW)}–${Math.round(2 * latestW)} g` : 'Target 1.6–2.0 g/kg of body weight')}
        ${stat('Weight (7-day average)', w1 ? `${r1(w1)} kg` : '—', pct != null ? `${pct <= 0 ? '' : '+'}${r1(pct)}% vs the week before · aim −0.25 to −0.5%/week${pct < -0.75 ? ' · faster than planned: consider eating 100–200 kcal/day more' : ''}` : 'Needs two weeks of weigh-ins to show the trend')}
        ${stat('Forest focus time', forest ? `${Math.round(forest)} min` : '—', 'Counts as Medical study')}
      </div>` : '';
    const rows = [...all].reverse().slice(0, 21).map(r => UI.row({ icon: 'ph-heartbeat', act: 'edit', data: { date: r.date }, title: U.fmtDate(r.date, { year: true }),
      sub: [r.steps != null ? `${Math.round(r.steps).toLocaleString('en-GB')} steps` : '', r.kcal ? `${Math.round(r.kcal)} kcal` : '', r.protein ? `${r.protein} g protein` : '',
        r.weight ? `${r.weight} kg` : '', r.forest ? `${Math.round(r.forest)} min Forest` : ''].filter(Boolean).join(' · ') || 'No numbers' })).join('');
    return `${UI.header('Health sync')}
      <p class="muted small" style="margin:0 4px 10px">Steps (Apple Watch), food (Lifesum) and Forest focus time come from Apple Health through your "Otter Health" Shortcut. Stored only on this device.</p>
      <button class="btn btn-primary btn-block" data-act="sync"><i class="ph ph-arrows-clockwise"></i> Sync from Health</button>
      <button class="btn btn-ghost btn-block" data-act="setup" style="margin-bottom:12px"><i class="ph ph-question"></i> Set up the Shortcut (once)</button>
      ${summary}
      <div class="section-title">Days</div>
      ${rows ? `<div class="list">${rows}</div>` : UI.empty('Nothing synced yet. Set up the Shortcut once, then tap "Sync from Health" each evening.', 'ph-heartbeat')}`;
  },
  actions() {
    return {
      sync: () => Health.sync(),
      setup: () => Health.setupSheet(),
      edit: async (el) => {
        const r = await Repo.get('health', `hl_${el.dataset.date}`);
        if (!r) return;
        const v = await UI.choose(U.fmtDate(r.date, { year: true }), [{ value: 'edit', label: 'Edit numbers', icon: 'ph-pencil-simple' }, { value: 'del', label: 'Delete this day', icon: 'ph-trash' }]);
        if (v === 'edit') await Health.edit(r.date, r);
        if (v === 'del' && await UI.confirm('Delete the synced numbers for this day? (Ticked tasks and the Forest study session stay.)', { ok: 'Delete', danger: true })) { await Repo.del('health', r.id); await App.changed({ celebrate: false }); }
      }
    };
  },
  setupSheet() {
    const step = (t) => `<li style="margin:0 0 8px">${t}</li>`;
    UI.sheet({ title: 'Set up the "Otter Health" Shortcut', tall: true, html: `
      <p class="sheet-text">Once, about 10 minutes. Free: it uses Apple's Shortcuts app. Menu names can differ slightly between iOS versions.</p>
      <h3>1. Let the apps write to Apple Health</h3><ol class="small">
        ${step('<b>Lifesum</b>: in its settings, open Apple Health (or Connected apps) and allow it to write nutrition and weight.')}
        ${step('<b>Forest</b>: in its settings, turn on <b>Store Data to HealthKit</b> (focus time is saved as Mindful Minutes).')}
        ${step('<b>Apple Watch</b>: steps are already in Health.')}</ol>
      <h3>2. Make the Shortcut</h3><ol class="small">
        ${step('Open <b>Shortcuts</b>, tap <b>+</b>, name it <b>Otter Health</b>.')}
        ${step('Add <b>Find Health Samples</b>: Type <b>Steps</b> · filter <b>Start Date is today</b> · Group By <b>Day</b>. Then add <b>Set Variable</b> named <b>Steps</b>.')}
        ${step('Do the same for <b>Dietary Energy</b> → variable <b>Calories</b>, <b>Protein</b> → <b>Protein</b>, <b>Carbohydrates</b> → <b>Carbs</b>, <b>Total Fat</b> → <b>Fat</b>.')}
        ${step('Add <b>Find Health Samples</b>: Type <b>Weight</b> · Start Date is today · Sort by Start Date, Latest First · Limit 1. Then <b>Set Variable</b> <b>Weight</b>.')}
        ${step('Add <b>Find Health Samples</b>: Type <b>Mindful Minutes</b> · Start Date is today. Then <b>Get Details of Health Samples</b> → <b>Duration</b>, then <b>Calculate Statistics</b> → <b>Sum</b>, then <b>Set Variable</b> <b>Forest</b>.')}
        ${step('Add <b>Date</b> (Current Date), then <b>Format Date</b> → Date Format <b>Custom</b> → <b>yyyy-MM-dd</b>, then <b>Set Variable</b> <b>Day</b>.')}
        ${step('Add a <b>Text</b> action and type these lines, inserting each variable after the colon:<pre class="small" style="white-space:pre-wrap;margin:6px 0">Otter Health\nDate: Day\nSteps: Steps\nCalories: Calories\nProtein: Protein\nCarbs: Carbs\nFat: Fat\nWeight: Weight\nForest: Forest</pre>')}
        ${step('Add <b>Copy to Clipboard</b>. Tap ▶ once and <b>allow</b> access to Health when asked.')}</ol>
      <h3>3. Run it every evening</h3><ol class="small">
        ${step(`In Shortcuts, tap <b>Automation</b> → <b>+</b> → <b>Time of Day</b> → <b>${Health.SYNC_TIME}</b>, Daily → <b>Run Immediately</b> → choose <b>Otter Health</b>.`)}</ol>
      <h3>4. Each evening in Otter</h3><ol class="small">
        ${step(`After ${Health.SYNC_TIME}, tap the <b>Sync from Health</b> reminder on Today (or this screen) → tap <b>Paste</b> → check the numbers → <b>Save</b>.`)}
        ${step('First time: compare the numbers with the Health app. If one looks wrong (e.g. Forest minutes), correct it before saving and tell Claude so the reader can be adjusted.')}</ol>
      <button class="btn btn-primary btn-block" data-sheet-close>Done</button>` });
  }
};
window.Health = Health;

Nav.register('health', { tab: 'more', render: () => Health.render(), actions: () => Health.actions() });

// Today: after the Shortcut has run (or the next morning), a reminder to sync, once syncing has been set up.
Today.bannerHooks.push(async (day) => {
  const s = App.settings.health;
  if (!s || !s.lastSync || day.date !== U.todayStr()) return [];
  const d = new Date(), now = d.getHours() * 60 + d.getMinutes();
  const target = now >= U.toMin(Health.SYNC_TIME) ? day.date : now < 12 * 60 ? U.addDays(day.date, -1) : null;
  if (!target || await Repo.get('health', `hl_${target}`)) return [];
  return [{ cls: 'info', icon: 'ph-heartbeat', act: 'go', data: { view: 'health' }, text: `Sync ${target === day.date ? "today's" : "yesterday's"} Health data (steps, food, Forest)` }];
});
