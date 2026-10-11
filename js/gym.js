// ======= gym.js — workout log, templates, personal records, rest timer, weekly volume, deload =======

const Gym = {
  e1rm(w, r) { w = Number(w) || 0; r = Number(r) || 0; return r > 0 && w > 0 ? w * (1 + r / 30) : 0; },
  isDeload(date = U.todayStr()) { const g = App.settings.gym || {}; return !!g.deloadWeek && g.deloadWeek === U.weekStart(date); },
  setsDone(ex) { return (ex.sets || []).filter(s => s.done && (Number(s.reps) || 0) > 0); },

  async workouts() { return (await Repo.all('workout')).sort(U.by(w => `${w.date}${w.createdAt || ''}`)); },
  // The last finished session that included this exercise (for targets).
  lastFor(workouts, name, beforeId = null) {
    const n = U.norm(name);
    for (let i = workouts.length - 1; i >= 0; i--) {
      const w = workouts[i];
      if (w.id === beforeId || !w.finished) continue;
      const ex = (w.exercises || []).find(e => U.norm(e.name) === n);
      if (ex && Gym.setsDone(ex).length) return { date: w.date, sets: Gym.setsDone(ex) };
    }
    return null;
  },
  lastText(last) {
    if (!last) return 'No previous session';
    const best = last.sets.reduce((a, s) => (Number(s.weight) || 0) >= (Number(a.weight) || 0) ? s : a, last.sets[0]);
    return `Last (${U.fmtDate(last.date)}): ${last.sets.length}×${best.reps}${best.weight ? ` @ ${best.weight} kg` : ''}`;
  },
  prs(workouts) {
    const out = {};
    for (const w of workouts) {
      if (!w.finished) continue;
      for (const ex of w.exercises || []) {
        for (const s of Gym.setsDone(ex)) {
          const k = U.norm(ex.name);
          const e = Gym.e1rm(s.weight, s.reps), wt = Number(s.weight) || 0, reps = Number(s.reps) || 0;
          const p = out[k] = out[k] || { name: ex.name, muscle: ex.muscle, weight: 0, weightReps: 0, weightDate: '', e1rm: 0, e1rmDate: '', reps: 0, repsDate: '' };
          if (wt > p.weight) Object.assign(p, { weight: wt, weightReps: reps, weightDate: w.date });
          if (e > p.e1rm) Object.assign(p, { e1rm: e, e1rmDate: w.date });
          if (!wt && reps > p.reps) Object.assign(p, { reps, repsDate: w.date });
        }
      }
    }
    return out;
  },

  // ---------- starting a workout (from the Gym task on Today, or the log) ----------
  async startFromTask(date, taskId) {
    const all = await Gym.workouts();
    const open = all.find(w => w.taskDate === date && w.taskId === taskId);
    if (open) return Nav.go('workout', { id: open.id });
    const day = await Days.get(date);
    const task = day && day.tasks.find(t => t.id === taskId);
    return Gym.newWorkout({ date, taskId, templateId: task && task.workoutTemplateId });
  },
  // Planned sessions (Gym — Train A/B/C, Cardio) open straight away; otherwise choose a template.
  async newWorkout({ date = U.todayStr(), taskId = '', templateId = '' } = {}) {
    const tpls = (await Repo.all('workoutTemplate')).sort(U.by(t => t.name.toLowerCase()));
    let v = templateId && tpls.find(t => t.id === templateId) ? templateId : null;
    if (!v) v = await UI.choose('Start a workout', [...tpls.map(t => ({ value: t.id, label: t.name, sub: t.cardio ? 'Distance and time' : t.exercises.map(e => e.name).join(', '), icon: t.cardio ? 'ph-sneaker-move' : 'ph-barbell' })),
      { value: '__empty', label: 'Empty workout', sub: 'Add exercises as you go', icon: 'ph-plus' }],
    { text: Gym.isDeload(date) ? 'Deload week: aim for about 60% of your usual weights and fewer sets.' : '' });
    if (!v) return null;
    const t = tpls.find(x => x.id === v);
    const base = { id: U.uid('wo'), date, taskDate: taskId ? date : '', taskId, templateId: t ? t.id : '', name: t ? t.name : 'Workout', deload: Gym.isDeload(date), finished: false };
    const w = await Repo.put('workout', t && t.cardio
      ? { ...base, cardio: true, activity: 'Run', distance: '', minutes: '', exercises: [] }
      : { ...base, exercises: t ? t.exercises.map(e => ({ name: e.name, muscle: e.muscle, scheme: e.scheme || '', note: e.note || '', sets: Array.from({ length: Number(e.sets) || 3 }, () => ({ reps: '', weight: '', done: false })) })) : [] });
    Nav.go('workout', { id: w.id });
    return w;
  },
  // Planned reps for set i: from the scheme ("12-10-8"), else the template's reps.
  planReps(ex, target, i) {
    const sch = String(ex.scheme || (target && target.scheme) || '').split(/[-–,\s]+/).filter(Boolean);
    return sch[i] || sch[sch.length - 1] || (target && target.reps) || '';
  },
  pace(min, km) { if (!(min > 0 && km > 0)) return ''; const p = min / km; return `${Math.floor(p)}:${U.pad(Math.round((p % 1) * 60))} /km`; },

  async renderWorkout({ id }) {
    const w = await Repo.get('workout', id);
    if (!w) return `${UI.header('Workout')}${UI.empty('Workout not found.')}`;
    const all = await Gym.workouts();
    const tpl = w.templateId ? await Repo.get('workoutTemplate', w.templateId) : null;
    if (w.cardio) return Gym.renderCardioSession(w, all);
    return `${UI.header(`${w.name} · ${U.fmtDate(w.date)}`, { right: '<button class="icon-btn" data-act="menu" aria-label="Workout options"><i class="ph ph-dots-three-outline"></i></button>' })}
      ${w.deload ? '<div class="note"><i class="ph ph-feather"></i><span>Deload week: about 60% of your usual weights.</span></div>' : ''}
      ${(w.exercises || []).map((ex, ei) => {
        const last = Gym.lastFor(all, ex.name, w.id);
        const target = tpl && (tpl.exercises.find(e => U.norm(e.name) === U.norm(ex.name)) || {});
        return `<div class="card"><div class="cal-head"><div><h3>${U.esc(ex.name)}</h3><div class="muted tiny">${U.esc(ex.muscle || '')}${ex.scheme || (target && target.scheme) ? ` · plan ${U.esc(ex.scheme || target.scheme)}` : target && target.reps ? ` · plan ${target.sets}×${target.reps}` : ''}${ex.note ? ` ${U.esc(ex.note)}` : ''}</div></div>
          <button class="icon-btn" data-act="exMenu" data-e="${ei}" aria-label="Exercise options"><i class="ph ph-dots-three"></i></button></div>
          <div class="note" style="margin:6px 0"><i class="ph ph-target"></i><span>${U.esc(Gym.lastText(last))}${last && !w.deload ? ' — beat it!' : ''}</span></div>
          <div class="set-grid"><b>Set</b><b>kg</b><b>Reps</b><b></b>
          ${(ex.sets || []).map((s, si) => `<span class="muted">${si + 1}</span>
            <input type="number" inputmode="decimal" step="0.5" min="0" value="${U.esc(s.weight)}" placeholder="${last && last.sets[si] ? U.esc(last.sets[si].weight || '') : 'kg'}" data-change="setVal" data-e="${ei}" data-s="${si}" data-k="weight" aria-label="Weight set ${si + 1}">
            <input type="number" inputmode="numeric" min="0" value="${U.esc(s.reps)}" placeholder="${U.esc(Gym.planReps(ex, target, si) || (last && last.sets[si] ? last.sets[si].reps : '') || 'reps')}" data-change="setVal" data-e="${ei}" data-s="${si}" data-k="reps" aria-label="Reps set ${si + 1}">
            <button class="set-tick ${s.done ? 'on' : ''}" data-act="tickSet" data-e="${ei}" data-s="${si}" aria-label="Set done"><i class="ph ph-check"></i></button>`).join('')}</div>
          <button class="btn btn-small btn-ghost" data-act="addSet" data-e="${ei}" style="margin-top:6px"><i class="ph ph-plus"></i> Set</button></div>`;
      }).join('') || UI.empty('No exercises yet.', 'ph-barbell')}
      <button class="btn btn-ghost btn-block" data-act="addEx"><i class="ph ph-plus"></i> Add exercise</button>
      ${w.finished ? '<p class="muted small" style="text-align:center;margin-top:10px">Finished ✓ (you can still edit it)</p>' : '<button class="btn btn-primary btn-block" data-act="finish"><i class="ph ph-flag-checkered"></i> Finish workout</button>'}`;
  },
  workoutActions({ id }) {
    const get = () => Repo.get('workout', id);
    const put = (w) => Repo.put('workout', w);
    return {
      setVal: async (el) => { const w = await get(); w.exercises[el.dataset.e].sets[el.dataset.s][el.dataset.k] = el.value; await put(w); },
      tickSet: async (el) => {
        const w = await get();
        const row = el.closest('.card');
        const s = w.exercises[el.dataset.e].sets[el.dataset.s];
        const inputs = row.querySelectorAll(`[data-s="${el.dataset.s}"][data-change]`);
        inputs.forEach(i => { s[i.dataset.k] = i.value || (i.placeholder && /^\d/.test(i.placeholder) ? i.placeholder : ''); });
        s.done = !s.done;
        await put(w);
        if (s.done && window.Focus) Focus.rest(App.settings.gym.restSec || 90);
        Nav.refresh();
      },
      addSet: async (el) => { const w = await get(); const ex = w.exercises[el.dataset.e]; const prev = ex.sets[ex.sets.length - 1] || {}; ex.sets.push({ reps: prev.reps || '', weight: prev.weight || '', done: false }); await put(w); Nav.refresh(); },
      addEx: async () => {
        const f = await UI.form('Add exercise', [{ name: 'name', label: 'Exercise', required: true }, { name: 'muscle', label: 'Muscle group', placeholder: 'Chest, Back, Quads…' },
          { name: 'sets', type: 'number', label: 'Sets', value: 3, min: 1, max: 10 }]);
        if (!f) return;
        const w = await get();
        w.exercises.push({ name: f.name, muscle: f.muscle, sets: Array.from({ length: Number(f.sets) || 3 }, () => ({ reps: '', weight: '', done: false })) });
        await put(w); Nav.refresh();
      },
      exMenu: async (el) => {
        const w = await get(); const i = Number(el.dataset.e);
        const v = await UI.choose(w.exercises[i].name, [{ value: 'up', label: 'Move up', icon: 'ph-arrow-up' }, { value: 'rename', label: 'Rename / muscle group', icon: 'ph-pencil-simple' },
          { value: 'delset', label: 'Remove last set', icon: 'ph-minus' }, { value: 'del', label: 'Remove exercise', icon: 'ph-trash', danger: true }]);
        if (v === 'up' && i > 0) [w.exercises[i - 1], w.exercises[i]] = [w.exercises[i], w.exercises[i - 1]];
        else if (v === 'rename') { const f = await UI.form('Exercise', [{ name: 'name', label: 'Name', value: w.exercises[i].name, required: true }, { name: 'muscle', label: 'Muscle group', value: w.exercises[i].muscle }]); if (f) Object.assign(w.exercises[i], f); }
        else if (v === 'delset') w.exercises[i].sets.pop();
        else if (v === 'del') w.exercises.splice(i, 1);
        else return;
        await put(w); Nav.refresh();
      },
      menu: async () => {
        const w = await get();
        const v = await UI.choose(w.name, [{ value: 'rename', label: 'Rename / date', icon: 'ph-pencil-simple' }, { value: 'saveTpl', label: 'Save as workout template', icon: 'ph-floppy-disk' },
          { value: 'del', label: 'Delete workout', icon: 'ph-trash', danger: true }]);
        if (v === 'rename') { const f = await UI.form('Workout', [{ name: 'name', label: 'Name', value: w.name, required: true }, { name: 'date', type: 'date', label: 'Date', value: w.date }]); if (f) { Object.assign(w, f); await put(w); await App.changed({ celebrate: false }); } }
        else if (v === 'saveTpl') {
          const f = await UI.form('Save as template', [{ name: 'name', label: 'Template name', value: w.name, required: true }]);
          if (f) { await Repo.put('workoutTemplate', { id: U.uid('wt'), name: f.name, exercises: w.exercises.map(e => ({ name: e.name, muscle: e.muscle, sets: e.sets.length || 3, reps: Number((e.sets[0] || {}).reps) || 8 })) }); UI.toast('Template saved'); }
        } else if (v === 'del') { if (await UI.confirm('Delete this workout?', { ok: 'Delete', danger: true })) { await Repo.del('workout', id); await App.changed({ celebrate: false }); Nav.back(); } }
      },
      cardioVal: async (el) => { const w = await get(); w[el.dataset.k] = el.value; await put(w); },
      finish: async () => {
        const w = await get();
        if (w.cardio) return Gym.finishCardio(w);
        const before = Gym.prs((await Gym.workouts()).filter(x => x.id !== w.id));
        w.finished = true; w.finishedAt = new Date().toISOString();
        await put(w);
        // Tick the Gym task on that day, if the workout was started from it.
        if (w.taskId) { const day = await Days.get(w.taskDate); if (day && !Days.isDone(day, w.taskId)) await Days.toggleTask(w.taskDate, w.taskId); }
        const after = Gym.prs(await Gym.workouts());
        const news = Object.entries(after).filter(([k, p]) => before[k] && (p.weight > before[k].weight || p.e1rm > before[k].e1rm + 0.01 || p.reps > before[k].reps)).map(([, p]) => p);
        await App.changed();
        if (news.length) {
          await Otto.celebrate({ title: `New personal record${news.length > 1 ? 's' : ''}!`, sub: news.map(p => `${p.name}: ${p.weight ? `${p.weight} kg × ${p.weightReps}` : `${p.reps} reps`}`).join(' · '), kind: 'jaguar', button: 'Roar!' });
          if (window.Logs) await Repo.put('wins', { id: U.uid('win'), title: `PR — ${news.map(p => p.name).join(', ')}`, type: 'pr', areaId: 'a1', date: w.date, notes: '' });
          await App.changed({ celebrate: false });
        } else UI.toast('Workout saved. Great session!', 'ph-barbell');
        Nav.go('gym', {}, { replace: true });
      }
    };
  },

  // ---------- cardio / runs ----------
  ACTIVITIES: ['Run', 'Treadmill run', 'Cycle', 'Row', 'Swim', 'Walk', 'Other'],
  isRun(w) { return /run/i.test(w.activity || ''); },
  runPRs(list) {
    const runs = list.filter(w => w.cardio && w.finished && Gym.isRun(w) && Number(w.distance) > 0);
    const best = { longest: null, fastest: null, best5k: null };
    for (const r of runs) {
      const km = Number(r.distance), min = Number(r.minutes) || 0;
      if (!best.longest || km > Number(best.longest.distance)) best.longest = r;
      if (min && km >= 1 && (!best.fastest || min / km < best.fastest.minutes / best.fastest.distance)) best.fastest = r;
      if (min && km >= 5 && (!best.best5k || min / km < best.best5k.minutes / best.best5k.distance)) best.best5k = r;
    }
    return best;
  },
  renderCardioSession(w, all) {
    const prev = [...all].reverse().find(x => x.cardio && x.finished && x.id !== w.id);
    const pace = Gym.pace(Number(w.minutes), Number(w.distance));
    return `${UI.header(`${w.name} · ${U.fmtDate(w.date)}`, { right: '<button class="icon-btn" data-act="menu" aria-label="Workout options"><i class="ph ph-dots-three-outline"></i></button>' })}
      ${prev ? `<div class="note"><i class="ph ph-target"></i><span>Last: ${U.esc(prev.activity)} ${prev.distance} km${prev.minutes ? ` in ${prev.minutes} min (${Gym.pace(Number(prev.minutes), Number(prev.distance))})` : ''} on ${U.fmtDate(prev.date)}</span></div>` : ''}
      <div class="card"><div class="field"><label for="c_act">Activity</label><select id="c_act" data-change="cardioVal" data-k="activity">${Gym.ACTIVITIES.map(a => `<option ${a === w.activity ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
        <div class="two"><div class="field"><label for="c_km">Distance (km)</label><input id="c_km" type="number" inputmode="decimal" step="0.01" min="0" value="${U.esc(w.distance)}" data-change="cardioVal" data-k="distance"></div>
          <div class="field"><label for="c_min">Time (minutes)</label><input id="c_min" type="number" inputmode="decimal" step="0.1" min="0" value="${U.esc(w.minutes)}" data-change="cardioVal" data-k="minutes"></div></div>
        ${pace ? `<p class="small"><b>Pace:</b> ${pace}</p>` : ''}
        <div class="field"><label for="c_note">Notes (route, how it felt)</label><textarea id="c_note" rows="2" data-change="cardioVal" data-k="notes">${U.esc(w.notes || '')}</textarea></div></div>
      ${w.finished ? '<p class="muted small" style="text-align:center;margin-top:10px">Saved ✓ (you can still edit it)</p>' : '<button class="btn btn-primary btn-block" data-act="finish"><i class="ph ph-flag-checkered"></i> Save session</button>'}`;
  },
  async finishCardio(w) {
    // Read the fields straight from the screen, in case the last one hasn't fired "change" yet.
    const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    Object.assign(w, { activity: val('c_act') || w.activity, distance: val('c_km'), minutes: val('c_min'), notes: val('c_note') });
    if (!(Number(w.distance) > 0) && !(Number(w.minutes) > 0)) { UI.toast('Add a distance or a time first', 'ph-warning'); return; }
    const before = Gym.runPRs((await Gym.workouts()).filter(x => x.id !== w.id));
    w.finished = true; w.finishedAt = new Date().toISOString();
    await Repo.put('workout', w);
    if (w.taskId) { const day = await Days.get(w.taskDate); if (day && !Days.isDone(day, w.taskId)) await Days.toggleTask(w.taskDate, w.taskId); }
    const after = Gym.runPRs(await Gym.workouts());
    const news = [];
    if (after.longest && after.longest.id === w.id && before.longest) news.push(`Longest run: ${w.distance} km`);
    if (after.fastest && after.fastest.id === w.id && before.fastest) news.push(`Fastest pace: ${Gym.pace(Number(w.minutes), Number(w.distance))}`);
    if (after.best5k && after.best5k.id === w.id && before.best5k) news.push(`Best 5 km+ pace: ${Gym.pace(Number(w.minutes), Number(w.distance))}`);
    await App.changed();
    if (news.length) {
      await Otto.celebrate({ title: 'New running record!', sub: news.join(' · '), kind: 'jaguar', button: 'Roar!' });
      await Repo.put('wins', { id: U.uid('win'), title: `Running PR — ${news.join(', ')}`, type: 'pr', areaId: 'a1', date: w.date, notes: '' });
      await App.changed({ celebrate: false });
    } else UI.toast(`${w.distance ? `${w.distance} km` : `${w.minutes} min`} saved. Nice run!`, 'ph-sneaker-move');
    Nav.go('cardio', {}, { replace: true });
  },
  async renderCardio() {
    const all = (await Gym.workouts()).filter(w => w.cardio && w.finished);
    const wsNow = U.weekStart(U.todayStr());
    const weeks = [...Array(8)].map((_, i) => U.addDays(wsNow, -7 * (7 - i)));
    const km = (from, to) => U.sum(all.filter(w => w.date >= from && w.date <= to), w => Number(w.distance) || 0);
    const wk = (ws) => km(ws, U.addDays(ws, 6));
    const max = Math.max(1, ...weeks.map(wk));
    const month = U.monthStr(U.todayStr());
    const pr = Gym.runPRs(all);
    const prRow = (label, w, val) => w ? `<div class="small" style="margin-top:4px"><b>${label}:</b> ${val} <span class="muted">(${U.fmtDate(w.date)})</span></div>` : '';
    return `${UI.header('Runs & cardio', { right: '<button class="icon-btn" data-act="add" aria-label="Log a run"><i class="ph ph-plus"></i></button>' })}
      <div class="card"><div class="cal-head"><h3>This week: ${wk(wsNow).toFixed(1)} km</h3><span class="muted small">${U.MONTHS[Number(month.slice(5)) - 1]}: ${km(`${month}-01`, `${month}-31`).toFixed(1)} km</span></div>
        <div class="vbars">${weeks.map(ws => `<div class="vb" style="--c:#E8590C"><span>${wk(ws) ? wk(ws).toFixed(1) : ''}</span><div style="height:${Math.round(100 * wk(ws) / max)}%"></div>${U.fmtDate(ws, { dow: false })}</div>`).join('')}</div></div>
      <div class="card"><h3>Running records</h3>
        ${prRow('Longest run', pr.longest, pr.longest && `${pr.longest.distance} km`)}${prRow('Fastest pace (1 km+)', pr.fastest, pr.fastest && Gym.pace(Number(pr.fastest.minutes), Number(pr.fastest.distance)))}
        ${prRow('Best pace over 5 km+', pr.best5k, pr.best5k && `${Gym.pace(Number(pr.best5k.minutes), Number(pr.best5k.distance))} for ${pr.best5k.distance} km`)}
        ${pr.longest ? '' : '<p class="muted small">Log a run with distance and time to set records.</p>'}</div>
      <button class="btn btn-primary btn-block" data-act="add" style="margin:0 0 12px"><i class="ph ph-sneaker-move"></i> Log a run / cardio</button>
      ${[...all].reverse().map(w => UI.row({ icon: Gym.isRun(w) ? 'ph-sneaker-move' : 'ph-bicycle', color: '#E8590C', cls: 'card', title: `${U.esc(w.activity)}${w.distance ? ` · ${w.distance} km` : ''}${w.minutes ? ` · ${w.minutes} min` : ''}`,
        sub: `${U.fmtDate(w.date, { year: true })}${Gym.pace(Number(w.minutes), Number(w.distance)) ? ` · ${Gym.pace(Number(w.minutes), Number(w.distance))}` : ''}${w.notes ? ` · ${U.esc(w.notes)}` : ''}`, act: 'open', data: { id: w.id } })).join('') || UI.empty('No runs logged yet.', 'ph-sneaker-move')}`;
  },
  cardioActions() {
    return {
      open: (el) => Nav.go('workout', { id: el.dataset.id }),
      add: async () => {
        const tpl = (await Repo.all('workoutTemplate')).find(t => t.cardio);
        if (tpl) return Gym.newWorkout({ templateId: tpl.id });
        const w = await Repo.put('workout', { id: U.uid('wo'), date: U.todayStr(), name: 'Cardio', cardio: true, activity: 'Run', distance: '', minutes: '', exercises: [], finished: false });
        Nav.go('workout', { id: w.id });
      }
    };
  },

  // ---------- workout log ----------
  async renderLog() {
    const all = (await Gym.workouts()).reverse();
    const area = App.areaById('a1') || { target: 4 };
    const ws = U.weekStart(U.todayStr());
    const days = await DB.getAll('dayInstances');
    const gymDays = new Set(all.filter(w => w.finished && w.date >= ws).map(w => w.date));
    days.filter(d => d.date >= ws && d.date <= U.todayStr()).forEach(d => { if (d.tasks.some(t => t.tag === 'gym' && Days.isDone(d, t.id))) gymDays.add(d.date); });
    const target = area.streakType === 'weekly' ? area.target : 4;
    return `${UI.header('Workout log', { right: '<button class="icon-btn" data-act="start" aria-label="Start workout"><i class="ph ph-plus"></i></button>' })}
      <div class="card"><div class="cal-head"><h3>Gym days this week</h3><b>${gymDays.size} / ${target}</b></div>${UI.progress(gymDays.size, target, '#E8590C')}
        <label class="check-row" style="margin-top:8px"><input type="checkbox" data-change="deload" ${Gym.isDeload() ? 'checked' : ''}><span>This is a deload week (lighter targets)</span></label></div>
      <button class="btn btn-primary btn-block" data-act="start" style="margin:0 0 12px"><i class="ph ph-barbell"></i> Start a workout</button>
      ${all.map(w => {
        const sets = U.sum(w.exercises || [], e => Gym.setsDone(e).length);
        return UI.row({ icon: w.cardio ? 'ph-sneaker-move' : 'ph-barbell', color: '#E8590C', cls: 'card', title: `${U.esc(w.name)}${w.finished ? '' : ' <span class="tag warn">in progress</span>'}${w.deload ? ' <span class="tag">deload</span>' : ''}`,
          sub: w.cardio ? `${U.fmtDate(w.date, { year: true })} · ${U.esc(w.activity || '')}${w.distance ? ` · ${w.distance} km` : ''}${w.minutes ? ` · ${w.minutes} min` : ''}`
            : `${U.fmtDate(w.date, { year: true })} · ${(w.exercises || []).length} exercises · ${sets} sets`, act: 'open', data: { id: w.id } });
      }).join('') || UI.empty('No workouts logged yet. Start one from the Gym task on Today or here.', 'ph-barbell')}`;
  },
  logActions() {
    return {
      start: () => Gym.newWorkout({}),
      open: (el) => Nav.go('workout', { id: el.dataset.id }),
      deload: async (el) => { App.settings.gym.deloadWeek = el.checked ? U.weekStart(U.todayStr()) : ''; await App.saveSettings(); UI.toast(el.checked ? 'Deload week on' : 'Deload week off', 'ph-feather'); await App.changed({ celebrate: false }); }
    };
  },

  // ---------- templates ----------
  async renderTemplates() {
    const tpls = await Repo.all('workoutTemplate');
    const all = await Gym.workouts();
    return `${UI.header('Workout templates', { right: '<button class="icon-btn" data-act="add" aria-label="New template"><i class="ph ph-plus"></i></button>' })}
      ${tpls.map(t => `<div class="card"><div class="cal-head"><h3>${U.esc(t.name)}</h3><button class="icon-btn" data-act="edit" data-id="${t.id}" aria-label="Edit"><i class="ph ph-pencil-simple"></i></button></div>
        ${t.cardio ? '<p class="small muted" style="margin-top:4px">Cardio: logs activity, distance and time (see Runs & cardio).</p>' : ''}
        ${t.exercises.map(e => `<div class="small" style="margin-top:4px"><b>${U.esc(e.name)}</b> <span class="muted">${U.esc(e.muscle || '')} · ${e.scheme ? U.esc(e.scheme) : `${e.sets}×${e.reps}`}${e.note ? ` ${U.esc(e.note)}` : ''}</span><br><span class="tiny muted">${U.esc(Gym.lastText(Gym.lastFor(all, e.name)))}</span></div>`).join('')}</div>`).join('')
        || UI.empty('No templates.', 'ph-list-checks')}`;
  },
  templatesActions() {
    const edit = async (t) => {
      const f = await UI.form(t ? t.name : 'New workout template', [
        { name: 'name', label: 'Name', value: t ? t.name : '', required: true, placeholder: 'Push, Pull, Legs, Full body…' },
        { name: 'cardio', type: 'checkbox', label: 'Cardio session (distance and time instead of sets)', value: !!(t && t.cardio) },
        { name: 'ex', type: 'textarea', label: 'Exercises — one per line: Name | muscle | reps per set (12-10-8) or sets x reps (3x8) | note', rows: 8,
          value: t ? t.exercises.map(e => `${e.name} | ${e.muscle || ''} | ${e.scheme || `${e.sets}x${e.reps}`}${e.note ? ` | ${e.note}` : ''}`).join('\n') : 'Bench press | Chest | 12-10-8' }
      ], { buttons: t ? [{ label: 'Delete template', value: 'del', danger: true }] : [] });
      if (!f) return;
      if (f._button === 'del') { if (await UI.confirm(`Delete "${t.name}"? Logged workouts are kept.`, { ok: 'Delete', danger: true })) await Repo.del('workoutTemplate', t.id); }
      else {
        const exercises = f.ex.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
          const [name, muscle = '', sr = '3x8', note = ''] = l.split('|').map(x => x.trim());
          const m = sr.match(/(\d+)\s*[x×]\s*(\d+)/i);
          const scheme = !m && /\d+\s*[-–]\s*\d+/.test(sr) ? sr.replace(/\s+/g, '') : '';
          const parts = scheme ? scheme.split(/[-–]/).map(Number) : [];
          return { name, muscle, sets: m ? Number(m[1]) : parts.length || 3, reps: m ? Number(m[2]) : parts[0] || 8, scheme, note };
        });
        if (!f.cardio && !exercises.length) { UI.toast('Add at least one exercise', 'ph-warning'); return; }
        await Repo.put('workoutTemplate', { ...(t || { id: U.uid('wt') }), name: f.name, cardio: !!f.cardio, exercises: f.cardio ? [] : exercises });
      }
      await App.changed({ celebrate: false });
    };
    return { add: () => edit(null), edit: async (el) => edit(await Repo.get('workoutTemplate', el.dataset.id)) };
  },

  // ---------- personal records ----------
  async renderPRs() {
    const prs = Object.values(Gym.prs(await Gym.workouts())).sort(U.by(p => p.name.toLowerCase()));
    return `${UI.header('Personal records')}
      <p class="muted small" style="margin-bottom:10px">Detected automatically when you finish a workout. e1RM = estimated one-rep max (weight × (1 + reps/30)).</p>
      <div class="list">${prs.map(p => `<div class="row"><span class="row-icon" style="--row-color:#E8590C"><i class="ph ph-trophy"></i></span><span class="row-main">
        <span class="row-title">${U.esc(p.name)}</span><span class="row-sub">${p.weight ? `Heaviest ${p.weight} kg × ${p.weightReps} (${U.fmtDate(p.weightDate)}) · e1RM ${p.e1rm.toFixed(1)} kg` : `Most reps ${p.reps} (${U.fmtDate(p.repsDate)})`}</span></span></div>`).join('')
        || UI.empty('No records yet — finish a workout to set some.', 'ph-trophy')}</div>`;
  },

  // ---------- weekly volume per muscle group ----------
  async renderVolume() {
    const all = (await Gym.workouts()).filter(w => w.finished);
    const wsNow = U.weekStart(U.todayStr());
    const weeks = [0, 1, 2, 3].map(i => U.addDays(wsNow, -7 * i));
    const vol = (ws) => {
      const out = {};
      all.filter(w => w.date >= ws && w.date < U.addDays(ws, 7)).forEach(w => (w.exercises || []).forEach(e => Gym.setsDone(e).forEach(s => {
        const m = e.muscle || 'Other';
        const o = out[m] = out[m] || { sets: 0, kg: 0 };
        o.sets++; o.kg += (Number(s.weight) || 0) * (Number(s.reps) || 0);
      })));
      return out;
    };
    const cur = vol(wsNow);
    const max = Math.max(1, ...Object.values(cur).map(v => v.sets));
    return `${UI.header('Weekly volume')}
      <div class="card"><h3>This week (from ${U.fmtDate(wsNow)})</h3>
        <div class="bars" style="margin-top:8px">${Object.entries(cur).sort((a, b) => b[1].sets - a[1].sets).map(([m, v]) => `<div class="bar-row"><span>${U.esc(m)}</span>
          <span class="track"><span class="fill" style="width:${Math.round(100 * v.sets / max)}%;background:#E8590C"></span></span><span>${v.sets} sets</span></div>`).join('') || '<p class="muted small">No finished workouts this week.</p>'}</div></div>
      <div class="card"><h3>Last 4 weeks (total kg lifted)</h3>
        <div class="vbars">${weeks.slice().reverse().map(ws => { const kg = U.sum(Object.values(vol(ws)), v => v.kg); return `<div class="vb" style="--c:#E8590C"><span>${Math.round(kg)}</span><div style="height:${Math.round(100 * kg / Math.max(1, ...weeks.map(x => U.sum(Object.values(vol(x)), v => v.kg))))}%"></div>${U.fmtDate(ws, { dow: false })}</div>`; }).join('')}</div></div>`;
  }
};
window.Gym = Gym;

// A finished workout counts as a gym session for the Gym area (same tag as the Gym task, so not double-counted).
Streaks.extraSources.push(async () => (await Repo.all('workout')).filter(w => w.finished).map(w => ({ areaId: 'a1', date: w.date, n: 1, tag: 'gym' })));
Areas.extraHooks.a1 = async () => {
  const r = App.streaks && App.streaks.areas.a1;
  return `<div class="btn-wrap" style="margin:4px 0 0"><button class="btn btn-primary" data-act="startWorkout"><i class="ph ph-barbell"></i> Start a workout</button>
    ${Gym.isDeload() ? '<span class="tag info">Deload week</span>' : ''}${r && r.unit === 'week' ? `<span class="tag">${r.week.units} / ${r.week.target} gym days this week</span>` : ''}</div>`;
};
Areas.extraActions.a1 = () => ({ startWorkout: () => Gym.newWorkout({}) });

Nav.register('gym', { tab: 'today', render: () => Gym.renderLog(), actions: () => Gym.logActions() });
Nav.register('workout', { tab: 'today', render: (p) => Gym.renderWorkout(p), actions: (p) => Gym.workoutActions(p) });
Nav.register('gymTemplates', { tab: 'today', render: () => Gym.renderTemplates(), actions: () => Gym.templatesActions() });
Nav.register('gymPRs', { tab: 'today', render: () => Gym.renderPRs() });
Nav.register('cardio', { tab: 'today', render: () => Gym.renderCardio(), actions: () => Gym.cardioActions() });
Nav.register('gymVolume', { tab: 'today', render: () => Gym.renderVolume() });
